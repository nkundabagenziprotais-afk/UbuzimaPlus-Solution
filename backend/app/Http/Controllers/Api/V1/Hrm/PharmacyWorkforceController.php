<?php

namespace App\Http\Controllers\Api\V1\Hrm;

use App\Http\Controllers\Controller;
use App\Services\Access\ScopeResolver;
use App\Services\Audit\AuditLogService;
use App\Services\Hrm\HrmTenantContextService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Throwable;

class PharmacyWorkforceController extends Controller
{
    public function __construct(
        private readonly HrmTenantContextService $tenantContext
    ) {
    }

    public function overview(
        Request $request,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        [
            'tenant' => $tenant,
            'scope' => $scope,
        ] = $this->context(
            $request,
            $scopeResolver
        );

        $tenantId =
            (int) $tenant->id;

        $branchId =
            $this->branchId(
                $scope
            );

        $today =
            now()->toDateString();

        $thirtyDays =
            now()
                ->addDays(30)
                ->toDateString();

        $employees =
            DB::table(
                'hrm_employees'
            )
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->when(
                    $branchId !== null,
                    fn ($query) =>
                        $query->where(
                            'home_branch_id',
                            $branchId
                        )
                )
                ->whereNotIn(
                    'employment_status',
                    [
                        'terminated',
                        'inactive',
                    ]
                )
                ->orderBy(
                    'employee_number'
                )
                ->get([
                    'id',
                    'employee_number',
                    'first_name',
                    'last_name',
                    'home_branch_id',
                    'employment_status',
                ]);

        $branches =
            DB::table(
                'branches'
            )
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->when(
                    $branchId !== null,
                    fn ($query) =>
                        $query->where(
                            'id',
                            $branchId
                        )
                )
                ->orderBy('name')
                ->get([
                    'id',
                    'name',
                ]);

        $authorizations =
            DB::table(
                'hrm_pharmacy_workforce_authorizations as a'
            )
                ->join(
                    'hrm_employees as e',
                    'e.id',
                    '=',
                    'a.employee_id'
                )
                ->join(
                    'branches as b',
                    'b.id',
                    '=',
                    'a.branch_id'
                )
                ->where(
                    'a.tenant_id',
                    $tenantId
                )
                ->when(
                    $branchId !== null,
                    fn ($query) =>
                        $query->where(
                            'a.branch_id',
                            $branchId
                        )
                )
                ->orderByDesc(
                    'a.id'
                )
                ->get([
                    'a.*',
                    'e.employee_number',
                    'e.first_name',
                    'e.last_name',
                    'b.name as branch_name',
                ]);

        $responsible =
            DB::table(
                'hrm_pharmacy_responsible_assignments as r'
            )
                ->join(
                    'hrm_employees as e',
                    'e.id',
                    '=',
                    'r.employee_id'
                )
                ->join(
                    'branches as b',
                    'b.id',
                    '=',
                    'r.branch_id'
                )
                ->where(
                    'r.tenant_id',
                    $tenantId
                )
                ->when(
                    $branchId !== null,
                    fn ($query) =>
                        $query->where(
                            'r.branch_id',
                            $branchId
                        )
                )
                ->orderByDesc(
                    'r.id'
                )
                ->get([
                    'r.*',
                    'e.employee_number',
                    'e.first_name',
                    'e.last_name',
                    'b.name as branch_name',
                ]);

        $requirements =
            DB::table(
                'hrm_pharmacy_coverage_requirements as c'
            )
                ->join(
                    'branches as b',
                    'b.id',
                    '=',
                    'c.branch_id'
                )
                ->where(
                    'c.tenant_id',
                    $tenantId
                )
                ->when(
                    $branchId !== null,
                    fn ($query) =>
                        $query->where(
                            'c.branch_id',
                            $branchId
                        )
                )
                ->orderByDesc(
                    'c.id'
                )
                ->get([
                    'c.*',
                    'b.name as branch_name',
                ]);

        $exceptions =
            DB::table(
                'hrm_pharmacy_compliance_exceptions as x'
            )
                ->leftJoin(
                    'branches as b',
                    'b.id',
                    '=',
                    'x.branch_id'
                )
                ->leftJoin(
                    'hrm_employees as e',
                    'e.id',
                    '=',
                    'x.employee_id'
                )
                ->where(
                    'x.tenant_id',
                    $tenantId
                )
                ->when(
                    $branchId !== null,
                    fn ($query) =>
                        $query->where(
                            'x.branch_id',
                            $branchId
                        )
                )
                ->orderByDesc(
                    'x.id'
                )
                ->get([
                    'x.*',
                    'b.name as branch_name',
                    'e.employee_number',
                    'e.first_name',
                    'e.last_name',
                ])
                ->map(
                    function ($row) {
                        $detail =
                            $this->decrypt(
                                $row->detail_payload
                            );

                        $resolution =
                            $this->decrypt(
                                $row->resolution_payload
                            );

                        unset(
                            $row->detail_payload,
                            $row->resolution_payload
                        );

                        $row->details =
                            $detail['details']
                            ?? null;

                        $row->resolution =
                            $resolution['resolution']
                            ?? null;

                        return $row;
                    }
                );

        $activeAuthorizations =
            $authorizations
                ->filter(
                    fn ($row) =>
                        $row->status ===
                            'approved'
                        &&
                        $row->credential_expiry_date
                            >=
                            $today
                        &&
                        $row->effective_from
                            <=
                            $today
                        &&
                        (
                            $row->effective_to
                                === null
                            ||
                            $row->effective_to
                                >=
                                $today
                        )
                );

        $currentRequirements =
            $requirements
                ->filter(
                    fn ($row) =>
                        $row->status ===
                            'active'
                        &&
                        $row->effective_from
                            <=
                            $today
                        &&
                        (
                            $row->effective_to
                                === null
                            ||
                            $row->effective_to
                                >=
                                $today
                        )
                );

        $coverage =
            $currentRequirements
                ->map(
                    function ($requirement) use (
                        $activeAuthorizations
                    ) {
                        $available =
                            $activeAuthorizations
                                ->filter(
                                    fn ($row) =>
                                        (int)
                                        $row->branch_id
                                            ===
                                            (int)
                                            $requirement
                                                ->branch_id
                                        &&
                                        $row->regulated_function
                                            ===
                                            $requirement
                                                ->regulated_function
                                )
                                ->count();

                        $required =
                            (int)
                            $requirement
                                ->minimum_authorized_staff;

                        return [
                            'requirement_id' =>
                                $requirement->id,

                            'branch_id' =>
                                $requirement->branch_id,

                            'branch_name' =>
                                $requirement->branch_name,

                            'regulated_function' =>
                                $requirement
                                    ->regulated_function,

                            'minimum_authorized_staff' =>
                                $required,

                            'available_authorized_staff' =>
                                $available,

                            'gap' =>
                                max(
                                    0,
                                    $required
                                    -
                                    $available
                                ),
                        ];
                    }
                )
                ->values();

        $activeResponsible =
            $responsible
                ->filter(
                    fn ($row) =>
                        $row->status ===
                            'approved'
                        &&
                        $row->effective_from
                            <=
                            $today
                        &&
                        (
                            $row->effective_to
                                === null
                            ||
                            $row->effective_to
                                >=
                                $today
                        )
                );

        /*
         * Only configured regulated pharmacy branches are measured.
         * Normal non-pharmacy branches are not falsely classified.
         */
        $regulatedBranchIds =
            $currentRequirements
                ->pluck(
                    'branch_id'
                )
                ->map(
                    fn ($value) =>
                        (int) $value
                )
                ->merge(
                    $responsible
                        ->pluck(
                            'branch_id'
                        )
                        ->map(
                            fn ($value) =>
                                (int) $value
                        )
                )
                ->unique()
                ->values();

        $responsibleBranchIds =
            $activeResponsible
                ->pluck(
                    'branch_id'
                )
                ->map(
                    fn ($value) =>
                        (int) $value
                )
                ->unique();

        $branchesWithoutResponsible =
            $regulatedBranchIds
                ->filter(
                    fn ($id) =>
                        !$responsibleBranchIds
                            ->contains($id)
                )
                ->count();

        return response()->json([
            'summary' => [
                'active_authorizations' =>
                    $activeAuthorizations
                        ->count(),

                'expiring_30d' =>
                    $activeAuthorizations
                        ->filter(
                            fn ($row) =>
                                $row->credential_expiry_date
                                    <=
                                    $thirtyDays
                        )
                        ->count(),

                'expired_credentials' =>
                    $authorizations
                        ->filter(
                            fn ($row) =>
                                in_array(
                                    $row->status,
                                    [
                                        'approved',
                                        'submitted',
                                    ],
                                    true
                                )
                                &&
                                $row->credential_expiry_date
                                    <
                                    $today
                        )
                        ->count(),

                'regulated_branches_without_responsible_pharmacist' =>
                    $branchesWithoutResponsible,

                'coverage_gaps' =>
                    $coverage
                        ->where(
                            'gap',
                            '>',
                            0
                        )
                        ->count(),

                'open_compliance_exceptions' =>
                    $exceptions
                        ->where(
                            'status',
                            'open'
                        )
                        ->count(),

                'pending_approvals' =>
                    $authorizations
                        ->where(
                            'status',
                            'submitted'
                        )
                        ->count()
                    +
                    $responsible
                        ->where(
                            'status',
                            'submitted'
                        )
                        ->count(),
            ],

            'employees' =>
                $employees,

            'branches' =>
                $branches,

            'authorizations' =>
                $authorizations,

            'responsible_assignments' =>
                $responsible,

            'coverage_requirements' =>
                $requirements,

            'coverage' =>
                $coverage,

            'exceptions' =>
                $exceptions,

            'controls' => [
                'maker_checker' =>
                    true,

                'credential_expiry_enforced' =>
                    true,

                'responsible_pharmacist_requires_approved_pharmacist_supervision_authorization' =>
                    true,

                'tenant_branch_isolation' =>
                    true,

                'automatic_pos_block' =>
                    false,

                'automatic_payroll_action' =>
                    false,

                'compensation_history_write' =>
                    false,

                'finance_posting' =>
                    false,
            ],
        ]);
    }


