<?php

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

    public function trialBalance(Request $request): JsonResponse
    {
        [$tenantId, $branchId] = $this->scope($request);

        return response()->json([
            'data' => $this->trialBalanceRows($tenantId, $branchId),
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

        $rows = DB::table('pharmaco_sales')
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

    private function trialBalanceRows(int $tenantId, ?int $branchId): array
    {
        return DB::table('finance_chart_of_accounts as accounts')
            ->leftJoin('finance_journal_lines as lines', function ($join) use ($tenantId, $branchId) {
                $join->on('lines.chart_of_account_id', '=', 'accounts.id')
                    ->where('lines.tenant_id', '=', $tenantId);

                if ($branchId !== null) {
                    $join->where('lines.branch_id', '=', $branchId);
                }
            })
            ->leftJoin('finance_journal_entries as entries', function ($join) {
                $join->on('entries.id', '=', 'lines.journal_entry_id')
                    ->whereIn('entries.status', ['posted', 'shadow_posted']);
            })
            ->where('accounts.tenant_id', $tenantId)
            ->groupBy(
                'accounts.id',
                'accounts.code',
                'accounts.name',
                'accounts.account_type',
                'accounts.normal_balance'
            )
            ->orderBy('accounts.code')
            ->selectRaw(
                'accounts.id as account_id, accounts.code, accounts.name, '
                . 'accounts.account_type, accounts.normal_balance, '
                . 'COALESCE(SUM(lines.debit), 0) as debit, '
                . 'COALESCE(SUM(lines.credit), 0) as credit'
            )
            ->get()
            ->map(function ($row): array {
                $debit = (float) $row->debit;
                $credit = (float) $row->credit;
                $debitNormal = in_array($row->account_type, ['asset', 'expense'], true);

                return [
                    'account_id' => (int) $row->account_id,
                    'code' => $row->code,
                    'name' => $row->name,
                    'account_type' => $row->account_type,
                    'normal_balance' => $row->normal_balance,
                    'debit' => $debit,
                    'credit' => $credit,
                    'balance' => $debitNormal ? $debit - $credit : $credit - $debit,
                ];
            })
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
}
