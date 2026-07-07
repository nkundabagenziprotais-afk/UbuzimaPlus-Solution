<?php

namespace App\Services\PharmaCo360;

use App\Models\Product;

class ProductSellingUnitSuggestionService
{
    /**
     * Produce a reviewable selling-unit conversion suggestion.
     *
     * This service never applies the proposed value to POS configuration.
     * Approval is handled separately by an authorized user.
     */
    public function suggest(Product $product): array
    {
        $metadata = is_array($product->metadata) ? $product->metadata : [];

        $sellingUnit = $this->normalizeUnit(
            $product->selling_unit
                ?: ($metadata['rhia_selling_unit'] ?? null)
                ?: $product->unit
                ?: 'unit'
        );

        $baseUnit = $this->normalizeUnit(
            $product->base_unit
                ?: ($metadata['rhia_base_unit'] ?? null)
                ?: $product->unit
                ?: 'unit'
        );

        if ($sellingUnit === $baseUnit) {
            return [
                'proposed_value' => 1.0,
                'confidence' => 98.0,
                'explanation' => sprintf(
                    'The selling unit and base unit are both "%s", so one selling unit equals one base unit.',
                    $sellingUnit
                ),
                'source' => 'Product Master unit configuration',
                'reference' => 'Product selling_unit and base_unit fields',
            ];
        }

        $metadataValue = $this->firstPositiveNumericValue($metadata, [
            'rhia_quantity_per_selling_unit',
            'quantity_per_selling_unit',
            'pack_quantity',
            'pack_size_quantity',
            'base_units_per_selling_unit',
        ]);

        if ($metadataValue !== null) {
            return [
                'proposed_value' => $metadataValue,
                'confidence' => 95.0,
                'explanation' => sprintf(
                    'The proposed conversion was identified from structured RHIA or Product Master metadata for %s to %s.',
                    $sellingUnit,
                    $baseUnit
                ),
                'source' => $this->firstMetadataText($metadata, [
                    'rhia_source',
                    'trusted_source',
                    'source',
                ]) ?? 'RHIA/Product Master structured metadata',
                'reference' => $this->firstMetadataText($metadata, [
                    'rhia_reference',
                    'trusted_reference',
                    'source_reference',
                ]) ?? 'Tenant-supplied RHIA/Product Master metadata',
            ];
        }

        $packSizeValue = $this->extractQuantityForUnit(
            (string) ($product->pack_size ?? ''),
            $baseUnit
        );

        if ($packSizeValue !== null) {
            return [
                'proposed_value' => $packSizeValue,
                'confidence' => 88.0,
                'explanation' => sprintf(
                    'The pack-size description indicates that one %s contains %s %s.',
                    $sellingUnit,
                    $this->formatNumber($packSizeValue),
                    $baseUnit
                ),
                'source' => 'Product Master pack-size information',
                'reference' => trim((string) $product->pack_size),
            ];
        }

        $combinedText = implode(' ', array_filter([
            $product->name,
            $product->generic_name,
            $product->brand_name,
            $metadata['rhia_designation'] ?? null,
            $metadata['designation'] ?? null,
            $metadata['rhia_instructions'] ?? null,
            $metadata['instructions'] ?? null,
        ], fn ($value) => is_string($value) && trim($value) !== ''));

        $designationValue = $this->extractQuantityForUnit(
            $combinedText,
            $baseUnit
        );

        if ($designationValue !== null) {
            return [
                'proposed_value' => $designationValue,
                'confidence' => 78.0,
                'explanation' => sprintf(
                    'The product designation or instructions indicate that one %s contains %s %s.',
                    $sellingUnit,
                    $this->formatNumber($designationValue),
                    $baseUnit
                ),
                'source' => 'RHIA designation and Product Master instructions',
                'reference' => mb_substr(trim($combinedText), 0, 500),
            ];
        }

        return [
            'proposed_value' => 1.0,
            'confidence' => 45.0,
            'explanation' => sprintf(
                'No reliable pack conversion was found. A conservative value of 1 %s per %s is proposed for human review.',
                $baseUnit,
                $sellingUnit
            ),
            'source' => 'Conservative Product Master fallback',
            'reference' => 'No structured RHIA conversion or matching pack-size quantity was available',
        ];
    }

    private function firstPositiveNumericValue(array $metadata, array $keys): ?float
    {
        foreach ($keys as $key) {
            if (! array_key_exists($key, $metadata)) {
                continue;
            }

            $value = filter_var(
                $metadata[$key],
                FILTER_VALIDATE_FLOAT
            );

            if ($value !== false && (float) $value > 0) {
                return round((float) $value, 4);
            }
        }

        return null;
    }

    private function firstMetadataText(array $metadata, array $keys): ?string
    {
        foreach ($keys as $key) {
            $value = $metadata[$key] ?? null;

            if (is_string($value) && trim($value) !== '') {
                return trim($value);
            }
        }

        return null;
    }

    private function extractQuantityForUnit(string $text, string $baseUnit): ?float
    {
        $text = trim($text);

        if ($text === '') {
            return null;
        }

        $aliases = $this->unitAliases($baseUnit);

        foreach ($aliases as $alias) {
            $pattern = '/(?<![\d.])(\d+(?:\.\d+)?)\s*'
                . preg_quote($alias, '/')
                . '\b/iu';

            if (
                preg_match($pattern, $text, $matches) === 1
                && isset($matches[1])
                && (float) $matches[1] > 0
            ) {
                return round((float) $matches[1], 4);
            }
        }

        return null;
    }

    private function unitAliases(string $unit): array
    {
        $normalized = $this->normalizeUnit($unit);

        $aliases = [
            'tablet' => ['tablets', 'tablet', 'tabs', 'tab'],
            'capsule' => ['capsules', 'capsule', 'caps', 'cap'],
            'pill' => ['pills', 'pill'],
            'ml' => ['millilitres', 'milliliters', 'millilitre', 'milliliter', 'ml'],
            'l' => ['litres', 'liters', 'litre', 'liter', 'l'],
            'mg' => ['milligrams', 'milligram', 'mg'],
            'g' => ['grams', 'gram', 'g'],
            'mcg' => ['micrograms', 'microgram', 'mcg', 'µg'],
            'dose' => ['doses', 'dose'],
            'vial' => ['vials', 'vial'],
            'ampoule' => ['ampoules', 'ampoule', 'ampules', 'ampule'],
            'sachet' => ['sachets', 'sachet'],
            'strip' => ['strips', 'strip'],
            'piece' => ['pieces', 'piece', 'pcs', 'pc'],
            'unit' => ['units', 'unit'],
        ];

        return array_values(array_unique([
            ...($aliases[$normalized] ?? []),
            $normalized,
            rtrim($normalized, 's'),
            $normalized . 's',
        ]));
    }

    private function normalizeUnit(?string $unit): string
    {
        $normalized = mb_strtolower(trim((string) $unit));

        return match ($normalized) {
            'millilitre', 'millilitres', 'milliliter', 'milliliters' => 'ml',
            'litre', 'litres', 'liter', 'liters' => 'l',
            'tablets', 'tab', 'tabs' => 'tablet',
            'capsules', 'cap', 'caps' => 'capsule',
            'pills' => 'pill',
            'pieces', 'pcs', 'pc' => 'piece',
            'units' => 'unit',
            default => rtrim($normalized ?: 'unit', 's'),
        };
    }

    private function formatNumber(float $value): string
    {
        return rtrim(rtrim(number_format($value, 4, '.', ''), '0'), '.');
    }
}
