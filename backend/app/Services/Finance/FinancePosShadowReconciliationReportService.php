<?php

namespace App\Services\Finance;

use Illuminate\Support\Facades\DB;

class FinancePosShadowReconciliationReportService
{
    public function report(
        int $tenantId,
        ?string $from = null,
        ?string $to = null,
        ?int $branchId = null,
        ?string $paymentMethod = null,
    ): array {
        $posTotals = $this->posPaymentTotals($tenantId, $from, $to, $branchId, $paymentMethod);
        $financeTotals = $this->financeShadowPaymentTotals($tenantId, $from, $to, $branchId, $paymentMethod);

        $posTotal = round((float) $posTotals->sum('amount'), 4);
        $financeTotal = round((float) $financeTotals->sum('amount'), 4);
        $difference = round($posTotal - $financeTotal, 4);

        $missingPaymentIds = $this->missingFinancePostingPaymentIds($tenantId, $from, $to, $branchId, $paymentMethod);
        $orphanSourceIds = $this->orphanFinancePostingSourceIds($tenantId, $from, $to, $branchId, $paymentMethod);

        $methods = $posTotals->pluck('payment_method')
            ->merge($financeTotals->pluck('payment_method'))
            ->unique()
            ->sort()
            ->values();

        $breakdown = $methods->map(function ($method) use ($posTotals, $financeTotals) {
            $posMethodTotal = round((float) optional($posTotals->firstWhere('payment_method', $method))->amount, 4);
            $financeMethodTotal = round((float) optional($financeTotals->firstWhere('payment_method', $method))->amount, 4);

            return [
                'payment_method' => $method ?: 'unknown',
                'pos_total' => $posMethodTotal,
                'finance_shadow_total' => $financeMethodTotal,
                'difference' => round($posMethodTotal - $financeMethodTotal, 4),
            ];
        })->values();

        return [
            'filters' => [
                'tenant_id' => $tenantId,
                'from' => $from,
                'to' => $to,
                'branch_id' => $branchId,
                'payment_method' => $paymentMethod,
            ],
            'summary' => [
                'pos_completed_payments_total' => $posTotal,
                'finance_shadow_payment_total' => $financeTotal,
                'difference' => $difference,
                'missing_finance_postings_count' => $missingPaymentIds->count(),
                'orphan_finance_shadow_postings_count' => $orphanSourceIds->count(),
                'is_reconciled' => $difference === 0.0
                    && $missingPaymentIds->isEmpty()
                    && $orphanSourceIds->isEmpty(),
            ],
            'payment_methods' => $breakdown,
            'details' => [
                'missing_payment_ids' => $missingPaymentIds->values(),
                'orphan_finance_source_ids' => $orphanSourceIds->values(),
            ],
        ];
    }

    private function posPaymentBaseQuery(
        int $tenantId,
        ?string $from,
        ?string $to,
        ?int $branchId,
        ?string $paymentMethod,
    ) {
        $query = DB::table('pharmaco_payments as payments')
            ->join('pharmaco_sales as sales', 'sales.id', '=', 'payments.pharmaco_sale_id')
            ->where('payments.status', 'completed')
            ->where('payments.tenant_id', $tenantId);

        if ($branchId) {
            $query->where('sales.branch_id', $branchId);
        }

        if ($paymentMethod) {
            $query->where('payments.payment_method', $paymentMethod);
        }

        if ($from) {
            $query->whereDate(DB::raw('COALESCE(payments.business_date, sales.business_date, DATE(payments.received_at))'), '>=', $from);
        }

        if ($to) {
            $query->whereDate(DB::raw('COALESCE(payments.business_date, sales.business_date, DATE(payments.received_at))'), '<=', $to);
        }

        return $query;
    }

    private function financeShadowBaseQuery(
        int $tenantId,
        ?string $from,
        ?string $to,
        ?int $branchId,
    ) {
        $query = DB::table('finance_journal_entries as entries')
            ->where('entries.tenant_id', $tenantId)
            ->where('entries.source_module', 'pos')
            ->where('entries.source_type', 'payment')
            ->where('entries.status', 'shadow_posted');

        if ($branchId) {
            $query->where('entries.branch_id', $branchId);
        }

        if ($from) {
            $query->whereDate('entries.business_date', '>=', $from);
        }

        if ($to) {
            $query->whereDate('entries.business_date', '<=', $to);
        }

        return $query;
    }

    private function posPaymentTotals(
        int $tenantId,
        ?string $from,
        ?string $to,
        ?int $branchId,
        ?string $paymentMethod,
    ) {
        return $this->posPaymentBaseQuery($tenantId, $from, $to, $branchId, $paymentMethod)
            ->selectRaw('payments.payment_method, COALESCE(SUM(payments.amount), 0) as amount')
            ->groupBy('payments.payment_method')
            ->get();
    }

    private function financeShadowPaymentTotals(
        int $tenantId,
        ?string $from,
        ?string $to,
        ?int $branchId,
        ?string $paymentMethod,
    ) {
        $query = $this->financeShadowBaseQuery($tenantId, $from, $to, $branchId)
            ->join('finance_journal_lines as lines', 'lines.journal_entry_id', '=', 'entries.id')
            ->where('lines.line_type', 'payment');

        if ($paymentMethod) {
            $query->where('lines.payment_method', $paymentMethod);
        }

        return $query
            ->selectRaw('lines.payment_method, COALESCE(SUM(lines.debit), 0) as amount')
            ->groupBy('lines.payment_method')
            ->get();
    }

    private function missingFinancePostingPaymentIds(
        int $tenantId,
        ?string $from,
        ?string $to,
        ?int $branchId,
        ?string $paymentMethod,
    ) {
        $postedPaymentIds = $this->financeShadowBaseQuery($tenantId, $from, $to, $branchId)
            ->pluck('entries.source_id')
            ->map(fn ($id) => (int) $id)
            ->all();

        return $this->posPaymentBaseQuery($tenantId, $from, $to, $branchId, $paymentMethod)
            ->whereNotIn('payments.id', $postedPaymentIds ?: [-1])
            ->pluck('payments.id');
    }

    private function orphanFinancePostingSourceIds(
        int $tenantId,
        ?string $from,
        ?string $to,
        ?int $branchId,
        ?string $paymentMethod,
    ) {
        $paymentIds = $this->posPaymentBaseQuery($tenantId, $from, $to, $branchId, $paymentMethod)
            ->pluck('payments.id')
            ->map(fn ($id) => (string) $id)
            ->all();

        $query = $this->financeShadowBaseQuery($tenantId, $from, $to, $branchId);

        if ($paymentMethod) {
            $query->join('finance_journal_lines as lines', 'lines.journal_entry_id', '=', 'entries.id')
                ->where('lines.line_type', 'payment')
                ->where('lines.payment_method', $paymentMethod);
        }

        return $query
            ->whereNotIn('entries.source_id', $paymentIds ?: ['-1'])
            ->pluck('entries.source_id');
    }
}
