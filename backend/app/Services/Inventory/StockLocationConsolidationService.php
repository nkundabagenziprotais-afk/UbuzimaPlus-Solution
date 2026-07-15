<?php

declare(strict_types=1);

namespace App\Services\Inventory;

use App\Models\StockBatch;
use App\Models\StockLocation;
use App\Models\StockMovement;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use RuntimeException;
use Throwable;

class StockLocationConsolidationService
{
    /**
     * Consolidate one stock location into another.
     *
     * Dry-run is the default. The transaction is rolled back unless
     * execute is explicitly true.
     *
     * @return array<string, mixed>
     */
    public function consolidate(
        string $sourceName,
        string $targetName,
        bool $execute = false
    ): array {
        DB::beginTransaction();

        try {
            $report = $this->performConsolidation(
                trim($sourceName),
                trim($targetName)
            );

            if ($execute) {
                DB::commit();
                $report['execution_status'] = 'COMPLETED';
            } else {
                DB::rollBack();
                $report['execution_status'] = 'DRY_RUN_ROLLED_BACK';
            }

            return $report;
        } catch (Throwable $throwable) {
            if (DB::transactionLevel() > 0) {
                DB::rollBack();
            }

            throw $throwable;
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function performConsolidation(
        string $sourceName,
        string $targetName
    ): array {
        $sourceMatches = StockLocation::query()
            ->whereRaw(
                'LOWER(TRIM(name)) = LOWER(TRIM(?))',
                [$sourceName]
            )
            ->lockForUpdate()
            ->get();

        $targetMatches = StockLocation::query()
            ->whereRaw(
                'LOWER(TRIM(name)) = LOWER(TRIM(?))',
                [$targetName]
            )
            ->lockForUpdate()
            ->get();

        if ($sourceMatches->count() !== 1) {
            throw new RuntimeException(
                "Source location must resolve uniquely: {$sourceName}"
            );
        }

        if ($targetMatches->count() !== 1) {
            throw new RuntimeException(
                "Target location must resolve uniquely: {$targetName}"
            );
        }

        /** @var StockLocation $source */
        $source = $sourceMatches->first();

        /** @var StockLocation $target */
        $target = $targetMatches->first();

        if ((int) $source->id === (int) $target->id) {
            throw new RuntimeException(
                'Source and target locations cannot be the same.'
            );
        }

        if ((int) $source->tenant_id !== (int) $target->tenant_id) {
            throw new RuntimeException(
                'Cross-tenant stock-location consolidation is prohibited.'
            );
        }

        if ((int) $source->branch_id !== (int) $target->branch_id) {
            throw new RuntimeException(
                'Cross-branch stock-location consolidation is prohibited.'
            );
        }

        $sourceId = (int) $source->id;
        $targetId = (int) $target->id;
        $targetBranchId = (int) $target->branch_id;

        $before = $this->batchStatistics(
            [$sourceId, $targetId]
        );

        $sourceBatches = StockBatch::query()
            ->where('stock_location_id', $sourceId)
            ->orderBy('id')
            ->lockForUpdate()
            ->get();

        $collisionCount = 0;
        $mergedSourceBatchIds = [];
        $affectedTargetBatchIds = [];

        foreach ($sourceBatches as $sourceBatch) {
            $targetBatch = StockBatch::query()
                ->where('stock_location_id', $targetId)
                ->where(
                    'product_id',
                    $sourceBatch->product_id
                )
                ->where(
                    'batch_number',
                    $sourceBatch->batch_number
                )
                ->lockForUpdate()
                ->first();

            if (! $targetBatch) {
                continue;
            }

            $collisionCount++;

            $this->mergeBatch(
                $sourceBatch,
                $targetBatch,
                $targetBranchId
            );

            $this->reassignBatchReferences(
                (int) $sourceBatch->id,
                (int) $targetBatch->id
            );

            $mergedSourceBatchIds[] =
                (int) $sourceBatch->id;

            $affectedTargetBatchIds[] =
                (int) $targetBatch->id;

            $sourceBatch->delete();
        }

        $remainingBatches = StockBatch::query()
            ->where('stock_location_id', $sourceId)
            ->lockForUpdate()
            ->get();

        foreach ($remainingBatches as $batch) {
            $batch->stock_location_id = $targetId;
            $batch->branch_id = $targetBranchId;
            $batch->save();

            $affectedTargetBatchIds[] = (int) $batch->id;
        }

        $locationReferenceUpdates =
            $this->reassignLocationReferences(
                $sourceId,
                $targetId
            );

        $affectedTargetBatchIds = array_values(
            array_unique($affectedTargetBatchIds)
        );

        foreach ($affectedTargetBatchIds as $batchId) {
            $this->rebuildMovementRunningBalances(
                $batchId
            );
        }

        $source->delete();

        $after = $this->batchStatistics([$targetId]);

        $remainingSourceLocation = StockLocation::query()
            ->whereKey($sourceId)
            ->count();

        $remainingSourceBatches = StockBatch::query()
            ->where('stock_location_id', $sourceId)
            ->count();

        $remainingSourceMovements = StockMovement::query()
            ->where('stock_location_id', $sourceId)
            ->count();

        $quantityVariance =
            (float) $after['quantity']
            - (float) $before['quantity'];

        $reservedVariance =
            (float) $after['reserved']
            - (float) $before['reserved'];

        $valueVariance =
            (float) $after['inventory_value']
            - (float) $before['inventory_value'];

        $expectedBatchCount =
            (int) $before['batch_count']
            - $collisionCount;

        $foreignKeyViolationCount =
            $this->foreignKeyViolationCount();

        $passed = (
            $remainingSourceLocation === 0
            && $remainingSourceBatches === 0
            && $remainingSourceMovements === 0
            && (int) $after['batch_count']
                === $expectedBatchCount
            && abs($quantityVariance) < 0.000001
            && abs($reservedVariance) < 0.000001
            && abs($valueVariance) < 0.01
            && $foreignKeyViolationCount === 0
        );

        if (! $passed) {
            throw new RuntimeException(
                'Location consolidation invariant validation failed.'
            );
        }

        return [
            'source_location_id' => $sourceId,
            'source_location_name' => $sourceName,
            'target_location_id' => $targetId,
            'target_location_name' => $targetName,
            'collision_count' => $collisionCount,
            'merged_source_batch_ids' =>
                $mergedSourceBatchIds,
            'affected_target_batch_ids' =>
                $affectedTargetBatchIds,
            'location_reference_updates' =>
                $locationReferenceUpdates,
            'combined_batch_count_before' =>
                (int) $before['batch_count'],
            'combined_batch_count_after' =>
                (int) $after['batch_count'],
            'combined_quantity_before' =>
                (float) $before['quantity'],
            'combined_quantity_after' =>
                (float) $after['quantity'],
            'combined_reserved_before' =>
                (float) $before['reserved'],
            'combined_reserved_after' =>
                (float) $after['reserved'],
            'combined_inventory_value_before' =>
                round(
                    (float) $before['inventory_value'],
                    2
                ),
            'combined_inventory_value_after' =>
                round(
                    (float) $after['inventory_value'],
                    2
                ),
            'quantity_variance' =>
                round($quantityVariance, 6),
            'reserved_variance' =>
                round($reservedVariance, 6),
            'inventory_value_variance' =>
                round($valueVariance, 6),
            'remaining_source_location' =>
                $remainingSourceLocation,
            'remaining_source_batches' =>
                $remainingSourceBatches,
            'remaining_source_movements' =>
                $remainingSourceMovements,
            'foreign_key_violation_count' =>
                $foreignKeyViolationCount,
            'validation_status' => 'PASSED',
        ];
    }

    private function mergeBatch(
        StockBatch $source,
        StockBatch $target,
        int $targetBranchId
    ): void {
        $sourceQuantity =
            (float) $source->quantity_on_hand;

        $targetQuantity =
            (float) $target->quantity_on_hand;

        $combinedQuantity =
            $sourceQuantity + $targetQuantity;

        $combinedReserved =
            (float) $source->quantity_reserved
            + (float) $target->quantity_reserved;

        $sourceCost =
            (float) ($source->unit_cost ?? 0);

        $targetCost =
            (float) ($target->unit_cost ?? 0);

        $combinedValue =
            ($sourceQuantity * $sourceCost)
            + ($targetQuantity * $targetCost);

        $weightedUnitCost = null;

        if (abs($combinedQuantity) > 0.0000001) {
            $weightedUnitCost =
                $combinedValue / $combinedQuantity;
        } elseif ($target->unit_cost !== null) {
            $weightedUnitCost = $targetCost;
        } elseif ($source->unit_cost !== null) {
            $weightedUnitCost = $sourceCost;
        }

        $expiryDates = array_values(
            array_filter([
                $source->expiry_date?->toDateString(),
                $target->expiry_date?->toDateString(),
            ])
        );

        sort($expiryDates);

        $target->quantity_on_hand = $combinedQuantity;
        $target->quantity_reserved = $combinedReserved;
        $target->unit_cost = $weightedUnitCost;
        $target->branch_id = $targetBranchId;

        if ($expiryDates !== []) {
            $target->expiry_date = $expiryDates[0];
        }

        if ($target->selling_price === null) {
            $target->selling_price =
                $source->selling_price;
        }

        if (
            trim((string) $target->supplier_name) === ''
        ) {
            $target->supplier_name =
                $source->supplier_name;
        }

        if (trim((string) $target->status) === '') {
            $target->status =
                $source->status ?: 'active';
        }

        $target->save();
    }

    private function reassignBatchReferences(
        int $sourceBatchId,
        int $targetBatchId
    ): void {
        $references = [
            [
                'table' => 'pharmaco_sale_items',
                'column' => 'stock_batch_id',
            ],
            [
                'table' =>
                    'pharmaco_sale_return_items',
                'column' => 'stock_batch_id',
            ],
            [
                'table' =>
                    'product_reconciliation_rows',
                'column' => 'batch_id',
            ],
            [
                'table' => 'stock_movements',
                'column' => 'stock_batch_id',
            ],
        ];

        foreach ($references as $reference) {
            if (
                ! Schema::hasTable($reference['table'])
                || ! Schema::hasColumn(
                    $reference['table'],
                    $reference['column']
                )
            ) {
                continue;
            }

            DB::table($reference['table'])
                ->where(
                    $reference['column'],
                    $sourceBatchId
                )
                ->update([
                    $reference['column'] =>
                        $targetBatchId,
                ]);
        }
    }

    /**
     * @return array<string, int>
     */
    private function reassignLocationReferences(
        int $sourceLocationId,
        int $targetLocationId
    ): array {
        $references = [
            [
                'table' =>
                    'pharmaco_general_item_locations',
                'column' => 'stock_location_id',
            ],
            [
                'table' => 'pharmaco_sale_items',
                'column' => 'stock_location_id',
            ],
            [
                'table' => 'stock_movements',
                'column' => 'stock_location_id',
            ],
        ];

        $updates = [];

        foreach ($references as $reference) {
            if (
                ! Schema::hasTable($reference['table'])
                || ! Schema::hasColumn(
                    $reference['table'],
                    $reference['column']
                )
            ) {
                continue;
            }

            $count = DB::table($reference['table'])
                ->where(
                    $reference['column'],
                    $sourceLocationId
                )
                ->update([
                    $reference['column'] =>
                        $targetLocationId,
                ]);

            $updates[
                $reference['table']
                . '.'
                . $reference['column']
            ] = $count;
        }

        return $updates;
    }

    private function rebuildMovementRunningBalances(
        int $batchId
    ): void {
        $batch = StockBatch::query()
            ->whereKey($batchId)
            ->lockForUpdate()
            ->firstOrFail();

        $orderColumn = Schema::hasColumn(
            'stock_movements',
            'occurred_at'
        )
            ? 'occurred_at'
            : 'created_at';

        $movements = StockMovement::query()
            ->where('stock_batch_id', $batchId)
            ->orderBy($orderColumn)
            ->orderBy('id')
            ->lockForUpdate()
            ->get();

        if ($movements->isEmpty()) {
            return;
        }

        $signedTotal = 0.0;

        foreach ($movements as $movement) {
            $signedTotal += $this->signedQuantity(
                (string) $movement->movement_type,
                (float) $movement->quantity
            );
        }

        $runningBalance =
            (float) $batch->quantity_on_hand
            - $signedTotal;

        foreach ($movements as $movement) {
            $runningBalance += $this->signedQuantity(
                (string) $movement->movement_type,
                (float) $movement->quantity
            );

            $movement->running_balance =
                round($runningBalance, 2);

            $movement->save();
        }

        if (
            abs(
                $runningBalance
                - (float) $batch->quantity_on_hand
            ) >= 0.01
        ) {
            throw new RuntimeException(
                "Running-balance reconstruction failed for batch {$batchId}."
            );
        }
    }

    private function signedQuantity(
        string $movementType,
        float $quantity
    ): float {
        if ($quantity < 0) {
            return $quantity;
        }

        $outboundTypes = [
            'sale',
            'sold',
            'dispensed',
            'stock_issued',
            'issue',
            'adjustment_out',
            'transfer_out',
            'expired',
            'damaged',
            'write_off',
            'return_to_supplier',
        ];

        return in_array(
            strtolower(trim($movementType)),
            $outboundTypes,
            true
        )
            ? -$quantity
            : $quantity;
    }

    /**
     * @param array<int, int> $locationIds
     *
     * @return array<string, int|float>
     */
    private function batchStatistics(
        array $locationIds
    ): array {
        $statistics = StockBatch::query()
            ->whereIn(
                'stock_location_id',
                $locationIds
            )
            ->selectRaw('COUNT(*) AS batch_count')
            ->selectRaw(
                'COALESCE(SUM(quantity_on_hand), 0) AS quantity'
            )
            ->selectRaw(
                'COALESCE(SUM(quantity_reserved), 0) AS reserved'
            )
            ->selectRaw(
                'COALESCE(SUM('
                . 'quantity_on_hand '
                . '* COALESCE(unit_cost, 0)'
                . '), 0) AS inventory_value'
            )
            ->first();

        return [
            'batch_count' =>
                (int) $statistics->batch_count,
            'quantity' =>
                (float) $statistics->quantity,
            'reserved' =>
                (float) $statistics->reserved,
            'inventory_value' =>
                (float) $statistics->inventory_value,
        ];
    }

    private function foreignKeyViolationCount(): int
    {
        if (DB::getDriverName() !== 'sqlite') {
            return 0;
        }

        return count(
            DB::select('PRAGMA foreign_key_check')
        );
    }
}
