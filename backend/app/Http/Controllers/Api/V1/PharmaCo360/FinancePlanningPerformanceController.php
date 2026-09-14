<?php

namespace App\Http\Controllers\Api\V1\PharmaCo360;

use App\Http\Controllers\Controller;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Throwable;

class FinancePlanningPerformanceController extends Controller
{
    private const KPI_CODES = [
        'sales_revenue',
        'sales_growth_pct',
        'gross_profit',
        'gross_margin_pct',
        'net_profit',
        'net_margin_pct',
        'operating_expenses',
        'expense_to_revenue_pct',
        'average_daily_sales',
        'collection_rate_pct',
        'receivables_outstanding',
        'payables_due',
        'cash_runway_days',
        'inventory_turnover',
    ];

    public function overview(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId($request);

        $validated = $request->validate([
            'branch_id' => [
                'nullable',
                'integer',
                'min:1',
            ],
        ]);

        $branchId = isset($validated['branch_id'])
            ? (int) $validated['branch_id']
            : null;

        $today = Carbon::today();

        $monthStart = $today
            ->copy()
            ->startOfMonth()
            ->toDateString();

        $monthEnd = $today
            ->copy()
            ->endOfMonth()
            ->toDateString();

        $sales = $this->salesMetrics(
            $tenantId,
            $branchId,
            $monthStart,
            $monthEnd
        );

        $todaySales = $this->salesMetrics(
            $tenantId,
            $branchId,
            $today->toDateString(),
            $today->toDateString()
        );

        $expenses = $this->operatingExpenses(
            $tenantId,
            $branchId,
            $monthStart,
            $monthEnd
        );

        $budget = $this->activeBudget(
            $tenantId,
            $branchId,
            $today->toDateString()
        );

        $budgetSummary = $this->budgetSummary(
            $tenantId,
            $budget
        );

        $targets = $this->activeTargets(
            $tenantId,
            $branchId,
            $today->toDateString()
        );

        $actuals = $this->actualMap(
            $sales,
            $expenses,
            $tenantId,
            $branchId,
            $monthStart
        );

        $workingDays = max(
            1,
            (int) (
                $budget->working_days
                ?? 26
            )
        );

        $elapsedDays = max(
            1,
            min(
                $workingDays,
                (int) $today->day
            )
        );

        $expenseDaily = null;
        $expenseBasis = null;

        if (
            $budgetSummary['expense_budget']
            > 0
        ) {
            $expenseDaily =
                $budgetSummary['expense_budget']
                /
                $workingDays;

            $expenseBasis =
                'active_budget';

        } elseif ($expenses > 0) {
            $expenseDaily =
                $expenses
                /
                $elapsedDays;

            $expenseBasis =
                'actual_month_to_date';
        }

        $desiredProfit = (float) (
            $budget->desired_profit_amount
            ?? 0
        );

        $desiredProfitDaily =
            $desiredProfit
            /
            $workingDays;

        $grossMarginTarget = $targets
            ->firstWhere(
                'metric_code',
                'gross_margin_pct'
            );

        $marginPct = null;
        $marginSource = null;

        if (
            $sales['gross_margin_pct']
            !== null
            &&
            $sales['cost_coverage_pct']
            >= 80
        ) {
            $marginPct =
                $sales['gross_margin_pct'];

            $marginSource =
                'actual_sales_cost';

        } elseif (
            $grossMarginTarget
            &&
            (float) $grossMarginTarget->target_value
            > 0
        ) {
            $marginPct =
                (float)
                $grossMarginTarget->target_value;

            $marginSource =
                'configured_kpi_target';
        }

        $requiredSalesToday = null;
        $stillNeededToday = null;

        if (
            $expenseDaily !== null
            &&
            $marginPct !== null
            &&
            $marginPct > 0
        ) {
            $requiredSalesToday =
                (
                    $expenseDaily
                    +
                    $desiredProfitDaily
                )
                /
                (
                    $marginPct / 100
                );

            $stillNeededToday = max(
                0,
                $requiredSalesToday
                -
                $todaySales['revenue']
            );
        }

        return response()->json([
            'data' => [
                'period' => [
                    'from' =>
                        $monthStart,

                    'to' =>
                        $monthEnd,

                    'as_of' =>
                        $today->toDateString(),
                ],

                'permissions' => [
                    'can_view' =>
                        true,

                    'can_manage' =>
                        $this->canManage(
                            $request
                        ),
                ],

                'sales' =>
                    $sales,

                'expenses' => [
                    'month_to_date' =>
                        round(
                            $expenses,
                            2
                        ),
                ],

                'budget' => [
                    'record' =>
                        $budget,

                    'summary' =>
                        $budgetSummary,
                ],

                'daily_business_target' => [
                    'working_days' =>
                        $workingDays,

                    'daily_expense_requirement' =>
                        $expenseDaily === null
                            ? null
                            : round(
                                $expenseDaily,
                                2
                            ),

                    'expense_basis' =>
                        $expenseBasis,

                    'desired_profit_daily' =>
                        round(
                            $desiredProfitDaily,
                            2
                        ),

                    'contribution_margin_pct' =>
                        $marginPct === null
                            ? null
                            : round(
                                $marginPct,
                                4
                            ),

                    'margin_source' =>
                        $marginSource,

                    'required_sales_today' =>
                        $requiredSalesToday === null
                            ? null
                            : round(
                                $requiredSalesToday,
                                2
                            ),

                    'actual_sales_today' =>
                        round(
                            $todaySales['revenue'],
                            2
                        ),

                    'still_needed_today' =>
                        $stillNeededToday === null
                            ? null
                            : round(
                                $stillNeededToday,
                                2
                            ),

                    'calculation_available' =>
                        $requiredSalesToday
                        !== null,

                    'unavailable_reason' =>
                        $requiredSalesToday === null
                            ? 'An expense basis and a trustworthy gross-margin value are required.'
                            : null,
                ],

                'kpis' =>
                    $this->targetPerformance(
                        $targets,
                        $actuals
                    ),

                'forecast' =>
                    $this->forecastData(
                        $tenantId,
                        $branchId
                    ),

                'recurring' => [
                    'due_next_7_days' =>
                        $this->dueRecurring(
                            $tenantId,
                            $branchId,
                            7
                        ),

                    'posting_policy' =>
                        'draft_for_human_approval',

                    'silent_posting_allowed' =>
                        false,
                ],
            ],
        ]);
    }

