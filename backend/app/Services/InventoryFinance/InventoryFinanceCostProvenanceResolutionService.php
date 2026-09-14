<?php

namespace App\Services\InventoryFinance;

use App\Models\StockBatch;
use App\Services\Access\ScopeContext;
use App\Services\Audit\AuditLogService;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use RuntimeException;

class InventoryFinanceCostProvenanceResolutionService
{
    private InventoryFinanceReadModelService $readModel;

    private AuditLogService $auditLogService;


    public function __construct(
        InventoryFinanceReadModelService $readModel,
        AuditLogService $auditLogService
    ) {
        $this->readModel = $readModel;

        $this->auditLogService = $auditLogService;
    }


    public function resolve(
        int $tenantId,
        string $tenantSlug,
        int $batchId,
        ScopeContext $scope,
        array $validated
    ): array {
        return DB::transaction(
            function () use (
                $tenantId,
                $tenantSlug,
                $batchId,
                $scope,
                $validated
            ): array {
                $batch = StockBatch::query()
                    ->where(
                        'tenant_id',
                        $tenantId
                    )
                    ->whereKey(
                        $batchId
                    )
                    ->lockForUpdate()
                    ->first();


                if (! $batch) {
                    abort(404);
                }


                $this->assertScope(
                    $scope,
                    $tenantId,
                    $batch
                );


                $quantity =
                    (float) $batch->quantity_on_hand;


                $unitCost =
                    $batch->unit_cost === null
                        ? null
                        : (float) $batch->unit_cost;


                if (
                    $quantity <= 0
                    ||
                    $unitCost === null
                    ||
                    $unitCost <= 0
                ) {
                    throw ValidationException::withMessages([
                        'batch' => [
                            'Only positive-stock batches with a numeric unit cost can use provenance-only resolution.',
                        ],
                    ]);
                }


                if (
                    ! $this->sameNumber(
                        $unitCost,
                        (float) $validated['expected_unit_cost'],
                        0.005
                    )
                ) {
                    throw ValidationException::withMessages([
                        'expected_unit_cost' => [
                            'The unit cost changed after this exception was loaded. Refresh Inventory Finance and review the current evidence again.',
                        ],
                    ]);
                }


                if (
                    ! $this->sameNumber(
                        $quantity,
                        (float) $validated['expected_quantity_on_hand'],
                        0.0001
                    )
                ) {
                    throw ValidationException::withMessages([
                        'expected_quantity_on_hand' => [
                            'The quantity changed after this exception was loaded. Refresh Inventory Finance and review the current evidence again.',
                        ],
                    ]);
                }


                $beforeReadModel =
                    $this->readModel->build(
                        $tenantId,
                        500
                    );


                $sourceException =
                    $this->findUnresolvedException(
                        $beforeReadModel,
                        $batchId
                    );


                if (! $sourceException) {
                    throw ValidationException::withMessages([
                        'exception' => [
                            'This batch is no longer classified as unresolved cost provenance. Refresh Inventory Finance.',
                        ],
                    ]);
                }


                $source =
                    (string)
                    $validated['provenance_source'];


                $evidenceType =
                    (string)
                    $validated['evidence_type'];


                $this->assertEvidenceCompatibility(
                    $source,
                    $evidenceType,
                    $batch
                );


                $before =
                    $this->snapshot(
                        $batch
                    );


                $resolutionNotes =
                    'Inventory Finance provenance resolution.'
                    . ' Evidence type: '
                    . $evidenceType
                    . '. Evidence reference: '
                    . trim(
                        (string)
                        $validated['evidence_reference']
                    )
                    . '. Reviewer notes: '
                    . trim(
                        (string)
                        $validated['reviewer_notes']
                    );


                /*
                 * IF2-B1-R3 MUTATION BOUNDARY:
                 * exactly four provenance fields.
                 */
                $batch->forceFill([
                    'cost_source' =>
                        $source,

                    'cost_adjustment_method' =>
                        $this->resolutionMethod(
                            $source
                        ),

                    'cost_resolution_notes' =>
                        $resolutionNotes,

                    'cost_resolved_at' =>
                        now(),
                ])->save();


                $batch->refresh();


                $after =
                    $this->snapshot(
                        $batch
                    );


                $this->assertImmutable(
                    $before,
                    $after
                );


                /*
                 * The authoritative Inventory Finance classifier
                 * must clear the source exception before commit.
                 */
                $afterReadModel =
                    $this->readModel->build(
                        $tenantId,
                        500
                    );


                if (
                    $this->findUnresolvedException(
                        $afterReadModel,
                        $batchId
                    )
                ) {
                    throw ValidationException::withMessages([
                        'provenance_source' => [
                            'The selected provenance did not clear the authoritative unresolved-cost classification. No change was committed.',
                        ],
                    ]);
                }


                $targetConfidence =
                    $this->targetConfidence(
                        $source
                    );


                /*
                 * Same transaction:
                 * audit failure rolls the provenance change back.
                 */
                $this->auditLogService->record(
                    action:
                        'pharmaco.inventory_finance.cost_provenance_resolved',

                    scope:
                        $scope,

                    metadata: [
                        'tenant_slug' =>
                            $tenantSlug,

                        'source_exception' =>
                            $sourceException,

                        'resolution' => [
                            'provenance_source' =>
                                $source,

                            'target_confidence' =>
                                $targetConfidence,

                            'evidence_type' =>
                                $evidenceType,

                            'evidence_reference' =>
                                trim(
                                    (string)
                                    $validated['evidence_reference']
                                ),

                            'reviewer_notes' =>
                                trim(
                                    (string)
                                    $validated['reviewer_notes']
                                ),
                        ],

                        'before' =>
                            $before,

                        'after' =>
                            $after,

                        'control_assertions' => [
                            'unit_cost_changed' =>
                                false,

                            'quantity_changed' =>
                                false,

                            'selling_price_changed' =>
                                false,

                            'expiry_changed' =>
                                false,

                            'stock_movement_created' =>
                                false,

                            'finance_journal_created' =>
                                false,

                            'authoritative_exception_cleared' =>
                                true,
                        ],
                    ],

                    dataClassification:
                        'internal',

                    auditableType:
                        StockBatch::class,

                    auditableId:
                        (int) $batch->id
                );


                return [
                    'stock_batch_id' =>
                        (int) $batch->id,

                    'batch_number' =>
                        (string) $batch->batch_number,

                    'provenance_source' =>
                        $source,

                    'cost_confidence' =>
                        $targetConfidence,

                    'evidence_type' =>
                        $evidenceType,

                    'exception_cleared' =>
                        true,

                    'read_model_verified' =>
                        true,

                    'immutable_values' => [
                        'quantity_on_hand' =>
                            $after['quantity_on_hand'],

                        'unit_cost' =>
                            $after['unit_cost'],

                        'selling_price' =>
                            $after['selling_price'],

                        'expiry_date' =>
                            $after['expiry_date'],
                    ],
                ];
            }
        );
    }


