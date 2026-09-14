<?php

namespace App\Http\Controllers\Api\V1\Hrm;

use App\Http\Controllers\Controller;
use App\Services\Access\ScopeResolver;
use App\Services\Audit\AuditLogService;
use App\Services\Hrm\HrmTenantContextService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class PerformanceLearningController extends Controller
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

        $cycles =
            DB::table('hrm_performance_cycles')
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->when(
                    $branchId !== null,
                    fn ($query) =>
                        $query->where(
                            function ($nested) use (
                                $branchId
                            ) {
                                $nested
                                    ->whereNull(
                                        'branch_id'
                                    )
                                    ->orWhere(
                                        'branch_id',
                                        $branchId
                                    );
                            }
                        )
                )
                ->orderByDesc('id')
                ->get();

        $employees =
            DB::table('hrm_employees as e')
                ->leftJoin(
                    'hrm_positions as p',
                    'p.id',
                    '=',
                    'e.current_position_id'
                )
                ->where(
                    'e.tenant_id',
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
                ->whereNotIn(
                    'e.employment_status',
                    [
                        'terminated',
                        'inactive',
                    ]
                )
                ->orderBy(
                    'e.employee_number'
                )
                ->get([
                    'e.id',
                    'e.employee_number',
                    'e.first_name',
                    'e.last_name',
                    'e.home_branch_id',
                    'e.current_position_id',
                    'e.manager_employee_id',
                    'p.title as position_title',
                ]);

        $employeeIds =
            $employees
                ->pluck('id')
                ->values();

        $goals =
            $employeeIds->isEmpty()
                ? collect()
                : DB::table(
                    'hrm_performance_goals as g'
                )
                    ->join(
                        'hrm_performance_cycles as c',
                        'c.id',
                        '=',
                        'g.cycle_id'
                    )
                    ->join(
                        'hrm_employees as e',
                        'e.id',
                        '=',
                        'g.employee_id'
                    )
                    ->where(
                        'g.tenant_id',
                        $tenantId
                    )
                    ->whereIn(
                        'g.employee_id',
                        $employeeIds
                    )
                    ->orderByDesc(
                        'g.id'
                    )
                    ->get([
                        'g.*',
                        'c.code as cycle_code',
                        'c.name as cycle_name',
                        'e.employee_number',
                        'e.first_name',
                        'e.last_name',
                    ]);

        $reviews =
            $employeeIds->isEmpty()
                ? collect()
                : DB::table(
                    'hrm_performance_reviews as r'
                )
                    ->join(
                        'hrm_performance_cycles as c',
                        'c.id',
                        '=',
                        'r.cycle_id'
                    )
                    ->join(
                        'hrm_employees as e',
                        'e.id',
                        '=',
                        'r.employee_id'
                    )
                    ->where(
                        'r.tenant_id',
                        $tenantId
                    )
                    ->whereIn(
                        'r.employee_id',
                        $employeeIds
                    )
                    ->orderByDesc(
                        'r.id'
                    )
                    ->get([
                        'r.*',
                        'c.code as cycle_code',
                        'c.name as cycle_name',
                        'e.employee_number',
                        'e.first_name',
                        'e.last_name',
                    ]);

        $reviewIds =
            $reviews
                ->pluck('id')
                ->values();

        $competencies =
            $reviewIds->isEmpty()
                ? collect()
                : DB::table(
                    'hrm_performance_review_competencies'
                )
                    ->where(
                        'tenant_id',
                        $tenantId
                    )
                    ->whereIn(
                        'review_id',
                        $reviewIds
                    )
                    ->orderBy('review_id')
                    ->orderBy('competency_name')
                    ->get();

        $developmentPlans =
            $employeeIds->isEmpty()
                ? collect()
                : DB::table(
                    'hrm_development_plans as d'
                )
                    ->join(
                        'hrm_employees as e',
                        'e.id',
                        '=',
                        'd.employee_id'
                    )
                    ->where(
                        'd.tenant_id',
                        $tenantId
                    )
                    ->whereIn(
                        'd.employee_id',
                        $employeeIds
                    )
                    ->orderByDesc(
                        'd.id'
                    )
                    ->get([
                        'd.*',
                        'e.employee_number',
                        'e.first_name',
                        'e.last_name',
                    ]);

        $courses =
            DB::table(
                'hrm_learning_courses'
            )
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->orderBy('title')
                ->get();

        $enrollments =
            $employeeIds->isEmpty()
                ? collect()
                : DB::table(
                    'hrm_learning_enrollments as le'
                )
                    ->join(
                        'hrm_employees as e',
                        'e.id',
                        '=',
                        'le.employee_id'
                    )
                    ->join(
                        'hrm_learning_courses as lc',
                        'lc.id',
                        '=',
                        'le.course_id'
                    )
                    ->where(
                        'le.tenant_id',
                        $tenantId
                    )
                    ->whereIn(
                        'le.employee_id',
                        $employeeIds
                    )
                    ->orderByDesc(
                        'le.id'
                    )
                    ->get([
                        'le.*',
                        'e.employee_number',
                        'e.first_name',
                        'e.last_name',
                        'lc.code as course_code',
                        'lc.title as course_title',
                        'lc.certification_required',
                    ]);

        $certifications =
            $employeeIds->isEmpty()
                ? collect()
                : DB::table(
                    'hrm_learning_certifications as cert'
                )
                    ->join(
                        'hrm_employees as e',
                        'e.id',
                        '=',
                        'cert.employee_id'
                    )
                    ->leftJoin(
                        'hrm_learning_courses as lc',
                        'lc.id',
                        '=',
                        'cert.course_id'
                    )
                    ->where(
                        'cert.tenant_id',
                        $tenantId
                    )
                    ->whereIn(
                        'cert.employee_id',
                        $employeeIds
                    )
                    ->orderByDesc(
                        'cert.id'
                    )
                    ->get([
                        'cert.*',
                        'e.employee_number',
                        'e.first_name',
                        'e.last_name',
                        'lc.code as course_code',
                        'lc.title as course_title',
                    ]);

        return response()->json([
            'summary' => [
                'cycles' =>
                    $cycles->count(),

                'active_goals' =>
                    $goals
                        ->where(
                            'status',
                            'active'
                        )
                        ->count(),

                'reviews_pending' =>
                    $reviews
                        ->whereIn(
                            'status',
                            [
                                'draft',
                                'submitted',
                            ]
                        )
                        ->count(),

                'development_active' =>
                    $developmentPlans
                        ->where(
                            'status',
                            'active'
                        )
                        ->count(),

                'courses_active' =>
                    $courses
                        ->where(
                            'status',
                            'active'
                        )
                        ->count(),

                'enrollments_active' =>
                    $enrollments
                        ->whereIn(
                            'status',
                            [
                                'enrolled',
                                'in_progress',
                            ]
                        )
                        ->count(),

                'certifications_valid' =>
                    $certifications
                        ->where(
                            'status',
                            'valid'
                        )
                        ->count(),
            ],

            'cycles' =>
                $cycles,

            'goals' =>
                $goals,

            'reviews' =>
                $reviews,

            'competencies' =>
                $competencies,

            'development_plans' =>
                $developmentPlans,

            'courses' =>
                $courses,

            'enrollments' =>
                $enrollments,

            'certifications' =>
                $certifications,

            'employees' =>
                $employees,

            'controls' => [
                'performance_cycle_maker_checker' =>
                    true,

                'performance_review_maker_checker' =>
                    true,

                'automatic_salary_change' =>
                    false,

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

    public function createCycle(
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
                'code' => [
                    'required',
                    'string',
                    'max:100',
                ],

                'name' => [
                    'required',
                    'string',
                    'max:191',
                ],

                'branch_id' => [
                    'nullable',
                    'integer',
                ],

                'starts_on' => [
                    'required',
                    'date',
                ],

                'ends_on' => [
                    'required',
                    'date',
                    'after_or_equal:starts_on',
                ],

                'goal_setting_deadline' => [
                    'nullable',
                    'date',
                ],

                'review_deadline' => [
                    'nullable',
                    'date',
                ],
            ]);

        $tenantId =
            (int) $tenant->id;

        $branchId =
            $this->branchId($scope)
            ??
            (
                $validated['branch_id']
                ?? null
            );

        if (
            DB::table(
                'hrm_performance_cycles'
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
                    'This performance cycle code already exists.',
                ],
            ]);
        }

        $id =
            DB::table(
                'hrm_performance_cycles'
            )
                ->insertGetId([
                    'uuid' =>
                        (string) Str::uuid(),

                    'tenant_id' =>
                        $tenantId,

                    'branch_id' =>
                        $branchId,

                    'code' =>
                        $validated['code'],

                    'name' =>
                        $validated['name'],

                    'starts_on' =>
                        $validated['starts_on'],

                    'ends_on' =>
                        $validated['ends_on'],

                    'goal_setting_deadline' =>
                        $validated[
                            'goal_setting_deadline'
                        ] ?? null,

                    'review_deadline' =>
                        $validated[
                            'review_deadline'
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

        $this->audit(
            $audit,
            $scope,
            'hrm.performance.cycle.created',
            'hrm_performance_cycle',
            $id,
            [
                'cycle_id' => $id,
                'branch_id' => $branchId,
            ]
        );

        return response()->json([
            'message' =>
                'Performance cycle created as draft.',

            'cycle_id' =>
                $id,
        ], 201);
    }

    public function submitCycle(
        Request $request,
        int $cycleId,
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

        $cycle =
            $this->cycle(
                (int) $tenant->id,
                $scope,
                $cycleId
            );

        if (
            $cycle->status !==
            'draft'
        ) {
            throw ValidationException::withMessages([
                'status' => [
                    'Only draft cycles can be submitted.',
                ],
            ]);
        }

        DB::table(
            'hrm_performance_cycles'
        )
            ->where(
                'id',
                $cycle->id
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
            'hrm.performance.cycle.submitted',
            'hrm_performance_cycle',
            $cycle->id,
            [
                'cycle_id' =>
                    $cycle->id,
            ]
        );

        return response()->json([
            'message' =>
                'Performance cycle submitted for approval.',
        ]);
    }

    public function approveCycle(
        Request $request,
        int $cycleId,
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

        $cycle =
            $this->cycle(
                (int) $tenant->id,
                $scope,
                $cycleId
            );

        if (
            $cycle->status !==
            'submitted'
        ) {
            throw ValidationException::withMessages([
                'status' => [
                    'Only submitted cycles can be approved.',
                ],
            ]);
        }

        $maker =
            $cycle->submitted_by
            ??
            $cycle->created_by;

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
            'hrm_performance_cycles'
        )
            ->where(
                'id',
                $cycle->id
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
            'hrm.performance.cycle.approved',
            'hrm_performance_cycle',
            $cycle->id,
            [
                'cycle_id' =>
                    $cycle->id,
            ]
        );

        return response()->json([
            'message' =>
                'Performance cycle approved.',
        ]);
    }

    public function createGoal(
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
                'cycle_id' => [
                    'required',
                    'integer',
                ],

                'employee_id' => [
                    'required',
                    'integer',
                ],

                'manager_employee_id' => [
                    'nullable',
                    'integer',
                ],

                'title' => [
                    'required',
                    'string',
                    'max:191',
                ],

                'description' => [
                    'nullable',
                    'string',
                    'max:4000',
                ],

                'metric_type' => [
                    'required',
                    'string',
                    'max:50',
                ],

                'target_value' => [
                    'nullable',
                    'string',
                    'max:191',
                ],

                'weight' => [
                    'required',
                    'numeric',
                    'min:0',
                    'max:100',
                ],

                'due_date' => [
                    'nullable',
                    'date',
                ],
            ]);

        $tenantId =
            (int) $tenant->id;

        $cycle =
            $this->cycle(
                $tenantId,
                $scope,
                $validated['cycle_id']
            );

        if (
            $cycle->status !==
            'approved'
        ) {
            throw ValidationException::withMessages([
                'cycle_id' => [
                    'Goals can only be created in an approved performance cycle.',
                ],
            ]);
        }

        $this->employee(
            $tenantId,
            $scope,
            $validated['employee_id']
        );

        if (
            !empty(
                $validated[
                    'manager_employee_id'
                ]
            )
        ) {
            $this->employee(
                $tenantId,
                $scope,
                $validated[
                    'manager_employee_id'
                ]
            );
        }

        $id =
            DB::table(
                'hrm_performance_goals'
            )
                ->insertGetId([
                    'uuid' =>
                        (string) Str::uuid(),

                    'tenant_id' =>
                        $tenantId,

                    'cycle_id' =>
                        $cycle->id,

                    'employee_id' =>
                        $validated[
                            'employee_id'
                        ],

                    'manager_employee_id' =>
                        $validated[
                            'manager_employee_id'
                        ] ?? null,

                    'title' =>
                        $validated['title'],

                    'description' =>
                        $validated[
                            'description'
                        ] ?? null,

                    'metric_type' =>
                        $validated[
                            'metric_type'
                        ],

                    'target_value' =>
                        $validated[
                            'target_value'
                        ] ?? null,

                    'weight' =>
                        $validated['weight'],

                    'progress_percent' =>
                        0,

                    'due_date' =>
                        $validated[
                            'due_date'
                        ] ?? null,

                    'status' =>
                        'active',

                    'created_by' =>
                        $request->user()->id,

                    'updated_by' =>
                        $request->user()->id,

                    'created_at' =>
                        now(),

                    'updated_at' =>
                        now(),
                ]);

        $this->audit(
            $audit,
            $scope,
            'hrm.performance.goal.created',
            'hrm_performance_goal',
            $id,
            [
                'goal_id' =>
                    $id,

                'employee_id' =>
                    $validated[
                        'employee_id'
                    ],
            ]
        );

        return response()->json([
            'message' =>
                'Performance goal created.',

            'goal_id' =>
                $id,
        ], 201);
    }

    public function updateGoal(
        Request $request,
        int $goalId,
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
                'progress_percent' => [
                    'required',
                    'numeric',
                    'min:0',
                    'max:100',
                ],

                'status' => [
                    'required',
                    'in:active,completed,cancelled',
                ],
            ]);

        $goal =
            $this->goal(
                (int) $tenant->id,
                $scope,
                $goalId
            );

        DB::table(
            'hrm_performance_goals'
        )
            ->where(
                'id',
                $goal->id
            )
            ->update([
                'progress_percent' =>
                    $validated[
                        'progress_percent'
                    ],

                'status' =>
                    $validated['status'],

                'updated_by' =>
                    $request->user()->id,

                'updated_at' =>
                    now(),
            ]);

        $this->audit(
            $audit,
            $scope,
            'hrm.performance.goal.updated',
            'hrm_performance_goal',
            $goal->id,
            [
                'goal_id' =>
                    $goal->id,

                'progress_percent' =>
                    $validated[
                        'progress_percent'
                    ],

                'status' =>
                    $validated['status'],
            ]
        );

        return response()->json([
            'message' =>
                'Goal progress updated.',
        ]);
    }

    public function createReview(
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
                'cycle_id' => [
                    'required',
                    'integer',
                ],

                'employee_id' => [
                    'required',
                    'integer',
                ],

                'reviewer_employee_id' => [
                    'nullable',
                    'integer',
                ],

                'employee_comments' => [
                    'nullable',
                    'string',
                    'max:5000',
                ],
            ]);

        $tenantId =
            (int) $tenant->id;

        $cycle =
            $this->cycle(
                $tenantId,
                $scope,
                $validated['cycle_id']
            );

        if (
            $cycle->status !==
            'approved'
        ) {
            throw ValidationException::withMessages([
                'cycle_id' => [
                    'Reviews can only be created in an approved performance cycle.',
                ],
            ]);
        }

        $this->employee(
            $tenantId,
            $scope,
            $validated['employee_id']
        );

        if (
            !empty(
                $validated[
                    'reviewer_employee_id'
                ]
            )
        ) {
            $this->employee(
                $tenantId,
                $scope,
                $validated[
                    'reviewer_employee_id'
                ]
            );
        }

        if (
            DB::table(
                'hrm_performance_reviews'
            )
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->where(
                    'cycle_id',
                    $cycle->id
                )
                ->where(
                    'employee_id',
                    $validated[
                        'employee_id'
                    ]
                )
                ->exists()
        ) {
            throw ValidationException::withMessages([
                'employee_id' => [
                    'A review already exists for this employee in the cycle.',
                ],
            ]);
        }

        $id =
            DB::table(
                'hrm_performance_reviews'
            )
                ->insertGetId([
                    'uuid' =>
                        (string) Str::uuid(),

                    'tenant_id' =>
                        $tenantId,

                    'cycle_id' =>
                        $cycle->id,

                    'employee_id' =>
                        $validated[
                            'employee_id'
                        ],

                    'reviewer_employee_id' =>
                        $validated[
                            'reviewer_employee_id'
                        ] ?? null,

                    'employee_comments' =>
                        $validated[
                            'employee_comments'
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

        $this->audit(
            $audit,
            $scope,
            'hrm.performance.review.created',
            'hrm_performance_review',
            $id,
            [
                'review_id' =>
                    $id,

                'employee_id' =>
                    $validated[
                        'employee_id'
                    ],
            ]
        );

        return response()->json([
            'message' =>
                'Performance review created as draft.',

            'review_id' =>
                $id,
        ], 201);
    }

    public function assessCompetency(
        Request $request,
        int $reviewId,
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
                'competency_code' => [
                    'required',
                    'string',
                    'max:100',
                ],

                'competency_name' => [
                    'required',
                    'string',
                    'max:191',
                ],

                'rating' => [
                    'required',
                    'numeric',
                    'min:1',
                    'max:5',
                ],

                'evidence' => [
                    'nullable',
                    'string',
                    'max:5000',
                ],
            ]);

        $review =
            $this->review(
                (int) $tenant->id,
                $scope,
                $reviewId
            );

        if (
            $review->status !==
            'draft'
        ) {
            throw ValidationException::withMessages([
                'status' => [
                    'Competencies can only be edited while the review is draft.',
                ],
            ]);
        }

        DB::table(
            'hrm_performance_review_competencies'
        )
            ->updateOrInsert(
                [
                    'review_id' =>
                        $review->id,

                    'competency_code' =>
                        $validated[
                            'competency_code'
                        ],
                ],
                [
                    'uuid' =>
                        (string) Str::uuid(),

                    'tenant_id' =>
                        $tenant->id,

                    'competency_name' =>
                        $validated[
                            'competency_name'
                        ],

                    'rating' =>
                        $validated['rating'],

                    'evidence' =>
                        $validated[
                            'evidence'
                        ] ?? null,

                    'assessed_by' =>
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
            'hrm.performance.competency.assessed',
            'hrm_performance_review',
            $review->id,
            [
                'review_id' =>
                    $review->id,

                'competency_code' =>
                    $validated[
                        'competency_code'
                    ],

                'rating' =>
                    $validated['rating'],
            ]
        );

        return response()->json([
            'message' =>
                'Competency assessment saved.',
        ]);
    }

    public function submitReview(
        Request $request,
        int $reviewId,
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

        $review =
            $this->review(
                (int) $tenant->id,
                $scope,
                $reviewId
            );

        if (
            $review->status !==
            'draft'
        ) {
            throw ValidationException::withMessages([
                'status' => [
                    'Only draft reviews can be submitted.',
                ],
            ]);
        }

        $competencies =
            DB::table(
                'hrm_performance_review_competencies'
            )
                ->where(
                    'tenant_id',
                    $tenant->id
                )
                ->where(
                    'review_id',
                    $review->id
                )
                ->count();

        if ($competencies < 1) {
            throw ValidationException::withMessages([
                'competencies' => [
                    'At least one competency assessment is required before review submission.',
                ],
            ]);
        }

        DB::table(
            'hrm_performance_reviews'
        )
            ->where(
                'id',
                $review->id
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
            'hrm.performance.review.submitted',
            'hrm_performance_review',
            $review->id,
            [
                'review_id' =>
                    $review->id,
            ]
        );

        return response()->json([
            'message' =>
                'Performance review submitted for approval.',
        ]);
    }

    public function approveReview(
        Request $request,
        int $reviewId,
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
                'overall_rating' => [
                    'required',
                    'numeric',
                    'min:1',
                    'max:5',
                ],

                'manager_comments' => [
                    'required',
                    'string',
                    'max:5000',
                ],
            ]);

        $review =
            $this->review(
                (int) $tenant->id,
                $scope,
                $reviewId
            );

        if (
            $review->status !==
            'submitted'
        ) {
            throw ValidationException::withMessages([
                'status' => [
                    'Only submitted reviews can be approved.',
                ],
            ]);
        }

        $maker =
            $review->submitted_by
            ??
            $review->created_by;

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
            'hrm_performance_reviews'
        )
            ->where(
                'id',
                $review->id
            )
            ->update([
                'overall_rating' =>
                    $validated[
                        'overall_rating'
                    ],

                'manager_comments' =>
                    $validated[
                        'manager_comments'
                    ],

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
            'hrm.performance.review.approved',
            'hrm_performance_review',
            $review->id,
            [
                'review_id' =>
                    $review->id,

                'overall_rating' =>
                    $validated[
                        'overall_rating'
                    ],

                'automatic_salary_change' =>
                    false,

                'automatic_payroll_recalculation' =>
                    false,
            ]
        );

        return response()->json([
            'message' =>
                'Performance review approved.',
        ]);
    }

    public function createDevelopmentPlan(
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

                'source_review_id' => [
                    'nullable',
                    'integer',
                ],

                'objective' => [
                    'required',
                    'string',
                    'max:191',
                ],

                'development_action' => [
                    'required',
                    'string',
                    'max:5000',
                ],

                'target_date' => [
                    'nullable',
                    'date',
                ],
            ]);

        $tenantId =
            (int) $tenant->id;

        $this->employee(
            $tenantId,
            $scope,
            $validated['employee_id']
        );

        if (
            !empty(
                $validated[
                    'source_review_id'
                ]
            )
        ) {
            $review =
                $this->review(
                    $tenantId,
                    $scope,
                    $validated[
                        'source_review_id'
                    ]
                );

            if (
                (int) $review->employee_id
                !==
                (int) $validated[
                    'employee_id'
                ]
            ) {
                throw ValidationException::withMessages([
                    'source_review_id' => [
                        'The selected review belongs to another employee.',
                    ],
                ]);
            }
        }

        $id =
            DB::table(
                'hrm_development_plans'
            )
                ->insertGetId([
                    'uuid' =>
                        (string) Str::uuid(),

                    'tenant_id' =>
                        $tenantId,

                    'employee_id' =>
                        $validated[
                            'employee_id'
                        ],

                    'source_review_id' =>
                        $validated[
                            'source_review_id'
                        ] ?? null,

                    'objective' =>
                        $validated[
                            'objective'
                        ],

                    'development_action' =>
                        $validated[
                            'development_action'
                        ],

                    'target_date' =>
                        $validated[
                            'target_date'
                        ] ?? null,

                    'status' =>
                        'active',

                    'created_by' =>
                        $request->user()->id,

                    'updated_by' =>
                        $request->user()->id,

                    'created_at' =>
                        now(),

                    'updated_at' =>
                        now(),
                ]);

        $this->audit(
            $audit,
            $scope,
            'hrm.performance.development_plan.created',
            'hrm_development_plan',
            $id,
            [
                'development_plan_id' =>
                    $id,

                'employee_id' =>
                    $validated[
                        'employee_id'
                    ],
            ]
        );

        return response()->json([
            'message' =>
                'Development plan created.',

            'development_plan_id' =>
                $id,
        ], 201);
    }

    public function updateDevelopmentPlan(
        Request $request,
        int $planId,
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
                'status' => [
                    'required',
                    'in:active,completed,cancelled',
                ],

                'progress_notes' => [
                    'nullable',
                    'string',
                    'max:5000',
                ],
            ]);

        $plan =
            $this->developmentPlan(
                (int) $tenant->id,
                $scope,
                $planId
            );

        DB::table(
            'hrm_development_plans'
        )
            ->where(
                'id',
                $plan->id
            )
            ->update([
                'status' =>
                    $validated['status'],

                'progress_notes' =>
                    $validated[
                        'progress_notes'
                    ] ?? null,

                'updated_by' =>
                    $request->user()->id,

                'updated_at' =>
                    now(),
            ]);

        $this->audit(
            $audit,
            $scope,
            'hrm.performance.development_plan.updated',
            'hrm_development_plan',
            $plan->id,
            [
                'development_plan_id' =>
                    $plan->id,

                'status' =>
                    $validated['status'],
            ]
        );

        return response()->json([
            'message' =>
                'Development plan updated.',
        ]);
    }

    public function createCourse(
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
                'code' => [
                    'required',
                    'string',
                    'max:100',
                ],

                'title' => [
                    'required',
                    'string',
                    'max:191',
                ],

                'provider' => [
                    'nullable',
                    'string',
                    'max:191',
                ],

                'delivery_mode' => [
                    'required',
                    'in:classroom,online,blended,on_the_job',
                ],

                'duration_hours' => [
                    'nullable',
                    'numeric',
                    'min:0',
                ],

                'mandatory' => [
                    'required',
                    'boolean',
                ],

                'certification_required' => [
                    'required',
                    'boolean',
                ],
            ]);

        $tenantId =
            (int) $tenant->id;

        if (
            DB::table(
                'hrm_learning_courses'
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
                    'This learning course code already exists.',
                ],
            ]);
        }

        $id =
            DB::table(
                'hrm_learning_courses'
            )
                ->insertGetId([
                    'uuid' =>
                        (string) Str::uuid(),

                    'tenant_id' =>
                        $tenantId,

                    'code' =>
                        $validated['code'],

                    'title' =>
                        $validated['title'],

                    'provider' =>
                        $validated[
                            'provider'
                        ] ?? null,

                    'delivery_mode' =>
                        $validated[
                            'delivery_mode'
                        ],

                    'duration_hours' =>
                        $validated[
                            'duration_hours'
                        ] ?? null,

                    'mandatory' =>
                        (bool) $validated[
                            'mandatory'
                        ],

                    'certification_required' =>
                        (bool) $validated[
                            'certification_required'
                        ],

                    'status' =>
                        'active',

                    'created_by' =>
                        $request->user()->id,

                    'updated_by' =>
                        $request->user()->id,

                    'created_at' =>
                        now(),

                    'updated_at' =>
                        now(),
                ]);

        $this->audit(
            $audit,
            $scope,
            'hrm.learning.course.created',
            'hrm_learning_course',
            $id,
            [
                'course_id' =>
                    $id,
            ]
        );

        return response()->json([
            'message' =>
                'Learning course created.',

            'course_id' =>
                $id,
        ], 201);
    }

    public function enroll(
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

                'course_id' => [
                    'required',
                    'integer',
                ],

                'due_date' => [
                    'nullable',
                    'date',
                ],
            ]);

        $tenantId =
            (int) $tenant->id;

        $this->employee(
            $tenantId,
            $scope,
            $validated['employee_id']
        );

        $course =
            DB::table(
                'hrm_learning_courses'
            )
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->where(
                    'id',
                    $validated['course_id']
                )
                ->where(
                    'status',
                    'active'
                )
                ->first();

        if (!$course) {
            throw ValidationException::withMessages([
                'course_id' => [
                    'The selected active learning course was not found.',
                ],
            ]);
        }

        if (
            DB::table(
                'hrm_learning_enrollments'
            )
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->where(
                    'employee_id',
                    $validated[
                        'employee_id'
                    ]
                )
                ->where(
                    'course_id',
                    $course->id
                )
                ->exists()
        ) {
            throw ValidationException::withMessages([
                'employee_id' => [
                    'This employee is already enrolled in the course.',
                ],
            ]);
        }

        $id =
            DB::table(
                'hrm_learning_enrollments'
            )
                ->insertGetId([
                    'uuid' =>
                        (string) Str::uuid(),

                    'tenant_id' =>
                        $tenantId,

                    'employee_id' =>
                        $validated[
                            'employee_id'
                        ],

                    'course_id' =>
                        $course->id,

                    'status' =>
                        'enrolled',

                    'enrolled_at' =>
                        now(),

                    'due_date' =>
                        $validated[
                            'due_date'
                        ] ?? null,

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
            'hrm.learning.enrollment.created',
            'hrm_learning_enrollment',
            $id,
            [
                'enrollment_id' =>
                    $id,

                'employee_id' =>
                    $validated[
                        'employee_id'
                    ],

                'course_id' =>
                    $course->id,
            ]
        );

        return response()->json([
            'message' =>
                'Employee enrolled in course.',

            'enrollment_id' =>
                $id,
        ], 201);
    }

    public function completeEnrollment(
        Request $request,
        int $enrollmentId,
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
                'score' => [
                    'nullable',
                    'numeric',
                    'min:0',
                    'max:100',
                ],

                'result' => [
                    'required',
                    'in:passed,failed,completed',
                ],

                'completion_notes' => [
                    'nullable',
                    'string',
                    'max:5000',
                ],
            ]);

        $enrollment =
            $this->enrollment(
                (int) $tenant->id,
                $scope,
                $enrollmentId
            );

        if (
            !in_array(
                $enrollment->status,
                [
                    'enrolled',
                    'in_progress',
                ],
                true
            )
        ) {
            throw ValidationException::withMessages([
                'status' => [
                    'Only active enrolments can be completed.',
                ],
            ]);
        }

        DB::table(
            'hrm_learning_enrollments'
        )
            ->where(
                'id',
                $enrollment->id
            )
            ->update([
                'status' =>
                    'completed',

                'completed_at' =>
                    now(),

                'score' =>
                    $validated[
                        'score'
                    ] ?? null,

                'result' =>
                    $validated['result'],

                'completion_notes' =>
                    $validated[
                        'completion_notes'
                    ] ?? null,

                'completed_by' =>
                    $request->user()->id,

                'updated_at' =>
                    now(),
            ]);

        $this->audit(
            $audit,
            $scope,
            'hrm.learning.enrollment.completed',
            'hrm_learning_enrollment',
            $enrollment->id,
            [
                'enrollment_id' =>
                    $enrollment->id,

                'result' =>
                    $validated['result'],
            ]
        );

        return response()->json([
            'message' =>
                'Learning enrolment completed.',
        ]);
    }

    public function issueCertification(
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
                'enrollment_id' => [
                    'required',
                    'integer',
                ],

                'certificate_code' => [
                    'required',
                    'string',
                    'max:100',
                ],

                'issued_at' => [
                    'required',
                    'date',
                ],

                'expires_at' => [
                    'nullable',
                    'date',
                    'after_or_equal:issued_at',
                ],
            ]);

        $tenantId =
            (int) $tenant->id;

        $enrollment =
            $this->enrollment(
                $tenantId,
                $scope,
                $validated[
                    'enrollment_id'
                ]
            );

        if (
            $enrollment->status !==
            'completed'
        ) {
            throw ValidationException::withMessages([
                'enrollment_id' => [
                    'Only completed learning can be certified.',
                ],
            ]);
        }

        if (
            $enrollment->result ===
            'failed'
        ) {
            throw ValidationException::withMessages([
                'enrollment_id' => [
                    'A failed learning result cannot receive certification.',
                ],
            ]);
        }

        if (
            DB::table(
                'hrm_learning_certifications'
            )
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->where(
                    'certificate_code',
                    $validated[
                        'certificate_code'
                    ]
                )
                ->exists()
        ) {
            throw ValidationException::withMessages([
                'certificate_code' => [
                    'This certificate code already exists.',
                ],
            ]);
        }

        $id =
            DB::table(
                'hrm_learning_certifications'
            )
                ->insertGetId([
                    'uuid' =>
                        (string) Str::uuid(),

                    'tenant_id' =>
                        $tenantId,

                    'employee_id' =>
                        $enrollment->employee_id,

                    'course_id' =>
                        $enrollment->course_id,

                    'enrollment_id' =>
                        $enrollment->id,

                    'certificate_code' =>
                        $validated[
                            'certificate_code'
                        ],

                    'issued_at' =>
                        $validated[
                            'issued_at'
                        ],

                    'expires_at' =>
                        $validated[
                            'expires_at'
                        ] ?? null,

                    'status' =>
                        'valid',

                    'issued_by' =>
                        $request->user()->id,

                    'created_at' =>
                        now(),

                    'updated_at' =>
                        now(),
                ]);

        $this->audit(
            $audit,
            $scope,
            'hrm.learning.certification.issued',
            'hrm_learning_certification',
            $id,
            [
                'certification_id' =>
                    $id,

                'employee_id' =>
                    $enrollment->employee_id,

                'course_id' =>
                    $enrollment->course_id,
            ]
        );

        return response()->json([
            'message' =>
                'Learning certification issued.',

            'certification_id' =>
                $id,
        ], 201);
    }


    # ============================================================
    # SCOPED RECORD HELPERS
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
            $scope->branchId !==
                null
        ) {
            return
                (int)
                $scope->branchId;
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

    private function cycle(
        int $tenantId,
        $scope,
        int $cycleId
    ): object {
        $query =
            DB::table(
                'hrm_performance_cycles'
            )
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->where(
                    'id',
                    $cycleId
                );

        $branchId =
            $this->branchId(
                $scope
            );

        if ($branchId !== null) {
            $query->where(
                function ($nested) use (
                    $branchId
                ) {
                    $nested
                        ->whereNull(
                            'branch_id'
                        )
                        ->orWhere(
                            'branch_id',
                            $branchId
                        );
                }
            );
        }

        $row =
            $query->first();

        if (!$row) {
            abort(404);
        }

        return $row;
    }

    private function goal(
        int $tenantId,
        $scope,
        int $goalId
    ): object {
        $query =
            DB::table(
                'hrm_performance_goals as g'
            )
                ->join(
                    'hrm_employees as e',
                    'e.id',
                    '=',
                    'g.employee_id'
                )
                ->where(
                    'g.tenant_id',
                    $tenantId
                )
                ->where(
                    'g.id',
                    $goalId
                );

        $branchId =
            $this->branchId(
                $scope
            );

        if ($branchId !== null) {
            $query->where(
                'e.home_branch_id',
                $branchId
            );
        }

        $row =
            $query->first([
                'g.*',
            ]);

        if (!$row) {
            abort(404);
        }

        return $row;
    }

    private function review(
        int $tenantId,
        $scope,
        int $reviewId
    ): object {
        $query =
            DB::table(
                'hrm_performance_reviews as r'
            )
                ->join(
                    'hrm_employees as e',
                    'e.id',
                    '=',
                    'r.employee_id'
                )
                ->where(
                    'r.tenant_id',
                    $tenantId
                )
                ->where(
                    'r.id',
                    $reviewId
                );

        $branchId =
            $this->branchId(
                $scope
            );

        if ($branchId !== null) {
            $query->where(
                'e.home_branch_id',
                $branchId
            );
        }

        $row =
            $query->first([
                'r.*',
            ]);

        if (!$row) {
            abort(404);
        }

        return $row;
    }

    private function developmentPlan(
        int $tenantId,
        $scope,
        int $planId
    ): object {
        $query =
            DB::table(
                'hrm_development_plans as d'
            )
                ->join(
                    'hrm_employees as e',
                    'e.id',
                    '=',
                    'd.employee_id'
                )
                ->where(
                    'd.tenant_id',
                    $tenantId
                )
                ->where(
                    'd.id',
                    $planId
                );

        $branchId =
            $this->branchId(
                $scope
            );

        if ($branchId !== null) {
            $query->where(
                'e.home_branch_id',
                $branchId
            );
        }

        $row =
            $query->first([
                'd.*',
            ]);

        if (!$row) {
            abort(404);
        }

        return $row;
    }

    private function enrollment(
        int $tenantId,
        $scope,
        int $enrollmentId
    ): object {
        $query =
            DB::table(
                'hrm_learning_enrollments as le'
            )
                ->join(
                    'hrm_employees as e',
                    'e.id',
                    '=',
                    'le.employee_id'
                )
                ->join(
                    'hrm_learning_courses as lc',
                    'lc.id',
                    '=',
                    'le.course_id'
                )
                ->where(
                    'le.tenant_id',
                    $tenantId
                )
                ->where(
                    'le.id',
                    $enrollmentId
                );

        $branchId =
            $this->branchId(
                $scope
            );

        if ($branchId !== null) {
            $query->where(
                'e.home_branch_id',
                $branchId
            );
        }

        $row =
            $query->first([
                'le.*',
                'lc.certification_required',
            ]);

        if (!$row) {
            abort(404);
        }

        return $row;
    }

    private function audit(
        AuditLogService $audit,
        $scope,
        string $action,
        string $type,
        int $id,
        array $metadata
    ): void {
        $audit->record(
            action:
                $action,

            scope:
                $scope,

            metadata:
                $metadata,

            dataClassification:
                'internal',

            auditableType:
                $type,

            auditableId:
                $id
        );
    }
}
