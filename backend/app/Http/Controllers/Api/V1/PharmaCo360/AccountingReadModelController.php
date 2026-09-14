<?php

/* AQUILA_FINANCE_R50C_R7B_POSTED_ONLY_ACCOUNTING */

namespace App\Http\Controllers\Api\V1\PharmaCo360;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Symfony\Component\HttpKernel\Exception\HttpException;

class AccountingReadModelController extends Controller
{
    public function overview(Request $request): JsonResponse
    {
        [$tenantId, $branchId] = $this->scope($request);

        $trialBalance = collect($this->trialBalanceRows($tenantId, $branchId));
        $income = (float) $trialBalance->where('account_type', 'income')->sum('balance');
        $expenses = (float) $trialBalance->where('account_type', 'expense')->sum('balance');

        $mappedCashAccounts = DB::table('finance_account_mappings')
            ->where('tenant_id', $tenantId)
            ->whereIn('mapping_key', ['pos.cash', 'pos.bank', 'pos.momo'])
            ->where('is_active', true)
            ->pluck('finance_chart_of_account_id');

        $cashAndMomo = (float) $trialBalance
            ->whereIn('account_id', $mappedCashAccounts)
            ->sum('balance');

        $receivables = (float) $trialBalance
            ->whereIn('code', ['1100', '1110'])
            ->sum('balance');

        $payables = (float) $trialBalance
            ->where('code', '2000')
            ->sum('balance');

        $latestBusinessDate = DB::table('pharmaco_sales')
            ->where('tenant_id', $tenantId)
            ->when($branchId, fn ($query) => $query->where('branch_id', $branchId))
            ->max('business_date');

        $recentJournals = DB::table('finance_journal_entries')
            ->where('tenant_id', $tenantId)
            ->when($branchId, fn ($query) => $query->where('branch_id', $branchId))
            ->orderByDesc('business_date')
            ->orderByDesc('id')
            ->limit(8)
            ->get([
                'id',
                'journal_number',
                'business_date',
                'source_module',
                'source_type',
                'status',
                'total_debit',
                'total_credit',
                'memo',
            ]);

        $expenseAccounts = $trialBalance
            ->where('account_type', 'expense')
            ->sortByDesc('balance')
            ->take(6)
            ->values();

        $reconciliation = $this->reconciliationSummary(
            $tenantId,
            $branchId,
            $latestBusinessDate
        );

        $period = DB::table('finance_accounting_periods')
            ->where('tenant_id', $tenantId)
            ->when(
                $branchId,
                fn ($query) => $query->where(function ($inner) use ($branchId) {
                    $inner->whereNull('branch_id')->orWhere('branch_id', $branchId);
                })
            )
            ->orderByDesc('ends_on')
            ->first();

        $shadowCount = DB::table('finance_journal_entries')
            ->where('tenant_id', $tenantId)
            ->where('status', 'shadow_posted')
            ->count();

        $unmatchedMomo = Schema::hasTable('pharmaco_momo_reconciliations')
            ? DB::table('pharmaco_momo_reconciliations')
                ->where('tenant_id', $tenantId)
                ->whereNotIn('status', ['approved', 'matched'])
                ->count()
            : 0;

        return response()->json([
            'data' => [
                'currency' => 'RWF',
                'business_date' => $latestBusinessDate,
                'kpis' => [
                    'net_income' => $income - $expenses,
                    'cash_and_momo_balance' => $cashAndMomo,
                    'receivables' => $receivables,
                    'payables' => $payables,
                ],
                'profit_and_loss' => [
                    'income' => $income,
                    'expenses' => $expenses,
                    'net_income' => $income - $expenses,
                ],
                'account_balances' => $trialBalance->take(8)->values(),
                'expense_categories' => $expenseAccounts,
                'reconciliation' => $reconciliation,
                'tasks' => [
                    [
                        'label' => 'Shadow journals awaiting recognition policy',
                        'count' => $shadowCount,
                        'severity' => $shadowCount > 0 ? 'review' : 'clear',
                    ],
                    [
                        'label' => 'MoMo reconciliation items needing review',
                        'count' => $unmatchedMomo,
                        'severity' => $unmatchedMomo > 0 ? 'review' : 'clear',
                    ],
                    [
                        'label' => 'Accounting period configuration',
                        'count' => $period ? 0 : 1,
                        'severity' => $period ? 'clear' : 'review',
                    ],
                ],
                'recent_journals' => $recentJournals,
                'accounting_period' => $period,
                'insight' => $period
                    ? 'The latest Accounting period is available for control review.'
                    : 'No Accounting period is configured. Posting controls remain dependent on the existing period guard.',
                'write_workflows' => [
                    'status' => 'review_required',
                    'message' => 'Expenses, manual journals, actual Cash/MoMo entry, approvals, posting and reversal remain disabled until this Accounting preview is approved.',
                ],
            ],
        ]);
    }

    public function journalRegister(Request $request): JsonResponse
    {
        [$tenantId, $branchId] = $this->scope($request);

        $rows = DB::table('finance_journal_entries')
            ->where('tenant_id', $tenantId)
            ->when($branchId, fn ($query) => $query->where('branch_id', $branchId))
            ->orderByDesc('business_date')
            ->orderByDesc('id')
            ->limit(250)
            ->get();

        return response()->json(['data' => $rows]);
    }

