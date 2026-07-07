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
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class PharmacoInsuranceManagementFoundationTest extends TestCase
{
    use RefreshDatabase;

    public function test_tenant_can_store_partner_scheme_pricing_and_contribution_rules(): void
    {
        $this->seed();

        $tenant = Tenant::where('slug', 'vitapharma')->firstOrFail();
        $product = Product::where('tenant_id', $tenant->id)->firstOrFail();

        $partner = InsurancePartner::query()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $tenant->id,
            'name' => 'RSSB Medical Insurance',
            'code' => 'RSSB',
            'partner_type' => 'public_insurer',
            'currency' => 'RWF',
            'status' => 'active',
            'is_default' => true,
        ]);

        $institution = InsuranceInstitution::query()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $tenant->id,
            'insurance_partner_id' => $partner->id,
            'name' => 'RSSB General Scheme',
            'code' => 'RSSB-GENERAL',
            'institution_type' => 'scheme_administrator',
            'status' => 'active',
        ]);

        $scheme = InsuranceScheme::query()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $tenant->id,
            'insurance_partner_id' => $partner->id,
            'insurance_institution_id' => $institution->id,
            'name' => 'RSSB Medical Scheme',
            'code' => 'RSSB-MEDICAL',
            'default_customer_contribution_percent' => 15,
            'default_insurer_contribution_percent' => 85,
            'status' => 'active',
        ]);

        $priceList = InsurancePriceList::query()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $tenant->id,
            'insurance_partner_id' => $partner->id,
            'insurance_scheme_id' => $scheme->id,
            'name' => 'RSSB 2026 Medicines',
            'code' => 'RSSB-2026',
            'currency' => 'RWF',
            'effective_from' => '2026-01-01',
            'priority' => 10,
            'status' => 'active',
            'is_default' => true,
        ]);

        InsuranceProductPrice::query()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $tenant->id,
            'insurance_price_list_id' => $priceList->id,
            'product_id' => $product->id,
            'agreed_unit_price' => 2500,
            'maximum_claimable_price' => 2500,
            'customer_contribution_percent' => 15,
            'insurer_contribution_percent' => 85,
            'is_covered' => true,
            'coverage_status' => 'covered',
        ]);

        InsuranceContributionRule::query()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $tenant->id,
            'insurance_partner_id' => $partner->id,
            'insurance_scheme_id' => $scheme->id,
            'insurance_institution_id' => $institution->id,
            'product_id' => $product->id,
            'rule_name' => 'RSSB medicine contribution',
            'rule_scope' => 'product',
            'customer_contribution_percent' => 15,
            'insurer_contribution_percent' => 85,
            'priority' => 10,
            'status' => 'active',
        ]);

        $this->assertDatabaseHas('insurance_partners', [
            'tenant_id' => $tenant->id,
            'code' => 'RSSB',
        ]);

        $this->assertDatabaseHas('insurance_product_prices', [
            'tenant_id' => $tenant->id,
            'product_id' => $product->id,
            'agreed_unit_price' => 2500,
        ]);

        $this->assertDatabaseHas('insurance_contribution_rules', [
            'tenant_id' => $tenant->id,
            'product_id' => $product->id,
            'customer_contribution_percent' => 15,
            'insurer_contribution_percent' => 85,
        ]);

        $this->assertCount(1, $partner->fresh()->schemes);
        $this->assertCount(1, $priceList->fresh()->productPrices);
    }

    public function test_same_partner_code_can_exist_for_different_tenants(): void
    {
        $this->seed();

        $firstTenant = Tenant::where('slug', 'vitapharma')->firstOrFail();

        $secondTenant = Tenant::query()->create([
            'uuid' => (string) Str::uuid(),
            'name' => 'Second Insurance Pharmacy',
            'slug' => 'second-insurance-pharmacy',
            'status' => 'active',
        ]);

        foreach ([$firstTenant, $secondTenant] as $tenant) {
            InsurancePartner::query()->create([
                'uuid' => (string) Str::uuid(),
                'tenant_id' => $tenant->id,
                'name' => 'RSSB',
                'code' => 'RSSB',
                'partner_type' => 'public_insurer',
                'currency' => 'RWF',
                'status' => 'active',
            ]);
        }

        $this->assertSame(
            2,
            InsurancePartner::where('code', 'RSSB')->count()
        );

        $this->assertSame(
            1,
            InsurancePartner::where('tenant_id', $firstTenant->id)
                ->where('code', 'RSSB')
                ->count()
        );

        $this->assertSame(
            1,
            InsurancePartner::where('tenant_id', $secondTenant->id)
                ->where('code', 'RSSB')
                ->count()
        );
    }

    public function test_partner_code_is_unique_within_the_same_tenant(): void
    {
        $this->seed();

        $tenant = Tenant::where('slug', 'vitapharma')->firstOrFail();

        InsurancePartner::query()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $tenant->id,
            'name' => 'RSSB',
            'code' => 'RSSB',
            'partner_type' => 'public_insurer',
            'currency' => 'RWF',
            'status' => 'active',
        ]);

        $this->expectException(\Illuminate\Database\QueryException::class);

        InsurancePartner::query()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $tenant->id,
            'name' => 'Duplicate RSSB',
            'code' => 'RSSB',
            'partner_type' => 'public_insurer',
            'currency' => 'RWF',
            'status' => 'active',
        ]);
    }
}
