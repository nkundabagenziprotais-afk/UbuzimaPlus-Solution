<?php

namespace App\Services\Hrm\Payroll;

use App\Services\Access\ScopeContext;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;

class PayrollClosureService
{
    public const ACTIVE_PAYMENT_STATUSES = [
        'confirmed',
        'reconciled',
    ];

    public const STATUTORY_PAYMENT_TYPES = [
        'paye',
        'pension',
        'occupational_hazard',
        'maternity',
        'rama_medical',
        'cbhi',
        'rssb_combined',
        'unified_paye_rssb',
    ];

    public function __construct(
        private readonly IshemaUnifiedAnnexureWriter $writer
    ) {
    }

    public function run(
        int $tenantId,
        ScopeContext $scope,
        int $runId
    ): object {
        $query =
            DB::table('payroll_runs')
                ->where('tenant_id', $tenantId)
                ->where('id', $runId);

        if ($scope->branchId !== null) {
            $query->where(
                'branch_id',
                $scope->branchId
            );
        }

        $run =
            $query->first();

        abort_unless(
            $run !== null,
            404
        );

        return $run;
    }

    public function compliance(
        int $tenantId,
        ScopeContext $scope,
        int $runId
    ): array {
        $run =
            $this->run(
                $tenantId,
                $scope,
                $runId
            );

        $employees =
            $this->runEmployees(
                $tenantId,
                $run->id
            );

        $employeeIds =
            array_map(
                fn ($row) =>
                    (int) $row->employee_id,
                $employees
            );

        $profileEmployeeIds =
            DB::table(
                'payroll_employee_statutory_profiles'
            )
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->whereIn(
                    'employee_id',
                    $employeeIds ?: [0]
                )
                ->where(
                    'status',
                    'active'
                )
                ->pluck(
                    'employee_id'
                )
                ->map(
                    fn ($value) =>
                        (int) $value
                )
                ->all();

        $profileSet =
            array_fill_keys(
                $profileEmployeeIds,
                true
            );

        $paymentProfileEmployeeIds =
            DB::table(
                'payroll_employee_payment_profiles'
            )
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->whereIn(
                    'employee_id',
                    $employeeIds ?: [0]
                )
                ->where(
                    'status',
                    'active'
                )
                ->pluck(
                    'employee_id'
                )
                ->map(
                    fn ($value) =>
                        (int) $value
                )
                ->all();

        $paymentProfileSet =
            array_fill_keys(
                $paymentProfileEmployeeIds,
                true
            );

        $blockers = [];
        $warnings = [];

        if (count($employees) === 0) {
            $blockers[] =
                $this->issue(
                    'EMPTY_PAYROLL_RUN',
                    'Payroll run has no employee snapshots.',
                    [
                        'approval',
                        'payslip',
                        'ishema',
                        'declaration',
                        'salary_payment',
                        'close',
                    ]
                );
        }

        if (
            (int) $run->blocked_count > 0
        ) {
            $blockers[] =
                $this->issue(
                    'PAYROLL_VALIDATION_BLOCKERS',
                    'Payroll run still contains blocked employee calculations.',
                    [
                        'approval',
                        'ishema',
                        'declaration',
                        'close',
                    ]
                );
        }

        if (
            (int) $run->employee_count
            !==
            count($employees)
        ) {
            $warnings[] =
                $this->issue(
                    'EMPLOYEE_COUNT_MISMATCH',
                    'Stored payroll employee count differs from the employee snapshot count.',
                    [
                        'review',
                    ]
                );
        }

        foreach ($employees as $employee) {
            $snapshot =
                $this->jsonArray(
                    $employee->statutory_snapshot
                    ?? null
                );

            $employeeMeta = [
                'employee_id' =>
                    (int) $employee->employee_id,

                'employee_number' =>
                    (string) $employee->employee_number,

                'employee_name' =>
                    (string) $employee->employee_name,
            ];

            if (
                strtolower(
                    (string) $employee->validation_status
                )
                !==
                'ready'
            ) {
                $blockers[] =
                    $this->issue(
                        'EMPLOYEE_CALCULATION_NOT_READY',
                        'Employee payroll calculation is not ready.',
                        [
                            'approval',
                            'ishema',
                            'declaration',
                            'close',
                        ],
                        $employeeMeta
                    );
            }

            if (
                ! isset(
                    $profileSet[
                        (int) $employee->employee_id
                    ]
                )
            ) {
                $blockers[] =
                    $this->issue(
                        'MISSING_STATUTORY_PROFILE',
                        'Employee statutory profile must be completed before payroll compliance closure.',
                        [
                            'approval',
                            'ishema',
                            'declaration',
                            'close',
                        ],
                        $employeeMeta
                    );
            }

            foreach (
                [
                    'rssb_number' =>
                        'RSSB number',

                    'identity_number' =>
                        'NID or passport',

                    'employee_category' =>
                        'employee category',
                ]
                as $key => $label
            ) {
                if (
                    ! isset($snapshot[$key])
                    ||
                    trim(
                        (string) $snapshot[$key]
                    )
                    === ''
                ) {
                    $blockers[] =
                        $this->issue(
                            'MISSING_'
                            . strtoupper($key),
                            $label
                            . ' is missing from the immutable payroll snapshot.',
                            [
                                'approval',
                                'ishema',
                                'declaration',
                                'close',
                            ],
                            $employeeMeta
                        );
                }
            }

            if (
                ! array_key_exists(
                    'rama_member',
                    $snapshot
                )
            ) {
                $blockers[] =
                    $this->issue(
                        'MISSING_RAMA_CLASSIFICATION',
                        'RAMA membership classification is missing from the immutable payroll snapshot.',
                        [
                            'approval',
                            'ishema',
                            'declaration',
                            'close',
                        ],
                        $employeeMeta
                    );
            }

            if (
                $this->ishemaCategory(
                    $snapshot
                )
                === null
            ) {
                $blockers[] =
                    $this->issue(
                        'UNSUPPORTED_EMPLOYEE_CATEGORY',
                        'Employee category cannot yet be mapped safely to the Ishema unified annexure.',
                        [
                            'ishema',
                            'declaration',
                        ],
                        $employeeMeta
                    );
            }

            if (
                (float) $employee->net_salary > 0
                &&
                ! isset(
                    $paymentProfileSet[
                        (int) $employee->employee_id
                    ]
                )
            ) {
                $blockers[] =
                    $this->issue(
                        'MISSING_PAYMENT_PROFILE',
                        'Employee salary payment profile is missing.',
                        [
                            'salary_payment',
                            'close',
                        ],
                        $employeeMeta
                    );
            }
        }

        if (
            ! in_array(
                strtoupper(
                    (string) $run->status
                ),
                [
                    'PREPARED',
                    'UNDER_REVIEW',
                    'SUBMITTED',
                    'APPROVED',
                    'DECLARED',
                    'PAID',
                    'CLOSED',
                ],
                true
            )
        ) {
            $warnings[] =
                $this->issue(
                    'PAYROLL_STATUS_REVIEW',
                    'Payroll run is outside the controlled B2-C closure lifecycle.',
                    [
                        'review',
                    ]
                );
        }

        $totalChecks =
            max(
                1,
                count($employees) * 6 + 3
            );

        $score =
            max(
                0,
                (int) round(
                    (
                        1
                        -
                        min(
                            count($blockers),
                            $totalChecks
                        )
                        /
                        $totalChecks
                    )
                    *
                    100
                )
            );

        $coverage =
            $this->paymentCoverage(
                $tenantId,
                (int) $run->id
            );

        $acceptedDeclaration =
            $this->acceptedDeclaration(
                $tenantId,
                (int) $run->id
            );

        return [
            'run' => [
                'id' =>
                    (int) $run->id,

                'uuid' =>
                    (string) $run->uuid,

                'run_number' =>
                    (string) $run->run_number,

                'status' =>
                    (string) $run->status,

                'employee_count' =>
                    count($employees),

                'blocked_count' =>
                    (int) $run->blocked_count,
            ],

            'readiness' => [
                'score' =>
                    $score,

                'blocker_count' =>
                    count($blockers),

                'warning_count' =>
                    count($warnings),

                'approval_ready' =>
                    ! $this->hasBlockingIssue(
                        $blockers,
                        'approval'
                    ),

                'payslip_ready' =>
                    ! $this->hasBlockingIssue(
                        $blockers,
                        'payslip'
                    ),

                'ishema_ready' =>
                    ! $this->hasBlockingIssue(
                        $blockers,
                        'ishema'
                    )
                    &&
                    in_array(
                        strtoupper(
                            (string) $run->status
                        ),
                        [
                            'APPROVED',
                            'DECLARED',
                            'PAID',
                            'CLOSED',
                        ],
                        true
                    ),

                'declaration_ready' =>
                    ! $this->hasBlockingIssue(
                        $blockers,
                        'declaration'
                    )
                    &&
                    in_array(
                        strtoupper(
                            (string) $run->status
                        ),
                        [
                            'APPROVED',
                            'DECLARED',
                            'PAID',
                            'CLOSED',
                        ],
                        true
                    ),

                'salary_payment_ready' =>
                    ! $this->hasBlockingIssue(
                        $blockers,
                        'salary_payment'
                    )
                    &&
                    in_array(
                        strtoupper(
                            (string) $run->status
                        ),
                        [
                            'APPROVED',
                            'DECLARED',
                            'PAID',
                            'CLOSED',
                        ],
                        true
                    ),

                'close_ready' =>
                    strtoupper(
                        (string) $run->status
                    )
                    ===
                    'PAID'
                    &&
                    $acceptedDeclaration !== null
                    &&
                    $coverage['complete']
                    &&
                    ! $this->hasBlockingIssue(
                        $blockers,
                        'close'
                    ),
            ],

            'blockers' =>
                $blockers,

            'warnings' =>
                $warnings,

            'payment_coverage' =>
                $coverage,

            'accepted_declaration' =>
                $acceptedDeclaration
                    ? [
                        'id' =>
                            (int) $acceptedDeclaration->id,

                        'reference_number' =>
                            $acceptedDeclaration->reference_number,

                        'accepted_at' =>
                            $acceptedDeclaration->accepted_at,
                    ]
                    : null,

            'statutory_rule_disclosure' =>
                $this->statutoryRuleDisclosure(
                    $tenantId,
                    (int) $run->id
                ),
        ];
    }