    /*
     * AQUILA_QUICKBOOKS_QB1_CORE_REPORTING
     *
     * General Ledger reporting contract.
     *
     * READ ONLY.
     */
    public function ledger(Request $request): JsonResponse
    {
        [$tenantId, $branchId] = $this->scope($request);

        $rows = DB::table('finance_journal_lines as lines')
            ->join(
                'finance_journal_entries as entries',
                'entries.id',
                '=',
                'lines.journal_entry_id'
            )
            ->join(
                'finance_chart_of_accounts as accounts',
                'accounts.id',
                '=',
                'lines.chart_of_account_id'
            )
            ->where('entries.tenant_id', $tenantId)
            ->when($branchId, fn ($query) => $query->where('entries.branch_id', $branchId))
            ->orderByDesc('entries.business_date')
            ->orderByDesc('lines.id')
            ->limit(500)
            ->get([
                'lines.id',
                'entries.journal_number',
                'entries.business_date',
                'entries.source_module',
                'entries.source_type',
                'entries.status',
                'accounts.code',
                'accounts.name',
                'lines.debit',
                'lines.credit',
                'lines.description',
            ]);

        return response()->json(['data' => $rows]);
    }


    /*
     * AQUILA_QUICKBOOKS_QB1_1_GENERAL_LEDGER_REPORT
     *
     * QuickBooks-style General Ledger reporting endpoint.
     *
     * READ ONLY.
     *
     * The existing ledger() endpoint remains unchanged.
     */
    public function generalLedgerReport(Request $request): JsonResponse
    {
        [$tenantId, $branchId] = $this->scope($request);

        $validated = $request->validate([
            'from' => [
                'nullable',
                'date_format:Y-m-d',
            ],

            'to' => [
                'nullable',
                'date_format:Y-m-d',
            ],

            'account' => [
                'nullable',
                'string',
                'max:191',
            ],

            'q' => [
                'nullable',
                'string',
                'max:191',
            ],

            'status' => [
                'nullable',
                'string',
                'max:100',
            ],

            'page' => [
                'nullable',
                'integer',
                'min:1',
            ],

            'per_page' => [
                'nullable',
                'integer',
                'min:1',
                'max:200',
            ],
        ]);

        $from =
            $validated['from']
            ??
            null;

        $to =
            $validated['to']
            ??
            null;

        if (
            $from !== null
            &&
            $to !== null
            &&
            $from > $to
        ) {
            return response()->json([
                'message' =>
                    'The report start date must not be after the end date.',
            ], 422);
        }

        $page = max(
            1,
            (int) (
                $validated['page']
                ??
                1
            )
        );

        $perPage = min(
            200,
            max(
                1,
                (int) (
                    $validated['per_page']
                    ??
                    100
                )
            )
        );

        $allowedStatuses = [
            'posted',
            'shadow_posted',
            'draft',
            'pending',
            'approved',
            'reversed',
            'voided',
        ];

        $requestedStatuses =
            collect(
                explode(
                    ',',
                    (string) (
                        $validated['status']
                        ??
                        ''
                    )
                )
            )
                ->map(
                    static fn ($value) =>
                        strtolower(
                            trim(
                                (string) $value
                            )
                        )
                )
                ->filter()
                ->intersect(
                    $allowedStatuses
                )
                ->values();

        /*
         * Financial reporting defaults to recognised ledger entries.
         */
        $statuses =
            $requestedStatuses->isNotEmpty()
                ? $requestedStatuses->all()
                : [
                    'posted',
                    'shadow_posted',
                ];

        $query =
            DB::table(
                'finance_journal_lines as lines'
            )
                ->join(
                    'finance_journal_entries as entries',
                    'entries.id',
                    '=',
                    'lines.journal_entry_id'
                )
                ->join(
                    'finance_chart_of_accounts as accounts',
                    'accounts.id',
                    '=',
                    'lines.chart_of_account_id'
                )
                ->where(
                    'entries.tenant_id',
                    $tenantId
                )
                ->where(
                    'accounts.tenant_id',
                    $tenantId
                )
                ->whereIn(
                    'entries.status',
                    $statuses
                )
                ->when(
                    $branchId !== null,
                    fn ($builder) =>
                        $builder->where(
                            'entries.branch_id',
                            $branchId
                        )
                )
                ->when(
                    $from !== null,
                    fn ($builder) =>
                        $builder->whereDate(
                            'entries.business_date',
                            '>=',
                            $from
                        )
                )
                ->when(
                    $to !== null,
                    fn ($builder) =>
                        $builder->whereDate(
                            'entries.business_date',
                            '<=',
                            $to
                        )
                );

        $account =
            trim(
                (string) (
                    $validated['account']
                    ??
                    ''
                )
            );

        if ($account !== '') {
            $query->where(
                function ($builder) use ($account): void {
                    $builder
                        ->where(
                            'accounts.code',
                            $account
                        )
                        ->orWhere(
                            'accounts.name',
                            'like',
                            '%' . $account . '%'
                        );
                }
            );
        }

        $search =
            trim(
                (string) (
                    $validated['q']
                    ??
                    ''
                )
            );

        if ($search !== '') {
            $query->where(
                function ($builder) use ($search): void {
                    $like =
                        '%' . $search . '%';

                    $builder
                        ->where(
                            'entries.journal_number',
                            'like',
                            $like
                        )
                        ->orWhere(
                            'accounts.code',
                            'like',
                            $like
                        )
                        ->orWhere(
                            'accounts.name',
                            'like',
                            $like
                        )
                        ->orWhere(
                            'lines.description',
                            'like',
                            $like
                        );
                }
            );
        }

        $totalRows =
            (clone $query)
                ->count(
                    'lines.id'
                );

        $totals =
            (clone $query)
                ->selectRaw(
                    'COALESCE(SUM(lines.debit), 0) as total_debit, '
                    . 'COALESCE(SUM(lines.credit), 0) as total_credit'
                )
                ->first();

        $rows =
            (clone $query)
                ->orderBy(
                    'entries.business_date'
                )
                ->orderBy(
                    'entries.id'
                )
                ->orderBy(
                    'lines.id'
                )
                ->forPage(
                    $page,
                    $perPage
                )
                ->get([
                    'lines.id',
                    'lines.journal_entry_id',
                    'lines.chart_of_account_id as account_id',

                    'entries.journal_number',
                    'entries.business_date',
                    'entries.status',

                    'accounts.code',
                    'accounts.name',
                    'accounts.account_type',
                    'accounts.normal_balance',

                    'lines.debit',
                    'lines.credit',
                    'lines.description',
                ])
                ->map(
                    static function ($row): array {
                        $debit =
                            (float) $row->debit;

                        $credit =
                            (float) $row->credit;

                        $normalDebit =
                            strtolower(
                                (string) $row->normal_balance
                            )
                            ===
                            'debit';

                        return [
                            'id' =>
                                (int) $row->id,

                            'journal_entry_id' =>
                                (int) $row->journal_entry_id,

                            'account_id' =>
                                (int) $row->account_id,

                            'journal_number' =>
                                $row->journal_number,

                            'business_date' =>
                                $row->business_date,

                            'status' =>
                                $row->status,

                            'account_code' =>
                                $row->code,

                            'account_name' =>
                                $row->name,

                            'account_type' =>
                                $row->account_type,

                            'normal_balance' =>
                                $row->normal_balance,

                            'debit' =>
                                $debit,

                            'credit' =>
                                $credit,

                            'movement' =>
                                round(
                                    $debit - $credit,
                                    2
                                ),

                            'natural_movement' =>
                                round(
                                    $normalDebit
                                        ? $debit - $credit
                                        : $credit - $debit,
                                    2
                                ),

                            'description' =>
                                $row->description,
                        ];
                    }
                )
                ->values();

        $totalDebit =
            (float) (
                $totals->total_debit
                ??
                0
            );

        $totalCredit =
            (float) (
                $totals->total_credit
                ??
                0
            );

        $difference =
            round(
                $totalDebit
                -
                $totalCredit,
                2
            );

        return response()->json([
            'data' =>
                $rows,

            'summary' => [
                'total_debit' =>
                    $totalDebit,

                'total_credit' =>
                    $totalCredit,

                'difference' =>
                    $difference,

                'balanced' =>
                    abs(
                        $difference
                    )
                    <=
                    0.01,

                'row_count' =>
                    (int) $totalRows,
            ],

            'filters' => [
                'from' =>
                    $from,

                'to' =>
                    $to,

                'account' =>
                    $account !== ''
                        ? $account
                        : null,

                'q' =>
                    $search !== ''
                        ? $search
                        : null,

                'statuses' =>
                    $statuses,
            ],

            'pagination' => [
                'page' =>
                    $page,

                'per_page' =>
                    $perPage,

                'total' =>
                    (int) $totalRows,

                'last_page' =>
                    max(
                        1,
                        (int) ceil(
                            $totalRows
                            /
                            $perPage
                        )
                    ),
            ],

            'reporting_basis' =>
                'recognised-ledger',

            'existing_general_ledger_endpoint_preserved' =>
                true,

            'read_only' =>
                true,

            'quickbooks_upgrade_phase' =>
                'QB1.1',
        ]);
    }


