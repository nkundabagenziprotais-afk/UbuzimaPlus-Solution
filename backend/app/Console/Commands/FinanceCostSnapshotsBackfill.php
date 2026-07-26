<?php

namespace App\Console\Commands;

use App\Models\PharmacoSaleItem;
use App\Models\StockMovement;
use App\Services\Finance\FinanceInventoryCostSnapshotResolver;
use Illuminate\Console\Command;
use Throwable;

class FinanceCostSnapshotsBackfill extends Command
{
    protected $signature = 'finance:cost-snapshots:backfill
        {--tenant_id= : Restrict to one tenant}
        {--limit=0 : Maximum rows per record group}
        {--apply : Apply the resolved cost snapshots}';

    protected $description =
        'Resolve immutable Finance cost snapshots; dry-run by default.';

    public function handle(
        FinanceInventoryCostSnapshotResolver $resolver,
    ): int {
        $apply = (bool) $this->option('apply');
        $tenantId = $this->option('tenant_id');
        $limit = max(
            0,
            (int) $this->option('limit')
        );

        $this->info(
            'Finance Cost Snapshot Backfill'
        );
        $this->line(
            'Mode: ' . ($apply ? 'apply' : 'dry-run')
        );

        $saleItemQuery = PharmacoSaleItem::query()
            ->with('stockBatch')
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
            ->orderBy('id');

        $movementQuery = StockMovement::query()
            ->with('stockBatch')
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
            ->orderBy('id');

        if (is_numeric($tenantId)) {
            $saleItemQuery->where(
                'tenant_id',
                (int) $tenantId
            );

            $movementQuery->where(
                'tenant_id',
                (int) $tenantId
            );
        }

        if ($limit > 0) {
            $saleItemQuery->limit($limit);
            $movementQuery->limit($limit);
        }

        $saleItems = $saleItemQuery->get();
        $movements = $movementQuery->get();

        $resolvedSaleItems = 0;
        $unresolvedSaleItems = 0;
        $appliedSaleItems = 0;

        foreach ($saleItems as $item) {
            try {
                $snapshot =
                    $resolver->resolveSaleItem(
                        $item
                    );

                $resolvedSaleItems++;

                $this->line(
                    "SALE_ITEM id={$item->id} "
                    . "unit_cost={$snapshot['unit_cost']} "
                    . "total_cost={$snapshot['total_cost']} "
                    . "source={$snapshot['source']}"
                );

                if ($apply) {
                    $item->forceFill([
                        'cost_unit_snapshot' =>
                            $snapshot['unit_cost'],
                        'cost_total_snapshot' =>
                            $snapshot['total_cost'],
                        'cost_source_snapshot' =>
                            $snapshot['source'],
                        'cost_snapshot_at' =>
                            $snapshot['snapshot_at'],
                        'cost_snapshot_metadata' =>
                            $snapshot['metadata'],
                    ])->save();

                    $appliedSaleItems++;
                }
            } catch (Throwable $exception) {
                $unresolvedSaleItems++;

                $this->warn(
                    "SALE_ITEM_UNRESOLVED id={$item->id} "
                    . $exception->getMessage()
                );
            }
        }

        $resolvedMovements = 0;
        $unresolvedMovements = 0;
        $appliedMovements = 0;

        foreach ($movements as $movement) {
            try {
                $snapshot =
                    $resolver->resolveStockMovement(
                        $movement
                    );

                $resolvedMovements++;

                $this->line(
                    "STOCK_MOVEMENT id={$movement->id} "
                    . "unit_cost={$snapshot['unit_cost']} "
                    . "total_cost={$snapshot['total_cost']} "
                    . "source={$snapshot['source']}"
                );

                if ($apply) {
                    $movement->forceFill([
                        'unit_cost_snapshot' =>
                            $snapshot['unit_cost'],
                        'total_cost_snapshot' =>
                            $snapshot['total_cost'],
                        'cost_source_snapshot' =>
                            $snapshot['source'],
                        'cost_snapshot_at' =>
                            $snapshot['snapshot_at'],
                        'cost_snapshot_metadata' =>
                            $snapshot['metadata'],
                    ])->save();

                    $appliedMovements++;
                }
            } catch (Throwable $exception) {
                $unresolvedMovements++;

                $this->warn(
                    "STOCK_MOVEMENT_UNRESOLVED "
                    . "id={$movement->id} "
                    . $exception->getMessage()
                );
            }
        }

        $this->newLine();

        $this->line(
            "Sale items: candidates={$saleItems->count()} "
            . "resolved={$resolvedSaleItems} "
            . "unresolved={$unresolvedSaleItems} "
            . "applied={$appliedSaleItems}"
        );

        $this->line(
            "Stock movements: candidates={$movements->count()} "
            . "resolved={$resolvedMovements} "
            . "unresolved={$unresolvedMovements} "
            . "applied={$appliedMovements}"
        );

        $this->line(
            'Production writes: '
            . ($apply ? 'YES' : 'NO')
        );

        return self::SUCCESS;
    }
}
