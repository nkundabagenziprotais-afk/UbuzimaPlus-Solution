<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Hrm;

use App\Http\Controllers\Controller;
use App\Services\Finance\FinanceExpenseWorkflowService;
use App\Services\Hrm\Payroll\PayrollR1ScopeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

final class PayrollControlCenterR1Controller extends Controller
{
    public function __construct(
        private readonly PayrollR1ScopeService $scope
    ) {
    }

    public function employeePaySetup(
        Request $request,
        int $runId
    ): JsonResponse {
        [$ctx, $run] =
            $this->run(
                $request,
                $runId
            );

        $employees = DB::table(
            'payroll_run_employees'
        )
            ->where(
                'payroll_run_id',
                $runId
            )
            ->orderBy('employee_id')
            ->get();

        $rows = [];

        foreach ($employees as $employee) {
            $statutory =
                $this->latestProfile(
                    'payroll_employee_statutory_profiles',
                    $ctx,
                    (int) $employee->employee_id
                );

            $payment =
                $this->latestProfile(
                    'payroll_employee_payment_profiles',
                    $ctx,
                    (int) $employee->employee_id
                );

            $salaryReady =
                $employee->compensation_id !== null
                &&
                (float) $employee->basic_salary > 0;

            $statutoryReady =
                $statutory !== null;

            $paymentReady =
                $payment !== null;

            $rows[] = [
                'id' =>
                    (int) $employee->id,

                'employee_id' =>
                    (int) $employee->employee_id,

                'compensation_id' =>
                    $employee->compensation_id === null
                        ? null
                        : (int)
                            $employee->compensation_id,

                'basic_salary' =>
                    (float)
                        $employee->basic_salary,

                'validation_status' =>
                    (string)
                        $employee->validation_status,

                'salary_ready' =>
                    $salaryReady,

                'statutory_profile_ready' =>
                    $statutoryReady,

                'payment_profile_ready' =>
                    $paymentReady,

                /*
                 * Sensitive encrypted payloads are deliberately
                 * not returned here.
                 */
                'statutory_profile_id' =>
                    $statutory?->id,

                'payment_profile_id' =>
                    $payment?->id,
            ];
        }

        return response()->json([
            'data' => [
                'run' => $run,
                'employees' => $rows,

                'sensitive_payloads_returned' =>
                    false,
            ],
        ]);
    }

    public function regulatoryControl(
        Request $request
    ): JsonResponse {
        $ctx =
            $this->scope->resolve(
                $request
            );

        $rules = DB::table(
            'payroll_statutory_rule_versions'
        )
            ->orderBy('code')
            ->orderByDesc(
                'effective_from'
            )
            ->get();

        $changes = DB::table(
            'payroll_regulatory_change_requests'
        )
            ->where(
                'tenant_id',
                $ctx['tenant_id']
            )
            ->orderByDesc('id')
            ->limit(100)
            ->get();

        $actions = DB::table(
            'payroll_regulatory_change_actions'
        )
            ->where(
                'tenant_id',
                $ctx['tenant_id']
            )
            ->orderByDesc(
                'acted_at'
            )
            ->limit(200)
            ->get();

        return response()->json([
            'data' => [
                'rules' => $rules,
                'changes' => $changes,
                'actions' => $actions,

                'approval_scope' =>
                    'platform',

                'historical_overwrite' =>
                    false,
            ],
        ]);
    }