    public function budgets(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId($request);

        $rows = DB::table(
            'finance_planning_budgets'
        )
            ->where(
                'tenant_id',
                $tenantId
            )
            ->orderByDesc(
                'starts_on'
            )
            ->orderByDesc(
                'id'
            )
            ->limit(100)
            ->get();

        foreach ($rows as $row) {
            $row->lines = DB::table(
                'finance_planning_budget_lines'
            )
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->where(
                    'finance_planning_budget_id',
                    $row->id
                )
                ->orderBy('id')
                ->get();
        }

        return response()->json([
            'data' => $rows,
        ]);
    }

    public function storeBudget(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId($request);

        $validated = $this->validateBudget(
            $request
        );

        $this->assertNoActiveBudgetOverlap(
            $tenantId,
            $validated,
            null
        );

        $userId =
            $request->user()?->id;

        $uuid =
            (string) Str::uuid();

        $budgetId = DB::transaction(
            function () use (
                $validated,
                $tenantId,
                $userId,
                $uuid
            ) {
                $id = DB::table(
                    'finance_planning_budgets'
                )->insertGetId([
                    'uuid' =>
                        $uuid,

                    'tenant_id' =>
                        $tenantId,

                    'branch_id' =>
                        $validated['branch_id']
                        ?? null,

                    'name' =>
                        $validated['name'],

                    'period_type' =>
                        $validated['period_type'],

                    'starts_on' =>
                        $validated['starts_on'],

                    'ends_on' =>
                        $validated['ends_on'],

                    'currency_code' =>
                        strtoupper(
                            $validated[
                                'currency_code'
                            ]
                        ),

                    'working_days' =>
                        $validated[
                            'working_days'
                        ],

                    'desired_profit_amount' =>
                        $validated[
                            'desired_profit_amount'
                        ],

                    'status' =>
                        $validated['status'],

                    'notes' =>
                        $validated['notes']
                        ?? null,

                    'metadata' =>
                        null,

                    'created_by' =>
                        $userId,

                    'updated_by' =>
                        $userId,

                    'created_at' =>
                        now(),

                    'updated_at' =>
                        now(),
                ]);

                foreach (
                    $validated['lines']
                    as $line
                ) {
                    DB::table(
                        'finance_planning_budget_lines'
                    )->insert([
                        'finance_planning_budget_id' =>
                            $id,

                        'tenant_id' =>
                            $tenantId,

                        'line_type' =>
                            $line['line_type'],

                        'category_key' =>
                            $line['category_key']
                            ?? null,

                        'label' =>
                            $line['label'],

                        'amount' =>
                            $line['amount'],

                        'notes' =>
                            $line['notes']
                            ?? null,

                        'metadata' =>
                            null,

                        'created_at' =>
                            now(),

                        'updated_at' =>
                            now(),
                    ]);
                }

                $this->audit(
                    $tenantId,
                    $userId,
                    'budget',
                    $id,
                    'created',
                    null,
                    [
                        'uuid' =>
                            $uuid,

                        'name' =>
                            $validated['name'],

                        'status' =>
                            $validated['status'],
                    ]
                );

                return $id;
            }
        );

        return response()->json([
            'message' =>
                'Budget created.',

            'data' =>
                $this->budgetRecord(
                    $tenantId,
                    $budgetId
                ),
        ], 201);
    }

    public function updateBudget(
        Request $request,
        string $uuid
    ): JsonResponse {
        $tenantId =
            $this->tenantId($request);

        $budget = DB::table(
            'finance_planning_budgets'
        )
            ->where(
                'tenant_id',
                $tenantId
            )
            ->where(
                'uuid',
                $uuid
            )
            ->first();

        abort_unless(
            $budget,
            404,
            'Budget not found.'
        );

        $validated =
            $this->validateBudget(
                $request
            );

        $this->assertNoActiveBudgetOverlap(
            $tenantId,
            $validated,
            (int) $budget->id
        );

        $userId =
            $request->user()?->id;

        DB::transaction(
            function () use (
                $validated,
                $tenantId,
                $budget,
                $userId
            ) {
                $before = [
                    'name' =>
                        $budget->name,

                    'status' =>
                        $budget->status,

                    'starts_on' =>
                        $budget->starts_on,

                    'ends_on' =>
                        $budget->ends_on,
                ];

                DB::table(
                    'finance_planning_budgets'
                )
                    ->where(
                        'id',
                        $budget->id
                    )
                    ->update([
                        'branch_id' =>
                            $validated[
                                'branch_id'
                            ]
                            ?? null,

                        'name' =>
                            $validated['name'],

                        'period_type' =>
                            $validated[
                                'period_type'
                            ],

                        'starts_on' =>
                            $validated[
                                'starts_on'
                            ],

                        'ends_on' =>
                            $validated[
                                'ends_on'
                            ],

                        'currency_code' =>
                            strtoupper(
                                $validated[
                                    'currency_code'
                                ]
                            ),

                        'working_days' =>
                            $validated[
                                'working_days'
                            ],

                        'desired_profit_amount' =>
                            $validated[
                                'desired_profit_amount'
                            ],

                        'status' =>
                            $validated['status'],

                        'notes' =>
                            $validated['notes']
                            ?? null,

                        'updated_by' =>
                            $userId,

                        'updated_at' =>
                            now(),
                    ]);

                DB::table(
                    'finance_planning_budget_lines'
                )
                    ->where(
                        'tenant_id',
                        $tenantId
                    )
                    ->where(
                        'finance_planning_budget_id',
                        $budget->id
                    )
                    ->delete();

                foreach (
                    $validated['lines']
                    as $line
                ) {
                    DB::table(
                        'finance_planning_budget_lines'
                    )->insert([
                        'finance_planning_budget_id' =>
                            $budget->id,

                        'tenant_id' =>
                            $tenantId,

                        'line_type' =>
                            $line['line_type'],

                        'category_key' =>
                            $line['category_key']
                            ?? null,

                        'label' =>
                            $line['label'],

                        'amount' =>
                            $line['amount'],

                        'notes' =>
                            $line['notes']
                            ?? null,

                        'metadata' =>
                            null,

                        'created_at' =>
                            now(),

                        'updated_at' =>
                            now(),
                    ]);
                }

                $this->audit(
                    $tenantId,
                    $userId,
                    'budget',
                    (int) $budget->id,
                    'updated',
                    $before,
                    [
                        'name' =>
                            $validated['name'],

                        'status' =>
                            $validated['status'],

                        'starts_on' =>
                            $validated['starts_on'],

                        'ends_on' =>
                            $validated['ends_on'],
                    ]
                );
            }
        );

        return response()->json([
            'message' =>
                'Budget updated.',

            'data' =>
                $this->budgetRecord(
                    $tenantId,
                    (int) $budget->id
                ),
        ]);
    }

