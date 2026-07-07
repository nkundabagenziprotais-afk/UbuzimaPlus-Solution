<?php

namespace Tests\Feature\PharmaCo360;

use App\Models\AuditLog;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\Tenant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class PharmacoProductSellingUnitSuggestionApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_ai_suggestion_is_generated_but_not_auto_applied(): void
    {
        $this->seed();

        [$tenant, $product] = $this->createSyrupProduct();
        $token = $this->loginAs('admin@vitapharmaafrica.com');

        $this->withHeader('X-Tenant-Slug', $tenant->slug)
            ->withToken($token)
            ->postJson(
                "/api/v1/pharmaco/products/{$product->id}/selling-unit-ai-suggestion/generate",
                [
                    'trusted_source' => 'RHIA approved product designation',
                    'trusted_reference' => 'RHIA-SYRUP-100ML',
                ]
            )
            ->assertOk()
            ->assertJsonPath(
                'message',
                'Selling-unit AI suggestion generated for human review.'
            )
            ->assertJsonPath('auto_applied', false)
            ->assertJsonPath(
                'product.ai_suggested_quantity_per_unit',
                100
            )
            ->assertJsonPath(
                'product.ai_suggestion_status',
                'pending_review'
            )
            ->assertJsonPath(
                'product.quantity_per_selling_unit',
                1
            )
            ->assertJsonPath(
                'product.ai_suggestion_source',
                'RHIA approved product designation'
            );

        $product->refresh();

        $this->assertSame(
            1.0,
            (float) $product->quantity_per_selling_unit
        );
        $this->assertSame(
            100.0,
            (float) $product->ai_suggested_quantity_per_unit
        );
        $this->assertSame(
            'pending_review',
            $product->ai_suggestion_status
        );

        $this->assertDatabaseHas('audit_logs', [
            'tenant_id' => $tenant->id,
            'action' => 'pharmaco.product.selling_unit_ai_suggested',
            'auditable_type' => Product::class,
            'auditable_id' => $product->id,
        ]);
    }

    public function test_authorized_user_can_approve_selling_unit_suggestion(): void
    {
        $this->seed();

        [$tenant, $product] = $this->createSyrupProduct();
        $token = $this->loginAs('admin@vitapharmaafrica.com');

        $this->generateSuggestion($tenant, $product, $token);

        $this->withHeader('X-Tenant-Slug', $tenant->slug)
            ->withToken($token)
            ->postJson(
                "/api/v1/pharmaco/products/{$product->id}/selling-unit-ai-suggestion/review",
                [
                    'action' => 'approve',
                    'review_notes' => 'Checked against the RHIA pack designation.',
                ]
            )
            ->assertOk()
            ->assertJsonPath(
                'message',
                'Selling-unit AI suggestion approved.'
            )
            ->assertJsonPath(
                'product.quantity_per_selling_unit',
                100
            )
            ->assertJsonPath(
                'product.ai_suggestion_status',
                'approved'
            );

        $product->refresh();

        $this->assertSame(
            100.0,
            (float) $product->quantity_per_selling_unit
        );
        $this->assertSame('approved', $product->ai_suggestion_status);
        $this->assertNotNull($product->ai_suggestion_reviewed_by);
        $this->assertNotNull($product->ai_suggestion_reviewed_at);

        $this->assertDatabaseHas('audit_logs', [
            'tenant_id' => $tenant->id,
            'action' => 'pharmaco.product.selling_unit_ai_approved',
            'auditable_type' => Product::class,
            'auditable_id' => $product->id,
        ]);
    }

    public function test_authorized_user_can_edit_value_before_approval(): void
    {
        $this->seed();

        [$tenant, $product] = $this->createSyrupProduct();
        $token = $this->loginAs('admin@vitapharmaafrica.com');

        $this->generateSuggestion($tenant, $product, $token);

        $this->withHeader('X-Tenant-Slug', $tenant->slug)
            ->withToken($token)
            ->postJson(
                "/api/v1/pharmaco/products/{$product->id}/selling-unit-ai-suggestion/review",
                [
                    'action' => 'edit_and_approve',
                    'approved_value' => 120,
                    'review_notes' => 'Physical pack and approved reference show 120 ml.',
                ]
            )
            ->assertOk()
            ->assertJsonPath(
                'message',
                'Selling-unit AI suggestion edited and approved.'
            )
            ->assertJsonPath(
                'product.ai_suggested_quantity_per_unit',
                100
            )
            ->assertJsonPath(
                'product.quantity_per_selling_unit',
                120
            )
            ->assertJsonPath(
                'product.ai_suggestion_status',
                'approved'
            );

        $product->refresh();

        $this->assertSame(
            100.0,
            (float) $product->ai_suggested_quantity_per_unit
        );
        $this->assertSame(
            120.0,
            (float) $product->quantity_per_selling_unit
        );

        $this->assertDatabaseHas('audit_logs', [
            'tenant_id' => $tenant->id,
            'action' => 'pharmaco.product.selling_unit_ai_edited_and_approved',
            'auditable_type' => Product::class,
            'auditable_id' => $product->id,
        ]);
    }

    public function test_rejecting_suggestion_does_not_change_active_conversion(): void
    {
        $this->seed();

        [$tenant, $product] = $this->createSyrupProduct();
        $token = $this->loginAs('admin@vitapharmaafrica.com');

        $this->generateSuggestion($tenant, $product, $token);

        $this->withHeader('X-Tenant-Slug', $tenant->slug)
            ->withToken($token)
            ->postJson(
                "/api/v1/pharmaco/products/{$product->id}/selling-unit-ai-suggestion/review",
                [
                    'action' => 'reject',
                    'review_notes' => 'Pack information requires clarification.',
                ]
            )
            ->assertOk()
            ->assertJsonPath(
                'message',
                'Selling-unit AI suggestion rejected.'
            )
            ->assertJsonPath(
                'product.quantity_per_selling_unit',
                1
            )
            ->assertJsonPath(
                'product.ai_suggestion_status',
                'rejected'
            );

        $product->refresh();

        $this->assertSame(
            1.0,
            (float) $product->quantity_per_selling_unit
        );
        $this->assertSame('rejected', $product->ai_suggestion_status);

        $this->assertDatabaseHas('audit_logs', [
            'tenant_id' => $tenant->id,
            'action' => 'pharmaco.product.selling_unit_ai_rejected',
            'auditable_type' => Product::class,
            'auditable_id' => $product->id,
        ]);
    }

    public function test_suggestion_endpoints_remain_tenant_scoped(): void
    {
        $this->seed();

        [, $otherProduct] = $this->createOtherTenantProduct();
        $token = $this->loginAs('admin@vitapharmaafrica.com');

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->postJson(
                "/api/v1/pharmaco/products/{$otherProduct->id}/selling-unit-ai-suggestion/generate"
            )
            ->assertNotFound();
    }

    private function loginAs(string $email): string
    {
        $response = $this->postJson('/api/v1/auth/login', [
            'email' => $email,
            'password' => 'ChangeThisPassword123!',
            'device_name' => 'PharmaCo360 Selling Unit AI Test Client',
        ]);

        $response->assertOk();

        return $response->json('access_token');
    }

    private function generateSuggestion(
        Tenant $tenant,
        Product $product,
        string $token
    ): void {
        $this->withHeader('X-Tenant-Slug', $tenant->slug)
            ->withToken($token)
            ->postJson(
                "/api/v1/pharmaco/products/{$product->id}/selling-unit-ai-suggestion/generate"
            )
            ->assertOk();
    }

    private function createSyrupProduct(): array
    {
        $tenant = Tenant::where('slug', 'vitapharma')->firstOrFail();

        $category = ProductCategory::where('tenant_id', $tenant->id)
            ->firstOrFail();

        $product = Product::query()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $tenant->id,
            'product_category_id' => $category->id,
            'name' => 'Paediatric Syrup 100ml Bottle',
            'generic_name' => 'Paediatric Syrup',
            'sku' => 'AI-SYRUP-' . Str::upper(Str::random(8)),
            'dosage_form' => 'syrup',
            'unit' => 'bottle',
            'selling_unit' => 'bottle',
            'base_unit' => 'ml',
            'quantity_per_selling_unit' => 1,
            'allow_other_quantity' => true,
            'default_pos_quantity_mode' => 'selling_unit',
            'pack_size' => '100 ml bottle',
            'product_type' => 'medicine',
            'regulatory_status' => 'approved',
            'requires_prescription' => false,
            'is_controlled' => false,
            'reorder_level' => 0,
            'minimum_stock_level' => 0,
            'status' => 'active',
            'metadata' => [
                'rhia_designation' => 'Paediatric Syrup Bottle 100 ml',
                'rhia_instructions' => 'Dispense according to the prescribed ml quantity.',
            ],
        ]);

        return [$tenant, $product];
    }

    private function createOtherTenantProduct(): array
    {
        $tenant = Tenant::query()->create([
            'uuid' => (string) Str::uuid(),
            'name' => 'Other AI Pharmacy',
            'slug' => 'other-ai-pharmacy-' . Str::lower(Str::random(8)),
            'status' => 'active',
        ]);

        $category = ProductCategory::query()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $tenant->id,
            'name' => 'Other Products',
            'code' => 'OTHER-AI-' . Str::upper(Str::random(6)),
            'category_type' => 'medicine',
            'status' => 'active',
        ]);

        $product = Product::query()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $tenant->id,
            'product_category_id' => $category->id,
            'name' => 'Other Tenant Syrup',
            'sku' => 'OTHER-AI-' . Str::upper(Str::random(8)),
            'unit' => 'bottle',
            'selling_unit' => 'bottle',
            'base_unit' => 'ml',
            'quantity_per_selling_unit' => 1,
            'pack_size' => '100 ml bottle',
            'product_type' => 'medicine',
            'regulatory_status' => 'approved',
            'requires_prescription' => false,
            'is_controlled' => false,
            'reorder_level' => 0,
            'minimum_stock_level' => 0,
            'status' => 'active',
        ]);

        return [$tenant, $product];
    }
}
