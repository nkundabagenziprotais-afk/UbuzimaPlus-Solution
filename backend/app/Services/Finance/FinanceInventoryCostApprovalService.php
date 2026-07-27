<?php

namespace App\Services\Finance;

use App\Models\FinanceInventoryCostApproval;
use App\Models\StockBatch;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;

class FinanceInventoryCostApprovalService
{
    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    /**
     * Return a previously approved row before mutable batch-state
     * validation when, and only when, the exact reviewed file was
     * already applied for the same tenant and stock batch.
     *
     * A different file hash continues through the complete validation
     * path, including quantity, timestamp, selling-price and cost-state
     * checks.
     */
    public function exactFileIdempotentRow(
        array $row,
        string $sourceFileHash,
        int $tenantId,
    ): ?array {
        $decision = strtolower(
            trim(
                (string) (
                    $row['decision']
                    ?? ''
                )
            )
        );

        $rowTenantId = (int) (
            $row['tenant_id']
            ?? 0
        );

        $batchId = (int) (
            $row['stock_batch_id']
            ?? 0
        );

        if (
            $decision !== 'approve'
            || $tenantId <= 0
            || $rowTenantId !== $tenantId
            || $batchId <= 0
            || trim($sourceFileHash) === ''
        ) {
            return null;
        }

        $approvals =
            FinanceInventoryCostApproval::query()
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->where(
                    'stock_batch_id',
                    $batchId
                )
                ->where(
                    'source_file_sha256',
                    $sourceFileHash
                )
                ->where(
                    'status',
                    'approved'
                )
                ->limit(2)
                ->get();

        if ($approvals->count() > 1) {
            throw new RuntimeException(
                "Multiple approvals exist for tenant {$tenantId}, stock batch {$batchId} and the exact reviewed file."
            );
        }

        $approval = $approvals->first();

        if ($approval === null) {
            return null;
        }

        $evidence =
            $approval->approval_evidence;

        if (is_string($evidence)) {
            $decoded = json_decode(
                $evidence,
                true
            );

            $evidence = is_array($decoded)
                ? $decoded
                : [];
        }

        if (! is_array($evidence)) {
            $evidence = [];
        }

        return [
            'decision' =>
                'approve',

            'idempotent' =>
                true,

            'existing_approval_id' =>
                $approval->id,

            'tenant_id' =>
                $tenantId,

            'stock_batch_id' =>
                $batchId,

            'approval_key' =>
                $approval->approval_key,

            'approval_method' =>
                $approval->approval_method,

            'approved_unit_cost' =>
                (float) $approval
                    ->approved_unit_cost,

            'source_file_sha256' =>
                $sourceFileHash,

            'selling_price_used' =>
                (bool) (
                    $evidence[
                        'selling_price_used'
                    ] ?? false
                ),

            'expected_selling_price' =>
                $evidence[
                    'selling_price_snapshot'
                ] ?? null,

            'derivation_divisor' =>
                $evidence[
                    'derivation_divisor'
                ] ?? null,

            'derivation_formula' =>
                $evidence[
                    'derivation_formula'
                ] ?? null,

            'raw_row' =>
                $row,
        ];
    }
    public function validateRow(
        array $row,
        string $sourceFileHash,
        int $expectedTenantId,
        string $cutoverDate,
    ): array {
        $decision = strtolower(
            trim((string) ($row['decision'] ?? ''))
        );

        if (! in_array($decision, ['approve', 'hold'], true)) {
            throw new RuntimeException(
                'Decision must be approve or hold.'
            );
        }

        $tenantId = filter_var(
            $row['tenant_id'] ?? null,
            FILTER_VALIDATE_INT
        );

        if (
            ! is_int($tenantId)
            || $tenantId <= 0
            || $tenantId !== $expectedTenantId
        ) {
            throw new RuntimeException(
                'Tenant ID is invalid or does not match the command scope.'
            );
        }

        $batchId = filter_var(
            $row['stock_batch_id'] ?? null,
            FILTER_VALIDATE_INT
        );

        if (! is_int($batchId) || $batchId <= 0) {
            throw new RuntimeException(
                'Stock batch ID must be a positive integer.'
            );
        }

        $batch = StockBatch::query()
            ->where('tenant_id', $tenantId)
            ->whereKey($batchId)
            ->first();

        if (! $batch) {
            throw new RuntimeException(
                "Stock batch {$batchId} does not exist in tenant {$tenantId}."
            );
        }

        $expectedQuantity = $row[
            'expected_quantity_on_hand'
        ] ?? null;

        if (
            ! is_numeric($expectedQuantity)
            || abs(
                (float) $expectedQuantity
                - (float) $batch->quantity_on_hand
            ) > 0.0001
        ) {
            throw new RuntimeException(
                "Stock batch {$batchId} quantity changed after template review."
            );
        }

        $expectedUpdatedAt = trim(
            (string) (
                $row['expected_batch_updated_at']
                ?? ''
            )
        );

        if ($expectedUpdatedAt !== '') {
            $expectedTimestamp =
                CarbonImmutable::parse(
                    $expectedUpdatedAt
                );

            $actualTimestamp =
                CarbonImmutable::parse(
                    $batch->updated_at
                );

            if (! $expectedTimestamp->equalTo($actualTimestamp)) {
                throw new RuntimeException(
                    "Stock batch {$batchId} changed after template generation."
                );
            }
        }

        $expectedSellingPriceRaw = trim(
            (string) (
                $row['expected_selling_price']
                ?? ''
            )
        );

        $actualSellingPrice =
            $batch->selling_price;

        if ($expectedSellingPriceRaw === '') {
            if (
                $actualSellingPrice !== null
                && abs(
                    (float) $actualSellingPrice
                ) > 0.0001
            ) {
                throw new RuntimeException(
                    "Stock batch {$batchId} selling price is missing from the reviewed template."
                );
            }

            $expectedSellingPrice = null;
        } else {
            if (! is_numeric($expectedSellingPriceRaw)) {
                throw new RuntimeException(
                    'Expected selling price must be numeric.'
                );
            }

            $expectedSellingPrice = round(
                (float) $expectedSellingPriceRaw,
                4
            );

            if (
                $actualSellingPrice === null
                || abs(
                    $expectedSellingPrice
                    - (float) $actualSellingPrice
                ) > 0.0001
            ) {
                throw new RuntimeException(
                    "Stock batch {$batchId} selling price changed after template generation."
                );
            }
        }

        if ($decision === 'hold') {
            return [
                'decision' => 'hold',
                'tenant_id' => $tenantId,
                'stock_batch_id' => $batchId,
                'expected_quantity_on_hand' =>
                    (float) $expectedQuantity,
                'expected_selling_price' =>
                    $expectedSellingPrice,
                'source_file_sha256' =>
                    $sourceFileHash,
            ];
        }

        if (
            abs((float) $batch->quantity_on_hand)
            <= 0.0001
        ) {
            throw new RuntimeException(
                "Stock batch {$batchId} no longer has active inventory."
            );
        }

        $approvedUnitCost = $row[
            'approved_unit_cost'
        ] ?? null;

        if (
            ! is_numeric($approvedUnitCost)
            || (float) $approvedUnitCost <= 0
        ) {
            throw new RuntimeException(
                'Approved unit cost must be a positive number.'
            );
        }

        $approvedUnitCost = round(
            (float) $approvedUnitCost,
            4
        );

        $approvalMethod = trim(
            (string) (
                $row['approval_method']
                ?? ''
            )
        );

        $allowedMethods = array_keys(
            (array) config(
                'finance.inventory_cost_approval_methods',
                []
            )
        );

        if (
            ! in_array(
                $approvalMethod,
                $allowedMethods,
                true
            )
        ) {
            throw new RuntimeException(
                'Approval method is not permitted.'
            );
        }

        $effectiveDate = trim(
            (string) (
                $row['effective_date']
                ?? ''
            )
        );

        try {
            $effectiveDate = CarbonImmutable::parse(
                $effectiveDate
            )->toDateString();
        } catch (\Throwable) {
            throw new RuntimeException(
                'Effective date is invalid.'
            );
        }

        $expectedCutoverDate =
            CarbonImmutable::parse(
                $cutoverDate
            )->toDateString();

        if ($effectiveDate !== $expectedCutoverDate) {
            throw new RuntimeException(
                'Effective date must match the approved cutover date.'
            );
        }

        $currencyCode = strtoupper(
            trim(
                (string) (
                    $row['currency_code']
                    ?? 'RWF'
                )
            )
        );

        if ($currencyCode !== 'RWF') {
            throw new RuntimeException(
                'The current approval workflow supports RWF only.'
            );
        }

        $valuationBasis = trim(
            (string) (
                $row['valuation_basis']
                ?? ''
            )
        );

        if (mb_strlen($valuationBasis) < 10) {
            throw new RuntimeException(
                'Valuation basis must contain a meaningful explanation.'
            );
        }

        $sourceReference = trim(
            (string) (
                $row['source_reference']
                ?? ''
            )
        );

        if ($sourceReference === '') {
            throw new RuntimeException(
                'A source or approval reference is required.'
            );
        }

        $sourceDocumentDate = trim(
            (string) (
                $row['source_document_date']
                ?? ''
            )
        );

        if ($sourceDocumentDate !== '') {
            try {
                $sourceDocumentDate =
                    CarbonImmutable::parse(
                        $sourceDocumentDate
                    )->toDateString();
            } catch (\Throwable) {
                throw new RuntimeException(
                    'Source document date is invalid.'
                );
            }
        } else {
            $sourceDocumentDate = null;
        }

        if (
            in_array(
                $approvalMethod,
                [
                    'documentary_exact',
                    'product_history_approved',
                ],
                true
            )
            && $sourceDocumentDate === null
        ) {
            throw new RuntimeException(
                'Documentary and product-history approvals require a source document date.'
            );
        }

        $approvalNotes = trim(
            (string) (
                $row['approval_notes']
                ?? ''
            )
        );

        if (mb_strlen($approvalNotes) < 10) {
            throw new RuntimeException(
                'Approval notes must contain a meaningful explanation.'
            );
        }

        $evidenceReviewed = strtolower(
            trim(
                (string) (
                    $row['evidence_reviewed']
                    ?? ''
                )
            )
        );

        if ($evidenceReviewed !== 'yes') {
            throw new RuntimeException(
                'Evidence reviewed must be explicitly marked yes.'
            );
        }

        $sellingPriceUsed = strtolower(
            trim(
                (string) (
                    $row['selling_price_used']
                    ?? ''
                )
            )
        );

        $derivationDivisorRaw = trim(
            (string) (
                $row['derivation_divisor']
                ?? ''
            )
        );

        $derivationFormula = trim(
            (string) (
                $row['derivation_formula']
                ?? ''
            )
        );

        $ownerApprovedMethod =
            'owner_approved_price_divisor';

        $requiredFormula =
            'approved_unit_cost = expected_selling_price / derivation_divisor';

        $sellingPriceWasUsed = false;
        $derivationDivisor = null;

        if ($approvalMethod === $ownerApprovedMethod) {
            if ($sellingPriceUsed !== 'yes') {
                throw new RuntimeException(
                    'Owner-approved price-divisor valuations must explicitly mark selling_price_used as yes.'
                );
            }

            if (
                $expectedSellingPrice === null
                || $expectedSellingPrice <= 0
            ) {
                throw new RuntimeException(
                    'Owner-approved price-divisor valuation requires a positive selling-price snapshot.'
                );
            }

            if (
                ! is_numeric($derivationDivisorRaw)
                || (float) $derivationDivisorRaw <= 0
            ) {
                throw new RuntimeException(
                    'Owner-approved price-divisor valuation requires a positive divisor.'
                );
            }

            $derivationDivisor = round(
                (float) $derivationDivisorRaw,
                4
            );

            $configuredDivisor = round(
                (float) config(
                    'finance.owner_approved_price_divisor',
                    1.4
                ),
                4
            );

            if (
                abs(
                    $derivationDivisor
                    - $configuredDivisor
                ) > 0.0001
            ) {
                throw new RuntimeException(
                    'The submitted divisor does not match the controlled owner-approved divisor.'
                );
            }

            if ($derivationFormula !== $requiredFormula) {
                throw new RuntimeException(
                    'The submitted derivation formula does not match the controlled formula.'
                );
            }

            $calculatedUnitCost = round(
                $expectedSellingPrice
                / $derivationDivisor,
                4
            );

            if (
                abs(
                    $approvedUnitCost
                    - $calculatedUnitCost
                ) > 0.0001
            ) {
                throw new RuntimeException(
                    sprintf(
                        'Approved unit cost %.4f does not match controlled selling-price calculation %.4f.',
                        $approvedUnitCost,
                        $calculatedUnitCost,
                    )
                );
            }

            $sellingPriceWasUsed = true;
        } else {
            if ($sellingPriceUsed !== 'no') {
                throw new RuntimeException(
                    'Selling price can only be used through the owner-approved price-divisor method.'
                );
            }

            if (
                $derivationDivisorRaw !== ''
                || $derivationFormula !== ''
            ) {
                throw new RuntimeException(
                    'Derivation fields must remain empty for non-derived approval methods.'
                );
            }
        }

        $approvedBy = filter_var(
            $row['approved_by_user_id'] ?? null,
            FILTER_VALIDATE_INT
        );

        if (
            ! is_int($approvedBy)
            || $approvedBy <= 0
            || ! DB::table('users')
                ->where('id', $approvedBy)
                ->exists()
        ) {
            throw new RuntimeException(
                'Approved-by user ID is invalid.'
            );
        }

        $approvalKey = hash(
            'sha256',
            json_encode(
                [
                    'tenant_id' => $tenantId,
                    'stock_batch_id' => $batchId,
                    'effective_date' => $effectiveDate,
                    'approved_unit_cost' =>
                        number_format(
                            $approvedUnitCost,
                            4,
                            '.',
                            ''
                        ),
                    'currency_code' => $currencyCode,
                    'approval_method' => $approvalMethod,
                    'source_reference' => $sourceReference,
                    'approved_by' => $approvedBy,
                    'selling_price_used' =>
                        $sellingPriceWasUsed,
                    'expected_selling_price' =>
                        $expectedSellingPrice,
                    'derivation_divisor' =>
                        $derivationDivisor,
                    'derivation_formula' =>
                        $derivationFormula,
                ],
                JSON_THROW_ON_ERROR
                | JSON_UNESCAPED_SLASHES
                | JSON_UNESCAPED_UNICODE
            )
        );

        $existingApproval =
            FinanceInventoryCostApproval::query()
                ->where(
                    'approval_key',
                    $approvalKey
                )
                ->first();

        if ($existingApproval) {
            return [
                'decision' => 'approve',
                'idempotent' => true,
                'existing_approval_id' =>
                    $existingApproval->id,
                'approval_key' => $approvalKey,
                'tenant_id' => $tenantId,
                'stock_batch_id' => $batchId,
                'expected_quantity_on_hand' =>
                    (float) $expectedQuantity,
                'source_file_sha256' =>
                    $sourceFileHash,
            ];
        }

        $otherApproval =
            FinanceInventoryCostApproval::query()
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->where(
                    'stock_batch_id',
                    $batchId
                )
                ->where(
                    'status',
                    'approved'
                )
                ->first();

        if ($otherApproval) {
            throw new RuntimeException(
                "Stock batch {$batchId} already has a different approved valuation."
            );
        }

        if ($this->batchHasApprovedCost($batch)) {
            throw new RuntimeException(
                "Stock batch {$batchId} already has an approved positive cost."
            );
        }

        return [
            'decision' => 'approve',
            'idempotent' => false,
            'approval_key' => $approvalKey,
            'tenant_id' => $tenantId,
            'stock_batch_id' => $batchId,
            'expected_quantity_on_hand' =>
                (float) $expectedQuantity,
            'approved_unit_cost' =>
                $approvedUnitCost,
            'currency_code' =>
                $currencyCode,
            'approval_method' =>
                $approvalMethod,
            'effective_date' =>
                $effectiveDate,
            'valuation_basis' =>
                $valuationBasis,
            'source_reference' =>
                $sourceReference,
            'source_document_date' =>
                $sourceDocumentDate,
            'approval_notes' =>
                $approvalNotes,
            'approved_by' =>
                $approvedBy,
            'source_file_sha256' =>
                $sourceFileHash,
            'expected_selling_price' =>
                $expectedSellingPrice,
            'selling_price_used' =>
                $sellingPriceWasUsed,
            'derivation_divisor' =>
                $derivationDivisor,
            'derivation_formula' =>
                $derivationFormula,
            'raw_row' =>
                $row,
        ];
    }