    public function kpis(Request $request): JsonResponse
    {
        $tenantId =
            $this->tenantId($request);

        return response()->json([
            'data' => DB::table(
                'finance_planning_kpi_targets'
            )
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->orderByDesc(
                    'starts_on'
                )
                ->orderBy(
                    'metric_code'
                )
                ->limit(200)
                ->get(),
        ]);
    }

    public function storeKpi(Request $request): JsonResponse
    {
        $tenantId =
            $this->tenantId($request);

        $validated =
            $this->validateKpi(
                $request
            );

        $userId =
            $request->user()?->id;

        $uuid =
            (string) Str::uuid();

        $id = DB::table(
            'finance_planning_kpi_targets'
        )->insertGetId([
            'uuid' =>
                $uuid,

            'tenant_id' =>
                $tenantId,

            'branch_id' =>
                $validated['branch_id']
                ?? null,

            'metric_code' =>
                $validated[
                    'metric_code'
                ],

            'label' =>
                $validated['label'],

            'target_value' =>
                $validated[
                    'target_value'
                ],

            'unit' =>
                $validated['unit'],

            'direction' =>
                $validated['direction'],

            'starts_on' =>
                $validated['starts_on'],

            'ends_on' =>
                $validated['ends_on'],

            'weight' =>
                $validated['weight'],

            'status' =>
                $validated['status'],

            'created_by' =>
                $userId,

            'updated_by' =>
                $userId,

            'metadata' =>
                null,

            'created_at' =>
                now(),

            'updated_at' =>
                now(),
        ]);

        $this->audit(
            $tenantId,
            $userId,
            'kpi_target',
            $id,
            'created',
            null,
            $validated
        );

        return response()->json([
            'message' =>
                'KPI target created.',

            'data' =>
                DB::table(
                    'finance_planning_kpi_targets'
                )
                    ->where(
                        'id',
                        $id
                    )
                    ->first(),
        ], 201);
    }

    public function updateKpi(
        Request $request,
        string $uuid
    ): JsonResponse {
        $tenantId =
            $this->tenantId($request);

        $record = DB::table(
            'finance_planning_kpi_targets'
        )
            ->where(
                'tenant_id',
                $tenantId
            )
            ->where(
                'uuid',
                $uuid
            )
            ->first();

        abort_unless(
            $record,
            404,
            'KPI target not found.'
        );

        $validated =
            $this->validateKpi(
                $request
            );

        $userId =
            $request->user()?->id;

        DB::table(
            'finance_planning_kpi_targets'
        )
            ->where(
                'id',
                $record->id
            )
            ->update([
                'branch_id' =>
                    $validated['branch_id']
                    ?? null,

                'metric_code' =>
                    $validated[
                        'metric_code'
                    ],

                'label' =>
                    $validated['label'],

                'target_value' =>
                    $validated[
                        'target_value'
                    ],

                'unit' =>
                    $validated['unit'],

                'direction' =>
                    $validated[
                        'direction'
                    ],

                'starts_on' =>
                    $validated['starts_on'],

                'ends_on' =>
                    $validated['ends_on'],

                'weight' =>
                    $validated['weight'],

                'status' =>
                    $validated['status'],

                'updated_by' =>
                    $userId,

                'updated_at' =>
                    now(),
            ]);

        $this->audit(
            $tenantId,
            $userId,
            'kpi_target',
            (int) $record->id,
            'updated',
            (array) $record,
            $validated
        );

        return response()->json([
            'message' =>
                'KPI target updated.',

            'data' =>
                DB::table(
                    'finance_planning_kpi_targets'
                )
                    ->where(
                        'id',
                        $record->id
                    )
                    ->first(),
        ]);
    }

    public function recurring(Request $request): JsonResponse
    {
        $tenantId =
            $this->tenantId($request);

        return response()->json([
            'data' => DB::table(
                'finance_planning_recurring_transactions'
            )
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->orderBy(
                    'next_due_on'
                )
                ->orderBy(
                    'id'
                )
                ->limit(200)
                ->get(),

            'posting_policy' =>
                'draft_for_human_approval',

            'silent_posting_allowed' =>
                false,
        ]);
    }

