<?php

namespace App\Services\PharmaCo360;

use App\Models\Product;
use App\Models\StockBatch;
use Illuminate\Validation\ValidationException;

/**
 * Allocates one customer-facing POS line across eligible FEFO
 * batches.
 *
 * AQUILA_POS_HIGHEST_AFFECTED_PRICE_ALLOCATOR_V2
 *
 * The authoritative cart-line price is the highest selling price
 * among only the FEFO batches required to satisfy the requested
 * quantity.
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

        if ($productIds->isEmpty()) {
            return [];
        }

        /*
         * Product Master is authoritative for conversion between
         * selling-unit price and base-unit price.
         */
        $productFactors = Product::query()
            ->where('tenant_id', $tenantId)
            ->whereIn('id', $productIds)
            ->get([
                'id',
                'quantity_per_selling_unit',
            ])
            ->mapWithKeys(
                static function (
                    Product $product
                ): array {
                    $factor = max(
                        (float) (
                            $product
                                ->quantity_per_selling_unit
                            ?? 1
                        ),
                        0.0001
                    );

                    return [
                        (int) $product->id =>
                            $factor,
                    ];
                }
            );

        $today = now()->toDateString();

        /*
         * Rows are locked and ordered by FEFO for the complete
         * atomic checkout transaction.
         */
        $batches = StockBatch::query()
            ->where('tenant_id', $tenantId)
            ->where('branch_id', $branchId)
            ->whereIn('product_id', $productIds)
            ->where('status', 'active')
            ->whereRaw(
                '(quantity_on_hand - quantity_reserved) > 0'
            )
            ->where(
                static function (
                    $query
                ) use ($today): void {
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
                'selling_price',
            ]);

        $pools = [];

        foreach ($batches as $batch) {
            $productId =
                (int) $batch->product_id;

            $pools[$productId][] = [
                'id' =>
                    (int) $batch->id,

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

                'selling_price' => round(
                    max(
                        (float) (
                            $batch->selling_price
                            ?? 0
                        ),
                        0
                    ),
                    2
                ),

                'quantity_per_selling_unit' =>
                    max(
                        (float) (
                            $productFactors[
                                $productId
                            ] ?? 1
                        ),
                        0.0001
                    ),

                'available_quantity' => round(
                    max(
                        (float) (
                            $batch->quantity_on_hand
                        )
                        - (float) (
                            $batch->quantity_reserved
                        ),
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

            $allocations =
                $this->allocateLine(
                    item: $item,
                    orderedBatches:
                        $pools[$productId] ?? [],
                    itemIndex: $itemIndex
                );

            /*
             * Prevent a second customer-facing line for the same
             * product from reusing quantities already allocated by
             * the previous line.
             */
            foreach ($allocations as $allocation) {
                $allocatedBatchId = (int) (
                    $allocation[
                        'stock_batch_id'
                    ] ?? 0
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

                    $pools[$productId][
                        $poolIndex
                    ]['available_quantity'] = round(
                        max(
                            (float) (
                                $pool[
                                    'available_quantity'
                                ]
                            )
                            - (float) (
                                $allocation[
                                    'quantity'
                                ]
                            ),
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

        /*
         * Determine every batch affected by the requested quantity
         * before creating individual allocation rows.
         */
        $pricing = $this->resolvePricing(
            item: $item,
            orderedBatches: $orderedBatches,
            requestedQuantity:
                $requestedQuantity
        );

        $authoritativeUnitPrice = (float) (
            $pricing[
                'authoritative_unit_price'
            ]
        );

        $authoritativeSellingUnitPrice =
            (float) (
                $pricing[
                    'authoritative_selling_unit_price'
                ]
            );

        $quantityFactor = (float) (
            $pricing[
                'quantity_per_selling_unit'
            ]
        );

        $originalUnitPrice = round(
            max(
                (float) (
                    $item['unit_price']
                    ?? $authoritativeUnitPrice
                ),
                0
            ),
            2
        );

        $originalSellingUnitPrice = round(
            max(
                (float) (
                    $item[
                        'original_selling_unit_price'
                    ]
                    ?? (
                        $originalUnitPrice
                        * $quantityFactor
                    )
                ),
                0
            ),
            2
        );

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
                        $batch[
                            'available_quantity'
                        ]
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

            $remainingAfterAllocation =
                round(
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

            $unitPriceDifference = round(
                $authoritativeUnitPrice
                - $originalUnitPrice,
                2
            );

            $sellingPriceDifference =
                round(
                    $authoritativeSellingUnitPrice
                    - $originalSellingUnitPrice,
                    2
                );

            /*
             * The same highest affected price is applied to every
             * internal batch allocation belonging to this customer
             * cart line.
             */
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

                'unit_price' =>
                    $authoritativeUnitPrice,

                'original_unit_price' =>
                    $originalUnitPrice,

                'used_unit_price' =>
                    $authoritativeUnitPrice,

                'unit_price_difference' =>
                    $unitPriceDifference,

                'price_override_applied' =>
                    abs(
                        $unitPriceDifference
                    ) > 0.0001,

                'original_selling_unit_price' =>
                    $originalSellingUnitPrice,

                'used_selling_unit_price' =>
                    $authoritativeSellingUnitPrice,

                'selling_unit_price_difference' =>
                    $sellingPriceDifference,

                'pricing_policy' =>
                    'highest_affected_batch_price',

                'pricing_affected_batch_ids' =>
                    $pricing[
                        'affected_batch_ids'
                    ],

                'pricing_affected_batch_prices' =>
                    $pricing[
                        'affected_batch_prices'
                    ],

                'authoritative_selling_unit_price' =>
                    $authoritativeSellingUnitPrice,

                'authoritative_unit_price' =>
                    $authoritativeUnitPrice,
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

    /**
     * @param array<string, mixed> $item
     * @param array<int, array<string, mixed>> $orderedBatches
     * @return array<string, mixed>
     */
    private function resolvePricing(
        array $item,
        array $orderedBatches,
        float $requestedQuantity
    ): array {
        $remaining =
            $requestedQuantity;

        $highestSellingPrice = 0.0;

        $affectedBatchIds = [];

        $affectedBatchPrices = [];

        $quantityFactor = max(
            (float) (
                $orderedBatches[0][
                    'quantity_per_selling_unit'
                ]
                ?? 1
            ),
            0.0001
        );

        foreach ($orderedBatches as $batch) {
            if (
                $remaining
                <= self::QUANTITY_EPSILON
            ) {
                break;
            }

            $available = round(
                max(
                    (float) (
                        $batch[
                            'available_quantity'
                        ]
                        ?? 0
                    ),
                    0
                ),
                self::QUANTITY_SCALE
            );

            if (
                $available
                <= self::QUANTITY_EPSILON
            ) {
                continue;
            }

            $affectedQuantity = round(
                min(
                    $available,
                    $remaining
                ),
                self::QUANTITY_SCALE
            );

            if (
                $affectedQuantity
                <= self::QUANTITY_EPSILON
            ) {
                continue;
            }

            $sellingPrice = round(
                max(
                    (float) (
                        $batch[
                            'selling_price'
                        ]
                        ?? 0
                    ),
                    0
                ),
                2
            );

            $highestSellingPrice = max(
                $highestSellingPrice,
                $sellingPrice
            );

            $affectedBatchIds[] =
                (int) $batch['id'];

            $affectedBatchPrices[] = [
                'batch_id' =>
                    (int) $batch['id'],

                'selling_price' =>
                    $sellingPrice,

                'allocated_quantity' =>
                    $affectedQuantity,
            ];

            $remaining = round(
                max(
                    $remaining
                    - $affectedQuantity,
                    0
                ),
                self::QUANTITY_SCALE
            );
        }

        /*
         * Retain a safe fallback for historical or incomplete batch
         * records where no selling price was saved.
         */
        $fallbackUnitPrice = round(
            max(
                (float) (
                    $item['unit_price']
                    ?? 0
                ),
                0
            ),
            2
        );

        if ($highestSellingPrice <= 0) {
            $highestSellingPrice = round(
                $fallbackUnitPrice
                * $quantityFactor,
                2
            );
        }

        return [
            'authoritative_selling_unit_price' =>
                $highestSellingPrice,

            'authoritative_unit_price' => round(
                $highestSellingPrice
                / $quantityFactor,
                2
            ),

            'quantity_per_selling_unit' =>
                $quantityFactor,

            'affected_batch_ids' =>
                array_values(
                    $affectedBatchIds
                ),

            'affected_batch_prices' =>
                array_values(
                    $affectedBatchPrices
                ),
        ];
    }
}
