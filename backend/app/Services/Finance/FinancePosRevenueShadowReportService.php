<?php

namespace App\Services\Finance;

use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class FinancePosRevenueShadowReportService
{
    public function report(
        int $tenantId,
        ?string $from = null,
        ?string $to = null,
        ?int $branchId = null,
        ?string $paymentMethod = null,
    ): array {
        $operationalRows = $this->operationalPaymentRevenueRows(
            $tenantId,
            $from,
            $to,
            $branchId,
            $paymentMethod,
        );

        $financeRows = $this->financeRevenueShadowRows(
            $tenantId,
            $from,
            $to,
            $branchId,
            $paymentMethod,
        );

        $methods = $operationalRows->pluck('payment_method')
            ->merge($financeRows->pluck('payment_method'))
            ->unique()
            ->sort()
            ->values();

        $breakdown = $methods->map(function ($method) use ($operationalRows, $financeRows): array {
            $operational = $operationalRows->firstWhere('payment_method', $method);
            $finance = $financeRows->firstWhere('payment_method', $method);

            $operationalRevenue = round((float) ($operational->allocated_revenue ?? 0), 4);
            $operationalTax = round((float) ($operational->allocated_tax ?? 0), 4);
            $financeRevenue = round((float) ($finance->finance_revenue ?? 0), 4);
            $financeTax = round((float) ($finance->finance_tax ?? 0), 4);

            return [
                'payment_method' => $method ?: 'unknown',
                'operational_payment_total' => round((float) ($operational->payment_total ?? 0), 4),
                'operational_allocated_revenue' => $operationalRevenue,
                'operational_allocated_tax' => $operationalTax,
                'finance_shadow_revenue' => $financeRevenue,
                'finance_shadow_tax' => $financeTax,
                'revenue_difference' => round($operationalRevenue - $financeRevenue, 4),
                'tax_difference' => round($operationalTax - $financeTax, 4),
            ];
        })->values();

        $paymentTotal = round((float) $operationalRows->sum('payment_total'), 4);
        $operationalRevenue = round((float) $operationalRows->sum('allocated_revenue'), 4);
        $operationalTax = round((float) $operationalRows->sum('allocated_tax'), 4);
        $financeRevenue = round((float) $financeRows->sum('finance_revenue'), 4);
        $financeTax = round((float) $financeRows->sum('finance_tax'), 4);

        $revenueDifference = round($operationalRevenue - $financeRevenue, 4);
        $taxDifference = round($operationalTax - $financeTax, 4);

        return [
            'filters' => [
                'tenant_id' => $tenantId,
                'from' => $from,
                'to' => $to,
                'branch_id' => $branchId,
                'payment_method' => $paymentMethod,
            ],
            'basis' => [
                'mode' => 'payment_basis_shadow',
                'label' => 'POS Payment-Basis Revenue Shadow',
                'description' =>
                    'Revenue and tax are allocated from completed POS payments and compared with Finance shadow revenue/tax journal lines.',
            ],
            'summary' => [
                'operational_completed_payment_total' => $paymentTotal,
                'operational_allocated_revenue' => $operationalRevenue,
                'operational_allocated_tax' => $operationalTax,
                'finance_shadow_revenue' => $financeRevenue,
                'finance_shadow_tax' => $financeTax,
                'revenue_difference' => $revenueDifference,
                'tax_difference' => $taxDifference,
                'is_reconciled' => $revenueDifference === 0.0 && $taxDifference === 0.0,
                'dashboard_source_status' =>
                    $revenueDifference === 0.0 && $taxDifference === 0.0
                        ? 'shadow_validated'
                        : 'needs_review',
            ],
            'payment_methods' => $breakdown,
        ];
    }

    private function operationalPaymentRevenueRows(
        int $tenantId,
        ?string $from,
        ?string $to,
        ?int $branchId,
        ?string $paymentMethod,
    ): Collection {
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
            $query->whereDate(
                DB::raw('COALESCE(payments.business_date, sales.business_date, DATE(payments.received_at))'),
                '>=',
                $from,
            );
        }

        if ($to) {
            $query->whereDate(
                DB::raw('COALESCE(payments.business_date, sales.business_date, DATE(payments.received_at))'),
                '<=',
                $to,
            );
        }

        $totals = [];

        foreach ($query->select([
            'payments.payment_method',
            'payments.amount',
            'sales.total_amount',
            'sales.tax_amount',
        ])->get() as $row) {
            $method = $row->payment_method ?: 'unknown';
            $amount = round((float) $row->amount, 4);
            $saleTotal = round((float) $row->total_amount, 4);
            $saleTax = round((float) $row->tax_amount, 4);

            $allocatedTax = 0.0;

            if ($amount > 0 && $saleTotal > 0 && $saleTax > 0) {
                $allocatedTax = round(min($saleTax, ($amount / $saleTotal) * $saleTax), 4);
            }

            $allocatedRevenue = round($amount - $allocatedTax, 4);

            $totals[$method] ??= [
                'payment_method' => $method,
                'payment_total' => 0.0,
                'allocated_revenue' => 0.0,
                'allocated_tax' => 0.0,
            ];

            $totals[$method]['payment_total'] = round($totals[$method]['payment_total'] + $amount, 4);
            $totals[$method]['allocated_revenue'] = round($totals[$method]['allocated_revenue'] + $allocatedRevenue, 4);
            $totals[$method]['allocated_tax'] = round($totals[$method]['allocated_tax'] + $allocatedTax, 4);
        }

        return collect(array_values($totals))
            ->map(fn (array $row) => (object) $row)
            ->values();
    }

    private function financeRevenueShadowRows(
        int $tenantId,
        ?string $from,
        ?string $to,
        ?int $branchId,
        ?string $paymentMethod,
    ): Collection {
        $query = DB::table('finance_journal_entries as entries')
            ->join('finance_journal_lines as lines', 'lines.journal_entry_id', '=', 'entries.id')
            ->where('entries.tenant_id', $tenantId)
            ->where('entries.source_module', 'pos')
            ->where('entries.source_type', 'payment')
            ->where('entries.status', 'shadow_posted')
            ->whereIn('lines.line_type', ['revenue', 'tax']);

        if ($branchId) {
            $query->where('entries.branch_id', $branchId);
        }

        if ($paymentMethod) {
            $query->where('lines.payment_method', $paymentMethod);
        }

        if ($from) {
            $query->whereDate('entries.business_date', '>=', $from);
        }

        if ($to) {
            $query->whereDate('entries.business_date', '<=', $to);
        }

        return $query
            ->selectRaw('COALESCE(lines.payment_method, "unknown") as payment_method')
            ->selectRaw('COALESCE(SUM(CASE WHEN lines.line_type = "revenue" THEN lines.credit ELSE 0 END), 0) as finance_revenue')
            ->selectRaw('COALESCE(SUM(CASE WHEN lines.line_type = "tax" THEN lines.credit ELSE 0 END), 0) as finance_tax')
            ->groupBy('lines.payment_method')
            ->get();
    }
}