    public function storeRecurring(
        Request $request
    ): JsonResponse {
        $tenantId =
            $this->tenantId($request);

        $validated =
            $this->validateRecurring(
                $request
            );

        $userId =
            $request->user()?->id;

        $uuid =
            (string) Str::uuid();

        $id = DB::table(
            'finance_planning_recurring_transactions'
        )->insertGetId([
            'uuid' =>
                $uuid,

            'tenant_id' =>
                $tenantId,

            'branch_id' =>
                $validated['branch_id']
                ?? null,

            'name' =>
                $validated['name'],

            'transaction_type' =>
                $validated[
                    'transaction_type'
                ],

            'amount' =>
                $validated['amount'],

            'currency_code' =>
                strtoupper(
                    $validated[
                        'currency_code'
                    ]
                ),

            'category_key' =>
                $validated[
                    'category_key'
                ]
                ?? null,

            'counterparty_name' =>
                $validated[
                    'counterparty_name'
                ]
                ?? null,

            'frequency' =>
                $validated['frequency'],

            'interval_value' =>
                $validated[
                    'interval_value'
                ],

            'day_of_month' =>
                $validated[
                    'day_of_month'
                ]
                ?? null,

            'starts_on' =>
                $validated['starts_on'],

            'ends_on' =>
                $validated['ends_on']
                ?? null,

            'next_due_on' =>
                $validated['next_due_on'],

            'status' =>
                $validated['status'],

            'approval_policy' =>
                'draft_for_human_approval',

            'template_payload' =>
                isset(
                    $validated[
                        'template_payload'
                    ]
                )
                    ? json_encode(
                        $validated[
                            'template_payload'
                        ],
                        JSON_UNESCAPED_SLASHES
                    )
                    : null,

            'created_by' =>
                $userId,

            'updated_by' =>
                $userId,

            'metadata' =>
                null,

            'created_at' =>
                now(),

            'updated_at' =>
                now(),
        ]);

        $this->audit(
            $tenantId,
            $userId,
            'recurring_transaction',
            $id,
            'created',
            null,
            [
                'uuid' =>
                    $uuid,

                'name' =>
                    $validated['name'],

                'amount' =>
                    $validated['amount'],

                'frequency' =>
                    $validated['frequency'],

                'approval_policy' =>
                    'draft_for_human_approval',
            ]
        );

        return response()->json([
            'message' =>
                'Recurring transaction rule created.',

            'data' =>
                DB::table(
                    'finance_planning_recurring_transactions'
                )
                    ->where(
                        'id',
                        $id
                    )
                    ->first(),

            'posting_policy' =>
                'draft_for_human_approval',

            'financial_posting_performed' =>
                false,
        ], 201);
    }

    public function updateRecurring(
        Request $request,
        string $uuid
    ): JsonResponse {
        $tenantId =
            $this->tenantId($request);

        $record = DB::table(
            'finance_planning_recurring_transactions'
        )
            ->where(
                'tenant_id',
                $tenantId
            )
            ->where(
                'uuid',
                $uuid
            )
            ->first();

        abort_unless(
            $record,
            404,
            'Recurring transaction not found.'
        );

        $validated =
            $this->validateRecurring(
                $request
            );

        $userId =
            $request->user()?->id;

        DB::table(
            'finance_planning_recurring_transactions'
        )
            ->where(
                'id',
                $record->id
            )
            ->update([
                'branch_id' =>
                    $validated['branch_id']
                    ?? null,

                'name' =>
                    $validated['name'],

                'transaction_type' =>
                    $validated[
                        'transaction_type'
                    ],

                'amount' =>
                    $validated['amount'],

                'currency_code' =>
                    strtoupper(
                        $validated[
                            'currency_code'
                        ]
                    ),

                'category_key' =>
                    $validated[
                        'category_key'
                    ]
                    ?? null,

                'counterparty_name' =>
                    $validated[
                        'counterparty_name'
                    ]
                    ?? null,

                'frequency' =>
                    $validated['frequency'],

                'interval_value' =>
                    $validated[
                        'interval_value'
                    ],

                'day_of_month' =>
                    $validated[
                        'day_of_month'
                    ]
                    ?? null,

                'starts_on' =>
                    $validated['starts_on'],

                'ends_on' =>
                    $validated['ends_on']
                    ?? null,

                'next_due_on' =>
                    $validated['next_due_on'],

                'status' =>
                    $validated['status'],

                'approval_policy' =>
                    'draft_for_human_approval',

                'template_payload' =>
                    isset(
                        $validated[
                            'template_payload'
                        ]
                    )
                        ? json_encode(
                            $validated[
                                'template_payload'
                            ],
                            JSON_UNESCAPED_SLASHES
                        )
                        : null,

                'updated_by' =>
                    $userId,

                'updated_at' =>
                    now(),
            ]);

        $this->audit(
            $tenantId,
            $userId,
            'recurring_transaction',
            (int) $record->id,
            'updated',
            (array) $record,
            $validated
        );

        return response()->json([
            'message' =>
                'Recurring transaction updated.',

            'data' =>
                DB::table(
                    'finance_planning_recurring_transactions'
                )
                    ->where(
                        'id',
                        $record->id
                    )
                    ->first(),

            'financial_posting_performed' =>
                false,
        ]);
    }

    public function pauseRecurring(
        Request $request,
        string $uuid
    ): JsonResponse {
        return $this->changeRecurringStatus(
            $request,
            $uuid,
            'paused'
        );
    }

    public function resumeRecurring(
        Request $request,
        string $uuid
    ): JsonResponse {
        return $this->changeRecurringStatus(
            $request,
            $uuid,
            'active'
        );
    }

    public function recurringDue(
        Request $request
    ): JsonResponse {
        $tenantId =
            $this->tenantId($request);

        $validated = $request->validate([
            'branch_id' => [
                'nullable',
                'integer',
                'min:1',
            ],

            'days' => [
                'nullable',
                'integer',
                'min:1',
                'max:90',
            ],
        ]);

        $branchId =
            isset($validated['branch_id'])
                ? (int)
                    $validated['branch_id']
                : null;

        $days =
            (int) (
                $validated['days']
                ?? 30
            );

        return response()->json([
            'data' =>
                $this->dueRecurring(
                    $tenantId,
                    $branchId,
                    $days
                ),

            'posting_policy' =>
                'draft_for_human_approval',

            'financial_posting_performed' =>
                false,
        ]);
    }

    public function forecast(Request $request): JsonResponse
    {
        $tenantId =
            $this->tenantId($request);

        $validated = $request->validate([
            'branch_id' => [
                'nullable',
                'integer',
                'min:1',
            ],
        ]);

        $branchId =
            isset($validated['branch_id'])
                ? (int)
                    $validated['branch_id']
                : null;

        return response()->json([
            'data' =>
                $this->forecastData(
                    $tenantId,
                    $branchId
                ),
        ]);
    }

