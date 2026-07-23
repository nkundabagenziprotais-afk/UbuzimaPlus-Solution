<?php

namespace App\Console\Commands;

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

    public function handle(): int
    {
        if (! $this->requiredTablesExist()) {
            $this->error('Required POS or Finance tables do not exist.');

            return self::FAILURE;
        }

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

        $this->line('Finance POS Shadow Reconciliation');
        $this->line('Tenant ID: ' . ($tenantId ?: 'all'));
        $this->line('Business Date From: ' . ($from ?: 'beginning'));
        $this->line('Business Date To: ' . ($to ?: 'end'));
        $this->line('Branch ID: ' . ($branchId ?: 'all'));
        $this->line('POS Completed Payments Total: ' . number_format($posTotal, 4, '.', ''));
        $this->line('Finance Shadow Payment Debit Total: ' . number_format($financeTotal, 4, '.', ''));
        $this->line('Difference: ' . number_format($difference, 4, '.', ''));
        $this->line('Missing Finance Postings: ' . $missingPaymentIds->count());
        $this->line('Orphan Finance Shadow Postings: ' . $orphanSourceIds->count());

        $this->line('');
        $this->line('By Payment Method:');

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
            $this->line('Missing Finance Payment IDs: ' . $missingPaymentIds->implode(', '));
            $this->line('Orphan Finance Source IDs: ' . $orphanSourceIds->implode(', '));
        }

        if ($difference !== 0.0 || $missingPaymentIds->isNotEmpty() || $orphanSourceIds->isNotEmpty()) {
            $this->error('POS payments and Finance shadow postings do not reconcile.');

            return self::FAILURE;
        }

        $this->info('POS payments and Finance shadow postings reconcile.');

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
