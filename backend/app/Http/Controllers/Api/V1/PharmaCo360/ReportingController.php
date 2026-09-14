<?php

namespace App\Http\Controllers\Api\V1\PharmaCo360;

use App\Http\Controllers\Controller;
use App\Models\PharmacoPayment;
use App\Models\PharmacoPurchaseOrder;
use App\Models\PharmacoSale;
use App\Models\PharmacoSupplierInvoice;
use App\Models\PharmacoSupplierPayment;
use App\Models\StockBatch;
use App\Services\Inventory\InventoryExecutiveRiskService;
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

    public function customerCreditExposureExport(Request $request): JsonResponse
    {
        $tenant = $request->attributes->get('tenant');

        $receivables = PharmacoCustomerReceivable::query()
            ->with('customer')
            ->where('tenant_id', $tenant->id)
            ->whereIn('status', ['open', 'partially_collected'])
            ->where('balance_amount', '>', 0)
            ->orderBy('due_date')
            ->get();

        $rows = $receivables
            ->map(function (PharmacoCustomerReceivable $receivable) {
                $bucketCode = 'current';
                $bucketLabel = 'Current';
                $daysOverdue = 0;

                if ($receivable->due_date && $receivable->due_date < now()->toDateString()) {
                    $daysOverdue = Carbon::parse($receivable->due_date)->startOfDay()->diffInDays(now()->startOfDay());

                    if ($daysOverdue <= 30) {
                        $bucketCode = 'days_1_30';
                        $bucketLabel = '1–30 days';
                    } elseif ($daysOverdue <= 60) {
                        $bucketCode = 'days_31_60';
                        $bucketLabel = '31–60 days';
                    } elseif ($daysOverdue <= 90) {
                        $bucketCode = 'days_61_90';
                        $bucketLabel = '61–90 days';
                    } else {
                        $bucketCode = 'days_over_90';
                        $bucketLabel = '90+ days';
                    }
                }

                return [
                    'receivable_id' => $receivable->id,
                    'customer_id' => $receivable->pharmaco_customer_id,
                    'customer_name' => $receivable->customer?->name,
                    'reference_number' => $receivable->reference_number,
                    'status' => $receivable->status,
                    'original_amount' => round((float) $receivable->original_amount, 2),
                    'collected_amount' => round((float) $receivable->collected_amount, 2),
                    'balance_amount' => round((float) $receivable->balance_amount, 2),
                    'due_date' => $receivable->due_date?->toDateString(),
                    'days_overdue' => $daysOverdue,
                    'aging_bucket_code' => $bucketCode,
                    'aging_bucket_label' => $bucketLabel,
                ];
            })
            ->values()
            ->all();

        return response()->json([
            'tenant' => $this->tenantPayload($tenant),
            'period' => [
                'as_of_date' => now()->toDateString(),
            ],
            'export' => [
                'report' => 'customer_credit_exposure',
                'format' => 'json',
                'rows_count' => count($rows),
                'generated_at' => now()->toISOString(),
            ],
            'rows' => $rows,
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

        $executiveInventory = app(
            InventoryExecutiveRiskService::class
        )->build(
            $batches,
            $tenantId
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
            'total_inventory_value' =>
                round($totalCostValue, 2),
            'total_retail_value' => round($totalRetailValue, 2),
            'estimated_margin_value' => round($totalRetailValue - $totalCostValue, 2),
            'low_stock_batches' => $lowStockBatches,
            'expired_batches' => $expiredBatches,
            'expiring_soon_batches' => $expiringSoonBatches,
            'risk_mix' =>
                $executiveInventory['risk_mix'],
            'general_stock' =>
                $executiveInventory['general_stock'],
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
        /*
         * AQUILA_REPORTABLE_PAID_SALES_ONLY_V1_REV9
         *
         * Operational sales reporting recognizes completed,
         * dispensed and fully paid sales only.
         *
         * Finance journal state remains a downstream concern.
         */
        $salesQuery = $this->completedPaidAnalyticsSalesQuery(PharmacoSale::query())
            ->where('tenant_id', $tenantId)
            ->where('status', 'dispensed')
            ->where('payment_status', 'paid')
            ->whereBetween('created_at', [$startDate, $endDate]);

        $paymentQuery = PharmacoPayment::query()
            ->where('tenant_id', $tenantId)
            ->where('status', 'completed')
            ->whereBetween('created_at', [$startDate, $endDate])
            ->whereIn(
                'pharmaco_sale_id',
                (clone $salesQuery)->select('id')
            );

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


    /**
     * UBUZIMA+ R5.7.7F
     *
     * Analytics sales authority:
     * include a sale only after the persisted paid amount
     * fully covers the persisted sale total.
     */
    /**
     * UBUZIMA+ R5.7.7G
     *
     * Sales analytics authority:
     * completed / fully-paid active sales only.
     */
    private function completedPaidAnalyticsSalesQuery($query)
    {
        return $query
            ->where('paid_amount', '>', 0)
            ->whereColumn(
                'paid_amount',
                '>=',
                'total_amount'
            )
            ->whereRaw(
                "LOWER(COALESCE(status, '')) NOT LIKE ?",
                ['%void%']
            )
            ->whereRaw(
                "LOWER(COALESCE(status, '')) NOT LIKE ?",
                ['%cancel%']
            )
            ->whereRaw(
                "LOWER(COALESCE(status, '')) NOT LIKE ?",
                ['%return%']
            );
    }


    /*
     * BEGIN AQUILA_FINANCE_ADVREP_R2A_R2_CUSTOMER_STATEMENTS
     *
     * Read-only Customer Statements.
     *
     * Authoritative source:
     *   pharmaco_customers
     *   pharmaco_customer_receivables
     *   pharmaco_customer_receivable_payments
     *   pharmaco_sales.branch_id
     *
     * No accounting or AR business data is written here.
     */
    public function customerStatement(
        Request $request,
        \App\Services\Access\ScopeResolver $scopeResolver
    ): JsonResponse {
        return response()->json(
            $this->customerStatementPayload(
                $request,
                $scopeResolver
            )
        );
    }

    public function customerStatementExport(
        Request $request,
        \App\Services\Access\ScopeResolver $scopeResolver
    ): \Symfony\Component\HttpFoundation\StreamedResponse {
        $payload =
            $this->customerStatementPayload(
                $request,
                $scopeResolver
            );

        $customerId =
            (int) $payload['customer']['id'];

        $period =
            $payload['period'];

        $filename =
            'customer-statement-'
            . $customerId
            . '-'
            . (
                $period['from_date']
                ?? 'opening'
            )
            . '-'
            . (
                $period['to_date']
                ?? now()->toDateString()
            )
            . '.csv';

        return response()->streamDownload(
            function () use ($payload) {
                $handle =
                    fopen(
                        'php://output',
                        'wb'
                    );

                fputcsv(
                    $handle,
                    [
                        'Date',
                        'Type',
                        'Reference',
                        'Status',
                        'Due date',
                        'Debit',
                        'Credit',
                        'Running balance',
                        'Branch ID',
                    ]
                );

                foreach (
                    $payload['transactions']
                    as $row
                ) {
                    fputcsv(
                        $handle,
                        [
                            $row['date'],
                            $row['type'],
                            $row['reference'],
                            $row['status'],
                            $row['due_date'],
                            $row['debit'],
                            $row['credit'],
                            $row['running_balance'],
                            $row['branch_id'],
                        ]
                    );
                }

                fclose($handle);
            },
            $filename,
            [
                'Content-Type' =>
                    'text/csv; charset=UTF-8',
            ]
        );
    }

    private function customerStatementPayload(
        Request $request,
        \App\Services\Access\ScopeResolver $scopeResolver
    ): array {
        $tenant =
            $request->attributes->get(
                'tenant'
            );

        abort_unless(
            $tenant !== null,
            422,
            'A verified active tenant is required for Customer Statements.'
        );

        $validated =
            $request->validate(
                [
                    'customer_id' => [
                        'required',
                        'integer',
                        'min:1',
                    ],

                    'from_date' => [
                        'nullable',
                        'date_format:Y-m-d',
                    ],

                    'to_date' => [
                        'nullable',
                        'date_format:Y-m-d',
                        'after_or_equal:from_date',
                    ],

                    'branch_id' => [
                        'nullable',
                        'integer',
                        'min:1',
                    ],
                ]
            );

        $scope =
            $scopeResolver->resolveForUser(
                $request->user()
            );

        if (
            $scope->tenantId !== null
            &&
            (int) $scope->tenantId
                !== (int) $tenant->id
        ) {
            abort(
                403,
                'Tenant boundary violation.'
            );
        }

        $requestedBranchId =
            array_key_exists(
                'branch_id',
                $validated
            )
                &&
                $validated['branch_id'] !== null
                    ? (int) $validated['branch_id']
                    : null;

        $branchId =
            $requestedBranchId;

        if ($scope->isBranch()) {
            abort_unless(
                $scope->branchId !== null,
                403,
                'Active branch scope is incomplete.'
            );

            if (
                $requestedBranchId !== null
                &&
                $requestedBranchId
                    !== (int) $scope->branchId
            ) {
                abort(
                    403,
                    'Branch boundary violation.'
                );
            }

            $branchId =
                (int) $scope->branchId;
        }

        if ($branchId !== null) {
            $branchExists =
                \Illuminate\Support\Facades\DB::table(
                    'branches'
                )
                    ->where(
                        'id',
                        $branchId
                    )
                    ->where(
                        'tenant_id',
                        $tenant->id
                    )
                    ->exists();

            abort_unless(
                $branchExists,
                404,
                'Branch was not found in the active tenant.'
            );
        }

        $customer =
            \Illuminate\Support\Facades\DB::table(
                'pharmaco_customers'
            )
                ->where(
                    'tenant_id',
                    $tenant->id
                )
                ->where(
                    'id',
                    (int) $validated['customer_id']
                )
                ->first();

        abort_unless(
            $customer !== null,
            404,
            'Customer was not found in the active tenant.'
        );

        $customerName =
            trim(
                (string) $customer->first_name
                . ' '
                . (string) (
                    $customer->last_name
                    ?? ''
                )
            );

        $allCustomerReceivablesCount =
            (int) \Illuminate\Support\Facades\DB::table(
                'pharmaco_customer_receivables'
            )
                ->where(
                    'tenant_id',
                    $tenant->id
                )
                ->where(
                    'pharmaco_customer_id',
                    $customer->id
                )
                ->count();

        $receivableQuery =
            \Illuminate\Support\Facades\DB::table(
                'pharmaco_customer_receivables as receivables'
            )
                ->leftJoin(
                    'pharmaco_sales as sales',
                    function ($join) {
                        $join
                            ->on(
                                'sales.id',
                                '=',
                                'receivables.pharmaco_sale_id'
                            )
                            ->on(
                                'sales.tenant_id',
                                '=',
                                'receivables.tenant_id'
                            );
                    }
                )
                ->where(
                    'receivables.tenant_id',
                    $tenant->id
                )
                ->where(
                    'receivables.pharmaco_customer_id',
                    $customer->id
                );

        if ($branchId !== null) {
            $receivableQuery
                ->where(
                    'sales.branch_id',
                    $branchId
                );
        }

        $receivables =
            $receivableQuery
                ->select(
                    [
                        'receivables.id',
                        'receivables.uuid',
                        'receivables.receivable_number',
                        'receivables.status',
                        'receivables.original_amount',
                        'receivables.paid_amount',
                        'receivables.balance_amount',
                        'receivables.issued_at',
                        'receivables.due_date',
                        'receivables.created_at',
                        'sales.branch_id as branch_id',
                    ]
                )
                ->orderBy(
                    'receivables.issued_at'
                )
                ->orderBy(
                    'receivables.id'
                )
                ->get();

        $receivableIds =
            $receivables
                ->pluck('id')
                ->map(
                    static fn ($id) =>
                        (int) $id
                )
                ->values()
                ->all();

        $paymentsByReceivable = [];

        if ($receivableIds !== []) {
            $payments =
                \Illuminate\Support\Facades\DB::table(
                    'pharmaco_customer_receivable_payments'
                )
                    ->where(
                        'tenant_id',
                        $tenant->id
                    )
                    ->where(
                        'pharmaco_customer_id',
                        $customer->id
                    )
                    ->whereIn(
                        'pharmaco_customer_receivable_id',
                        $receivableIds
                    )
                    ->orderBy('paid_at')
                    ->orderBy('id')
                    ->get(
                        [
                            'id',
                            'uuid',
                            'pharmaco_customer_receivable_id',
                            'payment_number',
                            'amount',
                            'payment_method',
                            'reference_number',
                            'status',
                            'paid_at',
                            'created_at',
                        ]
                    );

            foreach (
                $payments
                as $payment
            ) {
                $receivableId =
                    (int)
                    $payment
                        ->pharmaco_customer_receivable_id;

                $paymentsByReceivable[
                    $receivableId
                ][] =
                    $payment;
            }
        }

        $fromDate =
            isset($validated['from_date'])
                ? \Carbon\Carbon::parse(
                    $validated['from_date']
                )->startOfDay()
                : null;

        $toDate =
            isset($validated['to_date'])
                ? \Carbon\Carbon::parse(
                    $validated['to_date']
                )->endOfDay()
                : null;

        $allTransactions = [];

        foreach (
            $receivables
            as $receivable
        ) {
            $issuedValue =
                $receivable->issued_at
                ?? $receivable->created_at;

            if ($issuedValue !== null) {
                $issuedAt =
                    \Carbon\Carbon::parse(
                        $issuedValue
                    );

                $allTransactions[] = [
                    'sort_at' =>
                        $issuedAt->timestamp,

                    'sort_type' =>
                        1,

                    'source_id' =>
                        (int) $receivable->id,

                    'date' =>
                        $issuedAt->toDateString(),

                    'type' =>
                        'receivable',

                    'reference' =>
                        (string)
                        $receivable
                            ->receivable_number,

                    'status' =>
                        (string)
                        $receivable
                            ->status,

                    'due_date' =>
                        $receivable->due_date
                            ? \Carbon\Carbon::parse(
                                $receivable->due_date
                            )->toDateString()
                            : null,

                    'debit' =>
                        round(
                            (float)
                            $receivable
                                ->original_amount,
                            2
                        ),

                    'credit' =>
                        0.0,

                    'branch_id' =>
                        $receivable->branch_id
                            !== null
                                ? (int)
                                    $receivable
                                        ->branch_id
                                : null,
                ];
            }

            foreach (
                $paymentsByReceivable[
                    (int) $receivable->id
                ] ?? []
                as $payment
            ) {
                $status =
                    strtolower(
                        trim(
                            (string)
                            $payment
                                ->status
                        )
                    );

                if (
                    in_array(
                        $status,
                        [
                            'voided',
                            'cancelled',
                            'canceled',
                            'reversed',
                        ],
                        true
                    )
                ) {
                    continue;
                }

                $paidValue =
                    $payment->paid_at
                    ?? $payment->created_at;

                if ($paidValue === null) {
                    continue;
                }

                $paidAt =
                    \Carbon\Carbon::parse(
                        $paidValue
                    );

                $allTransactions[] = [
                    'sort_at' =>
                        $paidAt->timestamp,

                    'sort_type' =>
                        2,

                    'source_id' =>
                        (int) $payment->id,

                    'date' =>
                        $paidAt->toDateString(),

                    'type' =>
                        'payment',

                    'reference' =>
                        (string) (
                            $payment
                                ->payment_number
                            ?:
                            $payment
                                ->reference_number
                            ?:
                            (
                                'PAY-'
                                . $payment->id
                            )
                        ),

                    'status' =>
                        (string)
                        $payment
                            ->status,

                    'due_date' =>
                        null,

                    'debit' =>
                        0.0,

                    'credit' =>
                        round(
                            (float)
                            $payment
                                ->amount,
                            2
                        ),

                    'branch_id' =>
                        $receivable->branch_id
                            !== null
                                ? (int)
                                    $receivable
                                        ->branch_id
                                : null,
                ];
            }
        }

        usort(
            $allTransactions,
            static function (
                array $left,
                array $right
            ): int {
                return [
                    $left['sort_at'],
                    $left['sort_type'],
                    $left['source_id'],
                ]
                <=>
                [
                    $right['sort_at'],
                    $right['sort_type'],
                    $right['source_id'],
                ];
            }
        );

        $openingBalance =
            0.0;

        if ($fromDate !== null) {
            foreach (
                $allTransactions
                as $row
            ) {
                $rowDate =
                    \Carbon\Carbon::createFromTimestamp(
                        $row['sort_at']
                    );

                if (
                    $rowDate->lt(
                        $fromDate
                    )
                ) {
                    $openingBalance +=
                        (float) $row['debit']
                        -
                        (float) $row['credit'];
                }
            }
        }

        $periodRows = [];

        foreach (
            $allTransactions
            as $row
        ) {
            $rowDate =
                \Carbon\Carbon::createFromTimestamp(
                    $row['sort_at']
                );

            if (
                $fromDate !== null
                &&
                $rowDate->lt(
                    $fromDate
                )
            ) {
                continue;
            }

            if (
                $toDate !== null
                &&
                $rowDate->gt(
                    $toDate
                )
            ) {
                continue;
            }

            $periodRows[] =
                $row;
        }

        $running =
            round(
                $openingBalance,
                2
            );

        $periodDebits =
            0.0;

        $periodCredits =
            0.0;

        foreach (
            $periodRows
            as &$row
        ) {
            $periodDebits +=
                (float)
                $row['debit'];

            $periodCredits +=
                (float)
                $row['credit'];

            $running +=
                (float)
                $row['debit']
                -
                (float)
                $row['credit'];

            $row['running_balance'] =
                round(
                    $running,
                    2
                );

            unset(
                $row['sort_at'],
                $row['sort_type'],
                $row['source_id']
            );
        }

        unset($row);

        $sourceBalance =
            round(
                (float)
                $receivables
                    ->sum(
                        'balance_amount'
                    ),
                2
            );

        $closingBalance =
            round(
                $openingBalance
                +
                $periodDebits
                -
                $periodCredits,
                2
            );

        $statementThroughCurrentDate =
            $toDate === null
            ||
            $toDate->toDateString()
                >= now()->toDateString();

        $scopeExcludedReceivables =
            max(
                0,
                $allCustomerReceivablesCount
                -
                $receivables->count()
            );

        return [
            'tenant' => [
                'id' =>
                    (int) $tenant->id,

                'name' =>
                    $tenant->name,

                'slug' =>
                    $tenant->slug,
            ],

            'branch' => [
                'id' =>
                    $branchId,
            ],

            'customer' => [
                'id' =>
                    (int)
                    $customer->id,

                'uuid' =>
                    (string)
                    $customer->uuid,

                'reference' =>
                    (string)
                    $customer->uuid,

                'name' =>
                    $customerName,

                'first_name' =>
                    (string)
                    $customer->first_name,

                'last_name' =>
                    $customer->last_name,

                'phone' =>
                    $customer->phone,

                'email' =>
                    $customer->email,

                'status' =>
                    $customer->status,
            ],

            'period' => [
                'from_date' =>
                    $fromDate
                        ?->toDateString(),

                'to_date' =>
                    $toDate
                        ?->toDateString(),
            ],

            'summary' => [
                'opening_balance' =>
                    round(
                        $openingBalance,
                        2
                    ),

                'period_debits' =>
                    round(
                        $periodDebits,
                        2
                    ),

                'period_credits' =>
                    round(
                        $periodCredits,
                        2
                    ),

                'closing_balance' =>
                    $closingBalance,

                'source_balance' =>
                    $sourceBalance,

                'reconciles_to_source' =>
                    $statementThroughCurrentDate
                        ? abs(
                            $closingBalance
                            -
                            $sourceBalance
                        ) < 0.01
                        : null,

                'receivables_count' =>
                    $receivables->count(),

                'transaction_count' =>
                    count(
                        $periodRows
                    ),

                'scope_excluded_receivables' =>
                    $scopeExcludedReceivables,
            ],

            'transactions' =>
                array_values(
                    $periodRows
                ),

            'source_contract' => [
                'customer' =>
                    'pharmaco_customers',

                'receivables' =>
                    'pharmaco_customer_receivables',

                'payments' =>
                    'pharmaco_customer_receivable_payments',

                'branch_lineage' =>
                    'receivable.pharmaco_sale_id -> pharmaco_sales.branch_id',

                'posting_behavior' =>
                    'read_only',

                'release' =>
                    'ADVREP-R2A-R2',
            ],
        ];
    }

    /* END AQUILA_FINANCE_ADVREP_R2A_R2_CUSTOMER_STATEMENTS */

}