    public function closureOverview(
        int $tenantId,
        ScopeContext $scope,
        int $runId
    ): array {
        $run =
            $this->run(
                $tenantId,
                $scope,
                $runId
            );

        $exports =
            DB::table('payroll_exports')
                ->where('tenant_id', $tenantId)
                ->where('payroll_run_id', $run->id)
                ->orderByDesc('id')
                ->get()
                ->map(
                    fn ($row) => [
                        'id' =>
                            (int) $row->id,

                        'uuid' =>
                            (string) $row->uuid,

                        'export_type' =>
                            (string) $row->export_type,

                        'template_code' =>
                            (string) $row->template_code,

                        'template_version' =>
                            (string) $row->template_version,

                        'file_name' =>
                            (string) $row->file_name,

                        'checksum_sha256' =>
                            (string) $row->checksum_sha256,

                        'row_count' =>
                            (int) $row->row_count,

                        'status' =>
                            (string) $row->status,

                        'generated_at' =>
                            $row->generated_at,
                    ]
                )
                ->values()
                ->all();

        $declarations =
            DB::table('payroll_declarations')
                ->where('tenant_id', $tenantId)
                ->where('payroll_run_id', $run->id)
                ->orderByDesc('id')
                ->get()
                ->map(
                    fn ($row) => [
                        'id' =>
                            (int) $row->id,

                        'uuid' =>
                            (string) $row->uuid,

                        'authority' =>
                            (string) $row->authority,

                        'declaration_type' =>
                            (string) $row->declaration_type,

                        'submission_channel' =>
                            (string) $row->submission_channel,

                        'period_year' =>
                            (int) $row->period_year,

                        'period_month' =>
                            (int) $row->period_month,

                        'due_date' =>
                            $row->due_date,

                        'status' =>
                            (string) $row->status,

                        'reference_number' =>
                            $row->reference_number,

                        'amounts' =>
                            $this->jsonArray(
                                $row->amounts_payload
                            ),

                        'submitted_at' =>
                            $row->submitted_at,

                        'accepted_at' =>
                            $row->accepted_at,

                        'notes' =>
                            $row->notes,
                    ]
                )
                ->values()
                ->all();

        $payments =
            DB::table('payroll_payments')
                ->where('tenant_id', $tenantId)
                ->where('payroll_run_id', $run->id)
                ->orderByDesc('id')
                ->get()
                ->map(
                    fn ($row) => [
                        'id' =>
                            (int) $row->id,

                        'uuid' =>
                            (string) $row->uuid,

                        'payment_type' =>
                            (string) $row->payment_type,

                        'amount' =>
                            (float) $row->amount,

                        'payment_method' =>
                            (string) $row->payment_method,

                        'reference_number' =>
                            $row->reference_number,

                        'paid_at' =>
                            $row->paid_at,

                        'status' =>
                            (string) $row->status,

                        'reconciled_at' =>
                            $row->reconciled_at,

                        'notes' =>
                            $row->notes,
                    ]
                )
                ->values()
                ->all();

        return [
            'compliance' =>
                $this->compliance(
                    $tenantId,
                    $scope,
                    $runId
                ),

            'exports' =>
                $exports,

            'declarations' =>
                $declarations,

            'payments' =>
                $payments,

            'finance_posting_created' =>
                false,
        ];
    }