    private function tenantId(Request $request): int
    {
        $tenant = $request
            ->attributes
            ->get('tenant');

        abort_unless(
            $tenant
            &&
            isset($tenant->id),
            422,
            'Tenant context is required.'
        );

        return (int) $tenant->id;
    }

    private function canManage(Request $request): bool
    {
        $user = $request->user();

        if (! $user) {
            return false;
        }

        try {
            return (bool) $user->can(
                'finance.settings.manage'
            );
        } catch (Throwable) {
            return false;
        }
    }

    private function salesMetrics(
        int $tenantId,
        ?int $branchId,
        string $from,
        string $to
    ): array {
        if (! Schema::hasTable('pharmaco_sales')) {
            return $this->emptySalesMetrics();
        }

        $query = DB::table(
            'pharmaco_sales'
        )
            ->where(
                'tenant_id',
                $tenantId
            )
            ->whereIn(
                'status',
                [
                    'dispensed',
                    'completed',
                ]
            )
            ->whereBetween(
                'business_date',
                [
                    $from,
                    $to,
                ]
            );

        if ($branchId !== null) {
            $query->where(
                'branch_id',
                $branchId
            );
        }

        $summary = $query
            ->selectRaw(
                '
                COUNT(*) as transactions,
                COALESCE(SUM(total_amount),0) as revenue,
                COALESCE(SUM(paid_amount),0) as paid,
                COALESCE(SUM(balance_amount),0) as outstanding
                '
            )
            ->first();

        $revenue =
            (float) (
                $summary->revenue
                ?? 0
            );

        $cogs = null;
        $coverage = 0.0;

        if (
            Schema::hasTable(
                'pharmaco_sale_items'
            )
            &&
            Schema::hasTable(
                'stock_batches'
            )
            &&
            Schema::hasColumn(
                'pharmaco_sale_items',
                'stock_batch_id'
            )
        ) {
            $costColumns = array_values(
                array_filter(
                    [
                        'unit_cost',
                        'original_unit_cost',
                        'inferred_unit_cost',
                    ],
                    static fn (string $column): bool =>
                        Schema::hasColumn(
                            'stock_batches',
                            $column
                        )
                )
            );

            if ($costColumns !== []) {
                $costRefs = array_map(
                    static fn (string $column): string =>
                        'batches.' . $column,
                    $costColumns
                );

                $costValue = count($costRefs) === 1
                    ? $costRefs[0]
                    : 'COALESCE('
                        . implode(
                            ',',
                            $costRefs
                        )
                        . ')';

                $costQuery = DB::table(
                    'pharmaco_sale_items as items'
                )
                    ->join(
                        'pharmaco_sales as sales',
                        'sales.id',
                        '=',
                        'items.pharmaco_sale_id'
                    )
                    ->leftJoin(
                        'stock_batches as batches',
                        'batches.id',
                        '=',
                        'items.stock_batch_id'
                    )
                    ->where(
                        'sales.tenant_id',
                        $tenantId
                    )
                    ->whereIn(
                        'sales.status',
                        [
                            'dispensed',
                            'completed',
                        ]
                    )
                    ->whereBetween(
                        'sales.business_date',
                        [
                            $from,
                            $to,
                        ]
                    );

                if ($branchId !== null) {
                    $costQuery->where(
                        'sales.branch_id',
                        $branchId
                    );
                }

                $cost = $costQuery
                    ->selectRaw(
                        '
                        COUNT(*) as item_count,
                        SUM(
                            CASE
                                WHEN '
                                . $costValue
                                . ' IS NOT NULL
                                THEN 1
                                ELSE 0
                            END
                        ) as costed_items,
                        COALESCE(
                            SUM(
                                items.quantity
                                *
                                COALESCE(
                                    '
                                    . $costValue
                                    . ',
                                    0
                                )
                            ),
                            0
                        ) as cogs
                        '
                    )
                    ->first();

                $itemCount =
                    (int) (
                        $cost->item_count
                        ?? 0
                    );

                $costedItems =
                    (int) (
                        $cost->costed_items
                        ?? 0
                    );

                if ($itemCount > 0) {
                    $coverage =
                        (
                            $costedItems
                            /
                            $itemCount
                        )
                        *
                        100;

                    $cogs =
                        (float) (
                            $cost->cogs
                            ?? 0
                        );
                }
            }
        }

        $grossProfit = null;
        $grossMargin = null;

        if (
            $cogs !== null
            &&
            $revenue > 0
        ) {
            $grossProfit =
                $revenue
                -
                $cogs;

            $grossMargin =
                (
                    $grossProfit
                    /
                    $revenue
                )
                *
                100;
        }

        return [
            'revenue' =>
                round(
                    $revenue,
                    2
                ),

            'paid' =>
                round(
                    (float) (
                        $summary->paid
                        ?? 0
                    ),
                    2
                ),

            'outstanding' =>
                round(
                    (float) (
                        $summary->outstanding
                        ?? 0
                    ),
                    2
                ),

            'transactions' =>
                (int) (
                    $summary->transactions
                    ?? 0
                ),

            'cogs' =>
                $cogs === null
                    ? null
                    : round(
                        $cogs,
                        2
                    ),

            'gross_profit' =>
                $grossProfit === null
                    ? null
                    : round(
                        $grossProfit,
                        2
                    ),

            'gross_margin_pct' =>
                $grossMargin === null
                    ? null
                    : round(
                        $grossMargin,
                        4
                    ),

            'cost_coverage_pct' =>
                round(
                    $coverage,
                    4
                ),
        ];
    }

    private function emptySalesMetrics(): array
    {
        return [
            'revenue' => 0.0,
            'paid' => 0.0,
            'outstanding' => 0.0,
            'transactions' => 0,
            'cogs' => null,
            'gross_profit' => null,
            'gross_margin_pct' => null,
            'cost_coverage_pct' => 0.0,
        ];
    }