    # ============================================================
    # AUTHORIZATION
    # ============================================================

    public function createAuthorization(
        Request $request,
        ScopeResolver $scopeResolver,
        AuditLogService $audit
    ): JsonResponse {
        [
            'tenant' => $tenant,
            'scope' => $scope,
        ] = $this->context(
            $request,
            $scopeResolver
        );

        $validated =
            $request->validate([
                'employee_id' => [
                    'required',
                    'integer',
                ],

                'branch_id' => [
                    'required',
                    'integer',
                ],

                'professional_category' => [
                    'required',
                    'in:pharmacist,pharmacy_technician,pharmacy_assistant,other',
                ],

                'regulated_function' => [
                    'required',
                    'in:dispensing,pharmacist_supervision,controlled_medicines,cold_chain,inventory_release,quality_assurance',
                ],

                'credential_reference' => [
                    'required',
                    'string',
                    'max:191',
                ],

                'credential_expiry_date' => [
                    'required',
                    'date',
                ],

                'effective_from' => [
                    'required',
                    'date',
                ],

                'effective_to' => [
                    'nullable',
                    'date',
                ],
            ]);

        $tenantId =
            (int) $tenant->id;

        $employee =
            $this->employee(
                $tenantId,
                $scope,
                (int)
                $validated['employee_id']
            );

        $branchId =
            $this->resolveBranch(
                $tenantId,
                $scope,
                (int)
                $validated['branch_id']
            );

        if (
            $validated[
                'credential_expiry_date'
            ]
            <
            $validated['effective_from']
        ) {
            throw ValidationException::withMessages([
                'credential_expiry_date' => [
                    'Credential expiry cannot precede the authorization start date.',
                ],
            ]);
        }

        if (
            !empty(
                $validated['effective_to']
            )
            &&
            $validated['effective_to']
            <
            $validated['effective_from']
        ) {
            throw ValidationException::withMessages([
                'effective_to' => [
                    'Authorization end date cannot precede its start date.',
                ],
            ]);
        }

        $id =
            DB::table(
                'hrm_pharmacy_workforce_authorizations'
            )
                ->insertGetId([
                    'uuid' =>
                        (string) Str::uuid(),

                    'tenant_id' =>
                        $tenantId,

                    'branch_id' =>
                        $branchId,

                    'employee_id' =>
                        $employee->id,

                    'professional_category' =>
                        $validated[
                            'professional_category'
                        ],

                    'regulated_function' =>
                        $validated[
                            'regulated_function'
                        ],

                    'credential_reference' =>
                        $validated[
                            'credential_reference'
                        ],

                    'credential_expiry_date' =>
                        $validated[
                            'credential_expiry_date'
                        ],

                    'effective_from' =>
                        $validated[
                            'effective_from'
                        ],

                    'effective_to' =>
                        $validated[
                            'effective_to'
                        ]
                        ?? null,

                    'status' =>
                        'draft',

                    'created_by' =>
                        $request
                            ->user()
                            ->id,

                    'created_at' =>
                        now(),

                    'updated_at' =>
                        now(),
                ]);

        $this->audit(
            $audit,
            $scope,
            'hrm.pharmacy_workforce.authorization.created',
            'hrm_pharmacy_workforce_authorization',
            $id,
            [
                'authorization_id' =>
                    $id,

                'employee_id' =>
                    $employee->id,

                'branch_id' =>
                    $branchId,

                'professional_category' =>
                    $validated[
                        'professional_category'
                    ],

                'regulated_function' =>
                    $validated[
                        'regulated_function'
                    ],
            ]
        );

        return response()->json([
            'message' =>
                'Pharmacy workforce authorization created as draft.',

            'authorization_id' =>
                $id,
        ], 201);
    }