    public function payslips(
        int $tenantId,
        ScopeContext $scope,
        int $runId
    ): array {
        $run =
            $this->run(
                $tenantId,
                $scope,
                $runId
            );

        $employees =
            $this->runEmployees(
                $tenantId,
                (int) $run->id
            );

        return [
            'run' => [
                'id' =>
                    (int) $run->id,

                'run_number' =>
                    (string) $run->run_number,

                'status' =>
                    (string) $run->status,
            ],

            'payslips' =>
                array_map(
                    function ($employee) use (
                        $tenantId
                    ): array {
                        $components =
                            DB::table(
                                'payroll_run_components'
                            )
                                ->where(
                                    'tenant_id',
                                    $tenantId
                                )
                                ->where(
                                    'payroll_run_employee_id',
                                    $employee->id
                                )
                                ->orderBy('id')
                                ->get()
                                ->map(
                                    fn ($row) => [
                                        'code' =>
                                            (string) $row->code,

                                        'name' =>
                                            (string) $row->name,

                                        'component_type' =>
                                            (string) $row->component_type,

                                        'amount' =>
                                            (float) $row->amount,
                                    ]
                                )
                                ->values()
                                ->all();

                        $statutory =
                            DB::table(
                                'payroll_statutory_lines'
                            )
                                ->where(
                                    'tenant_id',
                                    $tenantId
                                )
                                ->where(
                                    'payroll_run_employee_id',
                                    $employee->id
                                )
                                ->orderBy('id')
                                ->get()
                                ->map(
                                    fn ($row) => [
                                        'code' =>
                                            (string) $row->code,

                                        'base_amount' =>
                                            (float) $row->base_amount,

                                        'employee_amount' =>
                                            (float) $row->employee_amount,

                                        'employer_amount' =>
                                            (float) $row->employer_amount,
                                    ]
                                )
                                ->values()
                                ->all();

                        return [
                            'run_employee_id' =>
                                (int) $employee->id,

                            'employee_id' =>
                                (int) $employee->employee_id,

                            'employee_number' =>
                                (string) $employee->employee_number,

                            'employee_name' =>
                                (string) $employee->employee_name,

                            'basic_salary' =>
                                (float) $employee->basic_salary,

                            'gross_employment_income' =>
                                (float) $employee->gross_employment_income,

                            'paye' =>
                                (float) $employee->paye,

                            'total_employee_deductions' =>
                                (float) $employee->total_employee_deductions,

                            'net_salary' =>
                                (float) $employee->net_salary,

                            'employer_statutory_contributions' =>
                                (float) $employee->employer_statutory_contributions,

                            'total_employer_cost' =>
                                (float) $employee->total_employer_cost,

                            'components' =>
                                $components,

                            'statutory_lines' =>
                                $statutory,
                        ];
                    },
                    $employees
                ),
        ];
    }

