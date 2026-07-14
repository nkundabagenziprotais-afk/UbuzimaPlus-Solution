<?php

declare(strict_types=1);

namespace App\Services\Inventory;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

final class ProductMasterCorrectionService
{
    public const ORIGINAL_GENERIC =
        'Delivery System for Inhaled medication';

    /**
     * @var array<int, array{
     *     sku: string,
     *     expected_name: string,
     *     corrected_generic: string
     * }>
     */
    private const CORRECTIONS = [
        [
            'sku' => '42271802FDM011',
            'expected_name' =>
                'AERO CHAMBER WITH MASK CHILD 1-5YEARS 1PCE',
            'corrected_generic' =>
                'Valved holding chamber with child mask, ages 1-5 years',
        ],
        [
            'sku' => '42271802FDM012',
            'expected_name' =>
                'AERO CHAMBER WITH MASK CHILD 5YEARS 1PC',
            'corrected_generic' =>
                'Valved holding chamber with child mask, age 5 years',
        ],
        [
            'sku' => '42271802FDM004',
            'expected_name' =>
                'AERO CHAMBER WITH MASK INFANT 0-18 MONTHS 1PCE',
            'corrected_generic' =>
                'Valved holding chamber with infant mask, ages 0-18 months',
        ],
        [
            'sku' => '42271802FDM005',
            'expected_name' =>
                'AEROCHAMBER PLUS FLOW-VU 0-18M SMALL MASK 1KIT',
            'corrected_generic' =>
                'Valved holding chamber with small infant mask, ages 0-18 months',
        ],
        [
            'sku' => '42271802FDM006',
            'expected_name' =>
                'AEROCHAMBER PLUS FLOW-VU ADULT LARGE MASK 1KIT',
            'corrected_generic' =>
                'Valved holding chamber with large adult mask',
        ],
        [
            'sku' => '42271802FDM007',
            'expected_name' =>
                'AEROCHAMBER PLUS FLOW-VU ADULT MEDIUM MASK 1KIT',
            'corrected_generic' =>
                'Valved holding chamber with medium adult mask',
        ],
        [
            'sku' => '42271802FDM008',
            'expected_name' =>
                'AEROCHAMBER PLUS FLOW-VU ADULT MOUTHPIECE 1KIT',
            'corrected_generic' =>
                'Valved holding chamber with adult mouthpiece',
        ],
        [
            'sku' => '42271802FDM009',
            'expected_name' =>
                'AEROCHAMBER PLUS FLOW-VU ADULT SMALL MASK 1KIT',
            'corrected_generic' =>
                'Valved holding chamber with small adult mask',
        ],
        [
            'sku' => '42271802FDM010',
            'expected_name' => 'BABY HALER',
            'corrected_generic' =>
                'Infant inhalation spacer and holding chamber (Babyhaler)',
        ],
    ];

    /**
     * @return array<int, array{
     *     sku: string,
     *     expected_name: string,
     *     corrected_generic: string
     * }>
     */
    public static function corrections(): array
    {
        return self::CORRECTIONS;
    }

    public static function correctedGenericName(
        string $sku,
        ?string $genericName
    ): ?string {
        foreach (self::CORRECTIONS as $correction) {
            if ($correction['sku'] !== trim($sku)) {
                continue;
            }

            if (
                trim((string) $genericName)
                !== self::ORIGINAL_GENERIC
            ) {
                return $genericName;
            }

            return $correction['corrected_generic'];
        }

        return $genericName;
    }

    /**
     * @return array{
     *     tenant_slug: string,
     *     updated: int,
     *     already_correct: int,
     *     skipped_conflict: int,
     *     missing: int,
     *     updated_product_ids: array<int, int>
     * }
     */
    public function applyForTenantSlug(
        string $tenantSlug
    ): array {
        return $this->apply(
            tenantSlug: $tenantSlug,
            reverting: false
        );
    }

    /**
     * @return array{
     *     tenant_slug: string,
     *     updated: int,
     *     already_correct: int,
     *     skipped_conflict: int,
     *     missing: int,
     *     updated_product_ids: array<int, int>
     * }
     */
    public function revertForTenantSlug(
        string $tenantSlug
    ): array {
        return $this->apply(
            tenantSlug: $tenantSlug,
            reverting: true
        );
    }

