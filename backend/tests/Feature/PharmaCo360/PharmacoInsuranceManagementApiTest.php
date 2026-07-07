<?php

namespace Tests\Feature\PharmaCo360;

use App\Models\InsurancePartner;
use App\Models\InsuranceScheme;
use App\Models\Product;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PharmacoInsuranceManagementApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_bootstrap_insurance_defaults_and_audit_is_recorded(): void
    {
        $this->seed();
        $this->authenticateAdmin();

        $tenant = Tenant::where('slug', 'vitapharma')->firstOrFail();

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->postJson('/api/v1/pharmaco/insurance/bootstrap')
            ->assertOk()
            ->assertJsonPath(
                'message',
                'Insurance management defaults initialized successfully.'
            )
            ->assertJsonPath('bootstrap.partner_count', 3);

        $this->assertDatabaseHas('insurance_partners', [
            'tenant_id' => $tenant->id,
            'code' => 'RSSB',
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'tenant_id' => $tenant->id,
            'action' =>
                'pharmaco.insurance.bootstrap.completed',
        ]);
    }

    public function test_admin_can_create_search_and_update_insurance_partner(): void
    {
        $this->seed();
        $this->authenticateAdmin();

        $tenant = Tenant::where('slug', 'vitapharma')->firstOrFail();

        $response = $this
            ->withHeader('X-Tenant-Slug', 'vitapharma')
            ->postJson('/api/v1/pharmaco/insurance/partners', [
                'name' => 'Aquila Health Insurance',
                'code' => 'aquila-health',
                'partner_type' => 'private_insurer',
                'contact_email' => 'claims@aquila.test',
                'currency' => 'rwf',
                'status' => 'active',
            ]);

        $response
            ->assertCreated()
            ->assertJsonPath(
                'message',
                'Insurance partner created successfully.'
            )
            ->assertJsonPath('partner.code', 'AQUILA-HEALTH');

        $partnerId = $response->json('partner.id');

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->getJson(
                '/api/v1/pharmaco/insurance/partners'
                . '?search=Aquila&status=active&per_page=10'
            )
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath(
                'partners.0.code',
                'AQUILA-HEALTH'
            );

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->patchJson(
                "/api/v1/pharmaco/insurance/partners/{$partnerId}",
                [
                    'name' => 'Aquila Health Insurance Updated',
                    'is_default' => true,
                ]
            )
            ->assertOk()
            ->assertJsonPath(
                'partner.name',
                'Aquila Health Insurance Updated'
            )
            ->assertJsonPath('partner.is_default', true);

        $this->assertDatabaseHas('audit_logs', [
            'tenant_id' => $tenant->id,
            'action' => 'pharmaco.insurance_partner.created',
            'auditable_type' => InsurancePartner::class,
            'auditable_id' => $partnerId,
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'tenant_id' => $tenant->id,
            'action' => 'pharmaco.insurance_partner.updated',
            'auditable_type' => InsurancePartner::class,
            'auditable_id' => $partnerId,
        ]);
    }

    public function test_duplicate_partner_code_is_rejected_within_tenant(): void
    {
        $this->seed();
        $this->authenticateAdmin();

        $tenant = Tenant::where('slug', 'vitapharma')->firstOrFail();

        InsurancePartner::query()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $tenant->id,
            'name' => 'Existing Partner',
            'code' => 'EXISTING',
            'partner_type' => 'private_insurer',
            'currency' => 'RWF',
            'status' => 'active',
        ]);

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->postJson('/api/v1/pharmaco/insurance/partners', [
                'name' => 'Duplicate Partner',
                'code' => 'existing',
                'partner_type' => 'private_insurer',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('code');
    }

    public function test_admin_can_create_and_list_insurance_scheme(): void
    {
        $this->seed();
        $this->authenticateAdmin();

        $tenant = Tenant::where('slug', 'vitapharma')->firstOrFail();

        $partner = InsurancePartner::query()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $tenant->id,
            'name' => 'Scheme Test Partner',
            'code' => 'SCHEME-TEST',
            'partner_type' => 'private_insurer',
            'currency' => 'RWF',
            'status' => 'active',
        ]);

        $response = $this
            ->withHeader('X-Tenant-Slug', 'vitapharma')
            ->postJson('/api/v1/pharmaco/insurance/schemes', [
                'insurance_partner_id' => $partner->id,
                'name' => 'Gold Medical Scheme',
                'code' => 'gold-medical',
                'scheme_type' => 'medical',
                'default_customer_contribution_percent' => 20,
                'default_insurer_contribution_percent' => 80,
                'status' => 'active',
            ]);

        $response
            ->assertCreated()
            ->assertJsonPath(
                'message',
                'Insurance scheme created successfully.'
            )
            ->assertJsonPath('scheme.code', 'GOLD-MEDICAL')
            ->assertJsonPath(
                'scheme.default_customer_contribution_percent',
                20
            );

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->getJson(
                '/api/v1/pharmaco/insurance/schemes'
                . "?insurance_partner_id={$partner->id}"
            )
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath(
                'schemes.0.code',
                'GOLD-MEDICAL'
            );
    }

    public function test_scheme_contribution_percentages_must_total_one_hundred(): void
    {
        $this->seed();
        $this->authenticateAdmin();

        $tenant = Tenant::where('slug', 'vitapharma')->firstOrFail();

        $partner = InsurancePartner::query()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $tenant->id,
            'name' => 'Contribution Test Partner',
            'code' => 'CONTRIBUTION-TEST',
            'partner_type' => 'private_insurer',
            'currency' => 'RWF',
            'status' => 'active',
        ]);

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->postJson('/api/v1/pharmaco/insurance/schemes', [
                'insurance_partner_id' => $partner->id,
                'name' => 'Invalid Scheme',
                'code' => 'INVALID-SCHEME',
                'default_customer_contribution_percent' => 25,
                'default_insurer_contribution_percent' => 60,
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(
                'default_insurer_contribution_percent'
            );
    }

    public function test_pricing_resolution_endpoint_uses_bootstrapped_scheme(): void
    {
        $this->seed();
        $this->authenticateAdmin();

        $tenant = Tenant::where('slug', 'vitapharma')->firstOrFail();

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->postJson('/api/v1/pharmaco/insurance/bootstrap')
            ->assertOk();

        $partner = InsurancePartner::where(
            'tenant_id',
            $tenant->id
        )
            ->where('code', 'RSSB')
            ->firstOrFail();

        $scheme = InsuranceScheme::where(
            'tenant_id',
            $tenant->id
        )
            ->where('insurance_partner_id', $partner->id)
            ->firstOrFail();

        $product = Product::where(
            'tenant_id',
            $tenant->id
        )->firstOrFail();

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->postJson(
                '/api/v1/pharmaco/insurance/pricing/resolve',
                [
                    'insurance_partner_id' => $partner->id,
                    'insurance_scheme_id' => $scheme->id,
                    'product_id' => $product->id,
                    'retail_unit_price' => 10000,
                ]
            )
            ->assertOk()
            ->assertJsonPath(
                'resolution.customer_contribution_percent',
                15
            )
            ->assertJsonPath(
                'resolution.insurer_contribution_percent',
                85
            )
            ->assertJsonPath(
                'resolution.customer_amount',
                1500
            )
            ->assertJsonPath(
                'resolution.insurer_amount',
                8500
            );
    }

    public function test_cross_tenant_partner_cannot_be_updated_or_used_for_scheme(): void
    {
        $this->seed();
        $this->authenticateAdmin();

        $otherTenant = Tenant::query()->create([
            'uuid' => (string) Str::uuid(),
            'name' => 'Other Insurance API Tenant',
            'slug' => 'other-insurance-api-tenant',
            'status' => 'active',
        ]);

        $otherPartner = InsurancePartner::query()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $otherTenant->id,
            'name' => 'Other Tenant Insurer',
            'code' => 'OTHER-TENANT-INSURER',
            'partner_type' => 'private_insurer',
            'currency' => 'RWF',
            'status' => 'active',
        ]);

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->patchJson(
                "/api/v1/pharmaco/insurance/partners/{$otherPartner->id}",
                ['name' => 'Forbidden Update']
            )
            ->assertNotFound();

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->postJson('/api/v1/pharmaco/insurance/schemes', [
                'insurance_partner_id' => $otherPartner->id,
                'name' => 'Forbidden Scheme',
                'code' => 'FORBIDDEN-SCHEME',
                'default_customer_contribution_percent' => 10,
                'default_insurer_contribution_percent' => 90,
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(
                'insurance_partner_id'
            );
    }

    public function test_insurance_endpoints_require_tenant_header(): void
    {
        $this->seed();
        $this->authenticateAdmin();

        $this->getJson('/api/v1/pharmaco/insurance/partners')
            ->assertStatus(422)
            ->assertJsonPath(
                'required_header',
                'X-Tenant-Slug'
            );
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
