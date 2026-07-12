<?php

namespace App\Services\Inventory;

use App\Models\StockBatch;
use App\Models\StockMovement;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

class InventoryExecutiveRiskService
{
    private const EXPIRY_WATCH_DAYS = 180;
    private const MOVEMENT_WINDOW_DAYS = 90;
    private const STOCKOUT_COVER_DAYS = 30;

    /**
     * Produce mutually exclusive financial risk buckets.
     *
     * Every positive-value batch is allocated to exactly one bucket:
     * expired/quarantined, near expiry, low stock, slow/excess, or healthy.
     */
    public function build(
        Collection $batches,
        int $tenantId
    ): array {
        $positiveBatches = $batches
            ->filter(
                fn (StockBatch $batch): bool =>
                    $this->quantity($batch) > 0
            )
            ->values();

        $productIds = $positiveBatches
            ->pluck('product_id')
            ->filter()
            ->unique()
            ->values();

        $outboundByProduct = $this->outboundMovementByProduct(
            $tenantId,
            $productIds
        );

        $risk = [
            'low_stock_value' => 0.0,
            'near_expiry_value' => 0.0,
            'expired_quarantined_value' => 0.0,
            'slow_overstock_value' => 0.0,
            'healthy_stock_value' => 0.0,
        ];

        foreach ($positiveBatches as $batch) {
            $value = $this->costValue($batch);
            $bucket = $this->riskBucket(
                $batch,
                (float) (
                    $outboundByProduct[
                        $batch->product_id
                    ] ?? 0
                )
            );

            $risk[$bucket] += $value;
        }

        $totalInventoryValue = array_sum($risk);

        $totalValueAtRisk =
            $risk['low_stock_value']
            + $risk['near_expiry_value']
            + $risk['expired_quarantined_value']
            + $risk['slow_overstock_value'];

        $riskPercent = $totalInventoryValue > 0
            ? ($totalValueAtRisk / $totalInventoryValue) * 100
            : 0.0;

        return [
            'risk_mix' => [
                'analysis_basis' =>
                    'cost_value_and_consumption_signals',
                'currency' => 'RWF',
                'expiry_watch_days' =>
                    self::EXPIRY_WATCH_DAYS,
                'movement_window_days' =>
                    self::MOVEMENT_WINDOW_DAYS,
                'total_inventory_value' =>
                    round($totalInventoryValue, 2),
                'low_stock_value' =>
                    round($risk['low_stock_value'], 2),
                'near_expiry_value' =>
                    round($risk['near_expiry_value'], 2),
                'expired_quarantined_value' =>
                    round(
                        $risk[
                            'expired_quarantined_value'
                        ],
                        2
                    ),
                'slow_overstock_value' =>
                    round(
                        $risk['slow_overstock_value'],
                        2
                    ),
                'healthy_stock_value' =>
                    round(
                        $risk['healthy_stock_value'],
                        2
                    ),
                'total_value_at_risk' =>
                    round($totalValueAtRisk, 2),
                'value_at_risk_percent' =>
                    round($riskPercent, 2),
                'executive_recommendation' =>
                    $this->riskRecommendation(
                        $risk,
                        $totalValueAtRisk
                    ),
            ],
            'general_stock' =>
                $this->generalStockAnalysis(
                    $positiveBatches,
                    $outboundByProduct
                ),
        ];
    }

    private function riskBucket(
        StockBatch $batch,
        float $recentOutboundQuantity
    ): string {
        if ($this->isExpiredOrQuarantined($batch)) {
            return 'expired_quarantined_value';
        }

        if ($this->isNearExpiry($batch)) {
            return 'near_expiry_value';
        }

        if ($this->isLowStock($batch)) {
            return 'low_stock_value';
        }

        if (
            $this->isSlowOrExcess(
                $batch,
                $recentOutboundQuantity
            )
        ) {
            return 'slow_overstock_value';
        }

        return 'healthy_stock_value';
    }

    private function isExpiredOrQuarantined(
        StockBatch $batch
    ): bool {
        $status = Str::lower(
            trim((string) $batch->status)
        );

        $restrictedStatuses = [
            'expired',
            'quarantined',
            'quarantine',
            'rejected',
            'blocked',
            'damaged',
            'recalled',
        ];

        if (in_array($status, $restrictedStatuses, true)) {
            return true;
        }

        return $batch->expiry_date
            && $batch->expiry_date->lt(
                now()->startOfDay()
            );
    }

