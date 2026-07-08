<?php

namespace Tests\Feature\PharmaCo360;

use App\Models\AuditLog;
use App\Models\Branch;
use App\Models\PharmacoPayment;
use App\Models\PharmacoPaymentReconciliation;
use App\Models\PharmacoSale;
use App\Models\PharmacoSaleItem;
use App\Models\PharmacoSaleReturn;
use App\Models\PharmacoSaleReturnItem;
use App\Models\Solution;
use App\Models\StockBatch;
use App\Models\StockMovement;
use App\Models\Tenant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class PharmacoSaleReturnsApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_tenant_admin_can_submit_partial_sale_return(): void
    {
        $this->seed();

        $sale = $this->confirmSeededSale();
        $item = $sale->items->firstOrFail();
        $token = $this->loginAsTenantAdmin();

        $response = $this->tenantRequest($token)
            ->postJson(
                "/api/v1/pharmaco/sales/{$sale->id}/returns",
                [
                    'reason' =>
                        'Customer returned an unopened medicine package.',
                    'refund_method' => 'credit_note',
                    'notes' =>
                        'Package seal checked by the pharmacist.',
                    'items' => [
                        [
                            'sale_item_id' => $item->id,
                            'quantity' => 1,
                            'disposition' => 'restock',
                            'reason' =>
                                'Unopened and suitable for resale.',
                        ],
                    ],
                ]
            )
            ->assertCreated()
            ->assertJsonPath(
                'message',
                'Sale return submitted for approval.'
            )
            ->assertJsonPath('return.status', 'pending')
            ->assertJsonPath(
                'return.refund_method',
                'credit_note'
            )
            ->assertJsonPath(
                'return.items.0.sale_item_id',
                $item->id
            )
            ->assertJsonPath(
                'return.items.0.disposition',
                'restock'
            )
            ->assertJsonPath(
                'return.items.0.stock_restored',
                false
            );

        $returnId = $response->json('return.id');

        $this->assertDatabaseHas(
            'pharmaco_sale_returns',
            [
                'id' => $returnId,
                'tenant_id' => $sale->tenant_id,
                'pharmaco_sale_id' => $sale->id,
                'status' => 'pending',
            ]
        );

        $this->assertDatabaseHas(
            'pharmaco_sale_return_items',
            [
                'pharmaco_sale_return_id' => $returnId,
                'pharmaco_sale_item_id' => $item->id,
                'disposition' => 'restock',
                'stock_restored' => false,
            ]
        );

        $this->assertDatabaseHas(
            'audit_logs',
            [
                'action' =>
                    'pharmaco.sale.return.requested',
                'auditable_type' =>
                    PharmacoSaleReturn::class,
                'auditable_id' => $returnId,
            ]
        );
    }

    public function test_approved_return_restores_stock_and_issues_credit_note(): void
    {
        $this->seed();

        $sale = $this->confirmSeededSale();
        $item = $sale->items->firstOrFail();
        $batch = StockBatch::findOrFail(
            $item->stock_batch_id
        );

        $quantityBeforeReturn =
            (float) $batch->quantity_on_hand;

        $token = $this->loginAsTenantAdmin();

        $returnResponse = $this->tenantRequest($token)
            ->postJson(
                "/api/v1/pharmaco/sales/{$sale->id}/returns",
                [
                    'reason' =>
                        'Customer returned an unopened medicine package.',
                    'refund_method' => 'credit_note',
                    'items' => [
                        [
                            'sale_item_id' => $item->id,
                            'quantity' => 1,
                            'disposition' => 'restock',
                            'reason' =>
                                'Package remains sealed and undamaged.',
                        ],
                    ],
                ]
            )
            ->assertCreated();

        $returnId =
            (int) $returnResponse->json('return.id');

        $approvalResponse = $this->tenantRequest($token)
            ->postJson(
                "/api/v1/pharmaco/sales/returns/{$returnId}/approve",
                [
                    'refund_method' => 'credit_note',
                    'refund_reference' =>
                        'RETURN-QA-CREDIT-001',
                    'notes' =>
                        'Approved after pharmacist inspection.',
                ]
            )
            ->assertOk()
            ->assertJsonPath(
                'message',
                'Return approved, credit note issued, and refund recorded.'
            )
            ->assertJsonPath('return.status', 'refunded')
            ->assertJsonPath(
                'return.refund_method',
                'credit_note'
            )
            ->assertJsonPath(
                'return.items.0.stock_restored',
                true
            );

        $creditNoteNumber =
            $approvalResponse->json(
                'return.credit_note_number'
            );

        $this->assertNotNull($creditNoteNumber);
        $this->assertStringStartsWith(
            'CRN-',
            $creditNoteNumber
        );

        $batch->refresh();

        $this->assertEquals(
            $quantityBeforeReturn + 1,
            (float) $batch->quantity_on_hand
        );

        $saleReturn =
            PharmacoSaleReturn::findOrFail($returnId);

        $movement = StockMovement::query()
            ->where(
                'reference_number',
                $saleReturn->return_number
            )
            ->where(
                'movement_type',
                'sale_return_restock'
            )
            ->firstOrFail();

        $this->assertEquals(
            1,
            (float) $movement->quantity
        );

        $this->assertEquals(
            (float) $batch->quantity_on_hand,
            (float) $movement->running_balance,
            'Return movement must store the resulting '
            . 'inventory balance in running_balance.'
        );

        $this->assertDatabaseHas(
            'pharmaco_sale_return_items',
            [
                'pharmaco_sale_return_id' => $returnId,
                'pharmaco_sale_item_id' => $item->id,
                'stock_restored' => true,
            ]
        );

        $this->assertDatabaseHas(
            'audit_logs',
            [
                'action' =>
                    'pharmaco.sale.return.refunded',
                'auditable_type' =>
                    PharmacoSaleReturn::class,
                'auditable_id' => $returnId,
            ]
        );
    }

    public function test_pending_return_reserves_quantity_against_duplicate_return(): void
    {
        $this->seed();

        $sale = $this->confirmSeededSale();
        $item = $sale->items->firstOrFail();
        $token = $this->loginAsTenantAdmin();

        $this->tenantRequest($token)
            ->postJson(
                "/api/v1/pharmaco/sales/{$sale->id}/returns",
                [
                    'reason' =>
                        'First valid return request for this item.',
                    'refund_method' => 'credit_note',
                    'items' => [
                        [
                            'sale_item_id' => $item->id,
                            'quantity' =>
                                (float) $item->quantity,
                            'disposition' => 'quarantine',
                        ],
                    ],
                ]
            )
            ->assertCreated();

        $this->tenantRequest($token)
            ->postJson(
                "/api/v1/pharmaco/sales/{$sale->id}/returns",
                [
                    'reason' =>
                        'Duplicate request that exceeds remaining quantity.',
                    'refund_method' => 'credit_note',
                    'items' => [
                        [
                            'sale_item_id' => $item->id,
                            'quantity' => 0.001,
                            'disposition' => 'quarantine',
                        ],
                    ],
                ]
            )
            ->assertStatus(422)
            ->assertJsonValidationErrors('items');

        $this->assertSame(
            1,
            PharmacoSaleReturn::query()
                ->where(
                    'pharmaco_sale_id',
                    $sale->id
                )
                ->count()
        );
    }

    public function test_pending_return_can_be_rejected_without_stock_change(): void
    {
        $this->seed();

        $sale = $this->confirmSeededSale();
        $item = $sale->items->firstOrFail();
        $batch = StockBatch::findOrFail(
            $item->stock_batch_id
        );

        $quantityBeforeRejection =
            (float) $batch->quantity_on_hand;

        $token = $this->loginAsTenantAdmin();

        $returnResponse = $this->tenantRequest($token)
            ->postJson(
                "/api/v1/pharmaco/sales/{$sale->id}/returns",
                [
                    'reason' =>
                        'Customer requested return after leaving branch.',
                    'refund_method' => 'credit_note',
                    'items' => [
                        [
                            'sale_item_id' => $item->id,
                            'quantity' => 1,
                            'disposition' => 'quarantine',
                        ],
                    ],
                ]
            )
            ->assertCreated();

        $returnId =
            (int) $returnResponse->json('return.id');

        $this->tenantRequest($token)
            ->postJson(
                "/api/v1/pharmaco/sales/returns/{$returnId}/reject",
                [
                    'reason' =>
                        'Medicine storage conditions after sale '
                        . 'could not be verified.',
                ]
            )
            ->assertOk()
            ->assertJsonPath(
                'message',
                'Sale return rejected.'
            )
            ->assertJsonPath('return.status', 'rejected');

        $batch->refresh();

        $this->assertEquals(
            $quantityBeforeRejection,
            (float) $batch->quantity_on_hand
        );

        $this->assertSame(
            0,
            StockMovement::query()
                ->where(
                    'movement_type',
                    'sale_return_restock'
                )
                ->count()
        );

        $this->assertDatabaseHas(
            'audit_logs',
            [
                'action' =>
                    'pharmaco.sale.return.rejected',
                'auditable_type' =>
                    PharmacoSaleReturn::class,
                'auditable_id' => $returnId,
            ]
        );
    }

    public function test_matched_payment_can_be_reconciled(): void
    {
        $this->seed();

        $sale = $this->confirmSeededSale();
        $token = $this->loginAsTenantAdmin();

        $paymentResponse = $this->tenantRequest($token)
            ->postJson(
                "/api/v1/pharmaco/sales/{$sale->id}/payments",
                [
                    'amount' =>
                        (float) $sale->fresh()->balance_amount,
                    'payment_method' => 'momo',
                    'reference_number' =>
                        'MOMO-RETURN-QA-001',
                    'notes' =>
                        'Settlement subject to provider reconciliation.',
                ]
            )
            ->assertCreated();

        $paymentId =
            (int) $paymentResponse->json('payment.id');

        $payment =
            PharmacoPayment::findOrFail($paymentId);

        $response = $this->tenantRequest($token)
            ->postJson(
                "/api/v1/pharmaco/sales/payments/{$payment->id}/reconcile",
                [
                    'reconciliation_status' => 'matched',
                    'settled_amount' =>
                        (float) $payment->amount,
                    'provider_reference' =>
                        'PROVIDER-SETTLEMENT-001',
                    'notes' =>
                        'Matched against provider settlement report.',
                ]
            )
            ->assertOk()
            ->assertJsonPath(
                'message',
                'Payment reconciliation saved.'
            )
            ->assertJsonPath(
                'reconciliation.reconciliation_status',
                'matched'
            )
            ->assertJsonPath(
                'reconciliation.variance_amount',
                0
            );

        $reconciliationId =
            $response->json('reconciliation.id');

        $this->assertDatabaseHas(
            'pharmaco_payment_reconciliations',
            [
                'id' => $reconciliationId,
                'tenant_id' => $sale->tenant_id,
                'pharmaco_payment_id' => $payment->id,
                'reconciliation_status' => 'matched',
                'provider_reference' =>
                    'PROVIDER-SETTLEMENT-001',
            ]
        );

        $this->assertDatabaseHas(
            'audit_logs',
            [
                'action' =>
                    'pharmaco.payment.reconciled',
                'auditable_type' =>
                    PharmacoPaymentReconciliation::class,
                'auditable_id' => $reconciliationId,
            ]
        );
    }

    public function test_matched_reconciliation_rejects_nonzero_variance(): void
    {
        $this->seed();

        $sale = $this->confirmSeededSale();
        $token = $this->loginAsTenantAdmin();

        $paymentResponse = $this->tenantRequest($token)
            ->postJson(
                "/api/v1/pharmaco/sales/{$sale->id}/payments",
                [
                    'amount' => 1000,
                    'payment_method' => 'momo',
                    'reference_number' =>
                        'MOMO-VARIANCE-QA-001',
                ]
            )
            ->assertCreated();

        $paymentId =
            (int) $paymentResponse->json('payment.id');

        $this->tenantRequest($token)
            ->postJson(
                "/api/v1/pharmaco/sales/payments/{$paymentId}/reconcile",
                [
                    'reconciliation_status' => 'matched',
                    'settled_amount' => 999,
                    'provider_reference' =>
                        'PROVIDER-VARIANCE-001',
                ]
            )
            ->assertStatus(422)
            ->assertJsonValidationErrors(
                'settled_amount'
            );

        $this->assertSame(
            0,
            PharmacoPaymentReconciliation::query()
                ->where(
                    'pharmaco_payment_id',
                    $paymentId
                )
                ->count()
        );
    }

    public function test_return_routes_require_tenant_header(): void
    {
        $this->seed();

        $sale = $this->confirmSeededSale();
        $item = $sale->items->firstOrFail();
        $token = $this->loginAsTenantAdmin();

        $this->flushHeaders()
            ->withToken($token)
            ->postJson(
                "/api/v1/pharmaco/sales/{$sale->id}/returns",
                [
                    'reason' =>
                        'Return request without tenant context.',
                    'refund_method' => 'credit_note',
                    'items' => [
                        [
                            'sale_item_id' => $item->id,
                            'quantity' => 1,
                            'disposition' => 'quarantine',
                        ],
                    ],
                ]
            )
            ->assertStatus(422)
            ->assertJsonPath(
                'required_header',
                'X-Tenant-Slug'
            );
    }

    public function test_tenant_admin_cannot_return_sale_from_another_tenant(): void
    {
        $this->seed();

        $otherSale = $this->createOtherTenantSale();
        $token = $this->loginAsTenantAdmin();

        $this->tenantRequest($token)
            ->postJson(
                "/api/v1/pharmaco/sales/{$otherSale->id}/returns",
                [
                    'reason' =>
                        'Attempt to access another tenant sale.',
                    'refund_method' => 'credit_note',
                    'items' => [
                        [
                            'sale_item_id' => 999999,
                            'quantity' => 1,
                            'disposition' => 'quarantine',
                        ],
                    ],
                ]
            )
            ->assertNotFound();

        $this->assertSame(
            0,
            PharmacoSaleReturn::query()
                ->where(
                    'pharmaco_sale_id',
                    $otherSale->id
                )
                ->count()
        );
    }

    private function confirmSeededSale(): PharmacoSale
    {
        $sale = PharmacoSale::query()
            ->with('items')
            ->where(
                'sale_number',
                'SALE-VITA-DRAFT-0001'
            )
            ->firstOrFail();

        $token = $this->loginAsTenantAdmin();

        $payload = [
            'items' => $sale->items
                ->map(
                    function (
                        PharmacoSaleItem $item
                    ): array {
                        $batch = StockBatch::query()
                            ->where(
                                'tenant_id',
                                $item->tenant_id
                            )
                            ->where(
                                'product_id',
                                $item->product_id
                            )
                            ->where(
                                'quantity_on_hand',
                                '>',
                                0
                            )
                            ->orderBy('expiry_date')
                            ->orderBy('id')
                            ->firstOrFail();

                        return [
                            'sale_item_id' => $item->id,
                            'stock_batch_id' =>
                                $batch->id,
                            'prescription_verified' =>
                                true,
                        ];
                    }
                )
                ->values()
                ->all(),
        ];

        $this->tenantRequest($token)
            ->postJson(
                "/api/v1/pharmaco/sales/{$sale->id}/confirm",
                $payload
            )
            ->assertOk();

        return $sale->fresh('items');
    }

    private function tenantRequest(string $token): static
    {
        return $this
            ->withHeader(
                'X-Tenant-Slug',
                'vitapharma'
            )
            ->withToken($token);
    }

    private function loginAsTenantAdmin(): string
    {
        $response = $this->postJson(
            '/api/v1/auth/login',
            [
                'email' =>
                    'admin@vitapharmaafrica.com',
                'password' =>
                    'ChangeThisPassword123!',
                'device_name' =>
                    'PharmaCo360 Sale Returns API Test Client',
            ]
        );

        $response->assertOk();

        return $response->json('access_token');
    }

    private function createOtherTenantSale(): PharmacoSale
    {
        $solution = Solution::query()
            ->where('code', 'pharmaco360')
            ->firstOrFail();

        $tenant = Tenant::query()->create([
            'uuid' => (string) Str::uuid(),
            'name' => 'Other Return Pharmacy',
            'slug' =>
                'other-return-pharmacy-'
                . Str::lower(Str::random(6)),
            'legal_name' =>
                'Other Return Pharmacy Ltd',
            'primary_solution_id' => $solution->id,
            'tenant_type' => 'pharmacy',
            'status' => 'active',
        ]);

        $branch = Branch::query()->create([
            'tenant_id' => $tenant->id,
            'name' => 'Other Return Branch',
            'code' =>
                'OTHER-RETURN-'
                . Str::upper(Str::random(6)),
            'branch_type' => 'pharmacy',
            'status' => 'active',
        ]);

        return PharmacoSale::query()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $tenant->id,
            'branch_id' => $branch->id,
            'sale_number' =>
                'OTHER-RETURN-'
                . Str::upper(Str::random(6)),
            'sale_type' => 'cash_sale',
            'status' => 'dispensed',
            'subtotal_amount' => 1000,
            'discount_amount' => 0,
            'tax_amount' => 0,
            'total_amount' => 1000,
            'paid_amount' => 0,
            'balance_amount' => 1000,
            'payment_status' => 'unpaid',
            'sold_at' => now(),
        ]);
    }
}
