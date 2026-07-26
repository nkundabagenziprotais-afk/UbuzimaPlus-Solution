<?php

namespace App\Services\Finance;

use App\Data\Finance\FinanceJournalLinePayload;
use App\Data\Finance\FinancePostingPayload;
use App\Models\FinanceJournalEntry;
use App\Models\FinancePostingLog;
use App\Models\PharmacoSale;
use App\Models\PharmacoSaleItem;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;
use Throwable;

class PharmacoPosSaleAuthoritativePostingService
{
    public function __construct(
        private readonly FinancePostingService $postingService,
        private readonly FinanceInventoryCostSnapshotResolver $costResolver,
    ) {
    }

    public function postSale(
        PharmacoSale $sale,
        string $mode = 'authoritative',
    ): FinanceJournalEntry|FinancePostingLog {
        if (! in_array($mode, ['dual', 'authoritative'], true)) {
            throw new InvalidArgumentException(
                'Authoritative sale posting mode must be dual or authoritative.'
            );
        }

        $sale->loadMissing([
            'items.stockBatch',
        ]);

        $idempotencyKey =
            "pos-sale-authoritative-{$sale->id}";

        $basePayload = fn (
            array $lines = [],
            array $sourceSnapshot = [],
            array $metadata = [],
        ): FinancePostingPayload => new FinancePostingPayload(
            tenantId: (int) $sale->tenant_id,
            branchId: $sale->branch_id,
            businessDate:
                $sale->business_date?->toDateString(),
            sourceModule: 'pos',
            sourceType: 'sale',
            sourceId: (string) $sale->id,
            idempotencyKey: $idempotencyKey,
            lines: $lines,
            currencyCode: 'RWF',
            memo:
                "Authoritative POS sale {$sale->sale_number}",
            createdBy:
                $sale->sold_by
                ?: $sale->created_by,
            sourceSnapshot: $sourceSnapshot,
            metadata: array_merge(
                [
                    'authoritative_posting' => true,
                    'posting_adapter' => self::class,
                    'posting_mode' => $mode,
                ],
                $metadata,
            ),
            mode: $mode,
        );

        $allowedStatuses = (array) config(
            'finance.authoritative_sale_statuses',
            ['dispensed', 'completed']
        );

        if (! in_array($sale->status, $allowedStatuses, true)) {
            return $this->postingService->quarantineExternal(
                $basePayload(),
                'sale_not_finalised',
                "Sale {$sale->id} is not in an authoritative posting status."
            );
        }

        $totalAmount = round(
            (float) $sale->total_amount,
            4
        );

        $taxAmount = round(
            (float) $sale->tax_amount,
            4
        );

        $revenueAmount = round(
            $totalAmount - $taxAmount,
            4
        );

        if ($totalAmount <= 0 || $revenueAmount < 0) {
            return $this->postingService->quarantineExternal(
                $basePayload(),
                'invalid_sale_totals',
                "Sale {$sale->id} has invalid accounting totals."
            );
        }

        $eligibleItems = $sale->items
            ->filter(
                fn (PharmacoSaleItem $item): bool =>
                    (float) $item->quantity > 0
                    && ! in_array(
                        $item->status,
                        [
                            'cancelled',
                            'voided',
                            'returned',
                        ],
                        true
                    )
            )
            ->values();

        if ($eligibleItems->isEmpty()) {
            return $this->postingService->quarantineExternal(
                $basePayload(),
                'missing_sale_items',
                "Sale {$sale->id} has no eligible sale items."
            );
        }

        $itemSnapshots = [];
        $costLines = [];
        $totalCost = 0.0;

        try {
            foreach ($eligibleItems as $item) {
                $snapshot =
                    $this->costResolver->resolveSaleItem(
                        $item
                    );

                $itemSnapshots[$item->id] = $snapshot;

                $totalCost = round(
                    $totalCost
                    + (float) $snapshot['total_cost'],
                    4
                );

                $lineMetadata = [
                    'pharmaco_sale_id' => $sale->id,
                    'pharmaco_sale_item_id' => $item->id,
                    'stock_batch_id' => $item->stock_batch_id,
                    'quantity' => (float) $item->quantity,
                    'cost_source' => $snapshot['source'],
                    'cost_snapshot_at' =>
                        $snapshot['snapshot_at'],
                ];

                $costLines[] =
                    new FinanceJournalLinePayload(
                        mappingKey: 'inventory.cogs',
                        debit: $snapshot['total_cost'],
                        description:
                            "COGS for {$item->product_name_snapshot}",
                        lineType: 'cogs',
                        branchId: $sale->branch_id,
                        customerId:
                            $sale->pharmaco_customer_id,
                        productId: $item->product_id,
                        stockLocationId:
                            $item->stock_location_id,
                        metadata: $lineMetadata,
                    );

                $costLines[] =
                    new FinanceJournalLinePayload(
                        mappingKey: 'inventory.asset',
                        credit: $snapshot['total_cost'],
                        description:
                            "Inventory reduction for {$item->product_name_snapshot}",
                        lineType: 'inventory_asset',
                        branchId: $sale->branch_id,
                        customerId:
                            $sale->pharmaco_customer_id,
                        productId: $item->product_id,
                        stockLocationId:
                            $item->stock_location_id,
                        metadata: $lineMetadata,
                    );
            }
        } catch (Throwable $exception) {
            return $this->postingService->quarantineExternal(
                $basePayload(
                    sourceSnapshot: [
                        'sale_id' => $sale->id,
                        'sale_number' => $sale->sale_number,
                    ],
                    metadata: [
                        'cost_resolution_error' =>
                            $exception->getMessage(),
                    ],
                ),
                'missing_cost_snapshot',
                $exception->getMessage(),
            );
        }

        $lines = [
            new FinanceJournalLinePayload(
                mappingKey: 'pos.credit',
                debit: $totalAmount,
                description:
                    "Trade receivable for sale {$sale->sale_number}",
                lineType: 'accounts_receivable',
                branchId: $sale->branch_id,
                customerId:
                    $sale->pharmaco_customer_id,
                metadata: [
                    'pharmaco_sale_id' => $sale->id,
                    'control_account_role' =>
                        'trade_receivable',
                ],
            ),
        ];

        if ($revenueAmount > 0) {
            $lines[] = new FinanceJournalLinePayload(
                mappingKey: 'sales.revenue',
                credit: $revenueAmount,
                description:
                    "Revenue for sale {$sale->sale_number}",
                lineType: 'revenue',
                branchId: $sale->branch_id,
                customerId:
                    $sale->pharmaco_customer_id,
                metadata: [
                    'pharmaco_sale_id' => $sale->id,
                ],
            );
        }

        if ($taxAmount > 0) {
            $lines[] = new FinanceJournalLinePayload(
                mappingKey: 'sales.tax',
                credit: $taxAmount,
                description:
                    "Output tax for sale {$sale->sale_number}",
                lineType: 'tax',
                branchId: $sale->branch_id,
                customerId:
                    $sale->pharmaco_customer_id,
                metadata: [
                    'pharmaco_sale_id' => $sale->id,
                ],
            );
        }

        $lines = array_merge(
            $lines,
            $costLines,
        );

        $sourceItems = $eligibleItems
            ->map(
                function (
                    PharmacoSaleItem $item,
                ) use ($itemSnapshots): array {
                    $snapshot =
                        $itemSnapshots[$item->id];

                    return [
                        'id' => $item->id,
                        'product_id' => $item->product_id,
                        'stock_batch_id' =>
                            $item->stock_batch_id,
                        'stock_location_id' =>
                            $item->stock_location_id,
                        'quantity' =>
                            (float) $item->quantity,
                        'unit_price' =>
                            (float) $item->unit_price,
                        'line_total' =>
                            (float) $item->line_total,
                        'cost_unit_snapshot' =>
                            $snapshot['unit_cost'],
                        'cost_total_snapshot' =>
                            $snapshot['total_cost'],
                        'cost_source_snapshot' =>
                            $snapshot['source'],
                    ];
                }
            )
            ->values()
            ->all();

        $payload = $basePayload(
            lines: $lines,
            sourceSnapshot: [
                'sale' => [
                    'id' => $sale->id,
                    'sale_number' => $sale->sale_number,
                    'business_date' =>
                        $sale->business_date?->toDateString(),
                    'status' => $sale->status,
                    'subtotal_amount' =>
                        (float) $sale->subtotal_amount,
                    'discount_amount' =>
                        (float) $sale->discount_amount,
                    'tax_amount' =>
                        (float) $sale->tax_amount,
                    'total_amount' =>
                        (float) $sale->total_amount,
                    'payment_status' =>
                        $sale->payment_status,
                ],
                'items' => $sourceItems,
            ],
            metadata: [
                'revenue_amount' => $revenueAmount,
                'tax_amount' => $taxAmount,
                'total_cost' => $totalCost,
                'costing_policy' =>
                    'immutable_batch_cost_snapshot',
            ],
        );

        return DB::transaction(
            function () use (
                $payload,
                $eligibleItems,
                $itemSnapshots,
            ): FinanceJournalEntry|FinancePostingLog {
                $result =
                    $this->postingService->post(
                        $payload
                    );

                if (! $result instanceof FinanceJournalEntry) {
                    return $result;
                }

                foreach ($eligibleItems as $item) {
                    $snapshot =
                        $itemSnapshots[$item->id];

                    if (
                        $item->cost_unit_snapshot !== null
                        && $item->cost_total_snapshot !== null
                    ) {
                        continue;
                    }

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
                }

                return $result;
            }
        );
    }
}
