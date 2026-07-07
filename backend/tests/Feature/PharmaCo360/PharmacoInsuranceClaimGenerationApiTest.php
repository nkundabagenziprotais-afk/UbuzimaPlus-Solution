<?php

namespace Tests\Feature\PharmaCo360;

use App\Models\CustomerInsuranceMembership;
use App\Models\InsuranceClaim;
use App\Models\InsurancePartner;
use App\Models\InsuranceScheme;
use App\Models\PharmacoCustomer;
use App\Models\PharmacoSale;
use App\Models\PharmacoSaleItem;
use App\Models\StockBatch;
use App\Models\Tenant;
use App\Models\User;
use App\Services\PharmaCo360\InsuranceTenantBootstrapService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PharmacoInsuranceClaimGenerationApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_generate_draft_claim_from_dispensed_insurance_sale(): void
    {
        $this->seed();
        $this->authenticateAdmin();

        [$tenant, $sale, $membership] =
            $this->confirmedInsuranceContext();

        $response = $this->withTenant()
            ->postJson(
                '/api/v1/pharmaco/insurance/claims/from-sale',
                [
                    'sale_id' => $sale->id,
                    'customer_insurance_membership_id' =>
                        $membership->id,
                ]
            );

        $response
            ->assertCreated()
            ->assertJsonPath(
                'message',
                'Draft insurance claim generated successfully.'
            )
            ->assertJsonPath(
                'claim.status',
                'draft'
            )
            ->assertJsonPath(
                'claim.sale.id',
                $sale->id
            )
            ->assertJsonPath(
                'claim.membership.id',
                $membership->id
            )
            ->assertJsonCount(
                $sale->items()->count(),
                'claim.lines'
            );

        $claim = InsuranceClaim::query()
            ->with('lines')
            ->findOrFail(
                $response->json('claim.id')
            );

        $this->assertSame(
            round(
                (float) $claim->gross_amount,
                2
            ),
            round(
                (float) $claim->customer_amount +
                    (float) $claim->claimed_amount,
                2
            )
        );

        foreach ($claim->lines as $line) {
            $this->assertNotEmpty(
                $line->metadata[
                    'pricing_resolution'
                ] ?? null
            );

            $this->assertSame(
                round(
                    (float) $line->gross_amount,
                    2
                ),
                round(
                    (float) $line->customer_amount +
                        (float) $line->claimed_amount,
                    2
                )
            );
        }

        $this->assertDatabaseHas(
            'audit_logs',
            [
                'tenant_id' => $tenant->id,
                'action' =>
                    'pharmaco.insurance_claim.created',
                'auditable_type' =>
                    InsuranceClaim::class,
                'auditable_id' =>
                    $claim->id,
            ]
        );
    }

    public function test_generated_claim_can_be_listed_and_viewed(): void
    {
        $this->seed();
        $this->authenticateAdmin();

        [, $sale, $membership] =
            $this->confirmedInsuranceContext();

        $created = $this->withTenant()
            ->postJson(
                '/api/v1/pharmaco/insurance/claims/from-sale',
                [
                    'sale_id' => $sale->id,
                    'customer_insurance_membership_id' =>
                        $membership->id,
                ]
            )
            ->assertCreated();

        $claimId =
            $created->json('claim.id');

        $claimNumber =
            $created->json(
                'claim.claim_number'
            );

        $this->withTenant()
            ->getJson(
                '/api/v1/pharmaco/insurance/claims'
                . '?search='
                . urlencode($claimNumber)
            )
            ->assertOk()
            ->assertJsonPath(
                'meta.total',
                1
            )
            ->assertJsonPath(
                'claims.0.claim_number',
                $claimNumber
            );

        $this->withTenant()
            ->getJson(
                "/api/v1/pharmaco/insurance/claims/{$claimId}"
            )
            ->assertOk()
            ->assertJsonPath(
                'claim.id',
                $claimId
            )
            ->assertJsonCount(
                $sale->items()->count(),
                'claim.lines'
            );
    }

    public function test_duplicate_claim_is_rejected(): void
    {
        $this->seed();
        $this->authenticateAdmin();

        [, $sale, $membership] =
            $this->confirmedInsuranceContext();

        $payload = [
            'sale_id' => $sale->id,
            'customer_insurance_membership_id' =>
                $membership->id,
        ];

        $this->withTenant()
            ->postJson(
                '/api/v1/pharmaco/insurance/claims/from-sale',
                $payload
            )
            ->assertCreated();

        $this->withTenant()
            ->postJson(
                '/api/v1/pharmaco/insurance/claims/from-sale',
                $payload
            )
            ->assertStatus(409);

        $this->assertSame(
            1,
            InsuranceClaim::query()
                ->where(
                    'sale_id',
                    $sale->id
                )
                ->where(
                    'customer_insurance_membership_id',
                    $membership->id
                )
                ->count()
        );
    }

    public function test_draft_sale_cannot_generate_claim(): void
    {
        $this->seed();
        $this->authenticateAdmin();

        [, $sale, $membership] =
            $this->insuranceContext();

        $this->withTenant()
            ->postJson(
                '/api/v1/pharmaco/insurance/claims/from-sale',
                [
                    'sale_id' => $sale->id,
                    'customer_insurance_membership_id' =>
                        $membership->id,
                ]
            )
            ->assertStatus(422)
            ->assertJsonValidationErrors(
                'sale_id'
            );

        $this->assertDatabaseCount(
            'insurance_claims',
            0
        );
    }

    public function test_non_insurance_sale_cannot_generate_claim(): void
    {
        $this->seed();
        $this->authenticateAdmin();

        [, $sale, $membership] =
            $this->confirmedInsuranceContext();

        $sale->sale_type = 'cash_sale';
        $sale->save();

        $this->withTenant()
            ->postJson(
                '/api/v1/pharmaco/insurance/claims/from-sale',
                [
                    'sale_id' => $sale->id,
                    'customer_insurance_membership_id' =>
                        $membership->id,
                ]
            )
            ->assertStatus(422)
            ->assertJsonValidationErrors(
                'sale_id'
            );
    }

    public function test_ineligible_membership_cannot_generate_claim(): void
    {
        $this->seed();
        $this->authenticateAdmin();

        [, $sale, $membership] =
            $this->confirmedInsuranceContext();

        $membership->coverage_to =
            now()
                ->subDay()
                ->toDateString();

        $membership->save();

        $this->withTenant()
            ->postJson(
                '/api/v1/pharmaco/insurance/claims/from-sale',
                [
                    'sale_id' => $sale->id,
                    'customer_insurance_membership_id' =>
                        $membership->id,
                    'service_date' =>
                        now()->toDateString(),
                ]
            )
            ->assertStatus(422)
            ->assertJsonValidationErrors(
                'customer_insurance_membership_id'
            );

        $this->assertDatabaseCount(
            'insurance_claims',
            0
        );
    }

    public function test_membership_must_match_sale_customer(): void
    {
        $this->seed();
        $this->authenticateAdmin();

        [, $sale, $membership] =
            $this->confirmedInsuranceContext();

        $customer = PharmacoCustomer::query()
            ->create([
                'uuid' =>
                    (string) Str::uuid(),
                'tenant_id' =>
                    $sale->tenant_id,
                'first_name' =>
                    'Different',
                'last_name' =>
                    'Customer',
                'phone' =>
                    '+250788777777',
                'customer_type' =>
                    'patient',
                'status' => 'active',
            ]);

        $other = $membership->replicate();
        $other->uuid =
            (string) Str::uuid();
        $other->customer_id =
            $customer->id;
        $other->member_number =
            'OTHER-CLAIM-MEMBER';
        $other->save();

        $this->withTenant()
            ->postJson(
                '/api/v1/pharmaco/insurance/claims/from-sale',
                [
                    'sale_id' => $sale->id,
                    'customer_insurance_membership_id' =>
                        $other->id,
                ]
            )
            ->assertStatus(422)
            ->assertJsonValidationErrors(
                'customer_insurance_membership_id'
            );
    }

    public function test_cross_tenant_claim_is_not_accessible(): void
    {
        $this->seed();
        $this->authenticateAdmin();

        $vitaTenant = Tenant::query()
            ->where('slug', 'vitapharma')
            ->firstOrFail();

        app(
            InsuranceTenantBootstrapService::class
        )->bootstrap($vitaTenant);

        $sourcePartner =
            InsurancePartner::query()
                ->where(
                    'tenant_id',
                    $vitaTenant->id
                )
                ->firstOrFail();

        $otherTenant =
            Tenant::query()->create([
                'uuid' =>
                    (string) Str::uuid(),
                'name' =>
                    'Other Claim Tenant',
                'slug' =>
                    'other-claim-tenant',
                'legal_name' =>
                    'Other Claim Tenant Ltd',
                'tenant_type' =>
                    'pharmacy',
                'status' => 'active',
            ]);

        $partner =
            $sourcePartner->replicate();

        $partner->uuid =
            (string) Str::uuid();
        $partner->tenant_id =
            $otherTenant->id;
        $partner->code =
            'OTHER-CLAIM-PARTNER';
        $partner->save();

        $claim =
            InsuranceClaim::query()
                ->create([
                    'uuid' =>
                        (string) Str::uuid(),
                    'tenant_id' =>
                        $otherTenant->id,
                    'insurance_partner_id' =>
                        $partner->id,
                    'claim_number' =>
                        'OTHER-CLM-001',
                    'service_date' =>
                        now()->toDateString(),
                    'gross_amount' => 1000,
                    'customer_amount' => 100,
                    'claimed_amount' => 900,
                    'status' => 'draft',
                ]);

        $this->withTenant()
            ->getJson(
                "/api/v1/pharmaco/insurance/claims/{$claim->id}"
            )
            ->assertNotFound();
    }

    private function confirmedInsuranceContext(): array
    {
        [$tenant, $sale, $membership] =
            $this->insuranceContext();

        $payload = [
            'items' =>
                $sale->items
                    ->map(
                        function (
                            PharmacoSaleItem $item
                        ): array {
                            $batch =
                                StockBatch::query()
                                    ->where(
                                        'tenant_id',
                                        $item->tenant_id
                                    )
                                    ->where(
                                        'product_id',
                                        $item->product_id
                                    )
                                    ->where(
                                        'quantity_on_hand',
                                        '>',
                                        0
                                    )
                                    ->orderBy(
                                        'expiry_date'
                                    )
                                    ->orderBy('id')
                                    ->firstOrFail();

                            return [
                                'sale_item_id' =>
                                    $item->id,
                                'stock_batch_id' =>
                                    $batch->id,
                                'prescription_verified' =>
                                    (bool) $item
                                        ->prescription_verified,
                            ];
                        }
                    )
                    ->values()
                    ->all(),
        ];

        $this->withTenant()
            ->postJson(
                "/api/v1/pharmaco/sales/{$sale->id}/confirm",
                $payload
            )
            ->assertOk();

        return [
            $tenant,
            $sale->fresh([
                'items',
                'customer',
            ]),
            $membership->fresh([
                'partner',
                'scheme',
                'institution',
                'customer',
            ]),
        ];
    }

    private function insuranceContext(): array
    {
        $tenant = Tenant::query()
            ->where(
                'slug',
                'vitapharma'
            )
            ->firstOrFail();

        app(
            InsuranceTenantBootstrapService::class
        )->bootstrap($tenant);

        $sale = PharmacoSale::query()
            ->with([
                'items',
                'customer',
            ])
            ->where(
                'sale_number',
                'SALE-VITA-DRAFT-0001'
            )
            ->firstOrFail();

        if (!$sale->pharmaco_customer_id) {
            $customer =
                PharmacoCustomer::query()
                    ->where(
                        'tenant_id',
                        $tenant->id
                    )
                    ->where(
                        'status',
                        'active'
                    )
                    ->first();

            if (!$customer) {
                $customer =
                    PharmacoCustomer::query()
                        ->create([
                            'uuid' =>
                                (string) Str::uuid(),
                            'tenant_id' =>
                                $tenant->id,
                            'first_name' =>
                                'Insurance',
                            'last_name' =>
                                'Customer',
                            'phone' =>
                                '+250788700001',
                            'customer_type' =>
                                'patient',
                            'status' =>
                                'active',
                        ]);
            }

            $sale->pharmaco_customer_id =
                $customer->id;
        }

        $sale->sale_type =
            'insurance_sale';
        $sale->save();

        $partner =
            InsurancePartner::query()
                ->where(
                    'tenant_id',
                    $tenant->id
                )
                ->where(
                    'status',
                    'active'
                )
                ->firstOrFail();

        $scheme =
            InsuranceScheme::query()
                ->where(
                    'tenant_id',
                    $tenant->id
                )
                ->where(
                    'insurance_partner_id',
                    $partner->id
                )
                ->firstOrFail();

        $admin = User::query()
            ->where(
                'email',
                'admin@vitapharmaafrica.com'
            )
            ->firstOrFail();

        $membership =
            CustomerInsuranceMembership::query()
                ->create([
                    'uuid' =>
                        (string) Str::uuid(),
                    'tenant_id' =>
                        $tenant->id,
                    'customer_id' =>
                        $sale
                            ->pharmaco_customer_id,
                    'insurance_partner_id' =>
                        $partner->id,
                    'insurance_scheme_id' =>
                        $scheme->id,
                    'member_number' =>
                        'CLAIM-MEMBER-001',
                    'relationship_to_principal' =>
                        'self',
                    'coverage_from' =>
                        now()
                            ->subMonth()
                            ->toDateString(),
                    'coverage_to' =>
                        now()
                            ->addYear()
                            ->toDateString(),
                    'verification_status' =>
                        'verified',
                    'verified_at' => now(),
                    'verified_by' =>
                        $admin->id,
                    'status' => 'active',
                ]);

        return [
            $tenant,
            $sale->fresh([
                'items',
                'customer',
            ]),
            $membership,
        ];
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

    private function withTenant(): static
    {
        return $this->withHeader(
            'X-Tenant-Slug',
            'vitapharma'
        );
    }
}
