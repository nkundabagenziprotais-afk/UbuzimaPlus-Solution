<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class FinanceTrialBalanceCheck extends Command
{
    protected $signature = 'finance:trial-balance-check
        {--tenant_id= : Tenant ID to validate}
        {--from= : Business date from, YYYY-MM-DD}
        {--to= : Business date to, YYYY-MM-DD}
        {--branch_id= : Optional branch ID}
        {--include-shadow : Include shadow_posted journal entries}';

    protected $description = 'Validate that finance journal debits equal credits for the selected scope.';

    public function handle(): int
    {
        if (
            ! Schema::hasTable('finance_journal_entries')
            || ! Schema::hasTable('finance_journal_lines')
        ) {
            $this->error('Finance ledger tables do not exist.');

            return self::FAILURE;
        }

        $query = DB::table('finance_journal_lines as lines')
            ->join('finance_journal_entries as entries', 'entries.id', '=', 'lines.journal_entry_id');

        if ($tenantId = $this->option('tenant_id')) {
            $query->where('lines.tenant_id', (int) $tenantId);
        }

        if ($from = $this->option('from')) {
            $query->whereDate('entries.business_date', '>=', $from);
        }

        if ($to = $this->option('to')) {
            $query->whereDate('entries.business_date', '<=', $to);
        }

        if ($branchId = $this->option('branch_id')) {
            $query->where('lines.branch_id', (int) $branchId);
        }

        $statuses = ['posted'];

        if ($this->option('include-shadow')) {
            $statuses[] = 'shadow_posted';
        }

        $query->whereIn('entries.status', $statuses);

        $totals = $query
            ->selectRaw('COALESCE(SUM(lines.debit), 0) as total_debit')
            ->selectRaw('COALESCE(SUM(lines.credit), 0) as total_credit')
            ->first();

        $totalDebit = round((float) $totals->total_debit, 4);
        $totalCredit = round((float) $totals->total_credit, 4);
        $difference = round($totalDebit - $totalCredit, 4);

        $this->line('Finance Trial Balance Check');
        $this->line('Tenant ID: ' . ($tenantId ?: 'all'));
        $this->line('Business Date From: ' . ($from ?: 'beginning'));
        $this->line('Business Date To: ' . ($to ?: 'end'));
        $this->line('Branch ID: ' . ($branchId ?: 'all'));
        $this->line('Statuses: ' . implode(', ', $statuses));
        $this->line('Total Debit: ' . number_format($totalDebit, 4, '.', ''));
        $this->line('Total Credit: ' . number_format($totalCredit, 4, '.', ''));
        $this->line('Difference: ' . number_format($difference, 4, '.', ''));

        if ($difference !== 0.0) {
            $this->error('Trial balance is not balanced.');

            return self::FAILURE;
        }

        $this->info('Trial balance is balanced.');

        return self::SUCCESS;
    }
}