    /**
     * @param array<string, mixed> $validated
     */
    public function applyValidated(
        array $validated,
    ): FinanceInventoryCostApproval {
        if (
            ($validated['decision'] ?? null)
            !== 'approve'
        ) {
            throw new RuntimeException(
                'Only approved rows can be applied.'
            );
        }

        return DB::transaction(
            function () use (
                $validated,
            ): FinanceInventoryCostApproval {
                $existing =
                    FinanceInventoryCostApproval::query()
                        ->where(
                            'approval_key',
                            $validated['approval_key']
                        )
                        ->first();

                if ($existing) {
                    return $existing;
                }

                $batch = StockBatch::query()
                    ->where(
                        'tenant_id',
                        $validated['tenant_id']
                    )
                    ->whereKey(
                        $validated['stock_batch_id']
                    )
                    ->lockForUpdate()
                    ->firstOrFail();

                if (
                    abs(
                        (float) $batch->quantity_on_hand
                        - (float) $validated[
                            'expected_quantity_on_hand'
                        ]
                    ) > 0.0001
                ) {
                    throw new RuntimeException(
                        "Stock batch {$batch->id} quantity changed before approval application."
                    );
                }

                if ($this->batchHasApprovedCost($batch)) {
                    throw new RuntimeException(
                        "Stock batch {$batch->id} already has an approved cost."
                    );
                }

                $otherApproval =
                    FinanceInventoryCostApproval::query()
                        ->where(
                            'tenant_id',
                            $validated['tenant_id']
                        )
                        ->where(
                            'stock_batch_id',
                            $batch->id
                        )
                        ->where(
                            'status',
                            'approved'
                        )
                        ->first();

                if ($otherApproval) {
                    throw new RuntimeException(
                        "Stock batch {$batch->id} already has another approved valuation."
                    );
                }

                $approvedAt = now();

                $approval =
                    FinanceInventoryCostApproval::query()
                        ->create([
                            'uuid' =>
                                (string) Str::uuid(),
                            'tenant_id' =>
                                $validated['tenant_id'],
                            'branch_id' =>
                                $batch->branch_id,
                            'stock_batch_id' =>
                                $batch->id,
                            'effective_date' =>
                                $validated[
                                    'effective_date'
                                ],
                            'approved_unit_cost' =>
                                $validated[
                                    'approved_unit_cost'
                                ],
                            'currency_code' =>
                                $validated[
                                    'currency_code'
                                ],
                            'approval_method' =>
                                $validated[
                                    'approval_method'
                                ],
                            'valuation_basis' =>
                                $validated[
                                    'valuation_basis'
                                ],
                            'source_reference' =>
                                $validated[
                                    'source_reference'
                                ],
                            'source_document_date' =>
                                $validated[
                                    'source_document_date'
                                ],
                            'approval_notes' =>
                                $validated[
                                    'approval_notes'
                                ],
                            'approved_by' =>
                                $validated[
                                    'approved_by'
                                ],
                            'approved_at' =>
                                $approvedAt,
                            'status' =>
                                'approved',
                            'approval_key' =>
                                $validated[
                                    'approval_key'
                                ],
                            'source_file_sha256' =>
                                $validated[
                                    'source_file_sha256'
                                ],
                            'batch_snapshot' => [
                                'id' =>
                                    $batch->id,
                                'uuid' =>
                                    $batch->uuid,
                                'tenant_id' =>
                                    $batch->tenant_id,
                                'branch_id' =>
                                    $batch->branch_id,
                                'product_id' =>
                                    $batch->product_id,
                                'stock_location_id' =>
                                    $batch->stock_location_id,
                                'batch_number' =>
                                    $batch->batch_number,
                                'quantity_on_hand' =>
                                    (float) $batch
                                        ->quantity_on_hand,
                                'quantity_reserved' =>
                                    (float) $batch
                                        ->quantity_reserved,
                                'unit_cost' =>
                                    $batch->unit_cost,
                                'original_unit_cost' =>
                                    $batch
                                        ->original_unit_cost,
                                'inferred_unit_cost' =>
                                    $batch
                                        ->inferred_unit_cost,
                                'cost_source' =>
                                    $batch->cost_source,
                                'cost_resolved_at' =>
                                    optional(
                                        $batch
                                            ->cost_resolved_at
                                    )->toISOString(),
                                'selling_price' =>
                                    $batch->selling_price,
                                'updated_at' =>
                                    optional(
                                        $batch->updated_at
                                    )->toISOString(),
                            ],
                            'approval_evidence' => [
                                'submitted_row' =>
                                    $validated['raw_row'],
                                'selling_price_used' =>
                                    (bool) (
                                        $validated[
                                            'selling_price_used'
                                        ] ?? false
                                    ),
                                'selling_price_snapshot' =>
                                    $validated[
                                        'expected_selling_price'
                                    ] ?? null,
                                'derivation_divisor' =>
                                    $validated[
                                        'derivation_divisor'
                                    ] ?? null,
                                'derivation_formula' =>
                                    $validated[
                                        'derivation_formula'
                                    ] ?? null,
                                'evidence_reviewed' =>
                                    true,
                                'source_file_sha256' =>
                                    $validated[
                                        'source_file_sha256'
                                    ],
                            ],
                            'metadata' => [
                                'approval_service' =>
                                    self::class,
                                'prospective_cutover' =>
                                    true,
                                'selling_price_used' =>
                                    (bool) (
                                        $validated[
                                            'selling_price_used'
                                        ] ?? false
                                    ),
                                'derivation_divisor' =>
                                    $validated[
                                        'derivation_divisor'
                                    ] ?? null,
                                'derivation_formula' =>
                                    $validated[
                                        'derivation_formula'
                                    ] ?? null,
                            ],
                        ]);

                $metadata = $batch->metadata;

                if (is_string($metadata)) {
                    $decoded = json_decode(
                        $metadata,
                        true
                    );

                    $metadata = is_array($decoded)
                        ? $decoded
                        : [];
                }

                if (! is_array($metadata)) {
                    $metadata = [];
                }

                $metadata[
                    'finance_inventory_cost_approval'
                ] = [
                    'approval_id' =>
                        $approval->id,
                    'approval_uuid' =>
                        $approval->uuid,
                    'effective_date' =>
                        $validated[
                            'effective_date'
                        ],
                    'approval_method' =>
                        $validated[
                            'approval_method'
                        ],
                    'approved_unit_cost' =>
                        $validated[
                            'approved_unit_cost'
                        ],
                    'source_reference' =>
                        $validated[
                            'source_reference'
                        ],
                    'approved_by' =>
                        $validated[
                            'approved_by'
                        ],
                    'approved_at' =>
                        $approvedAt->toISOString(),
                    'selling_price_used' =>
                        (bool) (
                            $validated[
                                'selling_price_used'
                            ] ?? false
                        ),
                    'selling_price_snapshot' =>
                        $validated[
                            'expected_selling_price'
                        ] ?? null,
                    'derivation_divisor' =>
                        $validated[
                            'derivation_divisor'
                        ] ?? null,
                    'derivation_formula' =>
                        $validated[
                            'derivation_formula'
                        ] ?? null,
                ];

                $batch->forceFill([
                    'inferred_unit_cost' =>
                        $validated[
                            'approved_unit_cost'
                        ],
                    'cost_source' =>
                        'finance_inventory_cost_approval',
                    'cost_adjustment_method' =>
                        $validated[
                            'approval_method'
                        ],
                    'cost_resolution_notes' =>
                        sprintf(
                            'Approved through Finance inventory cost approval %s. Reference: %s. %s',
                            $approval->uuid,
                            $validated[
                                'source_reference'
                            ],
                            $validated[
                                'approval_notes'
                            ],
                        ),
                    'cost_resolved_at' =>
                        $approvedAt,
                    'metadata' =>
                        $metadata,
                ])->save();

                return $approval;
            }
        );
    }

    private function batchHasApprovedCost(
        StockBatch $batch,
    ): bool {
        if ((float) $batch->unit_cost > 0) {
            return true;
        }

        if ((float) $batch->original_unit_cost > 0) {
            return true;
        }

        return (float) $batch->inferred_unit_cost > 0
            && $batch->cost_resolved_at !== null
            && trim(
                (string) $batch->cost_source
            ) !== '';
    }
}
