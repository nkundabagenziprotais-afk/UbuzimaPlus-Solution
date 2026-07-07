<?php

namespace App\Http\Controllers\Api\V1\PharmaCo360;

use App\Http\Controllers\Controller;
use App\Models\InsuranceClaim;
use App\Models\InsurancePartner;
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
}
