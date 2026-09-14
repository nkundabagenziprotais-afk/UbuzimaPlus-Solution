<?php

/* AQUILA_FINANCE_R50C_R7B_POSTED_ONLY_COMMERCIAL */

namespace App\Http\Controllers\Api\V1\PharmaCo360;

use App\Http\Controllers\Controller;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Symfony\Component\HttpKernel\Exception\HttpException;

class FinanceCommercialReadModelController extends Controller
{
    private const EXCLUDED_STATUSES = ['cancelled', 'voided', 'rejected'];

    public function overview(Request $request): JsonResponse
    {
        [$tenantId, $branchId] = $this->scope($request);
        [$from, $to, $page, $perPage, $search] = $this->filters($request);

        $sales = $this->salesQuery($tenantId, $branchId, $from, $to);
        $payments = $this->paymentsQuery($tenantId, $branchId, $from, $to);
        $journal = $this->journalQuery($tenantId, $branchId, $from, $to);
        $pnl = $this->profitAndLossData($tenantId, $branchId, $from, $to);
        $cash = $this->cashPosition($tenantId, $branchId, $from, $to);
        $receivableBalance = $this->receivableBalance($tenantId, $branchId, $from, $to);

        $salesTotal = (float) (clone $sales)->sum('total_amount');
        $paidTotal = (float) (clone $payments)->sum('payments.amount');
        $journalCount = (int) (clone $journal)->count();

        $series = $this->salesSeries($tenantId, $branchId, $from, $to);

        $rowsQuery = $journal
            ->when($search !== '', function (Builder $query) use ($search) {
                $needle = '%' . $search . '%';
                $query->where(function (Builder $inner) use ($needle) {
                    $inner->where('journal_number', 'like', $needle)
                        ->orWhere('source_module', 'like', $needle)
                        ->orWhere('source_type', 'like', $needle)
                        ->orWhere('memo', 'like', $needle);
                });
            })
            ->orderByDesc('business_date')
            ->orderByDesc('id');

        [$rows, $meta] = $this->paginate($rowsQuery, $page, $perPage, [
            'id', 'journal_number', 'business_date', 'source_module', 'source_type',
            'status', 'total_debit', 'total_credit', 'memo',
        ]);

        return $this->response(
            module: 'overview',
            summary: [
                $this->metric('sales_total', 'Sales value', $salesTotal, 'money', 'All qualifying Sales in the selected period'),
                $this->metric('payments_total', 'Payments collected', $paidTotal, 'money', 'Completed operational payment movement'),
                $this->metric('net_income', 'Net income', $pnl['net_income'], 'money', 'Authoritative posted ledger income less expenses'),
                $this->metric('cash_position', 'Cash / Bank / MoMo', $cash['balance'], 'money', 'Mapped liquid-account ledger balance'),
                $this->metric('receivables', 'Receivables', $receivableBalance, 'money', 'Formal receivable balance or real Sales-balance fallback'),
                $this->metric('journals', 'Journal entries', $journalCount, 'number', 'Finance journal entries in scope'),
            ],
            series: $series,
            seriesLabels: ['primary' => 'Sales', 'secondary' => 'Paid'],
            columns: [
                $this->column('business_date', 'Business Date', 'date'),
                $this->column('journal_number', 'Journal', 'text'),
                $this->column('source_module', 'Source', 'text'),
                $this->column('source_type', 'Type', 'text'),
                $this->column('status', 'Status', 'status'),
                $this->column('total_debit', 'Debit', 'money'),
                $this->column('total_credit', 'Credit', 'money'),
                $this->column('memo', 'Memo', 'text'),
            ],
            rows: $rows,
            meta: $meta,
            sourceHealth: $this->sourceHealth($tenantId, $branchId),
            notes: [
                'Finance totals are generated from real scoped records; no placeholder values are used.',
                'When formal receivables are empty, Finance shows the real outstanding Sales balance as clearly-labelled operational exposure.',
            ],
            from: $from,
            to: $to,
        );
    }

    public function flow(Request $request): JsonResponse
    {
        [$tenantId, $branchId] = $this->scope($request);
        [$from, $to, $page, $perPage, $search] = $this->filters($request);

        $po = $this->safeScopedQuery('pharmaco_purchase_orders', $tenantId, $branchId, 'order_date', $from, $to);
        $invoice = $this->safeScopedQuery('pharmaco_supplier_invoices', $tenantId, $branchId, 'invoice_date', $from, $to);

        $supplierPaymentTable = Schema::hasTable('pharmaco_supplier_payments')
            ? 'pharmaco_supplier_payments'
            : (Schema::hasTable('pharmaco_supplier_invoice_payments') ? 'pharmaco_supplier_invoice_payments' : null);

        $supplierPayment = $supplierPaymentTable
            ? $this->safeScopedQuery($supplierPaymentTable, $tenantId, $branchId, 'paid_at', $from, $to)
            : null;

        $customerPayments = $this->paymentsQuery($tenantId, $branchId, $from, $to);

        $poCount = $po ? (int) (clone $po)->count() : 0;
        $poValue = $po && Schema::hasColumn('pharmaco_purchase_orders', 'total_amount')
            ? (float) (clone $po)->sum('total_amount') : 0.0;

        $invoiceCount = $invoice ? (int) (clone $invoice)->count() : 0;

        $invoiceBalance = $invoice && Schema::hasColumn('pharmaco_supplier_invoices', 'balance_amount')
            ? (float) (clone $invoice)->sum('balance_amount') : 0.0;

        $supplierPaid = $supplierPayment && $supplierPaymentTable && Schema::hasColumn($supplierPaymentTable, 'amount')
            ? (float) (clone $supplierPayment)->sum('amount') : 0.0;

        $customerPaid = (float) (clone $customerPayments)->sum('payments.amount');

        $rows = collect();
        $meta = $this->emptyMeta($page, $perPage);
        $columns = [];

        if ($invoice && $invoiceCount > 0) {
            $query = $invoice;

            if ($search !== '') {
                $needle = '%' . $search . '%';

                $query->where(function (Builder $inner) use ($needle) {
                    if (Schema::hasColumn('pharmaco_supplier_invoices', 'invoice_number')) {
                        $inner->where('invoice_number', 'like', $needle);
                    }
                    if (Schema::hasColumn('pharmaco_supplier_invoices', 'supplier_invoice_number')) {
                        $inner->orWhere('supplier_invoice_number', 'like', $needle);
                    }
                    if (Schema::hasColumn('pharmaco_supplier_invoices', 'status')) {
                        $inner->orWhere('status', 'like', $needle);
                    }
                });
            }

            $query->orderByDesc(
                Schema::hasColumn('pharmaco_supplier_invoices', 'invoice_date')
                    ? 'invoice_date'
                    : 'id'
            );

            $select = $this->existingColumns('pharmaco_supplier_invoices', [
                'id',
                'invoice_number',
                'supplier_invoice_number',
                'invoice_date',
                'due_date',
                'status',
                'total_amount',
                'paid_amount',
                'balance_amount',
            ]);

            [$rows, $meta] = $this->paginate($query, $page, $perPage, $select);

            $columns = $this->columnsForExisting('pharmaco_supplier_invoices', [
                ['invoice_number', 'Invoice', 'text'],
                ['supplier_invoice_number', 'Supplier Ref', 'text'],
                ['invoice_date', 'Invoice Date', 'date'],
                ['due_date', 'Due Date', 'date'],
                ['status', 'Status', 'status'],
                ['total_amount', 'Total', 'money'],
                ['paid_amount', 'Paid', 'money'],
                ['balance_amount', 'Balance', 'money'],
            ]);
        } elseif ($po) {
            $query = $po;

            if ($search !== '' && Schema::hasColumn('pharmaco_purchase_orders', 'po_number')) {
                $query->where('po_number', 'like', '%' . $search . '%');
            }

            $query->orderByDesc(
                Schema::hasColumn('pharmaco_purchase_orders', 'order_date')
                    ? 'order_date'
                    : 'id'
            );

            $select = $this->existingColumns('pharmaco_purchase_orders', [
                'id',
                'po_number',
                'order_date',
                'expected_delivery_date',
                'status',
                'total_amount',
            ]);

            [$rows, $meta] = $this->paginate($query, $page, $perPage, $select);

            $columns = $this->columnsForExisting('pharmaco_purchase_orders', [
                ['po_number', 'Purchase Order', 'text'],
                ['order_date', 'Order Date', 'date'],
                ['expected_delivery_date', 'Expected', 'date'],
                ['status', 'Status', 'status'],
                ['total_amount', 'Total', 'money'],
            ]);
        }

        return $this->response(
            module: 'finance-flow',
            summary: [
                $this->metric('purchase_orders', 'Purchase orders', $poCount, 'number', $this->money($poValue) . ' ordered'),
                $this->metric('supplier_invoices', 'Supplier invoices', $invoiceCount, 'number', 'Formal supplier invoice records'),
                $this->metric('payables_balance', 'Supplier balance', $invoiceBalance, 'money', 'Outstanding supplier invoice balance'),
                $this->metric('supplier_paid', 'Supplier payments', $supplierPaid, 'money', 'Recorded supplier payments'),
                $this->metric('customer_paid', 'Customer collections', $customerPaid, 'money', 'Operational Sales payments'),
            ],
            series: $this->paymentSeries($tenantId, $branchId, $from, $to),
            seriesLabels: ['primary' => 'Payments', 'secondary' => 'Sales'],
            columns: $columns,
            rows: $rows,
            meta: $meta,
            sourceHealth: $this->sourceHealth(
                $tenantId,
                $branchId,
                array_values(array_filter([
                    'pharmaco_purchase_orders',
                    'pharmaco_supplier_invoices',
                    $supplierPaymentTable,
                    'pharmaco_payments',
                ]))
            ),
            notes: [
                'Supplier invoice and payment actions remain in the audited Payables workflow rendered below this read model.',
            ],
            from: $from,
            to: $to,
        );
    }

