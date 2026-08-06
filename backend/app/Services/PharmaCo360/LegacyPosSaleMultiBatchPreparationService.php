<?php

declare(strict_types=1);

namespace App\Services\PharmaCo360;

use App\Models\PharmacoSale;
use App\Models\StockBatch;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

final class LegacyPosSaleMultiBatchPreparationService
{
    private const QUANTITY_EPSILON = 0.0005;

    /**
     * @param array<int, array<string, mixed>> $submittedItems
     * @return array<int, array<string, mixed>>
     */
    public function prepare(
        PharmacoSale $sale,
        array $submittedItems
    ): array {
        $sale->loadMissing(['items.product']);

        $submittedByItemId = collect($submittedItems)
            ->keyBy(
                static fn (array $item): int =>
                    (int) ($item['sale_item_id'] ?? 0)
            );

        if (! $this->requiresPreparation(
            $sale,
            $submittedByItemId->all()
        )) {
            return $submittedItems;
        }

        $confirmationItems = [];

        foreach ($sale->items as $item) {
            $submitted = $submittedByItemId->get(
                (int) $item->id
            );

            if (! is_array($submitted)) {
                continue;
            }

            $allocations = app(
                PosMultiBatchCheckoutAllocator::class
            )->expandAndLock(
                tenantId: (int) $sale->tenant_id,
                branchId: (int) $sale->branch_id,
                items: [
                    [
                        'product_id' =>
                            (int) $item->product_id,

                        'quantity' =>
                            (float) $item->quantity,

                        'unit_price' =>
                            (float) $item->unit_price,

                        'discount_amount' =>
                            (float) $item->discount_amount,

                        'tax_amount' =>
                            (float) $item->tax_amount,

                        'stock_batch_id' =>
                            (int) (
                                $submitted['stock_batch_id']
                                ?? 0
                            ),

                        'prescription_verified' =>
                            (bool) (
                                $submitted[
                                    'prescription_verified'
                                ]
                                ?? $item->prescription_verified
                            ),
                    ],
                ]
            );

            if ($allocations === []) {
                throw ValidationException::withMessages([
                    'items' => [
                        "No eligible FEFO stock could be "
                        . "allocated for sale item {$item->id}.",
                    ],
                ]);
            }

            foreach (
                $allocations
                as $allocationIndex => $allocation
            ) {
                $targetItem = $allocationIndex === 0
                    ? $item
                    : $item->replicate([
                        'id',
                        'uuid',
                        'created_at',
                        'updated_at',
                    ]);

                if ($allocationIndex > 0) {
                    $targetItem->uuid =
                        (string) Str::uuid();
                }

                $quantity = round(
                    (float) (
                        $allocation['quantity']
                        ?? 0
                    ),
                    3
                );

                $unitPrice = round(
                    (float) (
                        $allocation['unit_price']
                        ?? $item->unit_price
                    ),
                    2
                );

                $discount = round(
                    (float) (
                        $allocation['discount_amount']
                        ?? 0
                    ),
                    2
                );

                $tax = round(
                    (float) (
                        $allocation['tax_amount']
                        ?? 0
                    ),
                    2
                );

                $lineTotal = round(
                    ($quantity * $unitPrice)
                    - $discount
                    + $tax,
                    2
                );

                $metadata = is_array(
                    $targetItem->metadata
                )
                    ? $targetItem->metadata
                    : [];

                $metadata[
                    'legacy_multibatch_confirmation'
                ] = true;

                $metadata[
                    'original_sale_item_id'
                ] = (int) $item->id;

                $metadata[
                    'allocation_batch_id'
                ] = (int) (
                    $allocation['stock_batch_id']
                    ?? 0
                );

                $targetItem->forceFill([
                    'quantity' => $quantity,
                    'unit_price' => $unitPrice,
                    'discount_amount' => $discount,
                    'tax_amount' => $tax,
                    'line_total' => $lineTotal,
                    'stock_batch_id' => null,
                    'stock_location_id' => null,
                    'status' => 'pending',
                    'prescription_verified' =>
                        (bool) (
                            $submitted[
                                'prescription_verified'
                            ]
                            ?? $item->prescription_verified
                        ),
                    'metadata' => $metadata,
                ])->save();

                $confirmationItems[] = [
                    'sale_item_id' =>
                        (int) $targetItem->id,

                    'stock_batch_id' =>
                        (int) (
                            $allocation['stock_batch_id']
                            ?? 0
                        ),

                    'prescription_verified' =>
                        (bool) (
                            $submitted[
                                'prescription_verified'
                            ]
                            ?? $item->prescription_verified
                        ),
                ];
            }
        }

        $this->refreshSaleTotals($sale);

        return $confirmationItems;
    }

    /**
     * @param array<int, array<string, mixed>> $submittedByItemId
     */
    private function requiresPreparation(
        PharmacoSale $sale,
        array $submittedByItemId
    ): bool {
        foreach ($sale->items as $item) {
            $submitted = $submittedByItemId[
                (int) $item->id
            ] ?? null;

            if (! is_array($submitted)) {
                continue;
            }

            $batchId = (int) (
                $submitted['stock_batch_id']
                ?? 0
            );

            if ($batchId <= 0) {
                continue;
            }

            $batch = StockBatch::query()
                ->where(
                    'tenant_id',
                    (int) $sale->tenant_id
                )
                ->where(
                    'branch_id',
                    (int) $sale->branch_id
                )
                ->where(
                    'product_id',
                    (int) $item->product_id
                )
                ->find($batchId);

            if (! $batch) {
                continue;
            }

            $available = max(
                (float) $batch->quantity_on_hand
                - (float) $batch->quantity_reserved,
                0
            );

            if (
                (float) $item->quantity
                > $available
                + self::QUANTITY_EPSILON
            ) {
                return true;
            }
        }

        return false;
    }

    private function refreshSaleTotals(
        PharmacoSale $sale
    ): void {
        $sale->unsetRelation('items');
        $sale->load('items');

        $subtotal = round(
            (float) $sale->items->sum(
                static fn ($item): float =>
                    (float) $item->quantity
                    * (float) $item->unit_price
            ),
            2
        );

        $discount = round(
            (float) $sale->items->sum(
                'discount_amount'
            ),
            2
        );

        $tax = round(
            (float) $sale->items->sum(
                'tax_amount'
            ),
            2
        );

        $total = round(
            (float) $sale->items->sum(
                'line_total'
            ),
            2
        );

        $paid = round(
            (float) $sale->paid_amount,
            2
        );

        $sale->forceFill([
            'subtotal_amount' => $subtotal,
            'discount_amount' => $discount,
            'tax_amount' => $tax,
            'total_amount' => $total,
            'balance_amount' => round(
                max($total - $paid, 0),
                2
            ),
        ])->save();
    }
}