    public function submitAuthorization(
        Request $request,
        int $authorizationId,
        ScopeResolver $scopeResolver,
        AuditLogService $audit
    ): JsonResponse {
        [
            'tenant' => $tenant,
            'scope' => $scope,
        ] = $this->context(
            $request,
            $scopeResolver
        );

        $row =
            $this->authorization(
                (int) $tenant->id,
                $scope,
                $authorizationId
            );

        if ($row->status !== 'draft') {
            throw ValidationException::withMessages([
                'status' => [
                    'Only draft authorizations can be submitted.',
                ],
            ]);
        }

        if (
            $row->credential_expiry_date
            <
            now()->toDateString()
        ) {
            throw ValidationException::withMessages([
                'credential_expiry_date' => [
                    'An expired professional credential cannot be submitted.',
                ],
            ]);
        }

        DB::table(
            'hrm_pharmacy_workforce_authorizations'
        )
            ->where(
                'id',
                $row->id
            )
            ->update([
                'status' =>
                    'submitted',

                'submitted_by' =>
                    $request
                        ->user()
                        ->id,

                'submitted_at' =>
                    now(),

                'updated_at' =>
                    now(),
            ]);

        $this->audit(
            $audit,
            $scope,
            'hrm.pharmacy_workforce.authorization.submitted',
            'hrm_pharmacy_workforce_authorization',
            $row->id,
            [
                'authorization_id' =>
                    $row->id,
            ]
        );

        return response()->json([
            'message' =>
                'Authorization submitted for independent approval.',
        ]);
    }

    public function approveAuthorization(
        Request $request,
        int $authorizationId,
        ScopeResolver $scopeResolver,
        AuditLogService $audit
    ): JsonResponse {
        [
            'tenant' => $tenant,
            'scope' => $scope,
        ] = $this->context(
            $request,
            $scopeResolver
        );

        $row =
            $this->authorization(
                (int) $tenant->id,
                $scope,
                $authorizationId
            );

        if ($row->status !== 'submitted') {
            throw ValidationException::withMessages([
                'status' => [
                    'Only submitted authorizations can be approved.',
                ],
            ]);
        }

        $maker =
            $row->submitted_by
            ?? $row->created_by;

        if (
            (
(int) $maker
            ===
            (int) $request
                ->user()
                ->id
            )
            && ! \App\Support\MakerCheckerExemptionPolicy::allows(
                            (int) (auth()->id() ?? 0),
                            isset($tenantId)
                                ? (int) $tenantId
                                : null,
                            isset($branchId)
                                ? (int) $branchId
                                : null
                        )
        ) {
            throw ValidationException::withMessages([
                'approval' => [
                    'Maker/checker requires a different authorized user.',
                ],
            ]);
        }

        if (
            $row->credential_expiry_date
            <
            now()->toDateString()
        ) {
            throw ValidationException::withMessages([
                'credential_expiry_date' => [
                    'An expired professional credential cannot be approved.',
                ],
            ]);
        }

        DB::table(
            'hrm_pharmacy_workforce_authorizations'
        )
            ->where(
                'id',
                $row->id
            )
            ->update([
                'status' =>
                    'approved',

                'approved_by' =>
                    $request
                        ->user()
                        ->id,

                'approved_at' =>
                    now(),

                'updated_at' =>
                    now(),
            ]);

        $this->audit(
            $audit,
            $scope,
            'hrm.pharmacy_workforce.authorization.approved',
            'hrm_pharmacy_workforce_authorization',
            $row->id,
            [
                'authorization_id' =>
                    $row->id,
            ]
        );

        return response()->json([
            'message' =>
                'Pharmacy workforce authorization approved.',
        ]);
    }