    public function exceptions(Request $request): JsonResponse
    {
        [$tenantId, $branchId] = $this->scope($request);
        [$from, $to, $page, $perPage] = $this->filters($request);

        $rows = collect();

        $unbalanced = $this->journalQuery($tenantId, $branchId, $from, $to)
            ->whereRaw('ABS(COALESCE(total_debit,0) - COALESCE(total_credit,0)) > 0.005')
            ->count();

        if ($unbalanced > 0) {
            $rows->push(
                $this->exceptionRow(
                    'Unbalanced journals',
                    $unbalanced,
                    'critical',
                    'Journal debit and credit totals differ.'
                )
            );
        }

        $reviewJournals = $this->journalQuery($tenantId, $branchId, $from, $to)
            ->whereNotIn(DB::raw('LOWER(status)'), ['posted', 'shadow_posted'])
            ->count();

        if ($reviewJournals > 0) {
            $rows->push(
                $this->exceptionRow(
                    'Journals requiring review',
                    $reviewJournals,
                    'review',
                    'Journal entries are not yet posted/shadow-posted.'
                )
            );
        }

        $salesBalance = (float) $this
            ->salesQuery($tenantId, $branchId, $from, $to)
            ->sum('balance_amount');

        if ($salesBalance > 0) {
            $rows->push(
                $this->exceptionRow(
                    'Outstanding Sales balance',
                    $salesBalance,
                    'review',
                    'Sales contain an unpaid operational balance.',
                    'money'
                )
            );
        }

        $momo = $this->safeScopedQuery(
            'pharmaco_momo_reconciliations',
            $tenantId,
            $branchId,
            null,
            null,
            null
        );

        $unmatchedMomo = 0;

        if ($momo && Schema::hasColumn('pharmaco_momo_reconciliations', 'status')) {
            $unmatchedMomo = (int) $momo
                ->whereNotIn(DB::raw('LOWER(status)'), ['approved', 'matched'])
                ->count();

            if ($unmatchedMomo > 0) {
                $rows->push(
                    $this->exceptionRow(
                        'MoMo reconciliation items',
                        $unmatchedMomo,
                        'review',
                        'MoMo records are not approved/matched.'
                    )
                );
            }
        }

        $overdueReceivables = $this->overdueReceivableCount($tenantId, $branchId);

        if ($overdueReceivables > 0) {
            $rows->push(
                $this->exceptionRow(
                    'Overdue receivables',
                    $overdueReceivables,
                    'review',
                    'Formal customer receivables are past due.'
                )
            );
        }

        $mappingKeys = Schema::hasTable('finance_account_mappings')
            ? DB::table('finance_account_mappings')
                ->where('tenant_id', $tenantId)
                ->where('is_active', true)
                ->pluck('mapping_key')
            : collect();

        foreach (['pos.cash', 'pos.momo', 'pos.bank'] as $required) {
            if (! $mappingKeys->contains($required)) {
                $rows->push(
                    $this->exceptionRow(
                        'Missing mapping: ' . $required,
                        1,
                        'critical',
                        'Required liquid-account mapping is not active.'
                    )
                );
            }
        }

        if ($rows->isEmpty()) {
            $rows->push(
                $this->exceptionRow(
                    'No active Finance exceptions',
                    0,
                    'clear',
                    'No exception rule currently requires attention.'
                )
            );
        }

        $total = $rows->count();
        $paged = $rows
            ->slice(($page - 1) * $perPage, $perPage)
            ->values();

        return $this->response(
            module: 'exception-focus',
            summary: [
                $this->metric(
                    'exception_count',
                    'Active exception rules',
                    $rows->where('severity', '!=', 'clear')->count(),
                    'number',
                    'Commercial Finance control checks'
                ),
                $this->metric('unbalanced_journals', 'Unbalanced journals', $unbalanced, 'number', 'Debit versus credit control'),
                $this->metric('review_journals', 'Journals for review', $reviewJournals, 'number', 'Non-posted journal statuses'),
                $this->metric('unmatched_momo', 'MoMo for review', $unmatchedMomo, 'number', 'Unmatched/unapproved reconciliation rows'),
                $this->metric('overdue_receivables', 'Overdue receivables', $overdueReceivables, 'number', 'Formal receivable domain'),
            ],
            series: [],
            seriesLabels: [],
            columns: [
                $this->column('exception', 'Exception', 'text'),
                $this->column('value', 'Value', 'auto'),
                $this->column('severity', 'Severity', 'status'),
                $this->column('detail', 'Control detail', 'text'),
            ],
            rows: $paged,
            meta: $this->meta($page, $perPage, $total),
            sourceHealth: $this->sourceHealth(
                $tenantId,
                $branchId,
                [
                    'finance_journal_entries',
                    'pharmaco_sales',
                    'pharmaco_momo_reconciliations',
                    'pharmaco_customer_receivables',
                    'finance_account_mappings',
                ]
            ),
            notes: [
                'Exception rules are deterministic controls over real Finance source records.',
            ],
            from: $from,
            to: $to,
        );
    }

    public function receivables(Request $request): JsonResponse
    {
        return $this->receivableResponse($request, 'credits-receivables');
    }

    public function receivableRegister(Request $request): JsonResponse
    {
        return $this->receivableResponse($request, 'receivable-register');
    }

    public function collections(Request $request): JsonResponse
    {
        [$tenantId, $branchId] = $this->scope($request);
        [$from, $to, $page, $perPage, $search] = $this->filters($request);

        $query = $this->paymentsQuery($tenantId, $branchId, $from, $to)
            ->when($search !== '', function (Builder $query) use ($search) {
                $needle = '%' . $search . '%';

                $query->where(function (Builder $inner) use ($needle) {
                    $inner
                        ->where('payments.payment_method', 'like', $needle)
                        ->orWhere('payments.reference_number', 'like', $needle)
                        ->orWhere('payments.receipt_number', 'like', $needle)
                        ->orWhere('sales.sale_number', 'like', $needle);
                });
            })
            ->orderByDesc('payments.business_date')
            ->orderByDesc('payments.id');

        [$rows, $meta] = $this->paginate(
            $query,
            $page,
            $perPage,
            [
                'payments.id',
                'payments.business_date',
                'sales.sale_number',
                'payments.payment_method',
                'payments.amount',
                'payments.status',
                'payments.reference_number',
                'payments.receipt_number',
                'payments.received_at',
            ]
        );

        $summaryQuery = $this->paymentsQuery($tenantId, $branchId, $from, $to);

        $totalAmount = (float) (clone $summaryQuery)->sum('payments.amount');
        $count = (int) (clone $summaryQuery)->count();
        $methodCount = (int) (clone $summaryQuery)
            ->distinct()
            ->count('payments.payment_method');

        return $this->response(
            module: 'collection',
            summary: [
                $this->metric('payment_count', 'Payment records', $count, 'number', 'Operational payment transactions'),
                $this->metric('payment_total', 'Collected amount', $totalAmount, 'money', 'Actual payment records'),
                $this->metric('payment_methods', 'Payment methods', $methodCount, 'number', 'Distinct payment methods'),
                $this->metric(
                    'receivable_payments',
                    'Receivable payments',
                    $this->safeScopedCount(
                        'pharmaco_customer_receivable_payments',
                        $tenantId,
                        $branchId
                    ),
                    'number',
                    'Formal receivable payment records'
                ),
            ],
            series: $this->paymentSeries($tenantId, $branchId, $from, $to),
            seriesLabels: ['primary' => 'Payments', 'secondary' => 'Sales'],
            columns: [
                $this->column('business_date', 'Business Date', 'date'),
                $this->column('sale_number', 'Sale', 'text'),
                $this->column('payment_method', 'Method', 'status'),
                $this->column('amount', 'Amount', 'money'),
                $this->column('status', 'Status', 'status'),
                $this->column('reference_number', 'Reference', 'text'),
                $this->column('receipt_number', 'Receipt', 'text'),
                $this->column('received_at', 'Received', 'datetime'),
            ],
            rows: $rows,
            meta: $meta,
            sourceHealth: $this->sourceHealth(
                $tenantId,
                $branchId,
                [
                    'pharmaco_payments',
                    'pharmaco_sales',
                    'pharmaco_customer_receivable_payments',
                    'pharmaco_momo_reconciliations',
                ]
            ),
            notes: [
                'Collection is intentionally based on actual payment movement even when formal receivables are empty.',
            ],
            from: $from,
            to: $to,
        );
    }

    public function profitLoss(Request $request): JsonResponse
    {
        [$tenantId, $branchId] = $this->scope($request);
        [$from, $to, $page, $perPage, $search] = $this->filters($request);
        $pnl = $this->profitAndLossData($tenantId, $branchId, $from, $to);

        $query = $this
            ->accountBalanceQuery($tenantId, $branchId, $from, $to)
            ->whereIn('accounts.account_type', ['income', 'expense']);

        if ($search !== '') {
            $needle = '%' . $search . '%';

            $query->where(function (Builder $inner) use ($needle) {
                $inner
                    ->where('accounts.code', 'like', $needle)
                    ->orWhere('accounts.name', 'like', $needle);
            });
        }

        $all = $query->get();

        // UBUZIMA_D1_R6_PNL_CATALOG
        $ledgerByAccount = $all->keyBy(
            fn ($row) => (int) $row->account_id
        );

        $catalogQuery = DB::table('finance_chart_of_accounts')
            ->where('tenant_id', $tenantId)
            ->whereIn('account_type', ['income', 'expense'])
            ->where('is_active', true);

        if ($search !== '') {
            $needle = '%' . $search . '%';

            $catalogQuery->where(function (Builder $inner) use ($needle) {
                $inner
                    ->where('code', 'like', $needle)
                    ->orWhere('name', 'like', $needle);
            });
        }

        $all = $catalogQuery
            ->orderBy('code')
            ->get([
                'id',
                'code',
                'name',
                'account_type',
                'normal_balance',
            ])
            ->map(function ($account) use ($ledgerByAccount) {
                $ledger = $ledgerByAccount->get((int) $account->id);

                return (object) [
                    'account_id' => (int) $account->id,
                    'code' => $account->code,
                    'name' => $account->name,
                    'account_type' => $account->account_type,
                    'normal_balance' => $account->normal_balance,
                    'debit' => (float) ($ledger->debit ?? 0),
                    'credit' => (float) ($ledger->credit ?? 0),
                ];
            });

        $normalized = $all
            ->map(function ($row) {
                $debit = (float) $row->debit;
                $credit = (float) $row->credit;

                $balance = $row->account_type === 'expense'
                    ? $debit - $credit
                    : $credit - $debit;

                return [
                    'code' => $row->code,
                    'name' => $row->name,
                    'account_type' => $row->account_type,
                    'debit' => $debit,
                    'credit' => $credit,
                    'balance' => $balance,
                ];
            })
            ->sortByDesc(fn ($row) => abs($row['balance']))
            ->values();

        $total = $normalized->count();
        $rows = $normalized
            ->slice(($page - 1) * $perPage, $perPage)
            ->values();

        return $this->response(
            module: 'financial-statements',
            summary: [
                $this->metric('income', 'Income', $pnl['income'], 'money', 'Income-account ledger balance'),
                $this->metric('expenses', 'Expenses', $pnl['expenses'], 'money', 'Expense-account ledger balance'),
                $this->metric('net_income', 'Net income', $pnl['net_income'], 'money', 'Income less expenses'),
                $this->metric('income_accounts', 'Income accounts', $pnl['income_accounts'], 'number', 'Non-zero income accounts'),
                $this->metric('expense_accounts', 'Expense accounts', $pnl['expense_accounts'], 'number', 'Non-zero expense accounts'),
            ],
            series: $this->pnlSeries($tenantId, $branchId, $from, $to),
            seriesLabels: ['primary' => 'Income', 'secondary' => 'Expenses'],
            columns: [
                $this->column('code', 'Account', 'text'),
                $this->column('name', 'Name', 'text'),
                $this->column('account_type', 'Type', 'status'),
                $this->column('debit', 'Debit', 'money'),
                $this->column('credit', 'Credit', 'money'),
                $this->column('balance', 'Balance', 'money'),
            ],
            rows: $rows,
            meta: $this->meta($page, $perPage, $total),
            sourceHealth: $this->sourceHealth(
                $tenantId,
                $branchId,
                [
                    'finance_chart_of_accounts',
                    'finance_journal_entries',
                    'finance_journal_lines',
                ]
            ),
            notes: [
                'Profit & Loss is derived only from authoritative posted journal lines and account classifications.',
            ],
            from: $from,
            to: $to,
        );
    }

    // AQUILA_BALANCE_SHEET_R22_PUBLIC_BEGIN
    public function balanceSheet(Request $request): JsonResponse
    {
        [$tenantId, $branchId] = $this->scope($request);

        $validated = $request->validate([
            'as_of' => [
                'nullable',
                'date_format:Y-m-d',
            ],
            'compare_as_of' => [
                'nullable',
                'date_format:Y-m-d',
            ],
        ]);

        $asOf = (string) (
            $validated['as_of']
            ?? now()->toDateString()
        );

        $compareAsOf = isset(
            $validated['compare_as_of']
        ) && $validated['compare_as_of'] !== ''
            ? (string) $validated['compare_as_of']
            : null;

        if (
            $compareAsOf !== null
            && $compareAsOf > $asOf
        ) {
            return response()->json([
                'message' =>
                    'Comparison date must be on or before the Balance Sheet as-of date.',
            ], 422);
        }

        $current = $this->balanceSheetSnapshot(
            $tenantId,
            $branchId,
            $asOf
        );

        $comparison = $compareAsOf !== null
            ? $this->balanceSheetSnapshot(
                $tenantId,
                $branchId,
                $compareAsOf
            )
            : null;

        return response()->json([
            'module' => 'balance-sheet',
            'title' => 'Balance Sheet',
            'basis' =>
                'authoritative_posted_ledger',
            'currency' => 'RWF',
            'as_of' => $asOf,
            'compare_as_of' => $compareAsOf,
            'data' => $current,
            'comparison' => $comparison,
            'source_health' => $this->sourceHealth(
                $tenantId,
                $branchId,
                [
                    'finance_chart_of_accounts',
                    'finance_journal_entries',
                    'finance_journal_lines',
                    'finance_reporting_exclusions',
                ]
            ),
            'notes' => [
                'The formal Balance Sheet uses authoritative posted journals only.',
                'Active authoritative-reporting exclusions are applied as of the selected date.',
                'Shadow-posted journals remain diagnostic and are not included in formal balances.',
                'Accumulated Earnings is derived from cumulative income less cumulative expenses when the chart of accounts has no explicit retained-earnings account.',
                'Current/non-current classifications are not fabricated because the current chart of accounts does not provide maturity classification metadata.',
            ],
        ]);
    }
    // AQUILA_BALANCE_SHEET_R22_PUBLIC_END

