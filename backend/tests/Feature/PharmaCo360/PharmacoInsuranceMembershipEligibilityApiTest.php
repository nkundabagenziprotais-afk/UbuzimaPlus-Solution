<?php

namespace Tests\Feature\PharmaCo360;

use App\Models\CustomerInsuranceMembership;
use App\Models\InsurancePartner;
use App\Models\InsuranceScheme;
use App\Models\PharmacoCustomer;
use App\Models\Tenant;
use App\Models\User;
use App\Services\PharmaCo360\InsuranceTenantBootstrapService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PharmacoInsuranceMembershipEligibilityApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_create_list_and_update_membership(): void
    {
        $this->seed();
        $this->authenticateAdmin();

        [$tenant, $customer, $partner, $scheme] =
            $this->insuranceContext();

        $response = $this->withTenant()
            ->postJson('/api/v1/pharmaco/insurance/memberships', [
                'customer_id' => $customer->id,
                'insurance_partner_id' => $partner->id,
                'insurance_scheme_id' => $scheme->id,
                'member_number' => 'RSSB-MEMBER-001',
                'policy_number' => 'POLICY-001',
                'relationship_to_principal' => 'self',
                'coverage_from' => now()
                    ->subMonth()
                    ->toDateString(),
                'coverage_to' => now()
                    ->addYear()
                    ->toDateString(),
                'verification_status' => 'verified',
                'status' => 'active',
            ]);

        $response
            ->assertCreated()
            ->assertJsonPath(
                'membership.member_number',
                'RSSB-MEMBER-001'
            )
            ->assertJsonPath(
                'membership.verification_status',
                'verified'
            )
            ->assertJsonPath(
                'membership.customer.id',
                $customer->id
            );

        $membershipId = $response->json('membership.id');

        $this->withTenant()
            ->getJson(
                '/api/v1/pharmaco/insurance/memberships'
                . '?search=RSSB-MEMBER-001'
            )
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath(
                'memberships.0.id',
                $membershipId
            );

        $this->withTenant()
            ->patchJson(
                "/api/v1/pharmaco/insurance/memberships/{$membershipId}",
                [
                    'policy_number' => 'POLICY-001-UPDATED',
                    'relationship_to_principal' => 'dependent',
                ]
            )
            ->assertOk()
            ->assertJsonPath(
                'membership.policy_number',
                'POLICY-001-UPDATED'
            )
            ->assertJsonPath(
                'membership.relationship_to_principal',
                'dependent'
            );

        $this->assertDatabaseHas('audit_logs', [
            'tenant_id' => $tenant->id,
            'action' =>
                'pharmaco.insurance_membership.created',
            'auditable_type' =>
                CustomerInsuranceMembership::class,
            'auditable_id' => $membershipId,
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'tenant_id' => $tenant->id,
            'action' =>
                'pharmaco.insurance_membership.updated',
            'auditable_type' =>
                CustomerInsuranceMembership::class,
            'auditable_id' => $membershipId,
        ]);
    }

    public function test_verified_active_membership_is_eligible(): void
    {
        $this->seed();
        $this->authenticateAdmin();

        [, $customer, $partner, $scheme] =
            $this->insuranceContext();

        $membership = $this->createMembership(
            customer: $customer,
            partner: $partner,
            scheme: $scheme,
            coverageFrom: now()->subMonth()->toDateString(),
            coverageTo: now()->addMonth()->toDateString()
        );

        $this->withTenant()
            ->postJson(
                "/api/v1/pharmaco/insurance/memberships/"
                . "{$membership->id}/eligibility",
                ['service_date' => now()->toDateString()]
            )
            ->assertOk()
            ->assertJsonPath('eligibility.eligible', true)
            ->assertJsonCount(0, 'eligibility.reasons');

        $this->assertNotNull(
            $membership->fresh()->eligibility_response
        );

        $this->assertDatabaseHas('audit_logs', [
            'action' =>
                'pharmaco.insurance_membership.eligibility_checked',
            'auditable_type' =>
                CustomerInsuranceMembership::class,
            'auditable_id' => $membership->id,
        ]);
    }

    public function test_expired_membership_is_not_eligible(): void
    {
        $this->seed();
        $this->authenticateAdmin();

        [, $customer, $partner, $scheme] =
            $this->insuranceContext();

        $membership = $this->createMembership(
            customer: $customer,
            partner: $partner,
            scheme: $scheme,
            coverageFrom: now()->subYear()->toDateString(),
            coverageTo: now()->subDay()->toDateString()
        );

        $this->withTenant()
            ->postJson(
                "/api/v1/pharmaco/insurance/memberships/"
                . "{$membership->id}/eligibility",
                ['service_date' => now()->toDateString()]
            )
            ->assertOk()
            ->assertJsonPath('eligibility.eligible', false)
            ->assertJsonFragment([
                'code' => 'coverage_expired',
            ]);
    }

    public function test_unverified_membership_is_not_eligible(): void
    {
        $this->seed();
        $this->authenticateAdmin();

        [, $customer, $partner, $scheme] =
            $this->insuranceContext();

        $membership = $this->createMembership(
            customer: $customer,
            partner: $partner,
            scheme: $scheme,
            verificationStatus: 'pending'
        );

        $this->withTenant()
            ->postJson(
                "/api/v1/pharmaco/insurance/memberships/"
                . "{$membership->id}/eligibility"
            )
            ->assertOk()
            ->assertJsonPath('eligibility.eligible', false)
            ->assertJsonFragment([
                'code' => 'membership_not_verified',
            ]);
    }

    public function test_duplicate_member_number_is_rejected_for_partner(): void
    {
        $this->seed();
        $this->authenticateAdmin();

        [, $customer, $partner, $scheme] =
            $this->insuranceContext();

        $this->createMembership(
            customer: $customer,
            partner: $partner,
            scheme: $scheme
        );

        $otherCustomer = $this->createCustomer(
            $customer->tenant_id,
            'Secondary',
            '+250788000002'
        );

        $this->withTenant()
            ->postJson('/api/v1/pharmaco/insurance/memberships', [
                'customer_id' => $otherCustomer->id,
                'insurance_partner_id' => $partner->id,
                'insurance_scheme_id' => $scheme->id,
                'member_number' => 'MEMBER-001',
                'verification_status' => 'verified',
                'status' => 'active',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('member_number');
    }

    public function test_scheme_must_belong_to_selected_partner(): void
    {
        $this->seed();
        $this->authenticateAdmin();

        [$tenant, $customer, $partner, $scheme] =
            $this->insuranceContext();

        $otherPartner = InsurancePartner::query()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $tenant->id,
            'name' => 'Other Partner',
            'code' => 'OTHER-PARTNER',
            'partner_type' => 'private_insurer',
            'currency' => 'RWF',
            'status' => 'active',
        ]);

        $this->withTenant()
            ->postJson('/api/v1/pharmaco/insurance/memberships', [
                'customer_id' => $customer->id,
                'insurance_partner_id' => $otherPartner->id,
                'insurance_scheme_id' => $scheme->id,
                'member_number' => 'MISMATCH-001',
                'verification_status' => 'verified',
                'status' => 'active',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(
                'insurance_scheme_id'
            );
    }

    public function test_cross_tenant_membership_is_blocked(): void
    {
        $this->seed();
        $this->authenticateAdmin();

        $otherTenant = Tenant::query()->create([
            'uuid' => (string) Str::uuid(),
            'name' => 'Other Membership Tenant',
            'slug' => 'other-membership-tenant',
            'status' => 'active',
        ]);

        app(InsuranceTenantBootstrapService::class)
            ->bootstrap($otherTenant);

        $customer = $this->createCustomer(
            $otherTenant->id,
            'Other',
            '+250788999999'
        );

        $partner = InsurancePartner::query()
            ->where('tenant_id', $otherTenant->id)
            ->firstOrFail();

        $scheme = InsuranceScheme::query()
            ->where('tenant_id', $otherTenant->id)
            ->where('insurance_partner_id', $partner->id)
            ->firstOrFail();

        $membership = $this->createMembership(
            customer: $customer,
            partner: $partner,
            scheme: $scheme
        );

        $this->withTenant()
            ->patchJson(
                "/api/v1/pharmaco/insurance/memberships/"
                . $membership->id,
                ['status' => 'inactive']
            )
            ->assertNotFound();

        $this->withTenant()
            ->postJson(
                "/api/v1/pharmaco/insurance/memberships/"
                . "{$membership->id}/eligibility"
            )
            ->assertNotFound();
    }

    private function insuranceContext(): array
    {
        $tenant = Tenant::query()
            ->where('slug', 'vitapharma')
            ->firstOrFail();

        app(InsuranceTenantBootstrapService::class)
            ->bootstrap($tenant);

        $customer = $this->createCustomer(
            $tenant->id,
            'Eligible',
            '+250788000001'
        );

        $partner = InsurancePartner::query()
            ->where('tenant_id', $tenant->id)
            ->where('code', 'RSSB')
            ->firstOrFail();

        $scheme = InsuranceScheme::query()
            ->where('tenant_id', $tenant->id)
            ->where('insurance_partner_id', $partner->id)
            ->firstOrFail();

        return [$tenant, $customer, $partner, $scheme];
    }

    private function createCustomer(
        int $tenantId,
        string $firstName,
        string $phone
    ): PharmacoCustomer {
        return PharmacoCustomer::query()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $tenantId,
            'first_name' => $firstName,
            'last_name' => 'Member',
            'phone' => $phone,
            'customer_type' => 'insurance_customer',
            'status' => 'active',
        ]);
    }

    private function createMembership(
        PharmacoCustomer $customer,
        InsurancePartner $partner,
        InsuranceScheme $scheme,
        string $coverageFrom = null,
        string $coverageTo = null,
        string $verificationStatus = 'verified'
    ): CustomerInsuranceMembership {
        return CustomerInsuranceMembership::query()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $customer->tenant_id,
            'customer_id' => $customer->id,
            'insurance_partner_id' => $partner->id,
            'insurance_scheme_id' => $scheme->id,
            'member_number' => 'MEMBER-001',
            'relationship_to_principal' => 'self',
            'coverage_from' => $coverageFrom,
            'coverage_to' => $coverageTo,
            'verification_status' => $verificationStatus,
            'verified_at' =>
                $verificationStatus === 'verified'
                    ? now()
                    : null,
            'status' => 'active',
        ]);
    }

    private function withTenant(): static
    {
        return $this->withHeader(
            'X-Tenant-Slug',
            'vitapharma'
        );
    }

    private function authenticateAdmin(): void
    {
        Sanctum::actingAs(
            User::query()
                ->where(
                    'email',
                    'admin@vitapharmaafrica.com'
                )
                ->firstOrFail()
        );
    }
}
