<?php

namespace Tests\Feature\PharmaCo360;

use App\Models\InsuranceContributionRule;
use App\Models\InsurancePartner;
use App\Models\InsurancePriceList;
use App\Models\InsuranceProductPrice;
use App\Models\InsuranceScheme;
use App\Models\Product;
use App\Models\Tenant;
use App\Services\PharmaCo360\InsurancePricingResolver;
use App\Services\PharmaCo360\InsuranceTenantBootstrapService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class PharmacoInsuranceBootstrapPricingTest extends TestCase
{
    use RefreshDatabase;

    public function test_bootstrap_is_idempotent_for_one_tenant(): void
    {
        $this->seed();

        $tenant = Tenant::where('slug', 'vitapharma')->firstOrFail();
        $service = app(InsuranceTenantBootstrapService::class);

        $first = $service->bootstrap($tenant);
        $second = $service->bootstrap($tenant);

        $this->assertSame(3, $first['partner_count']);
        $this->assertSame(3, $second['partner_count']);

        $this->assertSame(
            3,
            InsurancePartner::where('tenant_id', $tenant->id)->count()
        );

        $this->assertSame(
            3,
            InsuranceScheme::where('tenant_id', $tenant->id)->count()
        );

        $this->assertSame(
            3,
            InsurancePriceList::where('tenant_id', $tenant->id)->count()
        );

        $this->assertSame(
            3,
            InsuranceContributionRule::where(
                'tenant_id',
                $tenant->id
            )->count()
        );
    }

    public function test_bootstrap_is_tenant_scoped(): void
    {
        $this->seed();

        $firstTenant = Tenant::where(
            'slug',
            'vitapharma'
        )->firstOrFail();

        $secondTenant = Tenant::query()->create([
            'uuid' => (string) Str::uuid(),
            'name' => 'Second Insurance Tenant',
            'slug' => 'second-insurance-tenant',
            'status' => 'active',
        ]);

        $service = app(InsuranceTenantBootstrapService::class);

        $service->bootstrap($firstTenant);
        $service->bootstrap($secondTenant);

        $this->assertSame(
            3,
            InsurancePartner::where(
                'tenant_id',
                $firstTenant->id
            )->count()
        );

        $this->assertSame(
            3,
            InsurancePartner::where(
                'tenant_id',
                $secondTenant->id
            )->count()
        );

        $this->assertSame(
            2,
            InsurancePartner::where('code', 'RSSB')->count()
        );
    }

    public function test_product_price_overrides_retail_and_rule_percentages(): void
    {
        $this->seed();

        $tenant = Tenant::where('slug', 'vitapharma')->firstOrFail();
        app(InsuranceTenantBootstrapService::class)->bootstrap($tenant);

        $partner = InsurancePartner::where('tenant_id', $tenant->id)
            ->where('code', 'RSSB')
            ->firstOrFail();

        $scheme = InsuranceScheme::where('tenant_id', $tenant->id)
            ->where('insurance_partner_id', $partner->id)
            ->firstOrFail();

        $product = Product::where('tenant_id', $tenant->id)
            ->firstOrFail();

        $priceList = InsurancePriceList::query()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $tenant->id,
            'insurance_partner_id' => $partner->id,
            'insurance_scheme_id' => $scheme->id,
            'name' => 'Priority Price List',
            'code' => 'RSSB-PRIORITY',
            'currency' => 'RWF',
            'effective_from' => '2026-01-01',
            'priority' => 1,
            'status' => 'active',
        ]);

        InsuranceProductPrice::query()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $tenant->id,
            'insurance_price_list_id' => $priceList->id,
            'product_id' => $product->id,
            'agreed_unit_price' => 4000,
            'maximum_claimable_price' => 3800,
            'customer_contribution_percent' => 10,
            'insurer_contribution_percent' => 90,
            'requires_pre_authorization' => true,
            'is_covered' => true,
            'coverage_status' => 'covered',
        ]);

        InsuranceContributionRule::query()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $tenant->id,
            'insurance_partner_id' => $partner->id,
            'insurance_scheme_id' => $scheme->id,
            'product_id' => $product->id,
            'rule_name' => 'Product contribution override',
            'rule_scope' => 'product',
            'customer_contribution_percent' => 5,
            'insurer_contribution_percent' => 95,
            'priority' => 1,
            'status' => 'active',
        ]);

        $resolved = app(InsurancePricingResolver::class)->resolve(
            tenantId: $tenant->id,
            partner: $partner,
            product: $product,
            retailUnitPrice: 5000,
            scheme: $scheme
        );

        $this->assertSame(4000.0, $resolved['agreed_unit_price']);
        $this->assertSame(
            10.0,
            $resolved['customer_contribution_percent']
        );
        $this->assertSame(
            90.0,
            $resolved['insurer_contribution_percent']
        );
        $this->assertSame(400.0, $resolved['customer_amount']);
        $this->assertSame(3600.0, $resolved['insurer_amount']);
        $this->assertTrue(
            $resolved['requires_pre_authorization']
        );
        $this->assertSame(
            'insurance_product_price',
            $resolved['pricing_source']
        );
        $this->assertSame(
            'RSSB-PRIORITY',
            $resolved['price_list']['code']
        );
    }

    public function test_product_rule_precedes_scheme_rule(): void
    {
        $this->seed();

        $tenant = Tenant::where('slug', 'vitapharma')->firstOrFail();
        app(InsuranceTenantBootstrapService::class)->bootstrap($tenant);

        $partner = InsurancePartner::where('tenant_id', $tenant->id)
            ->where('code', 'MMI')
            ->firstOrFail();

        $scheme = InsuranceScheme::where('tenant_id', $tenant->id)
            ->where('insurance_partner_id', $partner->id)
            ->firstOrFail();

        $product = Product::where('tenant_id', $tenant->id)
            ->firstOrFail();

        InsuranceContributionRule::query()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $tenant->id,
            'insurance_partner_id' => $partner->id,
            'insurance_scheme_id' => $scheme->id,
            'product_id' => $product->id,
            'rule_name' => 'MMI product override',
            'rule_scope' => 'product',
            'customer_contribution_percent' => 2,
            'insurer_contribution_percent' => 98,
            'priority' => 1,
            'status' => 'active',
        ]);

        $resolved = app(InsurancePricingResolver::class)->resolve(
            tenantId: $tenant->id,
            partner: $partner,
            product: $product,
            retailUnitPrice: 10000,
            scheme: $scheme
        );

        $this->assertSame(
            2.0,
            $resolved['customer_contribution_percent']
        );
        $this->assertSame(
            98.0,
            $resolved['insurer_contribution_percent']
        );
        $this->assertSame(200.0, $resolved['customer_amount']);
        $this->assertSame(9800.0, $resolved['insurer_amount']);
        $this->assertSame(
            'product',
            $resolved['contribution_rule']['scope']
        );
    }

    public function test_retail_fallback_uses_scheme_default_contribution(): void
    {
        $this->seed();

        $tenant = Tenant::where('slug', 'vitapharma')->firstOrFail();
        app(InsuranceTenantBootstrapService::class)->bootstrap($tenant);

        $partner = InsurancePartner::where('tenant_id', $tenant->id)
            ->where('code', 'PRIVATE')
            ->firstOrFail();

        $scheme = InsuranceScheme::where('tenant_id', $tenant->id)
            ->where('insurance_partner_id', $partner->id)
            ->firstOrFail();

        $product = Product::where('tenant_id', $tenant->id)
            ->firstOrFail();

        $resolved = app(InsurancePricingResolver::class)->resolve(
            tenantId: $tenant->id,
            partner: $partner,
            product: $product,
            retailUnitPrice: 7500,
            scheme: $scheme
        );

        $this->assertSame(7500.0, $resolved['agreed_unit_price']);
        $this->assertSame(
            20.0,
            $resolved['customer_contribution_percent']
        );
        $this->assertSame(
            80.0,
            $resolved['insurer_contribution_percent']
        );
        $this->assertSame(1500.0, $resolved['customer_amount']);
        $this->assertSame(6000.0, $resolved['insurer_amount']);
        $this->assertSame(
            'retail_fallback',
            $resolved['pricing_source']
        );
    }

    public function test_cross_tenant_partner_is_rejected(): void
    {
        $this->seed();

        $tenant = Tenant::where('slug', 'vitapharma')->firstOrFail();
        $product = Product::where('tenant_id', $tenant->id)
            ->firstOrFail();

        $otherTenant = Tenant::query()->create([
            'uuid' => (string) Str::uuid(),
            'name' => 'Other Tenant',
            'slug' => 'other-tenant',
            'status' => 'active',
        ]);

        app(InsuranceTenantBootstrapService::class)
            ->bootstrap($otherTenant);

        $otherPartner = InsurancePartner::where(
            'tenant_id',
            $otherTenant->id
        )->firstOrFail();

        $this->expectException(
            ValidationException::class
        );

        app(InsurancePricingResolver::class)->resolve(
            tenantId: $tenant->id,
            partner: $otherPartner,
            product: $product,
            retailUnitPrice: 5000
        );
    }
}
