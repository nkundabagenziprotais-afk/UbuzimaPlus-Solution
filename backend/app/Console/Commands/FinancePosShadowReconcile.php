<?php

namespace App\Console\Commands;

use App\Services\Finance\FinancePaymentPostingPolicyService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class FinancePosShadowReconcile extends Command
{
    protected $signature = 'finance:pos-shadow-reconcile
        {--tenant_id= : Tenant ID to reconcile}
        {--from= : Business date from, YYYY-MM-DD}
        {--to= : Business date to, YYYY-MM-DD}
        {--branch_id= : Optional branch ID}
        {--show-details : Show missing/orphan details}';

    protected $description = 'Compare completed POS payments against Finance shadow payment postings.';

    public function handle(
        FinancePaymentPostingPolicyService $policyService
    ): int {
        if (! $this->requiredTablesExist()) {
            $this->error('Required POS or Finance tables do not exist.');

            return self::FAILURE;
        }

        if (
            ! Schema::hasTable(
                'finance_payment_posting_policies'
            )
        ) {
            $this->error(
                'Durable Finance payment-policy table does not exist.'
            );

            return self::FAILURE;
        }

        /*
         * UBUZIMA_FINANCE_RECONCILIATION_POLICY_CLASSIFICATION_V3D2B
         *
         * Reconciliation is read-only. It classifies approved exclusions
         * without recording a posting attempt.
         */

        $tenantId = $this->option('tenant_id');
        $from = $this->option('from');
        $to = $this->option('to');
        $branchId = $this->option('branch_id');

        $posTotals = $this->posPaymentTotals($tenantId, $from, $to, $branchId);
        $financeTotals = $this->financeShadowPaymentTotals($tenantId, $from, $to, $branchId);

        $posTotal = round((float) $posTotals->sum('amount'), 4);
        $financeTotal = round((float) $financeTotals->sum('amount'), 4);
        $difference = round($posTotal - $financeTotal, 4);

        $missingPaymentIds = $this->missingFinancePostingPaymentIds($tenantId, $from, $to, $branchId);
        $orphanSourceIds = $this->orphanFinancePostingSourceIds($tenantId, $from, $to, $branchId);

        $missingPaymentRows = DB::table(
            'pharmaco_payments'
        )
            ->whereIn(
                'id',
                $missingPaymentIds->all()
            )
            ->get([
                'id',
                'tenant_id',
                'amount',
                'payment_method',
            ]);

        $policyClassification =
            $policyService->classifyPayments(
                $missingPaymentRows
            );

        $actionableMissingPaymentIds = collect(
            $policyClassification['allowed']
        );

        $policyBlockedPaymentIds = collect(
            $policyClassification['blocked']
        );

        $policyDeferredPaymentIds = collect(
            $policyClassification['deferred']
        );

        $policyExcludedPaymentIds =
            $policyBlockedPaymentIds
                ->merge(
                    $policyDeferredPaymentIds
                )
                ->unique()
                ->values();

        $policyExcludedAmount = round(
            (float) $missingPaymentRows
                ->whereIn(
                    'id',
                    $policyExcludedPaymentIds
                )
                ->sum('amount'),
            4
        );

        $actionablePosTotal = round(
            $posTotal
            - $policyExcludedAmount,
            4
        );

        $actionableDifference = round(
            $actionablePosTotal
            - $financeTotal,
            4
        );

        $this->line('Finance POS Shadow Reconciliation');
        $this->line('Tenant ID: ' . ($tenantId ?: 'all'));
        $this->line('Business Date From: ' . ($from ?: 'beginning'));
        $this->line('Business Date To: ' . ($to ?: 'end'));
        $this->line('Branch ID: ' . ($branchId ?: 'all'));
        $this->line('POS Completed Payments Total: ' . number_format($posTotal, 4, '.', ''));
        $this->line('Finance Shadow Payment Debit Total: ' . number_format($financeTotal, 4, '.', ''));
        $this->line(
            'Raw Difference: '
            . number_format(
                $difference,
                4,
                '.',
                ''
            )
        );
        $this->line(
            'Policy-excluded Missing Payment Total: '
            . number_format(
                $policyExcludedAmount,
                4,
                '.',
                ''
            )
        );
        $this->line(
            'Actionable Difference: '
            . number_format(
                $actionableDifference,
                4,
                '.',
                ''
            )
        );
        $this->line(
            'Actionable Missing Finance Postings: '
            . $actionableMissingPaymentIds->count()
        );
        $this->line(
            'Policy-blocked Missing Payments: '
            . $policyBlockedPaymentIds->count()
        );
        $this->line(
            'Policy-deferred Missing Payments: '
            . $policyDeferredPaymentIds->count()
        );
        $this->line(
            'Orphan Finance Shadow Postings: '
            . $orphanSourceIds->count()
        );

        $this->line('');
        $this->line(
            'By Payment Method (raw before policy exclusions):'
        );

        $methods = $posTotals->pluck('payment_method')
            ->merge($financeTotals->pluck('payment_method'))
            ->unique()
            ->sort()
            ->values();

        foreach ($methods as $method) {
            $posMethodTotal = round((float) optional($posTotals->firstWhere('payment_method', $method))->amount, 4);
            $financeMethodTotal = round((float) optional($financeTotals->firstWhere('payment_method', $method))->amount, 4);
            $methodDifference = round($posMethodTotal - $financeMethodTotal, 4);

            $this->line(sprintf(
                '- %s | POS: %s | Finance: %s | Difference: %s',
                $method ?: 'unknown',
                number_format($posMethodTotal, 4, '.', ''),
                number_format($financeMethodTotal, 4, '.', ''),
                number_format($methodDifference, 4, '.', '')
            ));
        }

        if ($this->option('show-details')) {
            $this->line('');
            $this->line(
                'Actionable Missing Finance Payment IDs: '
                . $actionableMissingPaymentIds->implode(', ')
            );
            $this->line(
                'Policy-blocked Payment IDs: '
                . $policyBlockedPaymentIds->implode(', ')
            );
            $this->line(
                'Policy-deferred Payment IDs: '
                . $policyDeferredPaymentIds->implode(', ')
            );
            $this->line(
                'Orphan Finance Source IDs: '
                . $orphanSourceIds->implode(', ')
            );
        }

        if (
            $actionableDifference !== 0.0
            || $actionableMissingPaymentIds->isNotEmpty()
            || $orphanSourceIds->isNotEmpty()
        ) {
            $this->error('POS payments and Finance shadow postings do not reconcile.');

            return self::FAILURE;
        }

        $this->info(
            'POS payments and Finance shadow postings reconcile.'
        );

        $this->line(
            'Approved payment-policy classification applied.'
        );

        return self::SUCCESS;
    }

    private function requiredTablesExist(): bool
    {
        foreach ([
            'pharmaco_payments',
            'pharmaco_sales',
            'finance_journal_entries',
            'finance_journal_lines',
        ] as $table) {
            if (! Schema::hasTable($table)) {
                return false;
            }
        }

        return true;
    }

    private function posPaymentBaseQuery(?string $tenantId, ?string $from, ?string $to, ?string $branchId)
    {
        $query = DB::table('pharmaco_payments as payments')
            ->join('pharmaco_sales as sales', 'sales.id', '=', 'payments.pharmaco_sale_id')
            ->where('payments.status', 'completed');

        if ($tenantId) {
            $query->where('payments.tenant_id', (int) $tenantId);
        }

        if ($branchId) {
            $query->where('sales.branch_id', (int) $branchId);
        }

        if ($from) {
            $query->whereDate(DB::raw('COALESCE(payments.business_date, sales.business_date, DATE(payments.received_at))'), '>=', $from);
        }

        if ($to) {
            $query->whereDate(DB::raw('COALESCE(payments.business_date, sales.business_date, DATE(payments.received_at))'), '<=', $to);
        }

        return $query;
    }

    private function financeShadowBaseQuery(?string $tenantId, ?string $from, ?string $to, ?string $branchId)
    {
        $query = DB::table('finance_journal_entries as entries')
            ->where('entries.source_module', 'pos')
            ->where('entries.source_type', 'payment')
            ->where('entries.status', 'shadow_posted');

        if ($tenantId) {
            $query->where('entries.tenant_id', (int) $tenantId);
        }

        if ($branchId) {
            $query->where('entries.branch_id', (int) $branchId);
        }

        if ($from) {
            $query->whereDate('entries.business_date', '>=', $from);
        }

        if ($to) {
            $query->whereDate('entries.business_date', '<=', $to);
        }

        return $query;
    }

    private function posPaymentTotals(?string $tenantId, ?string $from, ?string $to, ?string $branchId)
    {
        return $this->posPaymentBaseQuery($tenantId, $from, $to, $branchId)
            ->selectRaw('payments.payment_method, COALESCE(SUM(payments.amount), 0) as amount')
            ->groupBy('payments.payment_method')
            ->get();
    }

    private function financeShadowPaymentTotals(?string $tenantId, ?string $from, ?string $to, ?string $branchId)
    {
        return $this->financeShadowBaseQuery($tenantId, $from, $to, $branchId)
            ->join('finance_journal_lines as lines', 'lines.journal_entry_id', '=', 'entries.id')
            ->where('lines.line_type', 'payment')
            ->selectRaw('lines.payment_method, COALESCE(SUM(lines.debit), 0) as amount')
            ->groupBy('lines.payment_method')
            ->get();
    }

    private function missingFinancePostingPaymentIds(?string $tenantId, ?string $from, ?string $to, ?string $branchId)
    {
        $postedPaymentIds = $this->financeShadowBaseQuery($tenantId, $from, $to, $branchId)
            ->pluck('entries.source_id')
            ->map(fn ($id) => (int) $id)
            ->all();

        return $this->posPaymentBaseQuery($tenantId, $from, $to, $branchId)
            ->whereNotIn('payments.id', $postedPaymentIds ?: [-1])
            ->pluck('payments.id');
    }

    private function orphanFinancePostingSourceIds(?string $tenantId, ?string $from, ?string $to, ?string $branchId)
    {
        $paymentIds = $this->posPaymentBaseQuery($tenantId, $from, $to, $branchId)
            ->pluck('payments.id')
            ->map(fn ($id) => (string) $id)
            ->all();

        return $this->financeShadowBaseQuery($tenantId, $from, $to, $branchId)
            ->whereNotIn('entries.source_id', $paymentIds ?: ['-1'])
            ->pluck('entries.source_id');
    }
}