    public function generateIshema(
        int $tenantId,
        ScopeContext $scope,
        int $runId,
        int $userId
    ): array {
        $run =
            $this->run(
                $tenantId,
                $scope,
                $runId
            );

        $compliance =
            $this->compliance(
                $tenantId,
                $scope,
                $runId
            );

        abort_unless(
            $compliance['readiness']['ishema_ready'],
            422,
            'Payroll is not ready for Ishema export. Resolve the compliance blockers first.'
        );

        $employees =
            $this->runEmployees(
                $tenantId,
                (int) $run->id
            );

        $employeeIds =
            array_map(
                fn ($employee) =>
                    (int) $employee->employee_id,
                $employees
            );

        $directoryRows =
            DB::table('hrm_employees')
                ->where('tenant_id', $tenantId)
                ->whereIn(
                    'id',
                    $employeeIds ?: [0]
                )
                ->get([
                    'id',
                    'first_name',
                    'middle_name',
                    'last_name',
                ])
                ->keyBy('id');

        $rows = [];

        foreach ($employees as $employee) {
            $snapshot =
                $this->jsonArray(
                    $employee->statutory_snapshot
                    ?? null
                );

            $directory =
                $directoryRows[
                    (int) $employee->employee_id
                ]
                ?? null;

            abort_unless(
                $directory !== null,
                422,
                'Employee directory data is missing for an Ishema export row.'
            );

            $category =
                $this->ishemaCategory(
                    $snapshot
                );

            abort_unless(
                $category !== null,
                422,
                'An employee category cannot be mapped to Ishema.'
            );

            $componentAmounts =
                $this->componentAmounts(
                    $tenantId,
                    (int) $employee->id
                );

            $rows[] = [
                'Family Name' =>
                    trim(
                        (string) $directory->last_name
                    ),

                'Another name' =>
                    trim(
                        implode(
                            ' ',
                            array_filter([
                                $directory->first_name,
                                $directory->middle_name,
                            ])
                        )
                    ),

                'RSSB Number' =>
                    trim(
                        (string) (
                            $snapshot['rssb_number']
                            ?? ''
                        )
                    ),

                'NID or Passport' =>
                    trim(
                        (string) (
                            $snapshot['identity_number']
                            ?? ''
                        )
                    ),

                'Employee Category' =>
                    $category,

                'Is Employee A Rama Member?' =>
                    $this->yesNo(
                        $snapshot['rama_member']
                        ?? false
                    ),

                'Employee Pays Pension?' =>
                    $this->yesNo(
                        (
                            (float) $employee->employee_pension
                            +
                            (float) $employee->employer_pension
                        )
                        > 0
                    ),

                'Employee Pays Mat Leave?' =>
                    $this->yesNo(
                        (
                            (float) $employee->employee_maternity
                            +
                            (float) $employee->employer_maternity
                        )
                        > 0
                    ),

                'Employee Pays CBHI?' =>
                    $this->yesNo(
                        (float) $employee->cbhi > 0
                    ),

                'Basic Salary' =>
                    (float) $employee->basic_salary,

                'Benefit in Kind Transport' =>
                    $this->component(
                        $componentAmounts,
                        [
                            'transport_benefit_in_kind',
                            'benefit_in_kind_transport',
                            'transport_benefit',
                        ]
                    ),

                'Benefit in Kind House' =>
                    $this->component(
                        $componentAmounts,
                        [
                            'house_benefit_in_kind',
                            'benefit_in_kind_house',
                            'house_benefit',
                        ]
                    ),

                'Benefit in Kind Others' =>
                    $this->component(
                        $componentAmounts,
                        [
                            'other_benefit_in_kind',
                            'benefit_in_kind_others',
                            'other_benefit',
                        ]
                    ),

                'Lump sum Transport' =>
                    $this->component(
                        $componentAmounts,
                        [
                            'lumpsum_transport',
                            'lump_sum_transport',
                            'transport_lumpsum',
                        ]
                    ),

                'Other Medical Deductions' =>
                    $this->component(
                        $componentAmounts,
                        [
                            'other_medical_deductions',
                            'medical_deductions',
                        ]
                    ),

                'Terminal Benefit End Contract' =>
                    $this->component(
                        $componentAmounts,
                        [
                            'terminal_benefit',
                            'terminal_benefit_end_contract',
                        ]
                    ),

                'Retirement Benefits' =>
                    $this->component(
                        $componentAmounts,
                        [
                            'retirement_benefits',
                            'retirement_benefit',
                        ]
                    ),

                'Ejo-Heza Contribution' =>
                    $this->component(
                        $componentAmounts,
                        [
                            'ejo_heza',
                            'ejoheza',
                            'ejo_heza_contribution',
                        ]
                    ),

                'Other Pension Funds' =>
                    $this->component(
                        $componentAmounts,
                        [
                            'other_pension_funds',
                            'other_pension_fund',
                        ]
                    ),
            ];
        }

        $stamp =
            now()
                ->timezone('Africa/Kigali')
                ->format('Ymd-His');

        $safeRun =
            preg_replace(
                '/[^A-Za-z0-9_-]+/',
                '-',
                (string) $run->run_number
            );

        $fileName =
            'Ishema-Unified-Annexure-'
            . trim(
                (string) $safeRun,
                '-'
            )
            . '-'
            . $stamp
            . '.xlsx';

        $storagePath =
            'hrm/payroll/ishema/'
            . $tenantId
            . '/'
            . $run->uuid
            . '/'
            . $fileName;

        $absolutePath =
            Storage::disk('local')
                ->path(
                    $storagePath
                );

        $this->writer->write(
            $absolutePath,
            $rows
        );

        $checksum =
            hash_file(
                'sha256',
                $absolutePath
            );

        abort_unless(
            is_string($checksum)
            &&
            strlen($checksum) === 64,
            500,
            'Unable to checksum generated Ishema workbook.'
        );

        $exportId =
            DB::table('payroll_exports')
                ->insertGetId([
                    'uuid' =>
                        (string) Str::uuid(),

                    'tenant_id' =>
                        $tenantId,

                    'payroll_run_id' =>
                        (int) $run->id,

                    'export_type' =>
                        'ISHEMA_UNIFIED_ANNEXURE',

                    'template_code' =>
                        IshemaUnifiedAnnexureWriter::TEMPLATE_CODE,

                    'template_version' =>
                        IshemaUnifiedAnnexureWriter::TEMPLATE_VERSION,

                    'file_name' =>
                        $fileName,

                    'disk' =>
                        'local',

                    'storage_path' =>
                        $storagePath,

                    'mime_type' =>
                        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',

                    'checksum_sha256' =>
                        $checksum,

                    'row_count' =>
                        count($rows),

                    'status' =>
                        'generated',

                    'generated_by' =>
                        $userId,

                    'generated_at' =>
                        now(),

                    'metadata' =>
                        json_encode(
                            [
                                'source' =>
                                    'hrm_b2c_commercial_closure_r1',

                                'official_column_basis' =>
                                    'RRA Tax Handbook 2025 Unified Annexures',

                                'portal_acceptance' =>
                                    'requires_test_uat',

                                'finance_posting' =>
                                    'not_created',
                            ],
                            JSON_THROW_ON_ERROR
                        ),

                    'created_at' =>
                        now(),

                    'updated_at' =>
                        now(),
                ]);

        return [
            'export' =>
                $this->exportRecord(
                    $tenantId,
                    (int) $exportId
                ),

            'finance_posting_created' =>
                false,
        ];
    }

