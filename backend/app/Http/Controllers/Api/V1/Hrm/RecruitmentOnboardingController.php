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

class RecruitmentOnboardingController extends Controller
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

        $tenantId = (int) $tenant->id;
        $branchId = $this->branchId($scope);

        $requisitions =
            DB::table('hrm_recruitment_requisitions as r')
                ->leftJoin(
                    'hrm_positions as p',
                    'p.id',
                    '=',
                    'r.position_id'
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
                ->orderByDesc('r.id')
                ->get([
                    'r.id',
                    'r.code',
                    'r.title',
                    'r.branch_id',
                    'r.department_id',
                    'r.position_id',
                    'r.job_grade_id',
                    'r.employment_type',
                    'r.openings',
                    'r.justification',
                    'r.target_start_date',
                    'r.status',
                    'r.created_by',
                    'r.submitted_by',
                    'r.submitted_at',
                    'r.approved_by',
                    'r.approved_at',
                    'r.rejected_at',
                    'r.rejection_reason',
                    'p.title as position_title',
                ]);

        $vacancies =
            DB::table('hrm_recruitment_vacancies as v')
                ->join(
                    'hrm_recruitment_requisitions as r',
                    'r.id',
                    '=',
                    'v.requisition_id'
                )
                ->where(
                    'v.tenant_id',
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
                ->orderByDesc('v.id')
                ->get([
                    'v.id',
                    'v.requisition_id',
                    'v.code',
                    'v.title',
                    'v.opened_at',
                    'v.closes_at',
                    'v.status',
                    'r.branch_id',
                    'r.position_id',
                ]);

        $applicationsQuery =
            DB::table('hrm_recruitment_applications as a')
                ->join(
                    'hrm_recruitment_candidates as c',
                    'c.id',
                    '=',
                    'a.candidate_id'
                )
                ->join(
                    'hrm_recruitment_vacancies as v',
                    'v.id',
                    '=',
                    'a.vacancy_id'
                )
                ->join(
                    'hrm_recruitment_requisitions as r',
                    'r.id',
                    '=',
                    'v.requisition_id'
                )
                ->where(
                    'a.tenant_id',
                    $tenantId
                )
                ->when(
                    $branchId !== null,
                    fn ($query) =>
                        $query->where(
                            'r.branch_id',
                            $branchId
                        )
                );

        $applications =
            (clone $applicationsQuery)
                ->orderByDesc('a.id')
                ->get([
                    'a.id',
                    'a.candidate_id',
                    'a.vacancy_id',
                    'a.stage',
                    'a.screening_notes',
                    'a.applied_at',
                    'a.shortlisted_at',
                    'a.rejected_at',
                    'a.rejection_reason',
                    'a.hired_employee_id',
                    'c.first_name',
                    'c.last_name',
                    'v.code as vacancy_code',
                    'v.title as vacancy_title',
                    'r.branch_id',
                ]);

        if ($branchId === null) {
            $candidates =
                DB::table('hrm_recruitment_candidates')
                    ->where(
                        'tenant_id',
                        $tenantId
                    )
                    ->orderByDesc('id')
                    ->get();
        } else {
            $candidateIds =
                $applications
                    ->pluck('candidate_id')
                    ->unique()
                    ->values();

            $candidates =
                DB::table('hrm_recruitment_candidates')
                    ->where(
                        'tenant_id',
                        $tenantId
                    )
                    ->whereIn(
                        'id',
                        $candidateIds
                    )
                    ->orderByDesc('id')
                    ->get();
        }

        $candidates =
            $candidates->map(
                function ($candidate) {
                    $contact =
                        $this->decrypt(
                            $candidate->contact_payload
                        );

                    unset(
                        $candidate->contact_payload,
                        $candidate->email_hash
                    );

                    $candidate->email =
                        $contact['email']
                        ?? null;

                    $candidate->phone =
                        $contact['phone']
                        ?? null;

                    return $candidate;
                }
            );

        $interviews =
            DB::table('hrm_recruitment_interviews as i')
                ->join(
                    'hrm_recruitment_applications as a',
                    'a.id',
                    '=',
                    'i.application_id'
                )
                ->join(
                    'hrm_recruitment_candidates as c',
                    'c.id',
                    '=',
                    'a.candidate_id'
                )
                ->join(
                    'hrm_recruitment_vacancies as v',
                    'v.id',
                    '=',
                    'a.vacancy_id'
                )
                ->join(
                    'hrm_recruitment_requisitions as r',
                    'r.id',
                    '=',
                    'v.requisition_id'
                )
                ->where(
                    'i.tenant_id',
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
                ->orderByDesc('i.id')
                ->get([
                    'i.id',
                    'i.application_id',
                    'i.interview_type',
                    'i.scheduled_at',
                    'i.interviewer_employee_id',
                    'i.status',
                    'i.score',
                    'i.feedback_payload',
                    'i.completed_at',
                    'c.first_name',
                    'c.last_name',
                    'v.title as vacancy_title',
                ])
                ->map(
                    function ($interview) {
                        $feedback =
                            $this->decrypt(
                                $interview->feedback_payload
                            );

                        unset(
                            $interview->feedback_payload
                        );

                        $interview->feedback =
                            $feedback['feedback']
                            ?? null;

                        $interview->recommendation =
                            $feedback['recommendation']
                            ?? null;

                        return $interview;
                    }
                );

        $offers =
            DB::table('hrm_recruitment_offers as o')
                ->join(
                    'hrm_recruitment_applications as a',
                    'a.id',
                    '=',
                    'o.application_id'
                )
                ->join(
                    'hrm_recruitment_candidates as c',
                    'c.id',
                    '=',
                    'a.candidate_id'
                )
                ->join(
                    'hrm_recruitment_vacancies as v',
                    'v.id',
                    '=',
                    'a.vacancy_id'
                )
                ->join(
                    'hrm_recruitment_requisitions as r',
                    'r.id',
                    '=',
                    'v.requisition_id'
                )
                ->where(
                    'o.tenant_id',
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
                ->orderByDesc('o.id')
                ->get([
                    'o.id',
                    'o.application_id',
                    'o.offer_number',
                    'o.start_date',
                    'o.employment_type',
                    'o.compensation_payload',
                    'o.probation_end_date',
                    'o.status',
                    'o.created_by',
                    'o.submitted_by',
                    'o.approved_by',
                    'o.accepted_at',
                    'c.first_name',
                    'c.last_name',
                    'v.title as vacancy_title',
                ])
                ->map(
                    function ($offer) {
                        $compensation =
                            $this->decrypt(
                                $offer->compensation_payload
                            );

                        unset(
                            $offer->compensation_payload
                        );

                        $offer->proposed_basic_salary =
                            $compensation[
                                'basic_salary'
                            ] ?? null;

                        $offer->currency =
                            $compensation[
                                'currency'
                            ] ?? null;

                        $offer->pay_frequency =
                            $compensation[
                                'pay_frequency'
                            ] ?? null;

                        return $offer;
                    }
                );

        $plans =
            DB::table('hrm_onboarding_plans as p')
                ->leftJoin(
                    'hrm_employees as e',
                    'e.id',
                    '=',
                    'p.employee_id'
                )
                ->where(
                    'p.tenant_id',
                    $tenantId
                )
                ->when(
                    $branchId !== null,
                    fn ($query) =>
                        $query->where(
                            'e.home_branch_id',
                            $branchId
                        )
                )
                ->orderByDesc('p.id')
                ->get([
                    'p.id',
                    'p.application_id',
                    'p.employee_id',
                    'p.title',
                    'p.start_date',
                    'p.target_completion_date',
                    'p.status',
                    'p.completed_at',
                    'e.employee_number',
                    'e.first_name',
                    'e.last_name',
                ]);

        $planIds =
            $plans
                ->pluck('id')
                ->values();

        $tasks =
            $planIds->isEmpty()
                ? collect()
                : DB::table('hrm_onboarding_tasks')
                    ->where(
                        'tenant_id',
                        $tenantId
                    )
                    ->whereIn(
                        'plan_id',
                        $planIds
                    )
                    ->orderBy('due_date')
                    ->orderBy('id')
                    ->get([
                        'id',
                        'plan_id',
                        'task_type',
                        'title',
                        'description',
                        'due_date',
                        'reference',
                        'assigned_employee_id',
                        'status',
                        'completed_by',
                        'completed_at',
                        'verified_by',
                        'verified_at',
                        'completion_notes',
                    ]);

        $positions =
            DB::table('hrm_positions')
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->where(
                    'status',
                    'active'
                )
                ->when(
                    $branchId !== null,
                    fn ($query) =>
                        $query->where(
                            'branch_id',
                            $branchId
                        )
                )
                ->orderBy('title')
                ->get([
                    'id',
                    'branch_id',
                    'department_id',
                    'job_grade_id',
                    'code',
                    'title',
                    'headcount_budget',
                ]);

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
                ]);

        return response()->json([
            'summary' => [
                'requisitions' =>
                    $requisitions->count(),

                'open_vacancies' =>
                    $vacancies
                        ->where(
                            'status',
                            'open'
                        )
                        ->count(),

                'active_candidates' =>
                    $candidates
                        ->where(
                            'status',
                            'active'
                        )
                        ->count(),

                'applications' =>
                    $applications->count(),

                'interviews_pending' =>
                    $interviews
                        ->where(
                            'status',
                            'scheduled'
                        )
                        ->count(),

                'offers_pending' =>
                    $offers
                        ->whereIn(
                            'status',
                            [
                                'draft',
                                'submitted',
                                'approved',
                            ]
                        )
                        ->count(),

                'onboarding_active' =>
                    $plans
                        ->where(
                            'status',
                            'active'
                        )
                        ->count(),
            ],

            'requisitions' =>
                $requisitions,

            'vacancies' =>
                $vacancies,

            'candidates' =>
                $candidates,

            'applications' =>
                $applications,

            'interviews' =>
                $interviews,

            'offers' =>
                $offers,

            'onboarding_plans' =>
                $plans,

            'onboarding_tasks' =>
                $tasks,

            'positions' =>
                $positions,

            'employees' =>
                $employees,

            'controls' => [
                'requisition_maker_checker' =>
                    true,

                'offer_maker_checker' =>
                    true,

                'onboarding_task_checker' =>
                    true,

                'compensation_history_write' =>
                    false,

                'automatic_payroll_recalculation' =>
                    false,

                'automatic_payroll_approval' =>
                    false,

                'finance_posting' =>
                    false,
            ],
        ]);
    }

    public function createRequisition(
        Request $request,
        ScopeResolver $scopeResolver,
        AuditLogService $auditLogService
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
                'code' => [
                    'required',
                    'string',
                    'max:100',
                ],

                'position_id' => [
                    'nullable',
                    'integer',
                ],

                'branch_id' => [
                    'nullable',
                    'integer',
                ],

                'department_id' => [
                    'nullable',
                    'integer',
                ],

                'job_grade_id' => [
                    'nullable',
                    'integer',
                ],

                'title' => [
                    'nullable',
                    'string',
                    'max:191',
                ],

                'employment_type' => [
                    'required',
                    'string',
                    'max:50',
                ],

                'openings' => [
                    'required',
                    'integer',
                    'min:1',
                    'max:100',
                ],

                'justification' => [
                    'required',
                    'string',
                    'max:5000',
                ],

                'target_start_date' => [
                    'nullable',
                    'date',
                ],
            ]);

        $tenantId =
            (int) $tenant->id;

        $branchId =
            $this->branchId($scope);

        $position = null;

        if (
            !empty(
                $validated[
                    'position_id'
                ]
            )
        ) {
            $position =
                DB::table('hrm_positions')
                    ->where(
                        'tenant_id',
                        $tenantId
                    )
                    ->where(
                        'id',
                        $validated[
                            'position_id'
                        ]
                    )
                    ->where(
                        'status',
                        'active'
                    )
                    ->first();

            if (!$position) {
                throw ValidationException::withMessages([
                    'position_id' => [
                        'The selected active position was not found in this tenant.',
                    ],
                ]);
            }

            if (
                $branchId !== null
                &&
                (int) (
                    $position->branch_id
                    ?? 0
                )
                !==
                $branchId
            ) {
                abort(403);
            }
        }

        $resolvedBranchId =
            $position
                ? $position->branch_id
                : (
                    $branchId
                    ??
                    ($validated['branch_id'] ?? null)
                );

        $title =
            trim(
                (string) (
                    $validated['title']
                    ??
                    $position?->title
                    ??
                    ''
                )
            );

        if ($title === '') {
            throw ValidationException::withMessages([
                'title' => [
                    'A requisition title is required.',
                ],
            ]);
        }

        $duplicate =
            DB::table(
                'hrm_recruitment_requisitions'
            )
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->where(
                    'code',
                    $validated['code']
                )
                ->exists();

        if ($duplicate) {
            throw ValidationException::withMessages([
                'code' => [
                    'This requisition code already exists.',
                ],
            ]);
        }

        $id =
            DB::table(
                'hrm_recruitment_requisitions'
            )
                ->insertGetId([
                    'uuid' =>
                        (string) Str::uuid(),

                    'tenant_id' =>
                        $tenantId,

                    'branch_id' =>
                        $resolvedBranchId,

                    'department_id' =>
                        $position?->department_id
                        ??
                        ($validated['department_id'] ?? null),

                    'position_id' =>
                        $position?->id
                        ??
                        null,

                    'job_grade_id' =>
                        $position?->job_grade_id
                        ??
                        ($validated['job_grade_id'] ?? null),

                    'code' =>
                        $validated['code'],

                    'title' =>
                        $title,

                    'employment_type' =>
                        $validated[
                            'employment_type'
                        ],

                    'openings' =>
                        $validated['openings'],

                    'justification' =>
                        $validated[
                            'justification'
                        ],

                    'target_start_date' =>
                        $validated[
                            'target_start_date'
                        ] ?? null,

                    'status' =>
                        'draft',

                    'created_by' =>
                        $request->user()->id,

                    'created_at' =>
                        now(),

                    'updated_at' =>
                        now(),
                ]);

        $auditLogService->record(
            action:
                'hrm.recruitment.requisition.created',

            scope:
                $scope,

            metadata: [
                'requisition_id' =>
                    $id,

                'position_id' =>
                    $position?->id,

                'branch_id' =>
                    $resolvedBranchId,

                'openings' =>
                    $validated['openings'],
            ],

            dataClassification:
                'internal',

            auditableType:
                'hrm_recruitment_requisition',

            auditableId:
                $id
        );

        return response()->json([
            'message' =>
                'Recruitment requisition created as draft.',

            'requisition_id' =>
                $id,
        ], 201);
    }

    public function submitRequisition(
        Request $request,
        int $requisitionId,
        ScopeResolver $scopeResolver,
        AuditLogService $auditLogService
    ): JsonResponse {
        [
            'tenant' => $tenant,
            'scope' => $scope,
        ] = $this->context(
            $request,
            $scopeResolver
        );

        $row =
            $this->requisition(
                (int) $tenant->id,
                $scope,
                $requisitionId
            );

        if (
            $row->status !==
            'draft'
        ) {
            throw ValidationException::withMessages([
                'status' => [
                    'Only draft requisitions can be submitted.',
                ],
            ]);
        }

        DB::table(
            'hrm_recruitment_requisitions'
        )
            ->where(
                'id',
                $row->id
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

        $auditLogService->record(
            action:
                'hrm.recruitment.requisition.submitted',

            scope:
                $scope,

            metadata: [
                'requisition_id' =>
                    $row->id,
            ],

            dataClassification:
                'internal',

            auditableType:
                'hrm_recruitment_requisition',

            auditableId:
                $row->id
        );

        return response()->json([
            'message' =>
                'Requisition submitted for approval.',
        ]);
    }

    public function approveRequisition(
        Request $request,
        int $requisitionId,
        ScopeResolver $scopeResolver,
        AuditLogService $auditLogService
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
            $this->requisition(
                $tenantId,
                $scope,
                $requisitionId
            );

        if (
            $row->status !==
            'submitted'
        ) {
            throw ValidationException::withMessages([
                'status' => [
                    'Only submitted requisitions can be approved.',
                ],
            ]);
        }

        $maker =
            $row->submitted_by
            ??
            $row->created_by;

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

        if ($row->position_id) {
            $position =
                DB::table('hrm_positions')
                    ->where(
                        'tenant_id',
                        $tenantId
                    )
                    ->where(
                        'id',
                        $row->position_id
                    )
                    ->first();

            if (!$position) {
                throw ValidationException::withMessages([
                    'position_id' => [
                        'The requisition position no longer exists.',
                    ],
                ]);
            }

            if (
                $position->headcount_budget
                !== null
                &&
                (int)
                $position->headcount_budget
                > 0
            ) {
                $occupied =
                    DB::table('hrm_employees')
                        ->where(
                            'tenant_id',
                            $tenantId
                        )
                        ->where(
                            'current_position_id',
                            $position->id
                        )
                        ->whereNotIn(
                            'employment_status',
                            [
                                'terminated',
                                'inactive',
                            ]
                        )
                        ->count();

                if (
                    $occupied
                    +
                    (int) $row->openings
                    >
                    (int)
                    $position->headcount_budget
                ) {
                    throw ValidationException::withMessages([
                        'openings' => [
                            'Approval would exceed the configured position headcount budget.',
                        ],
                    ]);
                }
            }
        }

        DB::table(
            'hrm_recruitment_requisitions'
        )
            ->where(
                'id',
                $row->id
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

        $auditLogService->record(
            action:
                'hrm.recruitment.requisition.approved',

            scope:
                $scope,

            metadata: [
                'requisition_id' =>
                    $row->id,
            ],

            dataClassification:
                'internal',

            auditableType:
                'hrm_recruitment_requisition',

            auditableId:
                $row->id
        );

        return response()->json([
            'message' =>
                'Requisition approved.',
        ]);
    }

    public function rejectRequisition(
        Request $request,
        int $requisitionId,
        ScopeResolver $scopeResolver,
        AuditLogService $auditLogService
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
                    'max:2000',
                ],
            ]);

        $row =
            $this->requisition(
                (int) $tenant->id,
                $scope,
                $requisitionId
            );

        if (
            $row->status !==
            'submitted'
        ) {
            throw ValidationException::withMessages([
                'status' => [
                    'Only submitted requisitions can be rejected.',
                ],
            ]);
        }

        $maker =
            $row->submitted_by
            ??
            $row->created_by;

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
            'hrm_recruitment_requisitions'
        )
            ->where(
                'id',
                $row->id
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

        $auditLogService->record(
            action:
                'hrm.recruitment.requisition.rejected',

            scope:
                $scope,

            metadata: [
                'requisition_id' =>
                    $row->id,
            ],

            dataClassification:
                'internal',

            auditableType:
                'hrm_recruitment_requisition',

            auditableId:
                $row->id
        );

        return response()->json([
            'message' =>
                'Requisition rejected.',
        ]);
    }

    public function createVacancy(
        Request $request,
        ScopeResolver $scopeResolver,
        AuditLogService $auditLogService
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
                'requisition_id' => [
                    'required',
                    'integer',
                ],

                'code' => [
                    'required',
                    'string',
                    'max:100',
                ],

                'title' => [
                    'nullable',
                    'string',
                    'max:191',
                ],

                'closes_at' => [
                    'nullable',
                    'date',
                    'after_or_equal:today',
                ],
            ]);

        $tenantId =
            (int) $tenant->id;

        $requisition =
            $this->requisition(
                $tenantId,
                $scope,
                $validated[
                    'requisition_id'
                ]
            );

        if (
            $requisition->status !==
            'approved'
        ) {
            throw ValidationException::withMessages([
                'requisition_id' => [
                    'Only approved requisitions can open vacancies.',
                ],
            ]);
        }

        if (
            DB::table(
                'hrm_recruitment_vacancies'
            )
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->where(
                    'code',
                    $validated['code']
                )
                ->exists()
        ) {
            throw ValidationException::withMessages([
                'code' => [
                    'This vacancy code already exists.',
                ],
            ]);
        }

        $id =
            DB::table(
                'hrm_recruitment_vacancies'
            )
                ->insertGetId([
                    'uuid' =>
                        (string) Str::uuid(),

                    'tenant_id' =>
                        $tenantId,

                    'requisition_id' =>
                        $requisition->id,

                    'code' =>
                        $validated['code'],

                    'title' =>
                        trim(
                            (string) (
                                $validated['title']
                                ??
                                $requisition->title
                            )
                        ),

                    'opened_at' =>
                        now(),

                    'closes_at' =>
                        $validated[
                            'closes_at'
                        ] ?? null,

                    'status' =>
                        'open',

                    'created_by' =>
                        $request->user()->id,

                    'created_at' =>
                        now(),

                    'updated_at' =>
                        now(),
                ]);

        $auditLogService->record(
            action:
                'hrm.recruitment.vacancy.opened',

            scope:
                $scope,

            metadata: [
                'vacancy_id' =>
                    $id,

                'requisition_id' =>
                    $requisition->id,
            ],

            dataClassification:
                'internal',

            auditableType:
                'hrm_recruitment_vacancy',

            auditableId:
                $id
        );

        return response()->json([
            'message' =>
                'Vacancy opened.',

            'vacancy_id' =>
                $id,
        ], 201);
    }

    public function createCandidate(
        Request $request,
        ScopeResolver $scopeResolver,
        AuditLogService $auditLogService
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
                'first_name' => [
                    'required',
                    'string',
                    'max:100',
                ],

                'last_name' => [
                    'required',
                    'string',
                    'max:100',
                ],

                'email' => [
                    'required',
                    'email',
                    'max:191',
                ],

                'phone' => [
                    'nullable',
                    'string',
                    'max:50',
                ],

                'source' => [
                    'nullable',
                    'string',
                    'max:50',
                ],

                'resume_reference' => [
                    'nullable',
                    'string',
                    'max:191',
                ],
            ]);

        $tenantId =
            (int) $tenant->id;

        $email =
            mb_strtolower(
                trim(
                    $validated['email']
                )
            );

        $hash =
            hash(
                'sha256',
                $email
            );

        if (
            DB::table(
                'hrm_recruitment_candidates'
            )
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->where(
                    'email_hash',
                    $hash
                )
                ->exists()
        ) {
            throw ValidationException::withMessages([
                'email' => [
                    'A candidate with this email already exists.',
                ],
            ]);
        }

        $id =
            DB::table(
                'hrm_recruitment_candidates'
            )
                ->insertGetId([
                    'uuid' =>
                        (string) Str::uuid(),

                    'tenant_id' =>
                        $tenantId,

                    'first_name' =>
                        trim(
                            $validated[
                                'first_name'
                            ]
                        ),

                    'last_name' =>
                        trim(
                            $validated[
                                'last_name'
                            ]
                        ),

                    'email_hash' =>
                        $hash,

                    'contact_payload' =>
                        Crypt::encryptString(
                            json_encode([
                                'email' =>
                                    $email,

                                'phone' =>
                                    $validated[
                                        'phone'
                                    ] ?? null,
                            ])
                        ),

                    'source' =>
                        $validated[
                            'source'
                        ] ?? 'direct',

                    'resume_reference' =>
                        $validated[
                            'resume_reference'
                        ] ?? null,

                    'status' =>
                        'active',

                    'created_by' =>
                        $request->user()->id,

                    'created_at' =>
                        now(),

                    'updated_at' =>
                        now(),
                ]);

        $auditLogService->record(
            action:
                'hrm.recruitment.candidate.created',

            scope:
                $scope,

            metadata: [
                'candidate_id' =>
                    $id,

                'source' =>
                    $validated[
                        'source'
                    ] ?? 'direct',
            ],

            dataClassification:
                'restricted',

            auditableType:
                'hrm_recruitment_candidate',

            auditableId:
                $id
        );

        return response()->json([
            'message' =>
                'Candidate created.',

            'candidate_id' =>
                $id,
        ], 201);
    }

    public function createApplication(
        Request $request,
        ScopeResolver $scopeResolver,
        AuditLogService $auditLogService
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
                'candidate_id' => [
                    'required',
                    'integer',
                ],

                'vacancy_id' => [
                    'required',
                    'integer',
                ],
            ]);

        $tenantId =
            (int) $tenant->id;

        $candidate =
            DB::table(
                'hrm_recruitment_candidates'
            )
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->where(
                    'id',
                    $validated[
                        'candidate_id'
                    ]
                )
                ->first();

        if (!$candidate) {
            throw ValidationException::withMessages([
                'candidate_id' => [
                    'Candidate was not found in this tenant.',
                ],
            ]);
        }

        $vacancy =
            $this->vacancy(
                $tenantId,
                $scope,
                $validated[
                    'vacancy_id'
                ]
            );

        if (
            $vacancy->status !==
            'open'
        ) {
            throw ValidationException::withMessages([
                'vacancy_id' => [
                    'Applications can only be added to an open vacancy.',
                ],
            ]);
        }

        if (
            $vacancy->closes_at
            &&
            $vacancy->closes_at
            <
            now()->toDateString()
        ) {
            throw ValidationException::withMessages([
                'vacancy_id' => [
                    'This vacancy has already closed.',
                ],
            ]);
        }

        if (
            DB::table(
                'hrm_recruitment_applications'
            )
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->where(
                    'candidate_id',
                    $candidate->id
                )
                ->where(
                    'vacancy_id',
                    $vacancy->id
                )
                ->exists()
        ) {
            throw ValidationException::withMessages([
                'candidate_id' => [
                    'This candidate already has an application for the vacancy.',
                ],
            ]);
        }

        $id =
            DB::table(
                'hrm_recruitment_applications'
            )
                ->insertGetId([
                    'uuid' =>
                        (string) Str::uuid(),

                    'tenant_id' =>
                        $tenantId,

                    'candidate_id' =>
                        $candidate->id,

                    'vacancy_id' =>
                        $vacancy->id,

                    'stage' =>
                        'applied',

                    'applied_at' =>
                        now(),

                    'created_by' =>
                        $request->user()->id,

                    'updated_by' =>
                        $request->user()->id,

                    'created_at' =>
                        now(),

                    'updated_at' =>
                        now(),
                ]);

        $auditLogService->record(
            action:
                'hrm.recruitment.application.created',

            scope:
                $scope,

            metadata: [
                'application_id' =>
                    $id,

                'candidate_id' =>
                    $candidate->id,

                'vacancy_id' =>
                    $vacancy->id,
            ],

            dataClassification:
                'restricted',

            auditableType:
                'hrm_recruitment_application',

            auditableId:
                $id
        );

        return response()->json([
            'message' =>
                'Application created.',

            'application_id' =>
                $id,
        ], 201);
    }

    public function moveApplication(
        Request $request,
        int $applicationId,
        ScopeResolver $scopeResolver,
        AuditLogService $auditLogService
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
                'stage' => [
                    'required',
                    'in:screened,shortlisted,rejected',
                ],

                'notes' => [
                    'nullable',
                    'string',
                    'max:3000',
                ],
            ]);

        $application =
            $this->application(
                (int) $tenant->id,
                $scope,
                $applicationId
            );

        $target =
            $validated['stage'];

        $allowed = [
            'applied' => [
                'screened',
                'rejected',
            ],

            'screened' => [
                'shortlisted',
                'rejected',
            ],

            'shortlisted' => [
                'rejected',
            ],

            'interviewed' => [
                'rejected',
            ],
        ];

        if (
            !in_array(
                $target,
                $allowed[
                    $application->stage
                ] ?? [],
                true
            )
        ) {
            throw ValidationException::withMessages([
                'stage' => [
                    'The requested recruitment stage transition is not allowed.',
                ],
            ]);
        }

        if (
            $target ===
                'rejected'
            &&
            empty(
                trim(
                    (string) (
                        $validated['notes']
                        ?? ''
                    )
                )
            )
        ) {
            throw ValidationException::withMessages([
                'notes' => [
                    'A rejection reason is required.',
                ],
            ]);
        }

        $updates = [
            'stage' =>
                $target,

            'updated_by' =>
                $request->user()->id,

            'updated_at' =>
                now(),
        ];

        if (
            $target ===
            'screened'
        ) {
            $updates[
                'screening_notes'
            ] =
                $validated[
                    'notes'
                ] ?? null;
        }

        if (
            $target ===
            'shortlisted'
        ) {
            $updates[
                'shortlisted_at'
            ] =
                now();
        }

        if (
            $target ===
            'rejected'
        ) {
            $updates[
                'rejected_at'
            ] =
                now();

            $updates[
                'rejection_reason'
            ] =
                $validated['notes'];
        }

        DB::table(
            'hrm_recruitment_applications'
        )
            ->where(
                'id',
                $application->id
            )
            ->update(
                $updates
            );

        $auditLogService->record(
            action:
                'hrm.recruitment.application.stage_changed',

            scope:
                $scope,

            metadata: [
                'application_id' =>
                    $application->id,

                'from_stage' =>
                    $application->stage,

                'to_stage' =>
                    $target,
            ],

            dataClassification:
                'restricted',

            auditableType:
                'hrm_recruitment_application',

            auditableId:
                $application->id
        );

        return response()->json([
            'message' =>
                'Application stage updated.',
        ]);
    }

    public function scheduleInterview(
        Request $request,
        ScopeResolver $scopeResolver,
        AuditLogService $auditLogService
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
                'application_id' => [
                    'required',
                    'integer',
                ],

                'interview_type' => [
                    'required',
                    'string',
                    'max:50',
                ],

                'scheduled_at' => [
                    'required',
                    'date',
                ],

                'interviewer_employee_id' => [
                    'nullable',
                    'integer',
                ],
            ]);

        $tenantId =
            (int) $tenant->id;

        $application =
            $this->application(
                $tenantId,
                $scope,
                $validated[
                    'application_id'
                ]
            );

        if (
            $application->stage !==
            'shortlisted'
        ) {
            throw ValidationException::withMessages([
                'application_id' => [
                    'Only shortlisted applications can be scheduled for interview.',
                ],
            ]);
        }

        if (
            !empty(
                $validated[
                    'interviewer_employee_id'
                ]
            )
        ) {
            $interviewer =
                DB::table('hrm_employees')
                    ->where(
                        'tenant_id',
                        $tenantId
                    )
                    ->where(
                        'id',
                        $validated[
                            'interviewer_employee_id'
                        ]
                    )
                    ->first();

            if (!$interviewer) {
                throw ValidationException::withMessages([
                    'interviewer_employee_id' => [
                        'Interviewer was not found in this tenant.',
                    ],
                ]);
            }
        }

        $id =
            DB::table(
                'hrm_recruitment_interviews'
            )
                ->insertGetId([
                    'uuid' =>
                        (string) Str::uuid(),

                    'tenant_id' =>
                        $tenantId,

                    'application_id' =>
                        $application->id,

                    'interview_type' =>
                        $validated[
                            'interview_type'
                        ],

                    'scheduled_at' =>
                        $validated[
                            'scheduled_at'
                        ],

                    'interviewer_employee_id' =>
                        $validated[
                            'interviewer_employee_id'
                        ] ?? null,

                    'status' =>
                        'scheduled',

                    'created_by' =>
                        $request->user()->id,

                    'created_at' =>
                        now(),

                    'updated_at' =>
                        now(),
                ]);

        $auditLogService->record(
            action:
                'hrm.recruitment.interview.scheduled',

            scope:
                $scope,

            metadata: [
                'interview_id' =>
                    $id,

                'application_id' =>
                    $application->id,
            ],

            dataClassification:
                'restricted',

            auditableType:
                'hrm_recruitment_interview',

            auditableId:
                $id
        );

        return response()->json([
            'message' =>
                'Interview scheduled.',

            'interview_id' =>
                $id,
        ], 201);
    }

    public function completeInterview(
        Request $request,
        int $interviewId,
        ScopeResolver $scopeResolver,
        AuditLogService $auditLogService
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
                'score' => [
                    'required',
                    'numeric',
                    'min:0',
                    'max:100',
                ],

                'recommendation' => [
                    'required',
                    'in:advance,hold,reject',
                ],

                'feedback' => [
                    'required',
                    'string',
                    'max:5000',
                ],
            ]);

        $interview =
            $this->interview(
                (int) $tenant->id,
                $scope,
                $interviewId
            );

        if (
            $interview->status !==
            'scheduled'
        ) {
            throw ValidationException::withMessages([
                'status' => [
                    'Only scheduled interviews can be completed.',
                ],
            ]);
        }

        DB::transaction(
            function () use (
                $request,
                $interview,
                $validated
            ) {
                DB::table(
                    'hrm_recruitment_interviews'
                )
                    ->where(
                        'id',
                        $interview->id
                    )
                    ->update([
                        'status' =>
                            'completed',

                        'score' =>
                            $validated['score'],

                        'feedback_payload' =>
                            Crypt::encryptString(
                                json_encode([
                                    'feedback' =>
                                        $validated[
                                            'feedback'
                                        ],

                                    'recommendation' =>
                                        $validated[
                                            'recommendation'
                                        ],
                                ])
                            ),

                        'completed_by' =>
                            $request->user()->id,

                        'completed_at' =>
                            now(),

                        'updated_at' =>
                            now(),
                    ]);

                if (
                    $validated[
                        'recommendation'
                    ]
                    ===
                    'advance'
                ) {
                    DB::table(
                        'hrm_recruitment_applications'
                    )
                        ->where(
                            'id',
                            $interview->application_id
                        )
                        ->update([
                            'stage' =>
                                'interviewed',

                            'updated_by' =>
                                $request->user()->id,

                            'updated_at' =>
                                now(),
                        ]);
                }

                if (
                    $validated[
                        'recommendation'
                    ]
                    ===
                    'reject'
                ) {
                    DB::table(
                        'hrm_recruitment_applications'
                    )
                        ->where(
                            'id',
                            $interview->application_id
                        )
                        ->update([
                            'stage' =>
                                'rejected',

                            'rejected_at' =>
                                now(),

                            'rejection_reason' =>
                                'Interview decision: '
                                .
                                $validated[
                                    'feedback'
                                ],

                            'updated_by' =>
                                $request->user()->id,

                            'updated_at' =>
                                now(),
                        ]);
                }
            }
        );

        $auditLogService->record(
            action:
                'hrm.recruitment.interview.completed',

            scope:
                $scope,

            metadata: [
                'interview_id' =>
                    $interview->id,

                'application_id' =>
                    $interview->application_id,

                'score' =>
                    $validated['score'],

                'recommendation' =>
                    $validated[
                        'recommendation'
                    ],
            ],

            dataClassification:
                'restricted',

            auditableType:
                'hrm_recruitment_interview',

            auditableId:
                $interview->id
        );

        return response()->json([
            'message' =>
                'Interview completed.',
        ]);
    }

    public function createOffer(
        Request $request,
        ScopeResolver $scopeResolver,
        AuditLogService $auditLogService
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
                'application_id' => [
                    'required',
                    'integer',
                ],

                'offer_number' => [
                    'required',
                    'string',
                    'max:100',
                ],

                'start_date' => [
                    'required',
                    'date',
                ],

                'employment_type' => [
                    'required',
                    'string',
                    'max:50',
                ],

                'basic_salary' => [
                    'nullable',
                    'numeric',
                    'min:0',
                ],

                'currency' => [
                    'nullable',
                    'string',
                    'max:10',
                ],

                'pay_frequency' => [
                    'nullable',
                    'string',
                    'max:30',
                ],

                'probation_end_date' => [
                    'nullable',
                    'date',
                    'after_or_equal:start_date',
                ],
            ]);

        $tenantId =
            (int) $tenant->id;

        $application =
            $this->application(
                $tenantId,
                $scope,
                $validated[
                    'application_id'
                ]
            );

        if (
            !in_array(
                $application->stage,
                [
                    'shortlisted',
                    'interviewed',
                ],
                true
            )
        ) {
            throw ValidationException::withMessages([
                'application_id' => [
                    'Offers can only be drafted for shortlisted or interviewed applications.',
                ],
            ]);
        }

        if (
            DB::table(
                'hrm_recruitment_offers'
            )
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->where(
                    'application_id',
                    $application->id
                )
                ->exists()
        ) {
            throw ValidationException::withMessages([
                'application_id' => [
                    'An offer already exists for this application.',
                ],
            ]);
        }

        if (
            DB::table(
                'hrm_recruitment_offers'
            )
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->where(
                    'offer_number',
                    $validated[
                        'offer_number'
                    ]
                )
                ->exists()
        ) {
            throw ValidationException::withMessages([
                'offer_number' => [
                    'This offer number already exists.',
                ],
            ]);
        }

        $compensationPayload = null;

        if (
            array_key_exists(
                'basic_salary',
                $validated
            )
            &&
            $validated[
                'basic_salary'
            ] !== null
        ) {
            $compensationPayload =
                Crypt::encryptString(
                    json_encode([
                        'basic_salary' =>
                            $validated[
                                'basic_salary'
                            ],

                        'currency' =>
                            $validated[
                                'currency'
                            ] ?? null,

                        'pay_frequency' =>
                            $validated[
                                'pay_frequency'
                            ] ?? null,
                    ])
                );
        }

        $id =
            DB::table(
                'hrm_recruitment_offers'
            )
                ->insertGetId([
                    'uuid' =>
                        (string) Str::uuid(),

                    'tenant_id' =>
                        $tenantId,

                    'application_id' =>
                        $application->id,

                    'offer_number' =>
                        $validated[
                            'offer_number'
                        ],

                    'start_date' =>
                        $validated[
                            'start_date'
                        ],

                    'employment_type' =>
                        $validated[
                            'employment_type'
                        ],

                    'compensation_payload' =>
                        $compensationPayload,

                    'probation_end_date' =>
                        $validated[
                            'probation_end_date'
                        ] ?? null,

                    'status' =>
                        'draft',

                    'created_by' =>
                        $request->user()->id,

                    'created_at' =>
                        now(),

                    'updated_at' =>
                        now(),
                ]);

        $auditLogService->record(
            action:
                'hrm.recruitment.offer.created',

            scope:
                $scope,

            metadata: [
                'offer_id' =>
                    $id,

                'application_id' =>
                    $application->id,

                'compensation_history_write' =>
                    false,
            ],

            dataClassification:
                'restricted',

            auditableType:
                'hrm_recruitment_offer',

            auditableId:
                $id
        );

        return response()->json([
            'message' =>
                'Offer created as draft.',

            'offer_id' =>
                $id,
        ], 201);
    }

    public function submitOffer(
        Request $request,
        int $offerId,
        ScopeResolver $scopeResolver,
        AuditLogService $auditLogService
    ): JsonResponse {
        return $this->offerDecision(
            $request,
            $offerId,
            'submitted',
            $scopeResolver,
            $auditLogService
        );
    }

    public function approveOffer(
        Request $request,
        int $offerId,
        ScopeResolver $scopeResolver,
        AuditLogService $auditLogService
    ): JsonResponse {
        return $this->offerDecision(
            $request,
            $offerId,
            'approved',
            $scopeResolver,
            $auditLogService
        );
    }

    public function rejectOffer(
        Request $request,
        int $offerId,
        ScopeResolver $scopeResolver,
        AuditLogService $auditLogService
    ): JsonResponse {
        return $this->offerDecision(
            $request,
            $offerId,
            'rejected',
            $scopeResolver,
            $auditLogService
        );
    }

    public function acceptOffer(
        Request $request,
        int $offerId,
        ScopeResolver $scopeResolver,
        AuditLogService $auditLogService
    ): JsonResponse {
        [
            'tenant' => $tenant,
            'scope' => $scope,
        ] = $this->context(
            $request,
            $scopeResolver
        );

        $offer =
            $this->offer(
                (int) $tenant->id,
                $scope,
                $offerId
            );

        if (
            $offer->status !==
            'approved'
        ) {
            throw ValidationException::withMessages([
                'status' => [
                    'Only an approved offer can be recorded as accepted.',
                ],
            ]);
        }

        DB::transaction(
            function () use (
                $request,
                $offer
            ) {
                DB::table(
                    'hrm_recruitment_offers'
                )
                    ->where(
                        'id',
                        $offer->id
                    )
                    ->update([
                        'status' =>
                            'accepted',

                        'accepted_by' =>
                            $request->user()->id,

                        'accepted_at' =>
                            now(),

                        'updated_at' =>
                            now(),
                    ]);

                DB::table(
                    'hrm_recruitment_applications'
                )
                    ->where(
                        'id',
                        $offer->application_id
                    )
                    ->update([
                        'stage' =>
                            'offered',

                        'updated_by' =>
                            $request->user()->id,

                        'updated_at' =>
                            now(),
                    ]);

                DB::table(
                    'hrm_recruitment_candidates'
                )
                    ->where(
                        'id',
                        $offer->candidate_id
                    )
                    ->update([
                        'status' =>
                            'selected',

                        'updated_at' =>
                            now(),
                    ]);
            }
        );

        $auditLogService->record(
            action:
                'hrm.recruitment.offer.accepted',

            scope:
                $scope,

            metadata: [
                'offer_id' =>
                    $offer->id,

                'application_id' =>
                    $offer->application_id,
            ],

            dataClassification:
                'restricted',

            auditableType:
                'hrm_recruitment_offer',

            auditableId:
                $offer->id
        );

        return response()->json([
            'message' =>
                'Offer acceptance recorded.',
        ]);
    }

    public function hire(
        Request $request,
        int $applicationId,
        ScopeResolver $scopeResolver,
        AuditLogService $auditLogService
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
                'employee_number' => [
                    'required',
                    'string',
                    'max:100',
                ],

                'work_email' => [
                    'nullable',
                    'email',
                    'max:191',
                ],

                'contract_number' => [
                    'required',
                    'string',
                    'max:100',
                ],

                'contract_type' => [
                    'required',
                    'string',
                    'max:50',
                ],

                'manager_employee_id' => [
                    'nullable',
                    'integer',
                ],
            ]);

        $tenantId =
            (int) $tenant->id;

        $application =
            $this->application(
                $tenantId,
                $scope,
                $applicationId
            );

        if (
            $application->stage !==
            'offered'
        ) {
            throw ValidationException::withMessages([
                'application' => [
                    'Only an application with an accepted offer can be hired.',
                ],
            ]);
        }

        if (
            $application->hired_employee_id
        ) {
            throw ValidationException::withMessages([
                'application' => [
                    'This application is already linked to a hired employee.',
                ],
            ]);
        }

        $offer =
            $this->offerByApplication(
                $tenantId,
                $scope,
                $application->id
            );

        if (
            !$offer
            ||
            $offer->status !==
                'accepted'
        ) {
            throw ValidationException::withMessages([
                'offer' => [
                    'An accepted offer is required before hiring.',
                ],
            ]);
        }

        if (
            DB::table('hrm_employees')
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->where(
                    'employee_number',
                    $validated[
                        'employee_number'
                    ]
                )
                ->exists()
        ) {
            throw ValidationException::withMessages([
                'employee_number' => [
                    'This employee number already exists.',
                ],
            ]);
        }

        if (
            DB::table(
                'hrm_employee_contracts'
            )
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->where(
                    'contract_number',
                    $validated[
                        'contract_number'
                    ]
                )
                ->exists()
        ) {
            throw ValidationException::withMessages([
                'contract_number' => [
                    'This contract number already exists.',
                ],
            ]);
        }

        if (
            !empty(
                $validated[
                    'manager_employee_id'
                ]
            )
            &&
            !DB::table('hrm_employees')
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->where(
                    'id',
                    $validated[
                        'manager_employee_id'
                    ]
                )
                ->exists()
        ) {
            throw ValidationException::withMessages([
                'manager_employee_id' => [
                    'Manager employee was not found in this tenant.',
                ],
            ]);
        }

        $contact =
            $this->decrypt(
                $application->contact_payload
            );

        $workEmail =
            trim(
                (string) (
                    $validated[
                        'work_email'
                    ]
                    ??
                    $contact['email']
                    ??
                    ''
                )
            );

        if (
            $workEmail !== ''
            &&
            DB::table('hrm_employees')
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->where(
                    'work_email',
                    $workEmail
                )
                ->exists()
        ) {
            throw ValidationException::withMessages([
                'work_email' => [
                    'This work email is already used by another employee.',
                ],
            ]);
        }

        $result =
            DB::transaction(
                function () use (
                    $request,
                    $tenantId,
                    $application,
                    $offer,
                    $validated,
                    $contact,
                    $workEmail
                ) {
                    $userId =
                        $request->user()->id;

                    $employeeId =
                        DB::table(
                            'hrm_employees'
                        )
                            ->insertGetId([
                                'uuid' =>
                                    (string) Str::uuid(),

                                'tenant_id' =>
                                    $tenantId,

                                'employee_number' =>
                                    $validated[
                                        'employee_number'
                                    ],

                                'user_id' =>
                                    null,

                                'home_branch_id' =>
                                    $application->branch_id,

                                'current_department_id' =>
                                    $application->department_id,

                                'current_position_id' =>
                                    $application->position_id,

                                'job_grade_id' =>
                                    $application->job_grade_id,

                                'manager_employee_id' =>
                                    $validated[
                                        'manager_employee_id'
                                    ] ?? null,

                                'first_name' =>
                                    $application->first_name,

                                'middle_name' =>
                                    null,

                                'last_name' =>
                                    $application->last_name,

                                'preferred_name' =>
                                    null,

                                'work_email' =>
                                    $workEmail !== ''
                                        ? $workEmail
                                        : null,

                                'employment_status' =>
                                    'active',

                                'employment_type' =>
                                    $offer->employment_type,

                                'hire_date' =>
                                    $offer->start_date,

                                'termination_date' =>
                                    null,

                                'probation_end_date' =>
                                    $offer->probation_end_date,

                                'private_profile' =>
                                    Crypt::encryptString(
                                        json_encode([
                                            'recruitment_contact' =>
                                                [
                                                    'email' =>
                                                        $contact[
                                                            'email'
                                                        ] ?? null,

                                                    'phone' =>
                                                        $contact[
                                                            'phone'
                                                        ] ?? null,
                                                ],
                                        ])
                                    ),

                                'metadata' =>
                                    json_encode([
                                        'source' =>
                                            'recruitment',

                                        'application_id' =>
                                            $application->id,

                                        'offer_id' =>
                                            $offer->id,
                                    ]),

                                'created_by' =>
                                    $userId,

                                'updated_by' =>
                                    $userId,

                                'created_at' =>
                                    now(),

                                'updated_at' =>
                                    now(),
                            ]);

                    DB::table(
                        'hrm_employee_assignments'
                    )
                        ->insert([
                            'uuid' =>
                                (string) Str::uuid(),

                            'tenant_id' =>
                                $tenantId,

                            'employee_id' =>
                                $employeeId,

                            'branch_id' =>
                                $application->branch_id,

                            'department_id' =>
                                $application->department_id,

                            'position_id' =>
                                $application->position_id,

                            'job_grade_id' =>
                                $application->job_grade_id,

                            'manager_employee_id' =>
                                $validated[
                                    'manager_employee_id'
                                ] ?? null,

                            'assignment_type' =>
                                'primary',

                            'effective_from' =>
                                $offer->start_date,

                            'effective_to' =>
                                null,

                            'status' =>
                                'active',

                            'reason' =>
                                'Recruitment hire',

                            'approved_by' =>
                                $userId,

                            'approved_at' =>
                                now(),

                            'created_by' =>
                                $userId,

                            'updated_by' =>
                                $userId,

                            'created_at' =>
                                now(),

                            'updated_at' =>
                                now(),
                        ]);

                    DB::table(
                        'hrm_employee_contracts'
                    )
                        ->insert([
                            'uuid' =>
                                (string) Str::uuid(),

                            'tenant_id' =>
                                $tenantId,

                            'employee_id' =>
                                $employeeId,

                            'contract_number' =>
                                $validated[
                                    'contract_number'
                                ],

                            'contract_type' =>
                                $validated[
                                    'contract_type'
                                ],

                            'start_date' =>
                                $offer->start_date,

                            'end_date' =>
                                null,

                            'probation_end_date' =>
                                $offer->probation_end_date,

                            'work_schedule_type' =>
                                null,

                            'working_hours_per_week' =>
                                null,

                            'status' =>
                                'active',

                            'signed_at' =>
                                null,

                            'notes' =>
                                'Created from accepted recruitment offer.',

                            'created_by' =>
                                $userId,

                            'updated_by' =>
                                $userId,

                            'created_at' =>
                                now(),

                            'updated_at' =>
                                now(),
                        ]);

                    $targetCompletion =
                        date(
                            'Y-m-d',
                            strtotime(
                                $offer->start_date
                                .
                                ' +90 days'
                            )
                        );

                    $planId =
                        DB::table(
                            'hrm_onboarding_plans'
                        )
                            ->insertGetId([
                                'uuid' =>
                                    (string) Str::uuid(),

                                'tenant_id' =>
                                    $tenantId,

                                'application_id' =>
                                    $application->id,

                                'employee_id' =>
                                    $employeeId,

                                'title' =>
                                    'Onboarding — '
                                    .
                                    $application->first_name
                                    .
                                    ' '
                                    .
                                    $application->last_name,

                                'start_date' =>
                                    $offer->start_date,

                                'target_completion_date' =>
                                    $targetCompletion,

                                'status' =>
                                    'active',

                                'created_by' =>
                                    $userId,

                                'created_at' =>
                                    now(),

                                'updated_at' =>
                                    now(),
                            ]);

                    $probationDue =
                        $offer->probation_end_date
                        ??
                        $targetCompletion;

                    $tasks = [
                        [
                            'task_type' =>
                                'equipment',

                            'title' =>
                                'Issue required equipment',

                            'due_date' =>
                                $offer->start_date,
                        ],

                        [
                            'task_type' =>
                                'document_verification',

                            'title' =>
                                'Verify employment documents',

                            'due_date' =>
                                date(
                                    'Y-m-d',
                                    strtotime(
                                        $offer->start_date
                                        .
                                        ' +5 days'
                                    )
                                ),
                        ],

                        [
                            'task_type' =>
                                'induction',

                            'title' =>
                                'Complete induction',

                            'due_date' =>
                                date(
                                    'Y-m-d',
                                    strtotime(
                                        $offer->start_date
                                        .
                                        ' +7 days'
                                    )
                                ),
                        ],

                        [
                            'task_type' =>
                                'probation',

                            'title' =>
                                'Complete probation review',

                            'due_date' =>
                                $probationDue,
                        ],
                    ];

                    foreach ($tasks as $task) {
                        DB::table(
                            'hrm_onboarding_tasks'
                        )
                            ->insert([
                                'uuid' =>
                                    (string) Str::uuid(),

                                'tenant_id' =>
                                    $tenantId,

                                'plan_id' =>
                                    $planId,

                                'task_type' =>
                                    $task[
                                        'task_type'
                                    ],

                                'title' =>
                                    $task['title'],

                                'description' =>
                                    null,

                                'due_date' =>
                                    $task[
                                        'due_date'
                                    ],

                                'reference' =>
                                    null,

                                'assigned_employee_id' =>
                                    null,

                                'status' =>
                                    'pending',

                                'created_by' =>
                                    $userId,

                                'created_at' =>
                                    now(),

                                'updated_at' =>
                                    now(),
                            ]);
                    }

                    DB::table(
                        'hrm_recruitment_applications'
                    )
                        ->where(
                            'id',
                            $application->id
                        )
                        ->update([
                            'stage' =>
                                'hired',

                            'hired_employee_id' =>
                                $employeeId,

                            'updated_by' =>
                                $userId,

                            'updated_at' =>
                                now(),
                        ]);

                    DB::table(
                        'hrm_recruitment_candidates'
                    )
                        ->where(
                            'id',
                            $application->candidate_id
                        )
                        ->update([
                            'status' =>
                                'hired',

                            'updated_at' =>
                                now(),
                        ]);

                    return [
                        'employee_id' =>
                            $employeeId,

                        'onboarding_plan_id' =>
                            $planId,
                    ];
                }
            );

        $auditLogService->record(
            action:
                'hrm.recruitment.application.hired',

            scope:
                $scope,

            metadata: [
                'application_id' =>
                    $application->id,

                'employee_id' =>
                    $result[
                        'employee_id'
                    ],

                'onboarding_plan_id' =>
                    $result[
                        'onboarding_plan_id'
                    ],

                'compensation_history_write' =>
                    false,

                'automatic_payroll_recalculation' =>
                    false,

                'finance_posting' =>
                    false,
            ],

            dataClassification:
                'restricted',

            auditableType:
                'hrm_recruitment_application',

            auditableId:
                $application->id
        );

        return response()->json([
            'message' =>
                'Candidate hired and onboarding plan created.',

            'employee_id' =>
                $result[
                    'employee_id'
                ],

            'onboarding_plan_id' =>
                $result[
                    'onboarding_plan_id'
                ],
        ]);
    }

    public function createOnboardingTask(
        Request $request,
        ScopeResolver $scopeResolver,
        AuditLogService $auditLogService
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
                'plan_id' => [
                    'required',
                    'integer',
                ],

                'task_type' => [
                    'required',
                    'in:induction,equipment,document_verification,probation,other',
                ],

                'title' => [
                    'required',
                    'string',
                    'max:191',
                ],

                'description' => [
                    'nullable',
                    'string',
                    'max:3000',
                ],

                'due_date' => [
                    'nullable',
                    'date',
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

        $plan =
            $this->plan(
                (int) $tenant->id,
                $scope,
                $validated['plan_id']
            );

        if (
            $plan->status !==
            'active'
        ) {
            throw ValidationException::withMessages([
                'plan_id' => [
                    'Tasks can only be added to an active onboarding plan.',
                ],
            ]);
        }

        $id =
            DB::table(
                'hrm_onboarding_tasks'
            )
                ->insertGetId([
                    'uuid' =>
                        (string) Str::uuid(),

                    'tenant_id' =>
                        $tenant->id,

                    'plan_id' =>
                        $plan->id,

                    'task_type' =>
                        $validated[
                            'task_type'
                        ],

                    'title' =>
                        $validated['title'],

                    'description' =>
                        $validated[
                            'description'
                        ] ?? null,

                    'due_date' =>
                        $validated[
                            'due_date'
                        ] ?? null,

                    'reference' =>
                        $validated[
                            'reference'
                        ] ?? null,

                    'assigned_employee_id' =>
                        $validated[
                            'assigned_employee_id'
                        ] ?? null,

                    'status' =>
                        'pending',

                    'created_by' =>
                        $request->user()->id,

                    'created_at' =>
                        now(),

                    'updated_at' =>
                        now(),
                ]);

        $auditLogService->record(
            action:
                'hrm.onboarding.task.created',

            scope:
                $scope,

            metadata: [
                'task_id' =>
                    $id,

                'plan_id' =>
                    $plan->id,

                'task_type' =>
                    $validated[
                        'task_type'
                    ],
            ],

            dataClassification:
                'internal',

            auditableType:
                'hrm_onboarding_task',

            auditableId:
                $id
        );

        return response()->json([
            'message' =>
                'Onboarding task created.',

            'task_id' =>
                $id,
        ], 201);
    }

    public function completeOnboardingTask(
        Request $request,
        int $taskId,
        ScopeResolver $scopeResolver,
        AuditLogService $auditLogService
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
                    'max:3000',
                ],
            ]);

        $task =
            $this->task(
                (int) $tenant->id,
                $scope,
                $taskId
            );

        if (
            !in_array(
                $task->status,
                [
                    'pending',
                    'in_progress',
                ],
                true
            )
        ) {
            throw ValidationException::withMessages([
                'status' => [
                    'Only pending or in-progress onboarding tasks can be completed.',
                ],
            ]);
        }

        DB::table(
            'hrm_onboarding_tasks'
        )
            ->where(
                'id',
                $task->id
            )
            ->update([
                'status' =>
                    'completed',

                'completed_by' =>
                    $request->user()->id,

                'completed_at' =>
                    now(),

                'completion_notes' =>
                    $validated[
                        'notes'
                    ] ?? null,

                'updated_at' =>
                    now(),
            ]);

        $auditLogService->record(
            action:
                'hrm.onboarding.task.completed',

            scope:
                $scope,

            metadata: [
                'task_id' =>
                    $task->id,

                'plan_id' =>
                    $task->plan_id,
            ],

            dataClassification:
                'internal',

            auditableType:
                'hrm_onboarding_task',

            auditableId:
                $task->id
        );

        return response()->json([
            'message' =>
                'Onboarding task completed and awaiting verification.',
        ]);
    }

    public function verifyOnboardingTask(
        Request $request,
        int $taskId,
        ScopeResolver $scopeResolver,
        AuditLogService $auditLogService
    ): JsonResponse {
        [
            'tenant' => $tenant,
            'scope' => $scope,
        ] = $this->context(
            $request,
            $scopeResolver
        );

        $task =
            $this->task(
                (int) $tenant->id,
                $scope,
                $taskId
            );

        if (
            $task->status !==
            'completed'
        ) {
            throw ValidationException::withMessages([
                'status' => [
                    'Only completed onboarding tasks can be verified.',
                ],
            ]);
        }

        if (
            (
(int) $task->completed_by
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
            'hrm_onboarding_tasks'
        )
            ->where(
                'id',
                $task->id
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

        $auditLogService->record(
            action:
                'hrm.onboarding.task.verified',

            scope:
                $scope,

            metadata: [
                'task_id' =>
                    $task->id,

                'plan_id' =>
                    $task->plan_id,
            ],

            dataClassification:
                'internal',

            auditableType:
                'hrm_onboarding_task',

            auditableId:
                $task->id
        );

        return response()->json([
            'message' =>
                'Onboarding task verified.',
        ]);
    }

    public function completeOnboardingPlan(
        Request $request,
        int $planId,
        ScopeResolver $scopeResolver,
        AuditLogService $auditLogService
    ): JsonResponse {
        [
            'tenant' => $tenant,
            'scope' => $scope,
        ] = $this->context(
            $request,
            $scopeResolver
        );

        $plan =
            $this->plan(
                (int) $tenant->id,
                $scope,
                $planId
            );

        if (
            $plan->status !==
            'active'
        ) {
            throw ValidationException::withMessages([
                'status' => [
                    'Only active onboarding plans can be completed.',
                ],
            ]);
        }

        $taskCount =
            DB::table(
                'hrm_onboarding_tasks'
            )
                ->where(
                    'tenant_id',
                    $tenant->id
                )
                ->where(
                    'plan_id',
                    $plan->id
                )
                ->count();

        $unverified =
            DB::table(
                'hrm_onboarding_tasks'
            )
                ->where(
                    'tenant_id',
                    $tenant->id
                )
                ->where(
                    'plan_id',
                    $plan->id
                )
                ->where(
                    'status',
                    '!=',
                    'verified'
                )
                ->count();

        if (
            $taskCount < 1
            ||
            $unverified > 0
        ) {
            throw ValidationException::withMessages([
                'tasks' => [
                    'All onboarding checklist tasks must be verified before the plan can be completed.',
                ],
            ]);
        }

        DB::table(
            'hrm_onboarding_plans'
        )
            ->where(
                'id',
                $plan->id
            )
            ->update([
                'status' =>
                    'completed',

                'completed_by' =>
                    $request->user()->id,

                'completed_at' =>
                    now(),

                'updated_at' =>
                    now(),
            ]);

        $auditLogService->record(
            action:
                'hrm.onboarding.plan.completed',

            scope:
                $scope,

            metadata: [
                'plan_id' =>
                    $plan->id,

                'employee_id' =>
                    $plan->employee_id,
            ],

            dataClassification:
                'internal',

            auditableType:
                'hrm_onboarding_plan',

            auditableId:
                $plan->id
        );

        return response()->json([
            'message' =>
                'Onboarding plan completed.',
        ]);
    }

    private function offerDecision(
        Request $request,
        int $offerId,
        string $decision,
        ScopeResolver $scopeResolver,
        AuditLogService $auditLogService
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
                    $decision ===
                        'rejected'
                        ? 'required'
                        : 'nullable',

                    'string',
                    'max:2000',
                ],
            ]);

        $offer =
            $this->offer(
                (int) $tenant->id,
                $scope,
                $offerId
            );

        if (
            $decision ===
            'submitted'
        ) {
            if (
                $offer->status !==
                'draft'
            ) {
                throw ValidationException::withMessages([
                    'status' => [
                        'Only draft offers can be submitted.',
                    ],
                ]);
            }

            DB::table(
                'hrm_recruitment_offers'
            )
                ->where(
                    'id',
                    $offer->id
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
        } else {
            if (
                $offer->status !==
                'submitted'
            ) {
                throw ValidationException::withMessages([
                    'status' => [
                        'Only submitted offers can be approved or rejected.',
                    ],
                ]);
            }

            $maker =
                $offer->submitted_by
                ??
                $offer->created_by;

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

            $updates = [
                'status' =>
                    $decision,

                'updated_at' =>
                    now(),
            ];

            if (
                $decision ===
                'approved'
            ) {
                $updates[
                    'approved_by'
                ] =
                    $request->user()->id;

                $updates[
                    'approved_at'
                ] =
                    now();
            }

            if (
                $decision ===
                'rejected'
            ) {
                $updates[
                    'rejected_by'
                ] =
                    $request->user()->id;

                $updates[
                    'rejected_at'
                ] =
                    now();

                $updates[
                    'rejection_reason'
                ] =
                    $validated['reason'];
            }

            DB::table(
                'hrm_recruitment_offers'
            )
                ->where(
                    'id',
                    $offer->id
                )
                ->update(
                    $updates
                );
        }

        $auditLogService->record(
            action:
                'hrm.recruitment.offer.'
                .
                $decision,

            scope:
                $scope,

            metadata: [
                'offer_id' =>
                    $offer->id,

                'application_id' =>
                    $offer->application_id,
            ],

            dataClassification:
                'restricted',

            auditableType:
                'hrm_recruitment_offer',

            auditableId:
                $offer->id
        );

        return response()->json([
            'message' =>
                'Offer '
                .
                $decision
                .
                '.',
        ]);
    }

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
            $scope->branchId !==
                null
        ) {
            return
                (int)
                $scope->branchId;
        }

        return null;
    }

    private function requisition(
        int $tenantId,
        $scope,
        int $id
    ): object {
        $query =
            DB::table(
                'hrm_recruitment_requisitions'
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
            $this->branchId($scope);

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

    private function vacancy(
        int $tenantId,
        $scope,
        int $id
    ): object {
        $query =
            DB::table(
                'hrm_recruitment_vacancies as v'
            )
                ->join(
                    'hrm_recruitment_requisitions as r',
                    'r.id',
                    '=',
                    'v.requisition_id'
                )
                ->where(
                    'v.tenant_id',
                    $tenantId
                )
                ->where(
                    'v.id',
                    $id
                );

        $branchId =
            $this->branchId($scope);

        if ($branchId !== null) {
            $query->where(
                'r.branch_id',
                $branchId
            );
        }

        $row =
            $query->first([
                'v.*',
                'r.branch_id',
                'r.department_id',
                'r.position_id',
                'r.job_grade_id',
            ]);

        if (!$row) {
            abort(404);
        }

        return $row;
    }

    private function application(
        int $tenantId,
        $scope,
        int $id
    ): object {
        $query =
            DB::table(
                'hrm_recruitment_applications as a'
            )
                ->join(
                    'hrm_recruitment_candidates as c',
                    'c.id',
                    '=',
                    'a.candidate_id'
                )
                ->join(
                    'hrm_recruitment_vacancies as v',
                    'v.id',
                    '=',
                    'a.vacancy_id'
                )
                ->join(
                    'hrm_recruitment_requisitions as r',
                    'r.id',
                    '=',
                    'v.requisition_id'
                )
                ->where(
                    'a.tenant_id',
                    $tenantId
                )
                ->where(
                    'a.id',
                    $id
                );

        $branchId =
            $this->branchId($scope);

        if ($branchId !== null) {
            $query->where(
                'r.branch_id',
                $branchId
            );
        }

        $row =
            $query->first([
                'a.*',
                'c.first_name',
                'c.last_name',
                'c.contact_payload',
                'r.branch_id',
                'r.department_id',
                'r.position_id',
                'r.job_grade_id',
            ]);

        if (!$row) {
            abort(404);
        }

        return $row;
    }

    private function interview(
        int $tenantId,
        $scope,
        int $id
    ): object {
        $query =
            DB::table(
                'hrm_recruitment_interviews as i'
            )
                ->join(
                    'hrm_recruitment_applications as a',
                    'a.id',
                    '=',
                    'i.application_id'
                )
                ->join(
                    'hrm_recruitment_vacancies as v',
                    'v.id',
                    '=',
                    'a.vacancy_id'
                )
                ->join(
                    'hrm_recruitment_requisitions as r',
                    'r.id',
                    '=',
                    'v.requisition_id'
                )
                ->where(
                    'i.tenant_id',
                    $tenantId
                )
                ->where(
                    'i.id',
                    $id
                );

        $branchId =
            $this->branchId($scope);

        if ($branchId !== null) {
            $query->where(
                'r.branch_id',
                $branchId
            );
        }

        $row =
            $query->first([
                'i.*',
            ]);

        if (!$row) {
            abort(404);
        }

        return $row;
    }

    private function offer(
        int $tenantId,
        $scope,
        int $id
    ): object {
        $query =
            DB::table(
                'hrm_recruitment_offers as o'
            )
                ->join(
                    'hrm_recruitment_applications as a',
                    'a.id',
                    '=',
                    'o.application_id'
                )
                ->join(
                    'hrm_recruitment_candidates as c',
                    'c.id',
                    '=',
                    'a.candidate_id'
                )
                ->join(
                    'hrm_recruitment_vacancies as v',
                    'v.id',
                    '=',
                    'a.vacancy_id'
                )
                ->join(
                    'hrm_recruitment_requisitions as r',
                    'r.id',
                    '=',
                    'v.requisition_id'
                )
                ->where(
                    'o.tenant_id',
                    $tenantId
                )
                ->where(
                    'o.id',
                    $id
                );

        $branchId =
            $this->branchId($scope);

        if ($branchId !== null) {
            $query->where(
                'r.branch_id',
                $branchId
            );
        }

        $row =
            $query->first([
                'o.*',
                'a.candidate_id',
                'c.first_name',
                'c.last_name',
            ]);

        if (!$row) {
            abort(404);
        }

        return $row;
    }

    private function offerByApplication(
        int $tenantId,
        $scope,
        int $applicationId
    ): ?object {
        $query =
            DB::table(
                'hrm_recruitment_offers as o'
            )
                ->join(
                    'hrm_recruitment_applications as a',
                    'a.id',
                    '=',
                    'o.application_id'
                )
                ->join(
                    'hrm_recruitment_vacancies as v',
                    'v.id',
                    '=',
                    'a.vacancy_id'
                )
                ->join(
                    'hrm_recruitment_requisitions as r',
                    'r.id',
                    '=',
                    'v.requisition_id'
                )
                ->where(
                    'o.tenant_id',
                    $tenantId
                )
                ->where(
                    'o.application_id',
                    $applicationId
                );

        $branchId =
            $this->branchId($scope);

        if ($branchId !== null) {
            $query->where(
                'r.branch_id',
                $branchId
            );
        }

        return $query->first([
            'o.*',
        ]);
    }

    private function plan(
        int $tenantId,
        $scope,
        int $id
    ): object {
        $query =
            DB::table(
                'hrm_onboarding_plans as p'
            )
                ->leftJoin(
                    'hrm_employees as e',
                    'e.id',
                    '=',
                    'p.employee_id'
                )
                ->where(
                    'p.tenant_id',
                    $tenantId
                )
                ->where(
                    'p.id',
                    $id
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
                'p.*',
            ]);

        if (!$row) {
            abort(404);
        }

        return $row;
    }

    private function task(
        int $tenantId,
        $scope,
        int $id
    ): object {
        $query =
            DB::table(
                'hrm_onboarding_tasks as t'
            )
                ->join(
                    'hrm_onboarding_plans as p',
                    'p.id',
                    '=',
                    't.plan_id'
                )
                ->leftJoin(
                    'hrm_employees as e',
                    'e.id',
                    '=',
                    'p.employee_id'
                )
                ->where(
                    't.tenant_id',
                    $tenantId
                )
                ->where(
                    't.id',
                    $id
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
                't.*',
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

            return is_array(
                $decoded
            )
                ? $decoded
                : [];
        } catch (Throwable) {
            return [];
        }
    }
}