    private function operatingExpenses(
        int $tenantId,
        ?int $branchId,
        string $from,
        string $to
    ): float {
        if (! Schema::hasTable(
            'finance_expenses'
        )) {
            return 0.0;
        }

        $query = DB::table(
            'finance_expenses'
        )
            ->where(
                'tenant_id',
                $tenantId
            )
            ->where(
                'status',
                'posted'
            )
            ->whereBetween(
                'business_date',
                [
                    $from,
                    $to,
                ]
            );

        if ($branchId !== null) {
            $query->where(
                'branch_id',
                $branchId
            );
        }

        return round(
            (float)
            $query->sum(
                'total_amount'
            ),
            2
        );
    }

    private function actualMap(
        array $sales,
        float $expenses,
        int $tenantId,
        ?int $branchId,
        string $monthStart
    ): array {
        $revenue =
            $sales['revenue'];

        $grossProfit =
            $sales['gross_profit'];

        $netProfit =
            $grossProfit === null
                ? null
                : $grossProfit
                    -
                    $expenses;

        $elapsedDays = max(
            1,
            Carbon::parse(
                $monthStart
            )->diffInDays(
                Carbon::today()
            )
            + 1
        );

        $collectionRate =
            $revenue > 0
                ? (
                    $sales['paid']
                    /
                    $revenue
                )
                *
                100
                : null;

        $expenseRatio =
            $revenue > 0
                ? (
                    $expenses
                    /
                    $revenue
                )
                *
                100
                : null;

        $netMargin =
            (
                $revenue > 0
                &&
                $netProfit !== null
            )
                ? (
                    $netProfit
                    /
                    $revenue
                )
                *
                100
                : null;

        $previousFrom = Carbon::parse(
            $monthStart
        )
            ->subMonthNoOverflow()
            ->startOfMonth()
            ->toDateString();

        $previousTo = Carbon::parse(
            $monthStart
        )
            ->subMonthNoOverflow()
            ->endOfMonth()
            ->toDateString();

        $previous = $this->salesMetrics(
            $tenantId,
            $branchId,
            $previousFrom,
            $previousTo
        );

        $salesGrowth =
            $previous['revenue'] > 0
                ? (
                    (
                        $revenue
                        -
                        $previous['revenue']
                    )
                    /
                    $previous['revenue']
                )
                *
                100
                : null;

        $payablesDue = 0.0;

        if (Schema::hasTable(
            'pharmaco_supplier_invoices'
        )) {
            $payablesDue =
                (float)
                DB::table(
                    'pharmaco_supplier_invoices'
                )
                    ->where(
                        'tenant_id',
                        $tenantId
                    )
                    ->whereNotIn(
                        'status',
                        [
                            'paid',
                            'cancelled',
                            'rejected',
                        ]
                    )
                    ->sum(
                        'balance_amount'
                    );
        }

        return [
            'sales_revenue' =>
                $revenue,

            'sales_growth_pct' =>
                $salesGrowth,

            'gross_profit' =>
                $grossProfit,

            'gross_margin_pct' =>
                $sales[
                    'gross_margin_pct'
                ],

            'net_profit' =>
                $netProfit,

            'net_margin_pct' =>
                $netMargin,

            'operating_expenses' =>
                $expenses,

            'expense_to_revenue_pct' =>
                $expenseRatio,

            'average_daily_sales' =>
                $revenue
                /
                $elapsedDays,

            'collection_rate_pct' =>
                $collectionRate,

            'receivables_outstanding' =>
                $sales['outstanding'],

            'payables_due' =>
                $payablesDue,

            'cash_runway_days' =>
                null,

            'inventory_turnover' =>
                null,
        ];
    }

    private function activeBudget(
        int $tenantId,
        ?int $branchId,
        string $date
    ): ?object {
        $query = DB::table(
            'finance_planning_budgets'
        )
            ->where(
                'tenant_id',
                $tenantId
            )
            ->where(
                'status',
                'active'
            )
            ->where(
                'starts_on',
                '<=',
                $date
            )
            ->where(
                'ends_on',
                '>=',
                $date
            );

        $this->applyBranchScope(
            $query,
            $branchId
        );

        return $query
            ->orderByDesc(
                'starts_on'
            )
            ->first();
    }

    private function budgetSummary(
        int $tenantId,
        ?object $budget
    ): array {
        $summary = [
            'sales_budget' => 0.0,
            'expense_budget' => 0.0,
            'profit_budget' => 0.0,
        ];

        if (! $budget) {
            return $summary;
        }

        $rows = DB::table(
            'finance_planning_budget_lines'
        )
            ->where(
                'tenant_id',
                $tenantId
            )
            ->where(
                'finance_planning_budget_id',
                $budget->id
            )
            ->selectRaw(
                '
                line_type,
                COALESCE(SUM(amount),0) as total
                '
            )
            ->groupBy(
                'line_type'
            )
            ->get();

        foreach ($rows as $row) {
            if (
                $row->line_type
                === 'sales'
            ) {
                $summary[
                    'sales_budget'
                ] =
                    (float)
                    $row->total;
            }

            if (
                $row->line_type
                === 'expense'
            ) {
                $summary[
                    'expense_budget'
                ] =
                    (float)
                    $row->total;
            }

            if (
                $row->line_type
                === 'profit'
            ) {
                $summary[
                    'profit_budget'
                ] =
                    (float)
                    $row->total;
            }
        }

        return $summary;
    }

    private function activeTargets(
        int $tenantId,
        ?int $branchId,
        string $date
    ) {
        $query = DB::table(
            'finance_planning_kpi_targets'
        )
            ->where(
                'tenant_id',
                $tenantId
            )
            ->where(
                'status',
                'active'
            )
            ->where(
                'starts_on',
                '<=',
                $date
            )
            ->where(
                'ends_on',
                '>=',
                $date
            );

        $this->applyBranchScope(
            $query,
            $branchId
        );

        return $query
            ->orderBy(
                'metric_code'
            )
            ->get();
    }