    public function exportRecord(
        int $tenantId,
        int $exportId
    ): object {
        $export =
            DB::table('payroll_exports')
                ->where('tenant_id', $tenantId)
                ->where('id', $exportId)
                ->first();

        abort_unless(
            $export !== null,
            404
        );

        return $export;
    }

    public function recordDeclaration(
        int $tenantId,
        ScopeContext $scope,
        int $runId,
        int $userId,
        array $data
    ): array {
        $run =
            $this->run(
                $tenantId,
                $scope,
                $runId
            );

        $compliance =
            $this->compliance(
                $tenantId,
                $scope,
                $runId
            );

        abort_unless(
            $compliance['readiness']['declaration_ready'],
            422,
            'Payroll is not ready for declaration.'
        );

        $exportExists =
            DB::table('payroll_exports')
                ->where('tenant_id', $tenantId)
                ->where('payroll_run_id', $run->id)
                ->where(
                    'export_type',
                    'ISHEMA_UNIFIED_ANNEXURE'
                )
                ->where(
                    'status',
                    'generated'
                )
                ->exists();

        abort_unless(
            $exportExists,
            422,
            'Generate the Ishema unified annexure before registering the declaration.'
        );

        $period =
            DB::table('payroll_periods')
                ->where('tenant_id', $tenantId)
                ->where(
                    'id',
                    $run->payroll_period_id
                )
                ->first();

        abort_unless(
            $period !== null,
            422,
            'Payroll period could not be resolved.'
        );

        $status =
            strtolower(
                (string) $data['status']
            );

        $dueDate =
            CarbonImmutable::create(
                (int) $period->period_year,
                (int) $period->period_month,
                1,
                0,
                0,
                0,
                'Africa/Kigali'
            )
                ->addMonth()
                ->day(15)
                ->toDateString();

        $amounts = [
            'paye' =>
                (float) (
                    $data['paye']
                    ?? 0
                ),

            'pension' =>
                (float) (
                    $data['pension']
                    ?? 0
                ),

            'occupational_hazard' =>
                (float) (
                    $data['occupational_hazard']
                    ?? 0
                ),

            'maternity' =>
                (float) (
                    $data['maternity']
                    ?? 0
                ),

            'rama_medical' =>
                (float) (
                    $data['rama_medical']
                    ?? 0
                ),

            'cbhi' =>
                (float) (
                    $data['cbhi']
                    ?? 0
                ),
        ];

        $declarationId =
            DB::transaction(
                function () use (
                    $tenantId,
                    $run,
                    $period,
                    $dueDate,
                    $status,
                    $amounts,
                    $data,
                    $userId
                ): int {
                    $id =
                        DB::table(
                            'payroll_declarations'
                        )
                            ->insertGetId([
                                'uuid' =>
                                    (string) Str::uuid(),

                                'tenant_id' =>
                                    $tenantId,

                                'payroll_run_id' =>
                                    (int) $run->id,

                                'authority' =>
                                    'RRA_RSSB',

                                'declaration_type' =>
                                    'UNIFIED_PAYE_RSSB',

                                'submission_channel' =>
                                    strtoupper(
                                        (string) (
                                            $data['submission_channel']
                                            ?? 'ISHEMA'
                                        )
                                    ),

                                'period_year' =>
                                    (int) $period->period_year,

                                'period_month' =>
                                    (int) $period->period_month,

                                'due_date' =>
                                    $dueDate,

                                'status' =>
                                    $status,

                                'reference_number' =>
                                    $data['reference_number']
                                    ?? null,

                                'amounts_payload' =>
                                    json_encode(
                                        $amounts,
                                        JSON_THROW_ON_ERROR
                                    ),

                                'submitted_by' =>
                                    $userId,

                                'submitted_at' =>
                                    $data['submitted_at']
                                    ?? now(),

                                'accepted_by' =>
                                    $status === 'accepted'
                                        ? $userId
                                        : null,

                                'accepted_at' =>
                                    $status === 'accepted'
                                        ? now()
                                        : null,

                                'notes' =>
                                    $data['notes']
                                    ?? null,

                                'metadata' =>
                                    json_encode(
                                        [
                                            'source' =>
                                                'hrm_b2c_commercial_closure_r1',

                                            'finance_posting' =>
                                                'not_created',
                                        ],
                                        JSON_THROW_ON_ERROR
                                    ),

                                'created_at' =>
                                    now(),

                                'updated_at' =>
                                    now(),
                            ]);

                    if (
                        $status === 'accepted'
                        &&
                        strtoupper(
                            (string) $run->status
                        )
                        ===
                        'APPROVED'
                    ) {
                        DB::table('payroll_runs')
                            ->where(
                                'tenant_id',
                                $tenantId
                            )
                            ->where(
                                'id',
                                $run->id
                            )
                            ->update([
                                'status' =>
                                    'DECLARED',

                                'updated_at' =>
                                    now(),
                            ]);
                    }

                    return (int) $id;
                }
            );

        return [
            'declaration' =>
                DB::table('payroll_declarations')
                    ->where(
                        'tenant_id',
                        $tenantId
                    )
                    ->where(
                        'id',
                        $declarationId
                    )
                    ->first(),

            'finance_posting_created' =>
                false,
        ];
    }

