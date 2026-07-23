<?php

namespace App\Services\PharmaCo360;

class InventoryCostResolver
{
    public const SOURCE_ACTUAL = 'actual';
    public const SOURCE_LEGACY_EQUAL_PRICE_COST = 'legacy_equal_price_cost';
    public const SOURCE_INFERRED_FROM_PRICE = 'inferred_from_price';
    public const SOURCE_MISSING = 'missing';

    public function resolve(
        mixed $unitCost,
        mixed $sellingPrice,
        ?string $costSource = null,
        mixed $inferredUnitCost = null,
        float $markupFactor = 1.4,
    ): array {
        $unitCost = $this->number($unitCost);
        $sellingPrice = $this->number($sellingPrice);
        $inferredUnitCost = $this->number($inferredUnitCost);

        if ($markupFactor <= 0) {
            $markupFactor = 1.4;
        }

        if (
            $costSource === self::SOURCE_LEGACY_EQUAL_PRICE_COST
            || $costSource === self::SOURCE_INFERRED_FROM_PRICE
        ) {
            $resolvedCost = $inferredUnitCost > 0
                ? $inferredUnitCost
                : ($sellingPrice > 0 ? $sellingPrice / $markupFactor : 0);

            return $this->payload(
                $resolvedCost,
                $sellingPrice,
                $costSource,
                'price_divided_by_1_4',
            );
        }

        if ($unitCost > 0) {
            return $this->payload(
                $unitCost,
                $sellingPrice,
                self::SOURCE_ACTUAL,
                'none',
            );
        }

        if ($sellingPrice > 0) {
            return $this->payload(
                $sellingPrice / $markupFactor,
                $sellingPrice,
                self::SOURCE_INFERRED_FROM_PRICE,
                'price_divided_by_1_4',
            );
        }

        return $this->payload(
            0,
            $sellingPrice,
            self::SOURCE_MISSING,
            'needs_review',
        );
    }

    public static function resolvedUnitCostSql(string $tableAlias = 'stock_batches'): string
    {
        $prefix = trim($tableAlias) !== '' ? "{$tableAlias}." : '';

        return "CASE
            WHEN {$prefix}cost_source IN ('legacy_equal_price_cost', 'inferred_from_price')
                AND COALESCE({$prefix}inferred_unit_cost, 0) > 0
                THEN COALESCE({$prefix}inferred_unit_cost, 0)
            WHEN COALESCE({$prefix}unit_cost, 0) > 0
                THEN COALESCE({$prefix}unit_cost, 0)
            WHEN COALESCE({$prefix}selling_price, 0) > 0
                THEN COALESCE({$prefix}selling_price, 0) / 1.4
            ELSE 0
        END";
    }

    public static function marginSql(string $tableAlias = 'stock_batches'): string
    {
        $prefix = trim($tableAlias) !== '' ? "{$tableAlias}." : '';

        return "(COALESCE({$prefix}selling_price, 0) - ".self::resolvedUnitCostSql($tableAlias).")";
    }

    private function payload(
        float $resolvedUnitCost,
        float $sellingPrice,
        string $costSource,
        string $method,
    ): array {
        return [
            'resolved_unit_cost' => round($resolvedUnitCost, 4),
            'selling_price' => round($sellingPrice, 4),
            'margin_per_unit' => round($sellingPrice - $resolvedUnitCost, 4),
            'margin_rate' => $sellingPrice > 0
                ? round((($sellingPrice - $resolvedUnitCost) / $sellingPrice) * 100, 2)
                : 0,
            'cost_source' => $costSource,
            'cost_adjustment_method' => $method,
        ];
    }

    private function number(mixed $value): float
    {
        if (is_numeric($value)) {
            return (float) $value;
        }

        $parsed = (float) preg_replace('/[^0-9.\-]/', '', (string) $value);

        return is_finite($parsed) ? $parsed : 0.0;
    }
}