    private function targetPerformance(
        $targets,
        array $actuals
    ): array {
        $rows = [];

        foreach ($targets as $target) {
            $actual =
                $actuals[
                    $target->metric_code
                ]
                ?? null;

            $targetValue =
                (float)
                $target->target_value;

            $achievement = null;
            $onTarget = null;

            if ($actual !== null) {
                $actual =
                    (float) $actual;

                if (
                    $target->direction
                    === 'at_most'
                ) {
                    $onTarget =
                        $actual
                        <=
                        $targetValue;

                    $achievement =
                        $actual == 0.0
                            ? 100.0
                            : min(
                                100.0,
                                (
                                    $targetValue
                                    /
                                    $actual
                                )
                                *
                                100
                            );

                } else {
                    $onTarget =
                        $actual
                        >=
                        $targetValue;

                    if ($targetValue != 0.0) {
                        $achievement =
                            (
                                $actual
                                /
                                $targetValue
                            )
                            *
                            100;
                    }
                }
            }

            $rows[] = [
                'uuid' =>
                    $target->uuid,

                'metric_code' =>
                    $target->metric_code,

                'label' =>
                    $target->label,

                'target_value' =>
                    $targetValue,

                'actual_value' =>
                    $actual,

                'unit' =>
                    $target->unit,

                'direction' =>
                    $target->direction,

                'achievement_pct' =>
                    $achievement === null
                        ? null
                        : round(
                            $achievement,
                            2
                        ),

                'on_target' =>
                    $onTarget,

                'weight' =>
                    (float)
                    $target->weight,
            ];
        }

        return $rows;
    }

    private function forecastData(
        int $tenantId,
        ?int $branchId
    ): array {
        $today = Carbon::today();

        $currentFrom = $today
            ->copy()
            ->subDays(29)
            ->toDateString();

        $currentTo =
            $today->toDateString();

        $previousFrom = $today
            ->copy()
            ->subDays(59)
            ->toDateString();

        $previousTo = $today
            ->copy()
            ->subDays(30)
            ->toDateString();

        $current = $this->salesMetrics(
            $tenantId,
            $branchId,
            $currentFrom,
            $currentTo
        );

        $previous = $this->salesMetrics(
            $tenantId,
            $branchId,
            $previousFrom,
            $previousTo
        );

        $average =
            $current['revenue']
            /
            30;

        $previousAverage =
            $previous['revenue']
            /
            30;

        $growth =
            $previousAverage > 0
                ? (
                    (
                        $average
                        -
                        $previousAverage
                    )
                    /
                    $previousAverage
                )
                *
                100
                : null;

        $monthStart = $today
            ->copy()
            ->startOfMonth()
            ->toDateString();

        $monthActual = $this->salesMetrics(
            $tenantId,
            $branchId,
            $monthStart,
            $today->toDateString()
        );

        $remainingDays = max(
            0,
            $today->diffInDays(
                $today
                    ->copy()
                    ->endOfMonth()
            )
        );

        return [
            'basis' =>
                'genuine_completed_or_dispensed_sales',

            'lookback_days' =>
                30,

            'average_daily_sales' =>
                round(
                    $average,
                    2
                ),

            'previous_average_daily_sales' =>
                round(
                    $previousAverage,
                    2
                ),

            'trend_growth_pct' =>
                $growth === null
                    ? null
                    : round(
                        $growth,
                        2
                    ),

            'month_to_date_sales' =>
                $monthActual['revenue'],

            'remaining_calendar_days' =>
                $remainingDays,

            'projected_month_end_sales' =>
                round(
                    $monthActual['revenue']
                    +
                    (
                        $average
                        *
                        $remainingDays
                    ),
                    2
                ),
        ];
    }

    private function dueRecurring(
        int $tenantId,
        ?int $branchId,
        int $days
    ) {
        $today =
            Carbon::today();

        $until = $today
            ->copy()
            ->addDays($days)
            ->toDateString();

        $query = DB::table(
            'finance_planning_recurring_transactions'
        )
            ->where(
                'tenant_id',
                $tenantId
            )
            ->where(
                'status',
                'active'
            )
            ->whereBetween(
                'next_due_on',
                [
                    $today->toDateString(),
                    $until,
                ]
            );

        $this->applyBranchScope(
            $query,
            $branchId
        );

        return $query
            ->orderBy(
                'next_due_on'
            )
            ->get();
    }

    private function budgetRecord(
        int $tenantId,
        int $budgetId
    ): array {
        return [
            'budget' =>
                DB::table(
                    'finance_planning_budgets'
                )
                    ->where(
                        'tenant_id',
                        $tenantId
                    )
                    ->where(
                        'id',
                        $budgetId
                    )
                    ->first(),

            'lines' =>
                DB::table(
                    'finance_planning_budget_lines'
                )
                    ->where(
                        'tenant_id',
                        $tenantId
                    )
                    ->where(
                        'finance_planning_budget_id',
                        $budgetId
                    )
                    ->orderBy('id')
                    ->get(),
        ];
    }

    private function validateBudget(
        Request $request
    ): array {
        return $request->validate([
            'branch_id' => [
                'nullable',
                'integer',
                'min:1',
            ],

            'name' => [
                'required',
                'string',
                'max:191',
            ],

            'period_type' => [
                'required',
                'in:monthly,quarterly,annual,custom',
            ],

            'starts_on' => [
                'required',
                'date_format:Y-m-d',
            ],

            'ends_on' => [
                'required',
                'date_format:Y-m-d',
                'after_or_equal:starts_on',
            ],

            'currency_code' => [
                'required',
                'string',
                'size:3',
            ],

            'working_days' => [
                'required',
                'integer',
                'min:1',
                'max:366',
            ],

            'desired_profit_amount' => [
                'required',
                'numeric',
                'min:0',
            ],

            'status' => [
                'required',
                'in:draft,active,closed',
            ],

            'notes' => [
                'nullable',
                'string',
                'max:5000',
            ],

            'lines' => [
                'required',
                'array',
                'min:1',
                'max:100',
            ],

            'lines.*.line_type' => [
                'required',
                'in:sales,expense,profit',
            ],

            'lines.*.category_key' => [
                'nullable',
                'string',
                'max:100',
            ],

            'lines.*.label' => [
                'required',
                'string',
                'max:191',
            ],

            'lines.*.amount' => [
                'required',
                'numeric',
                'min:0',
            ],

            'lines.*.notes' => [
                'nullable',
                'string',
                'max:2000',
            ],
        ]);
    }

