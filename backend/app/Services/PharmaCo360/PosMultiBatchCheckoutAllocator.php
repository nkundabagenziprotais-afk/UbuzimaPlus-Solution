<?php

namespace App\Services\PharmaCo360;

use App\Models\StockBatch;
use Illuminate\Validation\ValidationException;

/**
 * Allocates one customer-facing POS line across eligible stock batches.
 *
 * This service is called from inside AtomicPosCheckoutService's outer
 * transaction. lockForUpdate therefore protects FEFO selection until
 * sale creation, stock deduction and payment have all completed.
 */
class PosMultiBatchCheckoutAllocator
{
    private const QUANTITY_SCALE = 3;

    private const QUANTITY_EPSILON = 0.0005;

    /**
     * @param array<int, array<string, mixed>> $items
     * @return array<int, array<string, mixed>>
     */
    public function expandAndLock(
        int $tenantId,
        int $branchId,
        array $items
    ): array {
        $productIds = collect($items)
            ->pluck('product_id')
            ->filter()
            ->map(
                static fn ($value): int =>
                    (int) $value
            )
            ->unique()
            ->values();

        $today = now()->toDateString();

        $batches = StockBatch::query()
            ->where('tenant_id', $tenantId)
            ->where('branch_id', $branchId)
            ->whereIn('product_id', $productIds)
            ->where('status', 'active')
            ->whereRaw(
                '(quantity_on_hand - quantity_reserved) > 0'
            )
            ->where(
                static function ($query) use ($today): void {
                    $query
                        ->whereNull('expiry_date')
                        ->orWhereDate(
                            'expiry_date',
                            '>=',
                            $today
                        );
                }
            )
            ->orderByRaw(
                'CASE WHEN expiry_date IS NULL '
                . 'THEN 1 ELSE 0 END'
            )
            ->orderBy('expiry_date')
            ->orderBy('received_at')
            ->orderBy('id')
            ->lockForUpdate()
            ->get([
                'id',
                'product_id',
                'batch_number',
                'expiry_date',
                'received_at',
                'quantity_on_hand',
                'quantity_reserved',
            ]);

        $pools = [];

        foreach ($batches as $batch) {
            $productId = (int) $batch->product_id;

            $pools[$productId][] = [
                'id' => (int) $batch->id,
                'batch_number' =>
                    (string) $batch->batch_number,
                'expiry_date' =>
                    $batch->expiry_date
                        ? (string) $batch->expiry_date
                        : null,
                'received_at' =>
                    $batch->received_at
                        ? (string) $batch->received_at
                        : null,
                'available_quantity' => round(
                    max(
                        (float) $batch->quantity_on_hand
                        - (float) $batch->quantity_reserved,
                        0
                    ),
                    self::QUANTITY_SCALE
                ),
            ];
        }

        $expanded = [];

        foreach (
            array_values($items)
            as $itemIndex => $item
        ) {
            $productId = (int) (
                $item['product_id']
                ?? 0
            );

            $allocations = $this->allocateLine(
                item: $item,
                orderedBatches:
                    $pools[$productId] ?? [],
                itemIndex: $itemIndex
            );

            foreach ($allocations as $allocation) {
                $allocatedBatchId = (int) (
                    $allocation['stock_batch_id']
                    ?? 0
                );

                foreach (
                    $pools[$productId] ?? []
                    as $poolIndex => $pool
                ) {
                    if (
                        (int) $pool['id']
                        !== $allocatedBatchId
                    ) {
                        continue;
                    }

                    $pools[$productId][$poolIndex][
                        'available_quantity'
                    ] = round(
                        max(
                            (float) $pool[
                                'available_quantity'
                            ]
                            - (float) $allocation[
                                'quantity'
                            ],
                            0
                        ),
                        self::QUANTITY_SCALE
                    );

                    break;
                }
            }

            $expanded = [
                ...$expanded,
                ...$allocations,
            ];
        }

        return $expanded;
    }

