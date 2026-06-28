<?php

namespace Tests\Feature\PharmaCo360;

use App\Models\Module;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\Solution;
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