    private function isNearExpiry(
        StockBatch $batch
    ): bool {
        if (! $batch->expiry_date) {
            return false;
        }

        $today = now()->startOfDay();

        return $batch->expiry_date->gte($today)
            && $batch->expiry_date->lte(
                $today
                    ->copy()
                    ->addDays(
                        self::EXPIRY_WATCH_DAYS
                    )
                    ->endOfDay()
            );
    }

    private function isLowStock(
        StockBatch $batch
    ): bool {
        $quantity = $this->quantity($batch);
        $reorderLevel = $this->reorderLevel($batch);

        return $quantity > 0
            && $reorderLevel > 0
            && $quantity <= $reorderLevel;
    }

    private function isSlowOrExcess(
        StockBatch $batch,
        float $recentOutboundQuantity
    ): bool {
        $quantity = $this->quantity($batch);
        $reorderLevel = $this->reorderLevel($batch);

        if ($quantity <= 0) {
            return false;
        }

        if ($recentOutboundQuantity <= 0) {
            return ! $batch->received_at
                || $batch->received_at->lte(
                    now()->subDays(
                        self::MOVEMENT_WINDOW_DAYS
                    )
                );
        }

        $dailyUsage = $recentOutboundQuantity
            / self::MOVEMENT_WINDOW_DAYS;

        $coverDays = $dailyUsage > 0
            ? $quantity / $dailyUsage
            : null;

        $excessThreshold = max(
            $reorderLevel * 3,
            $dailyUsage * 180
        );

        return (
            $coverDays !== null
            && $coverDays > 180
        ) || (
            $excessThreshold > 0
            && $quantity > $excessThreshold
        );
    }