    /**
     * @return array{
     *     tenant_slug: string,
     *     updated: int,
     *     already_correct: int,
     *     skipped_conflict: int,
     *     missing: int,
     *     updated_product_ids: array<int, int>
     * }
     */
    private function apply(
        string $tenantSlug,
        bool $reverting
    ): array {
        $summary = [
            'tenant_slug' => $tenantSlug,
            'updated' => 0,
            'already_correct' => 0,
            'skipped_conflict' => 0,
            'missing' => 0,
            'updated_product_ids' => [],
        ];

        if (
            ! Schema::hasTable('tenants')
            || ! Schema::hasTable('products')
        ) {
            return $summary;
        }

        $tenantId = DB::table('tenants')
            ->where('slug', $tenantSlug)
            ->value('id');

        if (! $tenantId) {
            return $summary;
        }

        return DB::transaction(
            function () use (
                $tenantId,
                $tenantSlug,
                $reverting,
                $summary
            ): array {
                foreach (
                    self::CORRECTIONS
                    as $correction
                ) {
                    $product = DB::table('products')
                        ->where('tenant_id', $tenantId)
                        ->where('sku', $correction['sku'])
                        ->lockForUpdate()
                        ->first();

                    if (! $product) {
                        $summary['missing']++;

                        continue;
                    }

                    if (
                        trim((string) $product->name)
                        !== $correction['expected_name']
                    ) {
                        $summary['skipped_conflict']++;

                        continue;
                    }

                    $expectedCurrent = $reverting
                        ? $correction['corrected_generic']
                        : self::ORIGINAL_GENERIC;

                    $targetGeneric = $reverting
                        ? self::ORIGINAL_GENERIC
                        : $correction['corrected_generic'];

                    if (
                        trim(
                            (string)
                            $product->generic_name
                        ) === $targetGeneric
                    ) {
                        $summary['already_correct']++;

                        continue;
                    }

                    if (
                        trim(
                            (string)
                            $product->generic_name
                        ) !== $expectedCurrent
                    ) {
                        $summary['skipped_conflict']++;

                        continue;
                    }

                    $metadata = $this->decodeMetadata(
                        $product->metadata ?? null
                    );

                    $history =
                        $metadata[
                            'product_master_corrections'
                        ] ?? [];

                    if (! is_array($history)) {
                        $history = [];
                    }

                    $history[] = [
                        'source' =>
                            'Approved Product Master reconciliation 2026-07-13',
                        'tenant_slug' => $tenantSlug,
                        'sku' => $correction['sku'],
                        'previous_generic_name' =>
                            $product->generic_name,
                        'new_generic_name' =>
                            $targetGeneric,
                        'operation' =>
                            $reverting
                                ? 'rollback'
                                : 'correction',
                        'applied_at' =>
                            now()->toIso8601String(),
                    ];

                    $metadata[
                        'product_master_corrections'
                    ] = $history;

                    $update = [
                        'generic_name' => $targetGeneric,
                        'metadata' => json_encode(
                            $metadata,
                            JSON_UNESCAPED_SLASHES
                            | JSON_UNESCAPED_UNICODE
                            | JSON_THROW_ON_ERROR
                        ),
                    ];

                    if (
                        Schema::hasColumn(
                            'products',
                            'updated_at'
                        )
                    ) {
                        $update['updated_at'] = now();
                    }

                    DB::table('products')
                        ->where('id', $product->id)
                        ->where('tenant_id', $tenantId)
                        ->update($update);

                    $summary['updated']++;
                    $summary[
                        'updated_product_ids'
                    ][] = (int) $product->id;
                }

                return $summary;
            }
        );
    }

    /**
     * @return array<string, mixed>
     */
    private function decodeMetadata(
        mixed $metadata
    ): array {
        if (is_array($metadata)) {
            return $metadata;
        }

        if (
            ! is_string($metadata)
            || trim($metadata) === ''
        ) {
            return [];
        }

        $decoded = json_decode(
            $metadata,
            true
        );

        return is_array($decoded)
            ? $decoded
            : [];
    }
}