    private function snapshot(
        StockBatch $batch
    ): array {
        return [
            'id' =>
                (int) $batch->id,

            'tenant_id' =>
                (int) $batch->tenant_id,

            'branch_id' =>
                $batch->branch_id === null
                    ? null
                    : (int) $batch->branch_id,

            'product_id' =>
                (int) $batch->product_id,

            'stock_location_id' =>
                $batch->stock_location_id === null
                    ? null
                    : (int) $batch->stock_location_id,

            'batch_number' =>
                (string) $batch->batch_number,

            'quantity_on_hand' =>
                (float) $batch->quantity_on_hand,

            'unit_cost' =>
                (float) $batch->unit_cost,

            'selling_price' =>
                $batch->selling_price === null
                    ? null
                    : (float) $batch->selling_price,

            'expiry_date' =>
                $batch->expiry_date === null
                    ? null
                    : (string) $batch->expiry_date,

            'cost_source' =>
                $batch->cost_source,

            'cost_adjustment_method' =>
                $batch->cost_adjustment_method,

            'cost_resolution_notes' =>
                $batch->cost_resolution_notes,

            'cost_resolved_at' =>
                $batch->cost_resolved_at === null
                    ? null
                    : (string) $batch->cost_resolved_at,
        ];
    }


    private function assertImmutable(
        array $before,
        array $after
    ): void {
        if (
            ! $this->sameNumber(
                (float) $before['quantity_on_hand'],
                (float) $after['quantity_on_hand'],
                0.0001
            )
        ) {
            throw new RuntimeException(
                'Immutable quantity guard failed.'
            );
        }


        if (
            ! $this->sameNumber(
                (float) $before['unit_cost'],
                (float) $after['unit_cost'],
                0.005
            )
        ) {
            throw new RuntimeException(
                'Immutable unit-cost guard failed.'
            );
        }


        if (
            ! $this->sameNullableNumber(
                $before['selling_price'],
                $after['selling_price'],
                0.005
            )
        ) {
            throw new RuntimeException(
                'Immutable selling-price guard failed.'
            );
        }


        foreach (
            [
                'batch_number',
                'expiry_date',
            ]
            as $field
        ) {
            if (
                (string) ($before[$field] ?? '')
                !==
                (string) ($after[$field] ?? '')
            ) {
                throw new RuntimeException(
                    'Immutable '
                    . $field
                    . ' guard failed.'
                );
            }
        }


        foreach (
            [
                'tenant_id',
                'branch_id',
                'product_id',
                'stock_location_id',
            ]
            as $field
        ) {
            if (
                (int) ($before[$field] ?? 0)
                !==
                (int) ($after[$field] ?? 0)
            ) {
                throw new RuntimeException(
                    'Immutable '
                    . $field
                    . ' guard failed.'
                );
            }
        }
    }


