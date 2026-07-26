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
            ->whereIn('mapping_key', $requiredMappings)
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
                function ($query) use ($branchId): void {
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

        if ($branchId !== null) {
            $saleQuery->where(
                'branch_id',
                $branchId
            );
        }

        $movementQuery = DB::table(
            'stock_movements'
        )
            ->where('tenant_id', $tenantId);

        if ($branchId !== null) {
            $movementQuery->where(
                'branch_id',
                $branchId
            );
        }

        $unknownPaymentMethods = DB::table(
            'pharmaco_payments'
        )
            ->where('pharmaco_payments.tenant_id', $tenantId)
            ->where('pharmaco_payments.status', 'completed')
            ->whereNotIn(
                'pharmaco_payments.payment_method',
                array_keys(
                    (array) config(
                        'finance.authoritative_payment_mappings',
                        []
                    )
                )
            )
            ->select('pharmaco_payments.payment_method')
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
                ->where('tenant_id', $tenantId)
                ->whereNull('business_date')
                ->count();

        $missingMovementBusinessDates =
            (clone $movementQuery)
                ->whereNull('business_date')
                ->count();

        $missingSaleCostSnapshots =
            DB::table('pharmaco_sale_items')
                ->where('tenant_id', $tenantId)
                ->where(
                    function ($query): void {
                        $query
                            ->whereNull(
                                'cost_unit_snapshot'
                            )
                            ->orWhereNull(
                                'cost_total_snapshot'
                            );
                    }
                )
                ->count();

        $missingMovementCostSnapshots =
            (clone $movementQuery)
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

        $blocking = [
            'missing_mappings' =>
                count($missingMappings),
            'missing_open_periods' =>
                $openPeriods === 0 ? 1 : 0,
            'missing_sale_business_dates' =>
                $missingSaleBusinessDates,
            'missing_payment_business_dates' =>
                $missingPaymentBusinessDates,
            'missing_movement_business_dates' =>
                $missingMovementBusinessDates,
            'missing_sale_cost_snapshots' =>
                $missingSaleCostSnapshots,
            'missing_movement_cost_snapshots' =>
                $missingMovementCostSnapshots,
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
            'overall_status' =>
                $blockingCount === 0
                    ? 'ready_for_dual_mode'
                    : 'blocked',
            'open_periods_count' => $openPeriods,
            'required_mappings' =>
                $requiredMappings,
            'available_mappings' =>
                $availableMappings,
            'missing_mappings' =>
                $missingMappings,
            'unknown_payment_methods' =>
                $unknownPaymentMethods,
            'blocking_counts' => $blocking,
        ];
    }
}