    public function recordPayment(
        int $tenantId,
        ScopeContext $scope,
        int $runId,
        int $userId,
        array $data
    ): array {
        $run =
            $this->run(
                $tenantId,
                $scope,
                $runId
            );

        $paymentType =
            strtolower(
                (string) $data['payment_type']
            );

        abort_unless(
            in_array(
                strtoupper(
                    (string) $run->status
                ),
                [
                    'APPROVED',
                    'DECLARED',
                    'PAID',
                ],
                true
            ),
            422,
            'Payments can only be registered after payroll approval.'
        );

        if (
            $paymentType === 'salary'
        ) {
            $compliance =
                $this->compliance(
                    $tenantId,
                    $scope,
                    $runId
                );

            abort_unless(
                $compliance[
                    'readiness'
                ][
                    'salary_payment_ready'
                ],
                422,
                'Salary payment profiles are incomplete.'
            );
        }

        if (
            in_array(
                $paymentType,
                self::STATUTORY_PAYMENT_TYPES,
                true
            )
        ) {
            abort_unless(
                $this->acceptedDeclaration(
                    $tenantId,
                    (int) $run->id
                )
                !== null,
                422,
                'An accepted payroll declaration is required before statutory payment tracking.'
            );
        }

        $paymentId =
            DB::transaction(
                function () use (
                    $tenantId,
                    $run,
                    $paymentType,
                    $data,
                    $userId
                ): int {
                    $id =
                        DB::table('payroll_payments')
                            ->insertGetId([
                                'uuid' =>
                                    (string) Str::uuid(),

                                'tenant_id' =>
                                    $tenantId,

                                'payroll_run_id' =>
                                    (int) $run->id,

                                'payment_type' =>
                                    $paymentType,

                                'amount' =>
                                    (float) $data['amount'],

                                'payment_method' =>
                                    strtolower(
                                        (string) $data[
                                            'payment_method'
                                        ]
                                    ),

                                'reference_number' =>
                                    $data['reference_number']
                                    ?? null,

                                'paid_at' =>
                                    $data['paid_at']
                                    ?? now(),

                                'status' =>
                                    strtolower(
                                        (string) (
                                            $data['status']
                                            ?? 'confirmed'
                                        )
                                    ),

                                'notes' =>
                                    $data['notes']
                                    ?? null,

                                'metadata' =>
                                    json_encode(
                                        [
                                            'source' =>
                                                'hrm_b2c_commercial_closure_r1',

                                            'finance_posting' =>
                                                'not_created',
                                        ],
                                        JSON_THROW_ON_ERROR
                                    ),

                                'created_by' =>
                                    $userId,

                                'updated_by' =>
                                    $userId,

                                'created_at' =>
                                    now(),

                                'updated_at' =>
                                    now(),
                            ]);

                    return (int) $id;
                }
            );

        $coverage =
            $this->paymentCoverage(
                $tenantId,
                (int) $run->id
            );

        if (
            $coverage['complete']
            &&
            $this->acceptedDeclaration(
                $tenantId,
                (int) $run->id
            )
            !== null
        ) {
            DB::table('payroll_runs')
                ->where('tenant_id', $tenantId)
                ->where('id', $run->id)
                ->whereIn(
                    'status',
                    [
                        'APPROVED',
                        'DECLARED',
                    ]
                )
                ->update([
                    'status' =>
                        'PAID',

                    'updated_at' =>
                        now(),
                ]);
        }

        return [
            'payment' =>
                DB::table('payroll_payments')
                    ->where(
                        'tenant_id',
                        $tenantId
                    )
                    ->where(
                        'id',
                        $paymentId
                    )
                    ->first(),

            'coverage' =>
                $this->paymentCoverage(
                    $tenantId,
                    (int) $run->id
                ),

            'finance_posting_created' =>
                false,
        ];
    }

    public function reconcilePayment(
        int $tenantId,
        ScopeContext $scope,
        int $runId,
        int $paymentId,
        int $userId
    ): object {
        $run =
            $this->run(
                $tenantId,
                $scope,
                $runId
            );

        $payment =
            DB::table('payroll_payments')
                ->where('tenant_id', $tenantId)
                ->where('payroll_run_id', $run->id)
                ->where('id', $paymentId)
                ->first();

        abort_unless(
            $payment !== null,
            404
        );

        abort_unless(
            strtolower(
                (string) $payment->status
            )
            !==
            'void',
            422,
            'Voided payment cannot be reconciled.'
        );

        DB::table('payroll_payments')
            ->where('tenant_id', $tenantId)
            ->where('id', $paymentId)
            ->update([
                'status' =>
                    'reconciled',

                'reconciled_by' =>
                    $userId,

                'reconciled_at' =>
                    now(),

                'updated_by' =>
                    $userId,

                'updated_at' =>
                    now(),
            ]);

        return
            DB::table('payroll_payments')
                ->where('tenant_id', $tenantId)
                ->where('id', $paymentId)
                ->first();
    }