    private function assertScope(
        ScopeContext $scope,
        int $tenantId,
        StockBatch $batch
    ): void {
        if (
            ! in_array(
                $scope->scopeType,
                [
                    'platform',
                    'solution',
                    'tenant',
                    'branch',
                ],
                true
            )
        ) {
            abort(
                403,
                'Controlled provenance resolution requires an explicit administrative scope.'
            );
        }


        if (
            $scope->scopeType === 'tenant'
            &&
            (int) $scope->tenantId
            !==
            $tenantId
        ) {
            abort(
                403,
                'Tenant scope does not permit this batch.'
            );
        }


        if (
            $scope->scopeType === 'branch'
        ) {
            if (
                (int) $scope->tenantId
                !==
                $tenantId
            ) {
                abort(
                    403,
                    'Tenant scope does not permit this batch.'
                );
            }


            if (
                (int) $scope->branchId
                !==
                (int) $batch->branch_id
            ) {
                abort(
                    403,
                    'Branch scope does not permit this batch.'
                );
            }
        }
    }


    private function findUnresolvedException(
        array $readModel,
        int $batchId
    ): ?array {
        foreach (
            $readModel['pharmaceutical_exception_queue']
            ?? []
            as $row
        ) {
            if (
                ($row['type'] ?? null)
                !==
                'unresolved_cost_provenance'
            ) {
                continue;
            }


            if (
                (int) ($row['stock_batch_id'] ?? 0)
                ===
                $batchId
            ) {
                return $row;
            }
        }


        return null;
    }


    private function assertEvidenceCompatibility(
        string $source,
        string $evidenceType,
        StockBatch $batch
    ): void {
        $allowed = [
            'actual' => [
                'supplier_invoice',
                'purchase_receipt',
                'supplier_statement',
                'receiving_record',
                'acquisition_record',
            ],

            'inferred_from_price' => [
                'price_inference_record',
            ],

            'legacy_equal_price_cost' => [
                'legacy_migration_record',
            ],
        ];


        if (
            ! isset($allowed[$source])
            ||
            ! in_array(
                $evidenceType,
                $allowed[$source],
                true
            )
        ) {
            throw ValidationException::withMessages([
                'evidence_type' => [
                    'The selected evidence type is not valid for this provenance classification.',
                ],
            ]);
        }


        if (
            $source === 'inferred_from_price'
            &&
            (
                $batch->selling_price === null
                ||
                (float) $batch->selling_price <= 0
            )
        ) {
            throw ValidationException::withMessages([
                'provenance_source' => [
                    'Inferred-from-price provenance requires a usable selling price.',
                ],
            ]);
        }


        if (
            $source === 'legacy_equal_price_cost'
            &&
            (
                $batch->selling_price === null
                ||
                ! $this->sameNumber(
                    (float) $batch->unit_cost,
                    (float) $batch->selling_price,
                    0.005
                )
            )
        ) {
            throw ValidationException::withMessages([
                'provenance_source' => [
                    'Legacy equal-price-cost provenance is valid only where persisted cost equals selling price.',
                ],
            ]);
        }
    }


    private function resolutionMethod(
        string $source
    ): string {
        return match ($source) {
            'actual' =>
                'verified_acquisition_evidence_review',

            'inferred_from_price' =>
                'inferred_from_price_evidence_review',

            'legacy_equal_price_cost' =>
                'legacy_reconstruction_evidence_review',

            default =>
                throw new RuntimeException(
                    'Unsupported provenance source.'
                ),
        };
    }


    private function targetConfidence(
        string $source
    ): string {
        return match ($source) {
            'actual' =>
                'verified_actual',

            'inferred_from_price' =>
                'inferred',

            'legacy_equal_price_cost' =>
                'legacy_reconstructed',

            default =>
                'unresolved',
        };
    }


    private function sameNumber(
        float $left,
        float $right,
        float $tolerance
    ): bool {
        return abs(
            $left - $right
        ) <= $tolerance;
    }


    private function sameNullableNumber(
        ?float $left,
        ?float $right,
        float $tolerance
    ): bool {
        if (
            $left === null
            &&
            $right === null
        ) {
            return true;
        }


        if (
            $left === null
            ||
            $right === null
        ) {
            return false;
        }


        return $this->sameNumber(
            $left,
            $right,
            $tolerance
        );
    }
}