    // AQUILA_FINANCE_MONTHLY_REPORTING_R26_PUBLIC_BEGIN
    public function profitLossMonthlyPosition(
        Request $request
    ): JsonResponse {
        [$tenantId, $branchId] =
            $this->scope($request);

        $validated = $request->validate([
            'as_of' => [
                'nullable',
                'date_format:Y-m-d',
            ],
        ]);

        $asOf = (string) (
            $validated['as_of']
            ?? now()->toDateString()
        );

        $date =
            new \DateTimeImmutable(
                $asOf
            );

        $year =
            (int) $date->format('Y');

        $monthNumber =
            (int) $date->format('n');

        $previousYear =
            $year - 1;

        $currentYtd =
            $this->financeR26PnlActuals(
                $tenantId,
                $branchId,
                sprintf(
                    '%04d-01-01',
                    $year
                ),
                $asOf
            );

        $previousAsOf =
            $date
                ->modify('-1 year')
                ->format('Y-m-d');

        $previousYtd =
            $this->financeR26PnlActuals(
                $tenantId,
                $branchId,
                sprintf(
                    '%04d-01-01',
                    $previousYear
                ),
                $previousAsOf
            );

        $catalog =
            $this->financeR26PnlCatalog(
                $tenantId
            );

        $periods = [];
        $currentPeriods = [];
        $previousPeriods = [];

        for (
            $month = $monthNumber;
            $month >= 1;
            $month--
        ) {
            $currentStart =
                new \DateTimeImmutable(
                    sprintf(
                        '%04d-%02d-01',
                        $year,
                        $month
                    )
                );

            $currentEnd =
                $month === $monthNumber
                    ? $date
                    : $currentStart
                        ->modify(
                            'last day of this month'
                        );

            $previousStart =
                new \DateTimeImmutable(
                    sprintf(
                        '%04d-%02d-01',
                        $previousYear,
                        $month
                    )
                );

            $previousEnd =
                $month === $monthNumber
                    ? $date
                        ->modify('-1 year')
                    : $previousStart
                        ->modify(
                            'last day of this month'
                        );

            $key =
                sprintf(
                    '%04d-%02d',
                    $year,
                    $month
                );

            $currentPeriods[$key] =
                $this->financeR26PnlActuals(
                    $tenantId,
                    $branchId,
                    $currentStart->format('Y-m-d'),
                    $currentEnd->format('Y-m-d')
                );

            $previousPeriods[$key] =
                $this->financeR26PnlActuals(
                    $tenantId,
                    $branchId,
                    $previousStart->format('Y-m-d'),
                    $previousEnd->format('Y-m-d')
                );

            $periods[] = [
                'key' =>
                    $key,

                'month_number' =>
                    $month,

                'month' =>
                    $currentStart->format('F'),

                'current_year' =>
                    $year,

                'previous_year' =>
                    $previousYear,

                'current_from' =>
                    $currentStart->format('Y-m-d'),

                'current_to' =>
                    $currentEnd->format('Y-m-d'),

                'previous_from' =>
                    $previousStart->format('Y-m-d'),

                'previous_to' =>
                    $previousEnd->format('Y-m-d'),

                'is_current_month' =>
                    $month === $monthNumber,

                'target_label' =>
                    $month === $monthNumber
                        ? 'Budget'
                        : 'Target',
            ];
        }

        $rows =
            $catalog
                ->map(
                    function (
                        array $account
                    ) use (
                        $currentYtd,
                        $previousYtd,
                        $periods,
                        $currentPeriods,
                        $previousPeriods
                    ): array {
                        $id =
                            (string)
                            $account['account_id'];

                        $ytd =
                            (float) (
                                $currentYtd[$id]
                                ?? 0
                            );

                        $previousYtdValue =
                            (float) (
                                $previousYtd[$id]
                                ?? 0
                            );

                        $months = [];

                        foreach (
                            $periods
                            as $period
                        ) {
                            $key =
                                $period['key'];

                            $actual =
                                (float) (
                                    $currentPeriods[
                                        $key
                                    ][
                                        $id
                                    ]
                                    ?? 0
                                );

                            $previous =
                                (float) (
                                    $previousPeriods[
                                        $key
                                    ][
                                        $id
                                    ]
                                    ?? 0
                                );

                            $months[$key] = [
                                'target' =>
                                    null,

                                'actual' =>
                                    round(
                                        $actual,
                                        2
                                    ),

                                'achieved_pct' =>
                                    null,

                                'previous_actual' =>
                                    round(
                                        $previous,
                                        2
                                    ),

                                'yoy_change_pct' =>
                                    $this->financeR26PercentChange(
                                        $actual,
                                        $previous
                                    ),
                            ];
                        }

                        return [
                            'account_id' =>
                                $account['account_id'],

                            'code' =>
                                $account['code'],

                            'name' =>
                                $account['name'],

                            'account_type' =>
                                $account['account_type'],

                            'ytd_budget' =>
                                null,

                            'ytd_actual' =>
                                round(
                                    $ytd,
                                    2
                                ),

                            'ytd_achieved_pct' =>
                                null,

                            'previous_ytd_actual' =>
                                round(
                                    $previousYtdValue,
                                    2
                                ),

                            'ytd_yoy_change_pct' =>
                                $this->financeR26PercentChange(
                                    $ytd,
                                    $previousYtdValue
                                ),

                            'months' =>
                                $months,
                        ];
                    }
                )
                ->values();

        return response()->json([
            'module' =>
                'profit-loss-monthly-position-r26',

            'title' =>
                'Profit & Loss Monthly Position',

            'currency' =>
                'RWF',

            /*
             * R26 preserves the same source contract as the
             * currently approved P&L implementation:
             * accountBalanceQuery() includes posted and
             * shadow_posted entries.
             */
            'basis' =>
                'existing_profit_loss_operational_ledger',

            'as_of' =>
                $asOf,

            'year' =>
                $year,

            'previous_year' =>
                $previousYear,

            'current_month' =>
                $date->format('F'),

            'budget' => [
                'available' =>
                    false,

                'source' =>
                    null,

                'missing_value_display' =>
                    'dash',

                'missing_percentage_display' =>
                    'dash',
            ],

            'periods' =>
                $periods,

            'rows' =>
                $rows,

            'totals' => [
                'current_ytd' =>
                    $this->financeR26PnlTotals(
                        $catalog,
                        $currentYtd
                    ),

                'previous_ytd' =>
                    $this->financeR26PnlTotals(
                        $catalog,
                        $previousYtd
                    ),

                'months' =>
                    collect(
                        $periods
                    )
                        ->mapWithKeys(
                            function (
                                array $period
                            ) use (
                                $catalog,
                                $currentPeriods,
                                $previousPeriods
                            ): array {
                                $key =
                                    $period['key'];

                                return [
                                    $key => [
                                        'current' =>
                                            $this->financeR26PnlTotals(
                                                $catalog,
                                                $currentPeriods[
                                                    $key
                                                ]
                                            ),

                                        'previous' =>
                                            $this->financeR26PnlTotals(
                                                $catalog,
                                                $previousPeriods[
                                                    $key
                                                ]
                                            ),
                                    ],
                                ];
                            }
                        ),
            ],

            'notes' => [
                'The current month runs through the selected as-of date.',
                'Previous completed months use full calendar-month actuals.',
                'Prior-year current-month comparison uses the equivalent prior-year date.',
                'Budget and target fields remain unavailable until an approved Finance budget source exists.',
            ],
        ]);
    }

    public function balanceSheetMonthlyPosition(
        Request $request
    ): JsonResponse {
        [$tenantId, $branchId] =
            $this->scope($request);

        $validated = $request->validate([
            'as_of' => [
                'nullable',
                'date_format:Y-m-d',
            ],
        ]);

        $asOf = (string) (
            $validated['as_of']
            ?? now()->toDateString()
        );

        $date =
            new \DateTimeImmutable(
                $asOf
            );

        $year =
            (int) $date->format('Y');

        $monthNumber =
            (int) $date->format('n');

        $periods = [];
        $snapshots = [];

        for (
            $month = $monthNumber;
            $month >= 1;
            $month--
        ) {
            $monthStart =
                new \DateTimeImmutable(
                    sprintf(
                        '%04d-%02d-01',
                        $year,
                        $month
                    )
                );

            $periodEnd =
                $month === $monthNumber
                    ? $date
                    : $monthStart
                        ->modify(
                            'last day of this month'
                        );

            $key =
                sprintf(
                    '%04d-%02d',
                    $year,
                    $month
                );

            $periods[] = [
                'key' =>
                    $key,

                'month_number' =>
                    $month,

                'month' =>
                    $monthStart->format('F'),

                'year' =>
                    $year,

                'as_of' =>
                    $periodEnd->format('Y-m-d'),

                'is_current_month' =>
                    $month === $monthNumber,
            ];

            $snapshots[$key] =
                $this->balanceSheetSnapshot(
                    $tenantId,
                    $branchId,
                    $periodEnd->format('Y-m-d')
                );
        }

        $currentKey =
            sprintf(
                '%04d-%02d',
                $year,
                $monthNumber
            );

        $current =
            $snapshots[$currentKey];

        $maps = [];

        foreach (
            $snapshots
            as $key => $snapshot
        ) {
            $maps[$key] =
                $this->financeR26BalanceRowMap(
                    $snapshot
                );
        }

        $sections = [];

        foreach (
            [
                'assets',
                'liabilities',
                'equity',
            ]
            as $sectionKey
        ) {
            $section =
                $current[
                    'sections'
                ][
                    $sectionKey
                ];

            $rows = [];

            foreach (
                $section['rows']
                as $row
            ) {
                $normalized =
                    (array) $row;

                $rowKey =
                    $this->financeR26BalanceRowKey(
                        $normalized
                    );

                $months = [];

                foreach (
                    $periods
                    as $period
                ) {
                    $key =
                        $period['key'];

                    $months[$key] =
                        round(
                            (float) (
                                $maps[
                                    $key
                                ][
                                    $rowKey
                                ]
                                ?? 0
                            ),
                            2
                        );
                }

                $rows[] = [
                    'row_key' =>
                        $rowKey,

                    'account_id' =>
                        $normalized[
                            'account_id'
                        ]
                        ?? null,

                    'code' =>
                        $normalized[
                            'code'
                        ]
                        ?? '',

                    'name' =>
                        $normalized[
                            'name'
                        ]
                        ?? '',

                    'account_type' =>
                        $normalized[
                            'account_type'
                        ]
                        ?? $sectionKey,

                    'derived' =>
                        (bool) (
                            $normalized[
                                'derived'
                            ]
                            ?? false
                        ),

                    'ytd_budget' =>
                        null,

                    /*
                     * For a Balance Sheet, YTD Actual is the
                     * current as-of position, not cumulative
                     * monthly movement.
                     */
                    'ytd_actual' =>
                        round(
                            (float) (
                                $normalized[
                                    'balance'
                                ]
                                ?? 0
                            ),
                            2
                        ),

                    'ytd_achieved_pct' =>
                        null,

                    'months' =>
                        $months,
                ];
            }

            $monthTotals = [];

            foreach (
                $periods
                as $period
            ) {
                $key =
                    $period['key'];

                $monthTotals[$key] =
                    round(
                        (float) (
                            $snapshots[
                                $key
                            ][
                                'sections'
                            ][
                                $sectionKey
                            ][
                                'total'
                            ]
                            ?? 0
                        ),
                        2
                    );
            }

            $sections[$sectionKey] = [
                'label' =>
                    $section['label'],

                'rows' =>
                    $rows,

                'ytd_budget' =>
                    null,

                'ytd_actual' =>
                    round(
                        (float) (
                            $section['total']
                            ?? 0
                        ),
                        2
                    ),

                'ytd_achieved_pct' =>
                    null,

                'months' =>
                    $monthTotals,
            ];
        }

        return response()->json([
            'module' =>
                'balance-sheet-monthly-position-r26',

            'title' =>
                'Balance Sheet Monthly Position',

            'currency' =>
                'RWF',

            'basis' =>
                'authoritative_posted_ledger',

            'as_of' =>
                $asOf,

            'year' =>
                $year,

            'current_month' =>
                $date->format('F'),

            'budget' => [
                'available' =>
                    false,

                'source' =>
                    null,

                'missing_value_display' =>
                    'dash',

                'missing_percentage_display' =>
                    'dash',
            ],

            'periods' =>
                $periods,

            'summary' =>
                $current['summary'],

            'sections' =>
                $sections,

            'diagnostics' =>
                $current['diagnostics'],

            'notes' => [
                'Monthly values are Balance Sheet position snapshots, not monthly movements.',
                'Completed months use month-end balances.',
                'The current month uses the selected as-of date.',
                'Formal Balance Sheet values use authoritative posted journals only.',
                'Budget and percentage-achieved fields remain unavailable until an approved Finance budget source exists.',
            ],
        ]);
    }
    // AQUILA_FINANCE_MONTHLY_REPORTING_R26_PUBLIC_END

