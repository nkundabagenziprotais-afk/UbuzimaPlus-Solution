<?php

namespace Tests\Feature\PharmaCo360;

use App\Models\InsuranceContributionRule;
use App\Models\InsuranceInstitution;
use App\Models\InsurancePartner;
use App\Models\InsurancePriceList;
use App\Models\InsuranceProductPrice;
use App\Models\InsuranceScheme;
use App\Models\Product;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PharmacoInsuranceConfigurationApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_manage_institution_and_scheme_update(): void
    {
        $this->seed();
        $this->authenticateAdmin();

        [$tenant, $partner] = $this->tenantAndPartner();

        $institutionResponse = $this
            ->withHeader('X-Tenant-Slug', 'vitapharma')
            ->postJson('/api/v1/pharmaco/insurance/institutions', [
                'insurance_partner_id' => $partner->id,
                'name' => 'Aquila Corporate Client',
                'code' => 'aquila-corporate',
                'institution_type' => 'employer',
                'status' => 'active',
            ])
            ->assertCreated()
            ->assertJsonPath(
                'institution.code',
                'AQUILA-CORPORATE'
            );

        $institutionId =
            $institutionResponse->json('institution.id');

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->patchJson(
                "/api/v1/pharmaco/insurance/institutions/{$institutionId}",
                [
                    'name' => 'Aquila Corporate Client Updated',
                ]
            )
            ->assertOk()
            ->assertJsonPath(
                'institution.name',
                'Aquila Corporate Client Updated'
            );

        $scheme = InsuranceScheme::query()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $tenant->id,
            'insurance_partner_id' => $partner->id,
            'name' => 'Corporate Scheme',
            'code' => 'CORPORATE-SCHEME',
            'default_customer_contribution_percent' => 20,
            'default_insurer_contribution_percent' => 80,
            'status' => 'active',
        ]);

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->patchJson(
                "/api/v1/pharmaco/insurance/schemes/{$scheme->id}",
                [
                    'insurance_institution_id' => $institutionId,
                    'default_customer_contribution_percent' => 10,
                    'default_insurer_contribution_percent' => 90,
                ]
            )
            ->assertOk()
            ->assertJsonPath(
                'scheme.insurance_institution_id',
                $institutionId
            )
            ->assertJsonPath(
                'scheme.default_customer_contribution_percent',
                10
            );

        $this->assertDatabaseHas('audit_logs', [
            'tenant_id' => $tenant->id,
            'action' =>
                'pharmaco.insurance_institution.created',
            'auditable_type' => InsuranceInstitution::class,
        ]);
    }

    public function test_admin_can_manage_price_list_and_product_price(): void
    {
        $this->seed();
        $this->authenticateAdmin();

        [$tenant, $partner] = $this->tenantAndPartner();
        $product = Product::where('tenant_id', $tenant->id)
            ->firstOrFail();

        $priceListResponse = $this
            ->withHeader('X-Tenant-Slug', 'vitapharma')
            ->postJson('/api/v1/pharmaco/insurance/price-lists', [
                'insurance_partner_id' => $partner->id,
                'name' => 'Aquila 2026 Price List',
                'code' => 'aquila-2026',
                'currency' => 'rwf',
                'effective_from' => '2026-01-01',
                'priority' => 10,
                'status' => 'active',
                'is_default' => true,
            ])
            ->assertCreated()
            ->assertJsonPath(
                'price_list.code',
                'AQUILA-2026'
            );

        $priceListId =
            $priceListResponse->json('price_list.id');

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->postJson('/api/v1/pharmaco/insurance/product-prices', [
                'insurance_price_list_id' => $priceListId,
                'product_id' => $product->id,
                'agreed_unit_price' => 2500,
                'customer_contribution_percent' => 20,
                'insurer_contribution_percent' => 80,
                'coverage_status' => 'covered',
            ])
            ->assertCreated()
            ->assertJsonPath(
                'product_price.agreed_unit_price',
                2500
            );

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->postJson('/api/v1/pharmaco/insurance/product-prices', [
                'insurance_price_list_id' => $priceListId,
                'product_id' => $product->id,
                'agreed_unit_price' => 2750,
                'customer_contribution_percent' => 10,
                'insurer_contribution_percent' => 90,
                'coverage_status' => 'covered',
            ])
            ->assertOk()
            ->assertJsonPath(
                'product_price.agreed_unit_price',
                2750
            );

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->getJson(
                '/api/v1/pharmaco/insurance/product-prices'
                . "?insurance_price_list_id={$priceListId}"
            )
            ->assertOk()
            ->assertJsonPath('meta.total', 1);

        $this->assertDatabaseHas('audit_logs', [
            'tenant_id' => $tenant->id,
            'action' =>
                'pharmaco.insurance_product_price.updated',
            'auditable_type' => InsuranceProductPrice::class,
        ]);
    }

    public function test_admin_can_manage_contribution_rule(): void
    {
        $this->seed();
        $this->authenticateAdmin();

        [$tenant, $partner] = $this->tenantAndPartner();
        $product = Product::where('tenant_id', $tenant->id)
            ->firstOrFail();

        $response = $this
            ->withHeader('X-Tenant-Slug', 'vitapharma')
            ->postJson(
                '/api/v1/pharmaco/insurance/contribution-rules',
                [
                    'insurance_partner_id' => $partner->id,
                    'product_id' => $product->id,
                    'rule_name' => 'Product co-pay override',
                    'rule_scope' => 'product',
                    'customer_contribution_percent' => 5,
                    'insurer_contribution_percent' => 95,
                    'priority' => 1,
                    'status' => 'active',
                ]
            )
            ->assertCreated()
            ->assertJsonPath(
                'contribution_rule.rule_scope',
                'product'
            );

        $ruleId =
            $response->json('contribution_rule.id');

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->patchJson(
                "/api/v1/pharmaco/insurance/contribution-rules/{$ruleId}",
                [
                    'customer_contribution_percent' => 8,
                    'insurer_contribution_percent' => 92,
                ]
            )
            ->assertOk()
            ->assertJsonPath(
                'contribution_rule.customer_contribution_percent',
                8
            );

        $this->assertDatabaseHas('insurance_contribution_rules', [
            'id' => $ruleId,
            'customer_contribution_percent' => 8,
            'insurer_contribution_percent' => 92,
        ]);
    }

    public function test_bulk_import_and_csv_export_work(): void
    {
        $this->seed();
        $this->authenticateAdmin();

        [$tenant, $partner] = $this->tenantAndPartner();

        $priceList = InsurancePriceList::query()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $tenant->id,
            'insurance_partner_id' => $partner->id,
            'name' => 'Bulk Import Price List',
            'code' => 'BULK-IMPORT',
            'currency' => 'RWF',
            'effective_from' => '2026-01-01',
            'priority' => 10,
            'status' => 'active',
        ]);

        $products = Product::where('tenant_id', $tenant->id)
            ->limit(2)
            ->get();

        $rows = $products->map(
            fn (Product $product, int $index) => [
                'product_id' => $product->id,
                'agreed_unit_price' => 1000 + ($index * 500),
                'customer_contribution_percent' => 15,
                'insurer_contribution_percent' => 85,
                'coverage_status' => 'covered',
            ]
        )->values()->all();

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->postJson(
                '/api/v1/pharmaco/insurance/product-prices/bulk-import',
                [
                    'insurance_price_list_id' => $priceList->id,
                    'rows' => $rows,
                ]
            )
            ->assertOk()
            ->assertJsonPath(
                'result.total_rows',
                count($rows)
            );

        $this->assertSame(
            count($rows),
            InsuranceProductPrice::where(
                'insurance_price_list_id',
                $priceList->id
            )->count()
        );

        $export = $this
            ->withHeader('X-Tenant-Slug', 'vitapharma')
            ->get(
                '/api/v1/pharmaco/insurance/product-prices/export'
                . "?insurance_price_list_id={$priceList->id}"
            );

        $export
            ->assertOk()
            ->assertHeader('content-type', 'text/csv; charset=UTF-8');

        $this->assertStringContainsString(
            'product_id,sku,product_name',
            $export->getContent()
        );
    }

    public function test_cross_tenant_configuration_records_are_blocked(): void
    {
        $this->seed();
        $this->authenticateAdmin();

        $otherTenant = Tenant::query()->create([
            'uuid' => (string) Str::uuid(),
            'name' => 'Other Insurance Configuration Tenant',
            'slug' => 'other-insurance-configuration-tenant',
            'status' => 'active',
        ]);

        $otherPartner = InsurancePartner::query()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $otherTenant->id,
            'name' => 'Other Partner',
            'code' => 'OTHER-CONFIG',
            'partner_type' => 'private_insurer',
            'currency' => 'RWF',
            'status' => 'active',
        ]);

        $otherInstitution = InsuranceInstitution::query()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $otherTenant->id,
            'insurance_partner_id' => $otherPartner->id,
            'name' => 'Other Institution',
            'code' => 'OTHER-INSTITUTION',
            'status' => 'active',
        ]);

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->patchJson(
                '/api/v1/pharmaco/insurance/institutions/'
                . $otherInstitution->id,
                ['name' => 'Forbidden']
            )
            ->assertNotFound();

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->postJson('/api/v1/pharmaco/insurance/price-lists', [
                'insurance_partner_id' => $otherPartner->id,
                'name' => 'Forbidden Price List',
                'code' => 'FORBIDDEN-PRICE-LIST',
                'effective_from' => '2026-01-01',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(
                'insurance_partner_id'
            );
    }

    private function tenantAndPartner(): array
    {
        $tenant = Tenant::where(
            'slug',
            'vitapharma'
        )->firstOrFail();

        $partner = InsurancePartner::query()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $tenant->id,
            'name' => 'Aquila Test Insurer',
            'code' => 'AQUILA-TEST',
            'partner_type' => 'private_insurer',
            'currency' => 'RWF',
            'status' => 'active',
        ]);

        return [$tenant, $partner];
    }

    private function authenticateAdmin(): void
    {
        $user = User::where(
            'email',
            'admin@vitapharmaafrica.com'
        )->firstOrFail();

        Sanctum::actingAs($user);
    }
}