    public function rejectAuthorization(
        Request $request,
        int $authorizationId,
        ScopeResolver $scopeResolver,
        AuditLogService $audit
    ): JsonResponse {
        [
            'tenant' => $tenant,
            'scope' => $scope,
        ] = $this->context(
            $request,
            $scopeResolver
        );

        $validated =
            $request->validate([
                'reason' => [
                    'required',
                    'string',
                    'max:3000',
                ],
            ]);

        $row =
            $this->authorization(
                (int) $tenant->id,
                $scope,
                $authorizationId
            );

        if ($row->status !== 'submitted') {
            throw ValidationException::withMessages([
                'status' => [
                    'Only submitted authorizations can be rejected.',
                ],
            ]);
        }

        $maker =
            $row->submitted_by
            ?? $row->created_by;

        if (
            (
(int) $maker
            ===
            (int) $request
                ->user()
                ->id
            )
            && ! \App\Support\MakerCheckerExemptionPolicy::allows(
                            (int) (auth()->id() ?? 0),
                            isset($tenantId)
                                ? (int) $tenantId
                                : null,
                            isset($branchId)
                                ? (int) $branchId
                                : null
                        )
        ) {
            throw ValidationException::withMessages([
                'approval' => [
                    'Maker/checker requires a different authorized user.',
                ],
            ]);
        }

        DB::table(
            'hrm_pharmacy_workforce_authorizations'
        )
            ->where(
                'id',
                $row->id
            )
            ->update([
                'status' =>
                    'rejected',

                'rejected_by' =>
                    $request
                        ->user()
                        ->id,

                'rejected_at' =>
                    now(),

                'rejection_reason' =>
                    $validated['reason'],

                'updated_at' =>
                    now(),
            ]);

        $this->audit(
            $audit,
            $scope,
            'hrm.pharmacy_workforce.authorization.rejected',
            'hrm_pharmacy_workforce_authorization',
            $row->id,
            [
                'authorization_id' =>
                    $row->id,
            ]
        );

        return response()->json([
            'message' =>
                'Authorization rejected.',
        ]);
    }

    public function endAuthorization(
        Request $request,
        int $authorizationId,
        ScopeResolver $scopeResolver,
        AuditLogService $audit
    ): JsonResponse {
        [
            'tenant' => $tenant,
            'scope' => $scope,
        ] = $this->context(
            $request,
            $scopeResolver
        );

        $validated =
            $request->validate([
                'effective_to' => [
                    'required',
                    'date',
                ],

                'reason' => [
                    'required',
                    'string',
                    'max:3000',
                ],
            ]);

        $row =
            $this->authorization(
                (int) $tenant->id,
                $scope,
                $authorizationId
            );

        if ($row->status !== 'approved') {
            throw ValidationException::withMessages([
                'status' => [
                    'Only approved authorizations can be ended.',
                ],
            ]);
        }

        if (
            $validated['effective_to']
            <
            $row->effective_from
        ) {
            throw ValidationException::withMessages([
                'effective_to' => [
                    'End date cannot precede authorization start date.',
                ],
            ]);
        }

        DB::table(
            'hrm_pharmacy_workforce_authorizations'
        )
            ->where(
                'id',
                $row->id
            )
            ->update([
                'status' =>
                    'ended',

                'effective_to' =>
                    $validated[
                        'effective_to'
                    ],

                'ended_by' =>
                    $request
                        ->user()
                        ->id,

                'ended_at' =>
                    now(),

                'end_reason' =>
                    $validated['reason'],

                'updated_at' =>
                    now(),
            ]);

        $this->audit(
            $audit,
            $scope,
            'hrm.pharmacy_workforce.authorization.ended',
            'hrm_pharmacy_workforce_authorization',
            $row->id,
            [
                'authorization_id' =>
                    $row->id,

                'effective_to' =>
                    $validated[
                        'effective_to'
                    ],
            ]
        );

        return response()->json([
            'message' =>
                'Authorization ended.',
        ]);
    }


    # ============================================================
    # RESPONSIBLE PHARMACIST
    # ============================================================

    public function createResponsibleAssignment(
        Request $request,
        ScopeResolver $scopeResolver,
        AuditLogService $audit
    ): JsonResponse {
        [
            'tenant' => $tenant,
            'scope' => $scope,
        ] = $this->context(
            $request,
            $scopeResolver
        );

        $validated =
            $request->validate([
                'branch_id' => [
                    'required',
                    'integer',
                ],

                'employee_id' => [
                    'required',
                    'integer',
                ],

                'effective_from' => [
                    'required',
                    'date',
                ],

                'effective_to' => [
                    'nullable',
                    'date',
                ],
            ]);

        $tenantId =
            (int) $tenant->id;

        $employee =
            $this->employee(
                $tenantId,
                $scope,
                (int)
                $validated['employee_id']
            );

        $branchId =
            $this->resolveBranch(
                $tenantId,
                $scope,
                (int)
                $validated['branch_id']
            );

        if (
            !empty(
                $validated['effective_to']
            )
            &&
            $validated['effective_to']
            <
            $validated['effective_from']
        ) {
            throw ValidationException::withMessages([
                'effective_to' => [
                    'Assignment end date cannot precede its start date.',
                ],
            ]);
        }

        $id =
            DB::table(
                'hrm_pharmacy_responsible_assignments'
            )
                ->insertGetId([
                    'uuid' =>
                        (string) Str::uuid(),

                    'tenant_id' =>
                        $tenantId,

                    'branch_id' =>
                        $branchId,

                    'employee_id' =>
                        $employee->id,

                    'assignment_role' =>
                        'responsible_pharmacist',

                    'effective_from' =>
                        $validated[
                            'effective_from'
                        ],

                    'effective_to' =>
                        $validated[
                            'effective_to'
                        ]
                        ?? null,

                    'status' =>
                        'draft',

                    'created_by' =>
                        $request
                            ->user()
                            ->id,

                    'created_at' =>
                        now(),

                    'updated_at' =>
                        now(),
                ]);

        $this->audit(
            $audit,
            $scope,
            'hrm.pharmacy_workforce.responsible_pharmacist.created',
            'hrm_pharmacy_responsible_assignment',
            $id,
            [
                'assignment_id' =>
                    $id,

                'employee_id' =>
                    $employee->id,

                'branch_id' =>
                    $branchId,
            ]
        );

        return response()->json([
            'message' =>
                'Responsible Pharmacist assignment created as draft.',

            'assignment_id' =>
                $id,
        ], 201);
    }