    public function cashFlow(Request $request): JsonResponse
    {
        [$tenantId, $branchId] = $this->scope($request);
        [$from, $to, $page, $perPage, $search] = $this->filters($request);

        $cash = $this->cashPosition($tenantId, $branchId, $from, $to);

        $statement = $this->cashFlowStatementData(
            $tenantId,
            $branchId,
            $from,
            $to
        );

        $query = $this->paymentsQuery($tenantId, $branchId, $from, $to)
            ->when($search !== '', function (Builder $query) use ($search) {
                $needle = '%' . $search . '%';

                $query->where(function (Builder $inner) use ($needle) {
                    $inner
                        ->where('payments.payment_method', 'like', $needle)
                        ->orWhere('payments.reference_number', 'like', $needle)
                        ->orWhere('sales.sale_number', 'like', $needle);
                });
            })
            ->orderByDesc('payments.business_date')
            ->orderByDesc('payments.id');

        [$rows, $meta] = $this->paginate(
            $query,
            $page,
            $perPage,
            [
                'payments.id',
                'payments.business_date',
                'sales.sale_number',
                'payments.payment_method',
                'payments.amount',
                'payments.status',
                'payments.reference_number',
                'payments.received_at',
            ]
        );

        $paymentTotal = (float) $this
            ->paymentsQuery($tenantId, $branchId, $from, $to)
            ->sum('payments.amount');

        $salesTotal = (float) $this
            ->salesQuery($tenantId, $branchId, $from, $to)
            ->sum('total_amount');

        return $this->response(
            module: 'cash-flow',
            summary: [
                $this->metric(
                    'cash_balance',
                    'Cash / Bank / MoMo balance',
                    $cash['balance'],
                    'money',
                    'Mapped liquid-account ledger balance'
                ),
                $this->metric('cash_debits', 'Liquid-account debits', $cash['debit'], 'money', 'Debit movement in mapped liquid accounts'),
                $this->metric('cash_credits', 'Liquid-account credits', $cash['credit'], 'money', 'Credit movement in mapped liquid accounts'),
                $this->metric('payments', 'Customer payment movement', $paymentTotal, 'money', 'Actual operational payments'),
                $this->metric('sales', 'Sales movement', $salesTotal, 'money', 'Qualifying Sales in period'),
                $this->metric(
                    'opening_balance',
                    'Opening balance',
                    $statement['opening_balance'],
                    'money',
                    'Posted liquid balance before the selected period'
                ),
                $this->metric(
                    'operating_activities',
                    'Net cash from operating activities',
                    $statement['operating_activities'],
                    'money',
                    'Posted cash movement classified from operating source evidence'
                ),
                $this->metric(
                    'investing_activities',
                    'Net cash from investing activities',
                    $statement['investing_activities'],
                    'money',
                    'Posted cash movement classified from investing source evidence'
                ),
                $this->metric(
                    'financing_activities',
                    'Net cash from financing activities',
                    $statement['financing_activities'],
                    'money',
                    'Posted cash movement classified from financing source evidence'
                ),
                $this->metric(
                    'net_cash_change',
                    'Net cash change',
                    $statement['net_cash_change'],
                    'money',
                    'Closing balance less opening balance'
                ),
                $this->metric(
                    'closing_balance',
                    'Closing balance',
                    $statement['closing_balance'],
                    'money',
                    'Cumulative posted liquid balance through the selected period'
                ),
                $this->metric(
                    'unclassified_cash_movement',
                    'Unclassified cash movement',
                    $statement['unclassified_cash_movement'],
                    'money',
                    'Posted cash movement without sufficient activity classification'
                ),
                $this->metric(
                    'statement_difference',
                    'Cash Flow statement difference',
                    $statement['statement_difference'],
                    'money',
                    'Net cash change less classified activities'
                ),
            ],
            series: $this->cashSeries($tenantId, $branchId, $from, $to),
            seriesLabels: [
                'primary' => 'Net liquid movement',
                'secondary' => 'Payments',
            ],
            columns: [
                $this->column('business_date', 'Business Date', 'date'),
                $this->column('sale_number', 'Sale', 'text'),
                $this->column('payment_method', 'Method', 'status'),
                $this->column('amount', 'Amount', 'money'),
                $this->column('status', 'Status', 'status'),
                $this->column('reference_number', 'Reference', 'text'),
                $this->column('received_at', 'Received', 'datetime'),
            ],
            rows: $rows,
            meta: $meta,
            sourceHealth: $this->sourceHealth(
                $tenantId,
                $branchId,
                [
                    'finance_journal_entries',
                    'finance_journal_lines',
                    'finance_account_mappings',
                    'pharmaco_payments',
                ]
            ),
            notes: [
                'This view reports actual liquid-account and payment movement; it does not invent investing/financing classifications absent from the ledger model.',
            ],
            from: $from,
            to: $to,
        );
    }

    public function sales(Request $request): JsonResponse
    {
        [$tenantId, $branchId] = $this->scope($request);
        [$from, $to, $page, $perPage, $search] = $this->filters($request);

        $query = $this->salesQuery($tenantId, $branchId, $from, $to)
            ->when($search !== '', function (Builder $query) use ($search) {
                $needle = '%' . $search . '%';

                $query->where(function (Builder $inner) use ($needle) {
                    $inner
                        ->where('sale_number', 'like', $needle)
                        ->orWhere('sale_type', 'like', $needle)
                        ->orWhere('payment_status', 'like', $needle)
                        ->orWhere('status', 'like', $needle);
                });
            })
            ->orderByDesc('business_date')
            ->orderByDesc('id');

        [$rows, $meta] = $this->paginate(
            $query,
            $page,
            $perPage,
            [
                'id',
                'sale_number',
                'business_date',
                'sale_type',
                'status',
                'total_amount',
                'paid_amount',
                'balance_amount',
                'payment_status',
                'sold_at',
            ]
        );

        if ($rows->isNotEmpty() && Schema::hasTable('pharmaco_sale_items')) {
            $ids = $rows
                ->pluck('id')
                ->map(fn ($value) => (int) $value)
                ->all();

            $items = DB::table('pharmaco_sale_items')
                ->whereIn('pharmaco_sale_id', $ids)
                ->orderBy('id')
                ->get(
                    $this->existingColumns(
                        'pharmaco_sale_items',
                        [
                            'pharmaco_sale_id',
                            'product_name_snapshot',
                            'quantity',
                            'line_total',
                        ]
                    )
                )
                ->groupBy('pharmaco_sale_id');

            $rows = $rows->map(function ($row) use ($items) {
                $products = collect($items->get($row->id, []))
                    ->map(function ($item) {
                        $name = (string) ($item->product_name_snapshot ?? 'Product');
                        $qty = isset($item->quantity)
                            ? (float) $item->quantity
                            : null;

                        return $qty !== null
                            ? $name . ' × ' . $qty
                            : $name;
                    })
                    ->take(6)
                    ->implode(', ');

                $row->products = $products;

                return $row;
            });
        }

        $summary = $this->salesQuery($tenantId, $branchId, $from, $to);

        $saleCount = (int) (clone $summary)->count();
        $salesTotal = (float) (clone $summary)->sum('total_amount');
        $paidTotal = (float) (clone $summary)->sum('paid_amount');
        $balance = (float) (clone $summary)->sum('balance_amount');

        return $this->response(
            module: 'sales',
            summary: [
                $this->metric('sales_count', 'Sales transactions', $saleCount, 'number', 'Qualifying Sales records'),
                $this->metric('sales_total', 'Sales value', $salesTotal, 'money', 'Total Sales amount'),
                $this->metric('paid_total', 'Paid amount', $paidTotal, 'money', 'Paid Sales amount'),
                $this->metric('balance', 'Outstanding Sales balance', $balance, 'money', 'Sales balance amount'),
                $this->metric(
                    'average_sale',
                    'Average transaction',
                    $saleCount ? $salesTotal / $saleCount : 0,
                    'money',
                    'Average Sales transaction value'
                ),
            ],
            series: $this->salesSeries($tenantId, $branchId, $from, $to),
            seriesLabels: [
                'primary' => 'Sales',
                'secondary' => 'Paid',
            ],
            columns: [
                $this->column('business_date', 'Business Date', 'date'),
                $this->column('sale_number', 'Sale', 'text'),
                $this->column('products', 'Products', 'text'),
                $this->column('sale_type', 'Type', 'status'),
                $this->column('total_amount', 'Total', 'money'),
                $this->column('paid_amount', 'Paid', 'money'),
                $this->column('balance_amount', 'Balance', 'money'),
                $this->column('payment_status', 'Payment', 'status'),
                $this->column('status', 'Status', 'status'),
            ],
            rows: $rows,
            meta: $meta,
            sourceHealth: $this->sourceHealth(
                $tenantId,
                $branchId,
                [
                    'pharmaco_sales',
                    'pharmaco_sale_items',
                    'pharmaco_payments',
                ]
            ),
            notes: [
                'Sales rows include actual product lines when available.',
            ],
            from: $from,
            to: $to,
        );
    }

    public function sourceHealthEndpoint(Request $request): JsonResponse
    {
        [$tenantId, $branchId] = $this->scope($request);

        return response()->json([
            'data' => $this->sourceHealth($tenantId, $branchId),
        ]);
    }