    /*
     * AQUILA_QUICKBOOKS_QB2_1_RECONCILIATION_DASHBOARD
     *
     * READ ONLY.
     *
     * Existing owners remain authoritative:
     * - POS owns payment/cash operational writes.
     * - Existing MoMo controller owns approve/reject.
     */
    public function reconciliationDashboard(Request $request): JsonResponse
    {
        [$tenantId, $branchId] = $this->scope($request);

        $validated = $request->validate([
            'from' => [
                'nullable',
                'date_format:Y-m-d',
            ],

            'to' => [
                'nullable',
                'date_format:Y-m-d',
            ],

            'payment_method' => [
                'nullable',
                'string',
                'max:80',
            ],
        ]);

        $from =
            $validated['from']
            ??
            null;

        $to =
            $validated['to']
            ??
            null;

        if (
            $from !== null
            &&
            $to !== null
            &&
            $from > $to
        ) {
            return response()->json([
                'message' =>
                    'The report start date must not be after the end date.',
            ], 422);
        }

        $paymentMethod =
            strtolower(
                trim(
                    (string) (
                        $validated['payment_method']
                        ??
                        ''
                    )
                )
            );

        $payments =
            DB::table(
                'pharmaco_payments as payments'
            )
                ->leftJoin(
                    'pharmaco_pos_sessions as sessions',
                    'sessions.id',
                    '=',
                    'payments.pos_session_id'
                )
                ->where(
                    'payments.tenant_id',
                    $tenantId
                )
                ->when(
                    $branchId !== null,
                    fn ($query) =>
                        $query->where(
                            'sessions.branch_id',
                            $branchId
                        )
                )
                ->when(
                    $from !== null,
                    fn ($query) =>
                        $query->whereDate(
                            'payments.business_date',
                            '>=',
                            $from
                        )
                )
                ->when(
                    $to !== null,
                    fn ($query) =>
                        $query->whereDate(
                            'payments.business_date',
                            '<=',
                            $to
                        )
                )
                ->when(
                    $paymentMethod !== '',
                    fn ($query) =>
                        $query->whereRaw(
                            'LOWER(payments.payment_method) = ?',
                            [
                                $paymentMethod,
                            ]
                        )
                );

        $paymentSummary =
            (clone $payments)
                ->selectRaw(
                    'COUNT(payments.id) as transaction_count, '
                    . 'COALESCE(SUM(payments.amount), 0) as recorded_amount'
                )
                ->first();

        $paymentMethods =
            (clone $payments)
                ->selectRaw(
                    'LOWER(payments.payment_method) as payment_method, '
                    . 'COUNT(payments.id) as transaction_count, '
                    . 'COALESCE(SUM(payments.amount), 0) as amount'
                )
                ->groupByRaw(
                    'LOWER(payments.payment_method)'
                )
                ->orderBy(
                    'payment_method'
                )
                ->get()
                ->map(
                    static fn ($row): array => [
                        'payment_method' =>
                            $row->payment_method,

                        'transaction_count' =>
                            (int) $row->transaction_count,

                        'amount' =>
                            (float) $row->amount,
                    ]
                )
                ->values();

        $paymentStatuses =
            (clone $payments)
                ->selectRaw(
                    'LOWER(payments.status) as status, '
                    . 'COUNT(payments.id) as transaction_count, '
                    . 'COALESCE(SUM(payments.amount), 0) as amount'
                )
                ->groupByRaw(
                    'LOWER(payments.status)'
                )
                ->orderBy(
                    'status'
                )
                ->get()
                ->map(
                    static fn ($row): array => [
                        'status' =>
                            $row->status,

                        'transaction_count' =>
                            (int) $row->transaction_count,

                        'amount' =>
                            (float) $row->amount,
                    ]
                )
                ->values();

        $paymentReconciliations =
            DB::table(
                'pharmaco_payment_reconciliations as reconciliations'
            )
                ->join(
                    'pharmaco_payments as payments',
                    'payments.id',
                    '=',
                    'reconciliations.pharmaco_payment_id'
                )
                ->leftJoin(
                    'pharmaco_pos_sessions as sessions',
                    'sessions.id',
                    '=',
                    'payments.pos_session_id'
                )
                ->where(
                    'reconciliations.tenant_id',
                    $tenantId
                )
                ->where(
                    'payments.tenant_id',
                    $tenantId
                )
                ->when(
                    $branchId !== null,
                    fn ($query) =>
                        $query->where(
                            'sessions.branch_id',
                            $branchId
                        )
                )
                ->when(
                    $from !== null,
                    fn ($query) =>
                        $query->whereDate(
                            'payments.business_date',
                            '>=',
                            $from
                        )
                )
                ->when(
                    $to !== null,
                    fn ($query) =>
                        $query->whereDate(
                            'payments.business_date',
                            '<=',
                            $to
                        )
                )
                ->when(
                    $paymentMethod !== '',
                    fn ($query) =>
                        $query->whereRaw(
                            'LOWER(payments.payment_method) = ?',
                            [
                                $paymentMethod,
                            ]
                        )
                );

        $paymentReconciliationTotals =
            (clone $paymentReconciliations)
                ->selectRaw(
                    'COUNT(reconciliations.id) as reconciliation_count, '
                    . 'COALESCE(SUM(reconciliations.expected_amount), 0) as expected_amount, '
                    . 'COALESCE(SUM(reconciliations.settled_amount), 0) as settled_amount, '
                    . 'COALESCE(SUM(reconciliations.variance_amount), 0) as variance_amount'
                )
                ->first();

        $paymentReconciliationStatuses =
            (clone $paymentReconciliations)
                ->selectRaw(
                    'LOWER(reconciliations.reconciliation_status) as status, '
                    . 'COUNT(reconciliations.id) as reconciliation_count, '
                    . 'COALESCE(SUM(reconciliations.variance_amount), 0) as variance_amount'
                )
                ->groupByRaw(
                    'LOWER(reconciliations.reconciliation_status)'
                )
                ->orderBy(
                    'status'
                )
                ->get()
                ->map(
                    static fn ($row): array => [
                        'status' =>
                            $row->status,

                        'reconciliation_count' =>
                            (int) $row->reconciliation_count,

                        'variance_amount' =>
                            (float) $row->variance_amount,
                    ]
                )
                ->values();

        $paymentCount =
            (int) (
                $paymentSummary->transaction_count
                ??
                0
            );

        $reconciliationCount =
            (int) (
                $paymentReconciliationTotals->reconciliation_count
                ??
                0
            );

        $unreconciledPaymentCount =
            max(
                0,
                $paymentCount
                -
                $reconciliationCount
            );

        $coveragePercent =
            $paymentCount > 0
                ? round(
                    (
                        $reconciliationCount
                        /
                        $paymentCount
                    )
                    *
                    100,
                    2
                )
                : 0.0;

        $momo =
            DB::table(
                'pharmaco_momo_reconciliations as momo'
            )
                ->leftJoin(
                    'pharmaco_payments as payments',
                    'payments.id',
                    '=',
                    'momo.pharmaco_payment_id'
                )
                ->leftJoin(
                    'pharmaco_pos_sessions as sessions',
                    'sessions.id',
                    '=',
                    'payments.pos_session_id'
                )
                ->where(
                    'momo.tenant_id',
                    $tenantId
                )
                ->when(
                    $branchId !== null,
                    fn ($query) =>
                        $query->where(
                            'sessions.branch_id',
                            $branchId
                        )
                )
                ->when(
                    $from !== null,
                    fn ($query) =>
                        $query->whereDate(
                            'payments.business_date',
                            '>=',
                            $from
                        )
                )
                ->when(
                    $to !== null,
                    fn ($query) =>
                        $query->whereDate(
                            'payments.business_date',
                            '<=',
                            $to
                        )
                );

        $momoTotals =
            (clone $momo)
                ->selectRaw(
                    'COUNT(momo.id) as reconciliation_count, '
                    . 'SUM(CASE WHEN momo.pharmaco_payment_id IS NOT NULL THEN 1 ELSE 0 END) as linked_payment_count, '
                    . 'SUM(CASE WHEN momo.reviewed_at IS NOT NULL THEN 1 ELSE 0 END) as reviewed_count, '
                    . 'COALESCE(SUM(momo.amount_variance), 0) as amount_variance'
                )
                ->first();

        $momoStatuses =
            (clone $momo)
                ->selectRaw(
                    'LOWER(momo.status) as status, '
                    . 'COUNT(momo.id) as reconciliation_count, '
                    . 'COALESCE(SUM(momo.amount_variance), 0) as amount_variance'
                )
                ->groupByRaw(
                    'LOWER(momo.status)'
                )
                ->orderBy(
                    'status'
                )
                ->get()
                ->map(
                    static fn ($row): array => [
                        'status' =>
                            $row->status,

                        'reconciliation_count' =>
                            (int) $row->reconciliation_count,

                        'amount_variance' =>
                            (float) $row->amount_variance,
                    ]
                )
                ->values();

        $momoDecisions =
            (clone $momo)
                ->selectRaw(
                    'LOWER(momo.decision) as decision, '
                    . 'COUNT(momo.id) as reconciliation_count'
                )
                ->groupByRaw(
                    'LOWER(momo.decision)'
                )
                ->orderBy(
                    'decision'
                )
                ->get()
                ->map(
                    static fn ($row): array => [
                        'decision' =>
                            $row->decision,

                        'reconciliation_count' =>
                            (int) $row->reconciliation_count,
                    ]
                )
                ->values();

        $cashSessions =
            DB::table(
                'pharmaco_pos_sessions as sessions'
            )
                ->where(
                    'sessions.tenant_id',
                    $tenantId
                )
                ->when(
                    $branchId !== null,
                    fn ($query) =>
                        $query->where(
                            'sessions.branch_id',
                            $branchId
                        )
                )
                ->when(
                    $from !== null,
                    fn ($query) =>
                        $query->whereDate(
                            'sessions.business_date',
                            '>=',
                            $from
                        )
                )
                ->when(
                    $to !== null,
                    fn ($query) =>
                        $query->whereDate(
                            'sessions.business_date',
                            '<=',
                            $to
                        )
                );

        $cashTotals =
            (clone $cashSessions)
                ->selectRaw(
                    'COUNT(sessions.id) as session_count, '
                    . 'COALESCE(SUM(sessions.opening_float_amount), 0) as opening_float_amount, '
                    . 'COALESCE(SUM(sessions.expected_cash_amount), 0) as expected_cash_amount, '
                    . 'COALESCE(SUM(sessions.declared_cash_amount), 0) as declared_cash_amount, '
                    . 'COALESCE(SUM(sessions.cash_drop_amount), 0) as cash_drop_amount, '
                    . 'COALESCE(SUM(sessions.balance_clearance_amount), 0) as balance_clearance_amount, '
                    . 'COALESCE(SUM(sessions.variance_amount), 0) as variance_amount, '
                    . 'SUM(CASE WHEN ABS(COALESCE(sessions.variance_amount, 0)) > 0.01 THEN 1 ELSE 0 END) as variance_session_count'
                )
                ->first();

        $cashStatuses =
            (clone $cashSessions)
                ->selectRaw(
                    'LOWER(sessions.status) as status, '
                    . 'COUNT(sessions.id) as session_count, '
                    . 'COALESCE(SUM(sessions.variance_amount), 0) as variance_amount'
                )
                ->groupByRaw(
                    'LOWER(sessions.status)'
                )
                ->orderBy(
                    'status'
                )
                ->get()
                ->map(
                    static fn ($row): array => [
                        'status' =>
                            $row->status,

                        'session_count' =>
                            (int) $row->session_count,

                        'variance_amount' =>
                            (float) $row->variance_amount,
                    ]
                )
                ->values();

        return response()->json([
            'data' => [
                'payments' => [
                    'transaction_count' =>
                        $paymentCount,

                    'recorded_amount' =>
                        (float) (
                            $paymentSummary->recorded_amount
                            ??
                            0
                        ),

                    'methods' =>
                        $paymentMethods,

                    'statuses' =>
                        $paymentStatuses,
                ],

                'payment_reconciliation' => [
                    'reconciliation_count' =>
                        $reconciliationCount,

                    'unreconciled_payment_count' =>
                        $unreconciledPaymentCount,

                    'coverage_percent' =>
                        $coveragePercent,

                    'expected_amount' =>
                        (float) (
                            $paymentReconciliationTotals->expected_amount
                            ??
                            0
                        ),

                    'settled_amount' =>
                        (float) (
                            $paymentReconciliationTotals->settled_amount
                            ??
                            0
                        ),

                    'variance_amount' =>
                        (float) (
                            $paymentReconciliationTotals->variance_amount
                            ??
                            0
                        ),

                    'statuses' =>
                        $paymentReconciliationStatuses,
                ],

                'momo' => [
                    'reconciliation_count' =>
                        (int) (
                            $momoTotals->reconciliation_count
                            ??
                            0
                        ),

                    'linked_payment_count' =>
                        (int) (
                            $momoTotals->linked_payment_count
                            ??
                            0
                        ),

                    'reviewed_count' =>
                        (int) (
                            $momoTotals->reviewed_count
                            ??
                            0
                        ),

                    'amount_variance' =>
                        (float) (
                            $momoTotals->amount_variance
                            ??
                            0
                        ),

                    'statuses' =>
                        $momoStatuses,

                    'decisions' =>
                        $momoDecisions,

                    'existing_review_workflow' =>
                        true,
                ],

                'cash' => [
                    'session_count' =>
                        (int) (
                            $cashTotals->session_count
                            ??
                            0
                        ),

                    'opening_float_amount' =>
                        (float) (
                            $cashTotals->opening_float_amount
                            ??
                            0
                        ),

                    'expected_cash_amount' =>
                        (float) (
                            $cashTotals->expected_cash_amount
                            ??
                            0
                        ),

                    'declared_cash_amount' =>
                        (float) (
                            $cashTotals->declared_cash_amount
                            ??
                            0
                        ),

                    'cash_drop_amount' =>
                        (float) (
                            $cashTotals->cash_drop_amount
                            ??
                            0
                        ),

                    'balance_clearance_amount' =>
                        (float) (
                            $cashTotals->balance_clearance_amount
                            ??
                            0
                        ),

                    'variance_amount' =>
                        (float) (
                            $cashTotals->variance_amount
                            ??
                            0
                        ),

                    'variance_session_count' =>
                        (int) (
                            $cashTotals->variance_session_count
                            ??
                            0
                        ),

                    'statuses' =>
                        $cashStatuses,

                    'existing_pos_session_owner' =>
                        true,
                ],

                'capabilities' => [
                    'cash_session_control' =>
                        true,

                    'momo_reconciliation' =>
                        true,

                    'momo_review_approval' =>
                        true,

                    'generic_payment_reconciliation_table' =>
                        true,

                    'bank_statement_import' =>
                        false,

                    'bank_feed' =>
                        false,

                    'bank_statement_matching' =>
                        false,

                    'reconciliation_locking' =>
                        false,
                ],
            ],

            'filters' => [
                'from' =>
                    $from,

                'to' =>
                    $to,

                'payment_method' =>
                    $paymentMethod !== ''
                        ? $paymentMethod
                        : null,

                'tenant_id' =>
                    $tenantId,

                'branch_id' =>
                    $branchId,
            ],

            'read_only' =>
                true,

            'quickbooks_upgrade_phase' =>
                'QB2.1',

            'ownership' => [
                'payments' =>
                    'existing-pos-sales-owner',

                'cash_sessions' =>
                    'existing-pos-session-owner',

                'momo_decisions' =>
                    'existing-momo-reconciliation-owner',

                'finance_dashboard' =>
                    'read-model-only',
            ],
        ]);
    }