    private function assertNoActiveBudgetOverlap(
        int $tenantId,
        array $validated,
        ?int $ignoreId
    ): void {
        if (
            $validated['status']
            !== 'active'
        ) {
            return;
        }

        $query = DB::table(
            'finance_planning_budgets'
        )
            ->where(
                'tenant_id',
                $tenantId
            )
            ->where(
                'status',
                'active'
            )
            ->where(
                'starts_on',
                '<=',
                $validated['ends_on']
            )
            ->where(
                'ends_on',
                '>=',
                $validated['starts_on']
            );

        $this->applyBranchScope(
            $query,
            $validated['branch_id']
            ?? null
        );

        if ($ignoreId !== null) {
            $query->where(
                'id',
                '!=',
                $ignoreId
            );
        }

        if ($query->exists()) {
            throw ValidationException::withMessages([
                'status' => [
                    'An active budget already overlaps this scope and period.',
                ],
            ]);
        }
    }

    private function validateKpi(
        Request $request
    ): array {
        return $request->validate([
            'branch_id' => [
                'nullable',
                'integer',
                'min:1',
            ],

            'metric_code' => [
                'required',
                'string',
                'in:'
                . implode(
                    ',',
                    self::KPI_CODES
                ),
            ],

            'label' => [
                'required',
                'string',
                'max:191',
            ],

            'target_value' => [
                'required',
                'numeric',
            ],

            'unit' => [
                'required',
                'in:amount,percentage,days,ratio',
            ],

            'direction' => [
                'required',
                'in:at_least,at_most',
            ],

            'starts_on' => [
                'required',
                'date_format:Y-m-d',
            ],

            'ends_on' => [
                'required',
                'date_format:Y-m-d',
                'after_or_equal:starts_on',
            ],

            'weight' => [
                'required',
                'numeric',
                'min:0',
                'max:100',
            ],

            'status' => [
                'required',
                'in:active,inactive,closed',
            ],
        ]);
    }

    private function validateRecurring(
        Request $request
    ): array {
        return $request->validate([
            'branch_id' => [
                'nullable',
                'integer',
                'min:1',
            ],

            'name' => [
                'required',
                'string',
                'max:191',
            ],

            'transaction_type' => [
                'required',
                'in:expense,payable,journal_template,other',
            ],

            'amount' => [
                'required',
                'numeric',
                'gt:0',
            ],

            'currency_code' => [
                'required',
                'string',
                'size:3',
            ],

            'category_key' => [
                'nullable',
                'string',
                'max:100',
            ],

            'counterparty_name' => [
                'nullable',
                'string',
                'max:191',
            ],

            'frequency' => [
                'required',
                'in:daily,weekly,monthly,quarterly,yearly',
            ],

            'interval_value' => [
                'required',
                'integer',
                'min:1',
                'max:365',
            ],

            'day_of_month' => [
                'nullable',
                'integer',
                'min:1',
                'max:31',
            ],

            'starts_on' => [
                'required',
                'date_format:Y-m-d',
            ],

            'ends_on' => [
                'nullable',
                'date_format:Y-m-d',
                'after_or_equal:starts_on',
            ],

            'next_due_on' => [
                'required',
                'date_format:Y-m-d',
                'after_or_equal:starts_on',
            ],

            'status' => [
                'required',
                'in:active,paused,ended',
            ],

            'template_payload' => [
                'nullable',
                'array',
            ],
        ]);
    }

    private function changeRecurringStatus(
        Request $request,
        string $uuid,
        string $status
    ): JsonResponse {
        $tenantId =
            $this->tenantId($request);

        $record = DB::table(
            'finance_planning_recurring_transactions'
        )
            ->where(
                'tenant_id',
                $tenantId
            )
            ->where(
                'uuid',
                $uuid
            )
            ->first();

        abort_unless(
            $record,
            404,
            'Recurring transaction not found.'
        );

        $userId =
            $request->user()?->id;

        DB::table(
            'finance_planning_recurring_transactions'
        )
            ->where(
                'id',
                $record->id
            )
            ->update([
                'status' =>
                    $status,

                'updated_by' =>
                    $userId,

                'updated_at' =>
                    now(),
            ]);

        $this->audit(
            $tenantId,
            $userId,
            'recurring_transaction',
            (int) $record->id,
            $status,
            [
                'status' =>
                    $record->status,
            ],
            [
                'status' =>
                    $status,
            ]
        );

        return response()->json([
            'message' =>
                'Recurring transaction status updated.',

            'data' =>
                DB::table(
                    'finance_planning_recurring_transactions'
                )
                    ->where(
                        'id',
                        $record->id
                    )
                    ->first(),

            'financial_posting_performed' =>
                false,
        ]);
    }

    private function applyBranchScope(
        $query,
        ?int $branchId
    ): void {
        if ($branchId === null) {
            $query->whereNull(
                'branch_id'
            );

            return;
        }

        $query->where(
            'branch_id',
            $branchId
        );
    }

    private function audit(
        int $tenantId,
        ?int $actorId,
        string $subjectType,
        ?int $subjectId,
        string $action,
        mixed $before,
        mixed $after
    ): void {
        DB::table(
            'finance_planning_actions'
        )->insert([
            'uuid' =>
                (string)
                Str::uuid(),

            'tenant_id' =>
                $tenantId,

            'actor_id' =>
                $actorId,

            'subject_type' =>
                $subjectType,

            'subject_id' =>
                $subjectId,

            'action' =>
                $action,

            'before_snapshot' =>
                $before === null
                    ? null
                    : json_encode(
                        $before,
                        JSON_UNESCAPED_SLASHES
                    ),

            'after_snapshot' =>
                $after === null
                    ? null
                    : json_encode(
                        $after,
                        JSON_UNESCAPED_SLASHES
                    ),

            'metadata' =>
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
