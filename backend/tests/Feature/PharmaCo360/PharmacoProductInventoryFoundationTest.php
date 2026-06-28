<?php

namespace Tests\Feature\PharmaCo360;

use App\Models\Branch;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\StockBatch;
use App\Models\StockLocation;
use App\Models\StockMovement;
use App\Models\Tenant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PharmacoProductInventoryFoundationTest extends TestCase
{
    use RefreshDatabase;

    public function test_vitapharma_product_categories_and_products_are_seeded(): void
    {
        $this->seed();

        $tenant = Tenant::where('slug', 'vitapharma')->firstOrFail();

        $this->assertDatabaseHas('product_categories', [
            'tenant_id' => $tenant->id,
            'code' => 'ANTIBIOTICS',
            'status' => 'active',
        ]);

        $this->assertDatabaseHas('products', [
            'tenant_id' => $tenant->id,
            'sku' => 'AMOX-500-CAP',
            'name' => 'Amoxicillin 500mg Capsules',
            'status' => 'active',
        ]);

        $product = Product::where('tenant_id', $tenant->id)
            ->where('sku', 'AMOX-500-CAP')
            ->firstOrFail();

        $this->assertTrue($product->requires_prescription);
        $this->assertSame('approved', $product->regulatory_status);
    }

    public function test_stock_locations_are_branch_scoped(): void
    {
        $this->seed();

        $tenant = Tenant::where('slug', 'vitapharma')->firstOrFail();
        $branch = Branch::where('tenant_id', $tenant->id)->where('code', 'HQ')->firstOrFail();

        $location = StockLocation::where('tenant_id', $tenant->id)
            ->where('code', 'HQ-STORE')
            ->firstOrFail();

        $this->assertSame($branch->id, $location->branch_id);
        $this->assertSame('main_store', $location->location_type);
        $this->assertSame('active', $location->status);
    }

    public function test_stock_batches_and_opening_movements_are_seeded(): void
    {
        $this->seed();

        $tenant = Tenant::where('slug', 'vitapharma')->firstOrFail();
        $product = Product::where('tenant_id', $tenant->id)->where('sku', 'PARA-500-TAB')->firstOrFail();

        $batch = StockBatch::where('tenant_id', $tenant->id)
            ->where('product_id', $product->id)
            ->where('batch_number', 'PARA-B001')
            ->firstOrFail();

        $this->assertGreaterThan(0, (float) $batch->quantity_on_hand);
        $this->assertNotNull($batch->expiry_date);

        $this->assertDatabaseHas('stock_movements', [
            'tenant_id' => $tenant->id,
            'product_id' => $product->id,
            'stock_batch_id' => $batch->id,
            'movement_type' => 'opening_balance',
        ]);
    }

    public function test_product_inventory_records_remain_tenant_scoped(): void
    {
        $this->seed();

        $tenant = Tenant::where('slug', 'vitapharma')->firstOrFail();

        $categoryTenantIds = ProductCategory::pluck('tenant_id')->unique()->values()->all();
        $productTenantIds = Product::pluck('tenant_id')->unique()->values()->all();
        $batchTenantIds = StockBatch::pluck('tenant_id')->unique()->values()->all();
        $movementTenantIds = StockMovement::pluck('tenant_id')->unique()->values()->all();

        $this->assertSame([$tenant->id], $categoryTenantIds);
        $this->assertSame([$tenant->id], $productTenantIds);
        $this->assertSame([$tenant->id], $batchTenantIds);
        $this->assertSame([$tenant->id], $movementTenantIds);
    }
}