    public function trialBalance(Request $request): JsonResponse
    {
        [$tenantId, $branchId] = $this->scope($request);

        $validated = $request->validate([
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d'],
            'include_zero' => ['nullable', 'boolean'],
        ]);

        $from = $validated['from'] ?? null;
        $to = $validated['to'] ?? null;

        if (
            $from !== null
            &&
            $to !== null
            &&
            $from > $to
        ) {
            return response()->json([
                'message' => 'The report start date must not be after the end date.',
            ], 422);
        }

        $includeZero = array_key_exists(
            'include_zero',
            $validated
        )
            ? (bool) $validated['include_zero']
            : true;

        $rows = collect(
            $this->trialBalanceRows(
                $tenantId,
                $branchId,
                $from,
                $to
            )
        );

        if (! $includeZero) {
            $rows = $rows
                ->filter(
                    static fn (array $row): bool =>
                        abs(
                            (float) $row['debit']
                        )
                        >
                        0.005
                        ||
                        abs(
                            (float) $row['credit']
                        )
                        >
                        0.005
                )
                ->values();
        }

        $totalDebit = (float) $rows->sum(
            'debit'
        );

        $totalCredit = (float) $rows->sum(
            'credit'
        );

        $difference = round(
            $totalDebit
            -
            $totalCredit,
            2
        );

        return response()->json([
            /*
             * Existing Accounting UI contract preserved.
             */
            'data' => $rows->values(),

            'summary' => [
                'total_debit' =>
                    $totalDebit,

                'total_credit' =>
                    $totalCredit,

                'difference' =>
                    $difference,

                'balanced' =>
                    abs($difference) <= 0.01,

                'account_count' =>
                    $rows->count(),

                'non_zero_account_count' =>
                    $rows
                        ->filter(
                            static fn (array $row): bool =>
                                abs(
                                    (float) $row['debit']
                                )
                                >
                                0.005
                                ||
                                abs(
                                    (float) $row['credit']
                                )
                                >
                                0.005
                        )
                        ->count(),
            ],

            'filters' => [
                'from' =>
                    $from,

                'to' =>
                    $to,

                'include_zero' =>
                    $includeZero,
            ],

            'reporting_basis' =>
                'posted-and-shadow-posted-ledger',

            'read_only' =>
                true,
        ]);
    }

