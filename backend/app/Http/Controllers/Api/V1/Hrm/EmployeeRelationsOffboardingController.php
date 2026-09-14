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

class EmployeeRelationsOffboardingController extends Controller
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
            $this->branchId($scope);

        $employees =
            DB::table('hrm_employees')
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
                ->orderBy('employee_number')
                ->get([
                    'id',
                    'employee_number',
                    'first_name',
                    'last_name',
                    'home_branch_id',
                    'current_position_id',
                    'manager_employee_id',
                    'employment_status',
                ]);

        $employeeIds =
            $employees
                ->pluck('id')
                ->values();

        $cases =
            $employeeIds->isEmpty()
                ? collect()
                : DB::table(
                    'hrm_employee_relation_cases as c'
                )
                    ->join(
                        'hrm_employees as e',
                        'e.id',
                        '=',
                        'c.employee_id'
                    )
                    ->where(
                        'c.tenant_id',
                        $tenantId
                    )
                    ->whereIn(
                        'c.employee_id',
                        $employeeIds
                    )
                    ->orderByDesc('c.id')
                    ->get([
                        'c.*',
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

                            $row->summary =
                                $detail['summary']
                                ?? null;

                            $row->details =
                                $detail['details']
                                ?? null;

                            $row->resolution =
                                $resolution['resolution']
                                ?? null;

                            return $row;
                        }
                    );

        $caseIds =
            $cases
                ->pluck('id')
                ->values();

        $notes =
            $caseIds->isEmpty()
                ? collect()
                : DB::table(
                    'hrm_employee_relation_case_notes'
                )
                    ->where(
                        'tenant_id',
                        $tenantId
                    )
                    ->whereIn(
                        'case_id',
                        $caseIds
                    )
                    ->orderByDesc('id')
                    ->get()
                    ->map(
                        function ($row) {
                            $payload =
                                $this->decrypt(
                                    $row->note_payload
                                );

                            unset(
                                $row->note_payload
                            );

                            $row->content =
                                $payload['content']
                                ?? null;

                            return $row;
                        }
                    );

        $actions =
            $caseIds->isEmpty()
                ? collect()
                : DB::table(
                    'hrm_employee_relation_actions'
                )
                    ->where(
                        'tenant_id',
                        $tenantId
                    )
                    ->whereIn(
                        'case_id',
                        $caseIds
                    )
                    ->orderByDesc('id')
                    ->get()
                    ->map(
                        function ($row) {
                            $detail =
                                $this->decrypt(
                                    $row->detail_payload
                                );

                            $outcome =
                                $this->decrypt(
                                    $row->outcome_payload
                                );

                            unset(
                                $row->detail_payload,
                                $row->outcome_payload
                            );

                            $row->details =
                                $detail['details']
                                ?? null;

                            $row->outcome =
                                $outcome['outcome']
                                ?? null;

                            return $row;
                        }
                    );

        $hearings =
            $caseIds->isEmpty()
                ? collect()
                : DB::table(
                    'hrm_employee_relation_hearings'
                )
                    ->where(
                        'tenant_id',
                        $tenantId
                    )
                    ->whereIn(
                        'case_id',
                        $caseIds
                    )
                    ->orderByDesc('id')
                    ->get()
                    ->map(
                        function ($row) {
                            $outcome =
                                $this->decrypt(
                                    $row->outcome_payload
                                );

                            unset(
                                $row->outcome_payload
                            );

                            $row->outcome =
                                $outcome['outcome']
                                ?? null;

                            return $row;
                        }
                    );

        $offboarding =
            $employeeIds->isEmpty()
                ? collect()
                : DB::table(
                    'hrm_offboarding_cases as o'
                )
                    ->join(
                        'hrm_employees as e',
                        'e.id',
                        '=',
                        'o.employee_id'
                    )
                    ->where(
                        'o.tenant_id',
                        $tenantId
                    )
                    ->whereIn(
                        'o.employee_id',
                        $employeeIds
                    )
                    ->orderByDesc('o.id')
                    ->get([
                        'o.*',
                        'e.employee_number',
                        'e.first_name',
                        'e.last_name',
                    ])
                    ->map(
                        function ($row) {
                            $reason =
                                $this->decrypt(
                                    $row->reason_payload
                                );

                            unset(
                                $row->reason_payload
                            );

                            $row->reason =
                                $reason['reason']
                                ?? null;

                            return $row;
                        }
                    );

        $offboardingIds =
            $offboarding
                ->pluck('id')
                ->values();

        $clearance =
            $offboardingIds->isEmpty()
                ? collect()
                : DB::table(
                    'hrm_offboarding_clearance_items'
                )
                    ->where(
                        'tenant_id',
                        $tenantId
                    )
                    ->whereIn(
                        'offboarding_id',
                        $offboardingIds
                    )
                    ->orderBy('offboarding_id')
                    ->orderBy('id')
                    ->get();

        $exitInterviews =
            $offboardingIds->isEmpty()
                ? collect()
                : DB::table(
                    'hrm_offboarding_exit_interviews'
                )
                    ->where(
                        'tenant_id',
                        $tenantId
                    )
                    ->whereIn(
                        'offboarding_id',
                        $offboardingIds
                    )
                    ->orderByDesc('id')
                    ->get()
                    ->map(
                        function ($row) {
                            $feedback =
                                $this->decrypt(
                                    $row->feedback_payload
                                );

                            unset(
                                $row->feedback_payload
                            );

                            $row->feedback =
                                $feedback['feedback']
                                ?? null;

                            return $row;
                        }
                    );

        $accessActions =
            $offboardingIds->isEmpty()
                ? collect()
                : DB::table(
                    'hrm_offboarding_access_actions'
                )
                    ->where(
                        'tenant_id',
                        $tenantId
                    )
                    ->whereIn(
                        'offboarding_id',
                        $offboardingIds
                    )
                    ->orderBy('offboarding_id')
                    ->orderBy('id')
                    ->get();

        return response()->json([
            'summary' => [
                'open_relation_cases' =>
                    $cases
                        ->whereNotIn(
                            'status',
                            ['closed']
                        )
                        ->count(),

                'relation_approvals' =>
                    $cases
                        ->where(
                            'status',
                            'submitted'
                        )
                        ->count(),

                'active_offboarding' =>
                    $offboarding
                        ->whereIn(
                            'status',
                            [
                                'draft',
                                'submitted',
                                'approved',
                            ]
                        )
                        ->count(),

                'offboarding_approvals' =>
                    $offboarding
                        ->where(
                            'status',
                            'submitted'
                        )
                        ->count(),

                'clearance_pending' =>
                    $clearance
                        ->where(
                            'status',
                            '!=',
                            'verified'
                        )
                        ->count(),

                'exit_interviews' =>
                    $exitInterviews->count(),

                'access_actions_pending' =>
                    $accessActions
                        ->where(
                            'status',
                            'pending'
                        )
                        ->count(),
            ],

            'employees' =>
                $employees,

            'relation_cases' =>
                $cases,

            'relation_notes' =>
                $notes,

            'relation_actions' =>
                $actions,

            'relation_hearings' =>
                $hearings,

            'offboarding_cases' =>
                $offboarding,

            'clearance_items' =>
                $clearance,

            'exit_interviews' =>
                $exitInterviews,

            'access_actions' =>
                $accessActions,

            'controls' => [
                'employee_relations_maker_checker' =>
                    true,

                'offboarding_maker_checker' =>
                    true,

                'clearance_checker' =>
                    true,

                'automatic_account_revocation' =>
                    false,

                'automatic_final_payroll' =>
                    false,

                'automatic_payroll_approval' =>
                    false,

                'compensation_history_write' =>
                    false,

                'finance_posting' =>
                    false,
            ],
        ]);
    }


    # ============================================================
    # EMPLOYEE RELATIONS
    # ============================================================

    public function createRelationCase(
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

                'case_number' => [
                    'required',
                    'string',
                    'max:100',
                ],

                'case_type' => [
                    'required',
                    'in:grievance,disciplinary,conduct,workplace,investigation,other',
                ],

                'severity' => [
                    'required',
                    'in:low,medium,high,critical',
                ],

                'confidentiality' => [
                    'required',
                    'in:restricted,high',
                ],

                'summary' => [
                    'required',
                    'string',
                    'max:1000',
                ],

                'details' => [
                    'required',
                    'string',
                    'max:10000',
                ],
            ]);

        $tenantId =
            (int) $tenant->id;

        $employee =
            $this->employee(
                $tenantId,
                $scope,
                $validated['employee_id']
            );

        if (
            DB::table(
                'hrm_employee_relation_cases'
            )
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->where(
                    'case_number',
                    $validated['case_number']
                )
                ->exists()
        ) {
            throw ValidationException::withMessages([
                'case_number' => [
                    'This employee relations case number already exists.',
                ],
            ]);
        }

        $id =
            DB::table(
                'hrm_employee_relation_cases'
            )
                ->insertGetId([
                    'uuid' =>
                        (string) Str::uuid(),

                    'tenant_id' =>
                        $tenantId,

                    'branch_id' =>
                        $employee->home_branch_id,

                    'employee_id' =>
                        $employee->id,

                    'case_number' =>
                        $validated['case_number'],

                    'case_type' =>
                        $validated['case_type'],

                    'severity' =>
                        $validated['severity'],

                    'confidentiality' =>
                        $validated['confidentiality'],

                    'detail_payload' =>
                        Crypt::encryptString(
                            json_encode([
                                'summary' =>
                                    $validated['summary'],

                                'details' =>
                                    $validated['details'],
                            ])
                        ),

                    'status' =>
                        'draft',

                    'created_by' =>
                        $request->user()->id,

                    'created_at' =>
                        now(),

                    'updated_at' =>
                        now(),
                ]);

        $this->audit(
            $audit,
            $scope,
            'hrm.employee_relations.case.created',
            'hrm_employee_relation_case',
            $id,
            [
                'case_id' =>
                    $id,

                'employee_id' =>
                    $employee->id,

                'case_type' =>
                    $validated['case_type'],

                'confidentiality' =>
                    $validated['confidentiality'],
            ],
            'restricted'
        );

        return response()->json([
            'message' =>
                'Employee relations case created as draft.',

            'case_id' =>
                $id,
        ], 201);
    }

    public function submitRelationCase(
        Request $request,
        int $caseId,
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

        $case =
            $this->relationCase(
                (int) $tenant->id,
                $scope,
                $caseId
            );

        if (
            $case->status !==
            'draft'
        ) {
            throw ValidationException::withMessages([
                'status' => [
                    'Only draft employee relations cases can be submitted.',
                ],
            ]);
        }

        DB::table(
            'hrm_employee_relation_cases'
        )
            ->where(
                'id',
                $case->id
            )
            ->update([
                'status' =>
                    'submitted',

                'submitted_by' =>
                    $request->user()->id,

                'submitted_at' =>
                    now(),

                'updated_at' =>
                    now(),
            ]);

        $this->audit(
            $audit,
            $scope,
            'hrm.employee_relations.case.submitted',
            'hrm_employee_relation_case',
            $case->id,
            [
                'case_id' =>
                    $case->id,
            ],
            'restricted'
        );

        return response()->json([
            'message' =>
                'Employee relations case submitted for approval.',
        ]);
    }

    public function approveRelationCase(
        Request $request,
        int $caseId,
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

        $case =
            $this->relationCase(
                (int) $tenant->id,
                $scope,
                $caseId
            );

        if (
            $case->status !==
            'submitted'
        ) {
            throw ValidationException::withMessages([
                'status' => [
                    'Only submitted employee relations cases can be approved.',
                ],
            ]);
        }

        $maker =
            $case->submitted_by
            ??
            $case->created_by;

        if (
            (
(int) $maker
            ===
            (int) $request->user()->id
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
                    'Maker/checker requires another authorized user.',
                ],
            ]);
        }

        DB::table(
            'hrm_employee_relation_cases'
        )
            ->where(
                'id',
                $case->id
            )
            ->update([
                'status' =>
                    'approved',

                'approved_by' =>
                    $request->user()->id,

                'approved_at' =>
                    now(),

                'updated_at' =>
                    now(),
            ]);

        $this->audit(
            $audit,
            $scope,
            'hrm.employee_relations.case.approved',
            'hrm_employee_relation_case',
            $case->id,
            [
                'case_id' =>
                    $case->id,
            ],
            'restricted'
        );

        return response()->json([
            'message' =>
                'Employee relations case approved.',
        ]);
    }

    public function addRelationNote(
        Request $request,
        int $caseId,
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
                'note_type' => [
                    'required',
                    'in:internal,employee_statement,manager_note,investigation_note',
                ],

                'content' => [
                    'required',
                    'string',
                    'max:10000',
                ],
            ]);

        $case =
            $this->relationCase(
                (int) $tenant->id,
                $scope,
                $caseId
            );

        if (
            $case->status ===
            'closed'
        ) {
            throw ValidationException::withMessages([
                'status' => [
                    'A closed employee relations case cannot receive new notes.',
                ],
            ]);
        }

        $id =
            DB::table(
                'hrm_employee_relation_case_notes'
            )
                ->insertGetId([
                    'uuid' =>
                        (string) Str::uuid(),

                    'tenant_id' =>
                        $tenant->id,

                    'case_id' =>
                        $case->id,

                    'note_type' =>
                        $validated['note_type'],

                    'note_payload' =>
                        Crypt::encryptString(
                            json_encode([
                                'content' =>
                                    $validated['content'],
                            ])
                        ),

                    'created_by' =>
                        $request->user()->id,

                    'created_at' =>
                        now(),

                    'updated_at' =>
                        now(),
                ]);

        $this->audit(
            $audit,
            $scope,
            'hrm.employee_relations.note.created',
            'hrm_employee_relation_case_note',
            $id,
            [
                'case_id' =>
                    $case->id,

                'note_id' =>
                    $id,

                'note_type' =>
                    $validated['note_type'],
            ],
            'restricted'
        );

        return response()->json([
            'message' =>
                'Confidential case note recorded.',

            'note_id' =>
                $id,
        ], 201);
    }

    public function createRelationAction(
        Request $request,
        int $caseId,
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
                'action_type' => [
                    'required',
                    'in:warning,coaching,investigation,mediation,corrective_action,suspension_recommendation,other',
                ],

                'title' => [
                    'required',
                    'string',
                    'max:191',
                ],

                'details' => [
                    'nullable',
                    'string',
                    'max:5000',
                ],

                'due_date' => [
                    'nullable',
                    'date',
                ],
            ]);

        $case =
            $this->relationCase(
                (int) $tenant->id,
                $scope,
                $caseId
            );

        if (
            $case->status !==
            'approved'
        ) {
            throw ValidationException::withMessages([
                'status' => [
                    'Actions can only be added to an approved employee relations case.',
                ],
            ]);
        }

        $id =
            DB::table(
                'hrm_employee_relation_actions'
            )
                ->insertGetId([
                    'uuid' =>
                        (string) Str::uuid(),

                    'tenant_id' =>
                        $tenant->id,

                    'case_id' =>
                        $case->id,

                    'action_type' =>
                        $validated['action_type'],

                    'title' =>
                        $validated['title'],

                    'detail_payload' =>
                        !empty(
                            $validated['details']
                        )
                            ?
                            Crypt::encryptString(
                                json_encode([
                                    'details' =>
                                        $validated['details'],
                                ])
                            )
                            :
                            null,

                    'due_date' =>
                        $validated['due_date']
                        ?? null,

                    'status' =>
                        'pending',

                    'created_by' =>
                        $request->user()->id,

                    'created_at' =>
                        now(),

                    'updated_at' =>
                        now(),
                ]);

        $this->audit(
            $audit,
            $scope,
            'hrm.employee_relations.action.created',
            'hrm_employee_relation_action',
            $id,
            [
                'case_id' =>
                    $case->id,

                'action_id' =>
                    $id,

                'action_type' =>
                    $validated['action_type'],
            ],
            'restricted'
        );

        return response()->json([
            'message' =>
                'Employee relations action created.',

            'action_id' =>
                $id,
        ], 201);
    }

    public function completeRelationAction(
        Request $request,
        int $actionId,
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
                'outcome' => [
                    'required',
                    'string',
                    'max:5000',
                ],
            ]);

        $action =
            $this->relationAction(
                (int) $tenant->id,
                $scope,
                $actionId
            );

        if (
            !in_array(
                $action->status,
                [
                    'pending',
                    'in_progress',
                ],
                true
            )
        ) {
            throw ValidationException::withMessages([
                'status' => [
                    'Only active employee relations actions can be completed.',
                ],
            ]);
        }

        DB::table(
            'hrm_employee_relation_actions'
        )
            ->where(
                'id',
                $action->id
            )
            ->update([
                'status' =>
                    'completed',

                'outcome_payload' =>
                    Crypt::encryptString(
                        json_encode([
                            'outcome' =>
                                $validated['outcome'],
                        ])
                    ),

                'completed_by' =>
                    $request->user()->id,

                'completed_at' =>
                    now(),

                'updated_at' =>
                    now(),
            ]);

        $this->audit(
            $audit,
            $scope,
            'hrm.employee_relations.action.completed',
            'hrm_employee_relation_action',
            $action->id,
            [
                'case_id' =>
                    $action->case_id,

                'action_id' =>
                    $action->id,
            ],
            'restricted'
        );

        return response()->json([
            'message' =>
                'Employee relations action completed.',
        ]);
    }

    public function scheduleHearing(
        Request $request,
        int $caseId,
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
                'hearing_type' => [
                    'required',
                    'in:disciplinary,grievance,investigation,mediation,other',
                ],

                'scheduled_at' => [
                    'required',
                    'date',
                ],

                'chair_employee_id' => [
                    'nullable',
                    'integer',
                ],
            ]);

        $tenantId =
            (int) $tenant->id;

        $case =
            $this->relationCase(
                $tenantId,
                $scope,
                $caseId
            );

        if (
            $case->status !==
            'approved'
        ) {
            throw ValidationException::withMessages([
                'status' => [
                    'Hearings can only be scheduled for approved cases.',
                ],
            ]);
        }

        if (
            !empty(
                $validated['chair_employee_id']
            )
        ) {
            $this->employee(
                $tenantId,
                $scope,
                $validated['chair_employee_id']
            );
        }

        $id =
            DB::table(
                'hrm_employee_relation_hearings'
            )
                ->insertGetId([
                    'uuid' =>
                        (string) Str::uuid(),

                    'tenant_id' =>
                        $tenantId,

                    'case_id' =>
                        $case->id,

                    'hearing_type' =>
                        $validated['hearing_type'],

                    'scheduled_at' =>
                        $validated['scheduled_at'],

                    'chair_employee_id' =>
                        $validated['chair_employee_id']
                        ?? null,

                    'status' =>
                        'scheduled',

                    'created_by' =>
                        $request->user()->id,

                    'created_at' =>
                        now(),

                    'updated_at' =>
                        now(),
                ]);

        $this->audit(
            $audit,
            $scope,
            'hrm.employee_relations.hearing.scheduled',
            'hrm_employee_relation_hearing',
            $id,
            [
                'case_id' =>
                    $case->id,

                'hearing_id' =>
                    $id,
            ],
            'restricted'
        );

        return response()->json([
            'message' =>
                'Employee relations hearing scheduled.',

            'hearing_id' =>
                $id,
        ], 201);
    }

    public function completeHearing(
        Request $request,
        int $hearingId,
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
                'outcome' => [
                    'required',
                    'string',
                    'max:10000',
                ],
            ]);

        $hearing =
            $this->relationHearing(
                (int) $tenant->id,
                $scope,
                $hearingId
            );

        if (
            $hearing->status !==
            'scheduled'
        ) {
            throw ValidationException::withMessages([
                'status' => [
                    'Only scheduled hearings can be completed.',
                ],
            ]);
        }

        DB::table(
            'hrm_employee_relation_hearings'
        )
            ->where(
                'id',
                $hearing->id
            )
            ->update([
                'status' =>
                    'completed',

                'outcome_payload' =>
                    Crypt::encryptString(
                        json_encode([
                            'outcome' =>
                                $validated['outcome'],
                        ])
                    ),

                'completed_by' =>
                    $request->user()->id,

                'completed_at' =>
                    now(),

                'updated_at' =>
                    now(),
            ]);

        $this->audit(
            $audit,
            $scope,
            'hrm.employee_relations.hearing.completed',
            'hrm_employee_relation_hearing',
            $hearing->id,
            [
                'case_id' =>
                    $hearing->case_id,

                'hearing_id' =>
                    $hearing->id,
            ],
            'restricted'
        );

        return response()->json([
            'message' =>
                'Employee relations hearing completed.',
        ]);
    }

    public function closeRelationCase(
        Request $request,
        int $caseId,
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

        $case =
            $this->relationCase(
                (int) $tenant->id,
                $scope,
                $caseId
            );

        if (
            $case->status !==
            'approved'
        ) {
            throw ValidationException::withMessages([
                'status' => [
                    'Only approved employee relations cases can be closed.',
                ],
            ]);
        }

        $openActions =
            DB::table(
                'hrm_employee_relation_actions'
            )
                ->where(
                    'tenant_id',
                    $tenant->id
                )
                ->where(
                    'case_id',
                    $case->id
                )
                ->whereNotIn(
                    'status',
                    [
                        'completed',
                        'cancelled',
                    ]
                )
                ->count();

        if ($openActions > 0) {
            throw ValidationException::withMessages([
                'actions' => [
                    'All employee relations actions must be completed before case closure.',
                ],
            ]);
        }

        $openHearings =
            DB::table(
                'hrm_employee_relation_hearings'
            )
                ->where(
                    'tenant_id',
                    $tenant->id
                )
                ->where(
                    'case_id',
                    $case->id
                )
                ->where(
                    'status',
                    'scheduled'
                )
                ->count();

        if ($openHearings > 0) {
            throw ValidationException::withMessages([
                'hearings' => [
                    'Scheduled hearings must be completed before case closure.',
                ],
            ]);
        }

        DB::table(
            'hrm_employee_relation_cases'
        )
            ->where(
                'id',
                $case->id
            )
            ->update([
                'status' =>
                    'closed',

                'resolution_payload' =>
                    Crypt::encryptString(
                        json_encode([
                            'resolution' =>
                                $validated['resolution'],
                        ])
                    ),

                'closed_by' =>
                    $request->user()->id,

                'closed_at' =>
                    now(),

                'updated_at' =>
                    now(),
            ]);

        $this->audit(
            $audit,
            $scope,
            'hrm.employee_relations.case.closed',
            'hrm_employee_relation_case',
            $case->id,
            [
                'case_id' =>
                    $case->id,
            ],
            'restricted'
        );

        return response()->json([
            'message' =>
                'Employee relations case closed.',
        ]);
    }


    # ============================================================
    # OFFBOARDING
    # ============================================================

    public function createOffboarding(
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

                'case_number' => [
                    'required',
                    'string',
                    'max:100',
                ],

                'separation_type' => [
                    'required',
                    'in:resignation,termination,retirement,redundancy,contract_end,other',
                ],

                'notice_date' => [
                    'nullable',
                    'date',
                ],

                'last_working_date' => [
                    'required',
                    'date',
                ],

                'reason' => [
                    'required',
                    'string',
                    'max:10000',
                ],
            ]);

        $tenantId =
            (int) $tenant->id;

        $employee =
            $this->employee(
                $tenantId,
                $scope,
                $validated['employee_id']
            );

        if (
            !empty(
                $validated['notice_date']
            )
            &&
            $validated['last_working_date']
                <
                $validated['notice_date']
        ) {
            throw ValidationException::withMessages([
                'last_working_date' => [
                    'Last working date cannot be before the notice date.',
                ],
            ]);
        }

        if (
            DB::table(
                'hrm_offboarding_cases'
            )
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->where(
                    'case_number',
                    $validated['case_number']
                )
                ->exists()
        ) {
            throw ValidationException::withMessages([
                'case_number' => [
                    'This offboarding case number already exists.',
                ],
            ]);
        }

        if (
            DB::table(
                'hrm_offboarding_cases'
            )
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->where(
                    'employee_id',
                    $employee->id
                )
                ->whereIn(
                    'status',
                    [
                        'draft',
                        'submitted',
                        'approved',
                    ]
                )
                ->exists()
        ) {
            throw ValidationException::withMessages([
                'employee_id' => [
                    'This employee already has an active offboarding case.',
                ],
            ]);
        }

        $id =
            DB::table(
                'hrm_offboarding_cases'
            )
                ->insertGetId([
                    'uuid' =>
                        (string) Str::uuid(),

                    'tenant_id' =>
                        $tenantId,

                    'branch_id' =>
                        $employee->home_branch_id,

                    'employee_id' =>
                        $employee->id,

                    'case_number' =>
                        $validated['case_number'],

                    'separation_type' =>
                        $validated['separation_type'],

                    'notice_date' =>
                        $validated['notice_date']
                        ?? null,

                    'last_working_date' =>
                        $validated['last_working_date'],

                    'reason_payload' =>
                        Crypt::encryptString(
                            json_encode([
                                'reason' =>
                                    $validated['reason'],
                            ])
                        ),

                    'status' =>
                        'draft',

                    'created_by' =>
                        $request->user()->id,

                    'created_at' =>
                        now(),

                    'updated_at' =>
                        now(),
                ]);

        $this->audit(
            $audit,
            $scope,
            'hrm.offboarding.case.created',
            'hrm_offboarding_case',
            $id,
            [
                'offboarding_id' =>
                    $id,

                'employee_id' =>
                    $employee->id,

                'separation_type' =>
                    $validated['separation_type'],
            ],
            'restricted'
        );

        return response()->json([
            'message' =>
                'Offboarding case created as draft.',

            'offboarding_id' =>
                $id,
        ], 201);
    }

    public function submitOffboarding(
        Request $request,
        int $offboardingId,
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

        $offboarding =
            $this->offboarding(
                (int) $tenant->id,
                $scope,
                $offboardingId
            );

        if (
            $offboarding->status !==
            'draft'
        ) {
            throw ValidationException::withMessages([
                'status' => [
                    'Only draft offboarding cases can be submitted.',
                ],
            ]);
        }

        DB::table(
            'hrm_offboarding_cases'
        )
            ->where(
                'id',
                $offboarding->id
            )
            ->update([
                'status' =>
                    'submitted',

                'submitted_by' =>
                    $request->user()->id,

                'submitted_at' =>
                    now(),

                'updated_at' =>
                    now(),
            ]);

        $this->audit(
            $audit,
            $scope,
            'hrm.offboarding.case.submitted',
            'hrm_offboarding_case',
            $offboarding->id,
            [
                'offboarding_id' =>
                    $offboarding->id,
            ],
            'restricted'
        );

        return response()->json([
            'message' =>
                'Offboarding case submitted for approval.',
        ]);
    }

    public function approveOffboarding(
        Request $request,
        int $offboardingId,
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

        $offboarding =
            $this->offboarding(
                (int) $tenant->id,
                $scope,
                $offboardingId
            );

        if (
            $offboarding->status !==
            'submitted'
        ) {
            throw ValidationException::withMessages([
                'status' => [
                    'Only submitted offboarding cases can be approved.',
                ],
            ]);
        }

        $maker =
            $offboarding->submitted_by
            ??
            $offboarding->created_by;

        if (
            (
(int) $maker
            ===
            (int) $request->user()->id
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
                    'Maker/checker requires another authorized user.',
                ],
            ]);
        }

        DB::transaction(
            function () use (
                $request,
                $tenant,
                $offboarding
            ) {
                DB::table(
                    'hrm_offboarding_cases'
                )
                    ->where(
                        'id',
                        $offboarding->id
                    )
                    ->update([
                        'status' =>
                            'approved',

                        'approved_by' =>
                            $request->user()->id,

                        'approved_at' =>
                            now(),

                        'updated_at' =>
                            now(),
                    ]);

                $existing =
                    DB::table(
                        'hrm_offboarding_clearance_items'
                    )
                        ->where(
                            'tenant_id',
                            $tenant->id
                        )
                        ->where(
                            'offboarding_id',
                            $offboarding->id
                        )
                        ->count();

                if ($existing === 0) {
                    $defaults = [
                        [
                            'category' =>
                                'assets',

                            'title' =>
                                'Return company assets',
                        ],

                        [
                            'category' =>
                                'handover',

                            'title' =>
                                'Complete work handover',
                        ],

                        [
                            'category' =>
                                'finance',

                            'title' =>
                                'Confirm advances and final-settlement inputs',
                        ],

                        [
                            'category' =>
                                'access',

                            'title' =>
                                'Confirm system access deactivation plan',
                        ],
                    ];

                    foreach ($defaults as $item) {
                        DB::table(
                            'hrm_offboarding_clearance_items'
                        )
                            ->insert([
                                'uuid' =>
                                    (string) Str::uuid(),

                                'tenant_id' =>
                                    $tenant->id,

                                'offboarding_id' =>
                                    $offboarding->id,

                                'category' =>
                                    $item['category'],

                                'title' =>
                                    $item['title'],

                                'status' =>
                                    'pending',

                                'created_by' =>
                                    $request->user()->id,

                                'created_at' =>
                                    now(),

                                'updated_at' =>
                                    now(),
                            ]);
                    }
                }
            }
        );

        $this->audit(
            $audit,
            $scope,
            'hrm.offboarding.case.approved',
            'hrm_offboarding_case',
            $offboarding->id,
            [
                'offboarding_id' =>
                    $offboarding->id,

                'automatic_final_payroll' =>
                    false,

                'automatic_account_revocation' =>
                    false,

                'finance_posting' =>
                    false,
            ],
            'restricted'
        );

        return response()->json([
            'message' =>
                'Offboarding case approved and clearance checklist created.',
        ]);
    }

    public function rejectOffboarding(
        Request $request,
        int $offboardingId,
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
                    'max:5000',
                ],
            ]);

        $offboarding =
            $this->offboarding(
                (int) $tenant->id,
                $scope,
                $offboardingId
            );

        if (
            $offboarding->status !==
            'submitted'
        ) {
            throw ValidationException::withMessages([
                'status' => [
                    'Only submitted offboarding cases can be rejected.',
                ],
            ]);
        }

        $maker =
            $offboarding->submitted_by
            ??
            $offboarding->created_by;

        if (
            (
(int) $maker
            ===
            (int) $request->user()->id
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
                    'Maker/checker requires another authorized user.',
                ],
            ]);
        }

        DB::table(
            'hrm_offboarding_cases'
        )
            ->where(
                'id',
                $offboarding->id
            )
            ->update([
                'status' =>
                    'rejected',

                'rejected_by' =>
                    $request->user()->id,

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
            'hrm.offboarding.case.rejected',
            'hrm_offboarding_case',
            $offboarding->id,
            [
                'offboarding_id' =>
                    $offboarding->id,
            ],
            'restricted'
        );

        return response()->json([
            'message' =>
                'Offboarding case rejected.',
        ]);
    }

    public function createClearanceItem(
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
                'offboarding_id' => [
                    'required',
                    'integer',
                ],

                'category' => [
                    'required',
                    'in:assets,handover,finance,access,documents,other',
                ],

                'title' => [
                    'required',
                    'string',
                    'max:191',
                ],

                'reference' => [
                    'nullable',
                    'string',
                    'max:191',
                ],

                'assigned_employee_id' => [
                    'nullable',
                    'integer',
                ],
            ]);

        $tenantId =
            (int) $tenant->id;

        $offboarding =
            $this->offboarding(
                $tenantId,
                $scope,
                $validated['offboarding_id']
            );

        if (
            $offboarding->status !==
            'approved'
        ) {
            throw ValidationException::withMessages([
                'offboarding_id' => [
                    'Clearance items can only be added to approved offboarding cases.',
                ],
            ]);
        }

        if (
            !empty(
                $validated['assigned_employee_id']
            )
        ) {
            $this->employee(
                $tenantId,
                $scope,
                $validated['assigned_employee_id']
            );
        }

        $id =
            DB::table(
                'hrm_offboarding_clearance_items'
            )
                ->insertGetId([
                    'uuid' =>
                        (string) Str::uuid(),

                    'tenant_id' =>
                        $tenantId,

                    'offboarding_id' =>
                        $offboarding->id,

                    'category' =>
                        $validated['category'],

                    'title' =>
                        $validated['title'],

                    'reference' =>
                        $validated['reference']
                        ?? null,

                    'assigned_employee_id' =>
                        $validated['assigned_employee_id']
                        ?? null,

                    'status' =>
                        'pending',

                    'created_by' =>
                        $request->user()->id,

                    'created_at' =>
                        now(),

                    'updated_at' =>
                        now(),
                ]);

        $this->audit(
            $audit,
            $scope,
            'hrm.offboarding.clearance.created',
            'hrm_offboarding_clearance_item',
            $id,
            [
                'offboarding_id' =>
                    $offboarding->id,

                'clearance_id' =>
                    $id,
            ]
        );

        return response()->json([
            'message' =>
                'Clearance item created.',

            'clearance_id' =>
                $id,
        ], 201);
    }

    public function completeClearanceItem(
        Request $request,
        int $clearanceId,
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
                'notes' => [
                    'nullable',
                    'string',
                    'max:5000',
                ],
            ]);

        $item =
            $this->clearance(
                (int) $tenant->id,
                $scope,
                $clearanceId
            );

        if (
            $item->status !==
            'pending'
        ) {
            throw ValidationException::withMessages([
                'status' => [
                    'Only pending clearance items can be completed.',
                ],
            ]);
        }

        DB::table(
            'hrm_offboarding_clearance_items'
        )
            ->where(
                'id',
                $item->id
            )
            ->update([
                'status' =>
                    'completed',

                'completion_notes' =>
                    $validated['notes']
                    ?? null,

                'completed_by' =>
                    $request->user()->id,

                'completed_at' =>
                    now(),

                'updated_at' =>
                    now(),
            ]);

        $this->audit(
            $audit,
            $scope,
            'hrm.offboarding.clearance.completed',
            'hrm_offboarding_clearance_item',
            $item->id,
            [
                'offboarding_id' =>
                    $item->offboarding_id,

                'clearance_id' =>
                    $item->id,
            ]
        );

        return response()->json([
            'message' =>
                'Clearance item completed and awaiting verification.',
        ]);
    }

    public function verifyClearanceItem(
        Request $request,
        int $clearanceId,
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

        $item =
            $this->clearance(
                (int) $tenant->id,
                $scope,
                $clearanceId
            );

        if (
            $item->status !==
            'completed'
        ) {
            throw ValidationException::withMessages([
                'status' => [
                    'Only completed clearance items can be verified.',
                ],
            ]);
        }

        if (
            (
(int) $item->completed_by
            ===
            (int) $request->user()->id
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
                'verification' => [
                    'Maker/checker requires another authorized user.',
                ],
            ]);
        }

        DB::table(
            'hrm_offboarding_clearance_items'
        )
            ->where(
                'id',
                $item->id
            )
            ->update([
                'status' =>
                    'verified',

                'verified_by' =>
                    $request->user()->id,

                'verified_at' =>
                    now(),

                'updated_at' =>
                    now(),
            ]);

        $this->audit(
            $audit,
            $scope,
            'hrm.offboarding.clearance.verified',
            'hrm_offboarding_clearance_item',
            $item->id,
            [
                'offboarding_id' =>
                    $item->offboarding_id,

                'clearance_id' =>
                    $item->id,
            ]
        );

        return response()->json([
            'message' =>
                'Clearance item verified.',
        ]);
    }

    public function recordExitInterview(
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
                'offboarding_id' => [
                    'required',
                    'integer',
                ],

                'interview_at' => [
                    'required',
                    'date',
                ],

                'interviewer_employee_id' => [
                    'nullable',
                    'integer',
                ],

                'feedback' => [
                    'required',
                    'string',
                    'max:10000',
                ],

                'rehire_eligible' => [
                    'required',
                    'boolean',
                ],
            ]);

        $tenantId =
            (int) $tenant->id;

        $offboarding =
            $this->offboarding(
                $tenantId,
                $scope,
                $validated['offboarding_id']
            );

        if (
            $offboarding->status !==
            'approved'
        ) {
            throw ValidationException::withMessages([
                'offboarding_id' => [
                    'Exit interviews can only be recorded for approved offboarding cases.',
                ],
            ]);
        }

        if (
            !empty(
                $validated['interviewer_employee_id']
            )
        ) {
            $this->employee(
                $tenantId,
                $scope,
                $validated['interviewer_employee_id']
            );
        }

        DB::table(
            'hrm_offboarding_exit_interviews'
        )
            ->updateOrInsert(
                [
                    'offboarding_id' =>
                        $offboarding->id,
                ],
                [
                    'uuid' =>
                        (string) Str::uuid(),

                    'tenant_id' =>
                        $tenantId,

                    'interview_at' =>
                        $validated['interview_at'],

                    'interviewer_employee_id' =>
                        $validated['interviewer_employee_id']
                        ?? null,

                    'feedback_payload' =>
                        Crypt::encryptString(
                            json_encode([
                                'feedback' =>
                                    $validated['feedback'],
                            ])
                        ),

                    'rehire_eligible' =>
                        (bool) $validated['rehire_eligible'],

                    'created_by' =>
                        $request->user()->id,

                    'created_at' =>
                        now(),

                    'updated_at' =>
                        now(),
                ]
            );

        $this->audit(
            $audit,
            $scope,
            'hrm.offboarding.exit_interview.recorded',
            'hrm_offboarding_case',
            $offboarding->id,
            [
                'offboarding_id' =>
                    $offboarding->id,

                'rehire_eligible' =>
                    (bool) $validated['rehire_eligible'],
            ],
            'restricted'
        );

        return response()->json([
            'message' =>
                'Exit interview recorded.',
        ]);
    }

    public function createAccessAction(
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
                'offboarding_id' => [
                    'required',
                    'integer',
                ],

                'access_type' => [
                    'required',
                    'in:user_account,email,application,vpn,device,physical_access,other',
                ],

                'system_name' => [
                    'required',
                    'string',
                    'max:191',
                ],

                'action' => [
                    'required',
                    'in:disable,revoke,transfer,archive,other',
                ],

                'evidence_reference' => [
                    'nullable',
                    'string',
                    'max:191',
                ],
            ]);

        $offboarding =
            $this->offboarding(
                (int) $tenant->id,
                $scope,
                $validated['offboarding_id']
            );

        if (
            $offboarding->status !==
            'approved'
        ) {
            throw ValidationException::withMessages([
                'offboarding_id' => [
                    'Access actions can only be created for approved offboarding cases.',
                ],
            ]);
        }

        $id =
            DB::table(
                'hrm_offboarding_access_actions'
            )
                ->insertGetId([
                    'uuid' =>
                        (string) Str::uuid(),

                    'tenant_id' =>
                        $tenant->id,

                    'offboarding_id' =>
                        $offboarding->id,

                    'access_type' =>
                        $validated['access_type'],

                    'system_name' =>
                        $validated['system_name'],

                    'action' =>
                        $validated['action'],

                    'evidence_reference' =>
                        $validated['evidence_reference']
                        ?? null,

                    'status' =>
                        'pending',

                    'created_by' =>
                        $request->user()->id,

                    'created_at' =>
                        now(),

                    'updated_at' =>
                        now(),
                ]);

        $this->audit(
            $audit,
            $scope,
            'hrm.offboarding.access_action.created',
            'hrm_offboarding_access_action',
            $id,
            [
                'offboarding_id' =>
                    $offboarding->id,

                'access_action_id' =>
                    $id,

                'automatic_account_revocation' =>
                    false,
            ]
        );

        return response()->json([
            'message' =>
                'Access-deactivation action recorded.',

            'access_action_id' =>
                $id,
        ], 201);
    }

    public function completeAccessAction(
        Request $request,
        int $accessActionId,
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
                'evidence_reference' => [
                    'nullable',
                    'string',
                    'max:191',
                ],
            ]);

        $action =
            $this->accessAction(
                (int) $tenant->id,
                $scope,
                $accessActionId
            );

        if (
            $action->status !==
            'pending'
        ) {
            throw ValidationException::withMessages([
                'status' => [
                    'Only pending access actions can be completed.',
                ],
            ]);
        }

        DB::table(
            'hrm_offboarding_access_actions'
        )
            ->where(
                'id',
                $action->id
            )
            ->update([
                'status' =>
                    'completed',

                'evidence_reference' =>
                    $validated['evidence_reference']
                    ??
                    $action->evidence_reference,

                'completed_by' =>
                    $request->user()->id,

                'completed_at' =>
                    now(),

                'updated_at' =>
                    now(),
            ]);

        $this->audit(
            $audit,
            $scope,
            'hrm.offboarding.access_action.completed',
            'hrm_offboarding_access_action',
            $action->id,
            [
                'offboarding_id' =>
                    $action->offboarding_id,

                'access_action_id' =>
                    $action->id,
            ]
        );

        return response()->json([
            'message' =>
                'Access-deactivation action completed.',
        ]);
    }

    public function finaliseOffboarding(
        Request $request,
        int $offboardingId,
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
                'final_settlement_reference' => [
                    'nullable',
                    'string',
                    'max:191',
                ],
            ]);

        $tenantId =
            (int) $tenant->id;

        $offboarding =
            $this->offboarding(
                $tenantId,
                $scope,
                $offboardingId
            );

        if (
            $offboarding->status !==
            'approved'
        ) {
            throw ValidationException::withMessages([
                'status' => [
                    'Only approved offboarding cases can be finalised.',
                ],
            ]);
        }

        if (
            $offboarding->last_working_date
            >
            now()->toDateString()
        ) {
            throw ValidationException::withMessages([
                'last_working_date' => [
                    'The employee cannot be finalised before the approved last working date.',
                ],
            ]);
        }

        $clearanceCount =
            DB::table(
                'hrm_offboarding_clearance_items'
            )
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->where(
                    'offboarding_id',
                    $offboarding->id
                )
                ->count();

        $unverified =
            DB::table(
                'hrm_offboarding_clearance_items'
            )
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->where(
                    'offboarding_id',
                    $offboarding->id
                )
                ->where(
                    'status',
                    '!=',
                    'verified'
                )
                ->count();

        if (
            $clearanceCount < 1
            ||
            $unverified > 0
        ) {
            throw ValidationException::withMessages([
                'clearance' => [
                    'Every clearance item must be verified before offboarding finalisation.',
                ],
            ]);
        }

        $pendingAccess =
            DB::table(
                'hrm_offboarding_access_actions'
            )
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->where(
                    'offboarding_id',
                    $offboarding->id
                )
                ->where(
                    'status',
                    '!=',
                    'completed'
                )
                ->count();

        if ($pendingAccess > 0) {
            throw ValidationException::withMessages([
                'access_actions' => [
                    'All recorded access actions must be completed before offboarding finalisation.',
                ],
            ]);
        }

        DB::transaction(
            function () use (
                $request,
                $tenantId,
                $offboarding,
                $validated
            ) {
                DB::table(
                    'hrm_offboarding_cases'
                )
                    ->where(
                        'id',
                        $offboarding->id
                    )
                    ->update([
                        'status' =>
                            'finalised',

                        'final_settlement_reference' =>
                            $validated[
                                'final_settlement_reference'
                            ] ?? null,

                        'finalised_by' =>
                            $request->user()->id,

                        'finalised_at' =>
                            now(),

                        'updated_at' =>
                            now(),
                    ]);

                DB::table(
                    'hrm_employees'
                )
                    ->where(
                        'tenant_id',
                        $tenantId
                    )
                    ->where(
                        'id',
                        $offboarding->employee_id
                    )
                    ->update([
                        'employment_status' =>
                            'terminated',

                        'termination_date' =>
                            $offboarding->last_working_date,

                        'updated_by' =>
                            $request->user()->id,

                        'updated_at' =>
                            now(),
                    ]);

                DB::table(
                    'hrm_employee_assignments'
                )
                    ->where(
                        'tenant_id',
                        $tenantId
                    )
                    ->where(
                        'employee_id',
                        $offboarding->employee_id
                    )
                    ->where(
                        'status',
                        'active'
                    )
                    ->update([
                        'status' =>
                            'ended',

                        'effective_to' =>
                            $offboarding->last_working_date,

                        'updated_by' =>
                            $request->user()->id,

                        'updated_at' =>
                            now(),
                    ]);

                DB::table(
                    'hrm_employee_contracts'
                )
                    ->where(
                        'tenant_id',
                        $tenantId
                    )
                    ->where(
                        'employee_id',
                        $offboarding->employee_id
                    )
                    ->where(
                        'status',
                        'active'
                    )
                    ->update([
                        'status' =>
                            'ended',

                        'end_date' =>
                            $offboarding->last_working_date,

                        'updated_by' =>
                            $request->user()->id,

                        'updated_at' =>
                            now(),
                    ]);
            }
        );

        $this->audit(
            $audit,
            $scope,
            'hrm.offboarding.case.finalised',
            'hrm_offboarding_case',
            $offboarding->id,
            [
                'offboarding_id' =>
                    $offboarding->id,

                'employee_id' =>
                    $offboarding->employee_id,

                'last_working_date' =>
                    $offboarding->last_working_date,

                'automatic_account_revocation' =>
                    false,

                'automatic_final_payroll' =>
                    false,

                'automatic_payroll_approval' =>
                    false,

                'compensation_history_write' =>
                    false,

                'finance_posting' =>
                    false,
            ],
            'restricted'
        );

        return response()->json([
            'message' =>
                'Employee offboarding finalised and employment history closed.',
        ]);
    }


    # ============================================================
    # SCOPED HELPERS
    # ============================================================

    private function context(
        Request $request,
        ScopeResolver $scopeResolver
    ): array {
        return $this->tenantContext
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
                (int) $scope->branchId;
        }

        return null;
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
            $this->branchId($scope);

        if ($branchId !== null) {
            $query->where(
                'home_branch_id',
                $branchId
            );
        }

        $employee =
            $query->first();

        if (!$employee) {
            abort(404);
        }

        return $employee;
    }

    private function relationCase(
        int $tenantId,
        $scope,
        int $caseId
    ): object {
        $query =
            DB::table(
                'hrm_employee_relation_cases as c'
            )
                ->join(
                    'hrm_employees as e',
                    'e.id',
                    '=',
                    'c.employee_id'
                )
                ->where(
                    'c.tenant_id',
                    $tenantId
                )
                ->where(
                    'c.id',
                    $caseId
                );

        $branchId =
            $this->branchId($scope);

        if ($branchId !== null) {
            $query->where(
                'e.home_branch_id',
                $branchId
            );
        }

        $row =
            $query->first([
                'c.*',
            ]);

        if (!$row) {
            abort(404);
        }

        return $row;
    }

    private function relationAction(
        int $tenantId,
        $scope,
        int $actionId
    ): object {
        $query =
            DB::table(
                'hrm_employee_relation_actions as a'
            )
                ->join(
                    'hrm_employee_relation_cases as c',
                    'c.id',
                    '=',
                    'a.case_id'
                )
                ->join(
                    'hrm_employees as e',
                    'e.id',
                    '=',
                    'c.employee_id'
                )
                ->where(
                    'a.tenant_id',
                    $tenantId
                )
                ->where(
                    'a.id',
                    $actionId
                );

        $branchId =
            $this->branchId($scope);

        if ($branchId !== null) {
            $query->where(
                'e.home_branch_id',
                $branchId
            );
        }

        $row =
            $query->first([
                'a.*',
            ]);

        if (!$row) {
            abort(404);
        }

        return $row;
    }

    private function relationHearing(
        int $tenantId,
        $scope,
        int $hearingId
    ): object {
        $query =
            DB::table(
                'hrm_employee_relation_hearings as h'
            )
                ->join(
                    'hrm_employee_relation_cases as c',
                    'c.id',
                    '=',
                    'h.case_id'
                )
                ->join(
                    'hrm_employees as e',
                    'e.id',
                    '=',
                    'c.employee_id'
                )
                ->where(
                    'h.tenant_id',
                    $tenantId
                )
                ->where(
                    'h.id',
                    $hearingId
                );

        $branchId =
            $this->branchId($scope);

        if ($branchId !== null) {
            $query->where(
                'e.home_branch_id',
                $branchId
            );
        }

        $row =
            $query->first([
                'h.*',
            ]);

        if (!$row) {
            abort(404);
        }

        return $row;
    }

    private function offboarding(
        int $tenantId,
        $scope,
        int $offboardingId
    ): object {
        $query =
            DB::table(
                'hrm_offboarding_cases as o'
            )
                ->join(
                    'hrm_employees as e',
                    'e.id',
                    '=',
                    'o.employee_id'
                )
                ->where(
                    'o.tenant_id',
                    $tenantId
                )
                ->where(
                    'o.id',
                    $offboardingId
                );

        $branchId =
            $this->branchId($scope);

        if ($branchId !== null) {
            $query->where(
                'e.home_branch_id',
                $branchId
            );
        }

        $row =
            $query->first([
                'o.*',
            ]);

        if (!$row) {
            abort(404);
        }

        return $row;
    }

    private function clearance(
        int $tenantId,
        $scope,
        int $clearanceId
    ): object {
        $query =
            DB::table(
                'hrm_offboarding_clearance_items as ci'
            )
                ->join(
                    'hrm_offboarding_cases as o',
                    'o.id',
                    '=',
                    'ci.offboarding_id'
                )
                ->join(
                    'hrm_employees as e',
                    'e.id',
                    '=',
                    'o.employee_id'
                )
                ->where(
                    'ci.tenant_id',
                    $tenantId
                )
                ->where(
                    'ci.id',
                    $clearanceId
                );

        $branchId =
            $this->branchId($scope);

        if ($branchId !== null) {
            $query->where(
                'e.home_branch_id',
                $branchId
            );
        }

        $row =
            $query->first([
                'ci.*',
            ]);

        if (!$row) {
            abort(404);
        }

        return $row;
    }

    private function accessAction(
        int $tenantId,
        $scope,
        int $accessActionId
    ): object {
        $query =
            DB::table(
                'hrm_offboarding_access_actions as aa'
            )
                ->join(
                    'hrm_offboarding_cases as o',
                    'o.id',
                    '=',
                    'aa.offboarding_id'
                )
                ->join(
                    'hrm_employees as e',
                    'e.id',
                    '=',
                    'o.employee_id'
                )
                ->where(
                    'aa.tenant_id',
                    $tenantId
                )
                ->where(
                    'aa.id',
                    $accessActionId
                );

        $branchId =
            $this->branchId($scope);

        if ($branchId !== null) {
            $query->where(
                'e.home_branch_id',
                $branchId
            );
        }

        $row =
            $query->first([
                'aa.*',
            ]);

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
            $decoded =
                json_decode(
                    Crypt::decryptString(
                        $payload
                    ),
                    true
                );

            return
                is_array($decoded)
                    ?
                    $decoded
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