    private function receivableResponse(Request $request, string $module): JsonResponse
    {
        [$tenantId, $branchId] = $this->scope($request);
        [$from, $to, $page, $perPage, $search] = $this->filters($request);

        $query = $this->receivableQuery($tenantId, $branchId, $from, $to);

        if ($query === null) {
            return $this->response(
                module: $module,
                summary: [
                    $this->metric('records', 'Receivable records', 0, 'number', 'Source table unavailable'),
                    $this->metric('outstanding', 'Outstanding', 0, 'money', 'No fabricated value'),
                ],
                series: [],
                seriesLabels: [],
                columns: [],
                rows: collect(),
                meta: $this->emptyMeta($page, $perPage),
                sourceHealth: $this->sourceHealth(
                    $tenantId,
                    $branchId,
                    [
                        'pharmaco_customer_receivables',
                        'pharmaco_customer_receivable_payments',
                    ]
                ),
                notes: [
                    'The formal customer-receivable source is unavailable.',
                ],
                from: $from,
                to: $to,
            );
        }


        // UBUZIMA_D1_R6_RECEIVABLE_SALES_FALLBACK
        if (! $query || (clone $query)->count() === 0) {
            $salesQuery = $this
                ->salesQuery($tenantId, $branchId, $from, $to)
                ->where('balance_amount', '>', 0);

            if ($search !== '') {
                $needle = '%' . $search . '%';

                $salesQuery->where(function (Builder $inner) use ($needle) {
                    $inner
                        ->where('sale_number', 'like', $needle)
                        ->orWhere('payment_status', 'like', $needle)
                        ->orWhere('status', 'like', $needle);
                });
            }

            $salesSummary = clone $salesQuery;

            $count = (int) (clone $salesSummary)->count();
            $original = (float) (clone $salesSummary)->sum('total_amount');
            $paid = (float) (clone $salesSummary)->sum('paid_amount');
            $balance = (float) (clone $salesSummary)->sum('balance_amount');

            $salesQuery
                ->orderByDesc('business_date')
                ->orderByDesc('id');

            [$rows, $meta] = $this->paginate(
                $salesQuery,
                $page,
                $perPage,
                [
                    'id',
                    'sale_number',
                    'business_date',
                    'sale_type',
                    'status',
                    'total_amount',
                    'paid_amount',
                    'balance_amount',
                    'payment_status',
                    'sold_at',
                ]
            );

            return $this->response(
                module: $module,
                summary: [
                    $this->metric(
                        'records',
                        'Operational open balances',
                        $count,
                        'number',
                        'Real Sales balances awaiting formal receivable conversion'
                    ),
                    $this->metric(
                        'original',
                        'Sales value',
                        $original,
                        'money',
                        'Original Sales value for open balances'
                    ),
                    $this->metric(
                        'collected',
                        'Already paid',
                        $paid,
                        'money',
                        'Payments already applied to these Sales'
                    ),
                    $this->metric(
                        'outstanding',
                        'Outstanding',
                        $balance,
                        'money',
                        'Real unpaid Sales balance'
                    ),
                    $this->metric(
                        'formal_receivables',
                        'Formal receivable records',
                        0,
                        'number',
                        'Formal receivable source is currently empty'
                    ),
                ],
                series: $this->salesSeries(
                    $tenantId,
                    $branchId,
                    $from,
                    $to
                ),
                seriesLabels: [
                    'primary' => 'Sales',
                    'secondary' => 'Paid',
                ],
                columns: [
                    $this->column('business_date', 'Business Date', 'date'),
                    $this->column('sale_number', 'Sale', 'text'),
                    $this->column('sale_type', 'Type', 'status'),
                    $this->column('total_amount', 'Sales Value', 'money'),
                    $this->column('paid_amount', 'Paid', 'money'),
                    $this->column('balance_amount', 'Outstanding', 'money'),
                    $this->column('payment_status', 'Payment', 'status'),
                    $this->column('status', 'Sale Status', 'status'),
                ],
                rows: $rows,
                meta: $meta,
                sourceHealth: $this->sourceHealth(
                    $tenantId,
                    $branchId,
                    [
                        'pharmaco_customer_receivables',
                        'pharmaco_customer_receivable_payments',
                        'pharmaco_sales',
                        'pharmaco_payments',
                    ]
                ),
                notes: [
                    'The formal customer receivable tables currently contain zero rows.',
                    'This register therefore displays real outstanding Sales balances as operational credit exposure. These rows are not represented as formal receivable records.',
                    'Use the Receivables workflow to create and manage formal receivables where required.',
                ],
                from: $from,
                to: $to,
            );
        }

        if ($search !== '') {
            $needle = '%' . $search . '%';

            $query->where(function (Builder $inner) use ($needle) {
                $inner
                    ->where('receivables.receivable_number', 'like', $needle)
                    ->orWhere('receivables.status', 'like', $needle);
            });
        }

        $query->orderByDesc('receivables.id');

        [$rows, $meta] = $this->paginate(
            $query,
            $page,
            $perPage,
            [
                'receivables.id',
                'receivables.receivable_number',
                'receivables.status',
                'receivables.original_amount',
                'receivables.paid_amount',
                'receivables.balance_amount',
                'receivables.issued_at',
                'receivables.due_date',
                'receivables.closed_at',
            ]
        );

        $summary = $this->receivableQuery($tenantId, $branchId, $from, $to);

        $count = $summary ? (int) (clone $summary)->count() : 0;
        $original = $summary ? (float) (clone $summary)->sum('receivables.original_amount') : 0.0;
        $paid = $summary ? (float) (clone $summary)->sum('receivables.paid_amount') : 0.0;
        $balance = $summary ? (float) (clone $summary)->sum('receivables.balance_amount') : 0.0;
        $overdue = $this->overdueReceivableCount($tenantId, $branchId);

        return $this->response(
            module: $module,
            summary: [
                $this->metric('records', 'Receivable records', $count, 'number', 'Formal customer receivable records'),
                $this->metric('original', 'Original value', $original, 'money', 'Original receivable amount'),
                $this->metric('collected', 'Collected', $paid, 'money', 'Formal receivable payments applied'),
                $this->metric('outstanding', 'Outstanding', $balance, 'money', 'Current formal receivable balance'),
                $this->metric('overdue', 'Overdue records', $overdue, 'number', 'Past-due open receivables'),
            ],
            series: $this->receivableSeries($tenantId, $branchId),
            seriesLabels: [
                'primary' => 'Receivable balance',
                'secondary' => 'Collected',
            ],
            columns: [
                $this->column('receivable_number', 'Receivable', 'text'),
                $this->column('issued_at', 'Issued', 'date'),
                $this->column('due_date', 'Due', 'date'),
                $this->column('status', 'Status', 'status'),
                $this->column('original_amount', 'Original', 'money'),
                $this->column('paid_amount', 'Paid', 'money'),
                $this->column('balance_amount', 'Balance', 'money'),
            ],
            rows: $rows,
            meta: $meta,
            sourceHealth: $this->sourceHealth(
                $tenantId,
                $branchId,
                [
                    'pharmaco_customer_receivables',
                    'pharmaco_customer_receivable_payments',
                ]
            ),
            notes: $count === 0
                ? [
                    'The formal customer-receivable dataset currently contains zero rows. This is an honest zero-state, not missing UI data.',
                ]
                : [
                    'Receivable totals are sourced directly from formal customer receivable records.',
                ],
            from: $from,
            to: $to,
        );
    }

    private function filters(Request $request): array
    {
        $validated = $request->validate([
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:10', 'max:200'],
            'search' => ['nullable', 'string', 'max:120'],
        ]);

        return [
            $validated['from'] ?? null,
            $validated['to'] ?? null,
            (int) ($validated['page'] ?? 1),
            (int) ($validated['per_page'] ?? 50),
            trim((string) ($validated['search'] ?? '')),
        ];
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

        $tenant = $request->attributes->get('tenant');
        $tenantId = (int) ($tenant?->id ?? 0);

        if ($tenantId <= 0) {
            throw new HttpException(
                422,
                'A verified tenant context is required for Finance.'
            );
        }

        $assignments = $user
            ->tenantAssignments()
            ->where('tenant_id', $tenantId)
            ->where('status', 'active')
            ->orderBy('id')
            ->get();

        if ($assignments->isEmpty()) {
            throw new HttpException(
                403,
                'You are not assigned to this Finance tenant.'
            );
        }

        $tenantWide = $assignments->first(
            fn ($assignment) => $assignment->branch_id === null
        );

        if ($tenantWide) {
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
                    'A single active Finance branch assignment is required.'
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
                'Your Finance branch assignment is not active.'
            );
        }