    public function close(
        int $tenantId,
        ScopeContext $scope,
        int $runId,
        int $userId
    ): array {
        $run =
            $this->run(
                $tenantId,
                $scope,
                $runId
            );

        $compliance =
            $this->compliance(
                $tenantId,
                $scope,
                $runId
            );

        abort_unless(
            $compliance['readiness']['close_ready'],
            422,
            'Payroll cannot be closed until all compliance, declaration, salary and statutory payment controls are complete.'
        );

        DB::transaction(
            function () use (
                $tenantId,
                $run,
                $userId
            ): void {
                $updated =
                    DB::table('payroll_runs')
                        ->where(
                            'tenant_id',
                            $tenantId
                        )
                        ->where(
                            'id',
                            $run->id
                        )
                        ->where(
                            'status',
                            'PAID'
                        )
                        ->update([
                            'status' =>
                                'CLOSED',

                            'metadata' =>
                                $this->mergeJson(
                                    $run->metadata
                                    ?? null,
                                    [
                                        'closure' => [
                                            'closed_by' =>
                                                $userId,

                                            'closed_at' =>
                                                now()
                                                    ->toIso8601String(),

                                            'finance_posting' =>
                                                'not_created',
                                        ],
                                    ]
                                ),

                            'updated_at' =>
                                now(),
                        ]);

                abort_unless(
                    $updated === 1,
                    409,
                    'Payroll run changed before close could be completed.'
                );

                $openRunExists =
                    DB::table('payroll_runs')
                        ->where(
                            'tenant_id',
                            $tenantId
                        )
                        ->where(
                            'payroll_period_id',
                            $run->payroll_period_id
                        )
                        ->whereNotIn(
                            'status',
                            [
                                'CLOSED',
                                'REJECTED',
                            ]
                        )
                        ->exists();

                if (! $openRunExists) {
                    DB::table('payroll_periods')
                        ->where(
                            'tenant_id',
                            $tenantId
                        )
                        ->where(
                            'id',
                            $run->payroll_period_id
                        )
                        ->update([
                            'status' =>
                                'CLOSED',

                            'closed_by' =>
                                $userId,

                            'closed_at' =>
                                now(),

                            'updated_at' =>
                                now(),
                        ]);
                }
            }
        );

        return [
            'run' =>
                DB::table('payroll_runs')
                    ->where(
                        'tenant_id',
                        $tenantId
                    )
                    ->where(
                        'id',
                        $run->id
                    )
                    ->first(),

            'finance_posting_created' =>
                false,

            'correction_policy' =>
                'Create a revision, adjustment or reversal. Closed payroll snapshots are not recalculated silently.',
        ];
    }

    public function paymentCoverage(
        int $tenantId,
        int $runId
    ): array {
        $totals =
            DB::table('payroll_run_employees')
                ->where('tenant_id', $tenantId)
                ->where('payroll_run_id', $runId)
                ->selectRaw(
                    '
                    COALESCE(SUM(net_salary), 0) AS salary,
                    COALESCE(SUM(paye), 0) AS paye,
                    COALESCE(SUM(employee_pension + employer_pension), 0) AS pension,
                    COALESCE(SUM(employer_occupational_hazard), 0) AS occupational_hazard,
                    COALESCE(SUM(employee_maternity + employer_maternity), 0) AS maternity,
                    COALESCE(SUM(employee_rama + employer_rama), 0) AS rama_medical,
                    COALESCE(SUM(cbhi), 0) AS cbhi
                    '
                )
                ->first();

        $expected = [
            'salary' =>
                (float) ($totals->salary ?? 0),

            'paye' =>
                (float) ($totals->paye ?? 0),

            'pension' =>
                (float) ($totals->pension ?? 0),

            'occupational_hazard' =>
                (float) (
                    $totals->occupational_hazard
                    ?? 0
                ),

            'maternity' =>
                (float) ($totals->maternity ?? 0),

            'rama_medical' =>
                (float) ($totals->rama_medical ?? 0),

            'cbhi' =>
                (float) ($totals->cbhi ?? 0),
        ];

        $rows =
            DB::table('payroll_payments')
                ->where('tenant_id', $tenantId)
                ->where('payroll_run_id', $runId)
                ->whereIn(
                    'status',
                    self::ACTIVE_PAYMENT_STATUSES
                )
                ->get([
                    'payment_type',
                    'amount',
                ]);

        $paid = [
            'salary' => 0.0,
            'paye' => 0.0,
            'pension' => 0.0,
            'occupational_hazard' => 0.0,
            'maternity' => 0.0,
            'rama_medical' => 0.0,
            'cbhi' => 0.0,
            'rssb_combined' => 0.0,
            'unified_paye_rssb' => 0.0,
        ];

        foreach ($rows as $row) {
            $type =
                strtolower(
                    (string) $row->payment_type
                );

            if (
                array_key_exists(
                    $type,
                    $paid
                )
            ) {
                $paid[$type] +=
                    (float) $row->amount;
            }
        }

        $rssbExpected =
            $expected['pension']
            +
            $expected['occupational_hazard']
            +
            $expected['maternity']
            +
            $expected['rama_medical']
            +
            $expected['cbhi'];

        $unifiedExpected =
            $expected['paye']
            +
            $rssbExpected;

        $salaryComplete =
            $this->covered(
                $paid['salary'],
                $expected['salary']
            );

        $unifiedComplete =
            $this->covered(
                $paid['unified_paye_rssb'],
                $unifiedExpected
            );

        $payeComplete =
            $unifiedComplete
            ||
            $this->covered(
                $paid['paye'],
                $expected['paye']
            );

        $rssbCombinedComplete =
            $unifiedComplete
            ||
            $this->covered(
                $paid['rssb_combined'],
                $rssbExpected
            );

        $rssbIndividualComplete =
            $this->covered(
                $paid['pension'],
                $expected['pension']
            )
            &&
            $this->covered(
                $paid['occupational_hazard'],
                $expected['occupational_hazard']
            )
            &&
            $this->covered(
                $paid['maternity'],
                $expected['maternity']
            )
            &&
            $this->covered(
                $paid['rama_medical'],
                $expected['rama_medical']
            )
            &&
            $this->covered(
                $paid['cbhi'],
                $expected['cbhi']
            );

        $rssbComplete =
            $rssbCombinedComplete
            ||
            $rssbIndividualComplete;

        return [
            'expected' =>
                $expected,

            'paid' =>
                $paid,

            'salary_complete' =>
                $salaryComplete,

            'paye_complete' =>
                $payeComplete,

            'rssb_complete' =>
                $rssbComplete,

            'statutory_complete' =>
                $payeComplete
                &&
                $rssbComplete,

            'complete' =>
                $salaryComplete
                &&
                $payeComplete
                &&
                $rssbComplete,
        ];
    }

