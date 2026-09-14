<?php

namespace App\Http\Controllers\Api\V1\Hrm;

use App\Http\Controllers\Controller;
use App\Models\Branch;
use App\Models\Hrm\Employee;
use App\Models\Tenant;
use App\Services\Access\ScopeResolver;
use App\Services\Audit\AuditLogService;
use Carbon\Carbon;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class WorkforceOperationsController extends Controller
{
    public function overview(
        Request $request,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        [$tenant, $scope, $branchId] =
            $this->context(
                $request,
                $scopeResolver
            );

        $employeeIds =
            $this->employeeIds(
                (int) $tenant->id,
                $branchId
            );

        $today = now()->toDateString();

        return response()->json([
            'time_attendance' => [
                'shift_templates' =>
                    $this->shiftTemplateQuery(
                        (int) $tenant->id,
                        $branchId
                    )->count(),

                'active_assignments' =>
                    DB::table(
                        'hrm_employee_shift_assignments'
                    )
                        ->where(
                            'tenant_id',
                            $tenant->id
                        )
                        ->whereIn(
                            'employee_id',
                            $employeeIds
                        )
                        ->where(
                            'status',
                            'active'
                        )
                        ->count(),

                'today_records' =>
                    DB::table(
                        'hrm_attendance_records'
                    )
                        ->where(
                            'tenant_id',
                            $tenant->id
                        )
                        ->whereIn(
                            'employee_id',
                            $employeeIds
                        )
                        ->whereDate(
                            'work_date',
                            $today
                        )
                        ->count(),

                'pending_approvals' =>
                    DB::table(
                        'hrm_attendance_records'
                    )
                        ->where(
                            'tenant_id',
                            $tenant->id
                        )
                        ->whereIn(
                            'employee_id',
                            $employeeIds
                        )
                        ->where(
                            'status',
                            'submitted'
                        )
                        ->count(),

                'pending_overtime' =>
                    DB::table(
                        'hrm_overtime_requests'
                    )
                        ->where(
                            'tenant_id',
                            $tenant->id
                        )
                        ->whereIn(
                            'employee_id',
                            $employeeIds
                        )
                        ->where(
                            'status',
                            'pending'
                        )
                        ->count(),
            ],

            'leave' => [
                'active_types' =>
                    DB::table(
                        'hrm_leave_types'
                    )
                        ->where(
                            'tenant_id',
                            $tenant->id
                        )
                        ->where(
                            'status',
                            'active'
                        )
                        ->count(),

                'active_policies' =>
                    $this->leavePolicyQuery(
                        (int) $tenant->id,
                        $branchId
                    )
                        ->where(
                            'status',
                            'active'
                        )
                        ->count(),

                'pending_requests' =>
                    DB::table(
                        'hrm_leave_requests'
                    )
                        ->where(
                            'tenant_id',
                            $tenant->id
                        )
                        ->whereIn(
                            'employee_id',
                            $employeeIds
                        )
                        ->where(
                            'status',
                            'submitted'
                        )
                        ->count(),
            ],

            'controls' => [
                'payroll_recalculation' =>
                    false,

                'finance_posting' =>
                    false,
            ],
        ]);
    }

    public function employees(
        Request $request,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        [$tenant, $scope, $branchId] =
            $this->context(
                $request,
                $scopeResolver
            );

        $query =
            Employee::query()
                ->where(
                    'tenant_id',
                    $tenant->id
                )
                ->with([
                    'position:id,name',
                    'grade:id,name',
                ])
                ->orderBy(
                    'employee_number'
                );

        $this->scopeEmployeeQuery(
            $query,
            (int) $tenant->id,
            $branchId
        );

        return response()->json([
            'employees' =>
                $query
                    ->limit(500)
                    ->get([
                        'id',
                        'employee_number',
                        'user_id',
                        'home_branch_id',
                        'current_department_id',
                        'current_position_id',
                        'job_grade_id',
                        'employment_status',
                    ])
                    ->values(),
        ]);
    }

    public function shiftTemplates(
        Request $request,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        [$tenant, $scope, $branchId] =
            $this->context(
                $request,
                $scopeResolver
            );

        return response()->json([
            'shift_templates' =>
                $this->shiftTemplateQuery(
                    (int) $tenant->id,
                    $branchId
                )
                    ->orderBy('name')
                    ->get(),
        ]);
    }

    public function createShiftTemplate(
        Request $request,
        ScopeResolver $scopeResolver,
        AuditLogService $auditLogService
    ): JsonResponse {
        [$tenant, $scope, $scopeBranchId] =
            $this->context(
                $request,
                $scopeResolver
            );

        $validated =
            $request->validate([
                'branch_id' => [
                    'nullable',
                    'integer',
                ],
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
                'start_time' => [
                    'required',
                    'date_format:H:i',
                ],
                'end_time' => [
                    'required',
                    'date_format:H:i',
                ],
                'break_minutes' => [
                    'nullable',
                    'integer',
                    'min:0',
                    'max:720',
                ],
                'working_days' => [
                    'nullable',
                    'array',
                ],
                'working_days.*' => [
                    'integer',
                    'between:1,7',
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
            ]);

        $branchId =
            $this->resolvedBranch(
                (int) $tenant->id,
                $scopeBranchId,
                $validated['branch_id']
                    ?? null
            );

        $exists =
            DB::table(
                'hrm_shift_templates'
            )
                ->where(
                    'tenant_id',
                    $tenant->id
                )
                ->where(
                    'code',
                    trim(
                        $validated['code']
                    )
                )
                ->exists();

        if ($exists) {
            throw ValidationException::withMessages([
                'code' => [
                    'This shift code already exists.',
                ],
            ]);
        }

        $id =
            DB::table(
                'hrm_shift_templates'
            )
                ->insertGetId([
                    'uuid' =>
                        (string) Str::uuid(),

                    'tenant_id' =>
                        $tenant->id,

                    'branch_id' =>
                        $branchId,

                    'code' =>
                        trim(
                            $validated['code']
                        ),

                    'name' =>
                        trim(
                            $validated['name']
                        ),

                    'start_time' =>
                        $validated['start_time'],

                    'end_time' =>
                        $validated['end_time'],

                    'break_minutes' =>
                        $validated[
                            'break_minutes'
                        ] ?? 0,

                    'working_days' =>
                        json_encode(
                            $validated[
                                'working_days'
                            ] ?? []
                        ),

                    'effective_from' =>
                        $validated[
                            'effective_from'
                        ],

                    'effective_to' =>
                        $validated[
                            'effective_to'
                        ] ?? null,

                    'status' =>
                        'active',

                    'created_by' =>
                        $request->user()?->id,

                    'updated_by' =>
                        $request->user()?->id,

                    'created_at' =>
                        now(),

                    'updated_at' =>
                        now(),
                ]);

        $this->audit(
            $auditLogService,
            $scope,
            'hrm.shift_template.created',
            $id,
            [
                'branch_id' =>
                    $branchId,

                'code' =>
                    $validated['code'],

                'payroll_recalculation' =>
                    false,

                'finance_posting' =>
                    false,
            ]
        );

        return response()->json([
            'message' =>
                'Shift template created.',

            'shift_template' =>
                DB::table(
                    'hrm_shift_templates'
                )
                    ->where('id', $id)
                    ->first(),
        ], 201);
    }

    public function shiftAssignments(
        Request $request,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        [$tenant, $scope, $branchId] =
            $this->context(
                $request,
                $scopeResolver
            );

        $employeeIds =
            $this->employeeIds(
                (int) $tenant->id,
                $branchId
            );

        $rows =
            DB::table(
                'hrm_employee_shift_assignments as a'
            )
                ->leftJoin(
                    'hrm_shift_templates as s',
                    's.id',
                    '=',
                    'a.shift_template_id'
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
                    $employeeIds
                )
                ->orderByDesc(
                    'a.effective_from'
                )
                ->limit(500)
                ->get([
                    'a.*',
                    's.name as shift_name',
                    's.code as shift_code',
                    'e.employee_number',
                ]);

        return response()->json([
            'shift_assignments' => $rows,
        ]);
    }

    public function createShiftAssignment(
        Request $request,
        ScopeResolver $scopeResolver,
        AuditLogService $auditLogService
    ): JsonResponse {
        [$tenant, $scope, $scopeBranchId] =
            $this->context(
                $request,
                $scopeResolver
            );

        $validated =
            $request->validate([
                'employee_id' => [
                    'required',
                    'integer',
                ],
                'shift_template_id' => [
                    'required',
                    'integer',
                ],
                'branch_id' => [
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
                'notes' => [
                    'nullable',
                    'string',
                    'max:2000',
                ],
            ]);

        $employee =
            $this->employee(
                (int) $tenant->id,
                (int) $validated[
                    'employee_id'
                ],
                $scopeBranchId
            );

        $branchId =
            $this->resolvedBranch(
                (int) $tenant->id,
                $scopeBranchId,
                $validated['branch_id']
                    ??
                $employee->home_branch_id
            );

        $shift =
            DB::table(
                'hrm_shift_templates'
            )
                ->where(
                    'tenant_id',
                    $tenant->id
                )
                ->where(
                    'id',
                    $validated[
                        'shift_template_id'
                    ]
                )
                ->where(
                    'status',
                    'active'
                )
                ->first();

        if (! $shift) {
            throw ValidationException::withMessages([
                'shift_template_id' => [
                    'The selected shift is unavailable.',
                ],
            ]);
        }

        if (
            $shift->branch_id !== null
            &&
            (int) $shift->branch_id
                !==
            (int) $branchId
        ) {
            throw ValidationException::withMessages([
                'shift_template_id' => [
                    'The shift belongs to another branch.',
                ],
            ]);
        }

        $start =
            $validated[
                'effective_from'
            ];

        $end =
            $validated[
                'effective_to'
            ] ?? '9999-12-31';

        $overlap =
            DB::table(
                'hrm_employee_shift_assignments'
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
                    'status',
                    'active'
                )
                ->whereDate(
                    'effective_from',
                    '<=',
                    $end
                )
                ->where(
                    function (
                        Builder $query
                    ) use ($start): void {
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

        if ($overlap) {
            throw ValidationException::withMessages([
                'effective_from' => [
                    'The employee already has an overlapping active shift assignment.',
                ],
            ]);
        }

        $id =
            DB::table(
                'hrm_employee_shift_assignments'
            )
                ->insertGetId([
                    'uuid' =>
                        (string) Str::uuid(),

                    'tenant_id' =>
                        $tenant->id,

                    'employee_id' =>
                        $employee->id,

                    'shift_template_id' =>
                        $shift->id,

                    'branch_id' =>
                        $branchId,

                    'effective_from' =>
                        $start,

                    'effective_to' =>
                        $validated[
                            'effective_to'
                        ] ?? null,

                    'status' =>
                        'active',

                    'notes' =>
                        $validated[
                            'notes'
                        ] ?? null,

                    'created_by' =>
                        $request->user()?->id,

                    'created_at' =>
                        now(),

                    'updated_at' =>
                        now(),
                ]);

        $this->audit(
            $auditLogService,
            $scope,
            'hrm.shift_assignment.created',
            $id,
            [
                'employee_id' =>
                    $employee->id,

                'shift_template_id' =>
                    $shift->id,

                'branch_id' =>
                    $branchId,

                'effective_from' =>
                    $start,

                'effective_to' =>
                    $validated[
                        'effective_to'
                    ] ?? null,
            ]
        );

        return response()->json([
            'message' =>
                'Shift assignment created.',

            'shift_assignment' =>
                DB::table(
                    'hrm_employee_shift_assignments'
                )
                    ->where('id', $id)
                    ->first(),
        ], 201);
    }

    public function attendance(
        Request $request,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        [$tenant, $scope, $branchId] =
            $this->context(
                $request,
                $scopeResolver
            );

        $employeeIds =
            $this->employeeIds(
                (int) $tenant->id,
                $branchId
            );

        $rows =
            DB::table(
                'hrm_attendance_records as a'
            )
                ->leftJoin(
                    'hrm_employees as e',
                    'e.id',
                    '=',
                    'a.employee_id'
                )
                ->leftJoin(
                    'hrm_shift_templates as s',
                    's.id',
                    '=',
                    'a.shift_template_id'
                )
                ->where(
                    'a.tenant_id',
                    $tenant->id
                )
                ->whereIn(
                    'a.employee_id',
                    $employeeIds
                )
                ->when(
                    $request->query('from'),
                    fn ($query, $from) =>
                        $query->whereDate(
                            'a.work_date',
                            '>=',
                            $from
                        )
                )
                ->when(
                    $request->query('to'),
                    fn ($query, $to) =>
                        $query->whereDate(
                            'a.work_date',
                            '<=',
                            $to
                        )
                )
                ->orderByDesc(
                    'a.work_date'
                )
                ->orderByDesc(
                    'a.id'
                )
                ->limit(500)
                ->get([
                    'a.*',
                    'e.employee_number',
                    's.name as shift_name',
                ]);

        return response()->json([
            'attendance' => $rows,
        ]);
    }

    public function createAttendance(
        Request $request,
        ScopeResolver $scopeResolver,
        AuditLogService $auditLogService
    ): JsonResponse {
        [$tenant, $scope, $scopeBranchId] =
            $this->context(
                $request,
                $scopeResolver
            );

        $validated =
            $request->validate([
                'employee_id' => [
                    'required',
                    'integer',
                ],
                'work_date' => [
                    'required',
                    'date',
                ],
                'clock_in_at' => [
                    'nullable',
                    'date',
                ],
                'clock_out_at' => [
                    'nullable',
                    'date',
                    'after:clock_in_at',
                ],
                'shift_template_id' => [
                    'nullable',
                    'integer',
                ],
                'notes' => [
                    'nullable',
                    'string',
                    'max:2000',
                ],
            ]);

        $employee =
            $this->employee(
                (int) $tenant->id,
                (int) $validated[
                    'employee_id'
                ],
                $scopeBranchId
            );

        $exists =
            DB::table(
                'hrm_attendance_records'
            )
                ->where(
                    'tenant_id',
                    $tenant->id
                )
                ->where(
                    'employee_id',
                    $employee->id
                )
                ->whereDate(
                    'work_date',
                    $validated[
                        'work_date'
                    ]
                )
                ->exists();

        if ($exists) {
            throw ValidationException::withMessages([
                'work_date' => [
                    'Attendance already exists for this employee and date.',
                ],
            ]);
        }

        $shiftId =
            $validated[
                'shift_template_id'
            ] ?? null;

        if ($shiftId !== null) {
            $shift =
                DB::table(
                    'hrm_shift_templates'
                )
                    ->where(
                        'tenant_id',
                        $tenant->id
                    )
                    ->where(
                        'id',
                        $shiftId
                    )
                    ->first();

            if (! $shift) {
                throw ValidationException::withMessages([
                    'shift_template_id' => [
                        'The selected shift is unavailable.',
                    ],
                ]);
            }
        }

        $workedMinutes =
            $this->minutesBetween(
                $validated[
                    'clock_in_at'
                ] ?? null,
                $validated[
                    'clock_out_at'
                ] ?? null
            );

        $id =
            DB::table(
                'hrm_attendance_records'
            )
                ->insertGetId([
                    'uuid' =>
                        (string) Str::uuid(),

                    'tenant_id' =>
                        $tenant->id,

                    'employee_id' =>
                        $employee->id,

                    'branch_id' =>
                        $employee->home_branch_id
                        ??
                        $scopeBranchId,

                    'shift_template_id' =>
                        $shiftId,

                    'work_date' =>
                        $validated[
                            'work_date'
                        ],

                    'clock_in_at' =>
                        $validated[
                            'clock_in_at'
                        ] ?? null,

                    'clock_out_at' =>
                        $validated[
                            'clock_out_at'
                        ] ?? null,

                    'worked_minutes' =>
                        $workedMinutes,

                    'overtime_minutes' =>
                        0,

                    'source' =>
                        'manual',

                    'status' =>
                        'draft',

                    'notes' =>
                        $validated[
                            'notes'
                        ] ?? null,

                    'created_by' =>
                        $request->user()?->id,

                    'created_at' =>
                        now(),

                    'updated_at' =>
                        now(),
                ]);

        $this->audit(
            $auditLogService,
            $scope,
            'hrm.attendance.created',
            $id,
            [
                'employee_id' =>
                    $employee->id,

                'work_date' =>
                    $validated[
                        'work_date'
                    ],

                'payroll_recalculation' =>
                    false,

                'finance_posting' =>
                    false,
            ]
        );

        return response()->json([
            'message' =>
                'Attendance draft created.',

            'attendance' =>
                DB::table(
                    'hrm_attendance_records'
                )
                    ->where('id', $id)
                    ->first(),
        ], 201);
    }

    public function submitAttendance(
        Request $request,
        int $attendanceId,
        ScopeResolver $scopeResolver,
        AuditLogService $auditLogService
    ): JsonResponse {
        [$tenant, $scope, $branchId] =
            $this->context(
                $request,
                $scopeResolver
            );

        $record =
            $this->attendanceRecord(
                (int) $tenant->id,
                $attendanceId,
                $branchId
            );

        if ($record->status !== 'draft') {
            throw ValidationException::withMessages([
                'status' => [
                    'Only draft attendance can be submitted.',
                ],
            ]);
        }

        DB::table(
            'hrm_attendance_records'
        )
            ->where(
                'id',
                $record->id
            )
            ->update([
                'status' =>
                    'submitted',

                'submitted_by' =>
                    $request->user()?->id,

                'submitted_at' =>
                    now(),

                'updated_at' =>
                    now(),
            ]);

        $this->audit(
            $auditLogService,
            $scope,
            'hrm.attendance.submitted',
            (int) $record->id,
            [
                'employee_id' =>
                    $record->employee_id,

                'work_date' =>
                    $record->work_date,

                'payroll_recalculation' =>
                    false,
            ]
        );

        return response()->json([
            'message' =>
                'Attendance submitted for review.',
        ]);
    }

    public function approveAttendance(
        Request $request,
        int $attendanceId,
        ScopeResolver $scopeResolver,
        AuditLogService $auditLogService
    ): JsonResponse {
        return $this->attendanceDecision(
            $request,
            $attendanceId,
            'approved',
            $scopeResolver,
            $auditLogService
        );
    }

    public function rejectAttendance(
        Request $request,
        int $attendanceId,
        ScopeResolver $scopeResolver,
        AuditLogService $auditLogService
    ): JsonResponse {
        return $this->attendanceDecision(
            $request,
            $attendanceId,
            'rejected',
            $scopeResolver,
            $auditLogService
        );
    }

    private function attendanceDecision(
        Request $request,
        int $attendanceId,
        string $decision,
        ScopeResolver $scopeResolver,
        AuditLogService $auditLogService
    ): JsonResponse {
        [$tenant, $scope, $branchId] =
            $this->context(
                $request,
                $scopeResolver
            );

        $validated =
            $request->validate([
                'reason' => [
                    $decision === 'rejected'
                        ? 'required'
                        : 'nullable',
                    'string',
                    'max:2000',
                ],
            ]);

        $record =
            $this->attendanceRecord(
                (int) $tenant->id,
                $attendanceId,
                $branchId
            );

        if ($record->status !== 'submitted') {
            throw ValidationException::withMessages([
                'status' => [
                    'Only submitted attendance can be decided.',
                ],
            ]);
        }

        $this->assertMakerChecker(
            $request,
            [
                $record->created_by,
                $record->submitted_by,
            ]
        );

        $update = [
            'status' =>
                $decision,

            'updated_at' =>
                now(),
        ];

        if ($decision === 'approved') {
            $update['approved_by'] =
                $request->user()?->id;

            $update['approved_at'] =
                now();
        } else {
            $update['rejected_by'] =
                $request->user()?->id;

            $update['rejected_at'] =
                now();

            $update['rejection_reason'] =
                $validated['reason'];
        }

        DB::table(
            'hrm_attendance_records'
        )
            ->where(
                'id',
                $record->id
            )
            ->update(
                $update
            );

        $this->audit(
            $auditLogService,
            $scope,
            'hrm.attendance.' . $decision,
            (int) $record->id,
            [
                'employee_id' =>
                    $record->employee_id,

                'work_date' =>
                    $record->work_date,

                'payroll_recalculation' =>
                    false,

                'finance_posting' =>
                    false,
            ]
        );

        return response()->json([
            'message' =>
                'Attendance '
                . $decision
                . '.',
        ]);
    }

    public function overtime(
        Request $request,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        [$tenant, $scope, $branchId] =
            $this->context(
                $request,
                $scopeResolver
            );

        $employeeIds =
            $this->employeeIds(
                (int) $tenant->id,
                $branchId
            );

        $rows =
            DB::table(
                'hrm_overtime_requests as o'
            )
                ->leftJoin(
                    'hrm_employees as e',
                    'e.id',
                    '=',
                    'o.employee_id'
                )
                ->where(
                    'o.tenant_id',
                    $tenant->id
                )
                ->whereIn(
                    'o.employee_id',
                    $employeeIds
                )
                ->orderByDesc(
                    'o.work_date'
                )
                ->orderByDesc(
                    'o.id'
                )
                ->limit(500)
                ->get([
                    'o.*',
                    'e.employee_number',
                ]);

        return response()->json([
            'overtime' => $rows,
        ]);
    }

    public function createOvertime(
        Request $request,
        ScopeResolver $scopeResolver,
        AuditLogService $auditLogService
    ): JsonResponse {
        [$tenant, $scope, $branchId] =
            $this->context(
                $request,
                $scopeResolver
            );

        $validated =
            $request->validate([
                'employee_id' => [
                    'required',
                    'integer',
                ],
                'attendance_record_id' => [
                    'nullable',
                    'integer',
                ],
                'work_date' => [
                    'required',
                    'date',
                ],
                'requested_minutes' => [
                    'required',
                    'integer',
                    'min:1',
                    'max:1440',
                ],
                'reason' => [
                    'required',
                    'string',
                    'max:2000',
                ],
            ]);

        $employee =
            $this->employee(
                (int) $tenant->id,
                (int) $validated[
                    'employee_id'
                ],
                $branchId
            );

        $id =
            DB::table(
                'hrm_overtime_requests'
            )
                ->insertGetId([
                    'uuid' =>
                        (string) Str::uuid(),

                    'tenant_id' =>
                        $tenant->id,

                    'employee_id' =>
                        $employee->id,

                    'branch_id' =>
                        $employee->home_branch_id
                        ??
                        $branchId,

                    'attendance_record_id' =>
                        $validated[
                            'attendance_record_id'
                        ] ?? null,

                    'work_date' =>
                        $validated[
                            'work_date'
                        ],

                    'requested_minutes' =>
                        $validated[
                            'requested_minutes'
                        ],

                    'reason' =>
                        $validated[
                            'reason'
                        ],

                    'status' =>
                        'pending',

                    'created_by' =>
                        $request->user()?->id,

                    'created_at' =>
                        now(),

                    'updated_at' =>
                        now(),
                ]);

        $this->audit(
            $auditLogService,
            $scope,
            'hrm.overtime.requested',
            $id,
            [
                'employee_id' =>
                    $employee->id,

                'requested_minutes' =>
                    $validated[
                        'requested_minutes'
                    ],

                'payroll_recalculation' =>
                    false,
            ]
        );

        return response()->json([
            'message' =>
                'Overtime request created.',
        ], 201);
    }

    public function approveOvertime(
        Request $request,
        int $overtimeId,
        ScopeResolver $scopeResolver,
        AuditLogService $auditLogService
    ): JsonResponse {
        return $this->overtimeDecision(
            $request,
            $overtimeId,
            'approved',
            $scopeResolver,
            $auditLogService
        );
    }

    public function rejectOvertime(
        Request $request,
        int $overtimeId,
        ScopeResolver $scopeResolver,
        AuditLogService $auditLogService
    ): JsonResponse {
        return $this->overtimeDecision(
            $request,
            $overtimeId,
            'rejected',
            $scopeResolver,
            $auditLogService
        );
    }

    private function overtimeDecision(
        Request $request,
        int $overtimeId,
        string $decision,
        ScopeResolver $scopeResolver,
        AuditLogService $auditLogService
    ): JsonResponse {
        [$tenant, $scope, $branchId] =
            $this->context(
                $request,
                $scopeResolver
            );

        $validated =
            $request->validate([
                'reason' => [
                    $decision === 'rejected'
                        ? 'required'
                        : 'nullable',
                    'string',
                    'max:2000',
                ],
            ]);

        $row =
            DB::table(
                'hrm_overtime_requests'
            )
                ->where(
                    'tenant_id',
                    $tenant->id
                )
                ->where(
                    'id',
                    $overtimeId
                )
                ->first();

        if (! $row) {
            abort(404);
        }

        $this->employee(
            (int) $tenant->id,
            (int) $row->employee_id,
            $branchId
        );

        if ($row->status !== 'pending') {
            throw ValidationException::withMessages([
                'status' => [
                    'Only pending overtime can be decided.',
                ],
            ]);
        }

        $this->assertMakerChecker(
            $request,
            [
                $row->created_by,
            ]
        );

        $update = [
            'status' =>
                $decision,

            'updated_at' =>
                now(),
        ];

        if ($decision === 'approved') {
            $update['approved_by'] =
                $request->user()?->id;

            $update['approved_at'] =
                now();
        } else {
            $update['rejected_by'] =
                $request->user()?->id;

            $update['rejected_at'] =
                now();

            $update['rejection_reason'] =
                $validated['reason'];
        }

        DB::table(
            'hrm_overtime_requests'
        )
            ->where(
                'id',
                $row->id
            )
            ->update(
                $update
            );

        $this->audit(
            $auditLogService,
            $scope,
            'hrm.overtime.' . $decision,
            (int) $row->id,
            [
                'employee_id' =>
                    $row->employee_id,

                'requested_minutes' =>
                    $row->requested_minutes,

                'payroll_recalculation' =>
                    false,
            ]
        );

        return response()->json([
            'message' =>
                'Overtime '
                . $decision
                . '.',
        ]);
    }

    public function leaveTypes(
        Request $request,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        [$tenant] =
            $this->context(
                $request,
                $scopeResolver
            );

        return response()->json([
            'leave_types' =>
                DB::table(
                    'hrm_leave_types'
                )
                    ->where(
                        'tenant_id',
                        $tenant->id
                    )
                    ->orderBy('name')
                    ->get(),
        ]);
    }

    public function createLeaveType(
        Request $request,
        ScopeResolver $scopeResolver,
        AuditLogService $auditLogService
    ): JsonResponse {
        [$tenant, $scope] =
            $this->context(
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
                'unit' => [
                    'nullable',
                    'in:days,hours',
                ],
                'paid' => [
                    'nullable',
                    'boolean',
                ],
                'requires_document' => [
                    'nullable',
                    'boolean',
                ],
                'description' => [
                    'nullable',
                    'string',
                    'max:2000',
                ],
            ]);

        $exists =
            DB::table(
                'hrm_leave_types'
            )
                ->where(
                    'tenant_id',
                    $tenant->id
                )
                ->where(
                    'code',
                    trim(
                        $validated['code']
                    )
                )
                ->exists();

        if ($exists) {
            throw ValidationException::withMessages([
                'code' => [
                    'This leave type code already exists.',
                ],
            ]);
        }

        $id =
            DB::table(
                'hrm_leave_types'
            )
                ->insertGetId([
                    'uuid' =>
                        (string) Str::uuid(),

                    'tenant_id' =>
                        $tenant->id,

                    'code' =>
                        trim(
                            $validated['code']
                        ),

                    'name' =>
                        trim(
                            $validated['name']
                        ),

                    'unit' =>
                        $validated['unit']
                        ?? 'days',

                    'paid' =>
                        (bool) (
                            $validated['paid']
                            ?? true
                        ),

                    'requires_document' =>
                        (bool) (
                            $validated[
                                'requires_document'
                            ] ?? false
                        ),

                    'status' =>
                        'active',

                    'description' =>
                        $validated[
                            'description'
                        ] ?? null,

                    'created_by' =>
                        $request->user()?->id,

                    'created_at' =>
                        now(),

                    'updated_at' =>
                        now(),
                ]);

        $this->audit(
            $auditLogService,
            $scope,
            'hrm.leave_type.created',
            $id,
            [
                'code' =>
                    $validated['code'],
            ]
        );

        return response()->json([
            'message' =>
                'Leave type created.',
        ], 201);
    }

    public function leavePolicies(
        Request $request,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        [$tenant, $scope, $branchId] =
            $this->context(
                $request,
                $scopeResolver
            );

        $rows =
            $this->leavePolicyQuery(
                (int) $tenant->id,
                $branchId
            )
                ->leftJoin(
                    'hrm_leave_types as t',
                    't.id',
                    '=',
                    'hrm_leave_policies.leave_type_id'
                )
                ->orderByDesc(
                    'hrm_leave_policies.effective_from'
                )
                ->get([
                    'hrm_leave_policies.*',
                    't.name as leave_type_name',
                    't.code as leave_type_code',
                ]);

        return response()->json([
            'leave_policies' =>
                $rows,
        ]);
    }

    public function createLeavePolicy(
        Request $request,
        ScopeResolver $scopeResolver,
        AuditLogService $auditLogService
    ): JsonResponse {
        [$tenant, $scope, $scopeBranchId] =
            $this->context(
                $request,
                $scopeResolver
            );

        $validated =
            $request->validate([
                'leave_type_id' => [
                    'required',
                    'integer',
                ],
                'branch_id' => [
                    'nullable',
                    'integer',
                ],
                'policy_name' => [
                    'required',
                    'string',
                    'max:191',
                ],
                'entitlement_days' => [
                    'required',
                    'numeric',
                    'min:0',
                ],
                'carry_forward_limit' => [
                    'nullable',
                    'numeric',
                    'min:0',
                ],
                'accrual_method' => [
                    'required',
                    'in:annual,monthly,none',
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
            ]);

        $leaveType =
            DB::table(
                'hrm_leave_types'
            )
                ->where(
                    'tenant_id',
                    $tenant->id
                )
                ->where(
                    'id',
                    $validated[
                        'leave_type_id'
                    ]
                )
                ->where(
                    'status',
                    'active'
                )
                ->first();

        if (! $leaveType) {
            throw ValidationException::withMessages([
                'leave_type_id' => [
                    'The selected leave type is unavailable.',
                ],
            ]);
        }

        $branchId =
            $this->resolvedBranch(
                (int) $tenant->id,
                $scopeBranchId,
                $validated['branch_id']
                    ?? null
            );

        $start =
            $validated[
                'effective_from'
            ];

        $end =
            $validated[
                'effective_to'
            ] ?? '9999-12-31';

        $overlap =
            DB::table(
                'hrm_leave_policies'
            )
                ->where(
                    'tenant_id',
                    $tenant->id
                )
                ->where(
                    'leave_type_id',
                    $leaveType->id
                )
                ->where(
                    'status',
                    'active'
                )
                ->when(
                    $branchId === null,
                    fn ($query) =>
                        $query->whereNull(
                            'branch_id'
                        ),
                    fn ($query) =>
                        $query->where(
                            'branch_id',
                            $branchId
                        )
                )
                ->whereDate(
                    'effective_from',
                    '<=',
                    $end
                )
                ->where(
                    function (
                        Builder $query
                    ) use ($start): void {
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

        if ($overlap) {
            throw ValidationException::withMessages([
                'effective_from' => [
                    'An overlapping active leave policy already exists.',
                ],
            ]);
        }

        $id =
            DB::table(
                'hrm_leave_policies'
            )
                ->insertGetId([
                    'uuid' =>
                        (string) Str::uuid(),

                    'tenant_id' =>
                        $tenant->id,

                    'leave_type_id' =>
                        $leaveType->id,

                    'branch_id' =>
                        $branchId,

                    'policy_name' =>
                        trim(
                            $validated[
                                'policy_name'
                            ]
                        ),

                    'entitlement_days' =>
                        $validated[
                            'entitlement_days'
                        ],

                    'carry_forward_limit' =>
                        $validated[
                            'carry_forward_limit'
                        ] ?? null,

                    'accrual_method' =>
                        $validated[
                            'accrual_method'
                        ],

                    'effective_from' =>
                        $start,

                    'effective_to' =>
                        $validated[
                            'effective_to'
                        ] ?? null,

                    'status' =>
                        'active',

                    'created_by' =>
                        $request->user()?->id,

                    'created_at' =>
                        now(),

                    'updated_at' =>
                        now(),
                ]);

        $this->audit(
            $auditLogService,
            $scope,
            'hrm.leave_policy.created',
            $id,
            [
                'leave_type_id' =>
                    $leaveType->id,

                'branch_id' =>
                    $branchId,

                'effective_from' =>
                    $start,
            ]
        );

        return response()->json([
            'message' =>
                'Leave policy created.',
        ], 201);
    }

    public function leaveBalances(
        Request $request,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        [$tenant, $scope, $branchId] =
            $this->context(
                $request,
                $scopeResolver
            );

        $employeeIds =
            $this->employeeIds(
                (int) $tenant->id,
                $branchId
            );

        $rows =
            DB::table(
                'hrm_leave_balances as b'
            )
                ->leftJoin(
                    'hrm_leave_types as t',
                    't.id',
                    '=',
                    'b.leave_type_id'
                )
                ->leftJoin(
                    'hrm_employees as e',
                    'e.id',
                    '=',
                    'b.employee_id'
                )
                ->where(
                    'b.tenant_id',
                    $tenant->id
                )
                ->whereIn(
                    'b.employee_id',
                    $employeeIds
                )
                ->orderByDesc(
                    'b.period_start'
                )
                ->limit(500)
                ->get([
                    'b.*',
                    't.name as leave_type_name',
                    'e.employee_number',
                ]);

        return response()->json([
            'leave_balances' => $rows,
        ]);
    }

    public function createLeaveBalance(
        Request $request,
        ScopeResolver $scopeResolver,
        AuditLogService $auditLogService
    ): JsonResponse {
        [$tenant, $scope, $branchId] =
            $this->context(
                $request,
                $scopeResolver
            );

        $validated =
            $request->validate([
                'employee_id' => [
                    'required',
                    'integer',
                ],
                'leave_type_id' => [
                    'required',
                    'integer',
                ],
                'policy_id' => [
                    'nullable',
                    'integer',
                ],
                'period_start' => [
                    'required',
                    'date',
                ],
                'period_end' => [
                    'required',
                    'date',
                    'after_or_equal:period_start',
                ],
                'opening_balance' => [
                    'nullable',
                    'numeric',
                ],
                'accrued' => [
                    'nullable',
                    'numeric',
                    'min:0',
                ],
                'adjustment' => [
                    'nullable',
                    'numeric',
                ],
            ]);

        $employee =
            $this->employee(
                (int) $tenant->id,
                (int) $validated[
                    'employee_id'
                ],
                $branchId
            );

        $leaveType =
            DB::table(
                'hrm_leave_types'
            )
                ->where(
                    'tenant_id',
                    $tenant->id
                )
                ->where(
                    'id',
                    $validated[
                        'leave_type_id'
                    ]
                )
                ->where(
                    'status',
                    'active'
                )
                ->first();

        if (! $leaveType) {
            throw ValidationException::withMessages([
                'leave_type_id' => [
                    'The selected leave type is unavailable.',
                ],
            ]);
        }

        $opening =
            (float) (
                $validated[
                    'opening_balance'
                ] ?? 0
            );

        $accrued =
            (float) (
                $validated[
                    'accrued'
                ] ?? 0
            );

        $adjustment =
            (float) (
                $validated[
                    'adjustment'
                ] ?? 0
            );

        $closing =
            $opening
            + $accrued
            + $adjustment;

        $id =
            DB::table(
                'hrm_leave_balances'
            )
                ->insertGetId([
                    'uuid' =>
                        (string) Str::uuid(),

                    'tenant_id' =>
                        $tenant->id,

                    'employee_id' =>
                        $employee->id,

                    'leave_type_id' =>
                        $leaveType->id,

                    'policy_id' =>
                        $validated[
                            'policy_id'
                        ] ?? null,

                    'period_start' =>
                        $validated[
                            'period_start'
                        ],

                    'period_end' =>
                        $validated[
                            'period_end'
                        ],

                    'opening_balance' =>
                        $opening,

                    'accrued' =>
                        $accrued,

                    'taken' =>
                        0,

                    'reserved' =>
                        0,

                    'adjustment' =>
                        $adjustment,

                    'closing_balance' =>
                        $closing,

                    'status' =>
                        'active',

                    'created_by' =>
                        $request->user()?->id,

                    'created_at' =>
                        now(),

                    'updated_at' =>
                        now(),
                ]);

        $this->audit(
            $auditLogService,
            $scope,
            'hrm.leave_balance.created',
            $id,
            [
                'employee_id' =>
                    $employee->id,

                'leave_type_id' =>
                    $leaveType->id,

                'closing_balance' =>
                    $closing,
            ]
        );

        return response()->json([
            'message' =>
                'Leave balance created.',
        ], 201);
    }

    public function leaveRequests(
        Request $request,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        [$tenant, $scope, $branchId] =
            $this->context(
                $request,
                $scopeResolver
            );

        $employeeIds =
            $this->employeeIds(
                (int) $tenant->id,
                $branchId
            );

        $rows =
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
                    $employeeIds
                )
                ->orderByDesc(
                    'r.start_date'
                )
                ->orderByDesc(
                    'r.id'
                )
                ->limit(500)
                ->get([
                    'r.*',
                    't.name as leave_type_name',
                    'e.employee_number',
                ]);

        return response()->json([
            'leave_requests' => $rows,
        ]);
    }

    public function createLeaveRequest(
        Request $request,
        ScopeResolver $scopeResolver,
        AuditLogService $auditLogService
    ): JsonResponse {
        [$tenant, $scope, $branchId] =
            $this->context(
                $request,
                $scopeResolver
            );

        $validated =
            $request->validate([
                'employee_id' => [
                    'required',
                    'integer',
                ],
                'leave_type_id' => [
                    'required',
                    'integer',
                ],
                'start_date' => [
                    'required',
                    'date',
                ],
                'end_date' => [
                    'required',
                    'date',
                    'after_or_equal:start_date',
                ],
                'requested_days' => [
                    'required',
                    'numeric',
                    'gt:0',
                ],
                'reason' => [
                    'nullable',
                    'string',
                    'max:2000',
                ],
                'attachment_reference' => [
                    'nullable',
                    'string',
                    'max:191',
                ],
            ]);

        $employee =
            $this->employee(
                (int) $tenant->id,
                (int) $validated[
                    'employee_id'
                ],
                $branchId
            );

        $leaveType =
            DB::table(
                'hrm_leave_types'
            )
                ->where(
                    'tenant_id',
                    $tenant->id
                )
                ->where(
                    'id',
                    $validated[
                        'leave_type_id'
                    ]
                )
                ->where(
                    'status',
                    'active'
                )
                ->first();

        if (! $leaveType) {
            throw ValidationException::withMessages([
                'leave_type_id' => [
                    'The selected leave type is unavailable.',
                ],
            ]);
        }

        $overlap =
            DB::table(
                'hrm_leave_requests'
            )
                ->where(
                    'tenant_id',
                    $tenant->id
                )
                ->where(
                    'employee_id',
                    $employee->id
                )
                ->whereIn(
                    'status',
                    [
                        'submitted',
                        'approved',
                    ]
                )
                ->whereDate(
                    'start_date',
                    '<=',
                    $validated[
                        'end_date'
                    ]
                )
                ->whereDate(
                    'end_date',
                    '>=',
                    $validated[
                        'start_date'
                    ]
                )
                ->exists();

        if ($overlap) {
            throw ValidationException::withMessages([
                'start_date' => [
                    'The employee already has overlapping submitted or approved leave.',
                ],
            ]);
        }

        $id =
            DB::table(
                'hrm_leave_requests'
            )
                ->insertGetId([
                    'uuid' =>
                        (string) Str::uuid(),

                    'tenant_id' =>
                        $tenant->id,

                    'employee_id' =>
                        $employee->id,

                    'leave_type_id' =>
                        $leaveType->id,

                    'branch_id' =>
                        $employee->home_branch_id
                        ??
                        $branchId,

                    'start_date' =>
                        $validated[
                            'start_date'
                        ],

                    'end_date' =>
                        $validated[
                            'end_date'
                        ],

                    'requested_days' =>
                        $validated[
                            'requested_days'
                        ],

                    'reason' =>
                        $validated[
                            'reason'
                        ] ?? null,

                    'attachment_reference' =>
                        $validated[
                            'attachment_reference'
                        ] ?? null,

                    'status' =>
                        'draft',

                    'created_by' =>
                        $request->user()?->id,

                    'created_at' =>
                        now(),

                    'updated_at' =>
                        now(),
                ]);

        $this->audit(
            $auditLogService,
            $scope,
            'hrm.leave_request.created',
            $id,
            [
                'employee_id' =>
                    $employee->id,

                'leave_type_id' =>
                    $leaveType->id,

                'requested_days' =>
                    $validated[
                        'requested_days'
                    ],
            ]
        );

        return response()->json([
            'message' =>
                'Leave request draft created.',

            'leave_request' =>
                DB::table(
                    'hrm_leave_requests'
                )
                    ->where('id', $id)
                    ->first(),
        ], 201);
    }

    public function submitLeaveRequest(
        Request $request,
        int $leaveRequestId,
        ScopeResolver $scopeResolver,
        AuditLogService $auditLogService
    ): JsonResponse {
        [$tenant, $scope, $branchId] =
            $this->context(
                $request,
                $scopeResolver
            );

        $result =
            DB::transaction(
                function () use (
                    $request,
                    $tenant,
                    $branchId,
                    $leaveRequestId
                ) {
                    $leave =
                        DB::table(
                            'hrm_leave_requests'
                        )
                            ->where(
                                'tenant_id',
                                $tenant->id
                            )
                            ->where(
                                'id',
                                $leaveRequestId
                            )
                            ->lockForUpdate()
                            ->first();

                    if (! $leave) {
                        abort(404);
                    }

                    $this->employee(
                        (int) $tenant->id,
                        (int) $leave->employee_id,
                        $branchId
                    );

                    if (
                        $leave->status
                        !==
                        'draft'
                    ) {
                        throw ValidationException::withMessages([
                            'status' => [
                                'Only draft leave requests can be submitted.',
                            ],
                        ]);
                    }

                    $balance =
                        $this->leaveBalanceForRequest(
                            (int) $tenant->id,
                            $leave
                        );

                    if (! $balance) {
                        throw ValidationException::withMessages([
                            'balance' => [
                                'No active leave balance covers this request period.',
                            ],
                        ]);
                    }

                    $available =
                        $this->availableBalance(
                            $balance
                        );

                    $requested =
                        (float)
                        $leave->requested_days;

                    if (
                        $available
                        <
                        $requested
                    ) {
                        throw ValidationException::withMessages([
                            'balance' => [
                                'Insufficient available leave balance.',
                            ],
                        ]);
                    }

                    DB::table(
                        'hrm_leave_balances'
                    )
                        ->where(
                            'id',
                            $balance->id
                        )
                        ->update([
                            'reserved' =>
                                (float)
                                $balance->reserved
                                +
                                $requested,

                            'closing_balance' =>
                                $available
                                -
                                $requested,

                            'updated_at' =>
                                now(),
                        ]);

                    DB::table(
                        'hrm_leave_requests'
                    )
                        ->where(
                            'id',
                            $leave->id
                        )
                        ->update([
                            'status' =>
                                'submitted',

                            'submitted_by' =>
                                $request->user()?->id,

                            'submitted_at' =>
                                now(),

                            'updated_at' =>
                                now(),
                        ]);

                    return [
                        $leave,
                        $balance,
                    ];
                }
            );

        [$leave, $balance] =
            $result;

        $this->audit(
            $auditLogService,
            $scope,
            'hrm.leave_request.submitted',
            (int) $leave->id,
            [
                'employee_id' =>
                    $leave->employee_id,

                'requested_days' =>
                    $leave->requested_days,

                'balance_id' =>
                    $balance->id,

                'payroll_recalculation' =>
                    false,

                'attendance_generation' =>
                    false,
            ]
        );

        return response()->json([
            'message' =>
                'Leave request submitted for approval.',
        ]);
    }

    public function approveLeaveRequest(
        Request $request,
        int $leaveRequestId,
        ScopeResolver $scopeResolver,
        AuditLogService $auditLogService
    ): JsonResponse {
        return $this->leaveDecision(
            $request,
            $leaveRequestId,
            'approved',
            $scopeResolver,
            $auditLogService
        );
    }

    public function rejectLeaveRequest(
        Request $request,
        int $leaveRequestId,
        ScopeResolver $scopeResolver,
        AuditLogService $auditLogService
    ): JsonResponse {
        return $this->leaveDecision(
            $request,
            $leaveRequestId,
            'rejected',
            $scopeResolver,
            $auditLogService
        );
    }

    private function leaveDecision(
        Request $request,
        int $leaveRequestId,
        string $decision,
        ScopeResolver $scopeResolver,
        AuditLogService $auditLogService
    ): JsonResponse {
        [$tenant, $scope, $branchId] =
            $this->context(
                $request,
                $scopeResolver
            );

        $validated =
            $request->validate([
                'reason' => [
                    $decision === 'rejected'
                        ? 'required'
                        : 'nullable',
                    'string',
                    'max:2000',
                ],
            ]);

        $leave =
            DB::transaction(
                function () use (
                    $request,
                    $tenant,
                    $branchId,
                    $leaveRequestId,
                    $decision,
                    $validated
                ) {
                    $leave =
                        DB::table(
                            'hrm_leave_requests'
                        )
                            ->where(
                                'tenant_id',
                                $tenant->id
                            )
                            ->where(
                                'id',
                                $leaveRequestId
                            )
                            ->lockForUpdate()
                            ->first();

                    if (! $leave) {
                        abort(404);
                    }

                    $this->employee(
                        (int) $tenant->id,
                        (int) $leave->employee_id,
                        $branchId
                    );

                    if (
                        $leave->status
                        !==
                        'submitted'
                    ) {
                        throw ValidationException::withMessages([
                            'status' => [
                                'Only submitted leave requests can be decided.',
                            ],
                        ]);
                    }

                    $this->assertMakerChecker(
                        $request,
                        [
                            $leave->created_by,
                            $leave->submitted_by,
                        ]
                    );

                    $balance =
                        $this->leaveBalanceForRequest(
                            (int) $tenant->id,
                            $leave,
                            true
                        );

                    if (! $balance) {
                        throw ValidationException::withMessages([
                            'balance' => [
                                'The reserved leave balance cannot be found.',
                            ],
                        ]);
                    }

                    $requested =
                        (float)
                        $leave->requested_days;

                    $reserved =
                        max(
                            0,
                            (float)
                            $balance->reserved
                            -
                            $requested
                        );

                    $taken =
                        (float)
                        $balance->taken;

                    if (
                        $decision
                        ===
                        'approved'
                    ) {
                        $taken +=
                            $requested;
                    }

                    $available =
                        (float)
                        $balance->opening_balance
                        +
                        (float)
                        $balance->accrued
                        +
                        (float)
                        $balance->adjustment
                        -
                        $taken
                        -
                        $reserved;

                    DB::table(
                        'hrm_leave_balances'
                    )
                        ->where(
                            'id',
                            $balance->id
                        )
                        ->update([
                            'reserved' =>
                                $reserved,

                            'taken' =>
                                $taken,

                            'closing_balance' =>
                                $available,

                            'updated_at' =>
                                now(),
                        ]);

                    $update = [
                        'status' =>
                            $decision,

                        'updated_at' =>
                            now(),
                    ];

                    if (
                        $decision
                        ===
                        'approved'
                    ) {
                        $update[
                            'approved_by'
                        ] =
                            $request->user()?->id;

                        $update[
                            'approved_at'
                        ] =
                            now();
                    } else {
                        $update[
                            'rejected_by'
                        ] =
                            $request->user()?->id;

                        $update[
                            'rejected_at'
                        ] =
                            now();

                        $update[
                            'rejection_reason'
                        ] =
                            $validated[
                                'reason'
                            ];
                    }

                    DB::table(
                        'hrm_leave_requests'
                    )
                        ->where(
                            'id',
                            $leave->id
                        )
                        ->update(
                            $update
                        );

                    return $leave;
                }
            );

        $this->audit(
            $auditLogService,
            $scope,
            'hrm.leave_request.'
                . $decision,
            (int) $leave->id,
            [
                'employee_id' =>
                    $leave->employee_id,

                'requested_days' =>
                    $leave->requested_days,

                'payroll_recalculation' =>
                    false,

                'attendance_generation' =>
                    false,

                'finance_posting' =>
                    false,
            ]
        );

        return response()->json([
            'message' =>
                'Leave request '
                . $decision
                . '.',
        ]);
    }

    private function context(
        Request $request,
        ScopeResolver $scopeResolver
    ): array {
        $user =
            $request->user();

        if (! $user) {
            abort(401);
        }

        $tenantSlug =
            trim(
                (string)
                $request->header(
                    'X-Tenant-Slug'
                )
            );

        if ($tenantSlug === '') {
            throw ValidationException::withMessages([
                'tenant' => [
                    'Tenant context is required.',
                ],
            ]);
        }

        $tenant =
            Tenant::query()
                ->where(
                    'slug',
                    $tenantSlug
                )
                ->where(
                    'status',
                    'active'
                )
                ->first();

        if (! $tenant) {
            abort(404);
        }

        $scope =
            $scopeResolver
                ->resolveForUser(
                    $user
                );

        if (
            (
                $scope->isTenant()
                ||
                $scope->isBranch()
            )
            &&
            $scope->tenantId !== null
            &&
            (int) $scope->tenantId
                !==
            (int) $tenant->id
        ) {
            abort(403);
        }

        $branchId =
            $scope->isBranch()
                ? $scope->branchId
                : null;

        if ($branchId !== null) {
            $exists =
                Branch::query()
                    ->where(
                        'tenant_id',
                        $tenant->id
                    )
                    ->where(
                        'id',
                        $branchId
                    )
                    ->exists();

            if (! $exists) {
                abort(403);
            }
        }

        return [
            $tenant,
            $scope,
            $branchId,
        ];
    }

    private function resolvedBranch(
        int $tenantId,
        ?int $scopeBranchId,
        mixed $requestedBranchId
    ): ?int {
        if ($scopeBranchId !== null) {
            if (
                $requestedBranchId !== null
                &&
                (int) $requestedBranchId
                    !==
                $scopeBranchId
            ) {
                abort(403);
            }

            return $scopeBranchId;
        }

        if (
            $requestedBranchId === null
            ||
            $requestedBranchId === ''
        ) {
            return null;
        }

        $branchId =
            (int) $requestedBranchId;

        $exists =
            Branch::query()
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->where(
                    'id',
                    $branchId
                )
                ->exists();

        if (! $exists) {
            throw ValidationException::withMessages([
                'branch_id' => [
                    'The selected branch is unavailable.',
                ],
            ]);
        }

        return $branchId;
    }

    private function employee(
        int $tenantId,
        int $employeeId,
        ?int $branchId
    ): object {
        $query =
            Employee::query()
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->where(
                    'id',
                    $employeeId
                );

        $this->scopeEmployeeQuery(
            $query,
            $tenantId,
            $branchId
        );

        $employee =
            $query->first();

        if (! $employee) {
            abort(404);
        }

        return $employee;
    }

    private function employeeIds(
        int $tenantId,
        ?int $branchId
    ) {
        $query =
            Employee::query()
                ->where(
                    'tenant_id',
                    $tenantId
                );

        $this->scopeEmployeeQuery(
            $query,
            $tenantId,
            $branchId
        );

        return $query
            ->pluck('id');
    }

    private function scopeEmployeeQuery(
        $query,
        int $tenantId,
        ?int $branchId
    ): void {
        if ($branchId === null) {
            return;
        }

        $query->where(
            function ($scope) use (
                $tenantId,
                $branchId
            ): void {
                $scope
                    ->where(
                        'home_branch_id',
                        $branchId
                    )
                    ->orWhereIn(
                        'id',
                        DB::table(
                            'hrm_employee_assignments'
                        )
                            ->select(
                                'employee_id'
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
                                'status',
                                'active'
                            )
                    );
            }
        );
    }

    private function shiftTemplateQuery(
        int $tenantId,
        ?int $branchId
    ): Builder {
        return DB::table(
            'hrm_shift_templates'
        )
            ->where(
                'tenant_id',
                $tenantId
            )
            ->when(
                $branchId !== null,
                function (
                    Builder $query
                ) use ($branchId): void {
                    $query->where(
                        function (
                            Builder $branchQuery
                        ) use ($branchId): void {
                            $branchQuery
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
            );
    }

    private function leavePolicyQuery(
        int $tenantId,
        ?int $branchId
    ): Builder {
        return DB::table(
            'hrm_leave_policies'
        )
            ->where(
                'hrm_leave_policies.tenant_id',
                $tenantId
            )
            ->when(
                $branchId !== null,
                function (
                    Builder $query
                ) use ($branchId): void {
                    $query->where(
                        function (
                            Builder $branchQuery
                        ) use ($branchId): void {
                            $branchQuery
                                ->whereNull(
                                    'hrm_leave_policies.branch_id'
                                )
                                ->orWhere(
                                    'hrm_leave_policies.branch_id',
                                    $branchId
                                );
                        }
                    );
                }
            );
    }

    private function attendanceRecord(
        int $tenantId,
        int $attendanceId,
        ?int $branchId
    ): object {
        $record =
            DB::table(
                'hrm_attendance_records'
            )
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->where(
                    'id',
                    $attendanceId
                )
                ->first();

        if (! $record) {
            abort(404);
        }

        $this->employee(
            $tenantId,
            (int) $record->employee_id,
            $branchId
        );

        return $record;
    }

    private function leaveBalanceForRequest(
        int $tenantId,
        object $leave,
        bool $lock = false
    ): ?object {
        $query =
            DB::table(
                'hrm_leave_balances'
            )
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->where(
                    'employee_id',
                    $leave->employee_id
                )
                ->where(
                    'leave_type_id',
                    $leave->leave_type_id
                )
                ->where(
                    'status',
                    'active'
                )
                ->whereDate(
                    'period_start',
                    '<=',
                    $leave->start_date
                )
                ->whereDate(
                    'period_end',
                    '>=',
                    $leave->end_date
                )
                ->orderByDesc(
                    'period_start'
                );

        if ($lock) {
            $query->lockForUpdate();
        }

        return $query->first();
    }

    private function availableBalance(
        object $balance
    ): float {
        return
            (float) $balance->opening_balance
            +
            (float) $balance->accrued
            +
            (float) $balance->adjustment
            -
            (float) $balance->taken
            -
            (float) $balance->reserved;
    }

    private function assertMakerChecker(
        Request $request,
        array $makerIds
    ): void {
        $userId =
            (int) $request->user()->id;

        foreach ($makerIds as $makerId) {
            if (
                (
$makerId !== null
                &&
                (int) $makerId
                    ===
                $userId
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
                        'Maker/checker control requires another authorized user to make this decision.',
                    ],
                ]);
            }
        }
    }

    private function minutesBetween(
        ?string $start,
        ?string $end
    ): ?int {
        if (! $start || ! $end) {
            return null;
        }

        $from =
            Carbon::parse($start);

        $to =
            Carbon::parse($end);

        if ($to->lessThanOrEqualTo($from)) {
            return null;
        }

        return
            $from->diffInMinutes(
                $to
            );
    }

    private function audit(
        AuditLogService $auditLogService,
        $scope,
        string $action,
        int $id,
        array $metadata = []
    ): void {
        $auditLogService->record(
            action: $action,
            scope: $scope,
            metadata: $metadata,
            dataClassification:
                'confidential',
            auditableType:
                'hrm_workforce_operation',
            auditableId:
                $id
        );
    }
}
