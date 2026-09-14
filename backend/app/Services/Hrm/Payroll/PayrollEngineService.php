<?php

namespace App\Services\Hrm\Payroll;

use App\Models\Hrm\CompensationHistory;
use App\Models\Hrm\Employee;
use App\Models\Hrm\PayrollEmployeeStatutoryProfile;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class PayrollEngineService
{
    public const INPUT_COMPONENTS = [
        'benefit_in_kind',
        'cash_allowances',
        'lumpsum_transport',
        'other_medical_deductions',
        'terminal_benefit',
        'retirement_benefits',
        'ejo_heza',
        'other_pension_funds',
        'absence_unpaid_leave',
    ];


    public function overview(
        int $tenantId,
        ?int $branchId
    ): array {
        return [
            'periods' =>
                DB::table(
                    'payroll_periods'
                )
                    ->where(
                        'tenant_id',
                        $tenantId
                    )
                    ->when(
                        $branchId !== null,
                        fn ($query) =>
                            $query->where(
                                'branch_id',
                                $branchId
                            )
                    )
                    ->orderByDesc(
                        'period_year'
                    )
                    ->orderByDesc(
                        'period_month'
                    )
                    ->limit(24)
                    ->get(),

            'runs' =>
                DB::table(
                    'payroll_runs'
                )
                    ->where(
                        'tenant_id',
                        $tenantId
                    )
                    ->when(
                        $branchId !== null,
                        fn ($query) =>
                            $query->where(
                                'branch_id',
                                $branchId
                            )
                    )
                    ->orderByDesc('id')
                    ->limit(50)
                    ->get(),

            'finance_posting_created' =>
                false,
        ];
    }


    public function createPeriod(
        int $tenantId,
        ?int $scopeBranchId,
        int $year,
        int $month,
        ?int $requestedBranchId,
        int $userId
    ): object {
        if (
            $year < 2025
            ||
            $year > 2035
        ) {
            throw ValidationException::withMessages([
                'year' => [
                    'Payroll year must be between 2025 and 2035.',
                ],
            ]);
        }


        if (
            $month < 1
            ||
            $month > 12
        ) {
            throw ValidationException::withMessages([
                'month' => [
                    'Payroll month must be between 1 and 12.',
                ],
            ]);
        }


        $branchId =
            $scopeBranchId
            ?? $requestedBranchId;


        if (
            $scopeBranchId !== null
            &&
            $requestedBranchId !== null
            &&
            $scopeBranchId !== $requestedBranchId
        ) {
            throw ValidationException::withMessages([
                'branch_id' => [
                    'Requested branch is outside your HR scope.',
                ],
            ]);
        }


        $start =
            CarbonImmutable::create(
                $year,
                $month,
                1
            )->startOfMonth();


        $end =
            $start->endOfMonth();


        $existing = DB::table(
            'payroll_periods'
        )
            ->where(
                'tenant_id',
                $tenantId
            )
            ->where(
                'period_year',
                $year
            )
            ->where(
                'period_month',
                $month
            )
            ->where(
                function ($query) use (
                    $branchId
                ) {
                    if (
                        $branchId === null
                    ) {
                        $query->whereNull(
                            'branch_id'
                        );
                    } else {
                        $query->where(
                            'branch_id',
                            $branchId
                        );
                    }
                }
            )
            ->first();


        if ($existing) {
            return $existing;
        }


        $id = DB::table(
            'payroll_periods'
        )->insertGetId([
            'uuid' =>
                (string) Str::uuid(),

            'tenant_id' =>
                $tenantId,

            'branch_id' =>
                $branchId,

            'period_year' =>
                $year,

            'period_month' =>
                $month,

            'starts_on' =>
                $start->toDateString(),

            'ends_on' =>
                $end->toDateString(),

            'status' =>
                'OPEN',

            'created_by' =>
                $userId,

            'created_at' =>
                now(),

            'updated_at' =>
                now(),
        ]);


        return DB::table(
            'payroll_periods'
        )
            ->where(
                'id',
                $id
            )
            ->first();
    }


    public function createRun(
        int $tenantId,
        ?int $scopeBranchId,
        int $periodId,
        int $userId
    ): array {
        return DB::transaction(
            function () use (
                $tenantId,
                $scopeBranchId,
                $periodId,
                $userId
            ) {
                $period =
                    $this->scopedPeriod(
                        $tenantId,
                        $scopeBranchId,
                        $periodId
                    );


                if (
                    $period->status !==
                    'OPEN'
                ) {
                    throw ValidationException::withMessages([
                        'period' => [
                            'Payroll can only be created for an OPEN period.',
                        ],
                    ]);
                }


                $existing = DB::table(
                    'payroll_runs'
                )
                    ->where(
                        'tenant_id',
                        $tenantId
                    )
                    ->where(
                        'payroll_period_id',
                        $period->id
                    )
                    ->where(
                        'revision_no',
                        1
                    )
                    ->first();


                if ($existing) {
                    throw ValidationException::withMessages([
                        'run' => [
                            'A base payroll run for this period already exists.',
                        ],
                    ]);
                }


                $id = DB::table(
                    'payroll_runs'
                )->insertGetId([
                    'uuid' =>
                        (string) Str::uuid(),

                    'tenant_id' =>
                        $tenantId,

                    'branch_id' =>
                        $period->branch_id,

                    'payroll_period_id' =>
                        $period->id,

                    'run_number' =>
                        'PENDING-'
                        . Str::uuid(),

                    'revision_no' =>
                        1,

                    'status' =>
                        'DRAFT',

                    'created_by' =>
                        $userId,

                    'created_at' =>
                        now(),

                    'updated_at' =>
                        now(),
                ]);


                $number = sprintf(
                    'PAY-%04d%02d-R1-%06d',
                    $period->period_year,
                    $period->period_month,
                    $id
                );


                DB::table(
                    'payroll_runs'
                )
                    ->where(
                        'id',
                        $id
                    )
                    ->update([
                        'run_number' =>
                            $number,

                        'updated_at' =>
                            now(),
                    ]);


                $this->approvalAction(
                    $tenantId,
                    $id,
                    'created',
                    null,
                    'DRAFT',
                    $userId,
                    null
                );


                return $this->runDetail(
                    $tenantId,
                    $scopeBranchId,
                    $id
                );
            }
        );
    }


    public function prepareRun(
        int $tenantId,
        ?int $scopeBranchId,
        int $runId,
        int $userId
    ): array {
        return DB::transaction(
            function () use (
                $tenantId,
                $scopeBranchId,
                $runId,
                $userId
            ) {
                $run =
                    $this->scopedRun(
                        $tenantId,
                        $scopeBranchId,
                        $runId
                    );


                if (
                    ! in_array(
                        $run->status,
                        [
                            'DRAFT',
                            'PREPARED',
                        ],
                        true
                    )
                ) {
                    throw ValidationException::withMessages([
                        'run' => [
                            'Only DRAFT or PREPARED payroll can be regenerated.',
                        ],
                    ]);
                }


                $period = DB::table(
                    'payroll_periods'
                )
                    ->where(
                        'id',
                        $run->payroll_period_id
                    )
                    ->where(
                        'tenant_id',
                        $tenantId
                    )
                    ->first();


                if (! $period) {
                    throw ValidationException::withMessages([
                        'period' => [
                            'Payroll period is unavailable.',
                        ],
                    ]);
                }


                $rowIds = DB::table(
                    'payroll_run_employees'
                )
                    ->where(
                        'payroll_run_id',
                        $run->id
                    )
                    ->pluck('id');


                if (
                    $rowIds->isNotEmpty()
                ) {
                    DB::table(
                        'payroll_statutory_lines'
                    )
                        ->whereIn(
                            'payroll_run_employee_id',
                            $rowIds
                        )
                        ->delete();


                    DB::table(
                        'payroll_run_components'
                    )
                        ->whereIn(
                            'payroll_run_employee_id',
                            $rowIds
                        )
                        ->delete();


                    DB::table(
                        'payroll_run_employees'
                    )
                        ->where(
                            'payroll_run_id',
                            $run->id
                        )
                        ->delete();
                }


                $employees =
                    Employee::query()
                        ->where(
                            'tenant_id',
                            $tenantId
                        )
                        ->where(
                            'employment_status',
                            'active'
                        )
                        ->when(
                            $run->branch_id !== null,
                            fn ($query) =>
                                $query->where(
                                    'home_branch_id',
                                    $run->branch_id
                                )
                        )
                        ->orderBy(
                            'employee_number'
                        )
                        ->get();


                foreach (
                    $employees
                    as $employee
                ) {
                    $compensation =
                        CompensationHistory::query()
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
                                'approved'
                            )
                            ->whereDate(
                                'effective_from',
                                '<=',
                                $period->ends_on
                            )
                            ->where(
                                function ($query) use (
                                    $period
                                ) {
                                    $query
                                        ->whereNull(
                                            'effective_to'
                                        )
                                        ->orWhereDate(
                                            'effective_to',
                                            '>=',
                                            $period->starts_on
                                        );
                                }
                            )
                            ->orderByDesc(
                                'effective_from'
                            )
                            ->orderByDesc(
                                'id'
                            )
                            ->first();


                    $profile =
                        PayrollEmployeeStatutoryProfile::query()
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
                            ->first();


                    $profileData =
                        $profile?->statutory_payload
                        ?: [];


                    $profileData[
                        'employee_category'
                    ] =
                        $profile?->employee_category;


                    $basic =
                        $compensation
                        ? (float)
                            $compensation->basic_salary
                        : 0;


                    $fixedGross =
                        $compensation
                        &&
                        $compensation
                            ->fixed_gross_compensation
                            !== null
                        ? (float)
                            $compensation
                                ->fixed_gross_compensation
                        : null;


                    $rowId = DB::table(
                        'payroll_run_employees'
                    )->insertGetId([
                        'uuid' =>
                            (string) Str::uuid(),

                        'tenant_id' =>
                            $tenantId,

                        'payroll_run_id' =>
                            $run->id,

                        'employee_id' =>
                            $employee->id,

                        'compensation_id' =>
                            $compensation?->id,

                        'employee_number' =>
                            $employee
                                ->employee_number,

                        'employee_name' =>
                            trim(
                                $employee
                                    ->first_name
                                . ' '
                                . (
                                    $employee
                                        ->middle_name
                                    ? $employee
                                        ->middle_name
                                        . ' '
                                    : ''
                                )
                                . $employee
                                    ->last_name
                            ),

                        'employment_type' =>
                            $employee
                                ->employment_type,

                        'compensation_snapshot' =>
                            json_encode(
                                $compensation
                                ? [
                                    'id' =>
                                        $compensation->id,

                                    'effective_from' =>
                                        (string)
                                        $compensation
                                            ->effective_from,

                                    'effective_to' =>
                                        $compensation
                                            ->effective_to
                                        ? (string)
                                            $compensation
                                                ->effective_to
                                        : null,

                                    'currency' =>
                                        $compensation
                                            ->currency,

                                    'pay_frequency' =>
                                        $compensation
                                            ->pay_frequency,

                                    'basic_salary' =>
                                        $basic,

                                    'fixed_gross_compensation' =>
                                        $fixedGross,
                                ]
                                : null
                            ),

                        'statutory_snapshot' =>
                            json_encode(
                                $this->maskedProfile(
                                    $profileData
                                )
                            ),

                        'basic_salary' =>
                            $basic,

                        'fixed_gross_compensation' =>
                            $fixedGross,

                        'validation_status' =>
                            'blocked',

                        'validation_flags' =>
                            json_encode([]),

                        'created_at' =>
                            now(),

                        'updated_at' =>
                            now(),
                    ]);


                    foreach (
                        self::INPUT_COMPONENTS
                        as $code
                    ) {
                        DB::table(
                            'payroll_run_components'
                        )->insert([
                            'uuid' =>
                                (string) Str::uuid(),

                            'tenant_id' =>
                                $tenantId,

                            'payroll_run_employee_id' =>
                                $rowId,

                            'code' =>
                                $code,

                            'name' =>
                                $this->componentName(
                                    $code
                                ),

                            'component_type' =>
                                $this->componentType(
                                    $code
                                ),

                            'amount' =>
                                0,

                            'affects_paye' =>
                                in_array(
                                    $code,
                                    [
                                        'benefit_in_kind',
                                        'cash_allowances',
                                        'lumpsum_transport',
                                        'terminal_benefit',
                                        'absence_unpaid_leave',
                                    ],
                                    true
                                ),

                            'affects_pension' =>
                                in_array(
                                    $code,
                                    [
                                        'cash_allowances',
                                        'lumpsum_transport',
                                        'absence_unpaid_leave',
                                    ],
                                    true
                                ),

                            'source_type' =>
                                'manual_review',

                            'created_by' =>
                                $userId,

                            'updated_by' =>
                                $userId,

                            'created_at' =>
                                now(),

                            'updated_at' =>
                                now(),
                        ]);
                    }


                    $this->recalculateEmployee(
                        $tenantId,
                        $rowId,
                        CarbonImmutable::parse(
                            $period->ends_on
                        ),
                        $userId
                    );
                }


                DB::table(
                    'payroll_runs'
                )
                    ->where(
                        'id',
                        $run->id
                    )
                    ->update([
                        'status' =>
                            'PREPARED',

                        'prepared_by' =>
                            $userId,

                        'prepared_at' =>
                            now(),

                        'submitted_by' =>
                            null,

                        'submitted_at' =>
                            null,

                        'updated_at' =>
                            now(),
                    ]);


                $this->refreshRunTotals(
                    $run->id
                );


                $this->approvalAction(
                    $tenantId,
                    $run->id,
                    'prepared',
                    $run->status,
                    'PREPARED',
                    $userId,
                    null
                );


                return $this->runDetail(
                    $tenantId,
                    $scopeBranchId,
                    $run->id
                );
            }
        );
    }


    public function updateEmployeeInputs(
        int $tenantId,
        ?int $scopeBranchId,
        int $runId,
        int $runEmployeeId,
        array $inputs,
        ?string $reviewNotes,
        int $userId
    ): array {
        return DB::transaction(
            function () use (
                $tenantId,
                $scopeBranchId,
                $runId,
                $runEmployeeId,
                $inputs,
                $reviewNotes,
                $userId
            ) {
                $run =
                    $this->scopedRun(
                        $tenantId,
                        $scopeBranchId,
                        $runId
                    );


                if (
                    ! in_array(
                        $run->status,
                        [
                            'DRAFT',
                            'PREPARED',
                        ],
                        true
                    )
                ) {
                    throw ValidationException::withMessages([
                        'run' => [
                            'Payroll inputs are locked once submitted for review.',
                        ],
                    ]);
                }


                $row = DB::table(
                    'payroll_run_employees'
                )
                    ->where(
                        'id',
                        $runEmployeeId
                    )
                    ->where(
                        'tenant_id',
                        $tenantId
                    )
                    ->where(
                        'payroll_run_id',
                        $run->id
                    )
                    ->first();


                if (! $row) {
                    abort(404);
                }


                foreach (
                    self::INPUT_COMPONENTS
                    as $code
                ) {
                    if (
                        ! array_key_exists(
                            $code,
                            $inputs
                        )
                    ) {
                        continue;
                    }


                    $value =
                        (float)
                        $inputs[$code];


                    if (
                        $value < 0
                    ) {
                        throw ValidationException::withMessages([
                            $code => [
                                'Payroll component amounts cannot be negative.',
                            ],
                        ]);
                    }


                    DB::table(
                        'payroll_run_components'
                    )
                        ->where(
                            'payroll_run_employee_id',
                            $row->id
                        )
                        ->where(
                            'code',
                            $code
                        )
                        ->update([
                            'amount' =>
                                $this->money(
                                    $value
                                ),

                            'updated_by' =>
                                $userId,

                            'updated_at' =>
                                now(),
                        ]);
                }


                DB::table(
                    'payroll_run_employees'
                )
                    ->where(
                        'id',
                        $row->id
                    )
                    ->update([
                        'review_notes' =>
                            $reviewNotes,

                        'updated_at' =>
                            now(),
                    ]);


                $period = DB::table(
                    'payroll_periods'
                )
                    ->where(
                        'id',
                        $run
                            ->payroll_period_id
                    )
                    ->first();


                if (! $period) {
                    throw ValidationException::withMessages([
                        'period' => [
                            'Payroll period is unavailable.',
                        ],
                    ]);
                }


                $this->recalculateEmployee(
                    $tenantId,
                    $row->id,
                    CarbonImmutable::parse(
                        $period->ends_on
                    ),
                    $userId
                );


                $this->refreshRunTotals(
                    $run->id
                );


                return $this->runDetail(
                    $tenantId,
                    $scopeBranchId,
                    $run->id
                );
            }
        );
    }


    public function submitRun(
        int $tenantId,
        ?int $scopeBranchId,
        int $runId,
        int $userId,
        ?string $comments
    ): array {
        return DB::transaction(
            function () use (
                $tenantId,
                $scopeBranchId,
                $runId,
                $userId,
                $comments
            ) {
                $run =
                    $this->scopedRun(
                        $tenantId,
                        $scopeBranchId,
                        $runId
                    );


                if (
                    $run->status !==
                    'PREPARED'
                ) {
                    throw ValidationException::withMessages([
                        'run' => [
                            'Only PREPARED payroll can be submitted for review.',
                        ],
                    ]);
                }


                $this->refreshRunTotals(
                    $run->id
                );


                $run = DB::table(
                    'payroll_runs'
                )
                    ->where(
                        'id',
                        $run->id
                    )
                    ->first();


                if (
                    (int)
                    $run->employee_count
                    < 1
                ) {
                    throw ValidationException::withMessages([
                        'run' => [
                            'Payroll has no employee computation rows.',
                        ],
                    ]);
                }


                if (
                    (int)
                    $run->blocked_count
                    > 0
                ) {
                    throw ValidationException::withMessages([
                        'run' => [
                            'Payroll contains blocked employee computations.',
                        ],
                    ]);
                }


                DB::table(
                    'payroll_runs'
                )
                    ->where(
                        'id',
                        $run->id
                    )
                    ->update([
                        'status' =>
                            'UNDER_REVIEW',

                        'submitted_by' =>
                            $userId,

                        'submitted_at' =>
                            now(),

                        'updated_at' =>
                            now(),
                    ]);


                $this->approvalAction(
                    $tenantId,
                    $run->id,
                    'submitted',
                    'PREPARED',
                    'UNDER_REVIEW',
                    $userId,
                    $comments
                );


                return $this->runDetail(
                    $tenantId,
                    $scopeBranchId,
                    $run->id
                );
            }
        );
    }


    public function rejectRun(
        int $tenantId,
        ?int $scopeBranchId,
        int $runId,
        int $userId,
        string $comments
    ): array {
        return DB::transaction(
            function () use (
                $tenantId,
                $scopeBranchId,
                $runId,
                $userId,
                $comments
            ) {
                $run =
                    $this->scopedRun(
                        $tenantId,
                        $scopeBranchId,
                        $runId
                    );


                if (
                    $run->status !==
                    'UNDER_REVIEW'
                ) {
                    throw ValidationException::withMessages([
                        'run' => [
                            'Only payroll under review can be rejected.',
                        ],
                    ]);
                }


                DB::table(
                    'payroll_runs'
                )
                    ->where(
                        'id',
                        $run->id
                    )
                    ->update([
                        'status' =>
                            'PREPARED',

                        'submitted_by' =>
                            null,

                        'submitted_at' =>
                            null,

                        'updated_at' =>
                            now(),
                    ]);


                $this->approvalAction(
                    $tenantId,
                    $run->id,
                    'rejected',
                    'UNDER_REVIEW',
                    'PREPARED',
                    $userId,
                    $comments
                );


                return $this->runDetail(
                    $tenantId,
                    $scopeBranchId,
                    $run->id
                );
            }
        );
    }


    public function approveRun(
        int $tenantId,
        ?int $scopeBranchId,
        int $runId,
        int $userId,
        ?string $comments
    ): array {
        return DB::transaction(
            function () use (
                $tenantId,
                $scopeBranchId,
                $runId,
                $userId,
                $comments
            ) {
                $run =
                    $this->scopedRun(
                        $tenantId,
                        $scopeBranchId,
                        $runId
                    );


                if (
                    $run->status !==
                    'UNDER_REVIEW'
                ) {
                    throw ValidationException::withMessages([
                        'run' => [
                            'Only payroll under review can be approved.',
                        ],
                    ]);
                }


                $makers = array_filter([
                    (int) (
                        $run->created_by
                        ?? 0
                    ),

                    (int) (
                        $run->prepared_by
                        ?? 0
                    ),

                    (int) (
                        $run->submitted_by
                        ?? 0
                    ),
                ]);


                if (
                    (
in_array(
                        $userId,
                        $makers,
                        true
                    )
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
                            'Maker/checker control requires another authorized user '
                            . 'to approve this payroll run.',
                        ],
                    ]);
                }


                $this->refreshRunTotals(
                    $run->id
                );


                $run = DB::table(
                    'payroll_runs'
                )
                    ->where(
                        'id',
                        $run->id
                    )
                    ->first();


                if (
                    (int)
                    $run->blocked_count
                    > 0
                ) {
                    throw ValidationException::withMessages([
                        'run' => [
                            'Blocked employee computations prevent payroll approval.',
                        ],
                    ]);
                }


                DB::table(
                    'payroll_runs'
                )
                    ->where(
                        'id',
                        $run->id
                    )
                    ->update([
                        'status' =>
                            'APPROVED',

                        'approved_by' =>
                            $userId,

                        'approved_at' =>
                            now(),

                        'updated_at' =>
                            now(),
                    ]);


                $this->approvalAction(
                    $tenantId,
                    $run->id,
                    'approved',
                    'UNDER_REVIEW',
                    'APPROVED',
                    $userId,
                    $comments
                );


                return $this->runDetail(
                    $tenantId,
                    $scopeBranchId,
                    $run->id
                );
            }
        );
    }


    public function runDetail(
        int $tenantId,
        ?int $scopeBranchId,
        int $runId
    ): array {
        $run =
            $this->scopedRun(
                $tenantId,
                $scopeBranchId,
                $runId
            );


        $period = DB::table(
            'payroll_periods'
        )
            ->where(
                'tenant_id',
                $tenantId
            )
            ->where(
                'id',
                $run
                    ->payroll_period_id
            )
            ->first();


        $employees = DB::table(
            'payroll_run_employees'
        )
            ->where(
                'tenant_id',
                $tenantId
            )
            ->where(
                'payroll_run_id',
                $run->id
            )
            ->orderBy(
                'employee_number'
            )
            ->get()
            ->map(
                function ($row) {
                    $row->compensation_snapshot =
                        $this->decodeJson(
                            $row
                                ->compensation_snapshot
                        );

                    $row->statutory_snapshot =
                        $this->decodeJson(
                            $row
                                ->statutory_snapshot
                        );

                    $row->validation_flags =
                        $this->decodeJson(
                            $row
                                ->validation_flags
                        );

                    $row->components =
                        DB::table(
                            'payroll_run_components'
                        )
                            ->where(
                                'payroll_run_employee_id',
                                $row->id
                            )
                            ->orderBy(
                                'id'
                            )
                            ->get();

                    $row->statutory_lines =
                        DB::table(
                            'payroll_statutory_lines'
                        )
                            ->where(
                                'payroll_run_employee_id',
                                $row->id
                            )
                            ->orderBy(
                                'code'
                            )
                            ->get();

                    return $row;
                }
            );


        return [
            'run' =>
                $run,

            'period' =>
                $period,

            'employees' =>
                $employees,

            'approval_actions' =>
                DB::table(
                    'payroll_approval_actions'
                )
                    ->where(
                        'tenant_id',
                        $tenantId
                    )
                    ->where(
                        'payroll_run_id',
                        $run->id
                    )
                    ->orderBy('id')
                    ->get(),

            'finance_posting_created' =>
                false,
        ];
    }


    public function calculateAmounts(
        float $basicSalary,
        ?float $fixedGross,
        array $profile,
        array $inputs,
        CarbonImmutable $periodEnd
    ): array {
        $flags = [];


        if (
            $basicSalary <= 0
        ) {
            $flags[] =
                $this->flag(
                    'missing_basic_salary',
                    'blocking',
                    'An approved positive basic salary is required.'
                );
        }


        foreach (
            [
                'rssb_number',
                'identity_type',
                'identity_number',
                'employee_category',
                'paye_employer_type',
            ]
            as $required
        ) {
            $this->requireProfileValue(
                $flags,
                $profile,
                $required
            );
        }


        if (
            ! array_key_exists(
                'rama_member',
                $profile
            )
        ) {
            $flags[] =
                $this->flag(
                    'missing_rama_membership',
                    'blocking',
                    'Confirm whether the employee is a RAMA/RSSB Medical member.'
                );
        }


        $values = [];


        foreach (
            self::INPUT_COMPONENTS
            as $code
        ) {
            $values[$code] =
                max(
                    0,
                    (float)
                    (
                        $inputs[$code]
                        ?? 0
                    )
                );
        }


        $cashBeforeAbsence =
            $basicSalary
            +
            $values['cash_allowances']
            +
            $values['lumpsum_transport']
            +
            $values['terminal_benefit'];


        $absence = min(
            $values[
                'absence_unpaid_leave'
            ],
            $cashBeforeAbsence
        );


        $cashGross =
            max(
                0,
                $cashBeforeAbsence
                -
                $absence
            );


        $grossEmploymentIncome =
            max(
                0,
                $cashGross
                +
                $values[
                    'benefit_in_kind'
                ]
            );


        $contributoryGross =
            max(
                0,
                $basicSalary
                +
                $values[
                    'cash_allowances'
                ]
                +
                $values[
                    'lumpsum_transport'
                ]
                -
                $absence
            );


        if (
            $values[
                'terminal_benefit'
            ]
            > 0
        ) {
            $flags[] =
                $this->flag(
                    'terminal_benefit_review',
                    'warning',
                    'Terminal benefit requires statutory review.'
                );
        }


        if (
            $fixedGross !== null
            &&
            abs(
                $fixedGross
                -
                (
                    $basicSalary
                    +
                    $values[
                        'cash_allowances'
                    ]
                )
            )
            > 0.01
        ) {
            $flags[] =
                $this->flag(
                    'fixed_gross_reconciliation_required',
                    'blocking',
                    'Approved fixed gross does not reconcile with explicit payroll components.'
                );
        }


        $payeTaxableIncome =
            $grossEmploymentIncome;


        $pension =
            $this->rule(
                'PENSION',
                $periodEnd
            );


        $occupational =
            $this->rule(
                'OCCUPATIONAL_HAZARD',
                $periodEnd
            );


        $maternity =
            $this->rule(
                'MATERNITY',
                $periodEnd
            );


        $rama =
            $this->rule(
                'RAMA',
                $periodEnd
            );


        $cbhi =
            $this->rule(
                'CBHI',
                $periodEnd
            );


        $payeRule =
            $this->rule(
                'PAYE',
                $periodEnd
            );


        $employeePension =
            $this->money(
                $contributoryGross
                *
                (float)
                $pension
                    ->employee_rate
            );


        $employerPension =
            $this->money(
                $contributoryGross
                *
                (float)
                $pension
                    ->employer_rate
            );


        $employerOccupational =
            $this->money(
                $contributoryGross
                *
                (float)
                $occupational
                    ->employer_rate
            );


        $employeeMaternity =
            $this->money(
                $contributoryGross
                *
                (float)
                $maternity
                    ->employee_rate
            );


        $employerMaternity =
            $this->money(
                $contributoryGross
                *
                (float)
                $maternity
                    ->employer_rate
            );


        $ramaBase =
            (
                $profile[
                    'rama_member'
                ]
                ?? null
            ) === true
            ? max(
                0,
                $basicSalary
            )
            : 0;


        $employeeRama =
            $this->money(
                $ramaBase
                *
                (float)
                $rama
                    ->employee_rate
            );


        $employerRama =
            $this->money(
                $ramaBase
                *
                (float)
                $rama
                    ->employer_rate
            );


        $paye =
            $this->calculatePaye(
                $payeTaxableIncome,
                $profile,
                $payeRule
            );


        $otherDeductions =
            $values[
                'other_medical_deductions'
            ]
            +
            $values[
                'retirement_benefits'
            ]
            +
            $values[
                'ejo_heza'
            ]
            +
            $values[
                'other_pension_funds'
            ];


        $netBeforeCbhi =
            $this->money(
                max(
                    0,
                    $cashGross
                    -
                    $employeePension
                    -
                    $employeeMaternity
                    -
                    $employeeRama
                    -
                    $paye
                    -
                    $otherDeductions
                )
            );


        $cbhiAmount =
            $this->money(
                $netBeforeCbhi
                *
                (float)
                $cbhi
                    ->employee_rate
            );


        $deductions =
            $this->money(
                $absence
                +
                $employeePension
                +
                $employeeMaternity
                +
                $employeeRama
                +
                $paye
                +
                $otherDeductions
                +
                $cbhiAmount
            );


        $net =
            $this->money(
                max(
                    0,
                    $cashBeforeAbsence
                    -
                    $deductions
                )
            );


        $employerStatutory =
            $this->money(
                $employerPension
                +
                $employerOccupational
                +
                $employerMaternity
                +
                $employerRama
            );


        $employerCost =
            $this->money(
                $cashGross
                +
                $employerStatutory
            );


        $blocking =
            collect(
                $flags
            )->contains(
                fn ($flag) =>
                    $flag[
                        'severity'
                    ]
                    ===
                    'blocking'
            );


        return [
            'amounts' => [
                'cash_gross_pay' =>
                    $this->money(
                        $cashGross
                    ),

                'gross_employment_income' =>
                    $this->money(
                        $grossEmploymentIncome
                    ),

                'absence_unpaid_leave' =>
                    $this->money(
                        $absence
                    ),

                'paye_taxable_income' =>
                    $this->money(
                        $payeTaxableIncome
                    ),

                'pension_base' =>
                    $this->money(
                        $contributoryGross
                    ),

                'employee_pension' =>
                    $employeePension,

                'employer_pension' =>
                    $employerPension,

                'occupational_hazard_base' =>
                    $this->money(
                        $contributoryGross
                    ),

                'employer_occupational_hazard' =>
                    $employerOccupational,

                'maternity_base' =>
                    $this->money(
                        $contributoryGross
                    ),

                'employee_maternity' =>
                    $employeeMaternity,

                'employer_maternity' =>
                    $employerMaternity,

                'rama_base' =>
                    $this->money(
                        $ramaBase
                    ),

                'employee_rama' =>
                    $employeeRama,

                'employer_rama' =>
                    $employerRama,

                'paye' =>
                    $paye,

                'net_before_cbhi' =>
                    $netBeforeCbhi,

                'cbhi' =>
                    $cbhiAmount,

                'total_employee_deductions' =>
                    $deductions,

                'net_salary' =>
                    $net,

                'employer_statutory_contributions' =>
                    $employerStatutory,

                'total_employer_cost' =>
                    $employerCost,
            ],

            'flags' =>
                $flags,

            'validation_status' =>
                $blocking
                ? 'blocked'
                : 'ready',

            'rules' => [
                'PAYE' =>
                    $payeRule,

                'PENSION' =>
                    $pension,

                'OCCUPATIONAL_HAZARD' =>
                    $occupational,

                'MATERNITY' =>
                    $maternity,

                'RAMA' =>
                    $rama,

                'CBHI' =>
                    $cbhi,
            ],
        ];
    }


    private function recalculateEmployee(
        int $tenantId,
        int $rowId,
        CarbonImmutable $periodEnd,
        int $userId
    ): void {
        $row = DB::table(
            'payroll_run_employees'
        )
            ->where(
                'tenant_id',
                $tenantId
            )
            ->where(
                'id',
                $rowId
            )
            ->first();


        if (! $row) {
            abort(404);
        }


        $profile =
            PayrollEmployeeStatutoryProfile::query()
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->where(
                    'employee_id',
                    $row->employee_id
                )
                ->where(
                    'status',
                    'active'
                )
                ->first();


        $profileData =
            $profile
            ? (
                $profile
                    ->statutory_payload
                ?: []
            )
            : [];


        $profileData[
            'employee_category'
        ] =
            $profile
            ? $profile
                ->employee_category
            : null;


        $components = DB::table(
            'payroll_run_components'
        )
            ->where(
                'payroll_run_employee_id',
                $row->id
            )
            ->pluck(
                'amount',
                'code'
            )
            ->map(
                fn ($value) =>
                    (float) $value
            )
            ->all();


        $preFlags = [];


        if (
            $row->compensation_id
            === null
        ) {
            $preFlags[] =
                $this->flag(
                    'missing_approved_compensation',
                    'blocking',
                    'No approved compensation covers this period.'
                );
        }


        $snapshot =
            $this->decodeJson(
                $row
                    ->compensation_snapshot
            );


        if (
            $snapshot
            &&
            strtoupper(
                (string)
                (
                    $snapshot[
                        'currency'
                    ]
                    ?? ''
                )
            )
            !== 'RWF'
        ) {
            $preFlags[] =
                $this->flag(
                    'unsupported_currency',
                    'blocking',
                    'Rwanda payroll R1 requires RWF compensation.'
                );
        }


        if (
            $snapshot
            &&
            strtolower(
                (string)
                (
                    $snapshot[
                        'pay_frequency'
                    ]
                    ?? ''
                )
            )
            !== 'monthly'
        ) {
            $preFlags[] =
                $this->flag(
                    'unsupported_pay_frequency',
                    'blocking',
                    'Payroll R1 requires monthly compensation.'
                );
        }


        $result =
            $this->calculateAmounts(
                (float)
                $row->basic_salary,

                $row
                    ->fixed_gross_compensation
                    !== null
                ? (float)
                    $row
                        ->fixed_gross_compensation
                : null,

                $profileData,

                $components,

                $periodEnd
            );


        $flags =
            array_merge(
                $preFlags,
                $result[
                    'flags'
                ]
            );


        $status =
            collect(
                $flags
            )->contains(
                fn ($flag) =>
                    $flag[
                        'severity'
                    ]
                    ===
                    'blocking'
            )
            ? 'blocked'
            : 'ready';


        DB::table(
            'payroll_run_employees'
        )
            ->where(
                'id',
                $row->id
            )
            ->update(
                array_merge(
                    $result[
                        'amounts'
                    ],
                    [
                        'statutory_snapshot' =>
                            json_encode(
                                $this->maskedProfile(
                                    $profileData
                                )
                            ),

                        'validation_status' =>
                            $status,

                        'validation_flags' =>
                            json_encode(
                                $flags
                            ),

                        'updated_at' =>
                            now(),
                    ]
                )
            );


        DB::table(
            'payroll_statutory_lines'
        )
            ->where(
                'payroll_run_employee_id',
                $row->id
            )
            ->delete();


        foreach (
            $result['rules']
            as $code => $rule
        ) {
            [
                $base,
                $employeeAmount,
                $employerAmount,
            ] =
                $this->statutoryAmountsForCode(
                    $code,
                    $result[
                        'amounts'
                    ]
                );


            DB::table(
                'payroll_statutory_lines'
            )->insert([
                'uuid' =>
                    (string) Str::uuid(),

                'tenant_id' =>
                    $tenantId,

                'payroll_run_employee_id' =>
                    $row->id,

                'rule_version_id' =>
                    $rule->id,

                'code' =>
                    $code,

                'base_amount' =>
                    $base,

                'employee_rate' =>
                    $rule
                        ->employee_rate,

                'employer_rate' =>
                    $rule
                        ->employer_rate,

                'employee_amount' =>
                    $employeeAmount,

                'employer_amount' =>
                    $employerAmount,

                'calculation_snapshot' =>
                    json_encode([
                        'effective_from' =>
                            $rule
                                ->effective_from,

                        'effective_to' =>
                            $rule
                                ->effective_to,

                        'base_code' =>
                            $rule
                                ->base_code,

                        'rounding_rule' =>
                            $rule
                                ->rounding_rule,

                        'source_reference' =>
                            $rule
                                ->source_reference,

                        'finance_posting_created' =>
                            false,
                    ]),

                'created_at' =>
                    now(),

                'updated_at' =>
                    now(),
            ]);
        }
    }


    private function statutoryAmountsForCode(
        string $code,
        array $amounts
    ): array {
        return match ($code) {
            'PAYE' => [
                $amounts[
                    'paye_taxable_income'
                ],
                $amounts[
                    'paye'
                ],
                0,
            ],

            'PENSION' => [
                $amounts[
                    'pension_base'
                ],
                $amounts[
                    'employee_pension'
                ],
                $amounts[
                    'employer_pension'
                ],
            ],

            'OCCUPATIONAL_HAZARD' => [
                $amounts[
                    'occupational_hazard_base'
                ],
                0,
                $amounts[
                    'employer_occupational_hazard'
                ],
            ],

            'MATERNITY' => [
                $amounts[
                    'maternity_base'
                ],
                $amounts[
                    'employee_maternity'
                ],
                $amounts[
                    'employer_maternity'
                ],
            ],

            'RAMA' => [
                $amounts[
                    'rama_base'
                ],
                $amounts[
                    'employee_rama'
                ],
                $amounts[
                    'employer_rama'
                ],
            ],

            'CBHI' => [
                $amounts[
                    'net_before_cbhi'
                ],
                $amounts[
                    'cbhi'
                ],
                0,
            ],

            default => [
                0,
                0,
                0,
            ],
        };
    }


    private function refreshRunTotals(
        int $runId
    ): void {
        $totals = DB::table(
            'payroll_run_employees'
        )
            ->where(
                'payroll_run_id',
                $runId
            )
            ->selectRaw(
                "
                COUNT(*) AS employee_count,

                SUM(
                    CASE
                        WHEN validation_status='blocked'
                        THEN 1
                        ELSE 0
                    END
                ) AS blocked_count,

                COALESCE(
                    SUM(gross_employment_income),
                    0
                ) AS gross,

                COALESCE(
                    SUM(paye),
                    0
                ) AS paye,

                COALESCE(
                    SUM(total_employee_deductions),
                    0
                ) AS deductions,

                COALESCE(
                    SUM(net_salary),
                    0
                ) AS net,

                COALESCE(
                    SUM(employer_statutory_contributions),
                    0
                ) AS employer_contributions,

                COALESCE(
                    SUM(total_employer_cost),
                    0
                ) AS employer_cost
                "
            )
            ->first();


        DB::table(
            'payroll_runs'
        )
            ->where(
                'id',
                $runId
            )
            ->update([
                'employee_count' =>
                    (int)
                    (
                        $totals
                            ->employee_count
                        ?? 0
                    ),

                'blocked_count' =>
                    (int)
                    (
                        $totals
                            ->blocked_count
                        ?? 0
                    ),

                'total_gross_employment_income' =>
                    $this->money(
                        (float)
                        (
                            $totals->gross
                            ?? 0
                        )
                    ),

                'total_paye' =>
                    $this->money(
                        (float)
                        (
                            $totals->paye
                            ?? 0
                        )
                    ),

                'total_employee_deductions' =>
                    $this->money(
                        (float)
                        (
                            $totals->deductions
                            ?? 0
                        )
                    ),

                'total_net_salary' =>
                    $this->money(
                        (float)
                        (
                            $totals->net
                            ?? 0
                        )
                    ),

                'total_employer_contributions' =>
                    $this->money(
                        (float)
                        (
                            $totals
                                ->employer_contributions
                            ?? 0
                        )
                    ),

                'total_employer_cost' =>
                    $this->money(
                        (float)
                        (
                            $totals
                                ->employer_cost
                            ?? 0
                        )
                    ),

                'updated_at' =>
                    now(),
            ]);
    }


    private function calculatePaye(
        float $income,
        array $profile,
        object $rule
    ): float {
        if (
            $income <= 0
        ) {
            return 0;
        }


        $metadata =
            $this->decodeJson(
                $rule
                    ->metadata
            );


        if (
            (
                $profile[
                    'paye_employer_type'
                ]
                ?? null
            )
            ===
            'secondary'
        ) {
            return (float)
                ceil(
                    $income
                    *
                    (float)
                    (
                        $metadata[
                            'secondary_employer_rate'
                        ]
                        ?? 0.30
                    )
                );
        }


        if (
            (
                $profile[
                    'paye_category'
                ]
                ?? 'regular'
            )
            ===
            'casual'
        ) {
            return (float)
                ceil(
                    max(
                        0,
                        $income - 60000
                    )
                    *
                    (float)
                    (
                        $metadata[
                            'casual_worker_rate_above_60000'
                        ]
                        ?? 0.15
                    )
                );
        }


        $tax = 0;


        $tax +=
            max(
                0,
                min(
                    $income,
                    100000
                )
                -
                60000
            )
            *
            0.10;


        $tax +=
            max(
                0,
                min(
                    $income,
                    200000
                )
                -
                100000
            )
            *
            0.20;


        $tax +=
            max(
                0,
                $income - 200000
            )
            *
            0.30;


        return (float)
            ceil(
                $tax
            );
    }


    private function rule(
        string $code,
        CarbonImmutable $date
    ): object {
        $rule = DB::table(
            'payroll_statutory_rule_versions'
        )
            ->where(
                'code',
                $code
            )
            ->where(
                'status',
                'active'
            )
            ->whereDate(
                'effective_from',
                '<=',
                $date
                    ->toDateString()
            )
            ->where(
                function ($query) use (
                    $date
                ) {
                    $query
                        ->whereNull(
                            'effective_to'
                        )
                        ->orWhereDate(
                            'effective_to',
                            '>=',
                            $date
                                ->toDateString()
                        );
                }
            )
            ->orderByDesc(
                'effective_from'
            )
            ->first();


        if (! $rule) {
            throw ValidationException::withMessages([
                'statutory_rule' => [
                    'No statutory rule version covers '
                    . $code
                    . ' for '
                    . $date
                        ->toDateString(),
                ],
            ]);
        }


        return $rule;
    }


    private function scopedPeriod(
        int $tenantId,
        ?int $branchId,
        int $periodId
    ): object {
        $query = DB::table(
            'payroll_periods'
        )
            ->where(
                'id',
                $periodId
            )
            ->where(
                'tenant_id',
                $tenantId
            );


        if (
            $branchId !== null
        ) {
            $query->where(
                'branch_id',
                $branchId
            );
        }


        $period =
            $query->first();


        if (! $period) {
            abort(404);
        }


        return $period;
    }


    private function scopedRun(
        int $tenantId,
        ?int $branchId,
        int $runId
    ): object {
        $query = DB::table(
            'payroll_runs'
        )
            ->where(
                'id',
                $runId
            )
            ->where(
                'tenant_id',
                $tenantId
            );


        if (
            $branchId !== null
        ) {
            $query->where(
                'branch_id',
                $branchId
            );
        }


        $run =
            $query->first();


        if (! $run) {
            abort(404);
        }


        return $run;
    }


    private function approvalAction(
        int $tenantId,
        int $runId,
        string $action,
        ?string $from,
        string $to,
        int $userId,
        ?string $comments
    ): void {
        DB::table(
            'payroll_approval_actions'
        )->insert([
            'uuid' =>
                (string) Str::uuid(),

            'tenant_id' =>
                $tenantId,

            'payroll_run_id' =>
                $runId,

            'action' =>
                $action,

            'from_status' =>
                $from,

            'to_status' =>
                $to,

            'actor_user_id' =>
                $userId,

            'comments' =>
                $comments,

            'metadata' =>
                json_encode([
                    'finance_posting_created' =>
                        false,
                ]),

            'created_at' =>
                now(),

            'updated_at' =>
                now(),
        ]);
    }


    private function requireProfileValue(
        array &$flags,
        array $profile,
        string $key
    ): void {
        $value =
            $profile[$key]
            ?? null;


        if (
            $value === null
            ||
            trim(
                (string) $value
            ) === ''
        ) {
            $flags[] =
                $this->flag(
                    'missing_' . $key,
                    'blocking',
                    'Statutory profile field '
                    . $key
                    . ' must be confirmed.'
                );
        }
    }


    private function maskedProfile(
        array $profile
    ): array {
        return [
            'rssb_number' =>
                $this->mask(
                    $profile[
                        'rssb_number'
                    ]
                    ?? null
                ),

            'identity_type' =>
                $profile[
                    'identity_type'
                ]
                ?? null,

            'identity_number' =>
                $this->mask(
                    $profile[
                        'identity_number'
                    ]
                    ?? null
                ),

            'employee_category' =>
                $profile[
                    'employee_category'
                ]
                ?? null,

            'rama_member' =>
                $profile[
                    'rama_member'
                ]
                ?? null,

            'paye_employer_type' =>
                $profile[
                    'paye_employer_type'
                ]
                ?? null,

            'paye_category' =>
                $profile[
                    'paye_category'
                ]
                ?? 'regular',
        ];
    }


    private function mask(
        mixed $value
    ): ?string {
        if (
            $value === null
            ||
            trim(
                (string) $value
            ) === ''
        ) {
            return null;
        }


        $text =
            trim(
                (string) $value
            );


        if (
            strlen($text) <= 4
        ) {
            return str_repeat(
                '*',
                strlen($text)
            );
        }


        return
            str_repeat(
                '*',
                strlen($text) - 4
            )
            .
            substr(
                $text,
                -4
            );
    }


    private function componentName(
        string $code
    ): string {
        return match ($code) {
            'benefit_in_kind' =>
                'Benefit in Kind',

            'cash_allowances' =>
                'Cash Allowances',

            'lumpsum_transport' =>
                'Lump-sum Transport',

            'other_medical_deductions' =>
                'Other Medical Deductions',

            'terminal_benefit' =>
                'Terminal / Severance Benefit',

            'retirement_benefits' =>
                'Retirement Benefit Deduction',

            'ejo_heza' =>
                'Ejo Heza',

            'other_pension_funds' =>
                'Other Pension Funds',

            'absence_unpaid_leave' =>
                'Absence / Unpaid Leave',

            default =>
                $code,
        };
    }


    private function componentType(
        string $code
    ): string {
        return match ($code) {
            'benefit_in_kind',
            'cash_allowances',
            'lumpsum_transport',
            'terminal_benefit' =>
                'earning',

            default =>
                'deduction',
        };
    }


    private function flag(
        string $code,
        string $severity,
        string $message
    ): array {
        return [
            'code' =>
                $code,

            'severity' =>
                $severity,

            'message' =>
                $message,
        ];
    }


    private function money(
        float $value
    ): float {
        return (float)
            round(
                $value,
                0,
                PHP_ROUND_HALF_UP
            );
    }


    private function decodeJson(
        mixed $value
    ): array {
        if (
            is_array($value)
        ) {
            return $value;
        }


        if (
            $value === null
            ||
            $value === ''
        ) {
            return [];
        }


        $decoded =
            json_decode(
                (string) $value,
                true
            );


        return is_array($decoded)
            ? $decoded
            : [];
    }
}