    /**
     * Batch rows must already be ordered using FEFO:
     * expiry date, received date, then batch ID.
     *
     * @param array<string, mixed> $item
     * @param array<int, array<string, mixed>> $orderedBatches
     * @return array<int, array<string, mixed>>
     */
    public function allocateLine(
        array $item,
        array $orderedBatches,
        int $itemIndex = 0
    ): array {
        $requestedQuantity = round(
            (float) (
                $item['quantity']
                ?? 0
            ),
            self::QUANTITY_SCALE
        );

        if (
            $requestedQuantity
            <= self::QUANTITY_EPSILON
        ) {
            throw ValidationException::withMessages([
                "items.{$itemIndex}.quantity" => [
                    'The requested sale quantity must '
                    . 'be greater than zero.',
                ],
            ]);
        }

        $availableTotal = round(
            array_reduce(
                $orderedBatches,
                static fn (
                    float $total,
                    array $batch
                ): float =>
                    $total
                    + max(
                        (float) (
                            $batch[
                                'available_quantity'
                            ]
                            ?? 0
                        ),
                        0
                    ),
                0.0
            ),
            self::QUANTITY_SCALE
        );

        if (
            $availableTotal
            + self::QUANTITY_EPSILON
            < $requestedQuantity
        ) {
            throw ValidationException::withMessages([
                "items.{$itemIndex}.quantity" => [
                    sprintf(
                        'Requested quantity %.3f exceeds '
                        . 'the combined eligible FEFO '
                        . 'inventory of %.3f.',
                        $requestedQuantity,
                        $availableTotal
                    ),
                ],
            ]);
        }

        $totalDiscount = round(
            (float) (
                $item['discount_amount']
                ?? 0
            ),
            2
        );

        $totalTax = round(
            (float) (
                $item['tax_amount']
                ?? 0
            ),
            2
        );

        $remainingQuantity =
            $requestedQuantity;

        $remainingDiscount =
            $totalDiscount;

        $remainingTax =
            $totalTax;

        $allocations = [];

        foreach ($orderedBatches as $batch) {
            if (
                $remainingQuantity
                <= self::QUANTITY_EPSILON
            ) {
                break;
            }

            $availableQuantity = round(
                max(
                    (float) (
                        $batch['available_quantity']
                        ?? 0
                    ),
                    0
                ),
                self::QUANTITY_SCALE
            );

            if (
                $availableQuantity
                <= self::QUANTITY_EPSILON
            ) {
                continue;
            }

            $allocationQuantity = round(
                min(
                    $availableQuantity,
                    $remainingQuantity
                ),
                self::QUANTITY_SCALE
            );

            $remainingAfterAllocation = round(
                max(
                    $remainingQuantity
                    - $allocationQuantity,
                    0
                ),
                self::QUANTITY_SCALE
            );

            $isFinalAllocation =
                $remainingAfterAllocation
                <= self::QUANTITY_EPSILON;

            $allocationRatio =
                $requestedQuantity > 0
                    ? $allocationQuantity
                        / $requestedQuantity
                    : 0;

            $allocationDiscount =
                $isFinalAllocation
                    ? $remainingDiscount
                    : round(
                        $totalDiscount
                        * $allocationRatio,
                        2
                    );

            $allocationTax =
                $isFinalAllocation
                    ? $remainingTax
                    : round(
                        $totalTax
                        * $allocationRatio,
                        2
                    );

            $allocations[] = [
                ...$item,
                'quantity' =>
                    $allocationQuantity,
                'stock_batch_id' =>
                    (int) $batch['id'],
                'discount_amount' =>
                    $allocationDiscount,
                'tax_amount' =>
                    $allocationTax,
            ];

            $remainingQuantity =
                $remainingAfterAllocation;

            $remainingDiscount = round(
                $remainingDiscount
                - $allocationDiscount,
                2
            );

            $remainingTax = round(
                $remainingTax
                - $allocationTax,
                2
            );
        }

        if (
            $remainingQuantity
            > self::QUANTITY_EPSILON
        ) {
            throw ValidationException::withMessages([
                "items.{$itemIndex}.quantity" => [
                    'The requested quantity could not '
                    . 'be fully allocated across eligible '
                    . 'FEFO inventory batches.',
                ],
            ]);
        }

        return $allocations;
    }
}