    public function reportingHealth(Request $request): JsonResponse
    {
        [$tenantId, $branchId] = $this->scope($request);

        $validated = $request->validate([
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d'],
        ]);

        $from = $validated['from'] ?? null;
        $to = $validated['to'] ?? null;

        if (
            $from !== null
            &&
            $to !== null
            &&
            $from > $to
        ) {
            return response()->json([
                'message' => 'The report start date must not be after the end date.',
            ], 422);
        }

        $trial = collect(
            $this->trialBalanceRows(
                $tenantId,
                $branchId,
                $from,
                $to
            )
        );

        $totalDebit =
            (float) $trial->sum('debit');

        $totalCredit =
            (float) $trial->sum('credit');

        $difference = round(
            $totalDebit
            -
            $totalCredit,
            2
        );

        $journalQuery =
            DB::table(
                'finance_journal_entries'
            )
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->whereIn(
                    'status',
                    [
                        'posted',
                        'shadow_posted',
                    ]
                )
                ->when(
                    $branchId !== null,
                    fn ($builder) =>
                        $builder->where(
                            'branch_id',
                            $branchId
                        )
                )
                ->when(
                    $from !== null,
                    fn ($builder) =>
                        $builder->whereDate(
                            'business_date',
                            '>=',
                            $from
                        )
                )
                ->when(
                    $to !== null,
                    fn ($builder) =>
                        $builder->whereDate(
                            'business_date',
                            '<=',
                            $to
                        )
                );

        return response()->json([
            'data' => [
                'trial_balance' => [
                    'status' =>
                        abs($difference) <= 0.01
                            ? 'passed'
                            : 'failed',

                    'total_debit' =>
                        $totalDebit,

                    'total_credit' =>
                        $totalCredit,

                    'difference' =>
                        $difference,

                    'account_count' =>
                        $trial->count(),
                ],

                'journal' => [
                    'posted_entry_count' =>
                        (clone $journalQuery)
                            ->where(
                                'status',
                                'posted'
                            )
                            ->count(),

                    'shadow_posted_entry_count' =>
                        (clone $journalQuery)
                            ->where(
                                'status',
                                'shadow_posted'
                            )
                            ->count(),

                    'latest_business_date' =>
                        (clone $journalQuery)
                            ->max(
                                'business_date'
                            ),
                ],

                'scope' => [
                    'tenant_id' =>
                        $tenantId,

                    'branch_id' =>
                        $branchId,

                    'from' =>
                        $from,

                    'to' =>
                        $to,
                ],

                'read_only' =>
                    true,

                'quickbooks_upgrade_phase' =>
                    'QB1',
            ],
        ]);
    }



