<?php

namespace Tests\Feature\PharmaCo360;

use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\StockBatch;
use App\Models\StockLocation;
use App\Models\Tenant;
use App\Services\PharmaCo360\PosMultiBatchCheckoutAllocator;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

final class PosMultiBatchCheckoutAllocatorDatabaseTest
    extends TestCase
{
    use RefreshDatabase;

    public function test_locked_allocator_uses_business_date_and_active_product_policy(): void
    {
        $this->seed();

        config([
            'pharmaco.business_timezone' =>
                'Africa/Kigali',
        ]);

        Carbon::setTestNow(
            Carbon::parse(
                '2026-08-04 22:30:00',
                'UTC'
            )
        );

        try {
            [
                $tenant,
                $location,
                $category,
            ] = $this->inventoryContext();

            $product = $this->createProduct(
                $tenant,
                $category,
                'WPA-FEFO-ACTIVE',
                'active'
            );

            $sameDay = $this->createBatch(
                $tenant,
                $location,
                $product,
                'WPA-FEFO-SAME-DAY',
                '2026-08-05',
                10
            );

            $later = $this->createBatch(
                $tenant,
                $location,
                $product,
                'WPA-FEFO-LATER',
                '2026-08-06',
                6
            );

            $expired = $this->createBatch(
                $tenant,
                $location,
                $product,
                'WPA-FEFO-EXPIRED',
                '2026-08-04',
                40
            );

            $allocations = DB::transaction(
                fn (): array =>
                    app(
                        PosMultiBatchCheckoutAllocator::class
                    )->expandAndLock(
                        tenantId: (int) $tenant->id,
                        branchId:
                            (int) $location->branch_id,
                        items: [
                            [
                                'product_id' =>
                                    $product->id,
                                'quantity' => 15,
                                'unit_price' => 1500,
                                'stock_batch_id' =>
                                    $sameDay->id,
                                'discount_amount' => 0,
                                'tax_amount' => 0,
                            ],
                        ]
                    )
            );

            $this->assertCount(
                2,
                $allocations
            );

            $this->assertSame(
                [
                    $sameDay->id,
                    $later->id,
                ],
                array_column(
                    $allocations,
                    'stock_batch_id'
                )
            );

            $this->assertSame(
                [
                    10.0,
                    5.0,
                ],
                array_column(
                    $allocations,
                    'quantity'
                )
            );

            $this->assertNotContains(
                $expired->id,
                array_column(
                    $allocations,
                    'stock_batch_id'
                )
            );
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_locked_allocator_rejects_inactive_product_inventory(): void
    {
        $this->seed();

        config([
            'pharmaco.business_timezone' =>
                'Africa/Kigali',
        ]);

        Carbon::setTestNow(
            Carbon::parse(
                '2026-08-04 10:00:00',
                'Africa/Kigali'
            )
        );

        try {
            [
                $tenant,
                $location,
                $category,
            ] = $this->inventoryContext();

            $product = $this->createProduct(
                $tenant,
                $category,
                'WPA-FEFO-INACTIVE',
                'inactive'
            );

            $batch = $this->createBatch(
                $tenant,
                $location,
                $product,
                'WPA-FEFO-INACTIVE-BATCH',
                '2026-08-10',
                20
            );

            $this->expectException(
                ValidationException::class
            );

            DB::transaction(
                fn (): array =>
                    app(
                        PosMultiBatchCheckoutAllocator::class
                    )->expandAndLock(
                        tenantId: (int) $tenant->id,
                        branchId:
                            (int) $location->branch_id,
                        items: [
                            [
                                'product_id' =>
                                    $product->id,
                                'quantity' => 1,
                                'unit_price' => 1500,
                                'stock_batch_id' =>
                                    $batch->id,
                                'discount_amount' => 0,
                                'tax_amount' => 0,
                            ],
                        ]
                    )
            );
        } finally {
            Carbon::setTestNow();
        }
    }

    /**
     * @return array{
     *     0:Tenant,
     *     1:StockLocation,
     *     2:ProductCategory
     * }
     */
    private function inventoryContext(): array
    {
        $tenant = Tenant::query()
            ->where('slug', 'vitapharma')
            ->firstOrFail();

        $location = StockLocation::query()
            ->where('tenant_id', $tenant->id)
            ->where('status', 'active')
            ->firstOrFail();

        $category = ProductCategory::query()
            ->where('tenant_id', $tenant->id)
            ->firstOrFail();

        return [
            $tenant,
            $location,
            $category,
        ];
    }

    private function createProduct(
        Tenant $tenant,
        ProductCategory $category,
        string $sku,
        string $status
    ): Product {
        return Product::query()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $tenant->id,
            'product_category_id' =>
                $category->id,
            'name' => $sku,
            'generic_name' =>
                'WPA FEFO eligibility product',
            'sku' => $sku,
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
            'status' => $status,
        ]);
    }

    private function createBatch(
        Tenant $tenant,
        StockLocation $location,
        Product $product,
        string $batchNumber,
        ?string $expiryDate,
        float $quantity
    ): StockBatch {
        return StockBatch::query()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $tenant->id,
            'branch_id' => $location->branch_id,
            'stock_location_id' => $location->id,
            'product_id' => $product->id,
            'batch_number' => $batchNumber,
            'expiry_date' => $expiryDate,
            'received_at' => '2026-08-01',
            'quantity_on_hand' => $quantity,
            'quantity_reserved' => 0,
            'unit_cost' => 1000,
            'selling_price' => 1500,
            'status' => 'active',
        ]);
    }
}
