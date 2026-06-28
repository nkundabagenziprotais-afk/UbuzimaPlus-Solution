<?php

namespace Tests\Feature\PharmaCo360;

use App\Models\Module;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\Solution;
use App\Models\StockBatch;
use App\Models\StockLocation;
use App\Models\Tenant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class PharmacoProductInventoryApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_tenant_admin_can_list_products_with_stock_summary(): void
    {
        $this->seed();

        $token = $this->loginAs('admin@vitapharmaafrica.com');

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->getJson('/api/v1/pharmaco/products')
            ->assertOk()
            ->assertJsonPath('tenant.slug', 'vitapharma')
            ->assertJsonFragment(['sku' => 'AMOX-500-CAP'])
            ->assertJsonFragment(['sku' => 'PARA-500-TAB'])
            ->assertJsonPath('products.0.stock_summary.is_below_reorder_level', false);
    }

    public function test_products_endpoint_can_filter_by_category_code(): void
    {
        $this->seed();

        $token = $this->loginAs('admin@vitapharmaafrica.com');

        $response = $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->getJson('/api/v1/pharmaco/products?category_code=DIABETES')
            ->assertOk();

        $this->assertCount(1, $response->json('products'));
        $this->assertSame('MET-500-TAB', $response->json('products.0.sku'));
    }

    public function test_tenant_admin_can_view_product_with_batches(): void
    {
        $this->seed();

        $product = Product::where('sku', 'PARA-500-TAB')->firstOrFail();
        $token = $this->loginAs('admin@vitapharmaafrica.com');

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->getJson("/api/v1/pharmaco/products/{$product->id}")
            ->assertOk()
            ->assertJsonPath('tenant.slug', 'vitapharma')
            ->assertJsonPath('product.sku', 'PARA-500-TAB')
            ->assertJsonPath('stock_batches.0.batch_number', 'PARA-B001')
            ->assertJsonPath('stock_batches.0.stock_location.code', 'HQ-DISPENSARY');
    }

    public function test_tenant_admin_can_list_inventory_locations_and_batches(): void
    {
        $this->seed();

        $token = $this->loginAs('admin@vitapharmaafrica.com');

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->getJson('/api/v1/pharmaco/inventory/locations')
            ->assertOk()
            ->assertJsonPath('tenant.slug', 'vitapharma')
            ->assertJsonFragment(['code' => 'HQ-STORE'])
            ->assertJsonFragment(['code' => 'HQ-DISPENSARY']);

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->getJson('/api/v1/pharmaco/inventory/batches')
            ->assertOk()
            ->assertJsonPath('tenant.slug', 'vitapharma')
            ->assertJsonFragment(['batch_number' => 'AMOX-B001'])
            ->assertJsonFragment(['batch_number' => 'GLU-B001']);
    }

    public function test_tenant_admin_can_view_inventory_summary(): void
    {
        $this->seed();

        $token = $this->loginAs('admin@vitapharmaafrica.com');

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->getJson('/api/v1/pharmaco/inventory/summary')
            ->assertOk()
            ->assertJsonPath('tenant.slug', 'vitapharma')
            ->assertJsonPath('summary.product_categories_count', 5)
            ->assertJsonPath('summary.products_count', 5)
            ->assertJsonPath('summary.stock_locations_count', 2)
            ->assertJsonPath('summary.stock_batches_count', 5);
    }

    public function test_product_inventory_endpoints_require_tenant_header(): void
    {
        $this->seed();

        $token = $this->loginAs('admin@vitapharmaafrica.com');

        $this->withToken($token)
            ->getJson('/api/v1/pharmaco/products')
            ->assertStatus(422)
            ->assertJsonPath('required_header', 'X-Tenant-Slug');
    }

    public function test_tenant_admin_cannot_view_product_outside_tenant(): void
    {
        $this->seed();

        $otherProduct = $this->createOtherTenantProduct();
        $token = $this->loginAs('admin@vitapharmaafrica.com');

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->getJson("/api/v1/pharmaco/products/{$otherProduct->id}")
            ->assertNotFound();
    }

    public function test_tenant_admin_cannot_use_other_tenant_inventory_context(): void
    {
        $this->seed();

        $this->createOtherTenantProduct();
        $token = $this->loginAs('admin@vitapharmaafrica.com');

        $this->withHeader('X-Tenant-Slug', 'other-pharmacy')
            ->withToken($token)
            ->getJson('/api/v1/pharmaco/products')
            ->assertForbidden()
            ->assertJsonPath('message', 'Tenant boundary violation.');
    }

    private function loginAs(string $email): string
    {
        $response = $this->postJson('/api/v1/auth/login', [
            'email' => $email,
            'password' => 'ChangeThisPassword123!',
            'device_name' => 'PharmaCo360 Product Inventory API Test Client',
        ]);

        $response->assertOk();

        return $response->json('access_token');
    }

    private function createOtherTenantProduct(): Product
    {
        $solution = Solution::where('code', 'pharmaco360')->firstOrFail();

        $tenant = Tenant::query()->create([
            'uuid' => (string) Str::uuid(),
            'solution_id' => $solution->id,
            'primary_solution_id' => $solution->id,
            'name' => 'Other Pharmacy',
            'legal_name' => 'Other Pharmacy Ltd',
            'slug' => 'other-pharmacy',
            'tenant_type' => 'pharmacy',
            'status' => 'active',
        ]);

        $module = Module::where('code', 'pharmaco.inventory')->firstOrFail();

        DB::table('tenant_module_activations')->insert([
            'tenant_id' => $tenant->id,
            'solution_id' => $solution->id,
            'module_id' => $module->id,
            'status' => 'active',
            'configuration' => json_encode(['phase' => 'test']),
            'activated_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $category = ProductCategory::query()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $tenant->id,
            'name' => 'Other Category',
            'code' => 'OTHER-CATEGORY',
            'category_type' => 'medicine',
            'status' => 'active',
        ]);

        $location = StockLocation::query()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $tenant->id,
            'branch_id' => DB::table('branches')->insertGetId([
                'tenant_id' => $tenant->id,
                'name' => 'Other Pharmacy HQ',
                'code' => 'OTHER-HQ',
                'branch_type' => 'pharmacy',
                'status' => 'active',
                'created_at' => now(),
                'updated_at' => now(),
            ]),
            'name' => 'Other Store',
            'code' => 'OTHER-STORE',
            'location_type' => 'store',
            'status' => 'active',
        ]);

        $product = Product::query()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $tenant->id,
            'product_category_id' => $category->id,
            'name' => 'Other Product',
            'sku' => 'OTHER-PRODUCT',
            'unit' => 'unit',
            'product_type' => 'medicine',
            'regulatory_status' => 'approved',
            'requires_prescription' => false,
            'is_controlled' => false,
            'reorder_level' => 10,
            'minimum_stock_level' => 5,
            'status' => 'active',
        ]);

        StockBatch::query()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $tenant->id,
            'branch_id' => $location->branch_id,
            'stock_location_id' => $location->id,
            'product_id' => $product->id,
            'batch_number' => 'OTHER-B001',
            'quantity_on_hand' => 20,
            'quantity_reserved' => 0,
            'status' => 'active',
        ]);

        return $product;
    }
}