    public function chartOfAccounts(Request $request): JsonResponse
    {
        [$tenantId] = $this->scope($request);

        return response()->json([
            'data' => DB::table('finance_chart_of_accounts')
                ->where('tenant_id', $tenantId)
                ->orderBy('code')
                ->get(),
        ]);
    }

    public function mappings(Request $request): JsonResponse
    {
        [$tenantId, $branchId] = $this->scope($request);

        $rows = DB::table('finance_account_mappings as mappings')
            ->join(
                'finance_chart_of_accounts as accounts',
                'accounts.id',
                '=',
                'mappings.finance_chart_of_account_id'
            )
            ->where('mappings.tenant_id', $tenantId)
            ->where(function ($query) use ($branchId) {
                $query->whereNull('mappings.branch_id');

                if ($branchId) {
                    $query->orWhere('mappings.branch_id', $branchId);
                }
            })
            ->orderBy('mappings.mapping_key')
            ->get([
                'mappings.id',
                'mappings.mapping_key',
                'mappings.source_module',
                'mappings.source_type',
                'mappings.payment_method',
                'mappings.currency_code',
                'mappings.is_default',
                'mappings.is_active',
                'accounts.code as account_code',
                'accounts.name as account_name',
                'accounts.account_type',
            ]);

        return response()->json(['data' => $rows]);
    }

