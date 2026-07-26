<?php

namespace App\Services\Finance;

use Illuminate\Support\Facades\DB;

class FinanceAuthoritativePostingReadinessService
{
    /**
     * @return array<string, mixed>
     */
    public function report(
        int $tenantId,
        ?int $branchId = null,
    ): array {
        $requiredMappings = (array) config(
            'finance.authoritative_required_mappings',
            []
        );

        $availableMappings = DB::table(
            'finance_account_mappings'
        )
            ->where('tenant_id', $tenantId)
            ->where('is_active', true)
            ->whereIn(
                'mapping_key',
                $requiredMappings
            )
            ->pluck('mapping_key')
            ->unique()
            ->values()
            ->all();

        $missingMappings = array_values(
            array_diff(
                $requiredMappings,
                $availableMappings,
            )
        );

        $periodQuery = DB::table(
            'finance_accounting_periods'
        )
            ->where('tenant_id', $tenantId)
            ->where('status', 'open')
            ->where('is_locked', false);

        if ($branchId !== null) {
            $periodQuery->where(
                function ($query) use (
                    $branchId,
                ): void {
                    $query
                        ->whereNull('branch_id')
                        ->orWhere(
                            'branch_id',
                            $branchId
                        );
                }
            );
        }

        $saleQuery = DB::table(
            'pharmaco_sales'
        )
            ->where('tenant_id', $tenantId);

        $movementQuery = DB::table(
            'stock_movements'
        )
            ->where('tenant_id', $tenantId);

        $batchQuery = DB::table(
            'stock_batches'
        )
            ->where('tenant_id', $tenantId);

        if ($branchId !== null) {
            $saleQuery->where(
                'branch_id',
                $branchId
            );

            $movementQuery->where(
                'branch_id',
                $branchId
            );

            $batchQuery->where(
                'branch_id',
                $branchId
            );
        }

        $unknownPaymentMethods = DB::table(
            'pharmaco_payments'
        )
            ->where(
                'tenant_id',
                $tenantId
            )
            ->where(
                'status',
                'completed'
            )
            ->whereNotIn(
                'payment_method',
                array_keys(
                    (array) config(
                        'finance.authoritative_payment_mappings',
                        []
                    )
                )
            )
            ->select('payment_method')
            ->distinct()
            ->pluck('payment_method')
            ->values()
            ->all();

        $openPeriods = $periodQuery->count();

        $missingSaleBusinessDates =
            (clone $saleQuery)
                ->whereNull('business_date')
                ->count();

        $missingPaymentBusinessDates =
            DB::table('pharmaco_payments')
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->whereNull('business_date')
                ->count();

        $missingMovementBusinessDates =
            (clone $movementQuery)
                ->whereNull('business_date')
                ->count();

        $activeInventoryBatchesMissingCost =
            (clone $batchQuery)
                ->whereRaw(
                    'ABS(COALESCE(quantity_on_hand, 0)) > 0.0001'
                )
                ->whereRaw(
                    'NOT (
                        COALESCE(unit_cost, 0) > 0
                        OR COALESCE(original_unit_cost, 0) > 0
                        OR (
                            COALESCE(inferred_unit_cost, 0) > 0
                            AND cost_resolved_at IS NOT NULL
                            AND TRIM(COALESCE(cost_source, \'\')) <> \'\'
                        )
                    )'
                )
                ->count();

        $historicalFinalisedSaleItemsMissingCost =
            DB::table(
                'pharmaco_sale_items as item'
            )
                ->join(
                    'pharmaco_sales as sale',
                    'sale.id',
                    '=',
                    'item.pharmaco_sale_id'
                )
                ->where(
                    'item.tenant_id',
                    $tenantId
                )
                ->whereIn(
                    'sale.status',
                    (array) config(
                        'finance.authoritative_sale_statuses',
                        [
                            'dispensed',
                            'completed',
                        ]
                    )
                )
                ->whereNotIn(
                    'item.status',
                    [
                        'cancelled',
                        'voided',
                        'returned',
                    ]
                )
                ->whereRaw(
                    'ABS(COALESCE(item.quantity, 0)) > 0'
                )
                ->where(
                    function ($query): void {
                        $query
                            ->whereNull(
                                'item.cost_unit_snapshot'
                            )
                            ->orWhereNull(
                                'item.cost_total_snapshot'
                            );
                    }
                )
                ->count();

        $historicalMovementsMissingCost =
            (clone $movementQuery)
                ->whereRaw(
                    'ABS(COALESCE(quantity, 0)) > 0'
                )
                ->where(
                    function ($query): void {
                        $query
                            ->whereNull(
                                'unit_cost_snapshot'
                            )
                            ->orWhereNull(
                                'total_cost_snapshot'
                            );
                    }
                )
                ->count();

        $draftItemsWithoutBatch =
            DB::table(
                'pharmaco_sale_items as item'
            )
                ->join(
                    'pharmaco_sales as sale',
                    'sale.id',
                    '=',
                    'item.pharmaco_sale_id'
                )
                ->where(
                    'item.tenant_id',
                    $tenantId
                )
                ->whereNull(
                    'item.stock_batch_id'
                )
                ->whereNotIn(
                    'sale.status',
                    (array) config(
                        'finance.authoritative_sale_statuses',
                        [
                            'dispensed',
                            'completed',
                        ]
                    )
                )
                ->count();

        $approvedInventoryCostRecords =
            DB::table(
                'finance_inventory_cost_approvals'
            )
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->where(
                    'status',
                    'approved'
                )
                ->count();

        $blocking = [
            'missing_mappings' =>
                count($missingMappings),

            'missing_open_periods' =>
                $openPeriods === 0
                    ? 1
                    : 0,

            'missing_sale_business_dates' =>
                $missingSaleBusinessDates,

            'missing_payment_business_dates' =>
                $missingPaymentBusinessDates,

            'missing_movement_business_dates' =>
                $missingMovementBusinessDates,

            'active_inventory_batches_missing_approved_cost' =>
                $activeInventoryBatchesMissingCost,

            'unknown_payment_methods' =>
                count($unknownPaymentMethods),
        ];

        $blockingCount = array_sum(
            array_map(
                static fn ($value): int =>
                    (int) $value,
                $blocking,
            )
        );

        return [
            'tenant_id' => $tenantId,
            'branch_id' => $branchId,

            'configured_mode' => config(
                'finance.pos_posting_mode',
                'shadow'
            ),

            'prospective_cutover_date' =>
                config(
                    'finance.prospective_cutover_date',
                    '2026-08-01'
                ),

            'overall_status' =>
                $blockingCount === 0
                    ? 'ready_for_prospective_dual_mode'
                    : 'blocked',

            'open_periods_count' =>
                $openPeriods,

            'approved_inventory_cost_records' =>
                $approvedInventoryCostRecords,

            'required_mappings' =>
                $requiredMappings,

            'available_mappings' =>
                $availableMappings,

            'missing_mappings' =>
                $missingMappings,

            'unknown_payment_methods' =>
                $unknownPaymentMethods,

            'blocking_counts' =>
                $blocking,

            'historical_exception_counts' => [
                'finalised_sale_items_missing_cost_snapshot' =>
                    $historicalFinalisedSaleItemsMissingCost,

                'stock_movements_missing_cost_snapshot' =>
                    $historicalMovementsMissingCost,

                'draft_items_without_batch' =>
                    $draftItemsWithoutBatch,
            ],
        ];
    }
}
