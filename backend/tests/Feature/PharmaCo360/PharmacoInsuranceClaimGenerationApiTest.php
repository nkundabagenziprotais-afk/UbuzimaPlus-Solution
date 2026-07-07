<?php

namespace Tests\Feature\PharmaCo360;

use App\Models\CustomerInsuranceMembership;
use App\Models\InsuranceClaim;
use App\Models\InsuranceReconciliationBatch;
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

    public function test_draft_claim_can_be_submitted(): void
    {
        $this->seed();
        $this->authenticateAdmin();

        [, $sale, $membership] = $this->confirmedInsuranceContext();

        $created = $this->withTenant()->postJson(
            '/api/v1/pharmaco/insurance/claims/from-sale',
            [
                'sale_id' => $sale->id,
                'customer_insurance_membership_id' => $membership->id,
            ]
        )->assertCreated();

        $claimId = $created->json('claim.id');

        $this->withTenant()->postJson(
            "/api/v1/pharmaco/insurance/claims/{$claimId}/submit",
            [
                'external_claim_reference' => 'RSSB-EXT-0001',
                'submission_channel' => 'manual_portal',
            ]
        )
            ->assertOk()
            ->assertJsonPath(
                'message',
                'Insurance claim submitted successfully.'
            )
            ->assertJsonPath(
                'claim.external_claim_reference',
                'RSSB-EXT-0001'
            );

        $claim = InsuranceClaim::with('lines')->findOrFail($claimId);

        $this->assertContains(
            $claim->status,
            ['submitted', 'submitted_with_exceptions']
        );
        $this->assertNotNull($claim->submitted_at);
        $this->assertNotEmpty($claim->submission_payload);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'pharmaco.insurance_claim.submitted',
            'auditable_type' => InsuranceClaim::class,
            'auditable_id' => $claim->id,
        ]);
    }

    public function test_submitted_claim_cannot_be_submitted_twice(): void
    {
        $this->seed();
        $this->authenticateAdmin();

        [, $sale, $membership] = $this->confirmedInsuranceContext();

        $created = $this->withTenant()->postJson(
            '/api/v1/pharmaco/insurance/claims/from-sale',
            [
                'sale_id' => $sale->id,
                'customer_insurance_membership_id' => $membership->id,
            ]
        )->assertCreated();

        $claimId = $created->json('claim.id');

        $this->withTenant()
            ->postJson(
                "/api/v1/pharmaco/insurance/claims/{$claimId}/submit",
                []
            )
            ->assertOk();

        $this->withTenant()
            ->postJson(
                "/api/v1/pharmaco/insurance/claims/{$claimId}/submit",
                []
            )
            ->assertStatus(409);
    }

    public function test_submitted_claim_can_be_fully_approved(): void
    {
        $this->seed();
        $this->authenticateAdmin();

        $claim = $this->createAndSubmitClaim();

        $payload = [
            'adjudication_reference' =>
                'ADJ-FULL-001',
            'decision_notes' =>
                'Approved in full.',
            'lines' => $claim->lines
                ->map(
                    fn ($line) => [
                        'insurance_claim_line_id' =>
                            $line->id,
                        'approved_amount' =>
                            (float) $line
                                ->claimed_amount,
                    ]
                )
                ->values()
                ->all(),
        ];

        $this->withTenant()
            ->postJson(
                "/api/v1/pharmaco/insurance/claims/{$claim->id}/adjudicate",
                $payload
            )
            ->assertOk()
            ->assertJsonPath(
                'message',
                'Insurance claim adjudicated successfully.'
            )
            ->assertJsonPath(
                'claim.status',
                'approved'
            );

        $claim->refresh();

        $this->assertSame(
            round(
                (float) $claim->claimed_amount,
                2
            ),
            round(
                (float) $claim->approved_amount,
                2
            )
        );

        $this->assertSame(
            0.0,
            round(
                (float) $claim->rejected_amount,
                2
            )
        );

        $this->assertNotNull(
            $claim->adjudicated_at
        );

        $this->assertDatabaseHas(
            'audit_logs',
            [
                'action' =>
                    'pharmaco.insurance_claim.adjudicated',
                'auditable_type' =>
                    InsuranceClaim::class,
                'auditable_id' =>
                    $claim->id,
            ]
        );
    }

    public function test_submitted_claim_can_be_partially_approved(): void
    {
        $this->seed();
        $this->authenticateAdmin();

        $claim = $this->createAndSubmitClaim();

        $payload = [
            'adjudication_reference' =>
                'ADJ-PARTIAL-001',
            'decision_notes' =>
                'Partially approved after insurer review.',
            'lines' => $claim->lines
                ->map(
                    fn ($line) => [
                        'insurance_claim_line_id' =>
                            $line->id,
                        'approved_amount' =>
                            round(
                                (float) $line
                                    ->claimed_amount
                                / 2,
                                2
                            ),
                        'rejection_code' =>
                            'PARTIAL_LIMIT',
                        'rejection_reason' =>
                            'Insurer benefit limit applied.',
                    ]
                )
                ->values()
                ->all(),
        ];

        $this->withTenant()
            ->postJson(
                "/api/v1/pharmaco/insurance/claims/{$claim->id}/adjudicate",
                $payload
            )
            ->assertOk()
            ->assertJsonPath(
                'claim.status',
                'partially_approved'
            );

        $claim->refresh();

        $this->assertGreaterThan(
            0,
            (float) $claim->approved_amount
        );

        $this->assertGreaterThan(
            0,
            (float) $claim->rejected_amount
        );

        $this->assertSame(
            round(
                (float) $claim->claimed_amount,
                2
            ),
            round(
                (float) $claim->approved_amount
                + (float) $claim->rejected_amount,
                2
            )
        );
    }

    public function test_adjudicated_claim_cannot_be_adjudicated_twice(): void
    {
        $this->seed();
        $this->authenticateAdmin();

        $claim = $this->createAndSubmitClaim();

        $payload = [
            'lines' => $claim->lines
                ->map(
                    fn ($line) => [
                        'insurance_claim_line_id' =>
                            $line->id,
                        'approved_amount' =>
                            (float) $line
                                ->claimed_amount,
                    ]
                )
                ->values()
                ->all(),
        ];

        $this->withTenant()
            ->postJson(
                "/api/v1/pharmaco/insurance/claims/{$claim->id}/adjudicate",
                $payload
            )
            ->assertOk();

        $this->withTenant()
            ->postJson(
                "/api/v1/pharmaco/insurance/claims/{$claim->id}/adjudicate",
                $payload
            )
            ->assertStatus(409);
    }

    public function test_fully_approved_claim_can_receive_full_payment(): void
    {
        $this->seed();
        $this->authenticateAdmin();

        $claim = $this->createAndApproveClaim();

        $this->withTenant()
            ->postJson(
                "/api/v1/pharmaco/insurance/claims/{$claim->id}/payments",
                [
                    'payment_reference' =>
                        'INS-PAY-FULL-001',
                    'payment_date' =>
                        now()->toDateString(),
                    'amount' =>
                        (float) $claim
                            ->approved_amount,
                    'payment_method' =>
                        'bank_transfer',
                    'bank_reference' =>
                        'BANK-FULL-001',
                ]
            )
            ->assertCreated()
            ->assertJsonPath(
                'message',
                'Insurance claim payment recorded successfully.'
            )
            ->assertJsonPath(
                'claim.status',
                'paid'
            );

        $claim->refresh();

        $this->assertSame(
            round(
                (float) $claim
                    ->approved_amount,
                2
            ),
            round(
                (float) $claim
                    ->paid_amount,
                2
            )
        );

        $this->assertDatabaseHas(
            'insurance_payments',
            [
                'tenant_id' =>
                    $claim->tenant_id,
                'insurance_partner_id' =>
                    $claim
                        ->insurance_partner_id,
                'payment_reference' =>
                    'INS-PAY-FULL-001',
                'status' => 'allocated',
            ]
        );

        $this->assertDatabaseHas(
            'audit_logs',
            [
                'action' =>
                    'pharmaco.insurance_claim.payment_recorded',
                'auditable_type' =>
                    InsuranceClaim::class,
                'auditable_id' =>
                    $claim->id,
            ]
        );
    }

    public function test_approved_claim_can_receive_partial_then_final_payment(): void
    {
        $this->seed();
        $this->authenticateAdmin();

        $claim = $this->createAndApproveClaim();

        $firstAmount = round(
            (float) $claim->approved_amount
            / 2,
            2
        );

        $this->withTenant()
            ->postJson(
                "/api/v1/pharmaco/insurance/claims/{$claim->id}/payments",
                [
                    'payment_reference' =>
                        'INS-PAY-PART-001',
                    'payment_date' =>
                        now()->toDateString(),
                    'amount' => $firstAmount,
                ]
            )
            ->assertCreated()
            ->assertJsonPath(
                'claim.status',
                'partially_paid'
            );

        $claim->refresh();

        $remainingAmount = round(
            (float) $claim->approved_amount
            - (float) $claim->paid_amount,
            2
        );

        $this->withTenant()
            ->postJson(
                "/api/v1/pharmaco/insurance/claims/{$claim->id}/payments",
                [
                    'payment_reference' =>
                        'INS-PAY-PART-002',
                    'payment_date' =>
                        now()->toDateString(),
                    'amount' =>
                        $remainingAmount,
                ]
            )
            ->assertCreated()
            ->assertJsonPath(
                'claim.status',
                'paid'
            );

        $claim->refresh();

        $this->assertSame(
            round(
                (float) $claim->approved_amount,
                2
            ),
            round(
                (float) $claim->paid_amount,
                2
            )
        );
    }

    public function test_claim_payment_cannot_exceed_remaining_approved_amount(): void
    {
        $this->seed();
        $this->authenticateAdmin();

        $claim = $this->createAndApproveClaim();

        $this->withTenant()
            ->postJson(
                "/api/v1/pharmaco/insurance/claims/{$claim->id}/payments",
                [
                    'payment_reference' =>
                        'INS-PAY-OVER-001',
                    'payment_date' =>
                        now()->toDateString(),
                    'amount' =>
                        round(
                            (float) $claim
                                ->approved_amount
                            + 1,
                            2
                        ),
                ]
            )
            ->assertStatus(422);

        $claim->refresh();

        $this->assertSame(
            0.0,
            round(
                (float) $claim->paid_amount,
                2
            )
        );

        $this->assertDatabaseMissing(
            'insurance_payments',
            [
                'payment_reference' =>
                    'INS-PAY-OVER-001',
            ]
        );
    }

    public function test_admin_can_create_and_submit_reconciliation_batch(): void
    {
        $this->seed();
        $this->authenticateAdmin();

        $claim = $this->createAndApproveClaim();

        $response = $this->withTenant()
            ->postJson(
                '/api/v1/pharmaco/insurance/reconciliation-batches',
                [
                    'insurance_partner_id' =>
                        $claim->insurance_partner_id,
                    'batch_number' =>
                        'REC-BATCH-001',
                    'period_from' =>
                        $claim->service_date->toDateString(),
                    'period_to' =>
                        $claim->service_date->toDateString(),
                    'claim_ids' => [$claim->id],
                    'notes' =>
                        'Monthly insurer reconciliation.',
                ]
            )
            ->assertCreated()
            ->assertJsonPath(
                'message',
                'Insurance reconciliation batch created successfully.'
            )
            ->assertJsonPath(
                'batch.status',
                'draft'
            )
            ->assertJsonPath(
                'batch.claim_count',
                1
            );

        $batchId = $response->json('batch.id');

        $this->withTenant()
            ->getJson(
                '/api/v1/pharmaco/insurance/reconciliation-batches'
            )
            ->assertOk();

        $this->withTenant()
            ->getJson(
                "/api/v1/pharmaco/insurance/reconciliation-batches/{$batchId}"
            )
            ->assertOk()
            ->assertJsonPath(
                'batch.batch_number',
                'REC-BATCH-001'
            );

        $this->withTenant()
            ->postJson(
                "/api/v1/pharmaco/insurance/reconciliation-batches/{$batchId}/submit"
            )
            ->assertOk()
            ->assertJsonPath(
                'batch.status',
                'submitted'
            );

        $batch = InsuranceReconciliationBatch::query()
            ->findOrFail($batchId);

        $this->assertNotNull($batch->submitted_at);

        $this->assertDatabaseHas(
            'audit_logs',
            [
                'action' =>
                    'pharmaco.insurance_reconciliation_batch.created',
                'auditable_type' =>
                    InsuranceReconciliationBatch::class,
                'auditable_id' =>
                    $batch->id,
            ]
        );

        $this->assertDatabaseHas(
            'audit_logs',
            [
                'action' =>
                    'pharmaco.insurance_reconciliation_batch.submitted',
                'auditable_type' =>
                    InsuranceReconciliationBatch::class,
                'auditable_id' =>
                    $batch->id,
            ]
        );
    }

    public function test_reconciliation_batch_rejects_ineligible_claim(): void
    {
        $this->seed();
        $this->authenticateAdmin();

        $claim = $this->createAndSubmitClaim();

        $this->withTenant()
            ->postJson(
                '/api/v1/pharmaco/insurance/reconciliation-batches',
                [
                    'insurance_partner_id' =>
                        $claim->insurance_partner_id,
                    'batch_number' =>
                        'REC-BATCH-INVALID-001',
                    'period_from' =>
                        $claim->service_date->toDateString(),
                    'period_to' =>
                        $claim->service_date->toDateString(),
                    'claim_ids' => [$claim->id],
                ]
            )
            ->assertStatus(422);
    }

    public function test_submitted_batch_can_be_fully_reconciled(): void
    {
        $this->seed();
        $this->authenticateAdmin();

        $claim = $this->createAndApproveClaim();

        $paymentResponse = $this->withTenant()
            ->postJson(
                "/api/v1/pharmaco/insurance/claims/{$claim->id}/payments",
                [
                    'payment_reference' =>
                        'INS-REC-PAY-001',
                    'payment_date' =>
                        now()->toDateString(),
                    'amount' =>
                        (float) $claim->approved_amount,
                ]
            )
            ->assertCreated();

        $paymentId = $paymentResponse->json('payment.id');

        $batchResponse = $this->withTenant()
            ->postJson(
                '/api/v1/pharmaco/insurance/reconciliation-batches',
                [
                    'insurance_partner_id' =>
                        $claim->insurance_partner_id,
                    'batch_number' =>
                        'REC-FULL-001',
                    'period_from' =>
                        $claim->service_date->toDateString(),
                    'period_to' =>
                        $claim->service_date->toDateString(),
                    'claim_ids' => [$claim->id],
                ]
            )
            ->assertCreated();

        $batchId = $batchResponse->json('batch.id');

        $this->withTenant()
            ->postJson(
                "/api/v1/pharmaco/insurance/reconciliation-batches/{$batchId}/submit"
            )
            ->assertOk();

        $this->withTenant()
            ->postJson(
                "/api/v1/pharmaco/insurance/reconciliation-batches/{$batchId}/reconcile",
                [
                    'payment_ids' => [$paymentId],
                    'notes' =>
                        'Full batch reconciliation.',
                ]
            )
            ->assertOk()
            ->assertJsonPath(
                'message',
                'Insurance reconciliation batch processed successfully.'
            )
            ->assertJsonPath(
                'batch.status',
                'reconciled'
            );

        $this->assertDatabaseHas(
            'insurance_payments',
            [
                'id' => $paymentId,
                'insurance_reconciliation_batch_id' =>
                    $batchId,
            ]
        );

        $this->assertDatabaseHas(
            'audit_logs',
            [
                'action' =>
                    'pharmaco.insurance_reconciliation_batch.reconciled',
                'auditable_type' =>
                    InsuranceReconciliationBatch::class,
                'auditable_id' =>
                    $batchId,
            ]
        );
    }

    public function test_batch_lists_only_eligible_reconciliation_payments(): void
    {
        $this->seed();
        $this->authenticateAdmin();

        $claim = $this->createAndApproveClaim();

        $paymentResponse = $this->withTenant()
            ->postJson(
                "/api/v1/pharmaco/insurance/claims/{$claim->id}/payments",
                [
                    'payment_reference' =>
                        'INS-ELIGIBLE-PAY-001',
                    'payment_date' =>
                        now()->toDateString(),
                    'amount' =>
                        (float) $claim->approved_amount,
                ]
            )
            ->assertCreated();

        $paymentId = $paymentResponse->json('payment.id');

        $batchResponse = $this->withTenant()
            ->postJson(
                '/api/v1/pharmaco/insurance/reconciliation-batches',
                [
                    'insurance_partner_id' =>
                        $claim->insurance_partner_id,
                    'batch_number' =>
                        'REC-ELIGIBLE-PAY-001',
                    'period_from' =>
                        $claim->service_date->toDateString(),
                    'period_to' =>
                        $claim->service_date->toDateString(),
                    'claim_ids' => [$claim->id],
                ]
            )
            ->assertCreated();

        $batchId = $batchResponse->json('batch.id');

        $this->withTenant()
            ->getJson(
                "/api/v1/pharmaco/insurance/reconciliation-batches/{$batchId}/eligible-payments"
            )
            ->assertOk()
            ->assertJsonPath('payments.0.id', $paymentId)
            ->assertJsonPath(
                'payments.0.payment_reference',
                'INS-ELIGIBLE-PAY-001'
            )
            ->assertJsonPath(
                'payments.0.insurance_claim_id',
                $claim->id
            );
    }

    public function test_batch_rejects_payment_for_claim_outside_batch(): void
    {
        $this->seed();
        $this->authenticateAdmin();

        $claimOne = $this->createAndApproveClaim();
        $claimTwo = $this->createAndApproveClaim();

        $paymentResponse = $this->withTenant()
            ->postJson(
                "/api/v1/pharmaco/insurance/claims/{$claimTwo->id}/payments",
                [
                    'payment_reference' =>
                        'INS-REC-PAY-OUTSIDE-001',
                    'payment_date' =>
                        now()->toDateString(),
                    'amount' =>
                        (float) $claimTwo->approved_amount,
                ]
            )
            ->assertCreated();

        $paymentId = $paymentResponse->json('payment.id');

        $batchResponse = $this->withTenant()
            ->postJson(
                '/api/v1/pharmaco/insurance/reconciliation-batches',
                [
                    'insurance_partner_id' =>
                        $claimOne->insurance_partner_id,
                    'batch_number' =>
                        'REC-OUTSIDE-001',
                    'period_from' =>
                        $claimOne->service_date->toDateString(),
                    'period_to' =>
                        $claimOne->service_date->toDateString(),
                    'claim_ids' => [$claimOne->id],
                ]
            )
            ->assertCreated();

        $batchId = $batchResponse->json('batch.id');

        $this->withTenant()
            ->postJson(
                "/api/v1/pharmaco/insurance/reconciliation-batches/{$batchId}/submit"
            )
            ->assertOk();

        $this->withTenant()
            ->postJson(
                "/api/v1/pharmaco/insurance/reconciliation-batches/{$batchId}/reconcile",
                [
                    'payment_ids' => [$paymentId],
                ]
            )
            ->assertStatus(422);

        $this->assertDatabaseHas(
            'insurance_payments',
            [
                'id' => $paymentId,
                'insurance_reconciliation_batch_id' =>
                    null,
            ]
        );
    }

    private function createAndApproveClaim(): InsuranceClaim
    {
        $claim = $this->createAndSubmitClaim();

        $payload = [
            'adjudication_reference' =>
                'AUTO-APPROVE-001',
            'lines' => $claim->lines
                ->map(
                    fn ($line) => [
                        'insurance_claim_line_id' =>
                            $line->id,
                        'approved_amount' =>
                            (float) $line
                                ->claimed_amount,
                    ]
                )
                ->values()
                ->all(),
        ];

        $this->withTenant()
            ->postJson(
                "/api/v1/pharmaco/insurance/claims/{$claim->id}/adjudicate",
                $payload
            )
            ->assertOk();

        return InsuranceClaim::query()
            ->with('lines')
            ->findOrFail($claim->id);
    }

    private function createAndSubmitClaim(): InsuranceClaim
    {
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

        $claimId = $created->json('claim.id');

        $this->withTenant()
            ->postJson(
                "/api/v1/pharmaco/insurance/claims/{$claimId}/submit",
                []
            )
            ->assertOk();

        return InsuranceClaim::query()
            ->with('lines')
            ->findOrFail($claimId);
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

        if (
            $sale->status !== 'draft'
            || (bool) data_get(
                $sale->metadata,
                'stock_deducted',
                false
            )
        ) {
            $sourceSale = $sale;

            $sale = $sourceSale->replicate([
                'uuid',
                'sale_number',
                'status',
                'paid_amount',
                'balance_amount',
                'payment_status',
                'sold_at',
                'metadata',
                'created_at',
                'updated_at',
            ]);

            $sale->uuid = (string) Str::uuid();
            $sale->sale_number =
                'SALE-CLAIM-' .
                Str::upper(Str::random(10));
            $sale->status = 'draft';
            $sale->paid_amount = 0;
            $sale->balance_amount =
                $sourceSale->total_amount;
            $sale->payment_status = 'unpaid';
            $sale->sold_at = null;
            $sale->metadata = null;
            $sale->save();

            foreach ($sourceSale->items as $sourceItem) {
                $item = $sourceItem->replicate([
                    'uuid',
                    'pharmaco_sale_id',
                    'stock_batch_id',
                    'stock_location_id',
                    'status',
                    'metadata',
                    'created_at',
                    'updated_at',
                ]);

                $item->uuid = (string) Str::uuid();
                $item->pharmaco_sale_id = $sale->id;
                $item->stock_batch_id = null;
                $item->stock_location_id = null;
                $item->status = 'pending';
                $item->metadata = null;
                $item->save();
            }

            $sale->load([
                'items',
                'customer',
            ]);
        }

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
                        'CLAIM-MEMBER-' .
                        Str::upper(Str::random(8)),
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