    public function businessDates(Request $request): JsonResponse
    {
        [$tenantId, $branchId] = $this->scope($request);

        $rows = $this->completedPaidAnalyticsSalesQuery(DB::table('pharmaco_sales'))
            ->where('tenant_id', $tenantId)
            ->when($branchId, fn ($query) => $query->where('branch_id', $branchId))
            ->selectRaw(
                'business_date, COUNT(*) as sale_count, '
                . 'SUM(total_amount) as sales_total, SUM(paid_amount) as paid_total'
            )
            ->groupBy('business_date')
            ->orderByDesc('business_date')
            ->limit(90)
            ->get();

        return response()->json(['data' => $rows]);
    }

    public function periods(Request $request): JsonResponse
    {
        [$tenantId, $branchId] = $this->scope($request);

        $rows = DB::table('finance_accounting_periods')
            ->where('tenant_id', $tenantId)
            ->when(
                $branchId,
                fn ($query) => $query->where(function ($inner) use ($branchId) {
                    $inner->whereNull('branch_id')->orWhere('branch_id', $branchId);
                })
            )
            ->orderByDesc('starts_on')
            ->get();

        return response()->json(['data' => $rows]);
    }

    public function readiness(Request $request): JsonResponse
    {
        [$tenantId, $branchId] = $this->scope($request);

        $mappingKeys = DB::table('finance_account_mappings')
            ->where('tenant_id', $tenantId)
            ->where('is_active', true)
            ->pluck('mapping_key');

        return response()->json([
            'data' => [
                'tenant_id' => $tenantId,
                'branch_id' => $branchId,
                'cash_mapping' => $mappingKeys->contains('pos.cash'),
                'momo_mapping' => $mappingKeys->contains('pos.momo'),
                'operating_expense_mapping' => $mappingKeys->contains('expenses.operating'),
                'cash_over_short_mapping' => $mappingKeys->contains('reconciliation.cash_over_short'),
                'momo_over_short_mapping' => $mappingKeys->contains('reconciliation.momo_over_short'),
                'accounting_period_count' => DB::table('finance_accounting_periods')
                    ->where('tenant_id', $tenantId)
                    ->count(),
                'write_workflows_enabled' => false,
            ],
        ]);
    }

    private function trialBalanceRows(
        int $tenantId,
        ?int $branchId,
        ?string $from = null,
        ?string $to = null,
    ): array {
        return DB::table(
            'finance_chart_of_accounts as accounts'
        )
            ->leftJoin(
                'finance_journal_lines as lines',
                function ($join) use (
                    $tenantId,
                    $branchId
                ): void {
                    $join
                        ->on(
                            'lines.chart_of_account_id',
                            '=',
                            'accounts.id'
                        )
                        ->where(
                            'lines.tenant_id',
                            '=',
                            $tenantId
                        );

                    if ($branchId !== null) {
                        $join->where(
                            'lines.branch_id',
                            '=',
                            $branchId
                        );
                    }
                }
            )
            ->leftJoin(
                'finance_journal_entries as entries',
                function ($join) use (
                    $tenantId,
                    $branchId,
                    $from,
                    $to
                ): void {
                    $join
                        ->on(
                            'entries.id',
                            '=',
                            'lines.journal_entry_id'
                        )
                        ->where(
                            'entries.tenant_id',
                            '=',
                            $tenantId
                        )
                        ->whereIn(
                            'entries.status',
                            [
                                'posted',
                                'shadow_posted',
                            ]
                        );

                    if ($branchId !== null) {
                        $join->where(
                            'entries.branch_id',
                            '=',
                            $branchId
                        );
                    }

                    if ($from !== null) {
                        $join->whereDate(
                            'entries.business_date',
                            '>=',
                            $from
                        );
                    }

                    if ($to !== null) {
                        $join->whereDate(
                            'entries.business_date',
                            '<=',
                            $to
                        );
                    }
                }
            )
            ->where(
                'accounts.tenant_id',
                $tenantId
            )
            ->groupBy(
                'accounts.id',
                'accounts.code',
                'accounts.name',
                'accounts.account_type',
                'accounts.normal_balance'
            )
            ->orderBy(
                'accounts.code'
            )
            ->selectRaw(
                'accounts.id as account_id, '
                . 'accounts.code, '
                . 'accounts.name, '
                . 'accounts.account_type, '
                . 'accounts.normal_balance, '
                . 'COALESCE(SUM(CASE WHEN entries.id IS NOT NULL THEN lines.debit ELSE 0 END), 0) as debit, '
                . 'COALESCE(SUM(CASE WHEN entries.id IS NOT NULL THEN lines.credit ELSE 0 END), 0) as credit'
            )
            ->get()
            ->map(
                static function ($row): array {
                    $debit =
                        (float) $row->debit;

                    $credit =
                        (float) $row->credit;

                    $normalDebit =
                        strtolower(
                            (string) $row->normal_balance
                        )
                        ===
                        'debit';

                    $balance =
                        $normalDebit
                            ? $debit - $credit
                            : $credit - $debit;

                    $netDebit =
                        max(
                            $debit - $credit,
                            0.0
                        );

                    $netCredit =
                        max(
                            $credit - $debit,
                            0.0
                        );

                    return [
                        'account_id' =>
                            (int) $row->account_id,

                        'code' =>
                            $row->code,

                        'name' =>
                            $row->name,

                        'account_type' =>
                            $row->account_type,

                        'normal_balance' =>
                            $row->normal_balance,

                        /*
                         * Movement totals.
                         */
                        'debit' =>
                            $debit,

                        'credit' =>
                            $credit,

                        /*
                         * Natural account balance.
                         */
                        'balance' =>
                            $balance,

                        /*
                         * QuickBooks-style ending side.
                         */
                        'ending_debit' =>
                            $netDebit,

                        'ending_credit' =>
                            $netCredit,

                        'ending_side' =>
                            abs($balance) <= 0.005
                                ? 'zero'
                                : (
                                    $netDebit > 0
                                        ? 'debit'
                                        : 'credit'
                                ),
                    ];
                }
            )
            ->all();
    }