    public function createRegulatoryChange(
        Request $request
    ): JsonResponse {
        $ctx =
            $this->scope->resolve(
                $request
            );

        $validated =
            $request->validate([
                'source_rule_version_id' => [
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
                    'after_or_equal:effective_from',
                ],

                'employee_rate' => [
                    'nullable',
                    'numeric',
                    'min:0',
                ],

                'employer_rate' => [
                    'nullable',
                    'numeric',
                    'min:0',
                ],

                'base_code' => [
                    'nullable',
                    'string',
                    'max:100',
                ],

                'rounding_rule' => [
                    'nullable',
                    'string',
                    'max:50',
                ],

                'condition_code' => [
                    'nullable',
                    'string',
                    'max:100',
                ],

                'source_reference' => [
                    'nullable',
                    'string',
                    'max:191',
                ],

                'source_url' => [
                    'nullable',
                    'url',
                    'max:2000',
                ],

                'metadata' => [
                    'nullable',
                    'array',
                ],

                'change_rationale' => [
                    'required',
                    'string',
                    'max:4000',
                ],
            ]);

        $source = DB::table(
            'payroll_statutory_rule_versions'
        )
            ->where(
                'id',
                $validated[
                    'source_rule_version_id'
                ]
            )
            ->first();

        if ($source === null) {
            throw ValidationException::
                withMessages([
                    'source_rule_version_id' => [
                        'The source statutory rule version does not exist.',
                    ],
                ]);
        }

        $id = DB::table(
            'payroll_regulatory_change_requests'
        )->insertGetId([
            'uuid' =>
                (string) Str::uuid(),

            'tenant_id' =>
                $ctx['tenant_id'],

            'branch_id' =>
                $ctx['branch_id'],

            'source_rule_version_id' =>
                (int) $source->id,

            'created_rule_version_id' =>
                null,

            'proposed_effective_from' =>
                $validated[
                    'effective_from'
                ],

            'proposed_effective_to' =>
                $validated[
                    'effective_to'
                ] ?? null,

            'proposed_employee_rate' =>
                $validated[
                    'employee_rate'
                ] ?? null,

            'proposed_employer_rate' =>
                $validated[
                    'employer_rate'
                ] ?? null,

            'proposed_base_code' =>
                $validated[
                    'base_code'
                ] ?? null,

            'proposed_rounding_rule' =>
                $validated[
                    'rounding_rule'
                ] ?? null,

            'proposed_condition_code' =>
                $validated[
                    'condition_code'
                ] ?? null,

            'proposed_source_reference' =>
                $validated[
                    'source_reference'
                ] ?? null,

            'proposed_source_url' =>
                $validated[
                    'source_url'
                ] ?? null,

            'proposed_metadata' =>
                array_key_exists(
                    'metadata',
                    $validated
                )
                    ? json_encode(
                        $validated[
                            'metadata'
                        ],
                        JSON_THROW_ON_ERROR
                    )
                    : null,

            'change_rationale' =>
                $validated[
                    'change_rationale'
                ],

            'status' =>
                'DRAFT',

            'created_by' =>
                $ctx['user_id'],

            'submitted_by' =>
                null,

            'approved_by' =>
                null,

            'submitted_at' =>
                null,

            'approved_at' =>
                null,

            'created_at' =>
                now(),

            'updated_at' =>
                now(),
        ]);

        $this->regulatoryAction(
            $id,
            $ctx,
            'CREATED',
            null,
            'DRAFT',
            'New effective-dated regulatory change draft created.'
        );

        return response()->json([
            'data' => DB::table(
                'payroll_regulatory_change_requests'
            )
                ->where(
                    'id',
                    $id
                )
                ->first(),
        ], 201);
    }

    public function submitRegulatoryChange(
        Request $request,
        string $uuid
    ): JsonResponse {
        $ctx =
            $this->scope->resolve(
                $request
            );

        $row =
            $this->regulatoryChange(
                $ctx,
                $uuid
            );

        if ($row->status !== 'DRAFT') {
            throw ValidationException::
                withMessages([
                    'status' => [
                        'Only a DRAFT regulatory change may be submitted.',
                    ],
                ]);
        }

        DB::transaction(
            function () use (
                $row,
                $ctx
            ): void {
                DB::table(
                    'payroll_regulatory_change_requests'
                )
                    ->where(
                        'id',
                        $row->id
                    )
                    ->update([
                        'status' =>
                            'SUBMITTED',

                        'submitted_by' =>
                            $ctx['user_id'],

                        'submitted_at' =>
                            now(),

                        'updated_at' =>
                            now(),
                    ]);

                $this->regulatoryAction(
                    (int) $row->id,
                    $ctx,
                    'SUBMITTED',
                    'DRAFT',
                    'SUBMITTED',
                    'Submitted for independent regulatory approval.'
                );
            }
        );

        return response()->json([
            'data' => DB::table(
                'payroll_regulatory_change_requests'
            )
                ->where(
                    'id',
                    $row->id
                )
                ->first(),
        ]);
    }