        return [$tenantId, $branchId];
    }

    private function salesQuery(
        int $tenantId,
        ?int $branchId,
        ?string $from,
        ?string $to
    ): Builder {
        $query = DB::table('pharmaco_sales')
            ->where('tenant_id', $tenantId)
            ->when(
                $branchId,
                fn (Builder $q) => $q->where('branch_id', $branchId)
            )
            ->whereNotIn(
                DB::raw('LOWER(status)'),
                self::EXCLUDED_STATUSES
            );

        return $this->applyPeriod(
            $query,
            'business_date',
            $from,
            $to
        );
    }

    private function paymentsQuery(
        int $tenantId,
        ?int $branchId,
        ?string $from,
        ?string $to
    ): Builder {
        $query = DB::table('pharmaco_payments as payments')
            ->join(
                'pharmaco_sales as sales',
                'sales.id',
                '=',
                'payments.pharmaco_sale_id'
            )
            ->where('payments.tenant_id', $tenantId)
            ->when(
                $branchId,
                fn (Builder $q) => $q->where('sales.branch_id', $branchId)
            )
            ->whereNotIn(
                DB::raw('LOWER(payments.status)'),
                self::EXCLUDED_STATUSES
            );

        return $this->applyPeriod(
            $query,
            'payments.business_date',
            $from,
            $to
        );
    }

    private function journalQuery(
        int $tenantId,
        ?int $branchId,
        ?string $from,
        ?string $to
    ): Builder {
        $query = DB::table('finance_journal_entries')
            ->where('tenant_id', $tenantId)
            ->when(
                $branchId,
                fn (Builder $q) => $q->where('branch_id', $branchId)
            );

        return $this->applyPeriod(
            $query,
            'business_date',
            $from,
            $to
        );
    }

    private function receivableQuery(
        int $tenantId,
        ?int $branchId,
        ?string $from,
        ?string $to
    ): ?Builder {
        if (! Schema::hasTable('pharmaco_customer_receivables')) {
            return null;
        }

        $query = DB::table('pharmaco_customer_receivables as receivables')
            ->where('receivables.tenant_id', $tenantId);

        if ($branchId !== null) {
            if (Schema::hasColumn('pharmaco_customer_receivables', 'branch_id')) {
                $query->where('receivables.branch_id', $branchId);
            } elseif (
                Schema::hasColumn(
                    'pharmaco_customer_receivables',
                    'pharmaco_sale_id'
                )
            ) {
                $query->whereExists(
                    function ($sub) use ($branchId, $tenantId) {
                        $sub
                            ->selectRaw('1')
                            ->from('pharmaco_sales as scope_sales')
                            ->whereColumn(
                                'scope_sales.id',
                                'receivables.pharmaco_sale_id'
                            )
                            ->where(
                                'scope_sales.tenant_id',
                                $tenantId
                            )
                            ->where(
                                'scope_sales.branch_id',
                                $branchId
                            );
                    }
                );
            } else {
                $query->whereRaw('1 = 0');
            }
        }

        if (
            Schema::hasColumn(
                'pharmaco_customer_receivables',
                'issued_at'
            )
        ) {
            $query = $this->applyPeriod(
                $query,
                'receivables.issued_at',
                $from,
                $to
            );
        }

        return $query;
    }

    private function accountBalanceQuery(
        int $tenantId,
        ?int $branchId,
        ?string $from,
        ?string $to
    ): Builder {
        $query = DB::table('finance_journal_lines as lines')
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
            ->where('lines.tenant_id', $tenantId)
            ->where('accounts.tenant_id', $tenantId)
            ->where('entries.status', 'posted')
            ->when(
                $branchId,
                fn (Builder $q) => $q->where(
                    'entries.branch_id',
                    $branchId
                )
            );

        $query = $this->applyPeriod(
            $query,
            'entries.business_date',
            $from,
            $to
        );

        return $query
            ->groupBy(
                'accounts.id',
                'accounts.code',
                'accounts.name',
                'accounts.account_type',
                'accounts.normal_balance'
            )
            ->orderBy('accounts.code')
            ->selectRaw(
                'accounts.id as account_id, ' .
                'accounts.code, ' .
                'accounts.name, ' .
                'accounts.account_type, ' .
                'accounts.normal_balance, ' .
                'COALESCE(SUM(lines.debit),0) as debit, ' .
                'COALESCE(SUM(lines.credit),0) as credit'
            );
    }

    // AQUILA_BALANCE_SHEET_R22_PRIVATE_BEGIN
    private function balanceSheetSnapshot(
        int $tenantId,
        ?int $branchId,
        string $asOf
    ): array {
        $accountTypes = [
            'asset',
            'liability',
            'equity',
            'income',
            'expense',
        ];

        $catalog = DB::table(
            'finance_chart_of_accounts'
        )
            ->where(
                'tenant_id',
                $tenantId
            )
            ->where(
                'is_active',
                true
            )
            ->whereIn(
                'account_type',
                $accountTypes
            )
            ->orderBy(
                'code'
            )
            ->get([
                'id',
                'code',
                'name',
                'account_type',
                'normal_balance',
            ]);

        $ledgerQuery = DB::table(
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
                'lines.tenant_id',
                $tenantId
            )
            ->where(
                'accounts.tenant_id',
                $tenantId
            )
            ->where(
                'accounts.is_active',
                true
            )
            ->whereIn(
                'accounts.account_type',
                $accountTypes
            )
            ->whereDate(
                'entries.business_date',
                '<=',
                $asOf
            )
            ->when(
                $branchId !== null,
                fn ($query) =>
                    $query->where(
                        'entries.branch_id',
                        $branchId
                    )
            );

        $reportingScope = app(
            \App\Services\Finance\FinanceLedgerReportingScope::class
        );

        $ledgerQuery =
            $reportingScope->applyAuthoritative(
                $ledgerQuery,
                $tenantId,
                'entries',
                $asOf
            );

        $ledger = $ledgerQuery
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
                . 'COALESCE(SUM(lines.debit),0) as debit, '
                . 'COALESCE(SUM(lines.credit),0) as credit'
            )
            ->get()
            ->keyBy(
                fn ($row) =>
                    (int) $row->account_id
            );

        $rows = $catalog
            ->map(
                function ($account) use ($ledger): array {
                    $line =
                        $ledger->get(
                            (int) $account->id
                        );

                    $debit = (float) (
                        $line->debit
                        ?? 0
                    );

                    $credit = (float) (
                        $line->credit
                        ?? 0
                    );

                    /*
                     * Formal statement sign convention:
                     *
                     * assets / expenses:
                     *     debit - credit
                     *
                     * liabilities / equity / income:
                     *     credit - debit
                     *
                     * This intentionally lets contra accounts
                     * carry negative balances instead of
                     * converting them into fabricated positives.
                     */
                    $balance = in_array(
                        $account->account_type,
                        [
                            'asset',
                            'expense',
                        ],
                        true
                    )
                        ? $debit - $credit
                        : $credit - $debit;

                    return [
                        'account_id' =>
                            (int) $account->id,
                        'code' =>
                            (string) $account->code,
                        'name' =>
                            (string) $account->name,
                        'account_type' =>
                            (string) $account->account_type,
                        'normal_balance' =>
                            (string) $account->normal_balance,
                        'debit' =>
                            round($debit, 2),
                        'credit' =>
                            round($credit, 2),
                        'balance' =>
                            round($balance, 2),
                        'derived' =>
                            false,
                    ];
                }
            )
            ->values();

        $assets = $rows
            ->where(
                'account_type',
                'asset'
            )
            ->values();

        $liabilities = $rows
            ->where(
                'account_type',
                'liability'
            )
            ->values();

        $explicitEquity = $rows
            ->where(
                'account_type',
                'equity'
            )
            ->values();

        $income = (float) $rows
            ->where(
                'account_type',
                'income'
            )
            ->sum(
                'balance'
            );

        $expenses = (float) $rows
            ->where(
                'account_type',
                'expense'
            )
            ->sum(
                'balance'
            );

        $accumulatedEarnings =
            $income - $expenses;

        $equityRows =
            $explicitEquity
                ->values()
                ->push([
                    'account_id' =>
                        null,
                    'code' =>
                        'EARNINGS',
                    'name' =>
                        'Accumulated Earnings',
                    'account_type' =>
                        'equity',
                    'normal_balance' =>
                        'credit',
                    'debit' =>
                        null,
                    'credit' =>
                        null,
                    'balance' =>
                        round(
                            $accumulatedEarnings,
                            2
                        ),
                    'derived' =>
                        true,
                    'derivation' =>
                        'Cumulative authoritative income less cumulative authoritative expenses',
                ]);

        $totalAssets =
            (float) $assets->sum(
                'balance'
            );

        $totalLiabilities =
            (float) $liabilities->sum(
                'balance'
            );

        $totalExplicitEquity =
            (float) $explicitEquity->sum(
                'balance'
            );

        $totalEquity =
            $totalExplicitEquity
            + $accumulatedEarnings;

        $difference = round(
            $totalAssets
            - $totalLiabilities
            - $totalEquity,
            2
        );

        $authoritativeEntries =
            DB::table(
                'finance_journal_entries as entries'
            )
                ->whereDate(
                    'entries.business_date',
                    '<=',
                    $asOf
                )
                ->when(
                    $branchId !== null,
                    fn ($query) =>
                        $query->where(
                            'entries.branch_id',
                            $branchId
                        )
                );

        $authoritativeEntries =
            $reportingScope->applyAuthoritative(
                $authoritativeEntries,
                $tenantId,
                'entries',
                $asOf
            );

        $postedEntryCount =
            (int) $authoritativeEntries
                ->count(
                    'entries.id'
                );

        $shadowEntryCount =
            (int) DB::table(
                'finance_journal_entries as entries'
            )
                ->where(
                    'entries.tenant_id',
                    $tenantId
                )
                ->where(
                    'entries.status',
                    'shadow_posted'
                )
                ->whereDate(
                    'entries.business_date',
                    '<=',
                    $asOf
                )
                ->when(
                    $branchId !== null,
                    fn ($query) =>
                        $query->where(
                            'entries.branch_id',
                            $branchId
                        )
                )
                ->count(
                    'entries.id'
                );

        $exclusionCount = 0;

        if (
            \Illuminate\Support\Facades\Schema::hasTable(
                'finance_reporting_exclusions'
            )
        ) {
            $exclusionCount =
                (int) DB::table(
                    'finance_reporting_exclusions'
                )
                    ->where(
                        'tenant_id',
                        $tenantId
                    )
                    ->where(
                        'scope',
                        \App\Services\Finance\FinanceLedgerReportingScope::AUTHORITATIVE_SCOPE
                    )
                    ->where(
                        'status',
                        \App\Services\Finance\FinanceLedgerReportingScope::ACTIVE_STATUS
                    )
                    ->whereDate(
                        'effective_from',
                        '<=',
                        $asOf
                    )
                    ->count();
        }

        $unclassifiedCount =
            (int) DB::table(
                'finance_chart_of_accounts'
            )
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->where(
                    'is_active',
                    true
                )
                ->whereNotIn(
                    'account_type',
                    $accountTypes
                )
                ->count();

        return [
            'as_of' =>
                $asOf,

            'summary' => [
                'total_assets' =>
                    round(
                        $totalAssets,
                        2
                    ),

                'total_liabilities' =>
                    round(
                        $totalLiabilities,
                        2
                    ),

                'explicit_equity' =>
                    round(
                        $totalExplicitEquity,
                        2
                    ),

                'accumulated_earnings' =>
                    round(
                        $accumulatedEarnings,
                        2
                    ),

                'total_equity' =>
                    round(
                        $totalEquity,
                        2
                    ),

                'balance_difference' =>
                    $difference,

                'balanced' =>
                    abs($difference)
                    <= 0.01,
            ],

            'sections' => [
                'assets' => [
                    'label' =>
                        'Assets',
                    'rows' =>
                        $assets,
                    'total' =>
                        round(
                            $totalAssets,
                            2
                        ),
                ],

                'liabilities' => [
                    'label' =>
                        'Liabilities',
                    'rows' =>
                        $liabilities,
                    'total' =>
                        round(
                            $totalLiabilities,
                            2
                        ),
                ],

                'equity' => [
                    'label' =>
                        'Equity & Accumulated Earnings',
                    'rows' =>
                        $equityRows,
                    'total' =>
                        round(
                            $totalEquity,
                            2
                        ),
                ],
            ],

            'diagnostics' => [
                'authoritative_posted_entry_count' =>
                    $postedEntryCount,

                'shadow_posted_entry_count' =>
                    $shadowEntryCount,

                'active_reporting_exclusion_count' =>
                    $exclusionCount,

                'explicit_equity_account_count' =>
                    $explicitEquity->count(),

                'unclassified_active_account_count' =>
                    $unclassifiedCount,

                'classification_complete' =>
                    $unclassifiedCount === 0,

                'shadow_entries_included_in_statement' =>
                    false,

                'current_non_current_classification_fabricated' =>
                    false,
            ],
        ];
    }
    // AQUILA_BALANCE_SHEET_R22_PRIVATE_END

    // AQUILA_FINANCE_MONTHLY_REPORTING_R26_PRIVATE_BEGIN
    private function financeR26PnlCatalog(
        int $tenantId
    ) {
        return DB::table(
            'finance_chart_of_accounts'
        )
            ->where(
                'tenant_id',
                $tenantId
            )
            ->where(
                'is_active',
                true
            )
            ->whereIn(
                'account_type',
                [
                    'income',
                    'expense',
                ]
            )
            ->orderBy(
                'account_type'
            )
            ->orderBy(
                'code'
            )
            ->get([
                'id',
                'code',
                'name',
                'account_type',
            ])
            ->map(
                fn ($account) => [
                    'account_id' =>
                        (int) $account->id,

                    'code' =>
                        (string) $account->code,

                    'name' =>
                        (string) $account->name,

                    'account_type' =>
                        (string) $account->account_type,
                ]
            );
    }

    private function financeR26PnlActuals(
        int $tenantId,
        ?int $branchId,
        string $from,
        string $to
    ): array {
        $rows =
            $this
                ->accountBalanceQuery(
                    $tenantId,
                    $branchId,
                    $from,
                    $to
                )
                ->get();

        $result = [];

        foreach (
            $rows
            as $row
        ) {
            if (
                ! in_array(
                    $row->account_type,
                    [
                        'income',
                        'expense',
                    ],
                    true
                )
            ) {
                continue;
            }

            $debit =
                (float) $row->debit;

            $credit =
                (float) $row->credit;

            $actual =
                $row->account_type ===
                    'expense'
                    ? $debit - $credit
                    : $credit - $debit;

            $result[
                (string)
                $row->account_id
            ] = round(
                $actual,
                2
            );
        }

        return $result;
    }

    private function financeR26PnlTotals(
        iterable $catalog,
        array $actuals
    ): array {
        $income = 0.0;
        $expenses = 0.0;

        foreach (
            $catalog
            as $account
        ) {
            $value =
                (float) (
                    $actuals[
                        (string)
                        $account[
                            'account_id'
                        ]
                    ]
                    ?? 0
                );

            if (
                $account[
                    'account_type'
                ] === 'income'
            ) {
                $income +=
                    $value;
            } elseif (
                $account[
                    'account_type'
                ] === 'expense'
            ) {
                $expenses +=
                    $value;
            }
        }

        return [
            'income' =>
                round(
                    $income,
                    2
                ),

            'expenses' =>
                round(
                    $expenses,
                    2
                ),

            'net_income' =>
                round(
                    $income
                    -
                    $expenses,
                    2
                ),
        ];
    }

    private function financeR26PercentChange(
        float $current,
        float $previous
    ): ?float {
        if (
            abs($previous)
            <= 0.005
        ) {
            return null;
        }

        return round(
            (
                (
                    $current
                    -
                    $previous
                )
                /
                abs($previous)
            )
            * 100,
            2
        );
    }

    private function financeR26BalanceRowKey(
        array $row
    ): string {
        if (
            (bool) (
                $row['derived']
                ?? false
            )
        ) {
            return 'derived:'
                . (
                    $row['code']
                    ?? $row['name']
                    ?? 'row'
                );
        }

        return 'account:'
            . (string) (
                $row['account_id']
                ?? $row['code']
                ?? $row['name']
                ?? 'row'
            );
    }

    private function financeR26BalanceRowMap(
        array $snapshot
    ): array {
        $map = [];

        foreach (
            $snapshot['sections']
            ?? []
            as $section
        ) {
            foreach (
                $section['rows']
                ?? []
                as $row
            ) {
                $normalized =
                    (array) $row;

                $map[
                    $this->financeR26BalanceRowKey(
                        $normalized
                    )
                ] = round(
                    (float) (
                        $normalized[
                            'balance'
                        ]
                        ?? 0
                    ),
                    2
                );
            }
        }

        return $map;
    }
    // AQUILA_FINANCE_MONTHLY_REPORTING_R26_PRIVATE_END

    private function profitAndLossData(
        int $tenantId,
        ?int $branchId,
        ?string $from,
        ?string $to
    ): array {
        $rows = $this
            ->accountBalanceQuery(
                $tenantId,
                $branchId,
                $from,
                $to
            )
            ->get();

        $income = 0.0;
        $expenses = 0.0;
        $incomeAccounts = 0;
        $expenseAccounts = 0;

        foreach ($rows as $row) {
            $debit = (float) $row->debit;
            $credit = (float) $row->credit;

            if ($row->account_type === 'income') {
                $balance = $credit - $debit;
                $income += $balance;

                if (abs($balance) > 0.005) {
                    $incomeAccounts++;
                }
            } elseif ($row->account_type === 'expense') {
                $balance = $debit - $credit;
                $expenses += $balance;

                if (abs($balance) > 0.005) {
                    $expenseAccounts++;
                }
            }
        }

        return [
            'income' => $income,
            'expenses' => $expenses,
            'net_income' => $income - $expenses,
            'income_accounts' => $incomeAccounts,
            'expense_accounts' => $expenseAccounts,
        ];
    }


    /*
     * AQUILA_QB2_3B_R2_CASH_FLOW_STATEMENT
     *
     * Formal Finance reporting:
     * - posted ledger only;
     * - Cash / Bank / MoMo mapped accounts;
     * - explicit source classification;
     * - no fabricated activity classification.
     */
    private function cashFlowStatementData(
        int $tenantId,
        ?int $branchId,
        ?string $from,
        ?string $to
    ): array {
        $accountIds = Schema::hasTable(
            'finance_account_mappings'
        )
            ? DB::table(
                'finance_account_mappings'
            )
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->where(
                    'is_active',
                    true
                )
                ->whereIn(
                    'mapping_key',
                    [
                        'pos.cash',
                        'pos.bank',
                        'pos.momo',
                    ]
                )
                ->whereNotNull(
                    'finance_chart_of_account_id'
                )
                ->pluck(
                    'finance_chart_of_account_id'
                )
                ->map(
                    fn ($id) =>
                        (int) $id
                )
                ->unique()
                ->values()
            : collect();

        if (
            $accountIds->isEmpty()
        ) {
            return [
                'opening_balance' => 0.0,
                'operating_activities' => 0.0,
                'investing_activities' => 0.0,
                'financing_activities' => 0.0,
                'net_cash_change' => 0.0,
                'closing_balance' => 0.0,
                'unclassified_cash_movement' => 0.0,
                'statement_difference' => 0.0,
            ];
        }

        $balanceQuery =
            function () use (
                $tenantId,
                $branchId,
                $accountIds
            ) {
                return DB::table(
                    'finance_journal_lines as lines'
                )
                    ->join(
                        'finance_journal_entries as entries',
                        'entries.id',
                        '=',
                        'lines.journal_entry_id'
                    )
                    ->where(
                        'entries.tenant_id',
                        $tenantId
                    )
                    ->where(
                        'lines.tenant_id',
                        $tenantId
                    )
                    ->where(
                        'entries.status',
                        'posted'
                    )
                    ->whereIn(
                        'lines.chart_of_account_id',
                        $accountIds
                    )
                    ->when(
                        $branchId,
                        fn ($query) =>
                            $query->where(
                                'entries.branch_id',
                                $branchId
                            )
                    );
            };

        $opening = 0.0;

        if (
            $from !== null
        ) {
            $row = $balanceQuery()
                ->whereDate(
                    'entries.business_date',
                    '<',
                    $from
                )
                ->selectRaw(
                    'COALESCE(' .
                    'SUM(lines.debit - lines.credit),' .
                    '0' .
                    ') as balance'
                )
                ->first();

            $opening = (float) (
                $row->balance
                ?? 0
            );
        }

        $closingQuery =
            $balanceQuery();

        if (
            $to !== null
        ) {
            $closingQuery
                ->whereDate(
                    'entries.business_date',
                    '<=',
                    $to
                );
        }

        $closingRow =
            $closingQuery
                ->selectRaw(
                    'COALESCE(' .
                    'SUM(lines.debit - lines.credit),' .
                    '0' .
                    ') as balance'
                )
                ->first();

        $closing = (float) (
            $closingRow->balance
            ?? 0
        );

        $query = DB::table(
            'finance_journal_entries as entries'
        )
            ->join(
                'finance_journal_lines as lines',
                'lines.journal_entry_id',
                '=',
                'entries.id'
            )
            ->where(
                'entries.tenant_id',
                $tenantId
            )
            ->where(
                'lines.tenant_id',
                $tenantId
            )
            ->where(
                'entries.status',
                'posted'
            )
            ->when(
                $branchId,
                fn ($query) =>
                    $query->where(
                        'entries.branch_id',
                        $branchId
                    )
            )
            ->when(
                $from,
                fn ($query) =>
                    $query->whereDate(
                        'entries.business_date',
                        '>=',
                        $from
                    )
            )
            ->when(
                $to,
                fn ($query) =>
                    $query->whereDate(
                        'entries.business_date',
                        '<=',
                        $to
                    )
            )
            ->whereExists(
                function ($query) use (
                    $accountIds
                ) {
                    $query
                        ->selectRaw('1')
                        ->from(
                            'finance_journal_lines as cash_lines'
                        )
                        ->whereColumn(
                            'cash_lines.journal_entry_id',
                            'entries.id'
                        )
                        ->whereIn(
                            'cash_lines.chart_of_account_id',
                            $accountIds
                        );
                }
            )
            ->orderBy(
                'entries.id'
            )
            ->orderBy(
                'lines.id'
            );

        $rows = $query->get([
            'entries.id as entry_id',
            'entries.source_module',
            'entries.source_type',
            'entries.memo',

            'lines.chart_of_account_id',
            'lines.debit',
            'lines.credit',
        ]);

        $normalize =
            static function (
                mixed $value
            ): string {
                $text = strtolower(
                    (string) (
                        $value
                        ?? ''
                    )
                );

                $text = str_replace(
                    [
                        '_',
                        '.',
                        '/',
                        '-',
                    ],
                    ' ',
                    $text
                );

                return trim(
                    preg_replace(
                        '/\s+/',
                        ' ',
                        $text
                    )
                    ?? ''
                );
            };

        $contains =
            static function (
                string $text,
                array $tokens
            ): bool {
                foreach (
                    $tokens
                    as $token
                ) {
                    if (
                        str_contains(
                            $text,
                            $token
                        )
                    ) {
                        return true;
                    }
                }

                return false;
            };

        $investingTokens = [
            'fixed asset',
            'asset acquisition',
            'asset disposal',
            'equipment acquisition',
            'equipment disposal',
            'investment purchase',
            'investment sale',
        ];

        $financingTokens = [
            'loan',
            'equity',
            'capital contribution',
            'owner contribution',
            'share capital',
            'borrowing',
            'debt financing',
            'dividend',
            'finance lease',
        ];

        $operatingTokens = [
            'pos payment',
            'customer payment',
            'supplier payment',
            'sale payment',
            'sales payment',
            'payment',
            'sale',
            'expense',
            'payroll',
            'salary',
            'wage',
            'tax',
            'inventory',
            'landed cost',
            'procurement',
            'bank fee',
            'momo fee',
        ];

        $operating = 0.0;
        $investing = 0.0;
        $financing = 0.0;
        $unclassified = 0.0;

        foreach (
            $rows->groupBy(
                'entry_id'
            )
            as $journalRows
        ) {
            $first =
                $journalRows->first();

            if (! $first) {
                continue;
            }

            $liquidNet = (float)
                $journalRows
                    ->filter(
                        fn ($row) =>
                            $accountIds->contains(
                                (int)
                                $row
                                    ->chart_of_account_id
                            )
                    )
                    ->sum(
                        fn ($row) =>
                            (float) $row->debit
                            -
                            (float) $row->credit
                    );

            /*
             * Internal transfers between mapped liquid accounts
             * naturally net to zero here.
             */
            if (
                abs(
                    $liquidNet
                ) <= 0.00005
            ) {
                continue;
            }

            $source =
                $normalize(
                    implode(
                        ' ',
                        [
                            $first
                                ->source_module
                                ?? '',
                            $first
                                ->source_type
                                ?? '',
                            $first
                                ->memo
                                ?? '',
                        ]
                    )
                );

            if (
                $contains(
                    $source,
                    $investingTokens
                )
            ) {
                $investing +=
                    $liquidNet;

                continue;
            }

            if (
                $contains(
                    $source,
                    $financingTokens
                )
            ) {
                $financing +=
                    $liquidNet;

                continue;
            }

            if (
                $contains(
                    $source,
                    $operatingTokens
                )
            ) {
                $operating +=
                    $liquidNet;

                continue;
            }

            $unclassified +=
                $liquidNet;
        }

        $netCashChange =
            $closing
            -
            $opening;

        $classified =
            $operating
            +
            $investing
            +
            $financing;

        $statementDifference =
            $netCashChange
            -
            $classified;

        return [
            'opening_balance' =>
                round(
                    $opening,
                    4
                ),

            'operating_activities' =>
                round(
                    $operating,
                    4
                ),

            'investing_activities' =>
                round(
                    $investing,
                    4
                ),

            'financing_activities' =>
                round(
                    $financing,
                    4
                ),

            'net_cash_change' =>
                round(
                    $netCashChange,
                    4
                ),

            'closing_balance' =>
                round(
                    $closing,
                    4
                ),

            'unclassified_cash_movement' =>
                round(
                    $unclassified,
                    4
                ),

            'statement_difference' =>
                round(
                    $statementDifference,
                    4
                ),
        ];
    }

    private function cashPosition(
        int $tenantId,
        ?int $branchId,
        ?string $from,
        ?string $to
    ): array {
        $accountIds = Schema::hasTable('finance_account_mappings')
            ? DB::table('finance_account_mappings')
                ->where('tenant_id', $tenantId)
                ->whereIn(
                    'mapping_key',
                    ['pos.cash', 'pos.bank', 'pos.momo']
                )
                ->where('is_active', true)
                ->pluck('finance_chart_of_account_id')
                ->filter()
                ->unique()
                ->values()
            : collect();

        if ($accountIds->isEmpty()) {
            return [
                'debit' => 0.0,
                'credit' => 0.0,
                'balance' => 0.0,
            ];
        }

        $query = DB::table('finance_journal_lines as lines')
            ->join(
                'finance_journal_entries as entries',
                'entries.id',
                '=',
                'lines.journal_entry_id'
            )
            ->where('entries.tenant_id', $tenantId)
            ->where('entries.status', 'posted')
            ->whereIn(
                'lines.chart_of_account_id',
                $accountIds
            )
            ->when(
                $branchId,
                fn (Builder $q) => $q->where(
                    'entries.branch_id',
                    $branchId
                )
            );

        $query = $this->applyPeriod(
            $query,
            'entries.business_date',
            $from,
            $to
        );

        $row = $query
            ->selectRaw(
                'COALESCE(SUM(lines.debit),0) as debit, ' .
                'COALESCE(SUM(lines.credit),0) as credit'
            )
            ->first();

        $debit = (float) ($row->debit ?? 0);
        $credit = (float) ($row->credit ?? 0);

        return [
            'debit' => $debit,
            'credit' => $credit,
            'balance' => $debit - $credit,
        ];
    }

    private function salesSeries(
        int $tenantId,
        ?int $branchId,
        ?string $from,
        ?string $to
    ): array {
        return $this
            ->salesQuery($tenantId, $branchId, $from, $to)
            ->selectRaw(
                'business_date as label, ' .
                'SUM(total_amount) as primary_value, ' .
                'SUM(paid_amount) as secondary_value'
            )
            ->whereNotNull('business_date')
            ->groupBy('business_date')
            ->orderByDesc('business_date')
            ->limit(90)
            ->get()
            ->sortBy('label')
            ->values()
            ->map(
                fn ($row) => [
                    'label' => $row->label,
                    'primary' => (float) $row->primary_value,
                    'secondary' => (float) $row->secondary_value,
                ]
            )
            ->all();
    }

    private function paymentSeries(
        int $tenantId,
        ?int $branchId,
        ?string $from,
        ?string $to
    ): array {
        $payments = $this
            ->paymentsQuery($tenantId, $branchId, $from, $to)
            ->selectRaw(
                'payments.business_date as label, ' .
                'SUM(payments.amount) as primary_value'
            )
            ->whereNotNull('payments.business_date')
            ->groupBy('payments.business_date')
            ->get()
            ->keyBy('label');

        $sales = $this
            ->salesQuery($tenantId, $branchId, $from, $to)
            ->selectRaw(
                'business_date as label, ' .
                'SUM(total_amount) as secondary_value'
            )
            ->whereNotNull('business_date')
            ->groupBy('business_date')
            ->get()
            ->keyBy('label');

        return collect($payments->keys())
            ->merge($sales->keys())
            ->unique()
            ->sort()
            ->take(-90)
            ->values()
            ->map(function ($label) use ($payments, $sales) {
                return [
                    'label' => $label,
                    'primary' => (float) (
                        $payments->get($label)->primary_value ?? 0
                    ),
                    'secondary' => (float) (
                        $sales->get($label)->secondary_value ?? 0
                    ),
                ];
            })
            ->all();
    }

    private function pnlSeries(
        int $tenantId,
        ?int $branchId,
        ?string $from,
        ?string $to
    ): array {
        $query = DB::table('finance_journal_lines as lines')
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
            ->where('entries.status', 'posted')
            ->whereIn(
                'accounts.account_type',
                ['income', 'expense']
            )
            ->when(
                $branchId,
                fn (Builder $q) => $q->where(
                    'entries.branch_id',
                    $branchId
                )
            );

        $query = $this->applyPeriod(
            $query,
            'entries.business_date',
            $from,
            $to
        );

        return $query
            ->selectRaw(
                "entries.business_date as label, " .
                "SUM(CASE WHEN accounts.account_type='income' " .
                "THEN lines.credit-lines.debit ELSE 0 END) as primary_value, " .
                "SUM(CASE WHEN accounts.account_type='expense' " .
                "THEN lines.debit-lines.credit ELSE 0 END) as secondary_value"
            )
            ->whereNotNull('entries.business_date')
            ->groupBy('entries.business_date')
            ->orderByDesc('entries.business_date')
            ->limit(90)
            ->get()
            ->sortBy('label')
            ->values()
            ->map(
                fn ($row) => [
                    'label' => $row->label,
                    'primary' => (float) $row->primary_value,
                    'secondary' => (float) $row->secondary_value,
                ]
            )
            ->all();
    }

    private function cashSeries(
        int $tenantId,
        ?int $branchId,
        ?string $from,
        ?string $to
    ): array {
        $accountIds = Schema::hasTable('finance_account_mappings')
            ? DB::table('finance_account_mappings')
                ->where('tenant_id', $tenantId)
                ->whereIn(
                    'mapping_key',
                    ['pos.cash', 'pos.bank', 'pos.momo']
                )
                ->where('is_active', true)
                ->pluck('finance_chart_of_account_id')
                ->filter()
                ->unique()
                ->values()
            : collect();

        $liquid = collect();

        if ($accountIds->isNotEmpty()) {
            $q = DB::table('finance_journal_lines as lines')
                ->join(
                    'finance_journal_entries as entries',
                    'entries.id',
                    '=',
                    'lines.journal_entry_id'
                )
                ->where('entries.tenant_id', $tenantId)
                ->where('entries.status', 'posted')
                ->whereIn(
                    'lines.chart_of_account_id',
                    $accountIds
                )
                ->when(
                    $branchId,
                    fn (Builder $query) => $query->where(
                        'entries.branch_id',
                        $branchId
                    )
                );

            $q = $this->applyPeriod(
                $q,
                'entries.business_date',
                $from,
                $to
            );

            $liquid = $q
                ->selectRaw(
                    'entries.business_date as label, ' .
                    'SUM(lines.debit-lines.credit) as primary_value'
                )
                ->whereNotNull('entries.business_date')
                ->groupBy('entries.business_date')
                ->get()
                ->keyBy('label');
        }

        $payments = $this
            ->paymentsQuery($tenantId, $branchId, $from, $to)
            ->selectRaw(
                'payments.business_date as label, ' .
                'SUM(payments.amount) as secondary_value'
            )
            ->whereNotNull('payments.business_date')
            ->groupBy('payments.business_date')
            ->get()
            ->keyBy('label');

        return collect($liquid->keys())
            ->merge($payments->keys())
            ->unique()
            ->sort()
            ->take(-90)
            ->values()
            ->map(function ($label) use ($liquid, $payments) {
                return [
                    'label' => $label,
                    'primary' => (float) (
                        $liquid->get($label)->primary_value ?? 0
                    ),
                    'secondary' => (float) (
                        $payments->get($label)->secondary_value ?? 0
                    ),
                ];
            })
            ->all();
    }

    private function receivableSeries(
        int $tenantId,
        ?int $branchId
    ): array {
        $query = $this->receivableQuery(
            $tenantId,
            $branchId,
            null,
            null
        );

        if (! $query) {
            return [];
        }

        return $query
            ->selectRaw(
                'receivables.issued_at as label, ' .
                'SUM(receivables.balance_amount) as primary_value, ' .
                'SUM(receivables.paid_amount) as secondary_value'
            )
            ->whereNotNull('receivables.issued_at')
            ->groupBy('receivables.issued_at')
            ->orderByDesc('receivables.issued_at')
            ->limit(90)
            ->get()
            ->sortBy('label')
            ->values()
            ->map(
                fn ($row) => [
                    'label' => $row->label,
                    'primary' => (float) $row->primary_value,
                    'secondary' => (float) $row->secondary_value,
                ]
            )
            ->all();
    }

    private function receivableBalance(
        int $tenantId,
        ?int $branchId,
        ?string $from,
        ?string $to
    ): float {
        $query = $this->receivableQuery(
            $tenantId,
            $branchId,
            $from,
            $to
        );

        if ($query && (clone $query)->count() > 0) {
            return (float) $query->sum('receivables.balance_amount');
        }

        return (float) $this
            ->salesQuery($tenantId, $branchId, $from, $to)
            ->sum('balance_amount');
    }

    private function overdueReceivableCount(
        int $tenantId,
        ?int $branchId
    ): int {
        $query = $this->receivableQuery(
            $tenantId,
            $branchId,
            null,
            null
        );

        if (
            ! $query
            || ! Schema::hasColumn(
                'pharmaco_customer_receivables',
                'due_date'
            )
        ) {
            return 0;
        }

        return (int) $query
            ->whereNotNull('receivables.due_date')
            ->where(
                'receivables.due_date',
                '<',
                date('Y-m-d')
            )
            ->where('receivables.balance_amount', '>', 0)
            ->count();
    }

    private function sourceHealth(
        int $tenantId,
        ?int $branchId,
        ?array $tables = null
    ): array {
        $tables = $tables ?? [
            'finance_journal_entries',
            'finance_journal_lines',
            'finance_chart_of_accounts',
            'finance_account_mappings',
            'pharmaco_sales',
            'pharmaco_sale_items',
            'pharmaco_payments',
            'pharmaco_momo_reconciliations',
            'pharmaco_customer_receivables',
            'pharmaco_customer_receivable_payments',
            'pharmaco_purchase_orders',
            'pharmaco_supplier_invoices',
            'pharmaco_supplier_payments',
            'pharmaco_supplier_invoice_payments',
        ];

        return collect($tables)
            ->map(function (string $table) use ($tenantId, $branchId) {
                if (! Schema::hasTable($table)) {
                    return [
                        'source' => $table,
                        'status' => 'missing',
                        'count' => 0,
                        'scope' => 'unavailable',
                    ];
                }

                $query = DB::table($table);

                if (Schema::hasColumn($table, 'tenant_id')) {
                    $query->where('tenant_id', $tenantId);
                }

                $scope = 'tenant';

                if ($branchId !== null) {
                    if (Schema::hasColumn($table, 'branch_id')) {
                        $query->where('branch_id', $branchId);
                        $scope = 'branch';
                    } elseif (
                        $table === 'pharmaco_payments'
                        && Schema::hasColumn(
                            $table,
                            'pharmaco_sale_id'
                        )
                    ) {
                        $query->whereExists(
                            function ($sub) use ($tenantId, $branchId) {
                                $sub
                                    ->selectRaw('1')
                                    ->from('pharmaco_sales as health_sales')
                                    ->whereColumn(
                                        'health_sales.id',
                                        'pharmaco_payments.pharmaco_sale_id'
                                    )
                                    ->where(
                                        'health_sales.tenant_id',
                                        $tenantId
                                    )
                                    ->where(
                                        'health_sales.branch_id',
                                        $branchId
                                    );
                            }
                        );

                        $scope = 'branch-linked';
                    } elseif (
                        $table === 'pharmaco_sale_items'
                        && Schema::hasColumn(
                            $table,
                            'pharmaco_sale_id'
                        )
                    ) {
                        $query->whereExists(
                            function ($sub) use ($tenantId, $branchId) {
                                $sub
                                    ->selectRaw('1')
                                    ->from('pharmaco_sales as health_sales')
                                    ->whereColumn(
                                        'health_sales.id',
                                        'pharmaco_sale_items.pharmaco_sale_id'
                                    )
                                    ->where(
                                        'health_sales.tenant_id',
                                        $tenantId
                                    )
                                    ->where(
                                        'health_sales.branch_id',
                                        $branchId
                                    );
                            }
                        );

                        $scope = 'branch-linked';
                    } else {
                        $query->whereRaw('1 = 0');
                        $scope = 'branch-safe-suppressed';
                    }
                }

                return [
                    'source' => $table,
                    'status' => 'available',
                    'count' => (int) $query->count(),
                    'scope' => $scope,
                ];
            })
            ->values()
            ->all();
    }

    private function safeScopedQuery(
        string $table,
        int $tenantId,
        ?int $branchId,
        ?string $dateColumn,
        ?string $from,
        ?string $to
    ): ?Builder {
        if (! Schema::hasTable($table)) {
            return null;
        }

        $query = DB::table($table);

        if (Schema::hasColumn($table, 'tenant_id')) {
            $query->where('tenant_id', $tenantId);
        }

        if ($branchId !== null) {
            if (Schema::hasColumn($table, 'branch_id')) {
                $query->where('branch_id', $branchId);
            } else {
                $query->whereRaw('1 = 0');
            }
        }

        if (
            $dateColumn
            && Schema::hasColumn($table, $dateColumn)
        ) {
            $query = $this->applyPeriod(
                $query,
                $dateColumn,
                $from,
                $to
            );
        }

        return $query;
    }

    private function safeScopedCount(
        string $table,
        int $tenantId,
        ?int $branchId
    ): int {
        $query = $this->safeScopedQuery(
            $table,
            $tenantId,
            $branchId,
            null,
            null,
            null
        );

        return $query ? (int) $query->count() : 0;
    }

    private function applyPeriod(
        Builder $query,
        string $column,
        ?string $from,
        ?string $to
    ): Builder {
        if ($from) {
            $query->whereDate($column, '>=', $from);
        }

        if ($to) {
            $query->whereDate($column, '<=', $to);
        }

        return $query;
    }

    private function paginate(
        Builder $query,
        int $page,
        int $perPage,
        array $columns
    ): array {
        $total = (int) (clone $query)->count();

        $rows = $query
            ->forPage($page, $perPage)
            ->get($columns);

        return [
            $rows,
            $this->meta($page, $perPage, $total),
        ];
    }

    private function meta(
        int $page,
        int $perPage,
        int $total
    ): array {
        return [
            'page' => $page,
            'per_page' => $perPage,
            'total' => $total,
            'pages' => max(
                (int) ceil($total / max($perPage, 1)),
                1
            ),
        ];
    }

    private function emptyMeta(
        int $page,
        int $perPage
    ): array {
        return $this->meta(
            $page,
            $perPage,
            0
        );
    }

    private function existingColumns(
        string $table,
        array $columns
    ): array {
        return array_values(
            array_filter(
                $columns,
                fn ($column) => Schema::hasColumn(
                    $table,
                    $column
                )
            )
        );
    }

    private function columnsForExisting(
        string $table,
        array $definitions
    ): array {
        return collect($definitions)
            ->filter(
                fn ($definition) => Schema::hasColumn(
                    $table,
                    $definition[0]
                )
            )
            ->map(
                fn ($definition) => $this->column(
                    $definition[0],
                    $definition[1],
                    $definition[2]
                )
            )
            ->values()
            ->all();
    }

    private function metric(
        string $key,
        string $label,
        $value,
        string $format,
        string $helper
    ): array {
        return compact(
            'key',
            'label',
            'value',
            'format',
            'helper'
        );
    }

    private function column(
        string $key,
        string $label,
        string $format
    ): array {
        return compact(
            'key',
            'label',
            'format'
        );
    }

    private function exceptionRow(
        string $exception,
        $value,
        string $severity,
        string $detail,
        string $format = 'number'
    ): array {
        return compact(
            'exception',
            'value',
            'severity',
            'detail',
            'format'
        );
    }

    private function money(float $value): string
    {
        return 'RWF ' . number_format(
            $value,
            0,
            '.',
            ','
        );
    }

    private function response(
        string $module,
        array $summary,
        array $series,
        array $seriesLabels,
        array $columns,
        Collection $rows,
        array $meta,
        array $sourceHealth,
        array $notes,
        ?string $from,
        ?string $to
    ): JsonResponse {
        return response()->json([
            'data' => [
                'release' => 'FINANCE_D1_R5_COMMERCIAL',
                'module' => $module,
                'currency' => 'RWF',
                'period' => [
                    'from' => $from,
                    'to' => $to,
                ],
                'summary' => $summary,
                'series' => $series,
                'series_labels' => $seriesLabels,
                'columns' => $columns,
                'rows' => $rows->values(),
                'meta' => $meta,
                'source_health' => $sourceHealth,
                'notes' => $notes,
            ],
        ]);
    }
}
