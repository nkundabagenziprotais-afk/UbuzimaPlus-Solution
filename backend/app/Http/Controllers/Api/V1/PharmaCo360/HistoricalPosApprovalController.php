<?php

namespace App\Http\Controllers\Api\V1\PharmaCo360;

use App\Http\Controllers\Controller;
use App\Models\Branch;
use App\Models\PharmacoHistoricalPosApproval;
use App\Services\Access\ScopeResolver;
use App\Services\Audit\AuditLogService;
use App\Services\PharmaCo360\HistoricalPosConflictService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class HistoricalPosApprovalController extends Controller
{
    public function availability(
        Request $request,
        HistoricalPosConflictService $conflicts
    ): JsonResponse {
        $tenant = $request->attributes->get('tenant');

        $validated = $request->validate([
            'branch_id' => [
                'required',
                'integer',
            ],
            'business_date' => [
                'required',
                'date_format:Y-m-d',
            ],
        ]);

        $branch = $this->resolveBranch(
            (int) $tenant->id,
            (int) $validated['branch_id']
        );

        $summary = $conflicts->liveActivitySummary(
            (int) $tenant->id,
            (int) $branch->id,
            $validated['business_date']
        );

        return response()->json([
            'branch' => [
                'id' => $branch->id,
                'name' => $branch->name,
                'code' => $branch->code,
            ],
            ...$summary,
            'approval_required' =>
                $summary['live_activity_exists'],
            'approval_rule' =>
                $summary['live_activity_exists']
                    ? 'admin_or_owner_code_required'
                    : 'historical_permission_only',
        ]);
    }

    public function requestApproval(
        Request $request,
        HistoricalPosConflictService $conflicts,
        ScopeResolver $scopeResolver,
        AuditLogService $auditLogService
    ): JsonResponse {
        $tenant = $request->attributes->get('tenant');

        $validated = $request->validate([
            'branch_id' => [
                'required',
                'integer',
            ],
            'business_date' => [
                'required',
                'date_format:Y-m-d',
            ],
            'request_reason' => [
                'required',
                'string',
                'min:10',
                'max:1000',
            ],
            'historical_reference' => [
                'nullable',
                'string',
                'max:160',
            ],
        ]);

        $branch = $this->resolveBranch(
            (int) $tenant->id,
            (int) $validated['branch_id']
        );

        $summary = $conflicts->liveActivitySummary(
            (int) $tenant->id,
            (int) $branch->id,
            $validated['business_date']
        );

        if (! $summary['live_activity_exists']) {
            throw ValidationException::withMessages([
                'business_date' => [
                    'No live POS activity exists on this '
                    . 'date. Admin or Owner authorization '
                    . 'is not required.',
                ],
            ]);
        }

        [$approval, $created] = DB::transaction(
            function () use (
                $tenant,
                $request,
                $branch,
                $validated,
                $summary
            ) {
                $existing =
                    PharmacoHistoricalPosApproval::query()
                        ->where(
                            'tenant_id',
                            $tenant->id
                        )
                        ->where(
                            'branch_id',
                            $branch->id
                        )
                        ->whereDate(
                            'business_date',
                            $summary['business_date']
                        )
                        ->where(
                            'requested_by',
                            $request->user()->id
                        )
                        ->whereIn(
                            'status',
                            [
                                'pending',
                                'approved',
                            ]
                        )
                        ->latest('id')
                        ->lockForUpdate()
                        ->first();

                if ($existing) {
                    if (
                        $existing->status === 'approved'
                        && $existing->expires_at
                        && $existing->expires_at->isPast()
                    ) {
                        $existing->fill([
                            'status' => 'expired',
                            'approval_code_hash' => null,
                        ])->save();
                    } else {
                        if ($existing->status === 'pending') {
                            $existing->fill([
                                'request_reason' =>
                                    $validated[
                                        'request_reason'
                                    ],
                                'historical_reference' =>
                                    $validated[
                                        'historical_reference'
                                    ] ?? null,
                                'live_activity_count' =>
                                    $summary[
                                        'live_activity_count'
                                    ],
                                'live_activity_total' =>
                                    $summary[
                                        'live_activity_total'
                                    ],
                            ])->save();
                        }

                        return [
                            $existing->fresh([
                                'branch',
                                'requester',
                                'approver',
                            ]),
                            false,
                        ];
                    }
                }

                $approval =
                    PharmacoHistoricalPosApproval::query()
                        ->create([
                            'uuid' => (string) Str::uuid(),
                            'tenant_id' => $tenant->id,
                            'branch_id' => $branch->id,
                            'business_date' =>
                                $summary['business_date'],
                            'requested_by' =>
                                $request->user()->id,
                            'status' => 'pending',
                            'requires_code' => true,
                            'failed_attempts' => 0,
                            'live_activity_count' =>
                                $summary[
                                    'live_activity_count'
                                ],
                            'live_activity_total' =>
                                $summary[
                                    'live_activity_total'
                                ],
                            'request_reason' =>
                                $validated[
                                    'request_reason'
                                ],
                            'historical_reference' =>
                                $validated[
                                    'historical_reference'
                                ] ?? null,
                            'metadata' => [
                                'approval_rule' =>
                                    'live_activity_conflict',
                            ],
                        ]);

                return [
                    $approval->fresh([
                        'branch',
                        'requester',
                        'approver',
                    ]),
                    true,
                ];
            }
        );

        $scope = $scopeResolver->resolveForUser(
            $request->user()
        );

        $auditLogService->record(
            action: $created
                ? 'pharmaco.pos.historical.approval.requested'
                : 'pharmaco.pos.historical.approval.reused',
            scope: $scope,
            metadata: [
                'approval_id' => $approval->id,
                'branch_id' => $approval->branch_id,
                'business_date' =>
                    $approval->business_date
                        ->toDateString(),
                'live_activity_count' =>
                    $approval->live_activity_count,
                'live_activity_total' =>
                    (float) $approval
                        ->live_activity_total,
            ],
            dataClassification: 'internal',
            auditableType:
                PharmacoHistoricalPosApproval::class,
            auditableId: $approval->id
        );

        return response()->json([
            'message' => $created
                ? 'Historical POS approval requested.'
                : 'An active approval request already exists.',
            'approval' =>
                $this->serializeApproval($approval),
        ], $created ? 201 : 200);
    }

    public function index(Request $request): JsonResponse
    {
        $tenant = $request->attributes->get('tenant');

        $validated = $request->validate([
            'status' => [
                'nullable',
                'in:pending,approved,rejected,used,expired',
            ],
            'branch_id' => [
                'nullable',
                'integer',
            ],
            'business_date' => [
                'nullable',
                'date_format:Y-m-d',
            ],
        ]);

        $approvals =
            PharmacoHistoricalPosApproval::query()
                ->with([
                    'branch',
                    'requester',
                    'approver',
                ])
                ->where(
                    'tenant_id',
                    $tenant->id
                )
                ->when(
                    $validated['status'] ?? null,
                    fn ($query, $status) =>
                        $query->where(
                            'status',
                            $status
                        )
                )
                ->when(
                    $validated['branch_id'] ?? null,
                    fn ($query, $branchId) =>
                        $query->where(
                            'branch_id',
                            $branchId
                        )
                )
                ->when(
                    $validated['business_date'] ?? null,
                    fn ($query, $businessDate) =>
                        $query->whereDate(
                            'business_date',
                            $businessDate
                        )
                )
                ->latest()
                ->limit(100)
                ->get();

        return response()->json([
            'approvals' => $approvals
                ->map(
                    fn ($approval) =>
                        $this->serializeApproval(
                            $approval
                        )
                )
                ->values(),
        ]);
    }

    public function approve(
        Request $request,
        PharmacoHistoricalPosApproval $approval,
        ScopeResolver $scopeResolver,
        AuditLogService $auditLogService
    ): JsonResponse {
        $tenant = $request->attributes->get('tenant');

        $validated = $request->validate([
            'decision_notes' => [
                'nullable',
                'string',
                'max:1000',
            ],
        ]);

        [$approved, $plainCode] = DB::transaction(
            function () use (
                $tenant,
                $request,
                $approval,
                $validated
            ) {
                $locked =
                    PharmacoHistoricalPosApproval::query()
                        ->lockForUpdate()
                        ->findOrFail($approval->id);

                $this->authorizeTenantApproval(
                    (int) $tenant->id,
                    $locked
                );

                if ($locked->status !== 'pending') {
                    throw ValidationException::withMessages([
                        'approval' => [
                            'Only a pending request can '
                            . 'be approved.',
                        ],
                    ]);
                }

                $plainCode = (string) random_int(
                    100000,
                    999999
                );

                $locked->fill([
                    'status' => 'approved',
                    'approved_by' =>
                        $request->user()->id,
                    'approval_code_hash' =>
                        Hash::make($plainCode),
                    'failed_attempts' => 0,
                    'approved_at' => now(),
                    'rejected_at' => null,
                    'expires_at' => now()->addMinutes(
                        max(
                            1,
                            (int) config(
                                'pharmaco.'
                                . 'historical_pos_code_minutes',
                                10
                            )
                        )
                    ),
                    'used_at' => null,
                    'decision_notes' =>
                        $validated[
                            'decision_notes'
                        ] ?? null,
                ])->save();

                return [
                    $locked->fresh([
                        'branch',
                        'requester',
                        'approver',
                    ]),
                    $plainCode,
                ];
            }
        );

        $scope = $scopeResolver->resolveForUser(
            $request->user()
        );

        $auditLogService->record(
            action:
                'pharmaco.pos.historical.approval.approved',
            scope: $scope,
            metadata: [
                'approval_id' => $approved->id,
                'branch_id' => $approved->branch_id,
                'business_date' =>
                    $approved->business_date
                        ->toDateString(),
                'requested_by' =>
                    $approved->requested_by,
                'approved_by' =>
                    $approved->approved_by,
                'expires_at' =>
                    $approved->expires_at
                        ?->toIso8601String(),
            ],
            dataClassification: 'confidential',
            auditableType:
                PharmacoHistoricalPosApproval::class,
            auditableId: $approved->id
        );

        return response()->json([
            'message' =>
                'Historical POS authorization approved. '
                . 'The code is displayed once.',
            'approval' =>
                $this->serializeApproval($approved),
            'approval_code' => $plainCode,
        ]);
    }

    public function reject(
        Request $request,
        PharmacoHistoricalPosApproval $approval,
        ScopeResolver $scopeResolver,
        AuditLogService $auditLogService
    ): JsonResponse {
        $tenant = $request->attributes->get('tenant');

        $validated = $request->validate([
            'decision_notes' => [
                'required',
                'string',
                'min:5',
                'max:1000',
            ],
        ]);

        $rejected = DB::transaction(
            function () use (
                $tenant,
                $request,
                $approval,
                $validated
            ) {
                $locked =
                    PharmacoHistoricalPosApproval::query()
                        ->lockForUpdate()
                        ->findOrFail($approval->id);

                $this->authorizeTenantApproval(
                    (int) $tenant->id,
                    $locked
                );

                if ($locked->status !== 'pending') {
                    throw ValidationException::withMessages([
                        'approval' => [
                            'Only a pending request can '
                            . 'be rejected.',
                        ],
                    ]);
                }

                $locked->fill([
                    'status' => 'rejected',
                    'approved_by' =>
                        $request->user()->id,
                    'approval_code_hash' => null,
                    'approved_at' => null,
                    'rejected_at' => now(),
                    'expires_at' => null,
                    'decision_notes' =>
                        $validated[
                            'decision_notes'
                        ],
                ])->save();

                return $locked->fresh([
                    'branch',
                    'requester',
                    'approver',
                ]);
            }
        );

        $scope = $scopeResolver->resolveForUser(
            $request->user()
        );

        $auditLogService->record(
            action:
                'pharmaco.pos.historical.approval.rejected',
            scope: $scope,
            metadata: [
                'approval_id' => $rejected->id,
                'branch_id' => $rejected->branch_id,
                'business_date' =>
                    $rejected->business_date
                        ->toDateString(),
                'requested_by' =>
                    $rejected->requested_by,
                'rejected_by' =>
                    $rejected->approved_by,
            ],
            dataClassification: 'internal',
            auditableType:
                PharmacoHistoricalPosApproval::class,
            auditableId: $rejected->id
        );

        return response()->json([
            'message' =>
                'Historical POS authorization rejected.',
            'approval' =>
                $this->serializeApproval($rejected),
        ]);
    }

    private function resolveBranch(
        int $tenantId,
        int $branchId
    ): Branch {
        $branch = Branch::query()
            ->where('tenant_id', $tenantId)
            ->where('status', 'active')
            ->find($branchId);

        if (! $branch) {
            throw ValidationException::withMessages([
                'branch_id' => [
                    'Selected branch is invalid or inactive.',
                ],
            ]);
        }

        return $branch;
    }

    private function authorizeTenantApproval(
        int $tenantId,
        PharmacoHistoricalPosApproval $approval
    ): void {
        if ((int) $approval->tenant_id !== $tenantId) {
            abort(404);
        }
    }

    private function serializeApproval(
        PharmacoHistoricalPosApproval $approval
    ): array {
        return [
            'id' => $approval->id,
            'uuid' => $approval->uuid,
            'branch_id' => $approval->branch_id,
            'business_date' =>
                $approval->business_date
                    ?->toDateString(),
            'requested_by' =>
                $approval->requested_by,
            'approved_by' =>
                $approval->approved_by,
            'status' => $approval->status,
            'requires_code' =>
                (bool) $approval->requires_code,
            'failed_attempts' =>
                (int) $approval->failed_attempts,
            'live_activity_count' =>
                (int) $approval
                    ->live_activity_count,
            'live_activity_total' =>
                (float) $approval
                    ->live_activity_total,
            'request_reason' =>
                $approval->request_reason,
            'historical_reference' =>
                $approval->historical_reference,
            'decision_notes' =>
                $approval->decision_notes,
            'approved_at' =>
                $approval->approved_at
                    ?->toIso8601String(),
            'rejected_at' =>
                $approval->rejected_at
                    ?->toIso8601String(),
            'expires_at' =>
                $approval->expires_at
                    ?->toIso8601String(),
            'used_at' =>
                $approval->used_at
                    ?->toIso8601String(),
            'created_at' =>
                $approval->created_at
                    ?->toIso8601String(),
            'branch' =>
                $approval->relationLoaded('branch')
                && $approval->branch
                    ? [
                        'id' =>
                            $approval->branch->id,
                        'name' =>
                            $approval->branch->name,
                        'code' =>
                            $approval->branch->code,
                    ]
                    : null,
            'requester' =>
                $approval->relationLoaded('requester')
                && $approval->requester
                    ? [
                        'id' =>
                            $approval->requester->id,
                        'name' =>
                            $approval->requester->name,
                        'email' =>
                            $approval->requester->email,
                    ]
                    : null,
            'approver' =>
                $approval->relationLoaded('approver')
                && $approval->approver
                    ? [
                        'id' =>
                            $approval->approver->id,
                        'name' =>
                            $approval->approver->name,
                        'email' =>
                            $approval->approver->email,
                    ]
                    : null,
        ];
    }
}
