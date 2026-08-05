<?php

namespace Tests\Feature\PharmaCo360;

use App\Http\Controllers\Api\V1\PharmaCo360\ProductInventoryController;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\StockBatch;
use App\Models\StockLocation;
use App\Models\Tenant;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Tests\TestCase;

final class PosSellableInventoryHydrationControllerTest extends TestCase
{
    use RefreshDatabase;

    public function test_sellable_inventory_uses_business_date_and_active_product_policy(): void
    {
        $this->seed();

        Carbon::setTestNow(
            Carbon::parse('2026-08-04 10:00:00')
        );

        try {
            $tenant = Tenant::query()
                ->where('slug', 'vitapharma')
                ->firstOrFail();

            $category = ProductCategory::query()
                ->where('tenant_id', $tenant->id)
                ->firstOrFail();

            $location = StockLocation::query()
                ->where('tenant_id', $tenant->id)
                ->where('status', 'active')
                ->firstOrFail();

            $sameDay = $this->createProduct(
                $tenant,
                $category,
                'WPA-SAME-DAY',
                'active'
            );

            $expired = $this->createProduct(
                $tenant,
                $category,
                'WPA-EXPIRED',
                'active'
            );

            $undated = $this->createProduct(
                $tenant,
                $category,
                'WPA-UNDATED',
                'active'
            );

            $inactive = $this->createProduct(
                $tenant,
                $category,
                'WPA-INACTIVE',
                'inactive'
            );

            $this->createBatch(
                $tenant,
                $location,
                $sameDay,
                'WPA-SAME-DAY-BATCH',
                '2026-08-04'
            );

            $this->createBatch(
                $tenant,
                $location,
                $expired,
                'WPA-EXPIRED-BATCH',
                '2026-08-03'
            );

            $this->createBatch(
                $tenant,
                $location,
                $undated,
                'WPA-UNDATED-BATCH',
                null
            );

            $this->createBatch(
                $tenant,
                $location,
                $inactive,
                'WPA-INACTIVE-PRODUCT-BATCH',
                '2026-08-10'
            );

            $request = Request::create(
                '/api/v1/pharmaco/'
                . 'inventory/batches'
                . '?sellable_only=1',
                'GET'
            );

            $request->attributes->set(
                'tenant',
                $tenant
            );

            $response = app(
                ProductInventoryController::class
            )->batches($request);

            $this->assertSame(
                200,
                $response->getStatusCode()
            );

            $batchNumbers = collect(
                $response->getData(true)['batches']
                ?? []
            )
                ->pluck('batch_number')
                ->all();

            $this->assertContains(
                'WPA-SAME-DAY-BATCH',
                $batchNumbers
            );

            $this->assertContains(
                'WPA-UNDATED-BATCH',
                $batchNumbers
            );

            $this->assertNotContains(
                'WPA-EXPIRED-BATCH',
                $batchNumbers
            );

            $this->assertNotContains(
                'WPA-INACTIVE-PRODUCT-BATCH',
                $batchNumbers
            );
        } finally {
            Carbon::setTestNow();
        }
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
                'WPA hydration product',
            'sku' => $sku,
            'unit' => 'unit',
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
        ?string $expiryDate
    ): void {
        StockBatch::query()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $tenant->id,
            'branch_id' => $location->branch_id,
            'stock_location_id' => $location->id,
            'product_id' => $product->id,
            'batch_number' => $batchNumber,
            'expiry_date' => $expiryDate,
            'received_at' => '2026-08-01',
            'quantity_on_hand' => 10,
            'quantity_reserved' => 0,
            'unit_cost' => 1000,
            'selling_price' => 1500,
            'status' => 'active',
        ]);
    }
}
