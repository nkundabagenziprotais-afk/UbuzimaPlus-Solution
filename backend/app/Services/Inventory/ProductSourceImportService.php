<?php

namespace App\Services\Inventory;

use App\Models\Product;
use App\Models\ProductDuplicateProposal;
use App\Models\ProductPayerPrice;
use App\Models\ProductReconciliationBatch;
use App\Models\ProductReconciliationRow;
use App\Support\XlsxWorkbookReader;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class ProductSourceImportService
{
    public function __construct(
        private readonly ProductReconciliationService $reconciliationService
    ) {
    }

    /**
     * @param array{
     *     drugs: string,
     *     medicines: string,
     *     reconciliation: string,
     *     eden?: string|null
     * } $sources
     */
    public function stageSources(
        int $tenantId,
        ?int $importedBy,
        array $sources
    ): array {
        $required = [
            'drugs',
            'medicines',
            'reconciliation',
        ];

        foreach ($required as $sourceKey) {
            $filename = $sources[$sourceKey] ?? null;

            if (! $filename || ! is_file($filename)) {
                throw new RuntimeException("Required source is unavailable: {$sourceKey}");
            }
        }

        $products = Product::query()
            ->where('tenant_id', $tenantId)
            ->get();

        $maps = $this->productMaps($products);

        $results = [];

        $results['drugs'] = $this->stageDrugs(
            $tenantId,
            $importedBy,
            $sources['drugs'],
            $maps
        );

        $results['medicines'] = $this->stageMedicines(
            $tenantId,
            $importedBy,
            $sources['medicines'],
            $maps
        );

        $results['reconciliation'] = $this->stageReconciliationWorkbook(
            $tenantId,
            $importedBy,
            $sources['reconciliation']
        );

        $eden = $sources['eden'] ?? null;

        $results['eden'] = $eden && is_file($eden)
            ? $this->registerPdfSource(
                $tenantId,
                $importedBy,
                'eden_care',
                'Eden Care pharmacy catalogue',
                $eden
            )
            : [
                'status' => 'source_unavailable',
                'imported_rows' => 0,
            ];

        return [
            'tenant_id' => $tenantId,
            'sources' => $results,
            'summary' => $this->reconciliationService->summary($tenantId),
        ];
    }

    private function stageDrugs(
        int $tenantId,
        ?int $importedBy,
        string $filename,
        array $maps
    ): array {
        $reader = new XlsxWorkbookReader($filename);
        $records = $reader->records('Sheet1');

        return DB::transaction(function () use (
            $tenantId,
            $importedBy,
            $filename,
            $records,
            $maps
        ): array {
            [$batch, $created] = $this->batch(
                $tenantId,
                $importedBy,
                'drugs',
                'RSSB/RHIA reimbursement medicines',
                $filename
            );

            if (! $created && $batch->rows()->exists()) {
                return $this->batchResult($batch, true);
            }

            $correctionMap = collect(
                ProductMasterCorrectionService::corrections()
            )->keyBy('sku');

            foreach ($records as $record) {
                $code = $this->stringValue($record['DRUG_CODE'] ?? null);
                $name = $this->stringValue($record['DESIGNATION'] ?? null);

                if ($code === null && $name === null) {
                    continue;
                }

                if ($name === null) {
                    continue;
                }

                $generic = $this->stringValue(
                    $record['GENERIC DESCRIPTION'] ?? null
                );

                $unit = $this->stringValue(
                    $record['SELLING UNIT'] ?? null
                );

                $price = $this->decimalValue(
                    $record['PRICE'] ?? null
                );

                $correction = $code
                    ? $correctionMap->get($code)
                    : null;

                if (
                    $correction
                    && $generic === ProductMasterCorrectionService::ORIGINAL_GENERIC
                ) {
                    $generic = $correction['corrected_generic'];
                }

                $match = $this->matchProduct(
                    $code,
                    $name,
                    $maps
                );

                $product = $match['product'];

                $action = $product
                    ? $this->requiresProductUpdate(
                        $product,
                        $name,
                        $generic,
                        $unit
                    )
                        ? 'update_existing'
                        : 'keep_existing'
                    : 'create_missing';

                $row = ProductReconciliationRow::query()->updateOrCreate(
                    [
                        'batch_id' => $batch->id,
                        'source_row' => (int) $record['__row_number'],
                    ],
                    [
                        'tenant_id' => $tenantId,
                        'source_code' => $code,
                        'product_name' => $name,
                        'generic_name' => $generic,
                        'selling_unit' => $unit,
                        'source_price' => $price,
                        'currency' => 'RWF',
                        'normalized_key' => ProductReconciliationService::normalizedKey(
                            $name
                        ),
                        'matched_product_id' => $product?->id,
                        'match_method' => $match['method'],
                        'match_score' => $match['score'],
                        'proposed_action' => $action,
                        'review_status' => 'pending',
                        'source_payload' => $record,
                        'dependency_snapshot' => $product
                            ? $this->reconciliationService->dependencySnapshot(
                                (int) $product->id
                            )
                            : null,
                    ]
                );

                if ($product && $price !== null) {
                    ProductPayerPrice::query()->updateOrCreate(
                        [
                            'tenant_id' => $tenantId,
                            'product_id' => $product->id,
                            'payer_code' => 'RSSB_RHIA',
                            'source_key' => 'drugs',
                            'source_reference' => basename($filename)
                                .':'
                                .$record['__row_number'],
                        ],
                        [
                            'payer_name' => 'RSSB / RHIA',
                            'amount' => $price,
                            'currency' => 'RWF',
                            'status' => 'pending',
                            'metadata' => [
                                'reconciliation_row_id' => $row->id,
                                'source_code' => $code,
                            ],
                        ]
                    );
                }
            }

            $this->refreshBatch($batch);

            return $this->batchResult($batch->fresh(), false);
        });
    }

    private function stageMedicines(
        int $tenantId,
        ?int $importedBy,
        string $filename,
        array $maps
    ): array {
        $reader = new XlsxWorkbookReader($filename);
        $records = $reader->records('Sheet1');

        return DB::transaction(function () use (
            $tenantId,
            $importedBy,
            $filename,
            $records,
            $maps
        ): array {
            [$batch, $created] = $this->batch(
                $tenantId,
                $importedBy,
                'medicines',
                'Medicines commercial source catalogue',
                $filename
            );

            if (! $created && $batch->rows()->exists()) {
                return $this->batchResult($batch, true);
            }

            foreach ($records as $record) {
                $name = $this->stringValue(
                    $record['Product Name'] ?? null
                );

                if ($name === null) {
                    continue;
                }

                $price = $this->decimalValue(
                    $record['Price'] ?? null
                );

                $match = $this->matchProduct(
                    null,
                    $name,
                    $maps
                );

                $product = $match['product'];

                $action = $product
                    ? 'confirm_match'
                    : 'create_missing';

                $row = ProductReconciliationRow::query()->updateOrCreate(
                    [
                        'batch_id' => $batch->id,
                        'source_row' => (int) $record['__row_number'],
                    ],
                    [
                        'tenant_id' => $tenantId,
                        'source_code' => null,
                        'product_name' => $name,
                        'generic_name' => null,
                        'source_price' => $price,
                        'currency' => 'RWF',
                        'normalized_key' => ProductReconciliationService::normalizedKey(
                            $name
                        ),
                        'matched_product_id' => $product?->id,
                        'match_method' => $match['method'],
                        'match_score' => $match['score'],
                        'proposed_action' => $action,
                        'review_status' => 'pending',
                        'source_payload' => $record,
                        'dependency_snapshot' => $product
                            ? $this->reconciliationService->dependencySnapshot(
                                (int) $product->id
                            )
                            : null,
                    ]
                );

                if ($product && $price !== null) {
                    ProductPayerPrice::query()->updateOrCreate(
                        [
                            'tenant_id' => $tenantId,
                            'product_id' => $product->id,
                            'payer_code' => 'MEDICINES_SOURCE',
                            'source_key' => 'medicines',
                            'source_reference' => basename($filename)
                                .':'
                                .$record['__row_number'],
                        ],
                        [
                            'payer_name' => 'Medicines source list',
                            'amount' => $price,
                            'currency' => 'RWF',
                            'status' => 'pending',
                            'metadata' => [
                                'reconciliation_row_id' => $row->id,
                            ],
                        ]
                    );
                }
            }

            $this->refreshBatch($batch);

            return $this->batchResult($batch->fresh(), false);
        });
    }

    private function stageReconciliationWorkbook(
        int $tenantId,
        ?int $importedBy,
        string $filename
    ): array {
        $reader = new XlsxWorkbookReader($filename);
        $sheetNames = $reader->sheetNames();

        $records = in_array(
            'Duplicate Candidates',
            $sheetNames,
            true
        )
            ? $reader->records('Duplicate Candidates')
            : [];

        return DB::transaction(function () use (
            $tenantId,
            $importedBy,
            $filename,
            $records,
            $sheetNames
        ): array {
            [$batch, $created] = $this->batch(
                $tenantId,
                $importedBy,
                'reconciliation_workbook',
                'UbuzimaPlus Product Master reconciliation review',
                $filename
            );

            $duplicatesCreated = 0;
            $duplicatesUpdated = 0;

            foreach ($records as $record) {
                $recordAId = $this->integerValue(
                    $record['Record A Product ID'] ?? null
                );

                $recordBId = $this->integerValue(
                    $record['Record B Product ID'] ?? null
                );

                if (! $recordAId || ! $recordBId || $recordAId === $recordBId) {
                    continue;
                }

                $products = Product::query()
                    ->where('tenant_id', $tenantId)
                    ->whereIn('id', [$recordAId, $recordBId])
                    ->pluck('id')
                    ->map(static fn ($value): int => (int) $value)
                    ->all();

                if (count($products) !== 2) {
                    continue;
                }

                sort($products);

                $proposal = ProductDuplicateProposal::query()->firstOrNew([
                    'tenant_id' => $tenantId,
                    'record_a_product_id' => $products[0],
                    'record_b_product_id' => $products[1],
                ]);

                $wasExisting = $proposal->exists;

                $proposal->fill([
                    'match_basis' => $this->stringValue(
                        $record['Match Basis'] ?? null
                    ) ?? 'Reconciliation workbook candidate',
                    'match_score' => $this->decimalValue(
                        $record['Match Score'] ?? null
                    ),
                    'status' => 'pending',
                    'dependency_snapshot' => [
                        'record_a' => $this->reconciliationService
                            ->dependencySnapshot($products[0]),
                        'record_b' => $this->reconciliationService
                            ->dependencySnapshot($products[1]),
                        'recommended_action' => $this->stringValue(
                            $record['Recommended Action'] ?? null
                        ),
                        'source_row' => $record['__row_number'],
                    ],
                ])->save();

                if ($wasExisting) {
                    $duplicatesUpdated++;
                } else {
                    $duplicatesCreated++;
                }
            }

            $batch->forceFill([
                'status' => 'completed',
                'imported_rows' => count($records),
                'matched_rows' => count($records),
                'review_rows' => count($records),
                'metadata' => array_merge(
                    $batch->metadata ?? [],
                    [
                        'duplicate_candidates_created' => $duplicatesCreated,
                        'duplicate_candidates_updated' => $duplicatesUpdated,
                        'available_sheets' => $sheetNames,
                    ]
                ),
                'completed_at' => now(),
            ])->save();

            return [
                'batch_id' => $batch->id,
                'status' => $batch->status,
                'source_version' => $batch->source_version,
                'imported_rows' => $batch->imported_rows,
                'duplicate_candidates_created' => $duplicatesCreated,
                'duplicate_candidates_updated' => $duplicatesUpdated,
                'reused_existing_batch' => ! $created,
            ];
        });
    }

    private function registerPdfSource(
        int $tenantId,
        ?int $importedBy,
        string $sourceKey,
        string $sourceName,
        string $filename
    ): array {
        [$batch, $created] = $this->batch(
            $tenantId,
            $importedBy,
            $sourceKey,
            $sourceName,
            $filename
        );

        $batch->forceFill([
            'status' => 'awaiting_structured_conversion',
            'metadata' => array_merge(
                $batch->metadata ?? [],
                [
                    'format' => 'pdf',
                    'automatic_activation_allowed' => false,
                    'treatment' => 'Registered for controlled parsing and review.',
                ]
            ),
        ])->save();

        return [
            'batch_id' => $batch->id,
            'status' => $batch->status,
            'source_version' => $batch->source_version,
            'imported_rows' => 0,
            'reused_existing_batch' => ! $created,
        ];
    }

    /**
     * @return array{
     *     0: ProductReconciliationBatch,
     *     1: bool
     * }
     */
    private function batch(
        int $tenantId,
        ?int $importedBy,
        string $sourceKey,
        string $sourceName,
        string $filename
    ): array {
        $hash = hash_file('sha256', $filename);

        if (! $hash) {
            throw new RuntimeException("Unable to hash source file: {$filename}");
        }

        $version = substr($hash, 0, 40);

        $batch = ProductReconciliationBatch::query()->firstOrCreate(
            [
                'tenant_id' => $tenantId,
                'source_key' => $sourceKey,
                'source_version' => $version,
            ],
            [
                'source_name' => $sourceName,
                'source_file' => basename($filename),
                'status' => 'staging',
                'metadata' => [
                    'sha256' => $hash,
                    'absolute_source_path_recorded' => false,
                ],
                'imported_by' => $importedBy,
            ]
        );

        return [$batch, $batch->wasRecentlyCreated];
    }

    /**
     * @param Collection<int, Product> $products
     */
    private function productMaps(Collection $products): array
    {
        $sku = [];
        $names = [];

        foreach ($products as $product) {
            $skuValue = trim((string) $product->sku);

            if ($skuValue !== '') {
                $sku[$skuValue] = $product;
            }

            $normalized = ProductReconciliationService::normalizeText(
                $product->name
            );

            if ($normalized !== '') {
                $names[$normalized] ??= [];
                $names[$normalized][] = $product;
            }
        }

        return [
            'sku' => $sku,
            'names' => $names,
        ];
    }

    private function matchProduct(
        ?string $code,
        string $name,
        array $maps
    ): array {
        if ($code && isset($maps['sku'][$code])) {
            return [
                'product' => $maps['sku'][$code],
                'method' => 'exact_sku',
                'score' => 100.00,
            ];
        }

        $normalized = ProductReconciliationService::normalizeText(
            $name
        );

        $nameMatches = $maps['names'][$normalized] ?? [];

        if (count($nameMatches) === 1) {
            return [
                'product' => $nameMatches[0],
                'method' => 'exact_normalized_name',
                'score' => 100.00,
            ];
        }

        if (count($nameMatches) > 1) {
            return [
                'product' => null,
                'method' => 'ambiguous_exact_name',
                'score' => 60.00,
            ];
        }

        return [
            'product' => null,
            'method' => 'no_safe_match',
            'score' => 0.00,
        ];
    }

    private function requiresProductUpdate(
        Product $product,
        string $name,
        ?string $generic,
        ?string $unit
    ): bool {
        if (
            ProductReconciliationService::normalizeText($product->name)
            !== ProductReconciliationService::normalizeText($name)
        ) {
            return true;
        }

        if (
            $generic !== null
            && ProductReconciliationService::normalizeText($product->generic_name)
                !== ProductReconciliationService::normalizeText($generic)
        ) {
            return true;
        }

        return $unit !== null
            && ProductReconciliationService::normalizeText($product->unit)
                !== ProductReconciliationService::normalizeText($unit);
    }

    private function refreshBatch(ProductReconciliationBatch $batch): void
    {
        $query = ProductReconciliationRow::query()
            ->where('batch_id', $batch->id);

        $batch->forceFill([
            'status' => 'completed',
            'imported_rows' => (clone $query)->count(),
            'matched_rows' => (clone $query)
                ->whereNotNull('matched_product_id')
                ->count(),
            'review_rows' => (clone $query)
                ->whereIn('review_status', ['pending', 'hold'])
                ->count(),
            'approved_rows' => (clone $query)
                ->where('review_status', 'approved')
                ->count(),
            'rejected_rows' => (clone $query)
                ->where('review_status', 'rejected')
                ->count(),
            'completed_at' => now(),
        ])->save();
    }

    private function batchResult(
        ProductReconciliationBatch $batch,
        bool $reused
    ): array {
        return [
            'batch_id' => $batch->id,
            'status' => $batch->status,
            'source_version' => $batch->source_version,
            'imported_rows' => $batch->imported_rows,
            'matched_rows' => $batch->matched_rows,
            'review_rows' => $batch->review_rows,
            'approved_rows' => $batch->approved_rows,
            'rejected_rows' => $batch->rejected_rows,
            'reused_existing_batch' => $reused,
        ];
    }

    private function stringValue(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $value = trim((string) $value);

        return $value === ''
            ? null
            : $value;
    }

    private function decimalValue(mixed $value): ?float
    {
        if ($value === null || trim((string) $value) === '') {
            return null;
        }

        $normalized = preg_replace(
            '/[^0-9.\-]/',
            '',
            (string) $value
        );

        return $normalized !== null && is_numeric($normalized)
            ? round((float) $normalized, 2)
            : null;
    }

    private function integerValue(mixed $value): ?int
    {
        if ($value === null || trim((string) $value) === '') {
            return null;
        }

        return is_numeric($value)
            ? (int) $value
            : null;
    }
}
