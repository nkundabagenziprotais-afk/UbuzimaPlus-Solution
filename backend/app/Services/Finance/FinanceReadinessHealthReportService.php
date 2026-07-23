<?php

namespace App\Services\Finance;

use Illuminate\Support\Facades\DB;

class FinanceReadinessHealthReportService
{
    public function __construct(
        private readonly FinancePosShadowReconciliationReportService $posReconciliationReports,
        private readonly FinancePosRevenueShadowReportService $posRevenueReports,
    ) {
    }

    public function report(
        int $tenantId,
        ?string $from = null,
        ?string $to = null,
        ?int $branchId = null,
    ): array {
        $trialBalance = $this->trialBalance($tenantId, $from, $to, $branchId);
        $posReconciliation = $this->posReconciliationReports->report(
            tenantId: $tenantId,
            from: $from,
            to: $to,
            branchId: $branchId,
        );
        $posRevenueShadow = $this->posRevenueReports->report(
            tenantId: $tenantId,
            from: $from,
            to: $to,
            branchId: $branchId,
        );

        $coaCount = DB::table('finance_chart_of_accounts')
            ->where('tenant_id', $tenantId)
            ->where('is_active', true)
            ->count();

        $mappingCount = DB::table('finance_account_mappings')
            ->where('tenant_id', $tenantId)
            ->where('is_active', true)
            ->count();

        $requiredMappings = [
            'pos.cash',
            'pos.momo',
            'pos.card',
            'sales.revenue',
            'sales.tax',
        ];

        $availableRequiredMappings = DB::table('finance_account_mappings')
            ->where('tenant_id', $tenantId)
            ->where('is_active', true)
            ->whereIn('mapping_key', $requiredMappings)
            ->distinct()
            ->pluck('mapping_key')
            ->all();

        $missingMappings = array_values(array_diff($requiredMappings, $availableRequiredMappings));

        $checks = [
            'trial_balance' => [
                'label' => 'Trial balance',
                'status' => $trialBalance['difference'] === 0.0 ? 'passed' : 'failed',
                'details' => $trialBalance,
            ],
            'pos_payment_reconciliation' => [
                'label' => 'POS payment reconciliation',
                'status' => $posReconciliation['summary']['is_reconciled'] ? 'passed' : 'failed',
                'details' => $posReconciliation['summary'],
            ],
            'pos_revenue_shadow' => [
                'label' => 'POS payment-basis revenue shadow',
                'status' => $posRevenueShadow['summary']['is_reconciled'] ? 'passed' : 'failed',
                'details' => $posRevenueShadow['summary'],
            ],
            'chart_of_accounts' => [
                'label' => 'Chart of Accounts',
                'status' => $coaCount > 0 ? 'passed' : 'failed',
                'details' => [
                    'active_accounts_count' => $coaCount,
                ],
            ],
            'account_mappings' => [
                'label' => 'Finance account mappings',
                'status' => empty($missingMappings) ? 'passed' : 'failed',
                'details' => [
                    'active_mappings_count' => $mappingCount,
                    'required_mappings' => $requiredMappings,
                    'missing_mappings' => $missingMappings,
                ],
            ],
            'dashboard_source_policy' => [
                'label' => 'Dashboard source policy',
                'status' => 'shadow_mode',
                'details' => [
                    'module_dashboards_remain_active' => true,
                    'finance_supplies_money_values_after_readiness' => true,
                    'dashboard_switch_executed' => false,
                ],
            ],
        ];

        $blockingFailures = collect($checks)
            ->filter(fn (array $check, string $key): bool => $key !== 'dashboard_source_policy' && $check['status'] !== 'passed')
            ->keys()
            ->values()
            ->all();

        $isReady = empty($blockingFailures);

        return [
            'mode' => 'shadow',
            'overall_status' => $isReady ? 'ready' : 'needs_review',
            'dashboard_switch_status' => $isReady ? 'ready_for_staged_switch' : 'not_ready',
            'filters' => [
                'tenant_id' => $tenantId,
                'from' => $from,
                'to' => $to,
                'branch_id' => $branchId,
            ],
            'summary' => [
                'blocking_failures' => $blockingFailures,
                'checks_passed' => collect($checks)
                    ->filter(fn (array $check): bool => $check['status'] === 'passed')
                    ->count(),
                'checks_total' => count($checks),
            ],
            'checks' => $checks,
        ];
    }

    private function trialBalance(
        int $tenantId,
        ?string $from,
        ?string $to,
        ?int $branchId,
    ): array {
        $query = DB::table('finance_journal_lines as lines')
            ->join('finance_journal_entries as entries', 'entries.id', '=', 'lines.journal_entry_id')
            ->where('lines.tenant_id', $tenantId)
            ->whereIn('entries.status', ['posted', 'shadow_posted']);

        if ($branchId) {
            $query->where('lines.branch_id', $branchId);
        }

        if ($from) {
            $query->whereDate('entries.business_date', '>=', $from);
        }

        if ($to) {
            $query->whereDate('entries.business_date', '<=', $to);
        }

        $totals = $query
            ->selectRaw('COALESCE(SUM(lines.debit), 0) as total_debit')
            ->selectRaw('COALESCE(SUM(lines.credit), 0) as total_credit')
            ->first();

        $totalDebit = round((float) ($totals->total_debit ?? 0), 4);
        $totalCredit = round((float) ($totals->total_credit ?? 0), 4);

        return [
            'total_debit' => $totalDebit,
            'total_credit' => $totalCredit,
            'difference' => round($totalDebit - $totalCredit, 4),
            'statuses' => ['posted', 'shadow_posted'],
        ];
    }
}
