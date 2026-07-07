<?php

namespace App\Http\Controllers\Api\V1\PharmaCo360;

use App\Http\Controllers\Controller;
use App\Models\CustomerInsuranceMembership;
use App\Models\InsuranceClaim;
use App\Models\InsurancePayment;
use App\Models\PharmacoSale;
use App\Services\Access\ScopeResolver;
use App\Services\Audit\AuditLogService;
use App\Services\PharmaCo360\InsuranceClaimGenerationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class InsuranceClaimController extends Controller
{
    public function claims(
        Request $request
    ): JsonResponse {
        $tenant = $request->attributes->get('tenant');

        $perPage = min(
            max(
                (int) $request->query(
                    'per_page',
                    25
                ),
                1
            ),
            200
        );

        $claims = InsuranceClaim::query()
            ->with([
                'partner',
                'scheme',
                'membership.customer',
                'sale.branch',
                'sale.customer',
            ])
            ->withCount('lines')
            ->where('tenant_id', $tenant->id)
            ->when(
                $request->query('status'),
                fn ($query, $status) =>
                    $status === 'all'
                        ? $query
                        : $query->where(
                            'status',
                            $status
                        )
            )
            ->when(
                $request->query(
                    'insurance_partner_id'
                ),
                fn ($query, $partnerId) =>
                    $query->where(
                        'insurance_partner_id',
                        $partnerId
                    )
            )
            ->when(
                $request->query('sale_id'),
                fn ($query, $saleId) =>
                    $query->where(
                        'sale_id',
                        $saleId
                    )
            )
            ->when(
                $request->query('search'),
                function ($query, $search): void {
                    $term =
                        '%' .
                        trim((string) $search) .
                        '%';

                    $query->where(
                        function ($inner) use (
                            $term
                        ): void {
                            $inner
                                ->where(
                                    'claim_number',
                                    'like',
                                    $term
                                )
                                ->orWhereHas(
                                    'sale',
                                    fn ($saleQuery) =>
                                        $saleQuery
                                            ->where(
                                                'sale_number',
                                                'like',
                                                $term
                                            )
                                )
                                ->orWhereHas(
                                    'membership',
                                    fn (
                                        $membershipQuery
                                    ) =>
                                        $membershipQuery
                                            ->where(
                                                'member_number',
                                                'like',
                                                $term
                                            )
                                );
                        }
                    );
                }
            )
            ->latest('id')
            ->paginate($perPage);

        return response()->json([
            'tenant' =>
                $this->tenantPayload($tenant),
            'claims' =>
                collect($claims->items())
                    ->map(
                        fn (
                            InsuranceClaim $claim
                        ) =>
                            $this->serializeClaim(
                                $claim
                            )
                    )
                    ->values(),
            'meta' =>
                $this->paginationPayload(
                    $claims
                ),
        ]);
    }

    public function claim(
        Request $request,
        InsuranceClaim $insuranceClaim
    ): JsonResponse {
        $tenant = $request->attributes->get('tenant');

        abort_unless(
            (int) $insuranceClaim->tenant_id ===
                (int) $tenant->id,
            404
        );

        $insuranceClaim->load([
            'partner',
            'scheme',
            'membership.customer',
            'sale.branch',
            'sale.customer',
            'lines.product',
            'lines.saleItem',
        ]);

        return response()->json([
            'tenant' =>
                $this->tenantPayload($tenant),
            'claim' => $this->serializeClaim(
                $insuranceClaim,
                true
            ),
        ]);
    }

    public function createFromSale(
        Request $request,
        InsuranceClaimGenerationService $service,
        AuditLogService $auditLogService,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        $tenant = $request->attributes->get('tenant');

        $validated = $request->validate([
            'sale_id' => [
                'required',
                'integer',
                Rule::exists(
                    'pharmaco_sales',
                    'id'
                )->where(
                    fn ($query) =>
                        $query->where(
                            'tenant_id',
                            $tenant->id
                        )
                ),
            ],
            'customer_insurance_membership_id' => [
                'required',
                'integer',
                Rule::exists(
                    'customer_insurance_memberships',
                    'id'
                )->where(
                    fn ($query) =>
                        $query->where(
                            'tenant_id',
                            $tenant->id
                        )
                ),
            ],
            'service_date' => [
                'nullable',
                'date',
            ],
        ]);

        $sale = PharmacoSale::query()
            ->where(
                'tenant_id',
                $tenant->id
            )
            ->findOrFail(
                $validated['sale_id']
            );

        $membership =
            CustomerInsuranceMembership::query()
                ->where(
                    'tenant_id',
                    $tenant->id
                )
                ->findOrFail(
                    $validated[
                        'customer_insurance_membership_id'
                    ]
                );

        $claim = $service->generateDraft(
            tenantId: $tenant->id,
            sale: $sale,
            membership: $membership,
            serviceDate:
                $validated['service_date']
                ?? null,
            generatedBy:
                $request->user()->id
        );

        $scope = $scopeResolver->resolveForUser(
            $request->user()
        );

        $auditLogService->record(
            action:
                'pharmaco.insurance_claim.created',
            scope: $scope,
            metadata: [
                'tenant_slug' => $tenant->slug,
                'claim_id' => $claim->id,
                'claim_number' =>
                    $claim->claim_number,
                'sale_id' => $claim->sale_id,
                'sale_number' =>
                    $claim->sale?->sale_number,
                'membership_id' =>
                    $claim
                        ->customer_insurance_membership_id,
                'member_number' =>
                    $claim->membership
                        ?->member_number,
                'gross_amount' =>
                    (float) $claim->gross_amount,
                'customer_amount' =>
                    (float) $claim
                        ->customer_amount,
                'claimed_amount' =>
                    (float) $claim
                        ->claimed_amount,
                'line_count' =>
                    $claim->lines->count(),
            ],
            dataClassification: 'confidential',
            auditableType: InsuranceClaim::class,
            auditableId: $claim->id
        );

        return response()->json([
            'message' =>
                'Draft insurance claim generated successfully.',
            'tenant' =>
                $this->tenantPayload($tenant),
            'claim' => $this->serializeClaim(
                $claim,
                true
            ),
        ], 201);
    }

    public function submitClaim(
        Request $request,
        InsuranceClaim $insuranceClaim,
        AuditLogService $auditLogService,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        $tenant = $request->attributes->get('tenant');

        abort_unless(
            (int) $insuranceClaim->tenant_id === (int) $tenant->id,
            404
        );

        $validated = $request->validate([
            'external_claim_reference' => ['nullable', 'string', 'max:255'],
            'submission_channel' => ['nullable', 'string', 'max:100'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'submission_payload' => ['nullable', 'array'],
        ]);

        $claim = DB::transaction(function () use (
            $request,
            $tenant,
            $insuranceClaim,
            $validated
        ): InsuranceClaim {
            $lockedClaim = InsuranceClaim::query()
                ->where('tenant_id', $tenant->id)
                ->lockForUpdate()
                ->findOrFail($insuranceClaim->id);

            if ($lockedClaim->status !== 'draft') {
                abort(409, 'Only a draft insurance claim can be submitted.');
            }

            $lockedClaim->load([
                'partner',
                'scheme',
                'membership.customer',
                'sale.branch',
                'sale.customer',
                'lines.product',
                'lines.saleItem',
            ]);

            if ($lockedClaim->lines->isEmpty()) {
                abort(409, 'An insurance claim without claim lines cannot be submitted.');
            }

            $blockedLines = $lockedClaim->lines->filter(
                fn ($line) => in_array(
                    $line->status,
                    ['preauthorization_required', 'not_covered'],
                    true
                )
            );

            $submissionPayload = array_merge([
                'claim_number' => $lockedClaim->claim_number,
                'service_date' => $lockedClaim->service_date?->toDateString(),
                'partner' => [
                    'id' => $lockedClaim->insurance_partner_id,
                    'code' => $lockedClaim->partner?->code,
                    'name' => $lockedClaim->partner?->name,
                ],
                'scheme' => $lockedClaim->scheme ? [
                    'id' => $lockedClaim->scheme->id,
                    'code' => $lockedClaim->scheme->code,
                    'name' => $lockedClaim->scheme->name,
                ] : null,
                'membership' => [
                    'id' => $lockedClaim->customer_insurance_membership_id,
                    'member_number' => $lockedClaim->membership?->member_number,
                ],
                'sale' => [
                    'id' => $lockedClaim->sale_id,
                    'sale_number' => $lockedClaim->sale?->sale_number,
                ],
                'amounts' => [
                    'gross_amount' => (float) $lockedClaim->gross_amount,
                    'customer_amount' => (float) $lockedClaim->customer_amount,
                    'claimed_amount' => (float) $lockedClaim->claimed_amount,
                ],
                'lines' => $lockedClaim->lines->map(
                    fn ($line) => [
                        'id' => $line->id,
                        'product_id' => $line->product_id,
                        'description' => $line->description,
                        'quantity' => (float) $line->quantity,
                        'unit_price' => (float) $line->unit_price,
                        'gross_amount' => (float) $line->gross_amount,
                        'customer_amount' => (float) $line->customer_amount,
                        'claimed_amount' => (float) $line->claimed_amount,
                        'status' => $line->status,
                    ]
                )->values()->all(),
                'submission_channel' => $validated['submission_channel'] ?? 'manual',
                'submitted_by' => $request->user()->id,
                'submitted_at' => now()->toISOString(),
                'notes' => $validated['notes'] ?? null,
            ], $validated['submission_payload'] ?? []);

            $lockedClaim->external_claim_reference =
                $validated['external_claim_reference']
                ?? $lockedClaim->external_claim_reference;
            $lockedClaim->submission_payload = $submissionPayload;
            $lockedClaim->submitted_at = now();
            $lockedClaim->status = $blockedLines->isEmpty()
                ? 'submitted'
                : 'submitted_with_exceptions';
            $lockedClaim->metadata = [
                ...($lockedClaim->metadata ?? []),
                'submission_workflow' => 'phase_4f1c_claim_submission',
                'submission_channel' => $validated['submission_channel'] ?? 'manual',
                'submitted_by' => $request->user()->id,
                'submitted_at' => now()->toISOString(),
                'exception_line_count' => $blockedLines->count(),
            ];
            $lockedClaim->save();

            $lockedClaim->lines()
                ->where('status', 'pending')
                ->update([
                    'status' => 'submitted',
                    'updated_at' => now(),
                ]);

            return $lockedClaim->fresh([
                'partner',
                'scheme',
                'membership.customer',
                'sale.branch',
                'sale.customer',
                'lines.product',
                'lines.saleItem',
            ]);
        });

        $scope = $scopeResolver->resolveForUser($request->user());

        $auditLogService->record(
            action: 'pharmaco.insurance_claim.submitted',
            scope: $scope,
            metadata: [
                'tenant_slug' => $tenant->slug,
                'claim_id' => $claim->id,
                'claim_number' => $claim->claim_number,
                'external_claim_reference' => $claim->external_claim_reference,
                'status' => $claim->status,
                'submitted_at' => $claim->submitted_at?->toISOString(),
                'claimed_amount' => (float) $claim->claimed_amount,
                'line_count' => $claim->lines->count(),
            ],
            dataClassification: 'confidential',
            auditableType: InsuranceClaim::class,
            auditableId: $claim->id
        );

        return response()->json([
            'message' => 'Insurance claim submitted successfully.',
            'tenant' => $this->tenantPayload($tenant),
            'claim' => $this->serializeClaim($claim, true),
        ]);
    }

    public function adjudicateClaim(
        Request $request,
        InsuranceClaim $insuranceClaim,
        AuditLogService $auditLogService,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        $tenant = $request->attributes->get('tenant');

        abort_unless(
            (int) $insuranceClaim->tenant_id ===
                (int) $tenant->id,
            404
        );

        $validated = $request->validate([
            'adjudication_reference' => [
                'nullable',
                'string',
                'max:255',
            ],
            'decision_notes' => [
                'nullable',
                'string',
                'max:2000',
            ],
            'response_payload' => [
                'nullable',
                'array',
            ],
            'lines' => [
                'required',
                'array',
                'min:1',
            ],
            'lines.*.insurance_claim_line_id' => [
                'required',
                'integer',
            ],
            'lines.*.approved_amount' => [
                'required',
                'numeric',
                'min:0',
            ],
            'lines.*.rejection_code' => [
                'nullable',
                'string',
                'max:100',
            ],
            'lines.*.rejection_reason' => [
                'nullable',
                'string',
                'max:1000',
            ],
        ]);

        $claim = DB::transaction(function () use (
            $request,
            $tenant,
            $insuranceClaim,
            $validated
        ): InsuranceClaim {
            $lockedClaim = InsuranceClaim::query()
                ->where('tenant_id', $tenant->id)
                ->lockForUpdate()
                ->findOrFail($insuranceClaim->id);

            if (!in_array(
                $lockedClaim->status,
                ['submitted', 'submitted_with_exceptions'],
                true
            )) {
                abort(
                    409,
                    'Only a submitted insurance claim can be adjudicated.'
                );
            }

            $lockedClaim->load([
                'partner',
                'scheme',
                'membership.customer',
                'sale.branch',
                'sale.customer',
                'lines.product',
                'lines.saleItem',
            ]);

            $submittedLines = collect($validated['lines']);
            $submittedIds = $submittedLines
                ->pluck('insurance_claim_line_id')
                ->map(fn ($id) => (int) $id);

            if ($submittedIds->duplicates()->isNotEmpty()) {
                abort(
                    422,
                    'Each insurance claim line may be adjudicated only once per response.'
                );
            }

            $claimLineIds = $lockedClaim->lines
                ->pluck('id')
                ->map(fn ($id) => (int) $id);

            if (
                $submittedIds->count() !== $claimLineIds->count()
                || $submittedIds->diff($claimLineIds)->isNotEmpty()
                || $claimLineIds->diff($submittedIds)->isNotEmpty()
            ) {
                abort(
                    422,
                    'The adjudication response must include every claim line exactly once.'
                );
            }

            $lineResponses = [];

            foreach ($submittedLines as $lineDecision) {
                $line = $lockedClaim->lines->firstWhere(
                    'id',
                    (int) $lineDecision[
                        'insurance_claim_line_id'
                    ]
                );

                $claimedAmount = round(
                    (float) $line->claimed_amount,
                    2
                );

                $approvedAmount = round(
                    (float) $lineDecision[
                        'approved_amount'
                    ],
                    2
                );

                if ($approvedAmount > $claimedAmount) {
                    abort(
                        422,
                        "Approved amount cannot exceed claimed amount for claim line {$line->id}."
                    );
                }

                $rejectedAmount = round(
                    $claimedAmount - $approvedAmount,
                    2
                );

                if ($approvedAmount <= 0) {
                    $lineStatus = 'rejected';
                } elseif ($rejectedAmount <= 0) {
                    $lineStatus = 'approved';
                } else {
                    $lineStatus = 'partially_approved';
                }

                $line->forceFill([
                    'approved_amount' => $approvedAmount,
                    'rejected_amount' => $rejectedAmount,
                    'status' => $lineStatus,
                    'rejection_code' =>
                        $lineDecision['rejection_code']
                        ?? null,
                    'rejection_reason' =>
                        $lineDecision['rejection_reason']
                        ?? null,
                    'metadata' => [
                        ...($line->metadata ?? []),
                        'adjudication' => [
                            'approved_amount' =>
                                $approvedAmount,
                            'rejected_amount' =>
                                $rejectedAmount,
                            'status' => $lineStatus,
                            'rejection_code' =>
                                $lineDecision[
                                    'rejection_code'
                                ] ?? null,
                            'rejection_reason' =>
                                $lineDecision[
                                    'rejection_reason'
                                ] ?? null,
                            'adjudicated_by' =>
                                $request->user()->id,
                            'adjudicated_at' =>
                                now()->toISOString(),
                        ],
                    ],
                ])->save();

                $lineResponses[] = [
                    'insurance_claim_line_id' =>
                        $line->id,
                    'claimed_amount' =>
                        $claimedAmount,
                    'approved_amount' =>
                        $approvedAmount,
                    'rejected_amount' =>
                        $rejectedAmount,
                    'status' => $lineStatus,
                    'rejection_code' =>
                        $line->rejection_code,
                    'rejection_reason' =>
                        $line->rejection_reason,
                ];
            }

            $approvedTotal = round(
                $lockedClaim->lines()
                    ->sum('approved_amount'),
                2
            );

            $rejectedTotal = round(
                $lockedClaim->lines()
                    ->sum('rejected_amount'),
                2
            );

            if ($approvedTotal <= 0) {
                $claimStatus = 'rejected';
            } elseif ($rejectedTotal <= 0) {
                $claimStatus = 'approved';
            } else {
                $claimStatus = 'partially_approved';
            }

            $adjudicationResponse = array_merge([
                'adjudication_reference' =>
                    $validated[
                        'adjudication_reference'
                    ] ?? null,
                'decision_notes' =>
                    $validated['decision_notes']
                    ?? null,
                'decision' => $claimStatus,
                'claimed_amount' =>
                    (float) $lockedClaim
                        ->claimed_amount,
                'approved_amount' =>
                    $approvedTotal,
                'rejected_amount' =>
                    $rejectedTotal,
                'lines' => $lineResponses,
                'adjudicated_by' =>
                    $request->user()->id,
                'adjudicated_at' =>
                    now()->toISOString(),
            ], $validated['response_payload'] ?? []);

            $lockedClaim->forceFill([
                'approved_amount' => $approvedTotal,
                'rejected_amount' => $rejectedTotal,
                'adjudicated_at' => now(),
                'status' => $claimStatus,
                'rejection_reason' =>
                    $claimStatus === 'rejected'
                        ? (
                            $validated[
                                'decision_notes'
                            ] ?? 'Claim rejected by insurer.'
                        )
                        : null,
                'adjudication_response' =>
                    $adjudicationResponse,
                'metadata' => [
                    ...($lockedClaim->metadata ?? []),
                    'adjudication_workflow' =>
                        'phase_4f1d_claim_adjudication',
                    'adjudication_reference' =>
                        $validated[
                            'adjudication_reference'
                        ] ?? null,
                    'adjudicated_by' =>
                        $request->user()->id,
                    'adjudicated_at' =>
                        now()->toISOString(),
                ],
            ])->save();

            return $lockedClaim->fresh([
                'partner',
                'scheme',
                'membership.customer',
                'sale.branch',
                'sale.customer',
                'lines.product',
                'lines.saleItem',
            ]);
        });

        $scope = $scopeResolver->resolveForUser(
            $request->user()
        );

        $auditLogService->record(
            action:
                'pharmaco.insurance_claim.adjudicated',
            scope: $scope,
            metadata: [
                'tenant_slug' => $tenant->slug,
                'claim_id' => $claim->id,
                'claim_number' =>
                    $claim->claim_number,
                'status' => $claim->status,
                'claimed_amount' =>
                    (float) $claim
                        ->claimed_amount,
                'approved_amount' =>
                    (float) $claim
                        ->approved_amount,
                'rejected_amount' =>
                    (float) $claim
                        ->rejected_amount,
                'line_count' =>
                    $claim->lines->count(),
                'adjudicated_at' =>
                    $claim
                        ->adjudicated_at
                        ?->toISOString(),
            ],
            dataClassification: 'confidential',
            auditableType: InsuranceClaim::class,
            auditableId: $claim->id
        );

        return response()->json([
            'message' =>
                'Insurance claim adjudicated successfully.',
            'tenant' =>
                $this->tenantPayload($tenant),
            'claim' => $this->serializeClaim(
                $claim,
                true
            ),
        ]);
    }

    public function recordClaimPayment(
        Request $request,
        InsuranceClaim $insuranceClaim,
        AuditLogService $auditLogService,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        $tenant = $request->attributes->get('tenant');

        abort_unless(
            (int) $insuranceClaim->tenant_id ===
                (int) $tenant->id,
            404
        );

        $validated = $request->validate([
            'payment_reference' => [
                'required',
                'string',
                'max:255',
                Rule::unique(
                    'insurance_payments',
                    'payment_reference'
                )->where(
                    fn ($query) =>
                        $query->where(
                            'tenant_id',
                            $tenant->id
                        )
                ),
            ],
            'payment_date' => [
                'required',
                'date',
            ],
            'amount' => [
                'required',
                'numeric',
                'gt:0',
            ],
            'currency' => [
                'nullable',
                'string',
                'size:3',
            ],
            'payment_method' => [
                'nullable',
                'string',
                'max:60',
            ],
            'bank_reference' => [
                'nullable',
                'string',
                'max:255',
            ],
            'notes' => [
                'nullable',
                'string',
                'max:1000',
            ],
        ]);

        [$claim, $payment] = DB::transaction(
            function () use (
                $request,
                $tenant,
                $insuranceClaim,
                $validated
            ): array {
                $lockedClaim = InsuranceClaim::query()
                    ->where('tenant_id', $tenant->id)
                    ->lockForUpdate()
                    ->findOrFail($insuranceClaim->id);

                if (!in_array(
                    $lockedClaim->status,
                    [
                        'approved',
                        'partially_approved',
                        'partially_paid',
                    ],
                    true
                )) {
                    abort(
                        409,
                        'Only an approved or partially approved claim can receive insurer payment.'
                    );
                }

                $approvedAmount = round(
                    (float) $lockedClaim
                        ->approved_amount,
                    2
                );

                $currentPaid = round(
                    (float) $lockedClaim
                        ->paid_amount,
                    2
                );

                $amount = round(
                    (float) $validated['amount'],
                    2
                );

                $remainingAmount = round(
                    $approvedAmount - $currentPaid,
                    2
                );

                if ($approvedAmount <= 0) {
                    abort(
                        409,
                        'The claim has no approved amount available for payment.'
                    );
                }

                if ($amount > $remainingAmount) {
                    abort(
                        422,
                        'Payment amount cannot exceed the remaining approved claim balance.'
                    );
                }

                $newPaidAmount = round(
                    $currentPaid + $amount,
                    2
                );

                $payment = InsurancePayment::query()
                    ->create([
                        'uuid' =>
                            (string) Str::uuid(),
                        'tenant_id' =>
                            $tenant->id,
                        'insurance_partner_id' =>
                            $lockedClaim
                                ->insurance_partner_id,
                        'insurance_reconciliation_batch_id' =>
                            null,
                        'payment_reference' =>
                            $validated[
                                'payment_reference'
                            ],
                        'payment_date' =>
                            $validated[
                                'payment_date'
                            ],
                        'amount' => $amount,
                        'currency' =>
                            strtoupper(
                                $validated[
                                    'currency'
                                ] ?? 'RWF'
                            ),
                        'payment_method' =>
                            $validated[
                                'payment_method'
                            ] ?? null,
                        'bank_reference' =>
                            $validated[
                                'bank_reference'
                            ] ?? null,
                        'status' => 'allocated',
                        'allocation_details' => [
                            'insurance_claim_id' =>
                                $lockedClaim->id,
                            'claim_number' =>
                                $lockedClaim
                                    ->claim_number,
                            'approved_amount' =>
                                $approvedAmount,
                            'previous_paid_amount' =>
                                $currentPaid,
                            'allocated_amount' =>
                                $amount,
                            'new_paid_amount' =>
                                $newPaidAmount,
                            'remaining_amount' =>
                                round(
                                    $approvedAmount
                                    - $newPaidAmount,
                                    2
                                ),
                        ],
                        'metadata' => [
                            'workflow' =>
                                'phase_4f1e_claim_payment',
                            'recorded_by' =>
                                $request->user()->id,
                            'recorded_at' =>
                                now()->toISOString(),
                            'notes' =>
                                $validated['notes']
                                ?? null,
                        ],
                    ]);

                $lockedClaim->paid_amount =
                    $newPaidAmount;

                $lockedClaim->status =
                    $newPaidAmount >= $approvedAmount
                        ? 'paid'
                        : 'partially_paid';

                $lockedClaim->metadata = [
                    ...($lockedClaim->metadata ?? []),
                    'latest_payment' => [
                        'insurance_payment_id' =>
                            $payment->id,
                        'payment_reference' =>
                            $payment
                                ->payment_reference,
                        'payment_date' =>
                            $payment
                                ->payment_date
                                ?->toDateString(),
                        'amount' => $amount,
                        'new_paid_amount' =>
                            $newPaidAmount,
                        'remaining_amount' =>
                            round(
                                $approvedAmount
                                - $newPaidAmount,
                                2
                            ),
                        'recorded_by' =>
                            $request->user()->id,
                        'recorded_at' =>
                            now()->toISOString(),
                    ],
                ];

                $lockedClaim->save();

                return [
                    $lockedClaim->fresh([
                        'partner',
                        'scheme',
                        'membership.customer',
                        'sale.branch',
                        'sale.customer',
                        'lines.product',
                        'lines.saleItem',
                    ]),
                    $payment->fresh([
                        'partner',
                    ]),
                ];
            }
        );

        $scope = $scopeResolver->resolveForUser(
            $request->user()
        );

        $auditLogService->record(
            action:
                'pharmaco.insurance_claim.payment_recorded',
            scope: $scope,
            metadata: [
                'tenant_slug' => $tenant->slug,
                'claim_id' => $claim->id,
                'claim_number' =>
                    $claim->claim_number,
                'insurance_payment_id' =>
                    $payment->id,
                'payment_reference' =>
                    $payment->payment_reference,
                'payment_amount' =>
                    (float) $payment->amount,
                'approved_amount' =>
                    (float) $claim
                        ->approved_amount,
                'paid_amount' =>
                    (float) $claim
                        ->paid_amount,
                'remaining_amount' =>
                    round(
                        (float) $claim
                            ->approved_amount
                        - (float) $claim
                            ->paid_amount,
                        2
                    ),
                'status' => $claim->status,
            ],
            dataClassification: 'confidential',
            auditableType: InsuranceClaim::class,
            auditableId: $claim->id
        );

        return response()->json([
            'message' =>
                'Insurance claim payment recorded successfully.',
            'tenant' =>
                $this->tenantPayload($tenant),
            'claim' => $this->serializeClaim(
                $claim,
                true
            ),
            'payment' => [
                'id' => $payment->id,
                'uuid' => $payment->uuid,
                'payment_reference' =>
                    $payment->payment_reference,
                'payment_date' =>
                    $payment
                        ->payment_date
                        ?->toDateString(),
                'amount' =>
                    (float) $payment->amount,
                'currency' =>
                    $payment->currency,
                'payment_method' =>
                    $payment->payment_method,
                'bank_reference' =>
                    $payment->bank_reference,
                'status' =>
                    $payment->status,
                'allocation_details' =>
                    $payment->allocation_details,
            ],
        ], 201);
    }

    private function serializeClaim(
        InsuranceClaim $claim,
        bool $includeLines = false
    ): array {
        $payload = [
            'id' => $claim->id,
            'uuid' => $claim->uuid,
            'claim_number' =>
                $claim->claim_number,
            'external_claim_reference' =>
                $claim
                    ->external_claim_reference,
            'insurance_partner_id' =>
                $claim
                    ->insurance_partner_id,
            'insurance_scheme_id' =>
                $claim
                    ->insurance_scheme_id,
            'customer_insurance_membership_id' =>
                $claim
                    ->customer_insurance_membership_id,
            'sale_id' => $claim->sale_id,
            'service_date' =>
                $claim->service_date
                    ?->toDateString(),
            'gross_amount' =>
                (float) $claim->gross_amount,
            'customer_amount' =>
                (float) $claim
                    ->customer_amount,
            'claimed_amount' =>
                (float) $claim
                    ->claimed_amount,
            'approved_amount' =>
                (float) $claim
                    ->approved_amount,
            'rejected_amount' =>
                (float) $claim
                    ->rejected_amount,
            'paid_amount' =>
                (float) $claim->paid_amount,
            'status' => $claim->status,
            'metadata' =>
                $claim->metadata ?? [],
            'lines_count' =>
                $claim->lines_count
                ?? (
                    $claim->relationLoaded(
                        'lines'
                    )
                        ? $claim
                            ->lines
                            ->count()
                        : null
                ),
            'partner' => $claim->partner
                ? [
                    'id' =>
                        $claim->partner->id,
                    'code' =>
                        $claim->partner->code,
                    'name' =>
                        $claim->partner->name,
                ]
                : null,
            'scheme' => $claim->scheme
                ? [
                    'id' =>
                        $claim->scheme->id,
                    'code' =>
                        $claim->scheme->code,
                    'name' =>
                        $claim->scheme->name,
                ]
                : null,
            'membership' =>
                $claim->membership
                    ? [
                        'id' =>
                            $claim
                                ->membership->id,
                        'member_number' =>
                            $claim
                                ->membership
                                ->member_number,
                        'verification_status' =>
                            $claim
                                ->membership
                                ->verification_status,
                        'status' =>
                            $claim
                                ->membership
                                ->status,
                    ]
                    : null,
            'sale' => $claim->sale
                ? [
                    'id' =>
                        $claim->sale->id,
                    'sale_number' =>
                        $claim
                            ->sale
                            ->sale_number,
                    'sale_type' =>
                        $claim
                            ->sale
                            ->sale_type,
                    'status' =>
                        $claim->sale->status,
                    'total_amount' =>
                        (float) $claim
                            ->sale
                            ->total_amount,
                    'sold_at' =>
                        $claim
                            ->sale
                            ->sold_at
                            ?->toISOString(),
                ]
                : null,
            'created_at' =>
                $claim->created_at
                    ?->toISOString(),
            'updated_at' =>
                $claim->updated_at
                    ?->toISOString(),
        ];

        if ($includeLines) {
            $payload['lines'] =
                $claim->lines
                    ->map(
                        fn ($line) => [
                            'id' => $line->id,
                            'uuid' =>
                                $line->uuid,
                            'product_id' =>
                                $line
                                    ->product_id,
                            'sale_item_id' =>
                                $line
                                    ->sale_item_id,
                            'description' =>
                                $line
                                    ->description,
                            'quantity' =>
                                (float) $line
                                    ->quantity,
                            'unit_price' =>
                                (float) $line
                                    ->unit_price,
                            'gross_amount' =>
                                (float) $line
                                    ->gross_amount,
                            'customer_amount' =>
                                (float) $line
                                    ->customer_amount,
                            'claimed_amount' =>
                                (float) $line
                                    ->claimed_amount,
                            'approved_amount' =>
                                (float) $line
                                    ->approved_amount,
                            'rejected_amount' =>
                                (float) $line
                                    ->rejected_amount,
                            'status' =>
                                $line->status,
                            'metadata' =>
                                $line
                                    ->metadata
                                ?? [],
                            'product' =>
                                $line->product
                                    ? [
                                        'id' =>
                                            $line
                                                ->product
                                                ->id,
                                        'sku' =>
                                            $line
                                                ->product
                                                ->sku,
                                        'name' =>
                                            $line
                                                ->product
                                                ->name,
                                    ]
                                    : null,
                        ]
                    )
                    ->values();
        }

        return $payload;
    }

    private function paginationPayload(
        $paginator
    ): array {
        return [
            'current_page' =>
                $paginator->currentPage(),
            'per_page' =>
                $paginator->perPage(),
            'total' => $paginator->total(),
            'last_page' =>
                $paginator->lastPage(),
            'from' =>
                $paginator->firstItem(),
            'to' =>
                $paginator->lastItem(),
        ];
    }

    private function tenantPayload(
        $tenant
    ): array {
        return [
            'id' => $tenant->id,
            'name' => $tenant->name,
            'slug' => $tenant->slug,
        ];
    }
}