    private function generalStockAnalysis(
        Collection $batches,
        Collection $outboundByProduct
    ): array {
        $productGroups = $batches
            ->filter(
                fn (StockBatch $batch): bool =>
                    $this->isGeneralStockProduct(
                        $batch
                    )
            )
            ->groupBy('product_id');

        $metrics = [
            'item_count' => $productGroups->count(),
            'total_value' => 0.0,
            'items_below_minimum' => 0,
            'zero_stock_items' => 0,
            'estimated_shortage_exposure_value' => 0.0,
            'slow_moving_value' => 0.0,
            'predicted_stockout_items' => 0,
            'recommended_reorder_value' => 0.0,
        ];

        $coverDays = [];

        foreach ($productGroups as $productBatches) {
            $firstBatch = $productBatches->first();

            if (! $firstBatch) {
                continue;
            }

            $quantity = $productBatches->sum(
                fn (StockBatch $batch): float =>
                    $this->quantity($batch)
            );

            $costValue = $productBatches->sum(
                fn (StockBatch $batch): float =>
                    $this->costValue($batch)
            );

            $retailValue = $productBatches->sum(
                fn (StockBatch $batch): float =>
                    $this->retailValue($batch)
            );

            $metrics['total_value'] += $costValue;

            $reorderLevel =
                $this->reorderLevel($firstBatch);

            $weightedUnitCost = $quantity > 0
                ? $costValue / $quantity
                : max(
                    0,
                    (float) (
                        $firstBatch->unit_cost ?? 0
                    )
                );

            $weightedRetailPrice = $quantity > 0
                ? $retailValue / $quantity
                : max(
                    $weightedUnitCost,
                    (float) (
                        $firstBatch->selling_price
                        ?? 0
                    )
                );

            $shortageQuantity = max(
                0,
                $reorderLevel - $quantity
            );

            if ($quantity <= 0) {
                $metrics['zero_stock_items']++;
            }

            if (
                $reorderLevel > 0
                && $quantity <= $reorderLevel
            ) {
                $metrics['items_below_minimum']++;
            }

            $metrics[
                'recommended_reorder_value'
            ] += $shortageQuantity
                * $weightedUnitCost;

            $metrics[
                'estimated_shortage_exposure_value'
            ] += $shortageQuantity
                * $weightedRetailPrice;

            $recentOutbound = (float) (
                $outboundByProduct[
                    $firstBatch->product_id
                ] ?? 0
            );

            $dailyUsage = $recentOutbound
                / self::MOVEMENT_WINDOW_DAYS;

            if ($dailyUsage > 0) {
                $productCoverDays =
                    $quantity / $dailyUsage;

                $coverDays[] = min(
                    999,
                    $productCoverDays
                );

                if (
                    $productCoverDays
                    <= self::STOCKOUT_COVER_DAYS
                ) {
                    $metrics[
                        'predicted_stockout_items'
                    ]++;
                }
            } elseif ($shortageQuantity > 0) {
                $metrics[
                    'predicted_stockout_items'
                ]++;
            }

            $allSlow = $productBatches->every(
                fn (StockBatch $batch): bool =>
                    $this->isSlowOrExcess(
                        $batch,
                        $recentOutbound
                    )
            );

            if ($quantity > 0 && $allSlow) {
                $metrics['slow_moving_value'] +=
                    $costValue;
            }
        }

        $averageCoverDays = $coverDays !== []
            ? array_sum($coverDays)
                / count($coverDays)
            : null;

        $itemCount = max(
            1,
            (int) $metrics['item_count']
        );

        $belowMinimumRatio =
            $metrics['items_below_minimum']
            / $itemCount;

        $zeroStockRatio =
            $metrics['zero_stock_items']
            / $itemCount;

        $slowValueRatio =
            $metrics['total_value'] > 0
                ? $metrics['slow_moving_value']
                    / $metrics['total_value']
                : 0;

        $healthScore = max(
            0,
            min(
                100,
                100
                - ($belowMinimumRatio * 40)
                - ($zeroStockRatio * 30)
                - ($slowValueRatio * 30)
            )
        );

        return [
            'analysis_basis' =>
                'rules_and_90_day_consumption_signals',
            'currency' => 'RWF',
            'item_count' =>
                (int) $metrics['item_count'],
            'total_value' =>
                round($metrics['total_value'], 2),
            'items_below_minimum' =>
                (int) $metrics[
                    'items_below_minimum'
                ],
            'zero_stock_items' =>
                (int) $metrics['zero_stock_items'],
            'estimated_shortage_exposure_value' =>
                round(
                    $metrics[
                        'estimated_shortage_exposure_value'
                    ],
                    2
                ),
            'slow_moving_value' =>
                round(
                    $metrics['slow_moving_value'],
                    2
                ),
            'average_stock_cover_days' =>
                $averageCoverDays === null
                    ? null
                    : round($averageCoverDays, 1),
            'predicted_stockout_items' =>
                (int) $metrics[
                    'predicted_stockout_items'
                ],
            'recommended_reorder_value' =>
                round(
                    $metrics[
                        'recommended_reorder_value'
                    ],
                    2
                ),
            'ai_health_score' =>
                round($healthScore, 1),
            'ai_recommendation' =>
                $this->generalStockRecommendation(
                    $metrics
                ),
        ];
    }

    private function isGeneralStockProduct(
        StockBatch $batch
    ): bool {
        $product = $batch->product;

        if (! $product) {
            return false;
        }

        $type = Str::lower(
            trim(
                (string) data_get(
                    $product,
                    'product_type',
                    ''
                )
            )
        );

        $categoryName = Str::lower(
            trim(
                (string) data_get(
                    $product,
                    'category.name',
                    ''
                )
            )
        );

        $categoryCode = Str::lower(
            trim(
                (string) data_get(
                    $product,
                    'category.code',
                    ''
                )
            )
        );

        $generalTypes = [
            'general',
            'general_stock',
            'general-item',
            'consumable',
            'device',
            'medical_device',
            'supply',
            'supplies',
            'non_pharmaceutical',
            'non-pharmaceutical',
            'equipment',
        ];

        if (in_array($type, $generalTypes, true)) {
            return true;
        }

        if (
            in_array(
                $type,
                [
                    'medicine',
                    'drug',
                    'pharmaceutical',
                    'prescription',
                    'otc',
                ],
                true
            )
        ) {
            return false;
        }

        $classificationText =
            $categoryName . ' ' . $categoryCode;

        return (bool) preg_match(
            '/general|consumable|device|supply|'
            . 'equipment|stationery|cleaning|'
            . 'packaging|office|non.?pharma/i',
            $classificationText
        );
    }

