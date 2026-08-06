<?php

namespace Tests\Feature\PharmaCo360;

use App\Http\Controllers\Api\V1\PharmaCo360\SalesDispensingController;
use App\Models\PharmacoPayment;
use App\Models\PharmacoPosSession;
use App\Models\PharmacoSale;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\StockBatch;
use App\Models\StockLocation;
use App\Models\StockMovement;
use App\Models\Tenant;
use App\Models\User;
use App\Services\Access\ScopeResolver;
use App\Services\Audit\AuditLogService;
use App\Services\PharmaCo360\AtomicPosCheckoutService;
use App\Services\PharmaCo360\PosMultiBatchCheckoutAllocator;
use App\Services\PharmaCo360\PosSessionPolicyService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

final class CanonicalMultiBatchCheckoutControllerTest
    extends TestCase
{
    use RefreshDatabase;

    public function test_checkout_splits_one_line_across_fefo_batches_with_exact_traceability(): void
    {
        Carbon::setTestNow(
            Carbon::parse(
                '2026-08-04 10:00:00',
                'Africa/Kigali'
            )
        );

        try {
            [
                $tenant,
                $user,
                $location,
                $product,
                $earlierBatch,
                $laterBatch,
            ] = $this->createContext(
                'SUCCESS',
                1500
            );

            $response = $this->checkout(
                $tenant,
                $user,
                $this->checkoutPayload(
                    product: $product,
                    location: $location,
                    preferredBatch: $earlierBatch,
                    quantity: 15,
                    unitPrice: 1500,
                    idempotencyKey:
                        'wpa-fefo-success-20260804',
                    paymentReference:
                        'WPA-FEFO-PAYMENT-001'
                )
            );

            $this->assertSame(
                201,
                $response->getStatusCode(),
                json_encode(
                    $response->getData(true),
                    JSON_PRETTY_PRINT
                ) ?: 'Unexpected checkout response.'
            );

            $payload = $response->getData(true);

            $this->assertFalse(
                (bool) data_get(
                    $payload,
                    'idempotent'
                )
            );

            $sale = PharmacoSale::query()
                ->with([
                    'items' => fn ($query) =>
                        $query->orderBy('id'),
                ])
                ->findOrFail(
                    (int) data_get(
                        $payload,
                        'sale.id'
                    )
                );

            $this->assertSame(
                'dispensed',
                $sale->status
            );

            $this->assertSame(
                'paid',
                $sale->payment_status
            );

            $this->assertTrue(
                (bool) data_get(
                    $sale->metadata,
                    'stock_deducted'
                )
            );

            /*
             * Live-session and terminal linkage are intentionally
             * not approved by this test. Their current null linkage
             * remains a separate mandatory Work Package A gap.
             */
            $this->assertCount(
                2,
                $sale->items
            );

            $items = $sale->items->keyBy(
                static fn ($item): int =>
                    (int) $item->stock_batch_id
            );

            $earlierItem = $items->get(
                $earlierBatch->id
            );

            $laterItem = $items->get(
                $laterBatch->id
            );

            $this->assertNotNull(
                $earlierItem
            );

            $this->assertNotNull(
                $laterItem
            );

            $this->assertEqualsWithDelta(
                10,
                (float) $earlierItem->quantity,
                0.0001
            );

            $this->assertEqualsWithDelta(
                5,
                (float) $laterItem->quantity,
                0.0001
            );

            $this->assertSame(
                'dispensed',
                $earlierItem->status
            );

            $this->assertSame(
                'dispensed',
                $laterItem->status
            );

            $earlierBatch->refresh();
            $laterBatch->refresh();

            $this->assertEqualsWithDelta(
                0,
                (float) $earlierBatch
                    ->quantity_on_hand,
                0.0001
            );

            $this->assertEqualsWithDelta(
                1,
                (float) $laterBatch
                    ->quantity_on_hand,
                0.0001
            );

            $this->assertSame(
                'depleted',
                $earlierBatch->status
            );

            $this->assertSame(
                'active',
                $laterBatch->status
            );

            $movements = StockMovement::query()
                ->where(
                    'reference_number',
                    $sale->sale_number
                )
                ->where(
                    'movement_type',
                    'sale_dispensed'
                )
                ->get()
                ->keyBy(
                    static fn (StockMovement $movement): int =>
                        (int) $movement->stock_batch_id
                );

            $this->assertCount(
                2,
                $movements
            );

            $earlierMovement = $movements->get(
                $earlierBatch->id
            );

            $laterMovement = $movements->get(
                $laterBatch->id
            );

            $this->assertNotNull(
                $earlierMovement
            );

            $this->assertNotNull(
                $laterMovement
            );

            $this->assertEqualsWithDelta(
                -10,
                (float) $earlierMovement->quantity,
                0.0001
            );

            $this->assertEqualsWithDelta(
                -5,
                (float) $laterMovement->quantity,
                0.0001
            );

            $this->assertSame(
                (int) $earlierItem->id,
                (int) data_get(
                    $earlierMovement->metadata,
                    'sale_item_id'
                )
            );

            $this->assertSame(
                (int) $laterItem->id,
                (int) data_get(
                    $laterMovement->metadata,
                    'sale_item_id'
                )
            );

            $this->assertSame(
                (int) $sale->id,
                (int) data_get(
                    $earlierMovement->metadata,
                    'sale_id'
                )
            );

            $this->assertSame(
                (int) $sale->id,
                (int) data_get(
                    $laterMovement->metadata,
                    'sale_id'
                )
            );

            $payment = PharmacoPayment::query()
                ->where(
                    'pharmaco_sale_id',
                    $sale->id
                )
                ->firstOrFail();

            $this->assertEqualsWithDelta(
                (float) $sale->total_amount,
                (float) $payment->amount,
                0.0001
            );

            $this->assertSame(
                'completed',
                $payment->status
            );
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_payment_failure_rolls_back_every_fefo_deduction(): void
    {
        Carbon::setTestNow(
            Carbon::parse(
                '2026-08-04 10:15:00',
                'Africa/Kigali'
            )
        );

        try {
            [
                $tenant,
                $user,
                $location,
                $product,
                $earlierBatch,
                $laterBatch,
            ] = $this->createContext(
                'ROLLBACK',
                0
            );

            $paymentCountBefore =
                PharmacoPayment::query()->count();

            try {
                $this->checkout(
                    $tenant,
                    $user,
                    $this->checkoutPayload(
                        product: $product,
                        location: $location,
                        preferredBatch: $earlierBatch,
                        quantity: 15,
                        unitPrice: 0,
                        idempotencyKey:
                            'wpa-fefo-rollback-20260804',
                        paymentReference:
                            'WPA-FEFO-ROLLBACK-001'
                    )
                );

                $this->fail(
                    'Zero-balance checkout must fail '
                    . 'during payment processing.'
                );
            } catch (ValidationException $exception) {
                $this->assertArrayHasKey(
                    'payment',
                    $exception->errors()
                );
            }

            $this->assertSame(
                0,
                PharmacoSale::query()
                    ->where(
                        'pos_checkout_key',
                        'wpa-fefo-rollback-20260804'
                    )
                    ->count()
            );

            $this->assertSame(
                0,
                StockMovement::query()
                    ->where(
                        'product_id',
                        $product->id
                    )
                    ->where(
                        'movement_type',
                        'sale_dispensed'
                    )
                    ->count()
            );

            $this->assertSame(
                $paymentCountBefore,
                PharmacoPayment::query()->count()
            );

            $earlierBatch->refresh();
            $laterBatch->refresh();

            $this->assertEqualsWithDelta(
                10,
                (float) $earlierBatch
                    ->quantity_on_hand,
                0.0001
            );

            $this->assertEqualsWithDelta(
                6,
                (float) $laterBatch
                    ->quantity_on_hand,
                0.0001
            );

            $this->assertSame(
                'active',
                $earlierBatch->status
            );

            $this->assertSame(
                'active',
                $laterBatch->status
            );
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_live_checkout_links_sale_payment_and_all_movements_to_exact_session(): void
    {
        Carbon::setTestNow(
            Carbon::parse(
                '2026-08-04 13:00:00',
                'Africa/Kigali'
            )
        );

        try {
            [
                $tenant,
                $user,
                $location,
                $product,
                $earlierBatch,
            ] = $this->createContext(
                'SESSION-LINK',
                1500
            );

            $session = $this->createLiveSession(
                tenant: $tenant,
                user: $user,
                branchId:
                    (int) $location->branch_id,
                terminalIdentifier:
                    'canonical-session-link-terminal'
            );

            $payload = $this->checkoutPayload(
                product: $product,
                location: $location,
                preferredBatch: $earlierBatch,
                quantity: 15,
                unitPrice: 1500,
                idempotencyKey:
                    'canonical-session-link',
                paymentReference:
                    'SESSION-LINK-PAYMENT'
            );

            $payload['pos_session_id'] =
                $session->id;

            $payload['terminal_identifier'] =
                $session->terminal_identifier;

            $response = $this->checkout(
                $tenant,
                $user,
                $payload
            );

            $this->assertSame(
                201,
                $response->getStatusCode()
            );

            $responsePayload =
                $response->getData(true);

            $sale = PharmacoSale::query()
                ->findOrFail(
                    (int) data_get(
                        $responsePayload,
                        'sale.id'
                    )
                );

            $payment = PharmacoPayment::query()
                ->findOrFail(
                    (int) data_get(
                        $responsePayload,
                        'payment.id'
                    )
                );

            $this->assertSame(
                $session->id,
                (int) $sale->pos_session_id
            );

            $this->assertSame(
                'live',
                $sale->entry_mode
            );

            $this->assertSame(
                $session->business_date
                    ->toDateString(),
                $sale->business_date
                    ->toDateString()
            );

            $this->assertSame(
                $session->terminal_identifier,
                data_get(
                    $sale->metadata,
                    'terminal_identifier'
                )
            );

            $this->assertSame(
                $session->id,
                (int) $payment->pos_session_id
            );

            $this->assertSame(
                'live',
                $payment->entry_mode
            );

            $movements = StockMovement::query()
                ->where(
                    'reference_number',
                    $sale->sale_number
                )
                ->where(
                    'movement_type',
                    'sale_dispensed'
                )
                ->get();

            $this->assertNotEmpty(
                $movements
            );

            foreach ($movements as $movement) {
                $this->assertSame(
                    $session->id,
                    (int)
                    $movement->pos_session_id
                );

                $this->assertSame(
                    'live',
                    $movement->entry_mode
                );

                $this->assertSame(
                    $session->business_date
                        ->toDateString(),
                    $movement->business_date
                        ->toDateString()
                );
            }

            $expectedCash = app(
                PosSessionPolicyService::class
            )->expectedCash(
                $session->fresh()
            );

            $this->assertEqualsWithDelta(
                (float) $payment->amount,
                $expectedCash,
                0.0001
            );
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_live_checkout_rejects_wrong_terminal_identifier(): void
    {
        Carbon::setTestNow(
            Carbon::parse(
                '2026-08-04 13:10:00',
                'Africa/Kigali'
            )
        );

        try {
            [
                $tenant,
                $user,
                $location,
                $product,
                $earlierBatch,
            ] = $this->createContext(
                'WRONG-TERMINAL',
                1500
            );

            $session = $this->createLiveSession(
                tenant: $tenant,
                user: $user,
                branchId:
                    (int) $location->branch_id,
                terminalIdentifier:
                    'canonical-correct-terminal'
            );

            $payload = $this->checkoutPayload(
                product: $product,
                location: $location,
                preferredBatch: $earlierBatch,
                quantity: 1,
                unitPrice: 1500,
                idempotencyKey:
                    'canonical-wrong-terminal',
                paymentReference:
                    'WRONG-TERMINAL-PAYMENT'
            );

            $payload['pos_session_id'] =
                $session->id;

            $payload['terminal_identifier'] =
                'canonical-wrong-terminal';

            try {
                $this->checkout(
                    $tenant,
                    $user,
                    $payload
                );

                $this->fail(
                    'Wrong-terminal checkout was not rejected.'
                );
            } catch (
                ValidationException $exception
            ) {
                $this->assertArrayHasKey(
                    'pos_session_id',
                    $exception->errors()
                );
            }

            $this->assertDatabaseMissing(
                'pharmaco_sales',
                [
                    'pos_checkout_key' =>
                        'canonical-wrong-terminal',
                ]
            );
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_live_checkout_rejects_closed_session(): void
    {
        Carbon::setTestNow(
            Carbon::parse(
                '2026-08-04 13:20:00',
                'Africa/Kigali'
            )
        );

        try {
            [
                $tenant,
                $user,
                $location,
                $product,
                $earlierBatch,
            ] = $this->createContext(
                'CLOSED-SESSION',
                1500
            );

            $session = $this->createLiveSession(
                tenant: $tenant,
                user: $user,
                branchId:
                    (int) $location->branch_id,
                terminalIdentifier:
                    'canonical-closed-terminal'
            );

            $session->forceFill([
                'status' => 'closed',
                'closed_at' => now(),
            ])->save();

            $payload = $this->checkoutPayload(
                product: $product,
                location: $location,
                preferredBatch: $earlierBatch,
                quantity: 1,
                unitPrice: 1500,
                idempotencyKey:
                    'canonical-closed-session',
                paymentReference:
                    'CLOSED-SESSION-PAYMENT'
            );

            $payload['pos_session_id'] =
                $session->id;

            $payload['terminal_identifier'] =
                $session->terminal_identifier;

            try {
                $this->checkout(
                    $tenant,
                    $user,
                    $payload
                );

                $this->fail(
                    'Closed-session checkout was not rejected.'
                );
            } catch (
                ValidationException $exception
            ) {
                $this->assertArrayHasKey(
                    'pos_session_id',
                    $exception->errors()
                );
            }

            $this->assertDatabaseMissing(
                'pharmaco_sales',
                [
                    'pos_checkout_key' =>
                        'canonical-closed-session',
                ]
            );
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_expected_cash_is_isolated_between_parallel_terminals(): void
    {
        Carbon::setTestNow(
            Carbon::parse(
                '2026-08-04 13:30:00',
                'Africa/Kigali'
            )
        );

        try {
            [
                $tenant,
                $user,
                $location,
                $product,
                $earlierBatch,
            ] = $this->createContext(
                'PARALLEL-CASH',
                1500
            );

            $terminalA =
                $this->createLiveSession(
                    tenant: $tenant,
                    user: $user,
                    branchId:
                        (int) $location->branch_id,
                    terminalIdentifier:
                        'canonical-parallel-terminal-a'
                );

            $terminalB =
                $this->createLiveSession(
                    tenant: $tenant,
                    user: $user,
                    branchId:
                        (int) $location->branch_id,
                    terminalIdentifier:
                        'canonical-parallel-terminal-b'
                );

            foreach (
                [
                    [$terminalA, 'parallel-cash-a'],
                    [$terminalB, 'parallel-cash-b'],
                ] as [
                    $terminal,
                    $suffix,
                ]
            ) {
                $payload =
                    $this->checkoutPayload(
                        product: $product,
                        location: $location,
                        preferredBatch:
                            $earlierBatch,
                        quantity: 1,
                        unitPrice: 1500,
                        idempotencyKey:
                            "canonical-{$suffix}",
                        paymentReference:
                            strtoupper($suffix)
                    );

                $payload['pos_session_id'] =
                    $terminal->id;

                $payload['terminal_identifier'] =
                    $terminal
                        ->terminal_identifier;

                $this->assertSame(
                    201,
                    $this->checkout(
                        $tenant,
                        $user,
                        $payload
                    )->getStatusCode()
                );
            }

            $policy = app(
                PosSessionPolicyService::class
            );

            $this->assertEqualsWithDelta(
                1500,
                $policy->expectedCash(
                    $terminalA->fresh()
                ),
                0.0001
            );

            $this->assertEqualsWithDelta(
                1500,
                $policy->expectedCash(
                    $terminalB->fresh()
                ),
                0.0001
            );
        } finally {
            Carbon::setTestNow();
        }
    }

    private function createLiveSession(
        Tenant $tenant,
        User $user,
        int $branchId,
        string $terminalIdentifier =
            'canonical-checkout-terminal'
    ): PharmacoPosSession {
        $businessDate = now(
            'Africa/Kigali'
        )->toDateString();

        $existing =
            PharmacoPosSession::query()
                ->where(
                    'tenant_id',
                    $tenant->id
                )
                ->where(
                    'branch_id',
                    $branchId
                )
                ->where(
                    'user_id',
                    $user->id
                )
                ->whereDate(
                    'business_date',
                    $businessDate
                )
                ->where(
                    'session_mode',
                    'live'
                )
                ->where(
                    'terminal_identifier',
                    $terminalIdentifier
                )
                ->where(
                    'status',
                    'open'
                )
                ->latest('id')
                ->first();

        if ($existing) {
            return $existing;
        }

        $sequence =
            (int)
            PharmacoPosSession::query()
                ->where(
                    'tenant_id',
                    $tenant->id
                )
                ->where(
                    'user_id',
                    $user->id
                )
                ->whereDate(
                    'business_date',
                    $businessDate
                )
                ->max('sequence_number')
            + 1;

        return PharmacoPosSession::query()
            ->create([
                'uuid' =>
                    (string) Str::uuid(),
                'tenant_id' =>
                    $tenant->id,
                'branch_id' =>
                    $branchId,
                'user_id' =>
                    $user->id,
                'business_date' =>
                    $businessDate,
                'session_mode' =>
                    'live',
                'terminal_identifier' =>
                    $terminalIdentifier,
                'terminal_label' =>
                    'Canonical Checkout Test',
                'sequence_number' =>
                    $sequence,
                'session_number' =>
                    'POS-TEST-'
                    . $user->id
                    . '-'
                    . $sequence,
                'status' =>
                    'open',
                'opening_float_amount' =>
                    0,
                'expected_cash_amount' =>
                    0,
                'opened_at' =>
                    now(),
                'metadata' => [
                    'test' =>
                        'canonical_live_session',
                ],
            ]);
    }

    private function checkoutPayload(
        Product $product,
        StockLocation $location,
        StockBatch $preferredBatch,
        float $quantity,
        float $unitPrice,
        string $idempotencyKey,
        string $paymentReference
    ): array {
        return [
            'idempotency_key' => $idempotencyKey,
            'branch_id' => $location->branch_id,
            'sale_type' => 'cash_sale',
            'items' => [
                [
                    'product_id' => $product->id,
                    'quantity' => $quantity,
                    'unit_price' => $unitPrice,
                    'pricing_policy' =>
                        'highest_affected_batch_price',
                    'discount_amount' => 0,
                    'tax_amount' => 0,
                    'stock_batch_id' =>
                        $preferredBatch->id,
                    'prescription_verified' => false,
                ],
            ],
            'payment' => [
                'payment_method' => 'cash',
                'generate_receipt' => false,
                'reference_number' =>
                    $paymentReference,
            ],
        ];
    }

    /**
     * @return array{
     *     Tenant,
     *     User,
     *     StockLocation,
     *     Product,
     *     StockBatch,
     *     StockBatch
     * }
     */
    private function createContext(
        string $suffix,
        float $sellingPrice
    ): array {
        $this->seed();

        $tenant = Tenant::query()
            ->where('slug', 'vitapharma')
            ->firstOrFail();

        $user = User::query()
            ->where(
                'email',
                'admin@vitapharmaafrica.com'
            )
            ->firstOrFail();

        $category = ProductCategory::query()
            ->where(
                'tenant_id',
                $tenant->id
            )
            ->firstOrFail();

        $location = StockLocation::query()
            ->where(
                'tenant_id',
                $tenant->id
            )
            ->where(
                'status',
                'active'
            )
            ->firstOrFail();

        $product = Product::query()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $tenant->id,
            'product_category_id' =>
                $category->id,
            'name' =>
                "WPA Canonical FEFO {$suffix}",
            'generic_name' =>
                'Canonical multi-batch test product',
            'sku' =>
                "WPA-FEFO-{$suffix}",
            'unit' => 'unit',
            'selling_unit' => 'unit',
            'base_unit' => 'unit',
            'quantity_per_selling_unit' => 1,
            'allow_other_quantity' => true,
            'default_pos_quantity_mode' =>
                'selling_unit',
            'product_type' => 'medicine',
            'regulatory_status' => 'approved',
            'requires_prescription' => false,
            'is_controlled' => false,
            'reorder_level' => 0,
            'minimum_stock_level' => 0,
            'status' => 'active',
        ]);

        $earlierBatch = $this->createBatch(
            $tenant,
            $location,
            $product,
            "WPA-{$suffix}-EARLIER",
            '2026-08-04',
            10,
            $sellingPrice
        );

        $laterBatch = $this->createBatch(
            $tenant,
            $location,
            $product,
            "WPA-{$suffix}-LATER",
            '2026-08-20',
            6,
            $sellingPrice
        );

        return [
            $tenant,
            $user,
            $location,
            $product,
            $earlierBatch,
            $laterBatch,
        ];
    }

    private function createBatch(
        Tenant $tenant,
        StockLocation $location,
        Product $product,
        string $batchNumber,
        string $expiryDate,
        float $quantity,
        float $sellingPrice
    ): StockBatch {
        return StockBatch::query()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $tenant->id,
            'branch_id' =>
                $location->branch_id,
            'stock_location_id' =>
                $location->id,
            'product_id' => $product->id,
            'batch_number' => $batchNumber,
            'expiry_date' => $expiryDate,
            'received_at' =>
                '2026-08-01 09:00:00',
            'quantity_on_hand' => $quantity,
            'quantity_reserved' => 0,
            'unit_cost' => 700.25,
            'selling_price' => $sellingPrice,
            'status' => 'active',
        ]);
    }

    private function checkout(
        Tenant $tenant,
        User $user,
        array $payload
    ): JsonResponse {
        if (
            ! isset($payload['pos_session_id'])
            || ! isset(
                $payload['terminal_identifier']
            )
        ) {
            $session = $this->createLiveSession(
                tenant: $tenant,
                user: $user,
                branchId:
                    (int) $payload['branch_id']
            );

            $payload['pos_session_id'] =
                $session->id;

            $payload['terminal_identifier'] =
                $session->terminal_identifier;
        }

        $request = Request::create(
            '/api/v1/pharmaco/sales/checkout',
            'POST',
            $payload
        );

        $request->headers->set(
            'Accept',
            'application/json'
        );

        $request->attributes->set(
            'tenant',
            $tenant
        );

        $request->setUserResolver(
            static fn (): User => $user
        );

        return app(
            SalesDispensingController::class
        )->checkoutSale(
            $request,
            app(AuditLogService::class),
            app(ScopeResolver::class),
            app(AtomicPosCheckoutService::class),
            app(PosMultiBatchCheckoutAllocator::class)
        );
    }
}
