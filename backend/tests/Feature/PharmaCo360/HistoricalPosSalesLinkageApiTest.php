<?php

namespace Tests\Feature\PharmaCo360;

use App\Models\PharmacoPayment;
use App\Models\PharmacoPosSession;
use App\Models\PharmacoSale;
use App\Models\Product;
use App\Models\StockBatch;
use App\Models\StockMovement;
use App\Models\Tenant;
use App\Models\Branch;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class HistoricalPosSalesLinkageApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_historical_sale_payment_and_stock_are_linked_to_session(): void
    {
        $this->seed();

        $token = $this->login();
        $tenant = $this->tenant();
        $branch = $this->branch($tenant);

        $user = User::query()
            ->where(
                'email',
                'admin@vitapharmaafrica.com'
            )
            ->firstOrFail();

        $businessDate = CarbonImmutable::now(
            'Africa/Kigali'
        )->subDays(20)->toDateString();

        $session = PharmacoPosSession::query()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $tenant->id,
            'branch_id' => $branch->id,
            'user_id' => $user->id,
            'business_date' => $businessDate,
            'session_mode' => 'historical',
            'historical_reason' =>
                'Paper sales require controlled historical entry.',
            'historical_reference' =>
                'HIST-SALES-LINKAGE-TEST',
            'historical_approval_id' => null,
            'sequence_number' => 1,
            'session_number' =>
                'HIST-TEST-'
                . Str::upper(Str::random(12)),
            'status' => 'open',
            'opening_float_amount' => 1000,
            'expected_cash_amount' => 1000,
            'opened_at' => now(),
            'metadata' => [
                'test' =>
                    'historical_sales_linkage',
            ],
        ]);

        $batch = StockBatch::query()
            ->where('tenant_id', $tenant->id)
            ->where('branch_id', $branch->id)
            ->where('quantity_on_hand', '>', 2)
            ->whereHas(
                'product',
                function ($query) {
                    $query
                        ->where('status', 'active')
                        ->where(
                            'requires_prescription',
                            false
                        );
                }
            )
            ->orderBy('expiry_date')
            ->orderBy('id')
            ->firstOrFail();

        $product = Product::query()
            ->findOrFail($batch->product_id);

        $draft = $this->tenantRequest($token)
            ->postJson(
                '/api/v1/pharmaco/sales',
                [
                    'branch_id' => $branch->id,
                    'sale_type' => 'cash_sale',
                    'notes' =>
                        'Historical sale linkage test.',
                    'items' => [
                        [
                            'product_id' =>
                                $product->id,
                            'quantity' => 2,
                            'unit_price' => 1500,
                            'discount_amount' => 0,
                            'tax_amount' => 0,
                        ],
                    ],
                ]
            )
            ->assertCreated()
            ->assertJsonPath(
                'sale.entry_mode',
                'historical'
            )
            ->assertJsonPath(
                'sale.business_date',
                $businessDate
            )
            ->assertJsonPath(
                'sale.pos_session_id',
                $session->id
            )
            ->assertJsonPath(
                'sale.is_historical',
                true
            );

        $saleId = $draft->json('sale.id');
        $saleItemId = $draft->json('sale.items.0.id');

        $sale = PharmacoSale::query()
            ->findOrFail($saleId);

        $this->assertSame(
            'historical',
            $sale->entry_mode
        );

        $this->assertSame(
            $businessDate,
            $sale->business_date->toDateString()
        );

        $this->assertSame(
            $session->id,
            $sale->pos_session_id
        );

        $beforeQuantity =
            (float) $batch->quantity_on_hand;

        $this->tenantRequest($token)
            ->postJson(
                "/api/v1/pharmaco/sales/"
                . "{$saleId}/confirm",
                [
                    'items' => [
                        [
                            'sale_item_id' =>
                                $saleItemId,
                            'stock_batch_id' =>
                                $batch->id,
                            'prescription_verified' =>
                                false,
                        ],
                    ],
                ]
            )
            ->assertOk()
            ->assertJsonPath(
                'sale.status',
                'dispensed'
            )
            ->assertJsonPath(
                'sale.entry_mode',
                'historical'
            )
            ->assertJsonPath(
                'sale.business_date',
                $businessDate
            )
            ->assertJsonPath(
                'sale.pos_session_id',
                $session->id
            );

        $movement = StockMovement::query()
            ->where('reference_number', $sale->sale_number)
            ->where('movement_type', 'sale_dispensed')
            ->firstOrFail();

        $this->assertSame(
            $session->id,
            $movement->pos_session_id
        );

        $this->assertSame(
            'historical',
            $movement->entry_mode
        );

        $this->assertSame(
            $businessDate,
            $movement->business_date
                ->toDateString()
        );

        $this->assertSame(
            $beforeQuantity - 2,
            (float) $batch->fresh()->quantity_on_hand
        );

        $this->assertSame(
            now()->toDateString(),
            $movement->occurred_at->toDateString()
        );

        $confirmedSale = $sale->fresh();

        $this->assertSame(
            now()->toDateString(),
            $confirmedSale->sold_at->toDateString()
        );

        $payment = $this->tenantRequest($token)
            ->postJson(
                "/api/v1/pharmaco/sales/"
                . "{$saleId}/payments",
                [
                    'amount' =>
                        (float)
                        $confirmedSale->balance_amount,
                    'payment_method' => 'cash',
                    'reference_number' =>
                        'HIST-CASH-001',
                    'received_at' =>
                        $businessDate
                        . ' 12:00:00',
                    'notes' =>
                        'Historical cash payment.',
                ]
            )
            ->assertCreated()
            ->assertJsonPath(
                'payment.entry_mode',
                'historical'
            )
            ->assertJsonPath(
                'payment.business_date',
                $businessDate
            )
            ->assertJsonPath(
                'payment.pos_session_id',
                $session->id
            )
            ->assertJsonPath(
                'payment.is_historical',
                true
            )
            ->assertJsonPath(
                'sale.payment_status',
                'paid'
            );

        $paymentId = $payment->json('payment.id');

        $storedPayment =
            PharmacoPayment::query()
                ->findOrFail($paymentId);

        $this->assertSame(
            $session->id,
            $storedPayment->pos_session_id
        );

        $this->assertSame(
            'historical',
            $storedPayment->entry_mode
        );

        $this->assertSame(
            $businessDate,
            $storedPayment->business_date
                ->toDateString()
        );

        $this->assertSame(
            now()->toDateString(),
            $storedPayment->received_at
                ->toDateString()
        );

        $this->assertSame(
            $businessDate . ' 12:00:00',
            $storedPayment->metadata[
                'requested_received_at'
            ]
        );

        $this->tenantRequest($token)
            ->getJson(
                '/api/v1/pharmaco/pos/'
                . 'historical/session/current'
                . '?business_date='
                . $businessDate
            )
            ->assertOk()
            ->assertJsonPath(
                'session.id',
                $session->id
            )
            ->assertJsonPath(
                'session.expected_cash_amount',
                4000
            );

        $this->assertDatabaseHas(
            'audit_logs',
            [
                'action' => 'pharmaco.sale.created',
                'auditable_id' => $saleId,
            ]
        );

        $this->assertDatabaseHas(
            'audit_logs',
            [
                'action' =>
                    'pharmaco.sale.dispensed',
                'auditable_id' => $saleId,
            ]
        );

        $this->assertDatabaseHas(
            'audit_logs',
            [
                'action' =>
                    'pharmaco.payment.recorded',
                'auditable_id' => $paymentId,
            ]
        );
    }

    public function test_live_sale_remains_live_without_historical_session(): void
    {
        $this->seed();

        $token = $this->login();
        $tenant = $this->tenant();
        $branch = $this->branch($tenant);

        $batch = StockBatch::query()
            ->where('tenant_id', $tenant->id)
            ->where('branch_id', $branch->id)
            ->where('quantity_on_hand', '>', 1)
            ->whereHas(
                'product',
                function ($query) {
                    $query
                        ->where('status', 'active')
                        ->where(
                            'requires_prescription',
                            false
                        );
                }
            )
            ->orderBy('expiry_date')
            ->orderBy('id')
            ->firstOrFail();

        $response = $this->tenantRequest($token)
            ->postJson(
                '/api/v1/pharmaco/sales',
                [
                    'branch_id' => $branch->id,
                    'sale_type' => 'cash_sale',
                    'items' => [
                        [
                            'product_id' =>
                                $batch->product_id,
                            'quantity' => 1,
                            'unit_price' => 1000,
                        ],
                    ],
                ]
            )
            ->assertCreated()
            ->assertJsonPath(
                'sale.entry_mode',
                'live'
            )
            ->assertJsonPath(
                'sale.pos_session_id',
                null
            )
            ->assertJsonPath(
                'sale.is_historical',
                false
            );

        $sale = PharmacoSale::query()
            ->findOrFail(
                $response->json('sale.id')
            );

        $this->assertNotSame(
            'historical',
            $sale->entry_mode
        );

        $this->assertNull(
            $sale->pos_session_id
        );
    }

    private function tenant(): Tenant
        {
            return Tenant::query()
                ->where('slug', 'vitapharma')
                ->firstOrFail();
        }

    private function branch(Tenant $tenant): Branch
        {
            return Branch::query()
                ->where('tenant_id', $tenant->id)
                ->firstOrFail();
        }

    private function tenantRequest(string $token)
        {
            return $this
                ->withHeader(
                    'X-Tenant-Slug',
                    'vitapharma'
                )
                ->withToken($token);
        }

    private function login(): string
        {
            $response = $this->postJson(
                '/api/v1/auth/login',
                [
                    'email' =>
                        'admin@vitapharmaafrica.com',
                    'password' =>
                        'ChangeThisPassword123!',
                    'device_name' =>
                        'POS Operations Test',
                ]
            );

            $response->assertOk();

            return $response->json('access_token');
        }
}
