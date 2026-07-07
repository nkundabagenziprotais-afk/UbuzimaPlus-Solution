<?php

namespace App\Http\Controllers\Api\V1\PharmaCo360;

use App\Http\Controllers\Controller;
use App\Models\InsuranceClaim;
use App\Models\InsurancePartner;
use App\Models\InsurancePayment;
use App\Models\InsuranceReconciliationBatch;
use App\Services\Access\ScopeResolver;
use App\Services\Audit\AuditLogService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class InsuranceReconciliationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $tenant = $request->attributes->get('tenant');

        $batches = InsuranceReconciliationBatch::query()
            ->with('partner')
            ->where('tenant_id', $tenant->id)
            ->when(
                $request->query('status'),
                fn ($query, $status) =>
                    $status === 'all'
                        ? $query
                        : $query->where('status', $status)
            )
            ->latest('id')
            ->paginate(
                min(max((int) $request->query('per_page', 20), 1), 100)
            );

        return response()->json([
            'tenant' => [
                'id' => $tenant->id,
                'slug' => $tenant->slug,
            ],
            'batches' => $batches,
        ]);
    }

    public function show(
        Request $request,
        InsuranceReconciliationBatch $insuranceReconciliationBatch
    ): JsonResponse {
        $tenant = $request->attributes->get('tenant');

        abort_unless(
            (int) $insuranceReconciliationBatch->tenant_id ===
                (int) $tenant->id,
            404
        );

        $insuranceReconciliationBatch->load([
            'partner',
            'payments',
        ]);

        return response()->json([
            'tenant' => [
                'id' => $tenant->id,
                'slug' => $tenant->slug,
            ],
            'batch' => $insuranceReconciliationBatch,
        ]);
    }

    public function store(
        Request $request,
        AuditLogService $auditLogService,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        $tenant = $request->attributes->get('tenant');

        $validated = $request->validate([
            'insurance_partner_id' => [
                'required',
                'integer',
                Rule::exists('insurance_partners', 'id')->where(
                    fn ($query) =>
                        $query->where('tenant_id', $tenant->id)
                ),
            ],
            'batch_number' => [
                'required',
                'string',
                'max:120',
                Rule::unique(
                    'insurance_reconciliation_batches',
                    'batch_number'
                )->where(
                    fn ($query) =>
                        $query->where('tenant_id', $tenant->id)
                ),
            ],
            'period_from' => [
                'required',
                'date',
            ],
            'period_to' => [
                'required',
                'date',
                'after_or_equal:period_from',
            ],
            'claim_ids' => [
                'required',
                'array',
                'min:1',
            ],
            'claim_ids.*' => [
                'integer',
                'distinct',
            ],
            'notes' => [
                'nullable',
                'string',
                'max:2000',
            ],
        ]);

        $batch = DB::transaction(function () use (
            $request,
            $tenant,
            $validated
        ): InsuranceReconciliationBatch {
            $partner = InsurancePartner::query()
                ->where('tenant_id', $tenant->id)
                ->findOrFail($validated['insurance_partner_id']);

            $claims = InsuranceClaim::query()
                ->where('tenant_id', $tenant->id)
                ->where('insurance_partner_id', $partner->id)
                ->whereDate(
                    'service_date',
                    '>=',
                    $validated['period_from']
                )
                ->whereDate(
                    'service_date',
                    '<=',
                    $validated['period_to']
                )
                ->whereIn('status', [
                    'approved',
                    'partially_approved',
                    'partially_paid',
                    'paid',
                ])
                ->whereIn('id', $validated['claim_ids'])
                ->lockForUpdate()
                ->get();

            if ($claims->count() !== count($validated['claim_ids'])) {
                abort(
                    422,
                    'Every selected claim must belong to the tenant and partner, fall within the batch period, and be adjudicated.'
                );
            }

            return InsuranceReconciliationBatch::query()->create([
                'uuid' => (string) Str::uuid(),
                'tenant_id' => $tenant->id,
                'insurance_partner_id' => $partner->id,
                'batch_number' => $validated['batch_number'],
                'period_from' => $validated['period_from'],
                'period_to' => $validated['period_to'],
                'claim_count' => $claims->count(),
                'submitted_amount' => round(
                    (float) $claims->sum('claimed_amount'),
                    2
                ),
                'approved_amount' => round(
                    (float) $claims->sum('approved_amount'),
                    2
                ),
                'rejected_amount' => round(
                    (float) $claims->sum('rejected_amount'),
                    2
                ),
                'paid_amount' => round(
                    (float) $claims->sum('paid_amount'),
                    2
                ),
                'status' => 'draft',
                'metadata' => [
                    'claim_ids' => $claims->pluck('id')->values()->all(),
                    'claim_numbers' => $claims
                        ->pluck('claim_number')
                        ->values()
                        ->all(),
                    'notes' => $validated['notes'] ?? null,
                    'created_by' => $request->user()->id,
                    'created_at' => now()->toISOString(),
                    'workflow' =>
                        'phase_4f1f_reconciliation_batch',
                ],
            ]);
        });

        $scope = $scopeResolver->resolveForUser($request->user());

        $auditLogService->record(
            action:
                'pharmaco.insurance_reconciliation_batch.created',
            scope: $scope,
            metadata: [
                'tenant_slug' => $tenant->slug,
                'batch_id' => $batch->id,
                'batch_number' => $batch->batch_number,
                'claim_count' => $batch->claim_count,
                'submitted_amount' =>
                    (float) $batch->submitted_amount,
                'approved_amount' =>
                    (float) $batch->approved_amount,
                'rejected_amount' =>
                    (float) $batch->rejected_amount,
                'paid_amount' =>
                    (float) $batch->paid_amount,
            ],
            dataClassification: 'confidential',
            auditableType: InsuranceReconciliationBatch::class,
            auditableId: $batch->id
        );

        return response()->json([
            'message' =>
                'Insurance reconciliation batch created successfully.',
            'tenant' => [
                'id' => $tenant->id,
                'slug' => $tenant->slug,
            ],
            'batch' => $batch->load('partner'),
        ], 201);
    }

    public function submit(
        Request $request,
        InsuranceReconciliationBatch $insuranceReconciliationBatch,
        AuditLogService $auditLogService,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        $tenant = $request->attributes->get('tenant');

        abort_unless(
            (int) $insuranceReconciliationBatch->tenant_id ===
                (int) $tenant->id,
            404
        );

        $batch = DB::transaction(function () use (
            $tenant,
            $insuranceReconciliationBatch
        ): InsuranceReconciliationBatch {
            $lockedBatch = InsuranceReconciliationBatch::query()
                ->where('tenant_id', $tenant->id)
                ->lockForUpdate()
                ->findOrFail($insuranceReconciliationBatch->id);

            if ($lockedBatch->status !== 'draft') {
                abort(
                    409,
                    'Only a draft reconciliation batch can be submitted.'
                );
            }

            $lockedBatch->submitted_at = now();
            $lockedBatch->status = 'submitted';
            $lockedBatch->save();

            return $lockedBatch->fresh('partner');
        });

        $scope = $scopeResolver->resolveForUser($request->user());

        $auditLogService->record(
            action:
                'pharmaco.insurance_reconciliation_batch.submitted',
            scope: $scope,
            metadata: [
                'tenant_slug' => $tenant->slug,
                'batch_id' => $batch->id,
                'batch_number' => $batch->batch_number,
                'status' => $batch->status,
                'submitted_at' =>
                    $batch->submitted_at?->toISOString(),
            ],
            dataClassification: 'confidential',
            auditableType: InsuranceReconciliationBatch::class,
            auditableId: $batch->id
        );

        return response()->json([
            'message' =>
                'Insurance reconciliation batch submitted successfully.',
            'tenant' => [
                'id' => $tenant->id,
                'slug' => $tenant->slug,
            ],
            'batch' => $batch,
        ]);
    }
    public function eligiblePayments(
        Request $request,
        InsuranceReconciliationBatch $insuranceReconciliationBatch
    ): JsonResponse {
        $tenant = $request->attributes->get('tenant');

        abort_unless(
            (int) $insuranceReconciliationBatch->tenant_id ===
                (int) $tenant->id,
            404
        );

        $claimIds = collect(
            $insuranceReconciliationBatch->metadata['claim_ids'] ?? []
        )
            ->map(fn ($id) => (int) $id)
            ->values();

        $payments = InsurancePayment::query()
            ->where('tenant_id', $tenant->id)
            ->where(
                'insurance_partner_id',
                $insuranceReconciliationBatch->insurance_partner_id
            )
            ->where(function ($query) use (
                $insuranceReconciliationBatch
            ): void {
                $query
                    ->whereNull(
                        'insurance_reconciliation_batch_id'
                    )
                    ->orWhere(
                        'insurance_reconciliation_batch_id',
                        $insuranceReconciliationBatch->id
                    );
            })
            ->latest('payment_date')
            ->latest('id')
            ->get()
            ->filter(
                fn (InsurancePayment $payment) =>
                    $claimIds->contains(
                        (int) data_get(
                            $payment->allocation_details,
                            'insurance_claim_id'
                        )
                    )
            )
            ->map(
                fn (InsurancePayment $payment) => [
                    'id' => $payment->id,
                    'payment_reference' =>
                        $payment->payment_reference,
                    'payment_date' =>
                        $payment->payment_date
                            ?->toDateString(),
                    'amount' => (float) $payment->amount,
                    'currency' => $payment->currency,
                    'payment_method' =>
                        $payment->payment_method,
                    'bank_reference' =>
                        $payment->bank_reference,
                    'status' => $payment->status,
                    'insurance_claim_id' =>
                        (int) data_get(
                            $payment->allocation_details,
                            'insurance_claim_id'
                        ),
                    'insurance_reconciliation_batch_id' =>
                        $payment
                            ->insurance_reconciliation_batch_id,
                ]
            )
            ->values();

        return response()->json([
            'tenant' => [
                'id' => $tenant->id,
                'slug' => $tenant->slug,
            ],
            'batch' => [
                'id' => $insuranceReconciliationBatch->id,
                'batch_number' =>
                    $insuranceReconciliationBatch->batch_number,
                'status' =>
                    $insuranceReconciliationBatch->status,
            ],
            'payments' => $payments,
        ]);
    }


    public function reconcile(
        Request $request,
        InsuranceReconciliationBatch $insuranceReconciliationBatch,
        AuditLogService $auditLogService,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        $tenant = $request->attributes->get('tenant');

        abort_unless(
            (int) $insuranceReconciliationBatch->tenant_id ===
                (int) $tenant->id,
            404
        );

        $validated = $request->validate([
            'payment_ids' => [
                'required',
                'array',
                'min:1',
            ],
            'payment_ids.*' => [
                'integer',
                'distinct',
            ],
            'notes' => [
                'nullable',
                'string',
                'max:2000',
            ],
        ]);

        $batch = DB::transaction(function () use (
            $request,
            $tenant,
            $insuranceReconciliationBatch,
            $validated
        ): InsuranceReconciliationBatch {
            $lockedBatch = InsuranceReconciliationBatch::query()
                ->where('tenant_id', $tenant->id)
                ->lockForUpdate()
                ->findOrFail($insuranceReconciliationBatch->id);

            if (!in_array(
                $lockedBatch->status,
                [
                    'submitted',
                    'partially_reconciled',
                ],
                true
            )) {
                abort(
                    409,
                    'Only a submitted or partially reconciled batch can be reconciled.'
                );
            }

            $claimIds = collect(
                $lockedBatch->metadata['claim_ids'] ?? []
            )
                ->map(fn ($id) => (int) $id)
                ->values();

            if ($claimIds->isEmpty()) {
                abort(
                    409,
                    'The reconciliation batch has no eligible claims.'
                );
            }

            $payments = InsurancePayment::query()
                ->where('tenant_id', $tenant->id)
                ->where(
                    'insurance_partner_id',
                    $lockedBatch->insurance_partner_id
                )
                ->whereIn('id', $validated['payment_ids'])
                ->where(function ($query) use ($lockedBatch) {
                    $query
                        ->whereNull(
                            'insurance_reconciliation_batch_id'
                        )
                        ->orWhere(
                            'insurance_reconciliation_batch_id',
                            $lockedBatch->id
                        );
                })
                ->lockForUpdate()
                ->get();

            if ($payments->count() !== count($validated['payment_ids'])) {
                abort(
                    422,
                    'Every selected payment must belong to the tenant and partner and must not belong to another reconciliation batch.'
                );
            }

            foreach ($payments as $payment) {
                $claimId = (int) data_get(
                    $payment->allocation_details,
                    'insurance_claim_id'
                );

                if (!$claimIds->contains($claimId)) {
                    abort(
                        422,
                        'Every selected payment must be allocated to a claim included in the reconciliation batch.'
                    );
                }
            }

            InsurancePayment::query()
                ->whereIn('id', $payments->pluck('id'))
                ->update([
                    'insurance_reconciliation_batch_id' =>
                        $lockedBatch->id,
                ]);

            $totalPaid = round(
                (float) InsurancePayment::query()
                    ->where('tenant_id', $tenant->id)
                    ->where(
                        'insurance_reconciliation_batch_id',
                        $lockedBatch->id
                    )
                    ->sum('amount'),
                2
            );

            $approvedAmount = round(
                (float) $lockedBatch->approved_amount,
                2
            );

            if ($totalPaid > $approvedAmount) {
                abort(
                    422,
                    'Reconciliation payments cannot exceed the batch approved amount.'
                );
            }

            $isFullyReconciled =
                $totalPaid >= $approvedAmount;

            $lockedBatch->paid_amount = $totalPaid;
            $lockedBatch->status = $isFullyReconciled
                ? 'reconciled'
                : 'partially_reconciled';
            $lockedBatch->reconciled_at =
                $isFullyReconciled ? now() : null;
            $lockedBatch->metadata = [
                ...($lockedBatch->metadata ?? []),
                'latest_reconciliation' => [
                    'payment_ids' =>
                        $payments->pluck('id')->values()->all(),
                    'payment_references' =>
                        $payments
                            ->pluck('payment_reference')
                            ->values()
                            ->all(),
                    'paid_amount' => $totalPaid,
                    'remaining_amount' => round(
                        $approvedAmount - $totalPaid,
                        2
                    ),
                    'notes' => $validated['notes'] ?? null,
                    'reconciled_by' =>
                        $request->user()->id,
                    'reconciled_at' =>
                        now()->toISOString(),
                ],
            ];
            $lockedBatch->save();

            return $lockedBatch->fresh([
                'partner',
                'payments',
            ]);
        });

        $scope = $scopeResolver->resolveForUser(
            $request->user()
        );

        $auditLogService->record(
            action:
                'pharmaco.insurance_reconciliation_batch.reconciled',
            scope: $scope,
            metadata: [
                'tenant_slug' => $tenant->slug,
                'batch_id' => $batch->id,
                'batch_number' => $batch->batch_number,
                'approved_amount' =>
                    (float) $batch->approved_amount,
                'paid_amount' =>
                    (float) $batch->paid_amount,
                'remaining_amount' => round(
                    (float) $batch->approved_amount
                    - (float) $batch->paid_amount,
                    2
                ),
                'status' => $batch->status,
                'payment_count' =>
                    $batch->payments->count(),
            ],
            dataClassification: 'confidential',
            auditableType: InsuranceReconciliationBatch::class,
            auditableId: $batch->id
        );

        return response()->json([
            'message' =>
                'Insurance reconciliation batch processed successfully.',
            'tenant' => [
                'id' => $tenant->id,
                'slug' => $tenant->slug,
            ],
            'batch' => $batch,
        ]);
    }

}