    public function submitResponsibleAssignment(
        Request $request,
        int $assignmentId,
        ScopeResolver $scopeResolver,
        AuditLogService $audit
    ): JsonResponse {
        [
            'tenant' => $tenant,
            'scope' => $scope,
        ] = $this->context(
            $request,
            $scopeResolver
        );

        $row =
            $this->responsibleAssignment(
                (int) $tenant->id,
                $scope,
                $assignmentId
            );

        if ($row->status !== 'draft') {
            throw ValidationException::withMessages([
                'status' => [
                    'Only draft Responsible Pharmacist assignments can be submitted.',
                ],
            ]);
        }

        DB::table(
            'hrm_pharmacy_responsible_assignments'
        )
            ->where(
                'id',
                $row->id
            )
            ->update([
                'status' =>
                    'submitted',

                'submitted_by' =>
                    $request
                        ->user()
                        ->id,

                'submitted_at' =>
                    now(),

                'updated_at' =>
                    now(),
            ]);

        $this->audit(
            $audit,
            $scope,
            'hrm.pharmacy_workforce.responsible_pharmacist.submitted',
            'hrm_pharmacy_responsible_assignment',
            $row->id,
            [
                'assignment_id' =>
                    $row->id,
            ]
        );

        return response()->json([
            'message' =>
                'Responsible Pharmacist assignment submitted.',
        ]);
    }

    public function approveResponsibleAssignment(
        Request $request,
        int $assignmentId,
        ScopeResolver $scopeResolver,
        AuditLogService $audit
    ): JsonResponse {
        [
            'tenant' => $tenant,
            'scope' => $scope,
        ] = $this->context(
            $request,
            $scopeResolver
        );

        $tenantId =
            (int) $tenant->id;

        $row =
            $this->responsibleAssignment(
                $tenantId,
                $scope,
                $assignmentId
            );

        if ($row->status !== 'submitted') {
            throw ValidationException::withMessages([
                'status' => [
                    'Only submitted Responsible Pharmacist assignments can be approved.',
                ],
            ]);
        }

        $maker =
            $row->submitted_by
            ?? $row->created_by;

        if (
            (
(int) $maker
            ===
            (int) $request
                ->user()
                ->id
            )
            && ! \App\Support\MakerCheckerExemptionPolicy::allows(
                            (int) (auth()->id() ?? 0),
                            isset($tenantId)
                                ? (int) $tenantId
                                : null,
                            isset($branchId)
                                ? (int) $branchId
                                : null
                        )
        ) {
            throw ValidationException::withMessages([
                'approval' => [
                    'Maker/checker requires a different authorized user.',
                ],
            ]);
        }

        /*
         * A Responsible Pharmacist must have an approved, unexpired
         * pharmacist-supervision authorization for this same branch.
         */
        $authorization =
            DB::table(
                'hrm_pharmacy_workforce_authorizations'
            )
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->where(
                    'branch_id',
                    $row->branch_id
                )
                ->where(
                    'employee_id',
                    $row->employee_id
                )
                ->where(
                    'professional_category',
                    'pharmacist'
                )
                ->where(
                    'regulated_function',
                    'pharmacist_supervision'
                )
                ->where(
                    'status',
                    'approved'
                )
                ->where(
                    'credential_expiry_date',
                    '>=',
                    $row->effective_from
                )
                ->where(
                    'effective_from',
                    '<=',
                    $row->effective_from
                )
                ->where(
                    function ($query) use ($row) {
                        $query
                            ->whereNull(
                                'effective_to'
                            )
                            ->orWhere(
                                'effective_to',
                                '>=',
                                $row->effective_from
                            );
                    }
                )
                ->exists();

        if (!$authorization) {
            throw ValidationException::withMessages([
                'employee_id' => [
                    'Responsible Pharmacist approval requires a current approved pharmacist-supervision authorization for this branch.',
                ],
            ]);
        }

        /*
         * Correct interval-overlap test.
         */
        $overlap =
            DB::table(
                'hrm_pharmacy_responsible_assignments'
            )
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->where(
                    'branch_id',
                    $row->branch_id
                )
                ->where(
                    'status',
                    'approved'
                )
                ->where(
                    'id',
                    '!=',
                    $row->id
                )
                ->where(
                    function ($query) use ($row) {
                        if (
                            $row->effective_to
                            !== null
                        ) {
                            $query->where(
                                'effective_from',
                                '<=',
                                $row->effective_to
                            );
                        }
                    }
                )
                ->where(
                    function ($query) use ($row) {
                        $query
                            ->whereNull(
                                'effective_to'
                            )
                            ->orWhere(
                                'effective_to',
                                '>=',
                                $row->effective_from
                            );
                    }
                )
                ->exists();

        if ($overlap) {
            throw ValidationException::withMessages([
                'branch_id' => [
                    'This branch already has an overlapping approved Responsible Pharmacist assignment.',
                ],
            ]);
        }

        DB::table(
            'hrm_pharmacy_responsible_assignments'
        )
            ->where(
                'id',
                $row->id
            )
            ->update([
                'status' =>
                    'approved',

                'approved_by' =>
                    $request
                        ->user()
                        ->id,

                'approved_at' =>
                    now(),

                'updated_at' =>
                    now(),
            ]);

        $this->audit(
            $audit,
            $scope,
            'hrm.pharmacy_workforce.responsible_pharmacist.approved',
            'hrm_pharmacy_responsible_assignment',
            $row->id,
            [
                'assignment_id' =>
                    $row->id,

                'employee_id' =>
                    $row->employee_id,

                'branch_id' =>
                    $row->branch_id,
            ]
        );

        return response()->json([
            'message' =>
                'Responsible Pharmacist assignment approved.',
        ]);
    }