    private function reconciliationSummary(
        int $tenantId,
        ?int $branchId,
        ?string $businessDate,
    ): Collection {
        if (! $businessDate) {
            return collect();
        }

        $payments = DB::table('pharmaco_payments as payments')
            ->join('pharmaco_sales as sales', 'sales.id', '=', 'payments.pharmaco_sale_id')
            ->where('payments.tenant_id', $tenantId)
            ->whereDate('payments.business_date', $businessDate)
            ->when($branchId, fn ($query) => $query->where('sales.branch_id', $branchId))
            ->whereNotIn(DB::raw('LOWER(payments.status)'), ['cancelled', 'voided', 'rejected'])
            ->selectRaw(
                "CASE "
                . "WHEN LOWER(payments.payment_method) = 'cash' THEN 'cash' "
                . "WHEN LOWER(payments.payment_method) IN ('momo','mobile money','mobile_money','mobile-money') THEN 'momo' "
                . "ELSE 'other' END as method, "
                . "SUM(payments.amount) as system_amount, COUNT(*) as payment_count"
            )
            ->groupBy('method')
            ->get();

        return $payments->map(fn ($row) => [
            'payment_method' => $row->method,
            'system_amount' => (float) $row->system_amount,
            'payment_count' => (int) $row->payment_count,
            'actual_amount' => null,
            'variance_amount' => null,
            'status' => 'read_only',
        ]);
    }

    private function scope(Request $request): array
    {
        $user = $request->user();

        if (! $user) {
            throw new HttpException(
                401,
                'Authentication is required.'
            );
        }

        /*
         * EnsureTenantModuleActive resolves and validates the tenant
         * from X-Tenant-Slug before the Accounting controller runs.
         */
        $tenant = $request->attributes->get('tenant');
        $tenantId = (int) ($tenant?->id ?? 0);

        if ($tenantId <= 0) {
            throw new HttpException(
                422,
                'A verified tenant context is required for Accounting.'
            );
        }

        /*
         * Active tenant_users assignments are the operational source
         * of truth. Request tenant_id and branch_id values are ignored.
         */
        $assignments = $user->tenantAssignments()
            ->where('tenant_id', $tenantId)
            ->where('status', 'active')
            ->orderBy('id')
            ->get();

        if ($assignments->isEmpty()) {
            throw new HttpException(
                403,
                'You are not assigned to this Accounting tenant.'
            );
        }

        $tenantWideAssignment = $assignments->first(
            fn ($assignment) => $assignment->branch_id === null
        );

        if ($tenantWideAssignment) {
            $branchId = null;
        } else {
            $branchIds = $assignments
                ->pluck('branch_id')
                ->filter(fn ($value) => $value !== null)
                ->map(fn ($value) => (int) $value)
                ->unique()
                ->values();

            if ($branchIds->count() !== 1) {
                throw new HttpException(
                    409,
                    'A single active Accounting branch assignment is required.'
                );
            }

            $branchId = (int) $branchIds->first();
        }

        if (
            $branchId !== null
            && ! DB::table('branches')
                ->where('id', $branchId)
                ->where('tenant_id', $tenantId)
                ->where('status', 'active')
                ->exists()
        ) {
            throw new HttpException(
                403,
                'Your Accounting branch assignment is not active.'
            );
        }

        return [$tenantId, $branchId];
    }


    /**
     * UBUZIMA+ R5.7.7F
     *
     * Analytics sales authority:
     * include a sale only after the persisted paid amount
     * fully covers the persisted sale total.
     */
    /**
     * UBUZIMA+ R5.7.7G
     *
     * Sales analytics authority:
     * completed / fully-paid active sales only.
     */
    private function completedPaidAnalyticsSalesQuery($query)
    {
        return $query
            ->where('paid_amount', '>', 0)
            ->whereColumn(
                'paid_amount',
                '>=',
                'total_amount'
            )
            ->whereRaw(
                "LOWER(COALESCE(status, '')) NOT LIKE ?",
                ['%void%']
            )
            ->whereRaw(
                "LOWER(COALESCE(status, '')) NOT LIKE ?",
                ['%cancel%']
            )
            ->whereRaw(
                "LOWER(COALESCE(status, '')) NOT LIKE ?",
                ['%return%']
            );
    }

}
