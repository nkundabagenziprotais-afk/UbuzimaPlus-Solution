<?php

namespace App\Console\Commands;

use App\Services\Finance\FinanceAuthoritativePostingReadinessService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class FinancePosAuthoritativeReconcile extends Command
{
    protected $signature = 'finance:pos-authoritative:reconcile
        {--tenant_id=1 : Tenant ID}
        {--branch_id= : Optional branch ID}';

    protected $description =
        'Report authoritative POS Finance readiness and reconciliation gaps.';

    public function handle(
        FinanceAuthoritativePostingReadinessService $readiness,
    ): int {
        $tenantId = (int) $this->option(
            'tenant_id'
        );

        $branchOption = $this->option(
            'branch_id'
        );

        $branchId = is_numeric($branchOption)
            ? (int) $branchOption
            : null;

        $report = $readiness->report(
            $tenantId,
            $branchId,
        );

        $saleQuery = DB::table(
            'pharmaco_sales'
        )
            ->where('tenant_id', $tenantId)
            ->whereIn(
                'status',
                (array) config(
                    'finance.authoritative_sale_statuses',
                    ['dispensed', 'completed']
                )
            );

        if ($branchId !== null) {
            $saleQuery->where(
                'branch_id',
                $branchId
            );
        }

        $eligibleSales = $saleQuery->count();

        $postedSales = DB::table(
            'finance_journal_entries'
        )
            ->where('tenant_id', $tenantId)
            ->where('source_module', 'pos')
            ->where('source_type', 'sale')
            ->where(
                'idempotency_key',
                'like',
                'pos-sale-authoritative-%'
            )
            ->count();

        $completedPayments = DB::table(
            'pharmaco_payments'
        )
            ->where('tenant_id', $tenantId)
            ->where('status', 'completed')
            ->count();

        $postedPayments = DB::table(
            'finance_journal_entries'
        )
            ->where('tenant_id', $tenantId)
            ->where('source_module', 'pos')
            ->where('source_type', 'payment')
            ->where(
                'idempotency_key',
                'like',
                'pos-payment-authoritative-%'
            )
            ->count();

        $unbalanced = DB::table(
            'finance_journal_entries'
        )
            ->where('tenant_id', $tenantId)
            ->where(
                'idempotency_key',
                'like',
                'pos-%-authoritative-%'
            )
            ->whereRaw(
                'ABS(total_debit - total_credit) > 0.005'
            )
            ->count();

        $this->info(
            'Finance POS Authoritative Reconciliation'
        );

        $this->line(
            "Configured mode: {$report['configured_mode']}"
        );

        $this->line(
            "Overall readiness: {$report['overall_status']}"
        );

        $this->line(
            "Eligible sales: {$eligibleSales}"
        );

        $this->line(
            "Authoritative sale journals: {$postedSales}"
        );

        $this->line(
            'Missing authoritative sale journals: '
            . max(0, $eligibleSales - $postedSales)
        );

        $this->line(
            "Completed payments: {$completedPayments}"
        );

        $this->line(
            "Authoritative payment journals: {$postedPayments}"
        );

        $this->line(
            'Missing authoritative payment journals: '
            . max(
                0,
                $completedPayments - $postedPayments
            )
        );

        $this->line(
            "Unbalanced authoritative journals: {$unbalanced}"
        );

        foreach (
            $report['blocking_counts']
            as $key => $value
        ) {
            $this->line(
                "{$key}: {$value}"
            );
        }

        $this->line(
            'Missing mappings: '
            . (
                $report['missing_mappings']
                    ? implode(
                        ', ',
                        $report['missing_mappings']
                    )
                    : 'none'
            )
        );

        $this->line(
            'Unknown payment methods: '
            . (
                $report['unknown_payment_methods']
                    ? implode(
                        ', ',
                        $report[
                            'unknown_payment_methods'
                        ]
                    )
                    : 'none'
            )
        );

        $this->line(
            'Database writes: NO'
        );

        return self::SUCCESS;
    }
}