    public function rejectResponsibleAssignment(
        Request $request,
        int $assignmentId,
        ScopeResolver $scopeResolver,
        AuditLogService $audit
    ): JsonResponse {
        [
            'tenant' => $tenant,
            'scope' => $scope,
        ] = $this->context(
            $request,
            $scopeResolver
        );

        $validated =
            $request->validate([
                'reason' => [
                    'required',
                    'string',
                    'max:3000',
                ],
            ]);

        $row =
            $this->responsibleAssignment(
                (int) $tenant->id,
                $scope,
                $assignmentId
            );

        if ($row->status !== 'submitted') {
            throw ValidationException::withMessages([
                'status' => [
                    'Only submitted assignments can be rejected.',
                ],
            ]);
        }

        $maker =
            $row->submitted_by
            ?? $row->created_by;

        if (
            (
(int) $maker
            ===
            (int) $request
                ->user()
                ->id
            )
            && ! \App\Support\MakerCheckerExemptionPolicy::allows(
                            (int) (auth()->id() ?? 0),
                            isset($tenantId)
                                ? (int) $tenantId
                                : null,
                            isset($branchId)
                                ? (int) $branchId
                                : null
                        )
        ) {
            throw ValidationException::withMessages([
                'approval' => [
                    'Maker/checker requires a different authorized user.',
                ],
            ]);
        }

        DB::table(
            'hrm_pharmacy_responsible_assignments'
        )
            ->where(
                'id',
                $row->id
            )
            ->update([
                'status' =>
                    'rejected',

                'rejected_by' =>
                    $request
                        ->user()
                        ->id,

                'rejected_at' =>
                    now(),

                'rejection_reason' =>
                    $validated['reason'],

                'updated_at' =>
                    now(),
            ]);

        $this->audit(
            $audit,
            $scope,
            'hrm.pharmacy_workforce.responsible_pharmacist.rejected',
            'hrm_pharmacy_responsible_assignment',
            $row->id,
            [
                'assignment_id' =>
                    $row->id,
            ]
        );

        return response()->json([
            'message' =>
                'Responsible Pharmacist assignment rejected.',
        ]);
    }

    public function endResponsibleAssignment(
        Request $request,
        int $assignmentId,
        ScopeResolver $scopeResolver,
        AuditLogService $audit
    ): JsonResponse {
        [
            'tenant' => $tenant,
            'scope' => $scope,
        ] = $this->context(
            $request,
            $scopeResolver
        );

        $validated =
            $request->validate([
                'effective_to' => [
                    'required',
                    'date',
                ],

                'reason' => [
                    'required',
                    'string',
                    'max:3000',
                ],
            ]);

        $row =
            $this->responsibleAssignment(
                (int) $tenant->id,
                $scope,
                $assignmentId
            );

        if ($row->status !== 'approved') {
            throw ValidationException::withMessages([
                'status' => [
                    'Only approved assignments can be ended.',
                ],
            ]);
        }

        if (
            $validated['effective_to']
            <
            $row->effective_from
        ) {
            throw ValidationException::withMessages([
                'effective_to' => [
                    'End date cannot precede assignment start date.',
                ],
            ]);
        }

        DB::table(
            'hrm_pharmacy_responsible_assignments'
        )
            ->where(
                'id',
                $row->id
            )
            ->update([
                'status' =>
                    'ended',

                'effective_to' =>
                    $validated[
                        'effective_to'
                    ],

                'ended_by' =>
                    $request
                        ->user()
                        ->id,

                'ended_at' =>
                    now(),

                'end_reason' =>
                    $validated['reason'],

                'updated_at' =>
                    now(),
            ]);

        $this->audit(
            $audit,
            $scope,
            'hrm.pharmacy_workforce.responsible_pharmacist.ended',
            'hrm_pharmacy_responsible_assignment',
            $row->id,
            [
                'assignment_id' =>
                    $row->id,

                'effective_to' =>
                    $validated[
                        'effective_to'
                    ],
            ]
        );

        return response()->json([
            'message' =>
                'Responsible Pharmacist assignment ended.',
        ]);
    }


    # ============================================================
    # COVERAGE
    # ============================================================

    public function createCoverageRequirement(
        Request $request,
        ScopeResolver $scopeResolver,
        AuditLogService $audit
    ): JsonResponse {
        [
            'tenant' => $tenant,
            'scope' => $scope,
        ] = $this->context(
            $request,
            $scopeResolver
        );

        $validated =
            $request->validate([
                'branch_id' => [
                    'required',
                    'integer',
                ],

                'regulated_function' => [
                    'required',
                    'in:dispensing,pharmacist_supervision,controlled_medicines,cold_chain,inventory_release,quality_assurance',
                ],

                'minimum_authorized_staff' => [
                    'required',
                    'integer',
                    'min:1',
                    'max:100',
                ],

                'effective_from' => [
                    'required',
                    'date',
                ],

                'effective_to' => [
                    'nullable',
                    'date',
                ],
            ]);

        if (
            !empty(
                $validated['effective_to']
            )
            &&
            $validated['effective_to']
            <
            $validated['effective_from']
        ) {
            throw ValidationException::withMessages([
                'effective_to' => [
                    'Requirement end date cannot precede its start date.',
                ],
            ]);
        }

        $tenantId =
            (int) $tenant->id;

        $branchId =
            $this->resolveBranch(
                $tenantId,
                $scope,
                (int)
                $validated['branch_id']
            );

        $query =
            DB::table(
                'hrm_pharmacy_coverage_requirements'
            )
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->where(
                    'branch_id',
                    $branchId
                )
                ->where(
                    'regulated_function',
                    $validated[
                        'regulated_function'
                    ]
                )
                ->where(
                    'status',
                    'active'
                )
                ->where(
                    function ($overlap) use (
                        $validated
                    ) {
                        if (
                            !empty(
                                $validated[
                                    'effective_to'
                                ]
                            )
                        ) {
                            $overlap->where(
                                'effective_from',
                                '<=',
                                $validated[
                                    'effective_to'
                                ]
                            );
                        }
                    }
                )
                ->where(
                    function ($overlap) use (
                        $validated
                    ) {
                        $overlap
                            ->whereNull(
                                'effective_to'
                            )
                            ->orWhere(
                                'effective_to',
                                '>=',
                                $validated[
                                    'effective_from'
                                ]
                            );
                    }
                );

        if ($query->exists()) {
            throw ValidationException::withMessages([
                'regulated_function' => [
                    'An overlapping active staffing requirement already exists for this branch and function.',
                ],
            ]);
        }

        $id =
            DB::table(
                'hrm_pharmacy_coverage_requirements'
            )
                ->insertGetId([
                    'uuid' =>
                        (string) Str::uuid(),

                    'tenant_id' =>
                        $tenantId,

                    'branch_id' =>
                        $branchId,

                    'regulated_function' =>
                        $validated[
                            'regulated_function'
                        ],

                    'minimum_authorized_staff' =>
                        $validated[
                            'minimum_authorized_staff'
                        ],

                    'effective_from' =>
                        $validated[
                            'effective_from'
                        ],

                    'effective_to' =>
                        $validated[
                            'effective_to'
                        ]
                        ?? null,

                    'status' =>
                        'active',

                    'created_by' =>
                        $request
                            ->user()
                            ->id,

                    'created_at' =>
                        now(),

                    'updated_at' =>
                        now(),
                ]);

        $this->audit(
            $audit,
            $scope,
            'hrm.pharmacy_workforce.coverage_requirement.created',
            'hrm_pharmacy_coverage_requirement',
            $id,
            [
                'requirement_id' =>
                    $id,

                'branch_id' =>
                    $branchId,

                'regulated_function' =>
                    $validated[
                        'regulated_function'
                    ],

                'minimum_authorized_staff' =>
                    $validated[
                        'minimum_authorized_staff'
                    ],
            ]
        );

        return response()->json([
            'message' =>
                'Authorized staffing requirement created.',

            'requirement_id' =>
                $id,
        ], 201);
    }

