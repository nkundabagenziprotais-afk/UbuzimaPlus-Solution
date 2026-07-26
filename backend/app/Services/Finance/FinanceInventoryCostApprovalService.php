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

        if ($decision === 'hold') {
            return [
                'decision' => 'hold',
                'tenant_id' => $tenantId,
                'stock_batch_id' => $batchId,
                'expected_quantity_on_hand' =>
                    (float) $expectedQuantity,
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

        if ($sellingPriceUsed !== 'no') {
            throw new RuntimeException(
                'Selling price cannot be used as inventory cost.'
            );
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
                                    false,
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
