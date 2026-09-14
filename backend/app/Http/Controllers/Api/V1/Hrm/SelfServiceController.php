<?php

namespace App\Http\Controllers\Api\V1\Hrm;

use App\Http\Controllers\Controller;
use App\Models\Hrm\Employee;
use App\Services\Access\ScopeResolver;
use App\Services\Audit\AuditLogService;
use App\Services\Hrm\HrmTenantContextService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Throwable;

class SelfServiceController extends Controller
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
            'tenant' =>
                $tenant,

            'scope' =>
                $scope,

            'employee' =>
                $employee,
        ] =
            $this->context(
                $request,
                $scopeResolver
            );

        $employeeId =
            (int) $employee->id;

        $contracts =
            DB::table(
                'hrm_employee_contracts'
            )
                ->where(
                    'tenant_id',
                    $tenant->id
                )
                ->where(
                    'employee_id',
                    $employeeId
                )
                ->orderByDesc(
                    'start_date'
                )
                ->get([
                    'id',
                    'contract_number',
                    'contract_type',
                    'start_date',
                    'end_date',
                    'work_schedule_type',
                    'working_hours_per_week',
                    'status',
                ]);

        $attendance =
            DB::table(
                'hrm_attendance_records'
            )
                ->where(
                    'tenant_id',
                    $tenant->id
                )
                ->where(
                    'employee_id',
                    $employeeId
                )
                ->whereDate(
                    'work_date',
                    '>=',
                    now()
                        ->subDays(30)
                        ->toDateString()
                )
                ->orderByDesc(
                    'work_date'
                )
                ->get([
                    'id',
                    'work_date',
                    'clock_in_at',
                    'clock_out_at',
                    'worked_minutes',
                    'overtime_minutes',
                    'status',
                ]);

        $leaveBalances =
            DB::table(
                'hrm_leave_balances as b'
            )
                ->leftJoin(
                    'hrm_leave_types as t',
                    't.id',
                    '=',
                    'b.leave_type_id'
                )
                ->where(
                    'b.tenant_id',
                    $tenant->id
                )
                ->where(
                    'b.employee_id',
                    $employeeId
                )
                ->where(
                    'b.status',
                    'active'
                )
                ->orderByDesc(
                    'b.period_start'
                )
                ->get([
                    'b.id',
                    'b.period_start',
                    'b.period_end',
                    'b.opening_balance',
                    'b.accrued',
                    'b.taken',
                    'b.reserved',
                    'b.adjustment',
                    'b.closing_balance',
                    't.name as leave_type_name',
                ]);

        $leaveRequests =
            DB::table(
                'hrm_leave_requests as r'
            )
                ->leftJoin(
                    'hrm_leave_types as t',
                    't.id',
                    '=',
                    'r.leave_type_id'
                )
                ->where(
                    'r.tenant_id',
                    $tenant->id
                )
                ->where(
                    'r.employee_id',
                    $employeeId
                )
                ->orderByDesc(
                    'r.id'
                )
                ->limit(50)
                ->get([
                    'r.id',
                    'r.start_date',
                    'r.end_date',
                    'r.requested_days',
                    'r.status',
                    'r.submitted_at',
                    'r.approved_at',
                    'r.rejected_at',
                    'r.rejection_reason',
                    't.name as leave_type_name',
                ]);

        /*
         * Secure metadata only.
         * Never return disk/storage_path/checksum.
         */
        $documents =
            DB::table(
                'hrm_employee_documents'
            )
                ->where(
                    'tenant_id',
                    $tenant->id
                )
                ->where(
                    'employee_id',
                    $employeeId
                )
                ->orderByDesc(
                    'created_at'
                )
                ->get([
                    'id',
                    'document_type',
                    'title',
                    'original_filename',
                    'mime_type',
                    'classification',
                    'issued_at',
                    'expires_at',
                    'status',
                ]);

        /*
         * Self Service sees only finalized payroll.
         * PREPARED and UNDER_REVIEW remain excluded.
         */
        $payroll =
            DB::table(
                'payroll_run_employees as e'
            )
                ->join(
                    'payroll_runs as r',
                    'r.id',
                    '=',
                    'e.payroll_run_id'
                )
                ->join(
                    'payroll_periods as p',
                    'p.id',
                    '=',
                    'r.payroll_period_id'
                )
                ->where(
                    'e.tenant_id',
                    $tenant->id
                )
                ->where(
                    'e.employee_id',
                    $employeeId
                )
                ->whereIn(
                    'r.status',
                    [
                        'APPROVED',
                        'DECLARED',
                        'PAID',
                        'CLOSED',
                    ]
                )
                ->orderByDesc(
                    'p.period_year'
                )
                ->orderByDesc(
                    'p.period_month'
                )
                ->limit(24)
                ->get([
                    'e.id',
                    'r.run_number',
                    'r.status as payroll_status',
                    'p.period_year',
                    'p.period_month',
                    'e.basic_salary',
                    'e.gross_employment_income',
                    'e.paye',
                    'e.total_employee_deductions',
                    'e.net_salary',
                ]);

        $profileRequests =
            DB::table(
                'hrm_profile_change_requests'
            )
                ->where(
                    'tenant_id',
                    $tenant->id
                )
                ->where(
                    'employee_id',
                    $employeeId
                )
                ->orderByDesc(
                    'id'
                )
                ->limit(30)
                ->get([
                    'id',
                    'field_code',
                    'reason',
                    'status',
                    'submitted_at',
                    'decided_at',
                    'decision_notes',
                ]);

        $teamCount =
            $this->teamEmployeeIds(
                (int) $tenant->id,
                $employeeId
            )->count();

        return response()->json([
            'employee' => [
                'id' =>
                    $employee->id,

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

                'work_email' =>
                    $employee->work_email,

                'employment_status' =>
                    $employee->employment_status,

                'employment_type' =>
                    $employee->employment_type,

                'hire_date' =>
                    $employee->hire_date,

                'home_branch_id' =>
                    $employee->home_branch_id,

                'current_department_id' =>
                    $employee->current_department_id,

                'current_position_id' =>
                    $employee->current_position_id,

                'manager_employee_id' =>
                    $this->managerEmployeeId(
                        (int) $tenant->id,
                        $employee
                    ),
            ],

            'contracts' =>
                $contracts,

            'attendance' =>
                $attendance,

            'leave_balances' =>
                $leaveBalances,

            'leave_requests' =>
                $leaveRequests,

            'payroll_history' =>
                $payroll,

            'documents' =>
                $documents,

            'profile_change_requests' =>
                $profileRequests,

            'manager' => [
                'team_count' =>
                    $teamCount,

                'has_team' =>
                    $teamCount > 0,
            ],

            'controls' => [
                'employee_mapping_required' =>
                    true,

                'leave_write_authority' =>
                    'HRM-B2 Leave',

                'attendance_write_authority' =>
                    'HRM-B2 Workforce',

                'automatic_payroll_recalculation' =>
                    false,

                'finance_posting_created' =>
                    false,
            ],
        ]);
    }

    public function requestProfileChange(
        Request $request,
        ScopeResolver $scopeResolver,
        AuditLogService $auditLogService
    ): JsonResponse {
        [
            'tenant' =>
                $tenant,

            'scope' =>
                $scope,

            'employee' =>
                $employee,
        ] =
            $this->context(
                $request,
                $scopeResolver
            );

        $validated =
            $request->validate([
                'field_code' => [
                    'required',
                    'in:preferred_name,work_email',
                ],

                'requested_value' => [
                    'required',
                    'string',
                    'max:191',
                ],

                'reason' => [
                    'nullable',
                    'string',
                    'max:2000',
                ],
            ]);

        $field =
            $validated[
                'field_code'
            ];

        $value =
            trim(
                $validated[
                    'requested_value'
                ]
            );

        if (
            $field ===
                'work_email'
            &&
            filter_var(
                $value,
                FILTER_VALIDATE_EMAIL
            ) === false
        ) {
            throw ValidationException::withMessages([
                'requested_value' => [
                    'Enter a valid work email address.',
                ],
            ]);
        }

        if (
            $field ===
                'work_email'
            &&
            DB::table(
                'hrm_employees'
            )
                ->where(
                    'tenant_id',
                    $tenant->id
                )
                ->where(
                    'id',
                    '!=',
                    $employee->id
                )
                ->where(
                    'work_email',
                    $value
                )
                ->exists()
        ) {
            throw ValidationException::withMessages([
                'requested_value' => [
                    'That work email is already assigned to another employee.',
                ],
            ]);
        }

        $pending =
            DB::table(
                'hrm_profile_change_requests'
            )
                ->where(
                    'tenant_id',
                    $tenant->id
                )
                ->where(
                    'employee_id',
                    $employee->id
                )
                ->where(
                    'field_code',
                    $field
                )
                ->where(
                    'status',
                    'pending'
                )
                ->exists();

        if ($pending) {
            throw ValidationException::withMessages([
                'field_code' => [
                    'A pending request already exists for this field.',
                ],
            ]);
        }

        $managerEmployeeId =
            $this->managerEmployeeId(
                (int) $tenant->id,
                $employee
            );

        $id =
            DB::table(
                'hrm_profile_change_requests'
            )
                ->insertGetId([
                    'uuid' =>
                        (string) Str::uuid(),

                    'tenant_id' =>
                        $tenant->id,

                    'employee_id' =>
                        $employee->id,

                    'manager_employee_id' =>
                        $managerEmployeeId,

                    'field_code' =>
                        $field,

                    'current_payload' =>
                        Crypt::encryptString(
                            json_encode([
                                'value' =>
                                    $employee->{$field},
                            ])
                        ),

                    'requested_payload' =>
                        Crypt::encryptString(
                            json_encode([
                                'value' =>
                                    $value,
                            ])
                        ),

                    'reason' =>
                        $validated[
                            'reason'
                        ] ?? null,

                    'status' =>
                        'pending',

                    'submitted_by' =>
                        $request
                            ->user()
                            ->id,

                    'submitted_at' =>
                        now(),

                    'created_at' =>
                        now(),

                    'updated_at' =>
                        now(),
                ]);

        $auditLogService->record(
            action:
                'hrm.self_service.profile_change.requested',

            scope:
                $scope,

            metadata: [
                'employee_id' =>
                    $employee->id,

                'field_code' =>
                    $field,

                'manager_employee_id' =>
                    $managerEmployeeId,
            ],

            dataClassification:
                'restricted',

            auditableType:
                'hrm_profile_change_request',

            auditableId:
                $id
        );

        return response()->json([
            'message' =>
                'Profile change request submitted for review.',

            'request_id' =>
                $id,
        ], 201);
    }

    public function managerQueue(
        Request $request,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        [
            'tenant' =>
                $tenant,

            'employee' =>
                $manager,
        ] =
            $this->context(
                $request,
                $scopeResolver
            );

        $teamIds =
            $this->teamEmployeeIds(
                (int) $tenant->id,
                (int) $manager->id
            );

        $team =
            Employee::query()
                ->where(
                    'tenant_id',
                    $tenant->id
                )
                ->whereIn(
                    'id',
                    $teamIds
                )
                ->orderBy(
                    'employee_number'
                )
                ->get([
                    'id',
                    'employee_number',
                    'first_name',
                    'last_name',
                    'preferred_name',
                    'employment_status',
                ]);

        $profileChanges =
            DB::table(
                'hrm_profile_change_requests as r'
            )
                ->leftJoin(
                    'hrm_employees as e',
                    'e.id',
                    '=',
                    'r.employee_id'
                )
                ->where(
                    'r.tenant_id',
                    $tenant->id
                )
                ->whereIn(
                    'r.employee_id',
                    $teamIds
                )
                ->where(
                    'r.status',
                    'pending'
                )
                ->orderBy(
                    'r.submitted_at'
                )
                ->get([
                    'r.id',
                    'r.employee_id',
                    'r.field_code',
                    'r.reason',
                    'r.submitted_at',
                    'r.requested_payload',
                    'e.employee_number',
                    'e.first_name',
                    'e.last_name',
                ])
                ->map(
                    function ($row) {
                        $payload =
                            $this->decryptPayload(
                                $row->requested_payload
                            );

                        unset(
                            $row->requested_payload
                        );

                        $row->requested_value =
                            $payload[
                                'value'
                            ] ?? null;

                        return $row;
                    }
                );

        /*
         * Read-only manager visibility.
         *
         * Actual approvals remain in B2 Attendance and Leave,
         * preserving their existing maker/checker workflows.
         */
        $leaveQueue =
            DB::table(
                'hrm_leave_requests as r'
            )
                ->leftJoin(
                    'hrm_leave_types as t',
                    't.id',
                    '=',
                    'r.leave_type_id'
                )
                ->leftJoin(
                    'hrm_employees as e',
                    'e.id',
                    '=',
                    'r.employee_id'
                )
                ->where(
                    'r.tenant_id',
                    $tenant->id
                )
                ->whereIn(
                    'r.employee_id',
                    $teamIds
                )
                ->where(
                    'r.status',
                    'submitted'
                )
                ->orderBy(
                    'r.submitted_at'
                )
                ->get([
                    'r.id',
                    'r.employee_id',
                    'r.start_date',
                    'r.end_date',
                    'r.requested_days',
                    'r.submitted_at',
                    't.name as leave_type_name',
                    'e.employee_number',
                    'e.first_name',
                    'e.last_name',
                ]);

        $attendanceQueue =
            DB::table(
                'hrm_attendance_records as a'
            )
                ->leftJoin(
                    'hrm_employees as e',
                    'e.id',
                    '=',
                    'a.employee_id'
                )
                ->where(
                    'a.tenant_id',
                    $tenant->id
                )
                ->whereIn(
                    'a.employee_id',
                    $teamIds
                )
                ->where(
                    'a.status',
                    'submitted'
                )
                ->orderByDesc(
                    'a.work_date'
                )
                ->get([
                    'a.id',
                    'a.employee_id',
                    'a.work_date',
                    'a.worked_minutes',
                    'a.overtime_minutes',
                    'a.submitted_at',
                    'e.employee_number',
                    'e.first_name',
                    'e.last_name',
                ]);

        return response()->json([
            'manager' => [
                'employee_id' =>
                    $manager->id,

                'employee_number' =>
                    $manager->employee_number,
            ],

            'team' =>
                $team,

            'profile_change_requests' =>
                $profileChanges,

            'leave_approval_queue' =>
                $leaveQueue,

            'attendance_approval_queue' =>
                $attendanceQueue,

            'controls' => [
                'leave_decision_authority' =>
                    'HRM-B2 Leave',

                'attendance_decision_authority' =>
                    'HRM-B2 Workforce',
            ],
        ]);
    }

    public function approveProfileChange(
        Request $request,
        int $requestId,
        ScopeResolver $scopeResolver,
        AuditLogService $auditLogService
    ): JsonResponse {
        return $this->decide(
            $request,
            $requestId,
            'approved',
            $scopeResolver,
            $auditLogService
        );
    }

    public function rejectProfileChange(
        Request $request,
        int $requestId,
        ScopeResolver $scopeResolver,
        AuditLogService $auditLogService
    ): JsonResponse {
        return $this->decide(
            $request,
            $requestId,
            'rejected',
            $scopeResolver,
            $auditLogService
        );
    }

    private function decide(
        Request $request,
        int $requestId,
        string $decision,
        ScopeResolver $scopeResolver,
        AuditLogService $auditLogService
    ): JsonResponse {
        [
            'tenant' =>
                $tenant,

            'scope' =>
                $scope,

            'employee' =>
                $manager,
        ] =
            $this->context(
                $request,
                $scopeResolver
            );

        $validated =
            $request->validate([
                'notes' => [
                    $decision ===
                        'rejected'
                        ?
                        'required'
                        :
                        'nullable',

                    'string',
                    'max:2000',
                ],
            ]);

        $result =
            DB::transaction(
                function () use (
                    $request,
                    $tenant,
                    $manager,
                    $requestId,
                    $decision,
                    $validated
                ) {
                    $change =
                        DB::table(
                            'hrm_profile_change_requests'
                        )
                            ->where(
                                'tenant_id',
                                $tenant->id
                            )
                            ->where(
                                'id',
                                $requestId
                            )
                            ->lockForUpdate()
                            ->first();

                    if (! $change) {
                        abort(404);
                    }

                    if (
                        $change->status
                        !==
                        'pending'
                    ) {
                        throw ValidationException::withMessages([
                            'status' => [
                                'Only pending requests can be decided.',
                            ],
                        ]);
                    }

                    if (
                        (
(int)
                        $change->submitted_by
                        ===
                        (int)
                        $request->user()->id
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

                    $teamIds =
                        $this->teamEmployeeIds(
                            (int) $tenant->id,
                            (int) $manager->id
                        );

                    if (
                        ! $teamIds->contains(
                            (int)
                            $change->employee_id
                        )
                    ) {
                        abort(404);
                    }

                    $employee =
                        Employee::query()
                            ->where(
                                'tenant_id',
                                $tenant->id
                            )
                            ->where(
                                'id',
                                $change->employee_id
                            )
                            ->firstOrFail();

                    if (
                        ! in_array(
                            $change->field_code,
                            [
                                'preferred_name',
                                'work_email',
                            ],
                            true
                        )
                    ) {
                        throw ValidationException::withMessages([
                            'field_code' => [
                                'This field cannot be changed through Self Service.',
                            ],
                        ]);
                    }

                    $current =
                        $this->decryptPayload(
                            $change->current_payload
                        );

                    $requested =
                        $this->decryptPayload(
                            $change->requested_payload
                        );

                    $originalValue =
                        $current[
                            'value'
                        ] ?? null;

                    $requestedValue =
                        $requested[
                            'value'
                        ] ?? null;

                    if (
                        $decision ===
                            'approved'
                        &&
                        (string) (
                            $employee
                                ->{$change->field_code}
                            ?? ''
                        )
                        !==
                        (string) (
                            $originalValue
                            ?? ''
                        )
                    ) {
                        throw ValidationException::withMessages([
                            'profile' => [
                                'The employee profile changed after submission. Review the current value before approving.',
                            ],
                        ]);
                    }

                    if (
                        $decision ===
                            'approved'
                        &&
                        $change->field_code
                        ===
                            'work_email'
                        &&
                        DB::table(
                            'hrm_employees'
                        )
                            ->where(
                                'tenant_id',
                                $tenant->id
                            )
                            ->where(
                                'id',
                                '!=',
                                $employee->id
                            )
                            ->where(
                                'work_email',
                                $requestedValue
                            )
                            ->exists()
                    ) {
                        throw ValidationException::withMessages([
                            'work_email' => [
                                'That work email is already assigned to another employee.',
                            ],
                        ]);
                    }

                    if (
                        $decision ===
                        'approved'
                    ) {
                        DB::table(
                            'hrm_employees'
                        )
                            ->where(
                                'tenant_id',
                                $tenant->id
                            )
                            ->where(
                                'id',
                                $employee->id
                            )
                            ->update([
                                $change->field_code =>
                                    $requestedValue,

                                'updated_by' =>
                                    $request
                                        ->user()
                                        ->id,

                                'updated_at' =>
                                    now(),
                            ]);
                    }

                    DB::table(
                        'hrm_profile_change_requests'
                    )
                        ->where(
                            'id',
                            $change->id
                        )
                        ->update([
                            'status' =>
                                $decision,

                            'decided_by' =>
                                $request
                                    ->user()
                                    ->id,

                            'decided_at' =>
                                now(),

                            'decision_notes' =>
                                $validated[
                                    'notes'
                                ] ?? null,

                            'updated_at' =>
                                now(),
                        ]);

                    return [
                        'id' =>
                            (int) $change->id,

                        'employee_id' =>
                            (int) $change->employee_id,

                        'field_code' =>
                            $change->field_code,
                    ];
                }
            );

        $auditLogService->record(
            action:
                'hrm.self_service.profile_change.'
                . $decision,

            scope:
                $scope,

            metadata: [
                'employee_id' =>
                    $result[
                        'employee_id'
                    ],

                'field_code' =>
                    $result[
                        'field_code'
                    ],
            ],

            dataClassification:
                'restricted',

            auditableType:
                'hrm_profile_change_request',

            auditableId:
                $result[
                    'id'
                ]
        );

        return response()->json([
            'message' =>
                'Profile change request '
                . $decision
                . '.',
        ]);
    }

    private function context(
        Request $request,
        ScopeResolver $scopeResolver
    ): array {
        [
            'tenant' =>
                $tenant,

            'scope' =>
                $scope,
        ] =
            $this->tenantContext
                ->resolve(
                    $request,
                    $scopeResolver
                );

        $user =
            $request->user();

        $employee =
            Employee::query()
                ->where(
                    'tenant_id',
                    $tenant->id
                )
                ->where(
                    'user_id',
                    $user->id
                )
                ->first();

        if (! $employee) {
            throw ValidationException::withMessages([
                'employee_mapping' => [
                    'SELF_SERVICE_EMPLOYEE_MAPPING_REQUIRED',
                ],
            ]);
        }

        if (
            $scope->isBranch()
            &&
            $scope->branchId
                !==
                null
        ) {
            $branchId =
                (int) $scope->branchId;

            $allowed =
                (int) (
                    $employee
                        ->home_branch_id
                    ?? 0
                )
                ===
                $branchId
                ||
                DB::table(
                    'hrm_employee_assignments'
                )
                    ->where(
                        'tenant_id',
                        $tenant->id
                    )
                    ->where(
                        'employee_id',
                        $employee->id
                    )
                    ->where(
                        'branch_id',
                        $branchId
                    )
                    ->where(
                        'status',
                        'active'
                    )
                    ->exists();

            if (! $allowed) {
                abort(403);
            }
        }

        return [
            'tenant' =>
                $tenant,

            'scope' =>
                $scope,

            'employee' =>
                $employee,
        ];
    }

    private function managerEmployeeId(
        int $tenantId,
        Employee $employee
    ): ?int {
        if (
            $employee
                ->manager_employee_id
            !==
            null
        ) {
            return
                (int)
                $employee
                    ->manager_employee_id;
        }

        $manager =
            DB::table(
                'hrm_employee_assignments'
            )
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->where(
                    'employee_id',
                    $employee->id
                )
                ->where(
                    'status',
                    'active'
                )
                ->whereNotNull(
                    'manager_employee_id'
                )
                ->orderByDesc(
                    'effective_from'
                )
                ->value(
                    'manager_employee_id'
                );

        return $manager
            !==
            null
            ?
            (int) $manager
            :
            null;
    }

    private function teamEmployeeIds(
        int $tenantId,
        int $managerEmployeeId
    ): Collection {
        $direct =
            Employee::query()
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->where(
                    'manager_employee_id',
                    $managerEmployeeId
                )
                ->pluck('id');

        $assignments =
            DB::table(
                'hrm_employee_assignments'
            )
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->where(
                    'manager_employee_id',
                    $managerEmployeeId
                )
                ->where(
                    'status',
                    'active'
                )
                ->pluck(
                    'employee_id'
                );

        return $direct
            ->merge(
                $assignments
            )
            ->map(
                fn ($id) =>
                    (int) $id
            )
            ->unique()
            ->values();
    }

    private function decryptPayload(
        ?string $payload
    ): array {
        if (! $payload) {
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

            return is_array(
                $value
            )
                ?
                $value
                :
                [];
        } catch (Throwable) {
            return [];
        }
    }
}