    private function outboundMovementByProduct(
        int $tenantId,
        Collection $productIds
    ): Collection {
        if ($productIds->isEmpty()) {
            return collect();
        }

        return StockMovement::query()
            ->where('tenant_id', $tenantId)
            ->whereIn('product_id', $productIds)
            ->where(
                'occurred_at',
                '>=',
                now()->subDays(
                    self::MOVEMENT_WINDOW_DAYS
                )
            )
            ->get([
                'product_id',
                'movement_type',
                'quantity',
            ])
            ->filter(
                fn (StockMovement $movement): bool =>
                    $this->isOutboundMovement(
                        $movement
                    )
            )
            ->groupBy('product_id')
            ->map(
                fn (Collection $movements): float =>
                    $movements->sum(
                        fn (
                            StockMovement $movement
                        ): float =>
                            abs(
                                (float)
                                $movement->quantity
                            )
                    )
            );
    }

    private function isOutboundMovement(
        StockMovement $movement
    ): bool {
        if ((float) $movement->quantity < 0) {
            return true;
        }

        return in_array(
            Str::lower(
                trim(
                    (string)
                    $movement->movement_type
                )
            ),
            [
                'sale',
                'dispense',
                'issue',
                'transfer_out',
                'adjustment_out',
                'return_to_supplier',
                'wastage',
            ],
            true
        );
    }

    private function quantity(
        StockBatch $batch
    ): float {
        return max(
            0,
            (float) $batch->quantity_on_hand
        );
    }

    private function costValue(
        StockBatch $batch
    ): float {
        return $this->quantity($batch)
            * max(
                0,
                (float) ($batch->unit_cost ?? 0)
            );
    }

    private function retailValue(
        StockBatch $batch
    ): float {
        return $this->quantity($batch)
            * max(
                0,
                (float) (
                    $batch->selling_price
                    ?? $batch->unit_cost
                    ?? 0
                )
            );
    }

    private function reorderLevel(
        StockBatch $batch
    ): float {
        $product = $batch->product;

        $candidate = data_get(
            $product,
            'reorder_level',
            data_get(
                $product,
                'minimum_stock_level',
                data_get(
                    $product,
                    'metadata.reorder_level',
                    10
                )
            )
        );

        return max(0, (float) $candidate);
    }

    private function riskRecommendation(
        array $risk,
        float $totalValueAtRisk
    ): string {
        if ($totalValueAtRisk <= 0) {
            return 'Inventory value is currently concentrated in healthy stock. Continue FEFO, reorder, and stock-movement monitoring.';
        }

        $labels = [
            'expired_quarantined_value' =>
                'expired or quarantined stock',
            'near_expiry_value' =>
                'near-expiry stock',
            'low_stock_value' =>
                'low-stock exposure',
            'slow_overstock_value' =>
                'slow-moving or excess stock',
        ];

        $riskOnly = array_intersect_key(
            $risk,
            $labels
        );

        arsort($riskOnly);

        $largestKey = array_key_first($riskOnly);
        $largestLabel = $labels[$largestKey]
            ?? 'the largest risk category';

        return sprintf(
            'Prioritise %s. It currently represents the largest inventory value-at-risk category.',
            $largestLabel
        );
    }

    private function generalStockRecommendation(
        array $metrics
    ): string {
        if ((int) $metrics['item_count'] === 0) {
            return 'No general stock items are currently classified. Confirm product types or categories for consumables, devices, supplies, and equipment.';
        }

        if (
            (int) $metrics[
                'predicted_stockout_items'
            ] > 0
        ) {
            return sprintf(
                'Review %d general stock item(s) with predicted stock-out exposure and prepare an approved replenishment plan.',
                $metrics[
                    'predicted_stockout_items'
                ]
            );
        }

        if (
            (float) $metrics[
                'slow_moving_value'
            ] > 0
        ) {
            return 'Review slow-moving general stock before the next purchase cycle. Consider branch transfer, controlled consumption, or lower reorder quantities.';
        }

        return 'General stock is currently balanced. Continue monitoring consumption velocity, minimum levels, and reorder timing.';
    }
}
