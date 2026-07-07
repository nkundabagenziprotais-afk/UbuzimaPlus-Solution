<?php

namespace Tests\Feature\PharmaCo360;

use App\Models\Branch;
use App\Models\Module;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\Solution;
use App\Models\StockLocation;
use App\Models\Tenant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class PharmacoProductInventoryMutationApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_tenant_admin_can_create_product_and_audit_is_recorded(): void
    {
        $this->seed();

        $tenant = Tenant::where('slug', 'vitapharma')->firstOrFail();
        $category = ProductCategory::where('tenant_id', $tenant->id)->where('code', 'CONSUMABLES')->firstOrFail();
        $token = $this->loginAs('admin@vitapharmaafrica.com');

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->postJson('/api/v1/pharmaco/products', [
                'product_category_id' => $category->id,
                'name' => 'Digital Thermometer',
                'generic_name' => 'Thermometer',
                'sku' => 'THERMO-DIGITAL',
                'unit' => 'piece',
                'pack_size' => '1 piece',
                'product_type' => 'device',
                'regulatory_status' => 'approved',
                'requires_prescription' => false,
                'is_controlled' => false,
                'reorder_level' => 10,
                'minimum_stock_level' => 5,
            ])
            ->assertCreated()
            ->assertJsonPath('message', 'Product created successfully.')
            ->assertJsonPath('product.sku', 'THERMO-DIGITAL')
            ->assertJsonPath('product.category.code', 'CONSUMABLES');

        $this->assertDatabaseHas('products', [
            'tenant_id' => $tenant->id,
            'sku' => 'THERMO-DIGITAL',
            'name' => 'Digital Thermometer',
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'tenant_id' => $tenant->id,
            'action' => 'pharmaco.product.created',
            'auditable_type' => Product::class,
        ]);
    }

    public function test_product_selling_unit_configuration_can_be_stored_and_read(): void
    {
        $this->seed();

        $tenant = Tenant::where('slug', 'vitapharma')->firstOrFail();
        $category = ProductCategory::where('tenant_id', $tenant->id)
            ->where('code', 'CONSUMABLES')
            ->firstOrFail();
        $token = $this->loginAs('admin@vitapharmaafrica.com');

        $response = $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->postJson('/api/v1/pharmaco/products', [
                'product_category_id' => $category->id,
                'name' => 'Paediatric Syrup 100ml',
                'generic_name' => 'Paediatric Syrup',
                'sku' => 'PAED-SYRUP-100ML',
                'unit' => 'bottle',
                'selling_unit' => 'bottle',
                'base_unit' => 'ml',
                'quantity_per_selling_unit' => 100,
                'allow_other_quantity' => true,
                'default_pos_quantity_mode' => 'selling_unit',
                'selling_unit_notes' => 'One bottle contains 100 ml.',
                'pack_size' => '100 ml bottle',
                'product_type' => 'medicine',
                'regulatory_status' => 'approved',
            ]);

        $response
            ->assertCreated()
            ->assertJsonPath('product.selling_unit', 'bottle')
            ->assertJsonPath('product.base_unit', 'ml')
            ->assertJsonPath('product.quantity_per_selling_unit', 100)
            ->assertJsonPath('product.allow_other_quantity', true)
            ->assertJsonPath('product.default_pos_quantity_mode', 'selling_unit')
            ->assertJsonPath('product.ai_suggestion_status', 'not_requested');

        $productId = $response->json('product.id');
        $product = Product::findOrFail($productId);

        $this->assertSame('bottle', $product->selling_unit);
        $this->assertSame('ml', $product->base_unit);
        $this->assertSame(100.0, (float) $product->quantity_per_selling_unit);
        $this->assertTrue($product->allow_other_quantity);

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->getJson("/api/v1/pharmaco/products/{$productId}")
            ->assertOk()
            ->assertJsonPath('product.selling_unit', 'bottle')
            ->assertJsonPath('product.base_unit', 'ml')
            ->assertJsonPath('product.quantity_per_selling_unit', 100);
    }

    public function test_tenant_admin_can_update_product_and_audit_is_recorded(): void
    {
        $this->seed();

        $tenant = Tenant::where('slug', 'vitapharma')->firstOrFail();
        $product = Product::where('tenant_id', $tenant->id)->where('sku', 'AMOX-500-CAP')->firstOrFail();
        $token = $this->loginAs('admin@vitapharmaafrica.com');

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->patchJson("/api/v1/pharmaco/products/{$product->id}", [
                'name' => 'Amoxicillin 500mg Capsules Updated',
                'reorder_level' => 150,
                'status' => 'active',
            ])
            ->assertOk()
            ->assertJsonPath('message', 'Product updated successfully.')
            ->assertJsonPath('product.name', 'Amoxicillin 500mg Capsules Updated')
            ->assertJsonPath('product.reorder_level', 150);

        $this->assertDatabaseHas('products', [
            'id' => $product->id,
            'name' => 'Amoxicillin 500mg Capsules Updated',
            'reorder_level' => 150,
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'tenant_id' => $tenant->id,
            'action' => 'pharmaco.product.updated',
            'auditable_type' => Product::class,
            'auditable_id' => $product->id,
        ]);
    }

    public function test_duplicate_sku_is_rejected_within_same_tenant(): void
    {
        $this->seed();

        $tenant = Tenant::where('slug', 'vitapharma')->firstOrFail();
        $category = ProductCategory::where('tenant_id', $tenant->id)->firstOrFail();
        $token = $this->loginAs('admin@vitapharmaafrica.com');

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->postJson('/api/v1/pharmaco/products', [
                'product_category_id' => $category->id,
                'name' => 'Duplicate Paracetamol',
                'sku' => 'PARA-500-TAB',
                'unit' => 'tablet',
                'product_type' => 'medicine',
                'regulatory_status' => 'approved',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('sku');
    }

    public function test_product_category_must_belong_to_current_tenant(): void
    {
        $this->seed();

        $otherCategory = $this->createOtherTenantCategory();
        $token = $this->loginAs('admin@vitapharmaafrica.com');

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->postJson('/api/v1/pharmaco/products', [
                'product_category_id' => $otherCategory->id,
                'name' => 'Invalid Category Product',
                'sku' => 'INVALID-CATEGORY-PRODUCT',
                'unit' => 'unit',
                'product_type' => 'medicine',
                'regulatory_status' => 'approved',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('product_category_id');
    }

    public function test_tenant_admin_cannot_update_product_outside_tenant(): void
    {
        $this->seed();

        $otherCategory = $this->createOtherTenantCategory();
        $otherProduct = Product::query()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $otherCategory->tenant_id,
            'product_category_id' => $otherCategory->id,
            'name' => 'Other Tenant Product',
            'sku' => 'OTHER-TENANT-PRODUCT',
            'unit' => 'unit',
            'product_type' => 'medicine',
            'regulatory_status' => 'approved',
            'requires_prescription' => false,
            'is_controlled' => false,
            'reorder_level' => 10,
            'minimum_stock_level' => 5,
            'status' => 'active',
        ]);

        $token = $this->loginAs('admin@vitapharmaafrica.com');

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->patchJson("/api/v1/pharmaco/products/{$otherProduct->id}", [
                'name' => 'Should Not Update',
            ])
            ->assertNotFound();
    }

    public function test_product_mutations_require_tenant_header(): void
    {
        $this->seed();

        $token = $this->loginAs('admin@vitapharmaafrica.com');

        $this->withToken($token)
            ->postJson('/api/v1/pharmaco/products', [
                'name' => 'Missing Tenant Header Product',
                'sku' => 'MISSING-TENANT-HEADER',
                'unit' => 'unit',
                'product_type' => 'medicine',
                'regulatory_status' => 'approved',
            ])
            ->assertStatus(422)
            ->assertJsonPath('required_header', 'X-Tenant-Slug');
    }

    public function test_tenant_admin_can_create_product_category_and_audit_is_recorded(): void
    {
        $this->seed();

        $tenant = Tenant::where('slug', 'vitapharma')->firstOrFail();
        $token = $this->loginAs('admin@vitapharmaafrica.com');

        $response = $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->postJson('/api/v1/pharmaco/product-categories', [
                'name' => 'Inventory Setup Category',
                'code' => 'inventory-setup-category',
                'category_type' => 'medicine',
                'status' => 'active',
                'description' => 'Created from the inventory setup API test.',
            ]);

        $response
            ->assertCreated()
            ->assertJsonPath('tenant.slug', 'vitapharma')
            ->assertJsonPath('category.name', 'Inventory Setup Category')
            ->assertJsonPath('category.code', 'INVENTORY-SETUP-CATEGORY')
            ->assertJsonPath('category.products_count', 0);

        $categoryId = $response->json('category.id');

        $this->assertDatabaseHas('product_categories', [
            'id' => $categoryId,
            'tenant_id' => $tenant->id,
            'name' => 'Inventory Setup Category',
            'code' => 'INVENTORY-SETUP-CATEGORY',
            'category_type' => 'medicine',
            'status' => 'active',
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'tenant_id' => $tenant->id,
            'action' => 'pharmaco.product_category.created',
            'auditable_type' => ProductCategory::class,
            'auditable_id' => $categoryId,
        ]);
    }

    public function test_tenant_admin_can_update_product_category_and_audit_is_recorded(): void
    {
        $this->seed();

        $tenant = Tenant::where('slug', 'vitapharma')->firstOrFail();
        $category = ProductCategory::where('tenant_id', $tenant->id)->where('code', 'CONSUMABLES')->firstOrFail();
        $token = $this->loginAs('admin@vitapharmaafrica.com');

        $response = $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->patchJson("/api/v1/pharmaco/product-categories/{$category->id}", [
                'name' => 'Updated Inventory Setup Category',
                'code' => 'updated-inventory-setup-category',
                'status' => 'active',
                'description' => 'Updated from the inventory setup API test.',
            ]);

        $response
            ->assertOk()
            ->assertJsonPath('tenant.slug', 'vitapharma')
            ->assertJsonPath('category.name', 'Updated Inventory Setup Category')
            ->assertJsonPath('category.code', 'UPDATED-INVENTORY-SETUP-CATEGORY');

        $this->assertDatabaseHas('product_categories', [
            'id' => $category->id,
            'tenant_id' => $tenant->id,
            'name' => 'Updated Inventory Setup Category',
            'code' => 'UPDATED-INVENTORY-SETUP-CATEGORY',
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'tenant_id' => $tenant->id,
            'action' => 'pharmaco.product_category.updated',
            'auditable_type' => ProductCategory::class,
            'auditable_id' => $category->id,
        ]);
    }

    public function test_tenant_admin_can_create_stock_location_and_audit_is_recorded(): void
    {
        $this->seed();

        $tenant = Tenant::where('slug', 'vitapharma')->firstOrFail();
        $branch = Branch::where('tenant_id', $tenant->id)->firstOrFail();
        $token = $this->loginAs('admin@vitapharmaafrica.com');

        $response = $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->postJson('/api/v1/pharmaco/inventory/locations', [
                'branch_id' => $branch->id,
                'name' => 'Inventory Setup Reserve Store',
                'code' => 'inventory-setup-reserve',
                'location_type' => 'reserve_store',
                'status' => 'active',
            ]);

        $response
            ->assertCreated()
            ->assertJsonPath('tenant.slug', 'vitapharma')
            ->assertJsonPath('location.name', 'Inventory Setup Reserve Store')
            ->assertJsonPath('location.code', 'INVENTORY-SETUP-RESERVE')
            ->assertJsonPath('location.branch_id', $branch->id);

        $locationId = $response->json('location.id');

        $this->assertDatabaseHas('stock_locations', [
            'id' => $locationId,
            'tenant_id' => $tenant->id,
            'branch_id' => $branch->id,
            'code' => 'INVENTORY-SETUP-RESERVE',
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'tenant_id' => $tenant->id,
            'action' => 'pharmaco.stock_location.created',
            'auditable_type' => StockLocation::class,
            'auditable_id' => $locationId,
        ]);
    }

    public function test_tenant_admin_can_update_stock_location_and_audit_is_recorded(): void
    {
        $this->seed();

        $tenant = Tenant::where('slug', 'vitapharma')->firstOrFail();
        $location = StockLocation::where('tenant_id', $tenant->id)->where('code', 'HQ-STORE')->firstOrFail();
        $token = $this->loginAs('admin@vitapharmaafrica.com');

        $response = $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->patchJson("/api/v1/pharmaco/inventory/locations/{$location->id}", [
                'name' => 'Updated HQ Inventory Store',
                'code' => 'updated-hq-inventory-store',
                'location_type' => 'main_store',
                'status' => 'active',
            ]);

        $response
            ->assertOk()
            ->assertJsonPath('tenant.slug', 'vitapharma')
            ->assertJsonPath('location.name', 'Updated HQ Inventory Store')
            ->assertJsonPath('location.code', 'UPDATED-HQ-INVENTORY-STORE');

        $this->assertDatabaseHas('stock_locations', [
            'id' => $location->id,
            'tenant_id' => $tenant->id,
            'name' => 'Updated HQ Inventory Store',
            'code' => 'UPDATED-HQ-INVENTORY-STORE',
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'tenant_id' => $tenant->id,
            'action' => 'pharmaco.stock_location.updated',
            'auditable_type' => StockLocation::class,
            'auditable_id' => $location->id,
        ]);
    }

    private function loginAs(string $email): string
    {
        $response = $this->postJson('/api/v1/auth/login', [
            'email' => $email,
            'password' => 'ChangeThisPassword123!',
            'device_name' => 'PharmaCo360 Product Mutation API Test Client',
        ]);

        $response->assertOk();

        return $response->json('access_token');
    }

    private function createOtherTenantCategory(): ProductCategory
    {
        $solution = Solution::where('code', 'pharmaco360')->firstOrFail();

        $tenant = Tenant::query()->create([
            'uuid' => (string) Str::uuid(),
            'solution_id' => $solution->id,
            'primary_solution_id' => $solution->id,
            'name' => 'Other Pharmacy',
            'legal_name' => 'Other Pharmacy Ltd',
            'slug' => 'other-pharmacy-' . Str::lower(Str::random(6)),
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

        return ProductCategory::query()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $tenant->id,
            'name' => 'Other Tenant Category',
            'code' => 'OTHER-TENANT-CATEGORY-' . Str::upper(Str::random(4)),
            'category_type' => 'medicine',
            'status' => 'active',
        ]);
    }
}
