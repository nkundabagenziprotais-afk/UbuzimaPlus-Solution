<?php

namespace App\Http\Controllers\Api\V1\PharmaCo360;

use App\Http\Controllers\Controller;
use App\Models\PharmacoPayment;
use App\Models\PharmacoPurchaseOrder;
use App\Models\PharmacoSale;
use App\Models\PharmacoSupplierInvoice;
use App\Models\PharmacoSupplierPayment;
use App\Models\StockBatch;
use App\Models\PharmacoCustomer;
use App\Models\PharmacoCustomerReceivable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class ReportingController extends Controller
{
    public function overview(Request $request): JsonResponse
    {
        $tenant = $request->attributes->get('tenant');
        [$startDate, $endDate] = $this->dateRange($request);

        return response()->json([
            'tenant' => $this->tenantPayload($tenant),
            'period' => $this->periodPayload($startDate, $endDate),
            'inventory' => $this->inventoryValuationPayload($tenant->id),
            'sales' => $this->salesSummaryPayload($tenant->id, $startDate, $endDate),
            'procurement' => $this->procurementSummaryPayload($tenant->id, $startDate, $endDate),
            'payables' => $this->payablesSummaryPayload($tenant->id, $startDate, $endDate),
        ]);
    }

    public function inventoryValuation(Request $request): JsonResponse
    {
        $tenant = $request->attributes->get('tenant');

        return response()->json([
            'tenant' => $this->tenantPayload($tenant),
            'inventory' => $this->inventoryValuationPayload($tenant->id, includeLocations: true),
        ]);
    }

    public function salesSummary(Request $request): JsonResponse
    {
        $tenant = $request->attributes->get('tenant');
        [$startDate, $endDate] = $this->dateRange($request);

        return response()->json([
            'tenant' => $this->tenantPayload($tenant),
            'period' => $this->periodPayload($startDate, $endDate),
            'sales' => $this->salesSummaryPayload($tenant->id, $startDate, $endDate, includePaymentMethods: true),
        ]);
    }

    public function procurementSummary(Request $request): JsonResponse
    {
        $tenant = $request->attributes->get('tenant');
        [$startDate, $endDate] = $this->dateRange($request);

        return response()->json([
            'tenant' => $this->tenantPayload($tenant),
            'period' => $this->periodPayload($startDate, $endDate),
            'procurement' => $this->procurementSummaryPayload($tenant->id, $startDate, $endDate, includeStatuses: true),
        ]);
    }

    public function payablesSummary(Request $request): JsonResponse
    {
        $tenant = $request->attributes->get('tenant');
        [$startDate, $endDate] = $this->dateRange($request);

        return response()->json([
            'tenant' => $this->tenantPayload($tenant),
            'period' => $this->periodPayload($startDate, $endDate),
            'payables' => $this->payablesSummaryPayload($tenant->id, $startDate, $endDate, includeStatuses: true),
        ]);
    }


    public function customerCreditExposure(Request $request): JsonResponse
    {
        $tenant = $request->attributes->get('tenant');

        $openReceivables = PharmacoCustomerReceivable::query()
            ->where('tenant_id', $tenant->id)
            ->whereIn('status', ['open', 'partially_collected'])
            ->where('balance_amount', '>', 0)
            ->get();

        $openBalance = (float) $openReceivables->sum('balance_amount');

        $overdueReceivables = $openReceivables
            ->filter(fn ($receivable) => $receivable->due_date && $receivable->due_date < now()->toDateString());

        $overdueBalance = (float) $overdueReceivables->sum('balance_amount');

        $agingBuckets = [
            'current' => ['label' => 'Current', 'balance' => 0.0, 'receivables_count' => 0],
            'days_1_30' => ['label' => '1–30 days', 'balance' => 0.0, 'receivables_count' => 0],
            'days_31_60' => ['label' => '31–60 days', 'balance' => 0.0, 'receivables_count' => 0],
            'days_61_90' => ['label' => '61–90 days', 'balance' => 0.0, 'receivables_count' => 0],
            'days_over_90' => ['label' => '90+ days', 'balance' => 0.0, 'receivables_count' => 0],
        ];

        foreach ($openReceivables as $receivable) {
            $bucket = 'current';

            if ($receivable->due_date && $receivable->due_date < now()->toDateString()) {
                $daysOverdue = Carbon::parse($receivable->due_date)->startOfDay()->diffInDays(now()->startOfDay());

                if ($daysOverdue <= 30) {
                    $bucket = 'days_1_30';
                } elseif ($daysOverdue <= 60) {
                    $bucket = 'days_31_60';
                } elseif ($daysOverdue <= 90) {
                    $bucket = 'days_61_90';
                } else {
                    $bucket = 'days_over_90';
                }
            }

            $agingBuckets[$bucket]['balance'] += (float) $receivable->balance_amount;
            $agingBuckets[$bucket]['receivables_count'] += 1;
        }

        $agingBuckets = collect($agingBuckets)
            ->map(function (array $bucket, string $code) {
                return [
                    'code' => $code,
                    'label' => $bucket['label'],
                    'balance' => round((float) $bucket['balance'], 2),
                    'receivables_count' => $bucket['receivables_count'],
                ];
            })
            ->values()
            ->all();

        $customersOnCredit = PharmacoCustomer::query()
            ->where('tenant_id', $tenant->id)
            ->where('credit_status', 'enabled')
            ->count();

        $creditLimitTotal = (float) PharmacoCustomer::query()
            ->where('tenant_id', $tenant->id)
            ->where('credit_status', 'enabled')
            ->sum('credit_limit');

        return response()->json([
            'tenant' => $this->tenantPayload($tenant),
            'period' => [
                'as_of_date' => now()->toDateString(),
            ],
            'customer_credit_exposure' => [
                'open_balance' => round($openBalance, 2),
                'overdue_balance' => round($overdueBalance, 2),
                'current_balance' => round($openBalance - $overdueBalance, 2),
                'credit_limit_total' => round($creditLimitTotal, 2),
                'customers_on_credit' => $customersOnCredit,
                'open_receivables_count' => $openReceivables->count(),
                'overdue_receivables_count' => $overdueReceivables->count(),
                'aging_buckets' => $agingBuckets,
            ],
        ]);
    }

    private function inventoryValuationPayload(int $tenantId, bool $includeLocations = false): array
    {
        $batches = StockBatch::query()
            ->with(['product.category', 'stockLocation.branch'])
            ->where('tenant_id', $tenantId)
            ->get();

        $totalQuantity = $batches->sum(fn (StockBatch $batch) => (float) $batch->quantity_on_hand);
        $totalCostValue = $batches->sum(
            fn (StockBatch $batch) => (float) $batch->quantity_on_hand * (float) ($batch->unit_cost ?? 0)
        );
        $totalRetailValue = $batches->sum(
            fn (StockBatch $batch) => (float) $batch->quantity_on_hand * (float) ($batch->selling_price ?? 0)
        );

        $lowStockBatches = $batches
            ->filter(fn (StockBatch $batch) => (float) $batch->quantity_on_hand > 0 && (float) $batch->quantity_on_hand <= 10)
            ->count();

        $expiredBatches = $batches
            ->filter(fn (StockBatch $batch) => $batch->expiry_date && $batch->expiry_date->isPast())
            ->count();

        $expiringSoonBatches = $batches
            ->filter(fn (StockBatch $batch) => $batch->expiry_date && $batch->expiry_date->between(now(), now()->addDays(90)))
            ->count();

        $payload = [
            'batch_count' => $batches->count(),
            'product_count' => $batches->pluck('product_id')->unique()->count(),
            'total_quantity_on_hand' => round($totalQuantity, 3),
            'total_cost_value' => round($totalCostValue, 2),
            'total_retail_value' => round($totalRetailValue, 2),
            'estimated_margin_value' => round($totalRetailValue - $totalCostValue, 2),
            'low_stock_batches' => $lowStockBatches,
            'expired_batches' => $expiredBatches,
            'expiring_soon_batches' => $expiringSoonBatches,
        ];

        if ($includeLocations) {
            $payload['locations'] = $batches
                ->groupBy('stock_location_id')
                ->map(function ($locationBatches) {
                    $first = $locationBatches->first();
                    $quantity = $locationBatches->sum(fn (StockBatch $batch) => (float) $batch->quantity_on_hand);
                    $costValue = $locationBatches->sum(
                        fn (StockBatch $batch) => (float) $batch->quantity_on_hand * (float) ($batch->unit_cost ?? 0)
                    );

                    return [
                        'stock_location_id' => $first?->stock_location_id,
                        'location_name' => $first?->stockLocation?->name,
                        'branch_name' => $first?->stockLocation?->branch?->name,
                        'batch_count' => $locationBatches->count(),
                        'total_quantity_on_hand' => round($quantity, 3),
                        'total_cost_value' => round($costValue, 2),
                    ];
                })
                ->values();
        }

        return $payload;
    }

    private function salesSummaryPayload(
        int $tenantId,
        Carbon $startDate,
        Carbon $endDate,
        bool $includePaymentMethods = false
    ): array {
        $salesQuery = PharmacoSale::query()
            ->where('tenant_id', $tenantId)
            ->whereBetween('created_at', [$startDate, $endDate]);

        $paymentQuery = PharmacoPayment::query()
            ->where('tenant_id', $tenantId)
            ->whereBetween('created_at', [$startDate, $endDate]);

        $totalSales = (clone $salesQuery)->sum('total_amount');
        $paidAmount = (clone $salesQuery)->sum('paid_amount');
        $balanceAmount = (clone $salesQuery)->sum('balance_amount');
        $paymentsCollected = (clone $paymentQuery)->where('status', 'completed')->sum('amount');

        $payload = [
            'sale_count' => (clone $salesQuery)->count(),
            'draft_sale_count' => (clone $salesQuery)->where('status', 'draft')->count(),
            'dispensed_sale_count' => (clone $salesQuery)->where('status', 'dispensed')->count(),
            'total_sales_amount' => round((float) $totalSales, 2),
            'paid_amount' => round((float) $paidAmount, 2),
            'balance_amount' => round((float) $balanceAmount, 2),
            'payments_collected' => round((float) $paymentsCollected, 2),
        ];

        if ($includePaymentMethods) {
            $payload['payment_methods'] = (clone $paymentQuery)
                ->select('payment_method', DB::raw('COUNT(*) as payment_count'), DB::raw('SUM(amount) as total_amount'))
                ->where('status', 'completed')
                ->groupBy('payment_method')
                ->orderBy('payment_method')
                ->get()
                ->map(fn ($row) => [
                    'payment_method' => $row->payment_method,
                    'payment_count' => (int) $row->payment_count,
                    'total_amount' => round((float) $row->total_amount, 2),
                ]);
        }

        return $payload;
    }

    private function procurementSummaryPayload(
        int $tenantId,
        Carbon $startDate,
        Carbon $endDate,
        bool $includeStatuses = false
    ): array {
        $purchaseOrdersQuery = PharmacoPurchaseOrder::query()
            ->where('tenant_id', $tenantId)
            ->whereBetween('created_at', [$startDate, $endDate]);

        $totalAmount = (clone $purchaseOrdersQuery)->sum('total_amount');

        $payload = [
            'purchase_order_count' => (clone $purchaseOrdersQuery)->count(),
            'draft_purchase_order_count' => (clone $purchaseOrdersQuery)->where('status', 'draft')->count(),
            'approved_purchase_order_count' => (clone $purchaseOrdersQuery)->where('status', 'approved')->count(),
            'received_purchase_order_count' => (clone $purchaseOrdersQuery)->where('status', 'received')->count(),
            'cancelled_purchase_order_count' => (clone $purchaseOrdersQuery)->where('status', 'cancelled')->count(),
            'total_purchase_order_amount' => round((float) $totalAmount, 2),
        ];

        if ($includeStatuses) {
            $payload['status_summary'] = (clone $purchaseOrdersQuery)
                ->select('status', DB::raw('COUNT(*) as purchase_order_count'), DB::raw('SUM(total_amount) as total_amount'))
                ->groupBy('status')
                ->orderBy('status')
                ->get()
                ->map(fn ($row) => [
                    'status' => $row->status,
                    'purchase_order_count' => (int) $row->purchase_order_count,
                    'total_amount' => round((float) $row->total_amount, 2),
                ]);
        }

        return $payload;
    }

    private function payablesSummaryPayload(
        int $tenantId,
        Carbon $startDate,
        Carbon $endDate,
        bool $includeStatuses = false
    ): array {
        $invoiceQuery = PharmacoSupplierInvoice::query()
            ->where('tenant_id', $tenantId)
            ->whereBetween('created_at', [$startDate, $endDate]);

        $paymentQuery = PharmacoSupplierPayment::query()
            ->where('tenant_id', $tenantId)
            ->whereBetween('created_at', [$startDate, $endDate]);

        $totalAmount = (clone $invoiceQuery)->sum('total_amount');
        $paidAmount = (clone $invoiceQuery)->sum('paid_amount');
        $balanceAmount = (clone $invoiceQuery)->sum('balance_amount');

        $overdueCount = PharmacoSupplierInvoice::query()
            ->where('tenant_id', $tenantId)
            ->where('balance_amount', '>', 0)
            ->whereDate('due_date', '<', now()->toDateString())
            ->count();

        $payload = [
            'supplier_invoice_count' => (clone $invoiceQuery)->count(),
            'draft_invoice_count' => (clone $invoiceQuery)->where('status', 'draft')->count(),
            'approved_invoice_count' => (clone $invoiceQuery)->where('status', 'approved')->count(),
            'partially_paid_invoice_count' => (clone $invoiceQuery)->where('status', 'partially_paid')->count(),
            'paid_invoice_count' => (clone $invoiceQuery)->where('status', 'paid')->count(),
            'overdue_invoice_count' => $overdueCount,
            'total_invoice_amount' => round((float) $totalAmount, 2),
            'paid_amount' => round((float) $paidAmount, 2),
            'balance_amount' => round((float) $balanceAmount, 2),
            'payments_recorded' => round((float) (clone $paymentQuery)->where('status', 'completed')->sum('amount'), 2),
        ];

        if ($includeStatuses) {
            $payload['status_summary'] = (clone $invoiceQuery)
                ->select('status', DB::raw('COUNT(*) as invoice_count'), DB::raw('SUM(total_amount) as total_amount'), DB::raw('SUM(balance_amount) as balance_amount'))
                ->groupBy('status')
                ->orderBy('status')
                ->get()
                ->map(fn ($row) => [
                    'status' => $row->status,
                    'invoice_count' => (int) $row->invoice_count,
                    'total_amount' => round((float) $row->total_amount, 2),
                    'balance_amount' => round((float) $row->balance_amount, 2),
                ]);
        }

        return $payload;
    }

    private function dateRange(Request $request): array
    {
        $startDate = $request->query('start_date')
            ? Carbon::parse($request->query('start_date'))->startOfDay()
            : now()->subDays(30)->startOfDay();

        $endDate = $request->query('end_date')
            ? Carbon::parse($request->query('end_date'))->endOfDay()
            : now()->endOfDay();

        return [$startDate, $endDate];
    }

    private function periodPayload(Carbon $startDate, Carbon $endDate): array
    {
        return [
            'start_date' => $startDate->toDateString(),
            'end_date' => $endDate->toDateString(),
        ];
    }

    private function tenantPayload($tenant): array
    {
        return [
            'id' => $tenant->id,
            'name' => $tenant->name,
            'slug' => $tenant->slug,
        ];
    }
}
