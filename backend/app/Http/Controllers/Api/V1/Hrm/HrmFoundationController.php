<?php

namespace App\Http\Controllers\Api\V1\Hrm;

use App\Http\Controllers\Controller;
use App\Models\Branch;
use App\Models\BranchDepartment;
use App\Models\Hrm\CompensationHistory;
use App\Models\Hrm\Employee;
use App\Models\Hrm\EmployeeAssignment;
use App\Models\Hrm\EmployeeContract;
use App\Models\Hrm\EmployeeDocument;
use App\Models\Hrm\JobGrade;
use App\Models\Hrm\Position;
use App\Models\Hrm\ProfessionalCredential;
use App\Services\Access\ScopeContext;
use App\Services\Access\ScopeResolver;
use App\Services\Audit\AuditLogService;
use App\Services\Hrm\HrmTenantContextService;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class HrmFoundationController extends Controller
{
    public function __construct(
        private HrmTenantContextService $tenantContext
    ) {
    }


    public function overview(
        Request $request,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        [
            'tenant' => $tenant,
            'scope' => $scope,
        ] = $this->tenantContext->resolve(
            $request,
            $scopeResolver
        );

        $employees = $this->employeeQuery(
            $tenant->id,
            $scope
        );

        $positions = $this->positionQuery(
            $tenant->id,
            $scope
        );

        $employeeIds = (
            clone $employees
        )->select('id');

        $today = today();

        return response()->json([
            'tenant' => [
                'id' => $tenant->id,
                'name' => $tenant->name,
                'slug' => $tenant->slug,
            ],

            'scope' => $scope->toArray(),

            'metrics' => [
                'employees' =>
                    (
                        clone $employees
                    )->count(),

                'active_employees' =>
                    (
                        clone $employees
                    )
                        ->where(
                            'employment_status',
                            'active'
                        )
                        ->count(),

                'positions' =>
                    (
                        clone $positions
                    )
                        ->where(
                            'status',
                            'active'
                        )
                        ->count(),

                'contracts_expiring_60_days' =>
                    EmployeeContract::query()
                        ->where(
                            'tenant_id',
                            $tenant->id
                        )
                        ->whereIn(
                            'employee_id',
                            $employeeIds
                        )
                        ->whereNotNull(
                            'end_date'
                        )
                        ->whereBetween(
                            'end_date',
                            [
                                $today->toDateString(),
                                $today
                                    ->copy()
                                    ->addDays(60)
                                    ->toDateString(),
                            ]
                        )
                        ->whereIn(
                            'status',
                            [
                                'draft',
                                'active',
                            ]
                        )
                        ->count(),

                'credentials_expiring_60_days' =>
                    ProfessionalCredential::query()
                        ->where(
                            'tenant_id',
                            $tenant->id
                        )
                        ->whereIn(
                            'employee_id',
                            $employeeIds
                        )
                        ->whereNotNull(
                            'expires_at'
                        )
                        ->whereBetween(
                            'expires_at',
                            [
                                $today->toDateString(),
                                $today
                                    ->copy()
                                    ->addDays(60)
                                    ->toDateString(),
                            ]
                        )
                        ->where(
                            'status',
                            'active'
                        )
                        ->count(),

                /*
                 * Do not expose compensation approval counts
                 * through the general HR overview permission.
                 */
                'pending_compensation_approvals' =>
                    null,
            ],

            'payroll' => [
                'status' =>
                    'not_activated',

                'message' =>
                    'Payroll calculation remains disabled until the dedicated payroll phase is implemented and approved.',
            ],

            'finance_posting_created' =>
                false,
        ]);
    }


    public function organization(
        Request $request,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        [
            'tenant' => $tenant,
            'scope' => $scope,
        ] = $this->tenantContext->resolve(
            $request,
            $scopeResolver
        );

        $branches = Branch::query()
            ->where(
                'tenant_id',
                $tenant->id
            )
            ->when(
                $scope->isBranch(),
                fn (Builder $query) =>
                    $query->where(
                        'id',
                        $scope->branchId
                    )
            )
            ->orderBy('name')
            ->get([
                'id',
                'name',
                'code',
                'status',
            ]);

        $departments = BranchDepartment::query()
            ->where(
                'tenant_id',
                $tenant->id
            )
            ->when(
                $scope->isBranch(),
                fn (Builder $query) =>
                    $query->where(
                        'branch_id',
                        $scope->branchId
                    )
            )
            ->orderBy('name')
            ->get([
                'id',
                'branch_id',
                'uuid',
                'name',
                'code',
                'department_type',
                'operating_status',
            ]);

        $grades = JobGrade::query()
            ->where(
                'tenant_id',
                $tenant->id
            )
            ->orderByRaw(
                'COALESCE(grade_level, 999999), name'
            )
            ->get()
            ->map(
                fn (JobGrade $grade) =>
                    $this->serializeGrade(
                        $grade
                    )
            )
            ->values();

        $positions = $this->positionQuery(
            $tenant->id,
            $scope
        )
            ->orderBy('title')
            ->get()
            ->map(
                fn (Position $position) =>
                    $this->serializePosition(
                        $position
                    )
            )
            ->values();

        return response()->json([
            'branches' =>
                $branches,

            'departments' =>
                $departments,

            'job_grades' =>
                $grades,

            'positions' =>
                $positions,
        ]);
    }


    public function storeJobGrade(
        Request $request,
        ScopeResolver $scopeResolver,
        AuditLogService $auditLogService
    ): JsonResponse {
        [
            'tenant' => $tenant,
            'scope' => $scope,
        ] = $this->tenantContext->resolve(
            $request,
            $scopeResolver
        );

        $validated = $request->validate([
            'code' => [
                'required',
                'string',
                'max:100',

                Rule::unique(
                    'hrm_job_grades',
                    'code'
                )->where(
                    fn ($query) =>
                        $query->where(
                            'tenant_id',
                            $tenant->id
                        )
                ),
            ],

            'name' => [
                'required',
                'string',
                'max:191',
            ],

            'description' => [
                'nullable',
                'string',
                'max:2000',
            ],

            'grade_level' => [
                'nullable',
                'integer',
                'min:1',
                'max:9999',
            ],

            'minimum_salary' => [
                'nullable',
                'numeric',
                'min:0',
            ],

            'maximum_salary' => [
                'nullable',
                'numeric',
                'min:0',
            ],

            'currency' => [
                'sometimes',
                'string',
                'size:3',
            ],

            'effective_from' => [
                'nullable',
                'date',
            ],

            'effective_to' => [
                'nullable',
                'date',
                'after_or_equal:effective_from',
            ],
        ]);

        if (
            isset(
                $validated['minimum_salary'],
                $validated['maximum_salary']
            )
            &&
            (float) $validated['maximum_salary']
                <
            (float) $validated['minimum_salary']
        ) {
            throw ValidationException::withMessages([
                'maximum_salary' => [
                    'Maximum salary cannot be lower than minimum salary.',
                ],
            ]);
        }

        $grade = JobGrade::query()
            ->create([
                ...$validated,

                'tenant_id' =>
                    $tenant->id,

                'currency' =>
                    strtoupper(
                        $validated['currency']
                        ?? 'RWF'
                    ),

                'status' =>
                    'active',

                'created_by' =>
                    $request->user()->id,
            ]);

        $auditLogService->record(
            action: 'hrm.job_grade.created',
            scope: $scope,
            metadata: [
                'grade_code' =>
                    $grade->code,

                'grade_name' =>
                    $grade->name,
            ],
            dataClassification: 'confidential',
            auditableType: JobGrade::class,
            auditableId: $grade->id
        );

        return response()->json([
            'message' =>
                'Job grade created successfully.',

            'job_grade' =>
                $this->serializeGrade(
                    $grade
                ),
        ], 201);
    }


    public function storePosition(
        Request $request,
        ScopeResolver $scopeResolver,
        AuditLogService $auditLogService
    ): JsonResponse {
        [
            'tenant' => $tenant,
            'scope' => $scope,
        ] = $this->tenantContext->resolve(
            $request,
            $scopeResolver
        );

        $validated = $request->validate([
            'code' => [
                'required',
                'string',
                'max:100',

                Rule::unique(
                    'hrm_positions',
                    'code'
                )->where(
                    fn ($query) =>
                        $query->where(
                            'tenant_id',
                            $tenant->id
                        )
                ),
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

            'reports_to_position_id' => [
                'nullable',
                'integer',
            ],

            'headcount_budget' => [
                'nullable',
                'integer',
                'min:0',
                'max:100000',
            ],

            'requires_professional_license' => [
                'sometimes',
                'boolean',
            ],
        ]);

        if (
            $scope->isBranch()
        ) {
            $validated['branch_id'] =
                $scope->branchId;
        }

        $this->validateOrganizationReferences(
            tenantId: $tenant->id,
            branchId:
                $validated['branch_id']
                ?? null,
            departmentId:
                $validated['department_id']
                ?? null,
            gradeId:
                $validated['job_grade_id']
                ?? null,
            positionId:
                $validated[
                    'reports_to_position_id'
                ]
                ?? null,
            scope: $scope
        );

        $position = Position::query()
            ->create([
                ...$validated,

                'tenant_id' =>
                    $tenant->id,

                'status' =>
                    'active',

                'created_by' =>
                    $request->user()->id,
            ]);

        $auditLogService->record(
            action: 'hrm.position.created',
            scope: $scope,
            metadata: [
                'position_code' =>
                    $position->code,

                'position_title' =>
                    $position->title,

                'branch_id' =>
                    $position->branch_id,

                'department_id' =>
                    $position->department_id,
            ],
            dataClassification: 'internal',
            auditableType: Position::class,
            auditableId: $position->id
        );

        return response()->json([
            'message' =>
                'Position created successfully.',

            'position' =>
                $this->serializePosition(
                    $position
                ),
        ], 201);
    }


    public function employees(
        Request $request,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        [
            'tenant' => $tenant,
            'scope' => $scope,
        ] = $this->tenantContext->resolve(
            $request,
            $scopeResolver
        );

        $validated = $request->validate([
            'search' => [
                'nullable',
                'string',
                'max:100',
            ],

            'status' => [
                'nullable',
                'string',
                'max:30',
            ],

            'branch_id' => [
                'nullable',
                'integer',
            ],
        ]);

        $query = $this->employeeQuery(
            $tenant->id,
            $scope
        );

        if (
            ! empty(
                $validated['branch_id']
            )
        ) {
            if (
                $scope->isBranch()
                &&
                (int) $validated['branch_id']
                    !==
                (int) $scope->branchId
            ) {
                abort(403);
            }

            $query->where(
                'home_branch_id',
                $validated['branch_id']
            );
        }

        if (
            ! empty(
                $validated['status']
            )
        ) {
            $query->where(
                'employment_status',
                $validated['status']
            );
        }

        if (
            ! empty(
                $validated['search']
            )
        ) {
            $search =
                '%'
                .
                trim(
                    $validated['search']
                )
                .
                '%';

            $query->where(
                function (Builder $sub) use ($search): void {
                    $sub
                        ->where(
                            'employee_number',
                            'like',
                            $search
                        )
                        ->orWhere(
                            'first_name',
                            'like',
                            $search
                        )
                        ->orWhere(
                            'last_name',
                            'like',
                            $search
                        )
                        ->orWhere(
                            'preferred_name',
                            'like',
                            $search
                        )
                        ->orWhere(
                            'work_email',
                            'like',
                            $search
                        );
                }
            );
        }

        $employees = $query
            ->orderBy('last_name')
            ->orderBy('first_name')
            ->limit(200)
            ->get()
            ->map(
                fn (Employee $employee) =>
                    $this->serializeEmployee(
                        $employee
                    )
            )
            ->values();

        return response()->json([
            'employees' =>
                $employees,

            'count' =>
                $employees->count(),
        ]);
    }


    public function showEmployee(
        Request $request,
        int $employeeId,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        [
            'tenant' => $tenant,
            'scope' => $scope,
        ] = $this->tenantContext->resolve(
            $request,
            $scopeResolver
        );

        $employee = $this->employeeQuery(
            $tenant->id,
            $scope
        )
            ->where(
                'id',
                $employeeId
            )
            ->firstOrFail();

        return response()->json([
            'employee' =>
                $this->serializeEmployee(
                    $employee
                ),
        ]);
    }


    public function storeEmployee(
        Request $request,
        ScopeResolver $scopeResolver,
        AuditLogService $auditLogService
    ): JsonResponse {
        [
            'tenant' => $tenant,
            'scope' => $scope,
        ] = $this->tenantContext->resolve(
            $request,
            $scopeResolver
        );

        $validated = $request->validate([
            'employee_number' => [
                'required',
                'string',
                'max:100',

                Rule::unique(
                    'hrm_employees',
                    'employee_number'
                )->where(
                    fn ($query) =>
                        $query->where(
                            'tenant_id',
                            $tenant->id
                        )
                ),
            ],

            'first_name' => [
                'required',
                'string',
                'max:100',
            ],

            'middle_name' => [
                'nullable',
                'string',
                'max:100',
            ],

            'last_name' => [
                'required',
                'string',
                'max:100',
            ],

            'preferred_name' => [
                'nullable',
                'string',
                'max:100',
            ],

            'work_email' => [
                'nullable',
                'email',
                'max:191',
            ],

            'employment_status' => [
                'sometimes',

                Rule::in([
                    'active',
                    'inactive',
                    'probation',
                    'suspended',
                    'terminated',
                ]),
            ],

            'employment_type' => [
                'sometimes',

                Rule::in([
                    'permanent',
                    'fixed_term',
                    'temporary',
                    'part_time',
                    'intern',
                    'consultant',
                ]),
            ],

            'hire_date' => [
                'nullable',
                'date',
            ],

            'probation_end_date' => [
                'nullable',
                'date',
                'after_or_equal:hire_date',
            ],

            'home_branch_id' => [
                'nullable',
                'integer',
            ],

            'current_department_id' => [
                'nullable',
                'integer',
            ],

            'current_position_id' => [
                'nullable',
                'integer',
            ],

            'job_grade_id' => [
                'nullable',
                'integer',
            ],

            'manager_employee_id' => [
                'nullable',
                'integer',
            ],
        ]);

        if (
            $scope->isBranch()
        ) {
            $validated['home_branch_id'] =
                $scope->branchId;
        }

        $this->validateOrganizationReferences(
            tenantId: $tenant->id,
            branchId:
                $validated['home_branch_id']
                ?? null,
            departmentId:
                $validated['current_department_id']
                ?? null,
            gradeId:
                $validated['job_grade_id']
                ?? null,
            positionId:
                $validated['current_position_id']
                ?? null,
            scope: $scope
        );

        $this->validateManager(
            tenantId: $tenant->id,
            managerId:
                $validated['manager_employee_id']
                ?? null
        );

        $employee = DB::transaction(
            function () use (
                $validated,
                $tenant,
                $request
            ): Employee {
                $employee = Employee::query()
                    ->create([
                        ...$validated,

                        'tenant_id' =>
                            $tenant->id,

                        'employment_status' =>
                            $validated['employment_status']
                            ?? 'active',

                        'employment_type' =>
                            $validated['employment_type']
                            ?? 'permanent',

                        'created_by' =>
                            $request->user()->id,
                    ]);

                if (
                    $employee->home_branch_id
                    ||
                    $employee->current_department_id
                    ||
                    $employee->current_position_id
                    ||
                    $employee->job_grade_id
                    ||
                    $employee->manager_employee_id
                ) {
                    EmployeeAssignment::query()
                        ->create([
                            'tenant_id' =>
                                $tenant->id,

                            'employee_id' =>
                                $employee->id,

                            'branch_id' =>
                                $employee->home_branch_id,

                            'department_id' =>
                                $employee->current_department_id,

                            'position_id' =>
                                $employee->current_position_id,

                            'job_grade_id' =>
                                $employee->job_grade_id,

                            'manager_employee_id' =>
                                $employee->manager_employee_id,

                            'assignment_type' =>
                                'primary',

                            'effective_from' =>
                                $employee->hire_date
                                    ? Carbon::parse(
                                        $employee->hire_date
                                    )->toDateString()
                                    : today()
                                        ->toDateString(),

                            'status' =>
                                'active',

                            'approved_by' =>
                                $request->user()->id,

                            'approved_at' =>
                                now(),

                            'created_by' =>
                                $request->user()->id,
                        ]);
                }

                return $employee;
            }
        );

        $auditLogService->record(
            action: 'hrm.employee.created',
            scope: $scope,
            metadata: [
                'employee_id' =>
                    $employee->id,

                'employee_number' =>
                    $employee->employee_number,

                'branch_id' =>
                    $employee->home_branch_id,

                'department_id' =>
                    $employee->current_department_id,

                'position_id' =>
                    $employee->current_position_id,
            ],
            dataClassification: 'confidential',
            auditableType: Employee::class,
            auditableId: $employee->id
        );

        return response()->json([
            'message' =>
                'Employee created successfully.',

            'employee' =>
                $this->serializeEmployee(
                    $employee->fresh()
                ),
        ], 201);
    }


    public function updateEmployee(
        Request $request,
        int $employeeId,
        ScopeResolver $scopeResolver,
        AuditLogService $auditLogService
    ): JsonResponse {
        [
            'tenant' => $tenant,
            'scope' => $scope,
        ] = $this->tenantContext->resolve(
            $request,
            $scopeResolver
        );

        $employee = $this->employeeQuery(
            $tenant->id,
            $scope
        )
            ->where(
                'id',
                $employeeId
            )
            ->firstOrFail();

        $validated = $request->validate([
            'first_name' => [
                'sometimes',
                'string',
                'max:100',
            ],

            'middle_name' => [
                'nullable',
                'string',
                'max:100',
            ],

            'last_name' => [
                'sometimes',
                'string',
                'max:100',
            ],

            'preferred_name' => [
                'nullable',
                'string',
                'max:100',
            ],

            'work_email' => [
                'nullable',
                'email',
                'max:191',
            ],

            'employment_status' => [
                'sometimes',

                Rule::in([
                    'active',
                    'inactive',
                    'probation',
                    'suspended',
                    'terminated',
                ]),
            ],

            'employment_type' => [
                'sometimes',

                Rule::in([
                    'permanent',
                    'fixed_term',
                    'temporary',
                    'part_time',
                    'intern',
                    'consultant',
                ]),
            ],

            'hire_date' => [
                'nullable',
                'date',
            ],

            'termination_date' => [
                'nullable',
                'date',
            ],

            'probation_end_date' => [
                'nullable',
                'date',
            ],

            'home_branch_id' => [
                'nullable',
                'integer',
            ],

            'current_department_id' => [
                'nullable',
                'integer',
            ],

            'current_position_id' => [
                'nullable',
                'integer',
            ],

            'job_grade_id' => [
                'nullable',
                'integer',
            ],

            'manager_employee_id' => [
                'nullable',
                'integer',
            ],

            'assignment_effective_from' => [
                'nullable',
                'date',
            ],
        ]);

        $effectiveHireDate =
            array_key_exists(
                'hire_date',
                $validated
            )
                ? $validated['hire_date']
                : $this->dateValue(
                    $employee->hire_date
                );

        foreach (
            [
                'termination_date',
                'probation_end_date',
            ]
            as $dateField
        ) {
            if (
                ! empty(
                    $validated[$dateField]
                )
                &&
                $effectiveHireDate
                &&
                Carbon::parse(
                    $validated[$dateField]
                )->lt(
                    Carbon::parse(
                        $effectiveHireDate
                    )
                )
            ) {
                throw ValidationException::withMessages([
                    $dateField => [
                        'This date cannot be earlier than the employee hire date.',
                    ],
                ]);
            }
        }

        if (
            $scope->isBranch()
            &&
            array_key_exists(
                'home_branch_id',
                $validated
            )
            &&
            (int) $validated['home_branch_id']
                !==
            (int) $scope->branchId
        ) {
            abort(403);
        }

        $branchId =
            array_key_exists(
                'home_branch_id',
                $validated
            )
                ? $validated['home_branch_id']
                : $employee->home_branch_id;

        $departmentId =
            array_key_exists(
                'current_department_id',
                $validated
            )
                ? $validated['current_department_id']
                : $employee->current_department_id;

        $gradeId =
            array_key_exists(
                'job_grade_id',
                $validated
            )
                ? $validated['job_grade_id']
                : $employee->job_grade_id;

        $positionId =
            array_key_exists(
                'current_position_id',
                $validated
            )
                ? $validated['current_position_id']
                : $employee->current_position_id;

        $managerId =
            array_key_exists(
                'manager_employee_id',
                $validated
            )
                ? $validated['manager_employee_id']
                : $employee->manager_employee_id;

        $this->validateOrganizationReferences(
            tenantId: $tenant->id,
            branchId: $branchId,
            departmentId: $departmentId,
            gradeId: $gradeId,
            positionId: $positionId,
            scope: $scope
        );

        $this->validateManager(
            tenantId: $tenant->id,
            managerId: $managerId,
            employeeId: $employee->id
        );

        $assignmentFields = [
            'home_branch_id',
            'current_department_id',
            'current_position_id',
            'job_grade_id',
            'manager_employee_id',
        ];

        $assignmentChanged = false;

        foreach (
            $assignmentFields
            as $field
        ) {
            if (
                array_key_exists(
                    $field,
                    $validated
                )
                &&
                (string) $employee->{$field}
                    !==
                (string) $validated[$field]
            ) {
                $assignmentChanged = true;
                break;
            }
        }

        $assignmentEffective =
            $validated[
                'assignment_effective_from'
            ]
            ?? null;

        if (
            $assignmentChanged
            &&
            ! $assignmentEffective
        ) {
            throw ValidationException::withMessages([
                'assignment_effective_from' => [
                    'An effective date is required when branch, department, position, grade or manager changes.',
                ],
            ]);
        }

        $before = $employee->only([
            'first_name',
            'middle_name',
            'last_name',
            'preferred_name',
            'work_email',
            'employment_status',
            'employment_type',
            'hire_date',
            'termination_date',
            'probation_end_date',
            'home_branch_id',
            'current_department_id',
            'current_position_id',
            'job_grade_id',
            'manager_employee_id',
        ]);

        unset(
            $validated[
                'assignment_effective_from'
            ]
        );

        DB::transaction(
            function () use (
                $employee,
                $validated,
                $assignmentChanged,
                $assignmentEffective,
                $tenant,
                $request
            ): void {
                $employee->fill(
                    $validated
                );

                $employee->updated_by =
                    $request->user()->id;

                $employee->save();

                if (
                    ! $assignmentChanged
                ) {
                    return;
                }

                $effective = Carbon::parse(
                    $assignmentEffective
                )->startOfDay();

                $current =
                    EmployeeAssignment::query()
                        ->where(
                            'tenant_id',
                            $tenant->id
                        )
                        ->where(
                            'employee_id',
                            $employee->id
                        )
                        ->where(
                            'status',
                            'active'
                        )
                        ->whereNull(
                            'effective_to'
                        )
                        ->orderByDesc(
                            'effective_from'
                        )
                        ->first();

                if (
                    $current
                    &&
                    Carbon::parse(
                        $current->effective_from
                    )->startOfDay()
                        >=
                    $effective
                ) {
                    throw ValidationException::withMessages([
                        'assignment_effective_from' => [
                            'The new assignment must begin after the current assignment effective date.',
                        ],
                    ]);
                }

                if (
                    $current
                ) {
                    $current->effective_to =
                        $effective
                            ->copy()
                            ->subDay()
                            ->toDateString();

                    $current->status =
                        'inactive';

                    $current->updated_by =
                        $request->user()->id;

                    $current->save();
                }

                EmployeeAssignment::query()
                    ->create([
                        'tenant_id' =>
                            $tenant->id,

                        'employee_id' =>
                            $employee->id,

                        'branch_id' =>
                            $employee->home_branch_id,

                        'department_id' =>
                            $employee->current_department_id,

                        'position_id' =>
                            $employee->current_position_id,

                        'job_grade_id' =>
                            $employee->job_grade_id,

                        'manager_employee_id' =>
                            $employee->manager_employee_id,

                        'assignment_type' =>
                            'primary',

                        'effective_from' =>
                            $effective->toDateString(),

                        'status' =>
                            'active',

                        'approved_by' =>
                            $request->user()->id,

                        'approved_at' =>
                            now(),

                        'created_by' =>
                            $request->user()->id,
                    ]);
            }
        );

        $employee->refresh();

        $auditLogService->record(
            action: 'hrm.employee.updated',
            scope: $scope,
            metadata: [
                'employee_id' =>
                    $employee->id,

                'employee_number' =>
                    $employee->employee_number,

                'before' =>
                    $before,

                'after' =>
                    $employee->only(
                        array_keys(
                            $before
                        )
                    ),

                'assignment_changed' =>
                    $assignmentChanged,
            ],
            dataClassification: 'confidential',
            auditableType: Employee::class,
            auditableId: $employee->id
        );

        return response()->json([
            'message' =>
                'Employee updated successfully.',

            'employee' =>
                $this->serializeEmployee(
                    $employee
                ),
        ]);
    }


    public function contracts(
        Request $request,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        [
            'tenant' => $tenant,
            'scope' => $scope,
        ] = $this->tenantContext->resolve(
            $request,
            $scopeResolver
        );

        $employeeIds = $this->employeeQuery(
            $tenant->id,
            $scope
        )->select('id');

        $contracts =
            EmployeeContract::query()
                ->where(
                    'tenant_id',
                    $tenant->id
                )
                ->whereIn(
                    'employee_id',
                    $employeeIds
                )
                ->orderByDesc(
                    'start_date'
                )
                ->limit(250)
                ->get()
                ->map(
                    fn (EmployeeContract $contract) =>
                        $this->serializeContract(
                            $contract
                        )
                )
                ->values();

        return response()->json([
            'contracts' =>
                $contracts,
        ]);
    }


    public function storeContract(
        Request $request,
        ScopeResolver $scopeResolver,
        AuditLogService $auditLogService
    ): JsonResponse {
        [
            'tenant' => $tenant,
            'scope' => $scope,
        ] = $this->tenantContext->resolve(
            $request,
            $scopeResolver
        );

        $validated = $request->validate([
            'employee_id' => [
                'required',
                'integer',
            ],

            'contract_number' => [
                'required',
                'string',
                'max:100',

                Rule::unique(
                    'hrm_employee_contracts',
                    'contract_number'
                )->where(
                    fn ($query) =>
                        $query->where(
                            'tenant_id',
                            $tenant->id
                        )
                ),
            ],

            'contract_type' => [
                'required',

                Rule::in([
                    'permanent',
                    'fixed_term',
                    'temporary',
                    'part_time',
                    'internship',
                    'consultancy',
                ]),
            ],

            'start_date' => [
                'required',
                'date',
            ],

            'end_date' => [
                'nullable',
                'date',
                'after_or_equal:start_date',
            ],

            'probation_end_date' => [
                'nullable',
                'date',
                'after_or_equal:start_date',
            ],

            'work_schedule_type' => [
                'nullable',
                'string',
                'max:50',
            ],

            'working_hours_per_week' => [
                'nullable',
                'numeric',
                'min:0',
                'max:168',
            ],

            'notes' => [
                'nullable',
                'string',
                'max:4000',
            ],
        ]);

        $employee = $this->employeeQuery(
            $tenant->id,
            $scope
        )
            ->where(
                'id',
                $validated['employee_id']
            )
            ->firstOrFail();

        $contract =
            EmployeeContract::query()
                ->create([
                    ...$validated,

                    'tenant_id' =>
                        $tenant->id,

                    'employee_id' =>
                        $employee->id,

                    'status' =>
                        'draft',

                    'created_by' =>
                        $request->user()->id,
                ]);

        $auditLogService->record(
            action: 'hrm.contract.created',
            scope: $scope,
            metadata: [
                'employee_id' =>
                    $employee->id,

                'contract_number' =>
                    $contract->contract_number,

                'contract_type' =>
                    $contract->contract_type,

                'start_date' =>
                    $this->dateValue(
                        $contract->start_date
                    ),

                'end_date' =>
                    $this->dateValue(
                        $contract->end_date
                    ),
            ],
            dataClassification: 'confidential',
            auditableType: EmployeeContract::class,
            auditableId: $contract->id
        );

        return response()->json([
            'message' =>
                'Contract draft created successfully.',

            'contract' =>
                $this->serializeContract(
                    $contract
                ),
        ], 201);
    }


    public function updateContract(
        Request $request,
        int $contractId,
        ScopeResolver $scopeResolver,
        AuditLogService $auditLogService
    ): JsonResponse {
        [
            'tenant' => $tenant,
            'scope' => $scope,
        ] = $this->tenantContext->resolve(
            $request,
            $scopeResolver
        );

        $employeeIds = $this->employeeQuery(
            $tenant->id,
            $scope
        )->select('id');

        $contract =
            EmployeeContract::query()
                ->where(
                    'tenant_id',
                    $tenant->id
                )
                ->whereIn(
                    'employee_id',
                    $employeeIds
                )
                ->where(
                    'id',
                    $contractId
                )
                ->firstOrFail();

        $validated = $request->validate([
            'status' => [
                'sometimes',

                Rule::in([
                    'draft',
                    'active',
                    'expired',
                    'terminated',
                ]),
            ],

            'end_date' => [
                'nullable',
                'date',
            ],

            'probation_end_date' => [
                'nullable',
                'date',
            ],

            'work_schedule_type' => [
                'nullable',
                'string',
                'max:50',
            ],

            'working_hours_per_week' => [
                'nullable',
                'numeric',
                'min:0',
                'max:168',
            ],

            'signed_at' => [
                'nullable',
                'date',
            ],

            'notes' => [
                'nullable',
                'string',
                'max:4000',
            ],
        ]);

        foreach (
            [
                'end_date',
                'probation_end_date',
            ]
            as $field
        ) {
            if (
                ! empty(
                    $validated[$field]
                )
                &&
                Carbon::parse(
                    $validated[$field]
                )->lt(
                    Carbon::parse(
                        $contract->start_date
                    )
                )
            ) {
                throw ValidationException::withMessages([
                    $field => [
                        'This date cannot be earlier than the contract start date.',
                    ],
                ]);
            }
        }

        $before =
            $contract->only(
                array_keys(
                    $validated
                )
            );

        $contract->fill(
            $validated
        );

        $contract->updated_by =
            $request->user()->id;

        $contract->save();

        $auditLogService->record(
            action: 'hrm.contract.updated',
            scope: $scope,
            metadata: [
                'employee_id' =>
                    $contract->employee_id,

                'contract_number' =>
                    $contract->contract_number,

                'before' =>
                    $before,

                'after' =>
                    $contract->only(
                        array_keys(
                            $validated
                        )
                    ),
            ],
            dataClassification: 'confidential',
            auditableType: EmployeeContract::class,
            auditableId: $contract->id
        );

        return response()->json([
            'message' =>
                'Contract updated successfully.',

            'contract' =>
                $this->serializeContract(
                    $contract
                ),
        ]);
    }


    public function compensations(
        Request $request,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        [
            'tenant' => $tenant,
            'scope' => $scope,
        ] = $this->tenantContext->resolve(
            $request,
            $scopeResolver
        );

        $employeeIds = $this->employeeQuery(
            $tenant->id,
            $scope
        )->select('id');

        $items =
            CompensationHistory::query()
                ->where(
                    'tenant_id',
                    $tenant->id
                )
                ->whereIn(
                    'employee_id',
                    $employeeIds
                )
                ->orderByDesc(
                    'effective_from'
                )
                ->limit(250)
                ->get()
                ->map(
                    fn (CompensationHistory $item) =>
                        $this->serializeCompensation(
                            $item
                        )
                )
                ->values();

        return response()->json([
            'compensations' =>
                $items,

            'finance_posting_created' =>
                false,
        ]);
    }


    public function storeCompensation(
        Request $request,
        ScopeResolver $scopeResolver,
        AuditLogService $auditLogService
    ): JsonResponse {
        [
            'tenant' => $tenant,
            'scope' => $scope,
        ] = $this->tenantContext->resolve(
            $request,
            $scopeResolver
        );

        $validated = $request->validate([
            'employee_id' => [
                'required',
                'integer',
            ],

            'contract_id' => [
                'nullable',
                'integer',
            ],

            'effective_from' => [
                'required',
                'date',
            ],

            'effective_to' => [
                'nullable',
                'date',
                'after_or_equal:effective_from',
            ],

            'currency' => [
                'sometimes',
                'string',
                'size:3',
            ],

            'pay_frequency' => [
                'sometimes',

                Rule::in([
                    'monthly',
                    'weekly',
                    'biweekly',
                ]),
            ],

            'basic_salary' => [
                'required',
                'numeric',
                'min:0',
            ],

            'fixed_gross_compensation' => [
                'nullable',
                'numeric',
                'min:0',
            ],

            'reason' => [
                'required',
                'string',
                'max:2000',
            ],
        ]);

        $employee = $this->employeeQuery(
            $tenant->id,
            $scope
        )
            ->where(
                'id',
                $validated['employee_id']
            )
            ->firstOrFail();

        if (
            isset(
                $validated[
                    'fixed_gross_compensation'
                ]
            )
            &&
            (float) $validated[
                'fixed_gross_compensation'
            ]
                <
            (float) $validated[
                'basic_salary'
            ]
        ) {
            throw ValidationException::withMessages([
                'fixed_gross_compensation' => [
                    'Fixed gross compensation cannot be lower than basic salary.',
                ],
            ]);
        }

        if (
            ! empty(
                $validated['contract_id']
            )
        ) {
            EmployeeContract::query()
                ->where(
                    'tenant_id',
                    $tenant->id
                )
                ->where(
                    'employee_id',
                    $employee->id
                )
                ->where(
                    'id',
                    $validated['contract_id']
                )
                ->firstOrFail();
        }

        $compensation =
            CompensationHistory::query()
                ->create([
                    ...$validated,

                    'tenant_id' =>
                        $tenant->id,

                    'employee_id' =>
                        $employee->id,

                    'currency' =>
                        strtoupper(
                            $validated['currency']
                            ?? 'RWF'
                        ),

                    'pay_frequency' =>
                        $validated['pay_frequency']
                        ?? 'monthly',

                    'status' =>
                        'draft',

                    'created_by' =>
                        $request->user()->id,

                    'metadata' => [
                        'source' =>
                            'hrm_b1b_controlled_entry',

                        'finance_posting' =>
                            'not_created',
                    ],
                ]);

        $auditLogService->record(
            action: 'hrm.compensation.draft_created',
            scope: $scope,
            metadata: [
                'employee_id' =>
                    $employee->id,

                'compensation_id' =>
                    $compensation->id,

                'effective_from' =>
                    $this->dateValue(
                        $compensation->effective_from
                    ),

                'effective_to' =>
                    $this->dateValue(
                        $compensation->effective_to
                    ),

                'currency' =>
                    $compensation->currency,

                'status' =>
                    $compensation->status,

                'financial_values_logged' =>
                    false,

                'finance_posting_created' =>
                    false,
            ],
            dataClassification: 'restricted',
            auditableType: CompensationHistory::class,
            auditableId: $compensation->id
        );

        return response()->json([
            'message' =>
                'Compensation draft created. A different authorized reviewer must approve it.',

            'compensation' =>
                $this->serializeCompensation(
                    $compensation
                ),

            'finance_posting_created' =>
                false,
        ], 201);
    }



    // AQUILA_HRM_COMPENSATION_REVIEW_R3_R2_BACKEND_START

    public function updateCompensationDraft(
        Request $request,
        int $compensationId,
        ScopeResolver $scopeResolver,
        AuditLogService $auditLogService
    ): JsonResponse {
        [
            'tenant' => $tenant,
            'scope' => $scope,
        ] = $this->tenantContext->resolve(
            $request,
            $scopeResolver
        );

        $employeeIds =
            $this->employeeQuery(
                $tenant->id,
                $scope
            )->select('id');

        $compensation =
            CompensationHistory::query()
                ->where(
                    'tenant_id',
                    $tenant->id
                )
                ->whereIn(
                    'employee_id',
                    $employeeIds
                )
                ->where(
                    'id',
                    $compensationId
                )
                ->firstOrFail();

        abort_unless(
            $compensation->status === 'draft',
            422,
            'Only draft compensation records can be updated.'
        );

        $validated =
            $request->validate([
                'effective_from' => [
                    'sometimes',
                    'required',
                    'date',
                ],

                'effective_to' => [
                    'sometimes',
                    'nullable',
                    'date',
                ],

                'basic_salary' => [
                    'sometimes',
                    'required',
                    'numeric',
                    'min:0',
                ],

                'fixed_gross_compensation' => [
                    'sometimes',
                    'nullable',
                    'numeric',
                    'min:0',
                ],

                'reason' => [
                    'sometimes',
                    'nullable',
                    'string',
                    'max:2000',
                ],
            ]);

        $effectiveFrom =
            array_key_exists(
                'effective_from',
                $validated
            )
                ? Carbon::parse(
                    $validated['effective_from']
                )
                : Carbon::parse(
                    $compensation->effective_from
                );

        $effectiveTo =
            array_key_exists(
                'effective_to',
                $validated
            )
                ? (
                    $validated['effective_to']
                        ? Carbon::parse(
                            $validated['effective_to']
                        )
                        : null
                )
                : (
                    $compensation->effective_to
                        ? Carbon::parse(
                            $compensation->effective_to
                        )
                        : null
                );

        if (
            $effectiveTo
            &&
            $effectiveTo->lt(
                $effectiveFrom
            )
        ) {
            throw ValidationException::withMessages([
                'effective_to' => [
                    'Effective to must be on or after effective from.',
                ],
            ]);
        }

        $allowedFields = [
            'effective_from',
            'effective_to',
            'basic_salary',
            'fixed_gross_compensation',
            'reason',
        ];

        $changedFields = [];

        DB::transaction(
            function () use (
                $compensation,
                $validated,
                $allowedFields,
                $request,
                &$changedFields
            ): void {
                foreach (
                    $allowedFields
                    as $field
                ) {
                    if (
                        ! array_key_exists(
                            $field,
                            $validated
                        )
                    ) {
                        continue;
                    }

                    $before =
                        $compensation->{$field};

                    $compensation->{$field} =
                        $validated[$field];

                    $after =
                        $compensation->{$field};

                    if (
                        (string) $before
                        !==
                        (string) $after
                    ) {
                        $changedFields[] =
                            $field;
                    }
                }

                $compensation->updated_by =
                    $request->user()->id;

                $compensation->save();
            }
        );

        $auditLogService->record(
            action: 'hrm.compensation.draft_updated',
            scope: $scope,
            metadata: [
                'employee_id' =>
                    $compensation->employee_id,

                'compensation_id' =>
                    $compensation->id,

                'maker_user_id' =>
                    $compensation->created_by,

                'updated_by_user_id' =>
                    $request->user()->id,

                'changed_fields' =>
                    $changedFields,

                'status_preserved' =>
                    'draft',

                'employee_identity_changed' =>
                    false,

                'contract_ownership_changed' =>
                    false,

                'currency_changed' =>
                    false,

                'pay_frequency_changed' =>
                    false,

                'financial_values_logged' =>
                    false,

                'finance_posting_created' =>
                    false,
            ],
            dataClassification: 'restricted',
            auditableType: CompensationHistory::class,
            auditableId: $compensation->id
        );

        return response()->json([
            'message' =>
                'Draft compensation updated. No approval or Finance journal has been created.',

            'compensation' =>
                $this->serializeCompensation(
                    $compensation->fresh()
                ),

            'finance_posting_created' =>
                false,
        ]);
    }


    public function rejectCompensationDraft(
        Request $request,
        int $compensationId,
        ScopeResolver $scopeResolver,
        AuditLogService $auditLogService
    ): JsonResponse {
        [
            'tenant' => $tenant,
            'scope' => $scope,
        ] = $this->tenantContext->resolve(
            $request,
            $scopeResolver
        );

        $employeeIds =
            $this->employeeQuery(
                $tenant->id,
                $scope
            )->select('id');

        $compensation =
            CompensationHistory::query()
                ->where(
                    'tenant_id',
                    $tenant->id
                )
                ->whereIn(
                    'employee_id',
                    $employeeIds
                )
                ->where(
                    'id',
                    $compensationId
                )
                ->firstOrFail();

        abort_unless(
            $compensation->status === 'draft',
            422,
            'Only draft compensation records can be rejected.'
        );

        if (
            (
(int) $compensation->created_by
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
                'rejection' => [
                    'Maker/checker control requires another authorized user to reject this compensation record.',
                ],
            ]);
        }

        $validated =
            $request->validate([
                'rejection_reason' => [
                    'required',
                    'string',
                    'max:2000',
                ],
            ]);

        DB::transaction(
            function () use (
                $compensation,
                $validated,
                $request
            ): void {
                $metadata =
                    is_array(
                        $compensation->metadata
                    )
                        ? $compensation->metadata
                        : [];

                $metadata['rejection'] = [
                    'status' =>
                        'rejected',

                    'reason' =>
                        $validated[
                            'rejection_reason'
                        ],

                    'maker_user_id' =>
                        $compensation->created_by,

                    'checker_user_id' =>
                        $request->user()->id,

                    'rejected_at' =>
                        now()->toIso8601String(),

                    'finance_posting' =>
                        'not_created',
                ];

                $compensation->metadata =
                    $metadata;

                $compensation->status =
                    'rejected';

                $compensation->updated_by =
                    $request->user()->id;

                $compensation->save();
            }
        );

        $auditLogService->record(
            action: 'hrm.compensation.rejected',
            scope: $scope,
            metadata: [
                'employee_id' =>
                    $compensation->employee_id,

                'compensation_id' =>
                    $compensation->id,

                'maker_user_id' =>
                    $compensation->created_by,

                'checker_user_id' =>
                    $request->user()->id,

                'rejection_reason_recorded' =>
                    true,

                'original_compensation_reason_preserved' =>
                    true,

                'financial_values_logged' =>
                    false,

                'finance_posting_created' =>
                    false,
            ],
            dataClassification: 'restricted',
            auditableType: CompensationHistory::class,
            auditableId: $compensation->id
        );

        return response()->json([
            'message' =>
                'Compensation rejected. No payroll calculation or Finance journal has been created.',

            'compensation' =>
                $this->serializeCompensation(
                    $compensation->fresh()
                ),

            'finance_posting_created' =>
                false,
        ]);
    }

    // AQUILA_HRM_COMPENSATION_REVIEW_R3_R2_BACKEND_END


    /**
     * AQUILA_HRM_SALARY_CHANGE_CREATE_R6
     *
     * Prepare an effective-dated salary replacement.
     *
     * This does not edit an approved salary.
     * This does not approve the new salary.
     * This does not recalculate payroll.
     * This does not create a Finance posting.
     */
    public function createCompensationChange(
        Request $request,
        int $compensationId,
        ScopeResolver $scopeResolver,
        AuditLogService $auditLogService
    ): JsonResponse {
        [
            'tenant' => $tenant,
            'scope' => $scope,
        ] = $this->tenantContext->resolve(
            $request,
            $scopeResolver
        );

        $employeeIds =
            $this->employeeQuery(
                $tenant->id,
                $scope
            )->select('id');

        $source =
            CompensationHistory::query()
                ->where(
                    'tenant_id',
                    $tenant->id
                )
                ->whereIn(
                    'employee_id',
                    $employeeIds
                )
                ->where(
                    'id',
                    $compensationId
                )
                ->where(
                    'status',
                    'approved'
                )
                ->firstOrFail();

        $validated =
            $request->validate([
                'effective_from' => [
                    'required',
                    'date',
                ],

                'basic_salary' => [
                    'required',
                    'numeric',
                    'min:0',
                ],

                'fixed_gross_compensation' => [
                    'nullable',
                    'numeric',
                    'min:0',
                ],

                'change_type' => [
                    'required',
                    \Illuminate\Validation\Rule::in([
                        'promotion',
                        'annual_review',
                        'market_adjustment',
                        'role_change',
                        'correction',
                        'other',
                    ]),
                ],

                'reason' => [
                    'required',
                    'string',
                    'max:1000',
                ],
            ]);

        $effectiveFrom =
            Carbon::parse(
                $validated['effective_from']
            )->toDateString();

        $sourceFrom =
            Carbon::parse(
                $source->effective_from
            )->toDateString();

        $sourceTo =
            $source->effective_to
                ? Carbon::parse(
                    $source->effective_to
                )->toDateString()
                : null;

        if (
            $effectiveFrom
                <=
            $sourceFrom
        ) {
            throw ValidationException::withMessages([
                'effective_from' => [
                    'The new salary must start after the approved salary it replaces.',
                ],
            ]);
        }

        if (
            $sourceTo !== null
            &&
            $effectiveFrom
                >
            $sourceTo
        ) {
            throw ValidationException::withMessages([
                'effective_from' => [
                    'The selected approved salary is not active on that effective date. Select the correct salary history record.',
                ],
            ]);
        }

        /*
         * Do not silently rewrite an employee payroll snapshot that
         * has already moved beyond DRAFT.
         *
         * DRAFT payroll may still be prepared after the new salary is
         * approved.
         *
         * PREPARED / UNDER_REVIEW must be explicitly revised.
         *
         * APPROVED / DECLARED / PAID / CLOSED remains immutable and
         * requires the controlled adjustment / reversal lifecycle.
         */
        $protectedPayrollExists =
            DB::table(
                'payroll_run_employees as pre'
            )
                ->join(
                    'payroll_runs as pr',
                    'pr.id',
                    '=',
                    'pre.payroll_run_id'
                )
                ->join(
                    'payroll_periods as pp',
                    'pp.id',
                    '=',
                    'pr.payroll_period_id'
                )
                ->where(
                    'pre.tenant_id',
                    $tenant->id
                )
                ->where(
                    'pre.employee_id',
                    $source->employee_id
                )
                ->whereDate(
                    'pp.starts_on',
                    '<=',
                    $effectiveFrom
                )
                ->whereDate(
                    'pp.ends_on',
                    '>=',
                    $effectiveFrom
                )
                ->whereIn(
                    'pr.status',
                    [
                        'PREPARED',
                        'UNDER_REVIEW',
                        'APPROVED',
                        'DECLARED',
                        'PAID',
                        'CLOSED',
                        'prepared',
                        'under_review',
                        'approved',
                        'declared',
                        'paid',
                        'closed',
                    ]
                )
                ->exists();

        if (
            $protectedPayrollExists
        ) {
            throw ValidationException::withMessages([
                'effective_from' => [
                    'That effective date is already inside a payroll run that has progressed beyond Draft. Use Payroll Runs to revise/recalculate an open run, or the adjustment/reversal process for approved or closed payroll.',
                ],
            ]);
        }

        $duplicateDraft =
            CompensationHistory::query()
                ->where(
                    'tenant_id',
                    $tenant->id
                )
                ->where(
                    'employee_id',
                    $source->employee_id
                )
                ->where(
                    'status',
                    'draft'
                )
                ->whereDate(
                    'effective_from',
                    $effectiveFrom
                )
                ->exists();

        if (
            $duplicateDraft
        ) {
            throw ValidationException::withMessages([
                'effective_from' => [
                    'A draft salary change already exists for this employee on that effective date.',
                ],
            ]);
        }

        $newBasicSalary =
            (float) $validated[
                'basic_salary'
            ];

        $newFixedGross =
            array_key_exists(
                'fixed_gross_compensation',
                $validated
            )
                ? (
                    $validated[
                        'fixed_gross_compensation'
                    ] === null
                        ? null
                        : (float) $validated[
                            'fixed_gross_compensation'
                        ]
                )
                : (
                    $source
                        ->fixed_gross_compensation
                        === null
                            ? null
                            : (float) $source
                                ->fixed_gross_compensation
                );

        $currentBasicSalary =
            (float) $source->basic_salary;

        $currentFixedGross =
            $source
                ->fixed_gross_compensation
                === null
                    ? null
                    : (float) $source
                        ->fixed_gross_compensation;

        $basicChanged =
            abs(
                $newBasicSalary
                    -
                $currentBasicSalary
            ) > 0.0001;

        $grossChanged =
            (
                $newFixedGross === null
                &&
                $currentFixedGross !== null
            )
            ||
            (
                $newFixedGross !== null
                &&
                $currentFixedGross === null
            )
            ||
            (
                $newFixedGross !== null
                &&
                $currentFixedGross !== null
                &&
                abs(
                    $newFixedGross
                        -
                    $currentFixedGross
                ) > 0.0001
            );

        if (
            ! $basicChanged
            &&
            ! $grossChanged
        ) {
            throw ValidationException::withMessages([
                'basic_salary' => [
                    'Enter a salary value that is different from the currently approved salary.',
                ],
            ]);
        }

        $draft =
            new CompensationHistory();

        $draft->uuid =
            (string)
            \Illuminate\Support\Str::uuid();

        $draft->tenant_id =
            $tenant->id;

        $draft->employee_id =
            $source->employee_id;

        $draft->contract_id =
            $source->contract_id;

        $draft->effective_from =
            $effectiveFrom;

        $draft->effective_to =
            null;

        $draft->currency =
            $source->currency;

        $draft->pay_frequency =
            $source->pay_frequency;

        $draft->basic_salary =
            $newBasicSalary;

        $draft->fixed_gross_compensation =
            $newFixedGross;

        $draft->status =
            'draft';

        $draft->reason =
            $validated['reason'];

        $draft->created_by =
            $request->user()->id;

        $draft->updated_by =
            $request->user()->id;

        $draft->metadata = [
            'salary_change' => [
                'workflow' =>
                    'effective_dated_supersession',

                'change_type' =>
                    $validated['change_type'],

                'supersedes_compensation_id' =>
                    (int) $source->id,

                'supersedes_compensation_uuid' =>
                    (string) $source->uuid,

                'prepared_by' =>
                    (int) $request->user()->id,

                'finance_posting' =>
                    'not_created',
            ],

            'finance_posting' =>
                'not_created',
        ];

        $draft->save();

        $auditLogService->record(
            action:
                'hrm.compensation.salary_change_prepared',

            scope:
                $scope,

            metadata: [
                'employee_id' =>
                    $draft->employee_id,

                'source_compensation_id' =>
                    $source->id,

                'draft_compensation_id' =>
                    $draft->id,

                'change_type' =>
                    $validated['change_type'],

                'effective_from' =>
                    $effectiveFrom,

                'financial_values_logged' =>
                    false,

                'finance_posting_created' =>
                    false,
            ],

            dataClassification:
                'restricted',

            auditableType:
                CompensationHistory::class,

            auditableId:
                $draft->id
        );

        return response()->json([
            'message' =>
                'Salary change saved as Draft. Review and approve it before it becomes effective.',

            'compensation' =>
                $this->serializeCompensation(
                    $draft
                ),

            'supersedes_compensation_id' =>
                (int) $source->id,

            'finance_posting_created' =>
                false,
        ], 201);
    }

    public function approveCompensation(
        Request $request,
        int $compensationId,
        ScopeResolver $scopeResolver,
        AuditLogService $auditLogService
    ): JsonResponse {
        [
            'tenant' => $tenant,
            'scope' => $scope,
        ] = $this->tenantContext->resolve(
            $request,
            $scopeResolver
        );

        $employeeIds = $this->employeeQuery(
            $tenant->id,
            $scope
        )->select('id');

        $compensation =
            CompensationHistory::query()
                ->where(
                    'tenant_id',
                    $tenant->id
                )
                ->whereIn(
                    'employee_id',
                    $employeeIds
                )
                ->where(
                    'id',
                    $compensationId
                )
                ->firstOrFail();

        abort_unless(
            $compensation->status === 'draft',
            422,
            'Only draft compensation records can be approved.'
        );

        // AQUILA_HRM_COMPENSATION_ADMIN_OWNER_SELF_APPROVAL_R3_R3_R1

        $approvalUser =
            $request->user();

        $roleNames = [];

        try {
            if (
                method_exists(
                    $approvalUser,
                    'getRoleNames'
                )
            ) {
                $roleNames =
                    array_values(
                        array_map(
                            'strval',
                            $approvalUser
                                ->getRoleNames()
                                ->all()
                        )
                    );
            } elseif (
                method_exists(
                    $approvalUser,
                    'roles'
                )
            ) {
                $roleNames =
                    array_values(
                        array_map(
                            'strval',
                            $approvalUser
                                ->roles()
                                ->pluck('name')
                                ->all()
                        )
                    );
            }
        } catch (\Throwable $exception) {
            $roleNames = [];
        }

        $normalizedRoles = [];

        foreach (
            $roleNames
            as $roleName
        ) {
            $normalizedRole =
                strtolower(
                    trim(
                        preg_replace(
                            '/[^a-z0-9]+/i',
                            ' ',
                            $roleName
                        )
                        ?? $roleName
                    )
                );

            if ($normalizedRole !== '') {
                $normalizedRoles[] =
                    $normalizedRole;
            }
        }

        $hasAdminOrOwnerRole =
            false;

        foreach (
            $normalizedRoles
            as $normalizedRole
        ) {
            if (
                str_contains(
                    $normalizedRole,
                    'admin'
                )
                ||
                str_contains(
                    $normalizedRole,
                    'owner'
                )
            ) {
                $hasAdminOrOwnerRole =
                    true;

                break;
            }
        }

        $hasAdminOrOwnerFlag =
            false;

        foreach (
            [
                'is_admin',
                'is_owner',
                'is_super_admin',
                'super_admin',
            ]
            as $flag
        ) {
            $flagValue =
                $approvalUser->{$flag}
                ?? null;

            if (
                $flagValue === true
                ||
                $flagValue === 1
                ||
                $flagValue === '1'
            ) {
                $hasAdminOrOwnerFlag =
                    true;

                break;
            }
        }

        $isTenantOwner =
            false;

        foreach (
            [
                'owner_id',
                'owner_user_id',
            ]
            as $ownerField
        ) {
            $ownerValue =
                $tenant->{$ownerField}
                ?? null;

            if (
                $ownerValue !== null
                &&
                (int) $ownerValue
                    ===
                (int) $approvalUser->id
            ) {
                $isTenantOwner =
                    true;

                break;
            }
        }

        $canBypassMakerChecker =
            \App\Support\MakerCheckerExemptionPolicy::allows(
                (int) (auth()->id() ?? 0),
                isset($tenantId)
                    ? (int) $tenantId
                    : null,
                isset($branchId)
                    ? (int) $branchId
                    : null
            );

        $isSelfApproval =
            (int) $compensation->created_by
                ===
            (int) $approvalUser->id;

        $makerCheckerBypassBasis =
            $canBypassMakerChecker
                ? 'central_admin_owner_policy'
                : null;

        if (
            $isSelfApproval
            &&
            ! $canBypassMakerChecker
        ) {
            throw ValidationException::withMessages([
                'approval' => [
                    'Maker/checker control requires another authorized user to approve this compensation record.',
                ],
            ]);
        }

        /*
         * AQUILA_HRM_SALARY_LIFECYCLE_R6
         *
         * Approved compensation remains immutable financial history.
         *
         * A salary-change draft may identify one approved record that
         * it supersedes. That record is excluded from the overlap check
         * only after tenant, employee, status and date lineage are
         * verified here.
         */
        $approvalMetadata =
            is_array(
                $compensation->metadata
            )
                ? $compensation->metadata
                : [];

        $salaryChangeMetadata =
            isset(
                $approvalMetadata['salary_change']
            )
            &&
            is_array(
                $approvalMetadata['salary_change']
            )
                ? $approvalMetadata['salary_change']
                : [];

        $supersededCompensationId =
            isset(
                $salaryChangeMetadata[
                    'supersedes_compensation_id'
                ]
            )
            &&
            (int) $salaryChangeMetadata[
                'supersedes_compensation_id'
            ] > 0
                ? (int) $salaryChangeMetadata[
                    'supersedes_compensation_id'
                ]
                : null;

        $supersededCompensation = null;

        if (
            $supersededCompensationId !== null
        ) {
            $supersededCompensation =
                CompensationHistory::query()
                    ->where(
                        'tenant_id',
                        $tenant->id
                    )
                    ->where(
                        'employee_id',
                        $compensation->employee_id
                    )
                    ->where(
                        'id',
                        $supersededCompensationId
                    )
                    ->where(
                        'status',
                        'approved'
                    )
                    ->first();

            if (
                ! $supersededCompensation
            ) {
                throw ValidationException::withMessages([
                    'salary_change' => [
                        'The approved salary being replaced could not be verified.',
                    ],
                ]);
            }

            $candidateStart =
                Carbon::parse(
                    $compensation->effective_from
                )->toDateString();

            $supersededStart =
                Carbon::parse(
                    $supersededCompensation
                        ->effective_from
                )->toDateString();

            $supersededEnd =
                $supersededCompensation
                    ->effective_to
                    ? Carbon::parse(
                        $supersededCompensation
                            ->effective_to
                    )->toDateString()
                    : null;

            if (
                $candidateStart
                    <=
                $supersededStart
            ) {
                throw ValidationException::withMessages([
                    'effective_from' => [
                        'The new salary must start after the approved salary it replaces.',
                    ],
                ]);
            }

            if (
                $supersededEnd !== null
                &&
                $candidateStart
                    >
                $supersededEnd
            ) {
                throw ValidationException::withMessages([
                    'effective_from' => [
                        'The selected approved salary is no longer active on the requested effective date. Select the correct salary history record.',
                    ],
                ]);
            }
        }

        $start =
            Carbon::parse(
                $compensation->effective_from
            )->toDateString();

        $end =
            $compensation->effective_to
                ? Carbon::parse(
                    $compensation->effective_to
                )->toDateString()
                : '9999-12-31';

        $overlap =
            CompensationHistory::query()
                ->where(
                    'tenant_id',
                    $tenant->id
                )
                ->where(
                    'employee_id',
                    $compensation->employee_id
                )
                ->where(
                    'status',
                    'approved'
                )
                ->where(
                    'id',
                    '!=',
                    $compensation->id
                )
                ->when(
                    $supersededCompensation
                        !== null,
                    fn (Builder $query) =>
                        $query->where(
                            'id',
                            '!=',
                            $supersededCompensation->id
                        )
                )
                ->whereDate(
                    'effective_from',
                    '<=',
                    $end
                )
                ->where(
                    function (Builder $query) use ($start): void {
                        $query
                            ->whereNull(
                                'effective_to'
                            )
                            ->orWhereDate(
                                'effective_to',
                                '>=',
                                $start
                            );
                    }
                )
                ->exists();

        if (
            $overlap
        ) {
            throw ValidationException::withMessages([
                'effective_from' => [
                    'This compensation period overlaps an already-approved compensation record.',
                ],
            ]);
        }

        DB::transaction(
            function () use (
                $compensation,
                $request,
                $supersededCompensation,
                $start
            ): void {
                if (
                    $supersededCompensation
                        !== null
                ) {
                    $supersededCompensation
                        ->effective_to =
                        Carbon::parse(
                            $start
                        )
                            ->subDay()
                            ->toDateString();

                    $supersededCompensation
                        ->updated_by =
                        $request->user()->id;

                    $previousMetadata =
                        is_array(
                            $supersededCompensation
                                ->metadata
                        )
                            ? $supersededCompensation
                                ->metadata
                            : [];

                    $previousSalaryChange =
                        isset(
                            $previousMetadata[
                                'salary_change'
                            ]
                        )
                        &&
                        is_array(
                            $previousMetadata[
                                'salary_change'
                            ]
                        )
                            ? $previousMetadata[
                                'salary_change'
                            ]
                            : [];

                    $previousSalaryChange[
                        'superseded_by_compensation_id'
                    ] =
                        (int) $compensation->id;

                    $previousSalaryChange[
                        'superseded_effective_from'
                    ] =
                        $start;

                    $previousSalaryChange[
                        'finance_posting'
                    ] =
                        'not_created';

                    $previousMetadata[
                        'salary_change'
                    ] =
                        $previousSalaryChange;

                    $supersededCompensation
                        ->metadata =
                        $previousMetadata;

                    $supersededCompensation
                        ->save();
                }

                $compensation->status =
                    'approved';

                $compensation->approved_by =
                    $request->user()->id;

                $compensation->approved_at =
                    now();

                $compensation->updated_by =
                    $request->user()->id;

                $metadata =
                    is_array(
                        $compensation->metadata
                    )
                        ? $compensation->metadata
                        : [];

                $metadata['approval'] = [
                    'status' =>
                        'approved',

                    'finance_posting' =>
                        'not_created',
                ];

                $compensation->metadata =
                    $metadata;

                $compensation->save();
            }
        );

        $auditLogService->record(
            action: 'hrm.compensation.approved',
            scope: $scope,
            metadata: [
                'employee_id' =>
                    $compensation->employee_id,

                'compensation_id' =>
                    $compensation->id,

                'maker_user_id' =>
                    $compensation->created_by,

                'checker_user_id' =>
                    $request->user()->id,

                'self_approval' =>
                    $isSelfApproval,

                'maker_checker_bypass' =>
                    (
                        $isSelfApproval
                        &&
                        $canBypassMakerChecker
                    ),

                'maker_checker_bypass_basis' =>
                    $makerCheckerBypassBasis,

                'effective_from' =>
                    $this->dateValue(
                        $compensation->effective_from
                    ),

                'currency' =>
                    $compensation->currency,

                'financial_values_logged' =>
                    false,

                'finance_posting_created' =>
                    false,
            ],
            dataClassification: 'restricted',
            auditableType: CompensationHistory::class,
            auditableId: $compensation->id
        );

        return response()->json([
            'message' =>
                'Compensation approved. No payroll calculation or Finance journal has been created.',

            'compensation' =>
                $this->serializeCompensation(
                    $compensation
                ),

            'finance_posting_created' =>
                false,
        ]);
    }


    public function credentials(
        Request $request,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        [
            'tenant' => $tenant,
            'scope' => $scope,
        ] = $this->tenantContext->resolve(
            $request,
            $scopeResolver
        );

        $employeeIds = $this->employeeQuery(
            $tenant->id,
            $scope
        )->select('id');

        $items =
            ProfessionalCredential::query()
                ->where(
                    'tenant_id',
                    $tenant->id
                )
                ->whereIn(
                    'employee_id',
                    $employeeIds
                )
                ->orderByRaw(
                    'CASE WHEN expires_at IS NULL THEN 1 ELSE 0 END, expires_at'
                )
                ->limit(250)
                ->get()
                ->map(
                    fn (ProfessionalCredential $credential) =>
                        $this->serializeCredential(
                            $credential
                        )
                )
                ->values();

        return response()->json([
            'credentials' =>
                $items,
        ]);
    }


    public function storeCredential(
        Request $request,
        ScopeResolver $scopeResolver,
        AuditLogService $auditLogService
    ): JsonResponse {
        [
            'tenant' => $tenant,
            'scope' => $scope,
        ] = $this->tenantContext->resolve(
            $request,
            $scopeResolver
        );

        $validated = $request->validate([
            'employee_id' => [
                'required',
                'integer',
            ],

            'credential_type' => [
                'required',
                'string',
                'max:50',
            ],

            'credential_name' => [
                'required',
                'string',
                'max:191',
            ],

            'issuing_authority' => [
                'nullable',
                'string',
                'max:191',
            ],

            'credential_reference' => [
                'nullable',
                'string',
                'max:500',
            ],

            'issued_at' => [
                'nullable',
                'date',
            ],

            'expires_at' => [
                'nullable',
                'date',
                'after_or_equal:issued_at',
            ],
        ]);

        $employee = $this->employeeQuery(
            $tenant->id,
            $scope
        )
            ->where(
                'id',
                $validated['employee_id']
            )
            ->firstOrFail();

        $credential =
            ProfessionalCredential::query()
                ->create([
                    'tenant_id' =>
                        $tenant->id,

                    'employee_id' =>
                        $employee->id,

                    'credential_type' =>
                        $validated[
                            'credential_type'
                        ],

                    'credential_name' =>
                        $validated[
                            'credential_name'
                        ],

                    'issuing_authority' =>
                        $validated[
                            'issuing_authority'
                        ]
                        ?? null,

                    'encrypted_reference' =>
                        $validated[
                            'credential_reference'
                        ]
                        ?? null,

                    'issued_at' =>
                        $validated[
                            'issued_at'
                        ]
                        ?? null,

                    'expires_at' =>
                        $validated[
                            'expires_at'
                        ]
                        ?? null,

                    'status' =>
                        'active',

                    'verified' =>
                        false,

                    'metadata' => [
                        'created_from' =>
                            'hrm_b1b',
                    ],
                ]);

        $auditLogService->record(
            action: 'hrm.credential.created',
            scope: $scope,
            metadata: [
                'employee_id' =>
                    $employee->id,

                'credential_id' =>
                    $credential->id,

                'credential_type' =>
                    $credential->credential_type,

                'credential_name' =>
                    $credential->credential_name,

                'reference_logged' =>
                    false,
            ],
            dataClassification: 'confidential',
            auditableType: ProfessionalCredential::class,
            auditableId: $credential->id
        );

        return response()->json([
            'message' =>
                'Professional credential created. Verification remains pending.',

            'credential' =>
                $this->serializeCredential(
                    $credential
                ),
        ], 201);
    }


    public function documents(
        Request $request,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        [
            'tenant' => $tenant,
            'scope' => $scope,
        ] = $this->tenantContext->resolve(
            $request,
            $scopeResolver
        );

        $employeeIds = $this->employeeQuery(
            $tenant->id,
            $scope
        )->select('id');

        $items =
            EmployeeDocument::query()
                ->where(
                    'tenant_id',
                    $tenant->id
                )
                ->whereIn(
                    'employee_id',
                    $employeeIds
                )
                ->orderByDesc(
                    'created_at'
                )
                ->limit(250)
                ->get()
                ->map(
                    fn (EmployeeDocument $document) =>
                        $this->serializeDocument(
                            $document
                        )
                )
                ->values();

        return response()->json([
            'documents' =>
                $items,
        ]);
    }


    public function storeDocumentMetadata(
        Request $request,
        ScopeResolver $scopeResolver,
        AuditLogService $auditLogService
    ): JsonResponse {
        [
            'tenant' => $tenant,
            'scope' => $scope,
        ] = $this->tenantContext->resolve(
            $request,
            $scopeResolver
        );

        $validated = $request->validate([
            'employee_id' => [
                'required',
                'integer',
            ],

            'document_type' => [
                'required',
                'string',
                'max:50',
            ],

            'title' => [
                'required',
                'string',
                'max:191',
            ],

            'storage_path' => [
                'required',
                'string',
                'max:191',
                'regex:/^private\/hrm\//',
            ],

            'original_filename' => [
                'nullable',
                'string',
                'max:191',
            ],

            'mime_type' => [
                'nullable',
                'string',
                'max:100',
            ],

            'size_bytes' => [
                'nullable',
                'integer',
                'min:0',
            ],

            'checksum_sha256' => [
                'nullable',
                'string',
                'size:64',
            ],

            'classification' => [
                'sometimes',

                Rule::in([
                    'internal',
                    'confidential',
                    'restricted',
                ]),
            ],

            'issued_at' => [
                'nullable',
                'date',
            ],

            'expires_at' => [
                'nullable',
                'date',
                'after_or_equal:issued_at',
            ],
        ]);

        $employee = $this->employeeQuery(
            $tenant->id,
            $scope
        )
            ->where(
                'id',
                $validated['employee_id']
            )
            ->firstOrFail();

        $document =
            EmployeeDocument::query()
                ->create([
                    ...$validated,

                    'tenant_id' =>
                        $tenant->id,

                    'employee_id' =>
                        $employee->id,

                    'disk' =>
                        'local',

                    'classification' =>
                        $validated[
                            'classification'
                        ]
                        ?? 'confidential',

                    'status' =>
                        'active',

                    'uploaded_by' =>
                        $request->user()->id,
                ]);

        $auditLogService->record(
            action: 'hrm.document.metadata_created',
            scope: $scope,
            metadata: [
                'employee_id' =>
                    $employee->id,

                'document_id' =>
                    $document->id,

                'document_type' =>
                    $document->document_type,

                'classification' =>
                    $document->classification,

                'storage_path_logged' =>
                    false,
            ],
            dataClassification:
                $document->classification,
            auditableType: EmployeeDocument::class,
            auditableId: $document->id
        );

        return response()->json([
            'message' =>
                'Secure employee document metadata created.',

            'document' =>
                $this->serializeDocument(
                    $document
                ),
        ], 201);
    }


    private function employeeQuery(
        int $tenantId,
        ScopeContext $scope
    ): Builder {
        return Employee::query()
            ->where(
                'tenant_id',
                $tenantId
            )
            ->when(
                $scope->isBranch(),
                fn (Builder $query) =>
                    $query->where(
                        'home_branch_id',
                        $scope->branchId
                    )
            );
    }


    private function positionQuery(
        int $tenantId,
        ScopeContext $scope
    ): Builder {
        return Position::query()
            ->where(
                'tenant_id',
                $tenantId
            )
            ->when(
                $scope->isBranch(),
                fn (Builder $query) =>
                    $query->where(
                        'branch_id',
                        $scope->branchId
                    )
            );
    }


    private function validateOrganizationReferences(
        int $tenantId,
        ?int $branchId,
        ?int $departmentId,
        ?int $gradeId,
        ?int $positionId,
        ScopeContext $scope
    ): void {
        if (
            $scope->isBranch()
            &&
            (int) $branchId
                !==
            (int) $scope->branchId
        ) {
            throw ValidationException::withMessages([
                'branch_id' => [
                    'The selected branch is outside your authorized scope.',
                ],
            ]);
        }

        if (
            $branchId
        ) {
            Branch::query()
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->where(
                    'id',
                    $branchId
                )
                ->firstOrFail();
        }

        if (
            $departmentId
        ) {
            $department =
                BranchDepartment::query()
                    ->where(
                        'tenant_id',
                        $tenantId
                    )
                    ->where(
                        'id',
                        $departmentId
                    )
                    ->firstOrFail();

            if (
                $branchId
                &&
                (int) $department->branch_id
                    !==
                (int) $branchId
            ) {
                throw ValidationException::withMessages([
                    'department_id' => [
                        'The selected department does not belong to the selected branch.',
                    ],
                ]);
            }
        }

        if (
            $gradeId
        ) {
            JobGrade::query()
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->where(
                    'id',
                    $gradeId
                )
                ->firstOrFail();
        }

        if (
            $positionId
        ) {
            $position =
                Position::query()
                    ->where(
                        'tenant_id',
                        $tenantId
                    )
                    ->where(
                        'id',
                        $positionId
                    )
                    ->firstOrFail();

            if (
                $branchId
                &&
                $position->branch_id
                &&
                (int) $position->branch_id
                    !==
                (int) $branchId
            ) {
                throw ValidationException::withMessages([
                    'position_id' => [
                        'The selected position belongs to another branch.',
                    ],
                ]);
            }

            if (
                $departmentId
                &&
                $position->department_id
                &&
                (int) $position->department_id
                    !==
                (int) $departmentId
            ) {
                throw ValidationException::withMessages([
                    'position_id' => [
                        'The selected position belongs to another department.',
                    ],
                ]);
            }
        }
    }


    private function validateManager(
        int $tenantId,
        ?int $managerId,
        ?int $employeeId = null
    ): void {
        if (
            ! $managerId
        ) {
            return;
        }

        if (
            $employeeId
            &&
            (int) $employeeId
                ===
            (int) $managerId
        ) {
            throw ValidationException::withMessages([
                'manager_employee_id' => [
                    'An employee cannot be their own manager.',
                ],
            ]);
        }

        Employee::query()
            ->where(
                'tenant_id',
                $tenantId
            )
            ->where(
                'id',
                $managerId
            )
            ->firstOrFail();
    }


    private function dateValue(
        $value
    ): ?string {
        if (
            ! $value
        ) {
            return null;
        }

        return Carbon::parse(
            $value
        )->toDateString();
    }


    private function dateTimeValue(
        $value
    ): ?string {
        if (
            ! $value
        ) {
            return null;
        }

        return Carbon::parse(
            $value
        )->toISOString();
    }


    private function serializeGrade(
        JobGrade $grade
    ): array {
        return [
            'id' =>
                $grade->id,

            'uuid' =>
                $grade->uuid,

            'code' =>
                $grade->code,

            'name' =>
                $grade->name,

            'description' =>
                $grade->description,

            'grade_level' =>
                $grade->grade_level,

            'minimum_salary' =>
                $grade->minimum_salary,

            'maximum_salary' =>
                $grade->maximum_salary,

            'currency' =>
                $grade->currency,

            'status' =>
                $grade->status,

            'effective_from' =>
                $this->dateValue(
                    $grade->effective_from
                ),

            'effective_to' =>
                $this->dateValue(
                    $grade->effective_to
                ),
        ];
    }


    private function serializePosition(
        Position $position
    ): array {
        return [
            'id' =>
                $position->id,

            'uuid' =>
                $position->uuid,

            'code' =>
                $position->code,

            'title' =>
                $position->title,

            'description' =>
                $position->description,

            'branch_id' =>
                $position->branch_id,

            'department_id' =>
                $position->department_id,

            'job_grade_id' =>
                $position->job_grade_id,

            'reports_to_position_id' =>
                $position->reports_to_position_id,

            'headcount_budget' =>
                $position->headcount_budget,

            'requires_professional_license' =>
                (bool) $position
                    ->requires_professional_license,

            'status' =>
                $position->status,
        ];
    }


    private function serializeEmployee(
        Employee $employee
    ): array {
        $position = null;
        $grade = null;

        if (
            $employee->current_position_id
        ) {
            $positionModel =
                Position::query()
                    ->where(
                        'tenant_id',
                        $employee->tenant_id
                    )
                    ->where(
                        'id',
                        $employee->current_position_id
                    )
                    ->first([
                        'id',
                        'code',
                        'title',
                    ]);

            if (
                $positionModel
            ) {
                $position = [
                    'id' =>
                        $positionModel->id,

                    'code' =>
                        $positionModel->code,

                    'title' =>
                        $positionModel->title,
                ];
            }
        }

        if (
            $employee->job_grade_id
        ) {
            $gradeModel =
                JobGrade::query()
                    ->where(
                        'tenant_id',
                        $employee->tenant_id
                    )
                    ->where(
                        'id',
                        $employee->job_grade_id
                    )
                    ->first([
                        'id',
                        'code',
                        'name',
                    ]);

            if (
                $gradeModel
            ) {
                $grade = [
                    'id' =>
                        $gradeModel->id,

                    'code' =>
                        $gradeModel->code,

                    'name' =>
                        $gradeModel->name,
                ];
            }
        }

        return [
            'id' =>
                $employee->id,

            'uuid' =>
                $employee->uuid,

            'employee_number' =>
                $employee->employee_number,

            'first_name' =>
                $employee->first_name,

            'middle_name' =>
                $employee->middle_name,

            'last_name' =>
                $employee->last_name,

            'preferred_name' =>
                $employee->preferred_name,

            'display_name' =>
                trim(
                    (
                        $employee->preferred_name
                        ?: $employee->first_name
                    )
                    .
                    ' '
                    .
                    $employee->last_name
                ),

            'work_email' =>
                $employee->work_email,

            'employment_status' =>
                $employee->employment_status,

            'employment_type' =>
                $employee->employment_type,

            'hire_date' =>
                $this->dateValue(
                    $employee->hire_date
                ),

            'termination_date' =>
                $this->dateValue(
                    $employee->termination_date
                ),

            'probation_end_date' =>
                $this->dateValue(
                    $employee->probation_end_date
                ),

            'home_branch_id' =>
                $employee->home_branch_id,

            'current_department_id' =>
                $employee->current_department_id,

            'current_position_id' =>
                $employee->current_position_id,

            'job_grade_id' =>
                $employee->job_grade_id,

            'manager_employee_id' =>
                $employee->manager_employee_id,

            'position' =>
                $position,

            'grade' =>
                $grade,
        ];
    }


    private function serializeContract(
        EmployeeContract $contract
    ): array {
        return [
            'id' =>
                $contract->id,

            'uuid' =>
                $contract->uuid,

            'employee_id' =>
                $contract->employee_id,

            'contract_number' =>
                $contract->contract_number,

            'contract_type' =>
                $contract->contract_type,

            'start_date' =>
                $this->dateValue(
                    $contract->start_date
                ),

            'end_date' =>
                $this->dateValue(
                    $contract->end_date
                ),

            'probation_end_date' =>
                $this->dateValue(
                    $contract->probation_end_date
                ),

            'work_schedule_type' =>
                $contract->work_schedule_type,

            'working_hours_per_week' =>
                $contract->working_hours_per_week,

            'status' =>
                $contract->status,

            'signed_at' =>
                $this->dateTimeValue(
                    $contract->signed_at
                ),

            'notes' =>
                $contract->notes,
        ];
    }


    private function serializeCompensation(
        CompensationHistory $item
    ): array {
        return [
            'id' =>
                $item->id,

            'uuid' =>
                $item->uuid,

            'employee_id' =>
                $item->employee_id,

            'contract_id' =>
                $item->contract_id,

            'effective_from' =>
                $this->dateValue(
                    $item->effective_from
                ),

            'effective_to' =>
                $this->dateValue(
                    $item->effective_to
                ),

            'currency' =>
                $item->currency,

            'pay_frequency' =>
                $item->pay_frequency,

            'basic_salary' =>
                $item->basic_salary,

            'fixed_gross_compensation' =>
                $item->fixed_gross_compensation,

            'status' =>
                $item->status,

            'reason' =>
                $item->reason,

            'created_by' =>
                $item->created_by,

            'approved_by' =>
                $item->approved_by,

            'approved_at' =>
                $this->dateTimeValue(
                    $item->approved_at
                ),

            'finance_posting_created' =>
                false,
        ];
    }


    private function serializeCredential(
        ProfessionalCredential $credential
    ): array {
        return [
            'id' =>
                $credential->id,

            'uuid' =>
                $credential->uuid,

            'employee_id' =>
                $credential->employee_id,

            'credential_type' =>
                $credential->credential_type,

            'credential_name' =>
                $credential->credential_name,

            'issuing_authority' =>
                $credential->issuing_authority,

            'reference_present' =>
                ! empty(
                    $credential->encrypted_reference
                ),

            'issued_at' =>
                $this->dateValue(
                    $credential->issued_at
                ),

            'expires_at' =>
                $this->dateValue(
                    $credential->expires_at
                ),

            'status' =>
                $credential->status,

            'verified' =>
                (bool) $credential->verified,

            'verified_at' =>
                $this->dateTimeValue(
                    $credential->verified_at
                ),
        ];
    }


    private function serializeDocument(
        EmployeeDocument $document
    ): array {
        return [
            'id' =>
                $document->id,

            'uuid' =>
                $document->uuid,

            'employee_id' =>
                $document->employee_id,

            'document_type' =>
                $document->document_type,

            'title' =>
                $document->title,

            'original_filename' =>
                $document->original_filename,

            'mime_type' =>
                $document->mime_type,

            'size_bytes' =>
                $document->size_bytes,

            'classification' =>
                $document->classification,

            'issued_at' =>
                $this->dateValue(
                    $document->issued_at
                ),

            'expires_at' =>
                $this->dateValue(
                    $document->expires_at
                ),

            'status' =>
                $document->status,
        ];
    }

    /*
     * AQUILA_HRM_B2A_OPERATIONAL_FOUNDATION_R1_R4
     *
     * Operational HRM foundation.
     * No payroll calculation.
     * No statutory calculation.
     * No Finance posting.
     */


    public function b2StoreDepartment(
        Request $request,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        [
            'tenant' => $tenant,
            'scope' => $scope,
        ] = $this->tenantContext->resolve(
            $request,
            $scopeResolver
        );

        $validated = $request->validate([
            'branch_id' => [
                'required',
                'integer',
            ],
            'name' => [
                'required',
                'string',
                'max:150',
            ],
            'code' => [
                'required',
                'string',
                'max:100',
            ],
            'department_type' => [
                'required',
                'string',
                'max:50',
            ],
            'operating_status' => [
                'nullable',
                'string',
                'max:30',
            ],
        ]);

        $branch = Branch::query()
            ->where(
                'tenant_id',
                $tenant->id
            )
            ->when(
                $scope->isBranch(),
                fn (Builder $query) =>
                    $query->where(
                        'id',
                        $scope->branchId
                    )
            )
            ->where(
                'id',
                $validated['branch_id']
            )
            ->firstOrFail();

        $duplicate = BranchDepartment::query()
            ->where(
                'tenant_id',
                $tenant->id
            )
            ->where(
                'branch_id',
                $branch->id
            )
            ->where(
                'code',
                $validated['code']
            )
            ->exists();

        abort_if(
            $duplicate,
            422,
            'A department with this code already exists in the selected branch.'
        );

        $department =
            new BranchDepartment();

        $department->uuid =
            (string) \Illuminate\Support\Str::uuid();

        $department->tenant_id =
            $tenant->id;

        $department->branch_id =
            $branch->id;

        $department->name =
            $validated['name'];

        $department->code =
            $validated['code'];

        $department->department_type =
            $validated['department_type'];

        $department->operating_status =
            $validated['operating_status']
            ?? 'active';

        $department->is_revenue_center =
            false;

        $department->save();

        return response()->json([
            'message' =>
                'Department created.',

            'department' =>
                $department->only([
                    'id',
                    'uuid',
                    'branch_id',
                    'name',
                    'code',
                    'department_type',
                    'operating_status',
                ]),
        ], 201);
    }


    public function b2UpdateDepartment(
        Request $request,
        ScopeResolver $scopeResolver,
        int $departmentId
    ): JsonResponse {
        [
            'tenant' => $tenant,
            'scope' => $scope,
        ] = $this->tenantContext->resolve(
            $request,
            $scopeResolver
        );

        $department =
            BranchDepartment::query()
                ->where(
                    'tenant_id',
                    $tenant->id
                )
                ->when(
                    $scope->isBranch(),
                    fn (Builder $query) =>
                        $query->where(
                            'branch_id',
                            $scope->branchId
                        )
                )
                ->where(
                    'id',
                    $departmentId
                )
                ->firstOrFail();

        $validated = $request->validate([
            'name' => [
                'sometimes',
                'required',
                'string',
                'max:150',
            ],
            'code' => [
                'sometimes',
                'required',
                'string',
                'max:100',
            ],
            'department_type' => [
                'sometimes',
                'required',
                'string',
                'max:50',
            ],
            'operating_status' => [
                'sometimes',
                'required',
                'string',
                'max:30',
            ],
        ]);

        if (
            array_key_exists(
                'code',
                $validated
            )
        ) {
            $duplicate =
                BranchDepartment::query()
                    ->where(
                        'tenant_id',
                        $tenant->id
                    )
                    ->where(
                        'branch_id',
                        $department->branch_id
                    )
                    ->where(
                        'code',
                        $validated['code']
                    )
                    ->where(
                        'id',
                        '!=',
                        $department->id
                    )
                    ->exists();

            abort_if(
                $duplicate,
                422,
                'Another department already uses this code in this branch.'
            );
        }

        foreach (
            [
                'name',
                'code',
                'department_type',
                'operating_status',
            ]
            as
            $field
        ) {
            if (
                array_key_exists(
                    $field,
                    $validated
                )
            ) {
                $department->{$field} =
                    $validated[$field];
            }
        }

        $department->save();

        return response()->json([
            'message' =>
                'Department updated.',

            'department' =>
                $department->only([
                    'id',
                    'uuid',
                    'branch_id',
                    'name',
                    'code',
                    'department_type',
                    'operating_status',
                ]),
        ]);
    }


    public function b2UpdateJobGrade(
        Request $request,
        ScopeResolver $scopeResolver,
        int $jobGradeId
    ): JsonResponse {
        [
            'tenant' => $tenant,
        ] = $this->tenantContext->resolve(
            $request,
            $scopeResolver
        );

        $grade =
            JobGrade::query()
                ->where(
                    'tenant_id',
                    $tenant->id
                )
                ->where(
                    'id',
                    $jobGradeId
                )
                ->firstOrFail();

        $validated = $request->validate([
            'code' => [
                'sometimes',
                'required',
                'string',
                'max:100',
            ],
            'name' => [
                'sometimes',
                'required',
                'string',
                'max:150',
            ],
            'description' => [
                'nullable',
                'string',
            ],
            'grade_level' => [
                'nullable',
                'integer',
                'min:0',
            ],
            'minimum_salary' => [
                'nullable',
                'numeric',
                'min:0',
            ],
            'maximum_salary' => [
                'nullable',
                'numeric',
                'min:0',
            ],
            'currency' => [
                'sometimes',
                'required',
                'string',
                'max:10',
            ],
            'status' => [
                'sometimes',
                'required',
                'string',
                'max:30',
            ],
            'effective_from' => [
                'nullable',
                'date',
            ],
            'effective_to' => [
                'nullable',
                'date',
            ],
        ]);

        $minimum =
            array_key_exists(
                'minimum_salary',
                $validated
            )
                ? $validated['minimum_salary']
                : $grade->minimum_salary;

        $maximum =
            array_key_exists(
                'maximum_salary',
                $validated
            )
                ? $validated['maximum_salary']
                : $grade->maximum_salary;

        if (
            $minimum !== null
            &&
            $maximum !== null
        ) {
            abort_if(
                (float) $minimum
                >
                (float) $maximum,
                422,
                'Minimum salary cannot exceed maximum salary.'
            );
        }

        if (
            array_key_exists(
                'code',
                $validated
            )
        ) {
            $duplicate =
                JobGrade::query()
                    ->where(
                        'tenant_id',
                        $tenant->id
                    )
                    ->where(
                        'code',
                        $validated['code']
                    )
                    ->where(
                        'id',
                        '!=',
                        $grade->id
                    )
                    ->exists();

            abort_if(
                $duplicate,
                422,
                'Another job grade already uses this code.'
            );
        }

        foreach (
            [
                'code',
                'name',
                'description',
                'grade_level',
                'minimum_salary',
                'maximum_salary',
                'currency',
                'status',
                'effective_from',
                'effective_to',
            ]
            as
            $field
        ) {
            if (
                array_key_exists(
                    $field,
                    $validated
                )
            ) {
                $grade->{$field} =
                    $validated[$field];
            }
        }

        $grade->updated_by =
            $request->user()->id;

        $grade->save();

        return response()->json([
            'message' =>
                'Job grade updated.',

            'job_grade' =>
                $grade,
        ]);
    }


    public function b2UpdatePosition(
        Request $request,
        ScopeResolver $scopeResolver,
        int $positionId
    ): JsonResponse {
        [
            'tenant' => $tenant,
            'scope' => $scope,
        ] = $this->tenantContext->resolve(
            $request,
            $scopeResolver
        );

        $position =
            Position::query()
                ->where(
                    'tenant_id',
                    $tenant->id
                )
                ->when(
                    $scope->isBranch(),
                    fn (Builder $query) =>
                        $query->where(
                            'branch_id',
                            $scope->branchId
                        )
                )
                ->where(
                    'id',
                    $positionId
                )
                ->firstOrFail();

        $validated = $request->validate([
            'code' => [
                'sometimes',
                'required',
                'string',
                'max:100',
            ],
            'title' => [
                'sometimes',
                'required',
                'string',
                'max:150',
            ],
            'description' => [
                'nullable',
                'string',
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
            'reports_to_position_id' => [
                'nullable',
                'integer',
            ],
            'headcount_budget' => [
                'nullable',
                'integer',
                'min:0',
            ],
            'requires_professional_license' => [
                'nullable',
                'boolean',
            ],
            'status' => [
                'sometimes',
                'required',
                'string',
                'max:30',
            ],
        ]);

        if (
            array_key_exists(
                'code',
                $validated
            )
        ) {
            $duplicate =
                Position::query()
                    ->where(
                        'tenant_id',
                        $tenant->id
                    )
                    ->where(
                        'code',
                        $validated['code']
                    )
                    ->where(
                        'id',
                        '!=',
                        $position->id
                    )
                    ->exists();

            abort_if(
                $duplicate,
                422,
                'Another position already uses this code.'
            );
        }

        if (
            ! empty(
                $validated['branch_id']
                ?? null
            )
        ) {
            Branch::query()
                ->where(
                    'tenant_id',
                    $tenant->id
                )
                ->when(
                    $scope->isBranch(),
                    fn (Builder $query) =>
                        $query->where(
                            'id',
                            $scope->branchId
                        )
                )
                ->where(
                    'id',
                    $validated['branch_id']
                )
                ->firstOrFail();
        }

        if (
            ! empty(
                $validated['department_id']
                ?? null
            )
        ) {
            BranchDepartment::query()
                ->where(
                    'tenant_id',
                    $tenant->id
                )
                ->where(
                    'id',
                    $validated['department_id']
                )
                ->firstOrFail();
        }

        if (
            ! empty(
                $validated['job_grade_id']
                ?? null
            )
        ) {
            JobGrade::query()
                ->where(
                    'tenant_id',
                    $tenant->id
                )
                ->where(
                    'id',
                    $validated['job_grade_id']
                )
                ->firstOrFail();
        }

        if (
            ! empty(
                $validated['reports_to_position_id']
                ?? null
            )
        ) {
            abort_if(
                (int) $validated['reports_to_position_id']
                ===
                (int) $position->id,
                422,
                'A position cannot report to itself.'
            );

            Position::query()
                ->where(
                    'tenant_id',
                    $tenant->id
                )
                ->where(
                    'id',
                    $validated['reports_to_position_id']
                )
                ->firstOrFail();
        }

        foreach (
            [
                'code',
                'title',
                'description',
                'branch_id',
                'department_id',
                'job_grade_id',
                'reports_to_position_id',
                'headcount_budget',
                'requires_professional_license',
                'status',
            ]
            as
            $field
        ) {
            if (
                array_key_exists(
                    $field,
                    $validated
                )
            ) {
                $position->{$field} =
                    $validated[$field];
            }
        }

        $position->updated_by =
            $request->user()->id;

        $position->save();

        return response()->json([
            'message' =>
                'Position updated.',

            'position' =>
                $position,
        ]);
    }


    public function b2EmployeeEdit(
        Request $request,
        ScopeResolver $scopeResolver,
        int $employeeId
    ): JsonResponse {
        [
            'tenant' => $tenant,
            'scope' => $scope,
        ] = $this->tenantContext->resolve(
            $request,
            $scopeResolver
        );

        $employee =
            $this->employeeQuery(
                $tenant->id,
                $scope
            )
                ->where(
                    'id',
                    $employeeId
                )
                ->firstOrFail();

        return response()->json([
            'employee' =>
                $employee->only([
                    'id',
                    'uuid',
                    'employee_number',
                    'home_branch_id',
                    'current_department_id',
                    'current_position_id',
                    'job_grade_id',
                    'manager_employee_id',
                    'first_name',
                    'middle_name',
                    'last_name',
                    'preferred_name',
                    'work_email',
                    'employment_status',
                    'employment_type',
                    'hire_date',
                    'termination_date',
                    'probation_end_date',
                ]),
        ]);
    }


    public function b2UpdateEmployee(
        Request $request,
        ScopeResolver $scopeResolver,
        int $employeeId
    ): JsonResponse {
        [
            'tenant' => $tenant,
            'scope' => $scope,
        ] = $this->tenantContext->resolve(
            $request,
            $scopeResolver
        );

        $employee =
            $this->employeeQuery(
                $tenant->id,
                $scope
            )
                ->where(
                    'id',
                    $employeeId
                )
                ->firstOrFail();

        $validated = $request->validate([
            'first_name' => [
                'sometimes',
                'required',
                'string',
                'max:100',
            ],
            'middle_name' => [
                'nullable',
                'string',
                'max:100',
            ],
            'last_name' => [
                'sometimes',
                'required',
                'string',
                'max:100',
            ],
            'preferred_name' => [
                'nullable',
                'string',
                'max:100',
            ],
            'work_email' => [
                'nullable',
                'email',
                'max:191',
            ],
            'employment_status' => [
                'sometimes',
                'required',
                'string',
                'max:30',
            ],
            'employment_type' => [
                'sometimes',
                'required',
                'string',
                'max:50',
            ],
            'hire_date' => [
                'nullable',
                'date',
            ],
            'termination_date' => [
                'nullable',
                'date',
            ],
            'probation_end_date' => [
                'nullable',
                'date',
            ],
            'home_branch_id' => [
                'nullable',
                'integer',
            ],
            'current_department_id' => [
                'nullable',
                'integer',
            ],
            'current_position_id' => [
                'nullable',
                'integer',
            ],
            'job_grade_id' => [
                'nullable',
                'integer',
            ],
            'manager_employee_id' => [
                'nullable',
                'integer',
            ],
        ]);

        if (
            ! empty(
                $validated['home_branch_id']
                ?? null
            )
        ) {
            Branch::query()
                ->where(
                    'tenant_id',
                    $tenant->id
                )
                ->when(
                    $scope->isBranch(),
                    fn (Builder $query) =>
                        $query->where(
                            'id',
                            $scope->branchId
                        )
                )
                ->where(
                    'id',
                    $validated['home_branch_id']
                )
                ->firstOrFail();
        }

        if (
            ! empty(
                $validated['current_department_id']
                ?? null
            )
        ) {
            BranchDepartment::query()
                ->where(
                    'tenant_id',
                    $tenant->id
                )
                ->where(
                    'id',
                    $validated['current_department_id']
                )
                ->firstOrFail();
        }

        if (
            ! empty(
                $validated['current_position_id']
                ?? null
            )
        ) {
            Position::query()
                ->where(
                    'tenant_id',
                    $tenant->id
                )
                ->where(
                    'id',
                    $validated['current_position_id']
                )
                ->firstOrFail();
        }

        if (
            ! empty(
                $validated['job_grade_id']
                ?? null
            )
        ) {
            JobGrade::query()
                ->where(
                    'tenant_id',
                    $tenant->id
                )
                ->where(
                    'id',
                    $validated['job_grade_id']
                )
                ->firstOrFail();
        }

        if (
            ! empty(
                $validated['manager_employee_id']
                ?? null
            )
        ) {
            abort_if(
                (int) $validated['manager_employee_id']
                ===
                (int) $employee->id,
                422,
                'An employee cannot be their own manager.'
            );

            $this->employeeQuery(
                $tenant->id,
                $scope
            )
                ->where(
                    'id',
                    $validated['manager_employee_id']
                )
                ->firstOrFail();
        }

        foreach (
            [
                'first_name',
                'middle_name',
                'last_name',
                'preferred_name',
                'work_email',
                'employment_status',
                'employment_type',
                'hire_date',
                'termination_date',
                'probation_end_date',
                'home_branch_id',
                'current_department_id',
                'current_position_id',
                'job_grade_id',
                'manager_employee_id',
            ]
            as
            $field
        ) {
            if (
                array_key_exists(
                    $field,
                    $validated
                )
            ) {
                $employee->{$field} =
                    $validated[$field];
            }
        }

        $employee->updated_by =
            $request->user()->id;

        $employee->save();

        return response()->json([
            'message' =>
                'Employee information updated.',

            'employee' =>
                $employee,
        ]);
    }


    public function b2ArchiveEmployee(
        Request $request,
        ScopeResolver $scopeResolver,
        int $employeeId
    ): JsonResponse {
        [
            'tenant' => $tenant,
            'scope' => $scope,
        ] = $this->tenantContext->resolve(
            $request,
            $scopeResolver
        );

        $employee =
            $this->employeeQuery(
                $tenant->id,
                $scope
            )
                ->where(
                    'id',
                    $employeeId
                )
                ->firstOrFail();

        $metadata =
            is_array(
                $employee->metadata
            )
                ? $employee->metadata
                : [];

        $metadata['hrm_archive'] = [
            'archived_at' =>
                now()->toIso8601String(),

            'archived_by' =>
                $request->user()->id,

            'previous_status' =>
                $employee->employment_status,
        ];

        $employee->metadata =
            $metadata;

        $employee->employment_status =
            'inactive';

        if (
            ! $employee->termination_date
        ) {
            $employee->termination_date =
                now()->toDateString();
        }

        $employee->updated_by =
            $request->user()->id;

        $employee->save();

        return response()->json([
            'message' =>
                'Employee safely archived. Historical HR records were preserved.',

            'archive_mode' =>
                'safe_archive',

            'employee_id' =>
                $employee->id,
        ]);
    }


    public function b2CompensationReview(
        Request $request,
        ScopeResolver $scopeResolver,
        int $compensationId
    ): JsonResponse {
        [
            'tenant' => $tenant,
            'scope' => $scope,
        ] = $this->tenantContext->resolve(
            $request,
            $scopeResolver
        );

        $employeeIds =
            $this->employeeQuery(
                $tenant->id,
                $scope
            )->select('id');

        $compensation =
            CompensationHistory::query()
                ->with([
                    'employee',
                    'contract',
                ])
                ->where(
                    'tenant_id',
                    $tenant->id
                )
                ->whereIn(
                    'employee_id',
                    $employeeIds
                )
                ->where(
                    'id',
                    $compensationId
                )
                ->firstOrFail();

        $previous =
            CompensationHistory::query()
                ->where(
                    'tenant_id',
                    $tenant->id
                )
                ->where(
                    'employee_id',
                    $compensation->employee_id
                )
                ->where(
                    'status',
                    'approved'
                )
                ->where(
                    'id',
                    '!=',
                    $compensation->id
                )
                ->orderByDesc(
                    'effective_from'
                )
                ->orderByDesc(
                    'id'
                )
                ->first();

        $employee =
            $compensation->employee;

        $contract =
            $compensation->contract;

        $employeeName =
            $employee
                ? trim(
                    implode(
                        ' ',
                        array_filter([
                            $employee->first_name,
                            $employee->middle_name,
                            $employee->last_name,
                        ])
                    )
                )
                : null;

        $basicVariance =
            $previous
                ? (
                    (float) $compensation->basic_salary
                    -
                    (float) $previous->basic_salary
                )
                : null;

        $grossVariance =
            $previous
                ? (
                    (float) (
                        $compensation->fixed_gross_compensation
                        ?? 0
                    )
                    -
                    (float) (
                        $previous->fixed_gross_compensation
                        ?? 0
                    )
                )
                : null;

        return response()->json([
            'review' => [
                'id' =>
                    $compensation->id,

                'uuid' =>
                    $compensation->uuid,

                'employee_id' =>
                    $compensation->employee_id,

                'employee_number' =>
                    $employee?->employee_number,

                'employee_name' =>
                    $employeeName,

                'employment_status' =>
                    $employee?->employment_status,

                'employment_type' =>
                    $employee?->employment_type,

                'contract_id' =>
                    $compensation->contract_id,

                'contract_number' =>
                    $contract?->contract_number,

                'contract_type' =>
                    $contract?->contract_type,

                'effective_from' =>
                    optional(
                        $compensation->effective_from
                    )->toDateString(),

                'effective_to' =>
                    optional(
                        $compensation->effective_to
                    )->toDateString(),

                'currency' =>
                    $compensation->currency,

                'pay_frequency' =>
                    $compensation->pay_frequency,

                'basic_salary' =>
                    $compensation->basic_salary,

                'fixed_gross_compensation' =>
                    $compensation->fixed_gross_compensation,

                'previous_basic_salary' =>
                    $previous?->basic_salary,

                'previous_fixed_gross_compensation' =>
                    $previous?->fixed_gross_compensation,

                'basic_salary_variance' =>
                    $basicVariance,

                'fixed_gross_variance' =>
                    $grossVariance,

                'status' =>
                    $compensation->status,

                'reason' =>
                    $compensation->reason,

                'created_by' =>
                    $compensation->created_by,

                'created_at' =>
                    optional(
                        $compensation->created_at
                    )->toIso8601String(),

                'updated_by' =>
                    $compensation->updated_by,

                'updated_at' =>
                    optional(
                        $compensation->updated_at
                    )->toIso8601String(),

                'metadata' =>
                    $compensation->metadata,

                'can_approve' =>
                    $compensation->status === 'draft'
                    &&
                    (int) $compensation->created_by
                    !==
                    (int) $request->user()->id,

                'maker_checker_required' =>
                    true,

                'finance_posting_created' =>
                    false,
            ],
        ]);
    }


}