    public function approveRegulatoryChange(
        Request $request,
        string $uuid
    ): JsonResponse {
        $ctx =
            $this->scope->resolve(
                $request
            );

        /*
         * payroll_statutory_rule_versions is currently a global
         * statutory configuration table, not tenant-specific.
         *
         * Tenant-level approval must therefore never silently
         * alter the global statutory engine.
         */
        if (! $ctx['scope']->isPlatform()) {
            throw ValidationException::
                withMessages([
                    'approval' => [
                        'Global statutory rule approval requires platform scope.',
                    ],
                ]);
        }

        return DB::transaction(
            function () use (
                $ctx,
                $uuid
            ): JsonResponse {
                $change = DB::table(
                    'payroll_regulatory_change_requests'
                )
                    ->where(
                        'tenant_id',
                        $ctx['tenant_id']
                    )
                    ->where(
                        'uuid',
                        $uuid
                    )
                    ->lockForUpdate()
                    ->first();

                abort_unless(
                    $change,
                    404
                );

                if (
                    $change->status
                    !==
                    'SUBMITTED'
                ) {
                    throw ValidationException::
                        withMessages([
                            'status' => [
                                'Only a SUBMITTED regulatory change may be approved.',
                            ],
                        ]);
                }

                $makerIds = array_filter([
                    (int)
                        $change->created_by,

                    $change->submitted_by === null
                        ? null
                        : (int)
                            $change->submitted_by,
                ]);

                if (
                    (
in_array(
                        $ctx['user_id'],
                        $makerIds,
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
                    throw ValidationException::
                        withMessages([
                            'approval' => [
                                'Regulatory maker/checker requires an independent approver.',
                            ],
                        ]);
                }

                $source = DB::table(
                    'payroll_statutory_rule_versions'
                )
                    ->where(
                        'id',
                        $change
                            ->source_rule_version_id
                    )
                    ->first();

                if ($source === null) {
                    throw ValidationException::
                        withMessages([
                            'source_rule_version_id' => [
                                'The source statutory rule version no longer exists.',
                            ],
                        ]);
                }

                $duplicate = DB::table(
                    'payroll_statutory_rule_versions'
                )
                    ->where(
                        'code',
                        $source->code
                    )
                    ->whereDate(
                        'effective_from',
                        $change
                            ->proposed_effective_from
                    )
                    ->exists();

                if ($duplicate) {
                    throw ValidationException::
                        withMessages([
                            'effective_from' => [
                                'A version of this statutory rule already exists for that effective date.',
                            ],
                        ]);
                }

                /*
                 * Clone the exact existing rule structure.
                 * Historical rows are NEVER updated.
                 */
                $newVersion = [
                    'uuid' =>
                        (string) Str::uuid(),

                    'code' =>
                        $source->code,

                    'name' =>
                        $source->name,

                    'effective_from' =>
                        $change
                            ->proposed_effective_from,

                    'effective_to' =>
                        $change
                            ->proposed_effective_to,

                    'employee_rate' =>
                        $change
                            ->proposed_employee_rate
                        ?? $source
                            ->employee_rate,

                    'employer_rate' =>
                        $change
                            ->proposed_employer_rate
                        ?? $source
                            ->employer_rate,

                    'base_code' =>
                        $change
                            ->proposed_base_code
                        ?? $source
                            ->base_code,

                    'rounding_rule' =>
                        $change
                            ->proposed_rounding_rule
                        ?? $source
                            ->rounding_rule,

                    'condition_code' =>
                        $change
                            ->proposed_condition_code
                        ?? $source
                            ->condition_code,

                    'source_reference' =>
                        $change
                            ->proposed_source_reference
                        ?? $source
                            ->source_reference,

                    'source_url' =>
                        $change
                            ->proposed_source_url
                        ?? $source
                            ->source_url,

                    'metadata' =>
                        $change
                            ->proposed_metadata
                        ?? $source
                            ->metadata,

                    'status' =>
                        'active',

                    'created_at' =>
                        now(),

                    'updated_at' =>
                        now(),
                ];

                $newId = DB::table(
                    'payroll_statutory_rule_versions'
                )->insertGetId(
                    $newVersion
                );

                DB::table(
                    'payroll_regulatory_change_requests'
                )
                    ->where(
                        'id',
                        $change->id
                    )
                    ->update([
                        'created_rule_version_id' =>
                            $newId,

                        'status' =>
                            'APPROVED',

                        'approved_by' =>
                            $ctx['user_id'],

                        'approved_at' =>
                            now(),

                        'updated_at' =>
                            now(),
                    ]);

                $this->regulatoryAction(
                    (int) $change->id,
                    $ctx,
                    'APPROVED_NEW_VERSION',
                    'SUBMITTED',
                    'APPROVED',
                    'Approval created a new effective-dated statutory rule version; the historical source row was not modified.'
                );

                return response()->json([
                    'data' => [
                        'change' =>
                            DB::table(
                                'payroll_regulatory_change_requests'
                            )
                                ->where(
                                    'id',
                                    $change->id
                                )
                                ->first(),

                        'rule_version' =>
                            DB::table(
                                'payroll_statutory_rule_versions'
                            )
                                ->where(
                                    'id',
                                    $newId
                                )
                                ->first(),

                        'historical_source_modified' =>
                            false,
                    ],
                ]);
            }
        );
    }

    public function financeControl(
        Request $request,
        int $runId
    ): JsonResponse {
        [$ctx, $run] =
            $this->run(
                $request,
                $runId
            );

        $branchId =
            $run->branch_id === null
                ? null
                : (int) $run->branch_id;

        $mappedAccountIds =
            $this->mappedAccountIds(
                $ctx['tenant_id'],
                $branchId
            );

        $accounts = DB::table(
            'finance_chart_of_accounts'
        )
            ->where(
                'tenant_id',
                $ctx['tenant_id']
            )
            ->whereIn(
                'id',
                $mappedAccountIds
            )
            ->orderBy('code')
            ->get();

        $mappings = DB::table(
            'payroll_finance_mapping_configs'
        )
            ->where(
                'tenant_id',
                $ctx['tenant_id']
            )
            ->where(
                function ($query) use (
                    $branchId
                ): void {
                    $query
                        ->whereNull(
                            'branch_id'
                        );

                    if ($branchId !== null) {
                        $query
                            ->orWhere(
                                'branch_id',
                                $branchId
                            );
                    }
                }
            )
            ->orderByDesc(
                'effective_from'
            )
            ->orderByDesc('id')
            ->get();

        $expense =
            $this->existingExpense(
                $ctx['tenant_id'],
                $runId
            );

        return response()->json([
            'data' => [
                'run' => $run,

                'totals' => [
                    'gross_payroll' =>
                        (float)
                            $run
                                ->total_gross_employment_income,

                    'employee_deductions' =>
                        (float)
                            $run
                                ->total_employee_deductions,

                    'net_payroll' =>
                        (float)
                            $run
                                ->total_net_salary,

                    'employer_statutory_contributions' =>
                        (float)
                            $run
                                ->total_employer_contributions,

                    'total_employer_cost' =>
                        (float)
                            $run
                                ->total_employer_cost,
                ],

                'finance_expense' =>
                    $expense,

                'mapped_accounts' =>
                    $accounts,

                'payroll_finance_mappings' =>
                    $mappings,

                'finance_submit_automatic' =>
                    false,

                'finance_approval_automatic' =>
                    false,

                'finance_posting_automatic' =>
                    false,
            ],
        ]);
    }

    public function createFinanceMapping(
        Request $request
    ): JsonResponse {
        $ctx =
            $this->scope->resolve(
                $request
            );

        $validated =
            $request->validate([
                'effective_from' => [
                    'required',
                    'date',
                ],

                'salary_expense_account_id' => [
                    'required',
                    'integer',
                ],

                'employer_statutory_account_id' => [
                    'required',
                    'integer',
                ],

                'payment_source' => [
                    'required',
                    'string',
                    'max:30',
                ],

                'change_rationale' => [
                    'required',
                    'string',
                    'max:4000',
                ],
            ]);

        $this->assertMappedAccount(
            $ctx['tenant_id'],
            $ctx['branch_id'],
            (int)
                $validated[
                    'salary_expense_account_id'
                ]
        );

        $this->assertMappedAccount(
            $ctx['tenant_id'],
            $ctx['branch_id'],
            (int)
                $validated[
                    'employer_statutory_account_id'
                ]
        );

        $id = DB::table(
            'payroll_finance_mapping_configs'
        )->insertGetId([
            'uuid' =>
                (string) Str::uuid(),

            'tenant_id' =>
                $ctx['tenant_id'],

            'branch_id' =>
                $ctx['branch_id'],

            'effective_from' =>
                $validated[
                    'effective_from'
                ],

            'salary_expense_account_id' =>
                $validated[
                    'salary_expense_account_id'
                ],

            'employer_statutory_account_id' =>
                $validated[
                    'employer_statutory_account_id'
                ],

            'payment_source' =>
                strtolower(
                    trim(
                        (string)
                            $validated[
                                'payment_source'
                            ]
                    )
                ),

            'change_rationale' =>
                $validated[
                    'change_rationale'
                ],

            'status' =>
                'DRAFT',

            'created_by' =>
                $ctx['user_id'],

            'submitted_by' =>
                null,

            'approved_by' =>
                null,

            'submitted_at' =>
                null,

            'approved_at' =>
                null,

            'created_at' =>
                now(),

            'updated_at' =>
                now(),
        ]);

        $this->mappingAction(
            $id,
            $ctx,
            'CREATED',
            null,
            'DRAFT'
        );

        return response()->json([
            'data' => DB::table(
                'payroll_finance_mapping_configs'
            )
                ->where(
                    'id',
                    $id
                )
                ->first(),
        ], 201);
    }

    public function submitFinanceMapping(
        Request $request,
        string $uuid
    ): JsonResponse {
        $ctx =
            $this->scope->resolve(
                $request
            );

        $mapping =
            $this->financeMapping(
                $ctx,
                $uuid
            );

        if ($mapping->status !== 'DRAFT') {
            throw ValidationException::
                withMessages([
                    'status' => [
                        'Only a DRAFT Payroll Finance mapping may be submitted.',
                    ],
                ]);
        }

        DB::table(
            'payroll_finance_mapping_configs'
        )
            ->where(
                'id',
                $mapping->id
            )
            ->update([
                'status' =>
                    'SUBMITTED',

                'submitted_by' =>
                    $ctx['user_id'],

                'submitted_at' =>
                    now(),

                'updated_at' =>
                    now(),
            ]);

        $this->mappingAction(
            (int) $mapping->id,
            $ctx,
            'SUBMITTED',
            'DRAFT',
            'SUBMITTED'
        );

        return response()->json([
            'data' => DB::table(
                'payroll_finance_mapping_configs'
            )
                ->where(
                    'id',
                    $mapping->id
                )
                ->first(),
        ]);
    }

    public function approveFinanceMapping(
        Request $request,
        string $uuid
    ): JsonResponse {
        $ctx =
            $this->scope->resolve(
                $request
            );

        return DB::transaction(
            function () use (
                $ctx,
                $uuid
            ): JsonResponse {
                $mapping = DB::table(
                    'payroll_finance_mapping_configs'
                )
                    ->where(
                        'tenant_id',
                        $ctx['tenant_id']
                    )
                    ->where(
                        'uuid',
                        $uuid
                    )
                    ->lockForUpdate()
                    ->first();

                abort_unless(
                    $mapping,
                    404
                );

                if (
                    $mapping->status
                    !==
                    'SUBMITTED'
                ) {
                    throw ValidationException::
                        withMessages([
                            'status' => [
                                'Only a SUBMITTED Payroll Finance mapping may be approved.',
                            ],
                        ]);
                }

                $makerIds = array_filter([
                    (int)
                        $mapping->created_by,

                    $mapping->submitted_by === null
                        ? null
                        : (int)
                            $mapping->submitted_by,
                ]);

                if (
                    (
in_array(
                        $ctx['user_id'],
                        $makerIds,
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
                    throw ValidationException::
                        withMessages([
                            'approval' => [
                                'Payroll Finance mapping maker/checker requires an independent approver.',
                            ],
                        ]);
                }

                $this->assertMappedAccount(
                    $ctx['tenant_id'],
                    $mapping->branch_id === null
                        ? null
                        : (int)
                            $mapping->branch_id,

                    (int)
                        $mapping
                            ->salary_expense_account_id
                );

                $this->assertMappedAccount(
                    $ctx['tenant_id'],
                    $mapping->branch_id === null
                        ? null
                        : (int)
                            $mapping->branch_id,

                    (int)
                        $mapping
                            ->employer_statutory_account_id
                );

                DB::table(
                    'payroll_finance_mapping_configs'
                )
                    ->where(
                        'id',
                        $mapping->id
                    )
                    ->update([
                        'status' =>
                            'APPROVED',

                        'approved_by' =>
                            $ctx['user_id'],

                        'approved_at' =>
                            now(),

                        'updated_at' =>
                            now(),
                    ]);

                $this->mappingAction(
                    (int) $mapping->id,
                    $ctx,
                    'APPROVED',
                    'SUBMITTED',
                    'APPROVED'
                );

                return response()->json([
                    'data' =>
                        DB::table(
                            'payroll_finance_mapping_configs'
                        )
                            ->where(
                                'id',
                                $mapping->id
                            )
                            ->first(),
                ]);
            }
        );
    }

    public function prepareFinanceExpense(
        Request $request,
        int $runId,
        FinanceExpenseWorkflowService $workflow
    ): JsonResponse {
        [$ctx, $run] =
            $this->run(
                $request,
                $runId
            );

        if (
            strtoupper(
                (string)
                    $run->status
            )
            !==
            'APPROVED'
        ) {
            throw ValidationException::
                withMessages([
                    'payroll_run' => [
                        'Only an APPROVED Payroll run may prepare a Finance Expense.',
                    ],
                ]);
        }

        if (
            (int)
                $run->blocked_count
            > 0
        ) {
            throw ValidationException::
                withMessages([
                    'payroll_run' => [
                        'Blocked Payroll cannot prepare a Finance Expense.',
                    ],
                ]);
        }

        $existing =
            $this->existingExpense(
                $ctx['tenant_id'],
                $runId
            );

        if ($existing !== null) {
            return response()->json([
                'data' => [
                    'expense' =>
                        $existing,

                    'replayed' =>
                        true,

                    'finance_submit_automatic' =>
                        false,

                    'finance_approval_automatic' =>
                        false,

                    'finance_posting_automatic' =>
                        false,
                ],
            ]);
        }

        $validated =
            $request->validate([
                'business_date' => [
                    'required',
                    'date',
                ],
            ]);

        $branchId =
            $run->branch_id === null
                ? null
                : (int)
                    $run->branch_id;

        $mapping =
            $this->effectiveFinanceMapping(
                $ctx['tenant_id'],
                $branchId,
                $validated[
                    'business_date'
                ]
            );

        if ($mapping === null) {
            throw ValidationException::
                withMessages([
                    'finance_mapping' => [
                        'No approved Payroll Finance mapping is effective for this date.',
                    ],
                ]);
        }

        $this->assertMappedAccount(
            $ctx['tenant_id'],
            $branchId,
            (int)
                $mapping
                    ->salary_expense_account_id
        );

        $this->assertMappedAccount(
            $ctx['tenant_id'],
            $branchId,
            (int)
                $mapping
                    ->employer_statutory_account_id
        );

        $gross =
            (float)
                $run
                    ->total_gross_employment_income;

        $employer =
            (float)
                $run
                    ->total_employer_contributions;

        $totalEmployerCost =
            (float)
                $run
                    ->total_employer_cost;

        if ($totalEmployerCost <= 0) {
            throw ValidationException::
                withMessages([
                    'payroll_run' => [
                        'Payroll employer cost must be greater than zero before Finance handoff.',
                    ],
                ]);
        }

        $lines = [];

        if ($gross > 0) {
            $lines[] = [
                'finance_chart_of_account_id' =>
                    (int)
                        $mapping
                            ->salary_expense_account_id,

                'description' =>
                    'Employee salary expense — '
                    . (string)
                        $run->run_number,

                'amount' =>
                    $gross,
            ];
        }

        if ($employer > 0) {
            $lines[] = [
                'finance_chart_of_account_id' =>
                    (int)
                        $mapping
                            ->employer_statutory_account_id,

                'description' =>
                    'Employer statutory contributions — '
                    . (string)
                        $run->run_number,

                'amount' =>
                    $employer,
            ];
        }

        $reference =
            'PAYROLL-RUN-'
            . $runId;

        $financePayload = [
            'business_date' =>
                $validated[
                    'business_date'
                ],

            'supplier_id' =>
                null,

            'payee_name' =>
                'Payroll — '
                . (string)
                    $run->run_number,

            'payment_source' =>
                (string)
                    $mapping
                        ->payment_source,

            'reference_number' =>
                $reference,

            'receipt_number' =>
                null,

            'purpose' =>
                'Payroll expense — '
                . (string)
                    $run->run_number,

            'notes' =>
                'Prepared from approved Payroll run '
                . $runId
                . '. Finance submit, approval and posting remain independent.',

            'currency_code' =>
                'RWF',

            'lines' =>
                $lines,
        ];

        /*
         * FinanceExpenseWorkflowService::create() remains the
         * Finance transactional validation/accounting owner.
         *
         * StoreFinanceExpenseRequest is NOT resolved inside this
         * Payroll controller because doing so invokes a second
         * FormRequest authorization lifecycle.
         *
         * All user-independent Payroll values below are constructed
         * server-side and FinanceExpenseWorkflowService validates
         * the payload before creating the Finance Expense draft.
         */

        $idempotencyKey =
            'payroll-run-'
            . $runId
            . '-finance-expense-v1';

        $result = $workflow->create(
                    tenantId: $ctx['tenant_id'],
                    branchId: $run->branch_id === null ? null : (int) $run->branch_id,
                    data: $financePayload,
                    actorId: $ctx['user_id'],
                    idempotencyKey: $idempotencyKey,
                );

        $expense =
            $this->existingExpense(
                $ctx['tenant_id'],
                $runId
            );

        if ($expense === null) {
            $candidate =
                is_array($result)
                    ? (
                        $result[
                            'expense'
                        ] ?? null
                    )
                    : null;

            if (
                is_object(
                    $candidate
                )
                &&
                isset(
                    $candidate->id
                )
            ) {
                $expense = DB::table(
                    'finance_expenses'
                )
                    ->where(
                        'id',
                        $candidate->id
                    )
                    ->first();
            }
        }

        if ($expense === null) {
            throw ValidationException::
                withMessages([
                    'finance_expense' => [
                        'Finance workflow completed without a traceable Payroll Expense reference.',
                    ],
                ]);
        }

        return response()->json([
            'data' => [
                'expense' =>
                    $expense,

                'replayed' =>
                    is_array($result)
                    &&
                    (bool) (
                        $result[
                            'replayed'
                        ] ?? false
                    ),

                'payroll_reference' =>
                    $reference,

                'finance_submit_automatic' =>
                    false,

                'finance_approval_automatic' =>
                    false,

                'finance_posting_automatic' =>
                    false,
            ],
        ], 201);
    }

    private function run(
        Request $request,
        int $runId
    ): array {
        $ctx =
            $this->scope->resolve(
                $request
            );

        $query = DB::table(
            'payroll_runs'
        )
            ->where(
                'id',
                $runId
            )
            ->where(
                'tenant_id',
                $ctx['tenant_id']
            );

        if (
            $ctx['branch_id']
            !==
            null
        ) {
            $query->where(
                'branch_id',
                $ctx['branch_id']
            );
        }

        $run =
            $query->first();

        abort_unless(
            $run,
            404
        );

        return [
            $ctx,
            $run,
        ];
    }

    private function latestProfile(
        string $table,
        array $ctx,
        int $employeeId
    ): ?object {
        if (
            ! Schema::hasTable(
                $table
            )
        ) {
            return null;
        }

        $query = DB::table(
            $table
        )
            ->where(
                'employee_id',
                $employeeId
            );

        $columns =
            Schema::getColumnListing(
                $table
            );

        if (
            in_array(
                'tenant_id',
                $columns,
                true
            )
        ) {
            $query->where(
                'tenant_id',
                $ctx['tenant_id']
            );
        }

        if (
            $ctx['branch_id'] !== null
            &&
            in_array(
                'branch_id',
                $columns,
                true
            )
        ) {
            $query->where(
                function ($builder) use (
                    $ctx
                ): void {
                    $builder
                        ->whereNull(
                            'branch_id'
                        )
                        ->orWhere(
                            'branch_id',
                            $ctx['branch_id']
                        );
                }
            );
        }

        /*
         * Never select/decrypt sensitive payload columns
         * for the aggregate Employee Pay Setup page.
         */
        return $query
            ->select('id')
            ->orderByDesc('id')
            ->first();
    }

    private function existingExpense(
        int $tenantId,
        int $runId
    ): ?object {
        return DB::table(
            'finance_expenses'
        )
            ->where(
                'tenant_id',
                $tenantId
            )
            ->where(
                'reference_number',
                'PAYROLL-RUN-'
                    . $runId
            )
            ->orderByDesc('id')
            ->first();
    }

    private function mappedAccountIds(
        int $tenantId,
        ?int $branchId
    ): array {
        $query = DB::table(
            'finance_account_mappings'
        )
            ->where(
                'tenant_id',
                $tenantId
            )
            ->where(
                'currency_code',
                'RWF'
            )
            ->where(
                'is_active',
                true
            );

        $query->where(
            function ($builder) use (
                $branchId
            ): void {
                $builder
                    ->whereNull(
                        'branch_id'
                    );

                if ($branchId !== null) {
                    $builder
                        ->orWhere(
                            'branch_id',
                            $branchId
                        );
                }
            }
        );

        return $query
            ->pluck(
                'finance_chart_of_account_id'
            )
            ->map(
                static fn ($id): int =>
                    (int) $id
            )
            ->unique()
            ->values()
            ->all();
    }

    private function assertMappedAccount(
        int $tenantId,
        ?int $branchId,
        int $accountId
    ): void {
        $query = DB::table(
            'finance_account_mappings'
        )
            ->where(
                'tenant_id',
                $tenantId
            )
            ->where(
                'finance_chart_of_account_id',
                $accountId
            )
            ->where(
                'currency_code',
                'RWF'
            )
            ->where(
                'is_active',
                true
            );

        $query->where(
            function ($builder) use (
                $branchId
            ): void {
                $builder
                    ->whereNull(
                        'branch_id'
                    );

                if ($branchId !== null) {
                    $builder
                        ->orWhere(
                            'branch_id',
                            $branchId
                        );
                }
            }
        );

        if (! $query->exists()) {
            throw ValidationException::
                withMessages([
                    'finance_account' => [
                        'The selected Finance account has no active RWF Finance mapping for this Payroll scope.',
                    ],
                ]);
        }
    }

    private function effectiveFinanceMapping(
        int $tenantId,
        ?int $branchId,
        string $businessDate
    ): ?object {
        $query = DB::table(
            'payroll_finance_mapping_configs'
        )
            ->where(
                'tenant_id',
                $tenantId
            )
            ->where(
                'status',
                'APPROVED'
            )
            ->whereDate(
                'effective_from',
                '<=',
                $businessDate
            );

        $query->where(
            function ($builder) use (
                $branchId
            ): void {
                $builder
                    ->whereNull(
                        'branch_id'
                    );

                if ($branchId !== null) {
                    $builder
                        ->orWhere(
                            'branch_id',
                            $branchId
                        );
                }
            }
        );

        return $query
            ->orderByDesc(
                'effective_from'
            )
            ->orderByDesc('id')
            ->first();
    }

    private function financeMapping(
        array $ctx,
        string $uuid
    ): object {
        $mapping = DB::table(
            'payroll_finance_mapping_configs'
        )
            ->where(
                'tenant_id',
                $ctx['tenant_id']
            )
            ->where(
                'uuid',
                $uuid
            )
            ->first();

        abort_unless(
            $mapping,
            404
        );

        return $mapping;
    }

    private function regulatoryChange(
        array $ctx,
        string $uuid
    ): object {
        $row = DB::table(
            'payroll_regulatory_change_requests'
        )
            ->where(
                'tenant_id',
                $ctx['tenant_id']
            )
            ->where(
                'uuid',
                $uuid
            )
            ->first();

        abort_unless(
            $row,
            404
        );

        return $row;
    }

    private function regulatoryAction(
        int $requestId,
        array $ctx,
        string $action,
        ?string $previous,
        ?string $next,
        ?string $comment
    ): void {
        $snapshot = DB::table(
            'payroll_regulatory_change_requests'
        )
            ->where(
                'id',
                $requestId
            )
            ->first();

        DB::table(
            'payroll_regulatory_change_actions'
        )->insert([
            'payroll_regulatory_change_request_id' =>
                $requestId,

            'tenant_id' =>
                $ctx['tenant_id'],

            'actor_id' =>
                $ctx['user_id'],

            'action' =>
                $action,

            'previous_status' =>
                $previous,

            'new_status' =>
                $next,

            'comment' =>
                $comment,

            'snapshot' =>
                json_encode(
                    $snapshot,
                    JSON_THROW_ON_ERROR
                ),

            'acted_at' =>
                now(),

            'created_at' =>
                now(),

            'updated_at' =>
                now(),
        ]);
    }

    private function mappingAction(
        int $mappingId,
        array $ctx,
        string $action,
        ?string $previous,
        ?string $next
    ): void {
        DB::table(
            'payroll_finance_mapping_actions'
        )->insert([
            'payroll_finance_mapping_config_id' =>
                $mappingId,

            'tenant_id' =>
                $ctx['tenant_id'],

            'actor_id' =>
                $ctx['user_id'],

            'action' =>
                $action,

            'previous_status' =>
                $previous,

            'new_status' =>
                $next,

            'comment' =>
                null,

            'acted_at' =>
                now(),

            'created_at' =>
                now(),

            'updated_at' =>
                now(),
        ]);
    }
}