    public function acceptedDeclaration(
        int $tenantId,
        int $runId
    ): ?object {
        return
            DB::table('payroll_declarations')
                ->where('tenant_id', $tenantId)
                ->where('payroll_run_id', $runId)
                ->where('status', 'accepted')
                ->orderByDesc('id')
                ->first();
    }

    private function runEmployees(
        int $tenantId,
        int $runId
    ): array {
        return
            DB::table('payroll_run_employees')
                ->where('tenant_id', $tenantId)
                ->where('payroll_run_id', $runId)
                ->orderBy('employee_number')
                ->get()
                ->all();
    }

    private function statutoryRuleDisclosure(
        int $tenantId,
        int $runId
    ): array {
        return
            DB::table('payroll_statutory_lines as line')
                ->join(
                    'payroll_run_employees as employee',
                    'employee.id',
                    '=',
                    'line.payroll_run_employee_id'
                )
                ->join(
                    'payroll_statutory_rule_versions as rule',
                    'rule.id',
                    '=',
                    'line.rule_version_id'
                )
                ->where(
                    'line.tenant_id',
                    $tenantId
                )
                ->where(
                    'employee.payroll_run_id',
                    $runId
                )
                ->select([
                    'rule.id',
                    'rule.code',
                    'rule.name',
                    'rule.effective_from',
                    'rule.effective_to',
                    'rule.source_reference',
                    'rule.source_url',
                ])
                ->distinct()
                ->orderBy('rule.code')
                ->get()
                ->map(
                    fn ($row) => [
                        'id' =>
                            (int) $row->id,

                        'code' =>
                            (string) $row->code,

                        'name' =>
                            (string) $row->name,

                        'effective_from' =>
                            $row->effective_from,

                        'effective_to' =>
                            $row->effective_to,

                        'source_reference' =>
                            (string) $row->source_reference,

                        'source_url' =>
                            $row->source_url,
                    ]
                )
                ->values()
                ->all();
    }

    private function issue(
        string $code,
        string $message,
        array $blocks,
        array $context = []
    ): array {
        return array_merge(
            [
                'code' =>
                    $code,

                'message' =>
                    $message,

                'blocks' =>
                    $blocks,
            ],
            $context
        );
    }

    private function hasBlockingIssue(
        array $issues,
        string $target
    ): bool {
        foreach ($issues as $issue) {
            if (
                in_array(
                    $target,
                    $issue['blocks']
                    ?? [],
                    true
                )
            ) {
                return true;
            }
        }

        return false;
    }

    private function jsonArray(
        mixed $value
    ): array {
        if (is_array($value)) {
            return $value;
        }

        if (
            ! is_string($value)
            ||
            trim($value) === ''
        ) {
            return [];
        }

        $decoded =
            json_decode(
                $value,
                true
            );

        return
            is_array($decoded)
                ? $decoded
                : [];
    }

    private function ishemaCategory(
        array $snapshot
    ): ?string {
        $employerType =
            strtolower(
                trim(
                    (string) (
                        $snapshot[
                            'paye_employer_type'
                        ]
                        ?? ''
                    )
                )
            );

        if (
            in_array(
                $employerType,
                [
                    'second',
                    'secondary',
                    'second_employer',
                ],
                true
            )
        ) {
            return 'S';
        }

        $category =
            strtolower(
                trim(
                    (string) (
                        $snapshot[
                            'employee_category'
                        ]
                        ?? ''
                    )
                )
            );

        return match ($category) {
            'p',
            'permanent',
            'regular',
            'regular_employee',
            'employee' =>
                'P',

            'c',
            'casual',
            'casual_employee' =>
                'C',

            'e',
            'exempt',
            'exempted',
            'exempted_employee' =>
                'E',

            's',
            'second',
            'secondary',
            'second_employer' =>
                'S',

            default =>
                null,
        };
    }

    private function componentAmounts(
        int $tenantId,
        int $runEmployeeId
    ): array {
        $result = [];

        $rows =
            DB::table('payroll_run_components')
                ->where('tenant_id', $tenantId)
                ->where(
                    'payroll_run_employee_id',
                    $runEmployeeId
                )
                ->get([
                    'code',
                    'amount',
                ]);

        foreach ($rows as $row) {
            $key =
                $this->normaliseCode(
                    (string) $row->code
                );

            $result[$key] =
                ($result[$key] ?? 0.0)
                +
                (float) $row->amount;
        }

        return $result;
    }

    private function component(
        array $amounts,
        array $aliases
    ): float {
        foreach ($aliases as $alias) {
            $key =
                $this->normaliseCode(
                    $alias
                );

            if (
                array_key_exists(
                    $key,
                    $amounts
                )
            ) {
                return
                    (float) $amounts[$key];
            }
        }

        return 0.0;
    }

    private function normaliseCode(
        string $value
    ): string {
        return trim(
            preg_replace(
                '/[^a-z0-9]+/',
                '_',
                strtolower($value)
            )
            ?? '',
            '_'
        );
    }

    private function yesNo(
        mixed $value
    ): string {
        if (is_bool($value)) {
            return
                $value
                    ? 'Y'
                    : 'N';
        }

        $normalised =
            strtolower(
                trim(
                    (string) $value
                )
            );

        return
            in_array(
                $normalised,
                [
                    '1',
                    'true',
                    'yes',
                    'y',
                    'on',
                ],
                true
            )
                ? 'Y'
                : 'N';
    }

    private function covered(
        float $paid,
        float $expected
    ): bool {
        if ($expected <= 0.005) {
            return true;
        }

        return
            $paid + 0.005
            >=
            $expected;
    }

    private function mergeJson(
        mixed $current,
        array $append
    ): string {
        $base =
            $this->jsonArray(
                $current
            );

        return json_encode(
            array_replace_recursive(
                $base,
                $append
            ),
            JSON_THROW_ON_ERROR
        );
    }
}