    public function endCoverageRequirement(
        Request $request,
        int $requirementId,
        ScopeResolver $scopeResolver,
        AuditLogService $audit
    ): JsonResponse {
        [
            'tenant' => $tenant,
            'scope' => $scope,
        ] = $this->context(
            $request,
            $scopeResolver
        );

        $validated =
            $request->validate([
                'effective_to' => [
                    'required',
                    'date',
                ],
            ]);

        $row =
            $this->coverageRequirement(
                (int) $tenant->id,
                $scope,
                $requirementId
            );

        if ($row->status !== 'active') {
            throw ValidationException::withMessages([
                'status' => [
                    'Only active coverage requirements can be ended.',
                ],
            ]);
        }

        if (
            $validated['effective_to']
            <
            $row->effective_from
        ) {
            throw ValidationException::withMessages([
                'effective_to' => [
                    'End date cannot precede requirement start date.',
                ],
            ]);
        }

        DB::table(
            'hrm_pharmacy_coverage_requirements'
        )
            ->where(
                'id',
                $row->id
            )
            ->update([
                'status' =>
                    'ended',

                'effective_to' =>
                    $validated[
                        'effective_to'
                    ],

                'ended_by' =>
                    $request
                        ->user()
                        ->id,

                'ended_at' =>
                    now(),

                'updated_at' =>
                    now(),
            ]);

        $this->audit(
            $audit,
            $scope,
            'hrm.pharmacy_workforce.coverage_requirement.ended',
            'hrm_pharmacy_coverage_requirement',
            $row->id,
            [
                'requirement_id' =>
                    $row->id,
            ]
        );

        return response()->json([
            'message' =>
                'Coverage requirement ended.',
        ]);
    }


    # ============================================================
    # COMPLIANCE EXCEPTIONS
    # ============================================================

    public function createException(
        Request $request,
        ScopeResolver $scopeResolver,
        AuditLogService $audit
    ): JsonResponse {
        [
            'tenant' => $tenant,
            'scope' => $scope,
        ] = $this->context(
            $request,
            $scopeResolver
        );

        $validated =
            $request->validate([
                'branch_id' => [
                    'nullable',
                    'integer',
                ],

                'employee_id' => [
                    'nullable',
                    'integer',
                ],

                'exception_type' => [
                    'required',
                    'in:expired_credential,coverage_gap,responsible_pharmacist_gap,training_gap,authorization_gap,other',
                ],

                'severity' => [
                    'required',
                    'in:low,medium,high,critical',
                ],

                'details' => [
                    'required',
                    'string',
                    'max:10000',
                ],

                'due_date' => [
                    'nullable',
                    'date',
                ],
            ]);

        $tenantId =
            (int) $tenant->id;

        $branchId = null;

        if (
            !empty(
                $validated['branch_id']
            )
        ) {
            $branchId =
                $this->resolveBranch(
                    $tenantId,
                    $scope,
                    (int)
                    $validated['branch_id']
                );
        } elseif (
            $this->branchId(
                $scope
            ) !== null
        ) {
            $branchId =
                $this->branchId(
                    $scope
                );
        }

        if (
            !empty(
                $validated['employee_id']
            )
        ) {
            $this->employee(
                $tenantId,
                $scope,
                (int)
                $validated['employee_id']
            );
        }

        $id =
            DB::table(
                'hrm_pharmacy_compliance_exceptions'
            )
                ->insertGetId([
                    'uuid' =>
                        (string) Str::uuid(),

                    'tenant_id' =>
                        $tenantId,

                    'branch_id' =>
                        $branchId,

                    'employee_id' =>
                        $validated[
                            'employee_id'
                        ]
                        ?? null,

                    'exception_type' =>
                        $validated[
                            'exception_type'
                        ],

                    'severity' =>
                        $validated[
                            'severity'
                        ],

                    'detail_payload' =>
                        Crypt::encryptString(
                            json_encode([
                                'details' =>
                                    $validated[
                                        'details'
                                    ],
                            ])
                        ),

                    'due_date' =>
                        $validated[
                            'due_date'
                        ]
                        ?? null,

                    'status' =>
                        'open',

                    'opened_by' =>
                        $request
                            ->user()
                            ->id,

                    'created_at' =>
                        now(),

                    'updated_at' =>
                        now(),
                ]);

        $this->audit(
            $audit,
            $scope,
            'hrm.pharmacy_compliance.exception.created',
            'hrm_pharmacy_compliance_exception',
            $id,
            [
                'exception_id' =>
                    $id,

                'exception_type' =>
                    $validated[
                        'exception_type'
                    ],

                'severity' =>
                    $validated[
                        'severity'
                    ],
            ],
            'restricted'
        );

        return response()->json([
            'message' =>
                'Pharmacy workforce compliance exception recorded.',

            'exception_id' =>
                $id,
        ], 201);
    }

