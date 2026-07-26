<?php

namespace App\Services\Finance;

use App\Models\PharmacoSaleItem;
use App\Models\StockBatch;
use App\Models\StockMovement;
use RuntimeException;

class FinanceInventoryCostSnapshotResolver
{
    /**
     * @return array{
     *     unit_cost: float,
     *     total_cost: float,
     *     source: string,
     *     snapshot_at: string,
     *     metadata: array<string, mixed>
     * }
     */
    public function resolveSaleItem(
        PharmacoSaleItem $item,
    ): array {
        $quantity = abs((float) $item->quantity);

        if ($quantity <= 0) {
            throw new RuntimeException(
                "Sale item {$item->id} has no positive quantity."
            );
        }

        if (
            (float) $item->cost_unit_snapshot > 0
            && (float) $item->cost_total_snapshot > 0
        ) {
            return [
                'unit_cost' =>
                    round((float) $item->cost_unit_snapshot, 4),
                'total_cost' =>
                    round((float) $item->cost_total_snapshot, 4),
                'source' =>
                    (string) $item->cost_source_snapshot,
                'snapshot_at' =>
                    $item->cost_snapshot_at?->toISOString()
                    ?: now()->toISOString(),
                'metadata' =>
                    (array) $item->cost_snapshot_metadata,
            ];
        }

        $batch = $item->stockBatch;

        if (! $batch) {
            throw new RuntimeException(
                "Sale item {$item->id} has no stock batch."
            );
        }

        return $this->resolveBatch(
            $batch,
            $quantity,
        );
    }

    /**
     * @return array{
     *     unit_cost: float,
     *     total_cost: float,
     *     source: string,
     *     snapshot_at: string,
     *     metadata: array<string, mixed>
     * }
     */
    public function resolveStockMovement(
        StockMovement $movement,
    ): array {
        $quantity = abs((float) $movement->quantity);

        if ($quantity <= 0) {
            throw new RuntimeException(
                "Stock movement {$movement->id} has no quantity."
            );
        }

        if (
            (float) $movement->unit_cost_snapshot > 0
            && (float) $movement->total_cost_snapshot > 0
        ) {
            return [
                'unit_cost' =>
                    round(
                        (float) $movement->unit_cost_snapshot,
                        4
                    ),
                'total_cost' =>
                    round(
                        (float) $movement->total_cost_snapshot,
                        4
                    ),
                'source' =>
                    (string) $movement->cost_source_snapshot,
                'snapshot_at' =>
                    $movement->cost_snapshot_at?->toISOString()
                    ?: now()->toISOString(),
                'metadata' =>
                    (array) $movement->cost_snapshot_metadata,
            ];
        }

        $batch = $movement->stockBatch;

        if (! $batch) {
            throw new RuntimeException(
                "Stock movement {$movement->id} has no stock batch."
            );
        }

        return $this->resolveBatch(
            $batch,
            $quantity,
        );
    }

    /**
     * @return array{
     *     unit_cost: float,
     *     total_cost: float,
     *     source: string,
     *     snapshot_at: string,
     *     metadata: array<string, mixed>
     * }
     */
    private function resolveBatch(
        StockBatch $batch,
        float $quantity,
    ): array {
        $unitCost = null;
        $source = null;

        if ((float) $batch->unit_cost > 0) {
            $unitCost = (float) $batch->unit_cost;
            $source = 'stock_batch.unit_cost';
        } elseif ((float) $batch->original_unit_cost > 0) {
            $unitCost = (float) $batch->original_unit_cost;
            $source = 'stock_batch.original_unit_cost';
        } elseif (
            (float) $batch->inferred_unit_cost > 0
            && $batch->cost_resolved_at
            && trim((string) $batch->cost_source) !== ''
        ) {
            $unitCost = (float) $batch->inferred_unit_cost;
            $source = 'stock_batch.approved_inferred_unit_cost';
        }

        if ($unitCost === null || $unitCost <= 0) {
            throw new RuntimeException(
                "Stock batch {$batch->id} has no approved positive cost."
            );
        }

        $unitCost = round($unitCost, 4);
        $totalCost = round($quantity * $unitCost, 4);

        return [
            'unit_cost' => $unitCost,
            'total_cost' => $totalCost,
            'source' => $source,
            'snapshot_at' => now()->toISOString(),
            'metadata' => [
                'stock_batch_id' => $batch->id,
                'batch_number' => $batch->batch_number,
                'quantity_basis' => $quantity,
                'unit_cost_at_resolution' => $unitCost,
                'batch_cost_source' => $batch->cost_source,
                'batch_cost_adjustment_method' =>
                    $batch->cost_adjustment_method,
                'batch_cost_resolved_at' =>
                    optional($batch->cost_resolved_at)
                        ->toISOString(),
                'resolver' => self::class,
            ],
        ];
    }
}