    public function resolveException(
        Request $request,
        int $exceptionId,
        ScopeResolver $scopeResolver,
        AuditLogService $audit
    ): JsonResponse {
        [
            'tenant' => $tenant,
            'scope' => $scope,
        ] = $this->context(
            $request,
            $scopeResolver
        );

        $validated =
            $request->validate([
                'resolution' => [
                    'required',
                    'string',
                    'max:10000',
                ],
            ]);

        $row =
            $this->exception(
                (int) $tenant->id,
                $scope,
                $exceptionId
            );

        if ($row->status !== 'open') {
            throw ValidationException::withMessages([
                'status' => [
                    'Only open exceptions can be resolved.',
                ],
            ]);
        }

        DB::table(
            'hrm_pharmacy_compliance_exceptions'
        )
            ->where(
                'id',
                $row->id
            )
            ->update([
                'status' =>
                    'resolved',

                'resolution_payload' =>
                    Crypt::encryptString(
                        json_encode([
                            'resolution' =>
                                $validated[
                                    'resolution'
                                ],
                        ])
                    ),

                'resolved_by' =>
                    $request
                        ->user()
                        ->id,

                'resolved_at' =>
                    now(),

                'updated_at' =>
                    now(),
            ]);

        $this->audit(
            $audit,
            $scope,
            'hrm.pharmacy_compliance.exception.resolved',
            'hrm_pharmacy_compliance_exception',
            $row->id,
            [
                'exception_id' =>
                    $row->id,
            ],
            'restricted'
        );

        return response()->json([
            'message' =>
                'Compliance exception resolved.',
        ]);
    }


    # ============================================================
    # SCOPE HELPERS
    # ============================================================

    private function context(
        Request $request,
        ScopeResolver $scopeResolver
    ): array {
        return $this
            ->tenantContext
            ->resolve(
                $request,
                $scopeResolver
            );
    }

    private function branchId(
        $scope
    ): ?int {
        if (
            $scope->isBranch()
            &&
            $scope->branchId !== null
        ) {
            return
                (int)
                $scope->branchId;
        }

        return null;
    }

    private function resolveBranch(
        int $tenantId,
        $scope,
        int $branchId
    ): int {
        $scopeBranchId =
            $this->branchId(
                $scope
            );

        if (
            $scopeBranchId !== null
            &&
            $scopeBranchId !==
            $branchId
        ) {
            abort(403);
        }

        $exists =
            DB::table(
                'branches'
            )
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->where(
                    'id',
                    $branchId
                )
                ->exists();

        if (!$exists) {
            abort(404);
        }

        return $branchId;
    }

    private function employee(
        int $tenantId,
        $scope,
        int $employeeId
    ): object {
        $query =
            DB::table(
                'hrm_employees'
            )
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->where(
                    'id',
                    $employeeId
                );

        $branchId =
            $this->branchId(
                $scope
            );

        if ($branchId !== null) {
            $query->where(
                'home_branch_id',
                $branchId
            );
        }

        $row =
            $query->first();

        if (!$row) {
            abort(404);
        }

        return $row;
    }

    private function authorization(
        int $tenantId,
        $scope,
        int $id
    ): object {
        $query =
            DB::table(
                'hrm_pharmacy_workforce_authorizations'
            )
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->where(
                    'id',
                    $id
                );

        $branchId =
            $this->branchId(
                $scope
            );

        if ($branchId !== null) {
            $query->where(
                'branch_id',
                $branchId
            );
        }

        $row =
            $query->first();

        if (!$row) {
            abort(404);
        }

        return $row;
    }

    private function responsibleAssignment(
        int $tenantId,
        $scope,
        int $id
    ): object {
        $query =
            DB::table(
                'hrm_pharmacy_responsible_assignments'
            )
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->where(
                    'id',
                    $id
                );

        $branchId =
            $this->branchId(
                $scope
            );

        if ($branchId !== null) {
            $query->where(
                'branch_id',
                $branchId
            );
        }

        $row =
            $query->first();

        if (!$row) {
            abort(404);
        }

        return $row;
    }

    private function coverageRequirement(
        int $tenantId,
        $scope,
        int $id
    ): object {
        $query =
            DB::table(
                'hrm_pharmacy_coverage_requirements'
            )
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->where(
                    'id',
                    $id
                );

        $branchId =
            $this->branchId(
                $scope
            );

        if ($branchId !== null) {
            $query->where(
                'branch_id',
                $branchId
            );
        }

        $row =
            $query->first();

        if (!$row) {
            abort(404);
        }

        return $row;
    }

    private function exception(
        int $tenantId,
        $scope,
        int $id
    ): object {
        $query =
            DB::table(
                'hrm_pharmacy_compliance_exceptions'
            )
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->where(
                    'id',
                    $id
                );

        $branchId =
            $this->branchId(
                $scope
            );

        if ($branchId !== null) {
            $query->where(
                'branch_id',
                $branchId
            );
        }

        $row =
            $query->first();

        if (!$row) {
            abort(404);
        }

        return $row;
    }

    private function decrypt(
        ?string $payload
    ): array {
        if (!$payload) {
            return [];
        }

        try {
            $value =
                json_decode(
                    Crypt::decryptString(
                        $payload
                    ),
                    true
                );

            return
                is_array($value)
                    ?
                    $value
                    :
                    [];
        } catch (Throwable) {
            return [];
        }
    }

    private function audit(
        AuditLogService $audit,
        $scope,
        string $action,
        string $type,
        int $id,
        array $metadata,
        string $classification = 'internal'
    ): void {
        $audit->record(
            action:
                $action,

            scope:
                $scope,

            metadata:
                $metadata,

            dataClassification:
                $classification,

            auditableType:
                $type,

            auditableId:
                $id
        );
    }
}
