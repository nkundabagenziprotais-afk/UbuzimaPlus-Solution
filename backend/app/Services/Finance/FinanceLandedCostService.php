<?php

namespace App\Services\Finance;

use App\Data\Finance\FinanceJournalLinePayload;
use App\Data\Finance\FinancePostingPayload;
use App\Models\FinanceJournalEntry;
use App\Models\FinancePostingLog;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class FinanceLandedCostService
{
    private const RELEASE =
        'F12A-R1.1';

    private const INVENTORY_MAPPING =
        'inventory.asset';

    private const ACCRUAL_MAPPING =
        'inventory.landed_cost_accrual';

    private const ALLOWED_CHARGES = [
        'freight',
        'customs_duty',
        'clearing',
        'import_insurance',
        'handling',
        'other_capitalizable',
    ];

    private const ALLOWED_ALLOCATION_METHODS = [
        'purchase_value',
        'quantity',
        'manual',
    ];

    public function __construct(
        private readonly FinancePostingService $postingService,
    ) {
    }

    public function list(
        int $tenantId,
        ?int $branchScope,
    ): array {
        $query =
            DB::table(
                'finance_landed_cost_documents as d'
            )
                ->join(
                    'pharmaco_goods_receipts as gr',
                    'gr.id',
                    '=',
                    'd.pharmaco_goods_receipt_id'
                )
                ->where(
                    'd.tenant_id',
                    $tenantId
                );

        if ($branchScope !== null) {
            $query->where(
                'd.branch_id',
                $branchScope
            );
        }

        return $query
            ->orderByDesc(
                'd.id'
            )
            ->limit(200)
            ->get([
                'd.uuid',
                'd.document_number',
                'd.branch_id',
                'd.business_date',
                'd.allocation_method',
                'd.status',
                'd.currency_code',
                'd.exchange_rate',
                'd.total_charge_amount',
                'd.created_by',
                'd.posted_by',
                'd.finance_journal_entry_id',
                'd.finance_posted_at',
                'gr.uuid as goods_receipt_uuid',
                'gr.receipt_number',
            ])
            ->map(
                fn (object $row): array =>
                    (array) $row
            )
            ->all();
    }

    public function detail(
        int $tenantId,
        ?int $branchScope,
        string $uuid,
    ): array {
        $query =
            DB::table(
                'finance_landed_cost_documents as d'
            )
                ->join(
                    'pharmaco_goods_receipts as gr',
                    'gr.id',
                    '=',
                    'd.pharmaco_goods_receipt_id'
                )
                ->where(
                    'd.tenant_id',
                    $tenantId
                )
                ->where(
                    'd.uuid',
                    $uuid
                );

        if ($branchScope !== null) {
            $query->where(
                'd.branch_id',
                $branchScope
            );
        }

        $document =
            $query->first([
                'd.*',
                'gr.uuid as goods_receipt_uuid',
                'gr.receipt_number',
                'gr.receipt_date',
                'gr.pharmaco_supplier_id',
            ]);

        if (! $document) {
            $this->fail(
                'landed_cost',
                'Landed Cost document was not found.'
            );
        }

        $charges =
            DB::table(
                'finance_landed_cost_charges'
            )
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->where(
                    'finance_landed_cost_document_id',
                    $document->id
                )
                ->orderBy('id')
                ->get()
                ->map(
                    fn (object $row): array => [
                        'uuid' =>
                            $row->uuid,

                        'charge_type' =>
                            $row->charge_type,

                        'description' =>
                            $row->description,

                        'amount' =>
                            (float)
                                $row->amount,

                        'source_supplier_id' =>
                            $row->source_supplier_id
                            !== null
                                ? (int)
                                    $row->source_supplier_id
                                : null,

                        'source_reference' =>
                            $row->source_reference,
                    ]
                )
                ->all();

        $allocations =
            DB::table(
                'finance_landed_cost_allocations as a'
            )
                ->join(
                    'pharmaco_goods_receipt_items as gri',
                    'gri.id',
                    '=',
                    'a.pharmaco_goods_receipt_item_id'
                )
                ->where(
                    'a.tenant_id',
                    $tenantId
                )
                ->where(
                    'a.finance_landed_cost_document_id',
                    $document->id
                )
                ->orderBy('a.id')
                ->get([
                    'a.*',
                    'gri.uuid as goods_receipt_item_uuid',
                    'gri.description as receipt_item_description',
                    'gri.batch_number',
                ])
                ->map(
                    fn (object $row): array => [
                        'uuid' =>
                            $row->uuid,

                        'goods_receipt_item_uuid' =>
                            $row->goods_receipt_item_uuid,

                        'description' =>
                            $row->receipt_item_description,

                        'batch_number' =>
                            $row->batch_number,

                        'product_id' =>
                            (int)
                                $row->product_id,

                        'stock_batch_id' =>
                            (int)
                                $row->stock_batch_id,

                        'stock_movement_id' =>
                            (int)
                                $row->stock_movement_id,

                        'basis_value' =>
                            (float)
                                $row->basis_value,

                        'allocated_amount' =>
                            (float)
                                $row->allocated_amount,

                        'quantity_received' =>
                            (float)
                                $row->quantity_received,

                        'batch_quantity_snapshot' =>
                            (float)
                                $row->batch_quantity_snapshot,

                        'unit_cost_before' =>
                            (float)
                                $row->unit_cost_before,

                        'unit_cost_after' =>
                            $row->unit_cost_after
                            !== null
                                ? (float)
                                    $row->unit_cost_after
                                : null,

                        'status' =>
                            $row->status,

                        'applied_stock_movement_id' =>
                            $row->applied_stock_movement_id
                            !== null
                                ? (int)
                                    $row->applied_stock_movement_id
                                : null,

                        'metadata' =>
                            $this->decode(
                                $row->metadata
                            ),
                    ]
                )
                ->all();

        $actions =
            DB::table(
                'finance_landed_cost_actions'
            )
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->where(
                    'finance_landed_cost_document_id',
                    $document->id
                )
                ->orderBy('id')
                ->get()
                ->map(
                    fn (object $row): array => [
                        'action' =>
                            $row->action,

                        'actor_id' =>
                            (int)
                                $row->actor_id,

                        'comment' =>
                            $row->comment,

                        'created_at' =>
                            $row->created_at,
                    ]
                )
                ->all();

        return [
            'uuid' =>
                $document->uuid,

            'document_number' =>
                $document->document_number,

            'goods_receipt_uuid' =>
                $document->goods_receipt_uuid,

            'receipt_number' =>
                $document->receipt_number,

            'receipt_date' =>
                $document->receipt_date,

            'branch_id' =>
                (int)
                    $document->branch_id,

            'business_date' =>
                $document->business_date,

            'allocation_method' =>
                $document->allocation_method,

            'status' =>
                $document->status,

            'currency_code' =>
                $document->currency_code,

            'exchange_rate' =>
                (float)
                    $document->exchange_rate,

            'total_charge_amount' =>
                (float)
                    $document->total_charge_amount,

            'created_by' =>
                (int)
                    $document->created_by,

            'posted_by' =>
                $document->posted_by
                !== null
                    ? (int)
                        $document->posted_by
                    : null,

            'finance_journal_entry_id' =>
                $document->finance_journal_entry_id
                !== null
                    ? (int)
                        $document->finance_journal_entry_id
                    : null,

            'finance_posted_at' =>
                $document->finance_posted_at,

            'notes' =>
                $document->notes,

            'metadata' =>
                $this->decode(
                    $document->metadata
                ),

            'charges' =>
                $charges,

            'allocations' =>
                $allocations,

            'actions' =>
                $actions,
        ];
    }

    public function eligibility(
        int $tenantId,
        ?int $branchScope,
        string $receiptUuid,
    ): array {
        $receiptQuery =
            DB::table(
                'pharmaco_goods_receipts'
            )
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->where(
                    'uuid',
                    $receiptUuid
                );

        if ($branchScope !== null) {
            $receiptQuery->where(
                'branch_id',
                $branchScope
            );
        }

        $receipt =
            $receiptQuery->first();

        if (! $receipt) {
            $this->fail(
                'goods_receipt',
                'Goods Receipt was not found in the verified Accounting scope.'
            );
        }

        if (
            strtolower(
                (string)
                    $receipt->source_type
            )
            !== 'core_products'
        ) {
            $this->fail(
                'goods_receipt',
                'F12A currently supports pharmaceutical product Goods Receipts only.'
            );
        }

        if (
            strtolower(
                (string)
                    $receipt->status
            )
            !== 'approved'
        ) {
            $this->fail(
                'goods_receipt',
                'Goods Receipt must be approved before Landed Cost allocation.'
            );
        }

        if (
            strtolower(
                (string)
                    $receipt->accounting_status
            )
            !== 'posted'
            ||
            $receipt->finance_journal_entry_id
            === null
        ) {
            $this->fail(
                'goods_receipt',
                'Goods Receipt must already be posted to Finance before Landed Cost allocation.'
            );
        }

        if (
            strtoupper(
                (string)
                    $receipt->currency_code
            )
            !== 'RWF'
        ) {
            $this->fail(
                'currency_code',
                'F12A supports RWF Goods Receipts only. Multicurrency Landed Cost remains a later Finance phase.'
            );
        }

        $baseJournalExists =
            DB::table(
                'finance_journal_entries'
            )
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->where(
                    'id',
                    $receipt->finance_journal_entry_id
                )
                ->where(
                    'status',
                    'posted'
                )
                ->exists();

        if (! $baseJournalExists) {
            $this->fail(
                'goods_receipt',
                'The Goods Receipt Finance posting reference is not a valid posted journal.'
            );
        }

        $items =
            DB::table(
                'pharmaco_goods_receipt_items'
            )
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->where(
                    'pharmaco_goods_receipt_id',
                    $receipt->id
                )
                ->orderBy('id')
                ->get();

        if ($items->isEmpty()) {
            $this->fail(
                'goods_receipt',
                'Goods Receipt contains no lines.'
            );
        }

        $prepared = [];

        /*
         * Batch-level target evidence.
         *
         * A Stock Batch can theoretically receive quantities more than once.
         * Landed Cost must therefore prove that the cost layer belongs only
         * to this Goods Receipt.
         */
        $batchTargetMovementIds = [];
        $batchReceiptQuantity = [];

        foreach ($items as $item) {
            if (
                $item->product_id === null
                ||
                $item->pharmaco_general_item_id
                !== null
            ) {
                $this->fail(
                    'goods_receipt',
                    'F12A Landed Cost requires pharmaceutical product receipt lines.'
                );
            }

            if (
                $item->stock_batch_id === null
                ||
                $item->stock_movement_id === null
            ) {
                $this->fail(
                    'goods_receipt',
                    'Every Goods Receipt line must be linked to its Stock Batch and stock_received movement.'
                );
            }

            $quantity =
                round(
                    (float)
                        $item->quantity_received,
                    4
                );

            $receiptUnitCost =
                round(
                    (float)
                        $item->unit_cost,
                    4
                );

            if (
                $quantity <= 0
                ||
                $receiptUnitCost <= 0
            ) {
                $this->fail(
                    'goods_receipt',
                    'Goods Receipt quantity and unit cost must both be positive.'
                );
            }

            $movement =
                DB::table(
                    'stock_movements'
                )
                    ->where(
                        'tenant_id',
                        $tenantId
                    )
                    ->where(
                        'branch_id',
                        $receipt->branch_id
                    )
                    ->where(
                        'id',
                        $item->stock_movement_id
                    )
                    ->where(
                        'stock_batch_id',
                        $item->stock_batch_id
                    )
                    ->where(
                        'product_id',
                        $item->product_id
                    )
                    ->first();

            if (
                ! $movement
                ||
                strtolower(
                    (string)
                        $movement->movement_type
                )
                !== 'stock_received'
            ) {
                $this->fail(
                    'goods_receipt',
                    'Goods Receipt stock movement provenance is invalid.'
                );
            }

            $batchId =
                (int)
                    $item->stock_batch_id;

            $batchTargetMovementIds[
                $batchId
            ][] =
                (int)
                    $movement->id;

            $batchReceiptQuantity[
                $batchId
            ] =
                round(
                    (
                        $batchReceiptQuantity[
                            $batchId
                        ]
                        ?? 0
                    )
                    +
                    $quantity,
                    4
                );

            $prepared[] = [
                'item' =>
                    $item,

                'movement' =>
                    $movement,

                'quantity' =>
                    $quantity,

                'receipt_unit_cost' =>
                    $receiptUnitCost,
            ];
        }

        $batchEvidence = [];

        foreach (
            $batchTargetMovementIds
            as $batchId => $targetMovementIds
        ) {
            $targetMovementIds =
                array_values(
                    array_unique(
                        array_map(
                            'intval',
                            $targetMovementIds
                        )
                    )
                );

            $batch =
                DB::table(
                    'stock_batches'
                )
                    ->where(
                        'tenant_id',
                        $tenantId
                    )
                    ->where(
                        'branch_id',
                        $receipt->branch_id
                    )
                    ->where(
                        'id',
                        $batchId
                    )
                    ->first();

            if (! $batch) {
                $this->fail(
                    'stock_batch',
                    'A Goods Receipt Stock Batch is missing.'
                );
            }

            /*
             * Receipt-specific batch cost-layer rule.
             *
             * Every operational movement on this batch must belong to this
             * exact Goods Receipt. Previous F12A landed-cost adjustments are
             * zero-quantity valuation movements and are allowed.
             */
            $foreignMovement =
                DB::table(
                    'stock_movements'
                )
                    ->where(
                        'tenant_id',
                        $tenantId
                    )
                    ->where(
                        'branch_id',
                        $receipt->branch_id
                    )
                    ->where(
                        'stock_batch_id',
                        $batchId
                    )
                    ->where(
                        'movement_type',
                        '<>',
                        'landed_cost_adjustment'
                    )
                    ->whereNotIn(
                        'id',
                        $targetMovementIds
                    )
                    ->orderBy('id')
                    ->first();

            if ($foreignMovement) {
                $this->fail(
                    'stock_batch',
                    'F12A requires a receipt-specific Stock Batch cost layer. This batch contains stock activity outside the selected Goods Receipt.'
                );
            }

            $currentQuantity =
                round(
                    (float)
                        $batch->quantity_on_hand,
                    4
                );

            $receiptQuantity =
                round(
                    (float)
                        $batchReceiptQuantity[
                            $batchId
                        ],
                    4
                );

            if (
                $currentQuantity <= 0
                ||
                abs(
                    $currentQuantity
                    -
                    $receiptQuantity
                )
                > 0.0001
            ) {
                $this->fail(
                    'stock_batch',
                    'Current Stock Batch quantity does not equal the selected Goods Receipt quantity. F12A will not infer a mixed cost layer.'
                );
            }

            $rawUnitCost =
                $batch->unit_cost
                !== null
                    ? round(
                        (float)
                            $batch->unit_cost,
                        4
                    )
                    : 0.0;

            $inferredUnitCost =
                $batch->inferred_unit_cost
                !== null
                    ? round(
                        (float)
                            $batch->inferred_unit_cost,
                        4
                    )
                    : 0.0;

            $resolvedUnitCost =
                $inferredUnitCost > 0
                    ? $inferredUnitCost
                    : $rawUnitCost;

            if ($resolvedUnitCost <= 0) {
                $this->fail(
                    'stock_batch',
                    'Current authoritative batch cost is unavailable.'
                );
            }

            $latestMovement =
                DB::table(
                    'stock_movements'
                )
                    ->where(
                        'tenant_id',
                        $tenantId
                    )
                    ->where(
                        'stock_batch_id',
                        $batchId
                    )
                    ->orderByDesc('id')
                    ->first();

            if (
                ! $latestMovement
                ||
                $latestMovement->running_balance
                === null
            ) {
                $this->fail(
                    'stock_batch',
                    'Current stock movement running balance is unavailable.'
                );
            }

            $movementBalance =
                round(
                    (float)
                        $latestMovement
                            ->running_balance,
                    4
                );

            if (
                abs(
                    $movementBalance
                    -
                    $currentQuantity
                )
                > 0.0001
            ) {
                $this->fail(
                    'stock_batch',
                    'Stock Batch quantity does not reconcile with its latest movement running balance.'
                );
            }

            $batchEvidence[
                $batchId
            ] = [
                'batch' =>
                    $batch,

                'current_quantity' =>
                    $currentQuantity,

                'receipt_quantity' =>
                    $receiptQuantity,

                'raw_unit_cost' =>
                    $rawUnitCost,

                'inferred_unit_cost' =>
                    $inferredUnitCost,

                'resolved_unit_cost' =>
                    $resolvedUnitCost,

                'target_movement_ids' =>
                    $targetMovementIds,

                'latest_movement_id' =>
                    (int)
                        $latestMovement->id,
            ];
        }

        $serializedItems = [];

        foreach ($prepared as $row) {
            $item =
                $row['item'];

            $batchId =
                (int)
                    $item->stock_batch_id;

            $batch =
                $batchEvidence[
                    $batchId
                ];

            $serializedItems[] = [
                'id' =>
                    (int)
                        $item->id,

                'uuid' =>
                    (string)
                        $item->uuid,

                'description' =>
                    $item->description,

                'product_id' =>
                    (int)
                        $item->product_id,

                'batch_number' =>
                    $item->batch_number,

                'stock_batch_id' =>
                    $batchId,

                'stock_movement_id' =>
                    (int)
                        $item->stock_movement_id,

                'stock_location_id' =>
                    (int)
                        $batch['batch']
                            ->stock_location_id,

                'quantity_received' =>
                    $row['quantity'],

                'receipt_unit_cost' =>
                    $row['receipt_unit_cost'],

                'purchase_value_basis' =>
                    round(
                        $row['quantity']
                        *
                        $row['receipt_unit_cost'],
                        4
                    ),

                'batch_quantity_on_hand' =>
                    $batch[
                        'current_quantity'
                    ],

                'batch_receipt_quantity' =>
                    $batch[
                        'receipt_quantity'
                    ],

                'batch_raw_unit_cost' =>
                    $batch[
                        'raw_unit_cost'
                    ],

                'batch_inferred_unit_cost' =>
                    $batch[
                        'inferred_unit_cost'
                    ],

                'batch_resolved_unit_cost' =>
                    $batch[
                        'resolved_unit_cost'
                    ],

                'batch_target_movement_ids' =>
                    $batch[
                        'target_movement_ids'
                    ],

                'batch_latest_movement_id' =>
                    $batch[
                        'latest_movement_id'
                    ],
            ];
        }

        return [
            'eligible' =>
                true,

            'policy' =>
                'receipt_specific_batch_pre_issue_only',

            'historical_cogs_estimation' =>
                false,

            'mixed_batch_cost_layer_allowed' =>
                false,

            'receipt' => [
                'id' =>
                    (int)
                        $receipt->id,

                'uuid' =>
                    (string)
                        $receipt->uuid,

                'receipt_number' =>
                    (string)
                        $receipt->receipt_number,

                'branch_id' =>
                    (int)
                        $receipt->branch_id,

                'stock_location_id' =>
                    $receipt->stock_location_id
                    !== null
                        ? (int)
                            $receipt->stock_location_id
                        : null,

                'supplier_id' =>
                    (int)
                        $receipt->pharmaco_supplier_id,

                'receipt_date' =>
                    (string)
                        $receipt->receipt_date,

                'currency_code' =>
                    (string)
                        $receipt->currency_code,

                'exchange_rate' =>
                    (float)
                        $receipt->exchange_rate,

                'finance_journal_entry_id' =>
                    (int)
                        $receipt->finance_journal_entry_id,
            ],

            'items' =>
                $serializedItems,
        ];
    }

    public function createDraft(
        int $tenantId,
        ?int $branchScope,
        int $actorId,
        array $data,
    ): array {
        $method =
            strtolower(
                (string)
                    $data[
                        'allocation_method'
                    ]
            );

        if (
            ! in_array(
                $method,
                self::ALLOWED_ALLOCATION_METHODS,
                true
            )
        ) {
            $this->fail(
                'allocation_method',
                'Unsupported Landed Cost allocation method.'
            );
        }

        $eligibility =
            $this->eligibility(
                $tenantId,
                $branchScope,
                (string)
                    $data[
                        'goods_receipt_uuid'
                    ],
            );

        $receipt =
            $eligibility[
                'receipt'
            ];

        $businessDate =
            (string)
                $data[
                    'business_date'
                ];

        if (
            $businessDate
            <
            $receipt[
                'receipt_date'
            ]
        ) {
            $this->fail(
                'business_date',
                'Landed Cost business date cannot be before the Goods Receipt date.'
            );
        }

        if (
            $businessDate
            >
            now()->toDateString()
        ) {
            $this->fail(
                'business_date',
                'Landed Cost business date cannot be in the future.'
            );
        }

        $existingDraft =
            DB::table(
                'finance_landed_cost_documents'
            )
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->where(
                    'pharmaco_goods_receipt_id',
                    $receipt['id']
                )
                ->where(
                    'status',
                    'draft'
                )
                ->exists();

        if ($existingDraft) {
            $this->fail(
                'goods_receipt',
                'This Goods Receipt already has an unfinished Landed Cost draft.'
            );
        }

        $charges =
            $data[
                'charges'
            ]
            ?? [];

        if (
            ! is_array($charges)
            ||
            count($charges) < 1
        ) {
            $this->fail(
                'charges',
                'At least one directly attributable Landed Cost charge is required.'
            );
        }

        $normalisedCharges = [];

        $totalCharge = 0.0;

        foreach (
            $charges
            as $index => $charge
        ) {
            $type =
                strtolower(
                    trim(
                        (string)
                            (
                                $charge[
                                    'charge_type'
                                ]
                                ?? ''
                            )
                    )
                );

            if (
                ! in_array(
                    $type,
                    self::ALLOWED_CHARGES,
                    true
                )
            ) {
                $this->fail(
                    "charges.$index.charge_type",
                    'Unsupported Landed Cost charge type.'
                );
            }

            $amount =
                round(
                    (float)
                        (
                            $charge[
                                'amount'
                            ]
                            ?? 0
                        ),
                    4
                );

            if ($amount <= 0) {
                $this->fail(
                    "charges.$index.amount",
                    'Landed Cost charge amount must be positive.'
                );
            }

            $sourceSupplierId =
                isset(
                    $charge[
                        'source_supplier_id'
                    ]
                )
                &&
                $charge[
                    'source_supplier_id'
                ] !== null
                    ? (int)
                        $charge[
                            'source_supplier_id'
                        ]
                    : null;

            if ($sourceSupplierId !== null) {
                $supplierExists =
                    DB::table(
                        'pharmaco_suppliers'
                    )
                        ->where(
                            'tenant_id',
                            $tenantId
                        )
                        ->where(
                            'id',
                            $sourceSupplierId
                        )
                        ->exists();

                if (! $supplierExists) {
                    $this->fail(
                        "charges.$index.source_supplier_id",
                        'Charge supplier is outside the verified tenant.'
                    );
                }
            }

            $normalisedCharges[] = [
                'charge_type' =>
                    $type,

                'description' =>
                    trim(
                        (string)
                            (
                                $charge[
                                    'description'
                                ]
                                ?? $type
                            )
                    ),

                'amount' =>
                    $amount,

                'source_supplier_id' =>
                    $sourceSupplierId,

                'source_reference' =>
                    isset(
                        $charge[
                            'source_reference'
                        ]
                    )
                        ? trim(
                            (string)
                                $charge[
                                    'source_reference'
                                ]
                        )
                        : null,
            ];

            $totalCharge +=
                $amount;
        }

        $totalCharge =
            round(
                $totalCharge,
                4
            );

        $items =
            $eligibility[
                'items'
            ];

        $allocationAmounts =
            $this->allocate(
                $method,
                $totalCharge,
                $items,
                $data[
                    'manual_allocations'
                ]
                ?? [],
            );

        $uuid =
            Str::uuid()
                ->toString();

        $documentNumber =
            'LC-'
            .
            now()->format(
                'Ymd'
            )
            .
            '-'
            .
            strtoupper(
                substr(
                    str_replace(
                        '-',
                        '',
                        $uuid
                    ),
                    0,
                    10
                )
            );

        $idempotencyKey =
            'finance:landed-cost:'
            .
            $uuid;

        DB::transaction(
            function () use (
                $tenantId,
                $actorId,
                $method,
                $businessDate,
                $receipt,
                $items,
                $allocationAmounts,
                $normalisedCharges,
                $totalCharge,
                $uuid,
                $documentNumber,
                $idempotencyKey,
                $data
            ): void {
                $now =
                    now();

                $documentId =
                    DB::table(
                        'finance_landed_cost_documents'
                    )
                        ->insertGetId([
                            'uuid' =>
                                $uuid,

                            'tenant_id' =>
                                $tenantId,

                            'branch_id' =>
                                $receipt[
                                    'branch_id'
                                ],

                            'pharmaco_goods_receipt_id' =>
                                $receipt[
                                    'id'
                                ],

                            'document_number' =>
                                $documentNumber,

                            'business_date' =>
                                $businessDate,

                            'allocation_method' =>
                                $method,

                            'status' =>
                                'draft',

                            'currency_code' =>
                                'RWF',

                            'exchange_rate' =>
                                1,

                            'total_charge_amount' =>
                                $totalCharge,

                            'created_by' =>
                                $actorId,

                            'posted_by' =>
                                null,

                            'finance_journal_entry_id' =>
                                null,

                            'finance_posted_at' =>
                                null,

                            'idempotency_key' =>
                                $idempotencyKey,

                            'notes' =>
                                $data[
                                    'notes'
                                ]
                                ?? null,

                            'metadata' =>
                                json_encode([
                                    'release' =>
                                        self::RELEASE,

                                    'posting_policy' =>
                                        'receipt_specific_batch_pre_issue_only',

                                    'historical_cogs_estimation' =>
                                        false,

                                    'mixed_batch_cost_layer_allowed' =>
                                        false,

                                    'goods_receipt_finance_journal_entry_id' =>
                                        $receipt[
                                            'finance_journal_entry_id'
                                        ],
                                ]),

                            'created_at' =>
                                $now,

                            'updated_at' =>
                                $now,
                        ]);

                foreach (
                    $normalisedCharges
                    as $charge
                ) {
                    DB::table(
                        'finance_landed_cost_charges'
                    )
                        ->insert([
                            'uuid' =>
                                Str::uuid()
                                    ->toString(),

                            'finance_landed_cost_document_id' =>
                                $documentId,

                            'tenant_id' =>
                                $tenantId,

                            'branch_id' =>
                                $receipt[
                                    'branch_id'
                                ],

                            'charge_type' =>
                                $charge[
                                    'charge_type'
                                ],

                            'description' =>
                                $charge[
                                    'description'
                                ],

                            'amount' =>
                                $charge[
                                    'amount'
                                ],

                            'source_supplier_id' =>
                                $charge[
                                    'source_supplier_id'
                                ],

                            'source_reference' =>
                                $charge[
                                    'source_reference'
                                ],

                            'metadata' =>
                                json_encode([
                                    'release' =>
                                        self::RELEASE,
                                ]),

                            'created_at' =>
                                $now,

                            'updated_at' =>
                                $now,
                        ]);
                }

                foreach (
                    $items
                    as $index => $item
                ) {
                    DB::table(
                        'finance_landed_cost_allocations'
                    )
                        ->insert([
                            'uuid' =>
                                Str::uuid()
                                    ->toString(),

                            'finance_landed_cost_document_id' =>
                                $documentId,

                            'tenant_id' =>
                                $tenantId,

                            'branch_id' =>
                                $receipt[
                                    'branch_id'
                                ],

                            'pharmaco_goods_receipt_item_id' =>
                                $item[
                                    'id'
                                ],

                            'stock_batch_id' =>
                                $item[
                                    'stock_batch_id'
                                ],

                            'stock_movement_id' =>
                                $item[
                                    'stock_movement_id'
                                ],

                            'product_id' =>
                                $item[
                                    'product_id'
                                ],

                            'stock_location_id' =>
                                $item[
                                    'stock_location_id'
                                ],

                            'basis_value' =>
                                $method === 'quantity'
                                    ? $item[
                                        'quantity_received'
                                    ]
                                    : $item[
                                        'purchase_value_basis'
                                    ],

                            'allocated_amount' =>
                                $allocationAmounts[
                                    $index
                                ],

                            'quantity_received' =>
                                $item[
                                    'quantity_received'
                                ],

                            'batch_quantity_snapshot' =>
                                $item[
                                    'batch_quantity_on_hand'
                                ],

                            'unit_cost_before' =>
                                $item[
                                    'batch_resolved_unit_cost'
                                ],

                            'unit_cost_after' =>
                                null,

                            'status' =>
                                'planned',

                            'applied_stock_movement_id' =>
                                null,

                            'metadata' =>
                                json_encode([
                                    'release' =>
                                        self::RELEASE,

                                    'goods_receipt_item_uuid' =>
                                        $item[
                                            'uuid'
                                        ],

                                    'batch_target_movement_ids' =>
                                        $item[
                                            'batch_target_movement_ids'
                                        ],

                                    'batch_latest_movement_id_at_draft' =>
                                        $item[
                                            'batch_latest_movement_id'
                                        ],

                                    'batch_raw_unit_cost_before' =>
                                        $item[
                                            'batch_raw_unit_cost'
                                        ],

                                    'batch_inferred_unit_cost_before' =>
                                        $item[
                                            'batch_inferred_unit_cost'
                                        ],

                                    'preserve_original_unit_cost' =>
                                        true,
                                ]),

                            'created_at' =>
                                $now,

                            'updated_at' =>
                                $now,
                        ]);
                }

                $this->action(
                    $documentId,
                    $tenantId,
                    $actorId,
                    'draft_created',
                    'Landed Cost draft created.',
                    [
                        'allocation_method' =>
                            $method,

                        'total_charge_amount' =>
                            $totalCharge,
                    ]
                );
            }
        );

        return $this->detail(
            $tenantId,
            $branchScope,
            $uuid
        );
    }

    public function post(
        int $tenantId,
        ?int $branchScope,
        int $actorId,
        string $uuid,
    ): array {
        return DB::transaction(
            function () use (
                $tenantId,
                $branchScope,
                $actorId,
                $uuid
            ): array {
                $query =
                    DB::table(
                        'finance_landed_cost_documents'
                    )
                        ->where(
                            'tenant_id',
                            $tenantId
                        )
                        ->where(
                            'uuid',
                            $uuid
                        );

                if ($branchScope !== null) {
                    $query->where(
                        'branch_id',
                        $branchScope
                    );
                }

                $document =
                    $query
                        ->lockForUpdate()
                        ->first();

                if (! $document) {
                    $this->fail(
                        'landed_cost',
                        'Landed Cost document was not found.'
                    );
                }

                if (
                    strtolower(
                        (string)
                            $document->status
                    )
                    === 'posted'
                ) {
                    $result =
                        $this->detail(
                            $tenantId,
                            $branchScope,
                            $uuid
                        );

                    $result[
                        'already_posted'
                    ] = true;

                    return $result;
                }

                if (
                    strtolower(
                        (string)
                            $document->status
                    )
                    !== 'draft'
                ) {
                    $this->fail(
                        'status',
                        'Only a draft Landed Cost document may be posted.'
                    );
                }

                if (((int)
                        $document->created_by
                    === $actorId)
            && ! $this->canSelfPostLandedCostAsAdminOrOwner(
                (int) $document->tenant_id,
                $document->branch_id !== null
                    ? (int) $document->branch_id
                    : null,
                (int) $actorId
            )) {
                    $this->fail(
                        'maker_checker',
                        'The maker cannot post their own Landed Cost document.'
                    );
                }

                $receipt =
                    DB::table(
                        'pharmaco_goods_receipts'
                    )
                        ->where(
                            'tenant_id',
                            $tenantId
                        )
                        ->where(
                            'id',
                            $document
                                ->pharmaco_goods_receipt_id
                        )
                        ->first();

                if (! $receipt) {
                    $this->fail(
                        'goods_receipt',
                        'Linked Goods Receipt no longer exists.'
                    );
                }

                /*
                 * Re-run all receipt/batch provenance controls immediately
                 * before Finance posting.
                 */
                $eligibility =
                    $this->eligibility(
                        $tenantId,
                        $branchScope,
                        (string)
                            $receipt->uuid
                    );

                $currentItems = [];

                foreach (
                    $eligibility[
                        'items'
                    ]
                    as $item
                ) {
                    $currentItems[
                        $item[
                            'id'
                        ]
                    ] = $item;
                }

                $allocations =
                    DB::table(
                        'finance_landed_cost_allocations'
                    )
                        ->where(
                            'tenant_id',
                            $tenantId
                        )
                        ->where(
                            'finance_landed_cost_document_id',
                            $document->id
                        )
                        ->orderBy('id')
                        ->lockForUpdate()
                        ->get();

                if ($allocations->isEmpty()) {
                    $this->fail(
                        'allocations',
                        'Landed Cost document has no allocation rows.'
                    );
                }

                $batchAllocated = [];

                foreach (
                    $allocations
                    as $allocation
                ) {
                    $current =
                        $currentItems[
                            (int)
                                $allocation
                                    ->pharmaco_goods_receipt_item_id
                        ]
                        ?? null;

                    if (! $current) {
                        $this->fail(
                            'allocations',
                            'Goods Receipt allocation lineage changed after the Landed Cost draft was created.'
                        );
                    }

                    if (
                        abs(
                            (float)
                                $allocation
                                    ->batch_quantity_snapshot
                            -
                            (float)
                                $current[
                                    'batch_quantity_on_hand'
                                ]
                        )
                        >
                        0.0001
                    ) {
                        $this->fail(
                            'stock_batch',
                            'Batch quantity changed after the Landed Cost draft was created.'
                        );
                    }

                    if (
                        abs(
                            (float)
                                $allocation
                                    ->unit_cost_before
                            -
                            (float)
                                $current[
                                    'batch_resolved_unit_cost'
                                ]
                        )
                        >
                        0.0001
                    ) {
                        $this->fail(
                            'stock_batch',
                            'Batch cost changed after the Landed Cost draft was created.'
                        );
                    }

                    $batchId =
                        (int)
                            $allocation
                                ->stock_batch_id;

                    if (! isset(
                        $batchAllocated[
                            $batchId
                        ]
                    )) {
                        $batchAllocated[
                            $batchId
                        ] = [
                            'amount' =>
                                0.0,

                            'product_id' =>
                                (int)
                                    $allocation
                                        ->product_id,

                            'stock_location_id' =>
                                $allocation
                                    ->stock_location_id
                                    !== null
                                ? (int)
                                    $allocation
                                        ->stock_location_id
                                : null,

                            'quantity' =>
                                (float)
                                    $allocation
                                        ->batch_quantity_snapshot,

                            'resolved_cost' =>
                                (float)
                                    $allocation
                                        ->unit_cost_before,
                        ];
                    }

                    $batchAllocated[
                        $batchId
                    ][
                        'amount'
                    ] +=
                        (float)
                            $allocation
                                ->allocated_amount;
                }

                $charges =
                    DB::table(
                        'finance_landed_cost_charges'
                    )
                        ->where(
                            'tenant_id',
                            $tenantId
                        )
                        ->where(
                            'finance_landed_cost_document_id',
                            $document->id
                        )
                        ->orderBy('id')
                        ->get();

                if ($charges->isEmpty()) {
                    $this->fail(
                        'charges',
                        'Landed Cost document has no charge rows.'
                    );
                }

                $lines = [];

                foreach (
                    $batchAllocated
                    as $batchId => $batch
                ) {
                    $amount =
                        round(
                            (float)
                                $batch[
                                    'amount'
                                ],
                            4
                        );

                    if ($amount <= 0) {
                        continue;
                    }

                    $lines[] =
                        new FinanceJournalLinePayload(
                            mappingKey:
                                self::INVENTORY_MAPPING,

                            debit:
                                $amount,

                            credit:
                                0,

                            description:
                                'Landed Cost capitalization to inventory batch '
                                .
                                $batchId,

                            lineType:
                                'landed_cost_inventory',

                            branchId:
                                (int)
                                    $document
                                        ->branch_id,

                            productId:
                                $batch[
                                    'product_id'
                                ],

                            stockLocationId:
                                $batch[
                                    'stock_location_id'
                                ],

                            metadata: [
                                'landed_cost_document_uuid' =>
                                    $uuid,

                                'stock_batch_id' =>
                                    $batchId,
                            ],
                        );
                }

                foreach (
                    $charges
                    as $charge
                ) {
                    $amount =
                        round(
                            (float)
                                $charge->amount,
                            4
                        );

                    $lines[] =
                        new FinanceJournalLinePayload(
                            mappingKey:
                                self::ACCRUAL_MAPPING,

                            debit:
                                0,

                            credit:
                                $amount,

                            description:
                                'Landed Cost accrual: '
                                .
                                $charge
                                    ->description,

                            lineType:
                                'landed_cost_accrual',

                            branchId:
                                (int)
                                    $document
                                        ->branch_id,

                            supplierId:
                                $charge
                                    ->source_supplier_id
                                    !== null
                                ? (int)
                                    $charge
                                        ->source_supplier_id
                                : null,

                            metadata: [
                                'landed_cost_document_uuid' =>
                                    $uuid,

                                'charge_type' =>
                                    $charge
                                        ->charge_type,

                                'source_reference' =>
                                    $charge
                                        ->source_reference,
                            ],
                        );
                }

                $postingResult =
                    $this
                        ->postingService
                        ->post(
                            new FinancePostingPayload(
                                tenantId:
                                    $tenantId,

                                branchId:
                                    (int)
                                        $document
                                            ->branch_id,

                                businessDate:
                                    (string)
                                        $document
                                            ->business_date,

                                sourceModule:
                                    'finance',

                                sourceType:
                                    'landed_cost_allocation',

                                sourceId:
                                    (string)
                                        $document
                                            ->uuid,

                                idempotencyKey:
                                    (string)
                                        $document
                                            ->idempotency_key,

                                lines:
                                    $lines,

                                currencyCode:
                                    'RWF',

                                exchangeRate:
                                    1,

                                memo:
                                    'Landed Cost '
                                    .
                                    $document
                                        ->document_number,

                                createdBy:
                                    $actorId,

                                sourceSnapshot: [
                                    'goods_receipt_id' =>
                                        (int)
                                            $document
                                                ->pharmaco_goods_receipt_id,

                                    'total_charge_amount' =>
                                        (float)
                                            $document
                                                ->total_charge_amount,

                                    'allocation_method' =>
                                        $document
                                            ->allocation_method,

                                    'posting_policy' =>
                                        'receipt_specific_batch_pre_issue_only',
                                ],

                                metadata: [
                                    'release' =>
                                        self::RELEASE,

                                    'maker_id' =>
                                        (int)
                                            $document
                                                ->created_by,

                                    'checker_id' =>
                                        $actorId,

                                    'historical_cogs_estimation' =>
                                        false,

                                    'mixed_batch_cost_layer_allowed' =>
                                        false,
                                ],
                            )
                        );

                if (
                    $postingResult
                    instanceof FinancePostingLog
                ) {
                    $this->fail(
                        'finance_posting',
                        $postingResult
                            ->failure_message
                        ??
                        'Landed Cost Finance posting was quarantined.'
                    );
                }

                if (
                    ! $postingResult
                    instanceof FinanceJournalEntry
                ) {
                    $this->fail(
                        'finance_posting',
                        'Unexpected Finance posting result.'
                    );
                }

                $now =
                    now();

                foreach (
                    $batchAllocated
                    as $batchId => $batchAllocatedRow
                ) {
                    $amount =
                        round(
                            (float)
                                $batchAllocatedRow[
                                    'amount'
                                ],
                            4
                        );

                    if ($amount <= 0) {
                        continue;
                    }

                    $batch =
                        DB::table(
                            'stock_batches'
                        )
                            ->where(
                                'tenant_id',
                                $tenantId
                            )
                            ->where(
                                'branch_id',
                                $document
                                    ->branch_id
                            )
                            ->where(
                                'id',
                                $batchId
                            )
                            ->lockForUpdate()
                            ->first();

                    if (! $batch) {
                        $this->fail(
                            'stock_batch',
                            'Stock Batch disappeared during Landed Cost posting.'
                        );
                    }

                    $quantity =
                        round(
                            (float)
                                $batch
                                    ->quantity_on_hand,
                            4
                        );

                    $rawCost =
                        $batch->unit_cost
                        !== null
                            ? round(
                                (float)
                                    $batch
                                        ->unit_cost,
                                4
                            )
                            : 0.0;

                    $inferredCost =
                        $batch->inferred_unit_cost
                        !== null
                            ? round(
                                (float)
                                    $batch
                                        ->inferred_unit_cost,
                                4
                            )
                            : 0.0;

                    $currentResolvedCost =
                        $inferredCost > 0
                            ? $inferredCost
                            : $rawCost;

                    if (
                        abs(
                            $quantity
                            -
                            (float)
                                $batchAllocatedRow[
                                    'quantity'
                                ]
                        )
                        > 0.0001
                    ) {
                        $this->fail(
                            'stock_batch',
                            'Stock quantity changed while Landed Cost was posting.'
                        );
                    }

                    if (
                        abs(
                            $currentResolvedCost
                            -
                            (float)
                                $batchAllocatedRow[
                                    'resolved_cost'
                                ]
                        )
                        > 0.0001
                    ) {
                        $this->fail(
                            'stock_batch',
                            'Stock cost changed while Landed Cost was posting.'
                        );
                    }

                    $newUnitCost =
                        round(
                            (
                                (
                                    $quantity
                                    *
                                    $currentResolvedCost
                                )
                                +
                                $amount
                            )
                            /
                            $quantity,
                            4
                        );

                    $beforeMetadata = [
                        'raw_unit_cost' =>
                            $rawCost,

                        'inferred_unit_cost' =>
                            $inferredCost,

                        'original_unit_cost' =>
                            $batch
                                ->original_unit_cost,

                        'cost_source' =>
                            $batch
                                ->cost_source,

                        'cost_adjustment_method' =>
                            $batch
                                ->cost_adjustment_method,
                    ];

                    DB::table(
                        'stock_batches'
                    )
                        ->where(
                            'id',
                            $batchId
                        )
                        ->where(
                            'tenant_id',
                            $tenantId
                        )
                        ->update([
                            'unit_cost' =>
                                $newUnitCost,

                            /*
                             * InventoryCostResolver prioritizes
                             * inferred_unit_cost. The approved landed cost
                             * must become the authoritative unit_cost.
                             */
                            'inferred_unit_cost' =>
                                null,

                            /*
                             * Original receipt cost remains immutable.
                             */
                            'cost_source' =>
                                'landed_cost',

                            'cost_adjustment_method' =>
                                'f12_landed_cost',

                            'cost_resolution_notes' =>
                                'Authoritative Landed Cost capitalization via '
                                .
                                $document
                                    ->document_number,

                            'cost_resolved_at' =>
                                $now,

                            'updated_at' =>
                                $now,
                        ]);

                    $movementId =
                        DB::table(
                            'stock_movements'
                        )
                            ->insertGetId([
                                'uuid' =>
                                    Str::uuid()
                                        ->toString(),

                                'tenant_id' =>
                                    $tenantId,

                                'branch_id' =>
                                    (int)
                                        $document
                                            ->branch_id,

                                'stock_location_id' =>
                                    (int)
                                        $batch
                                            ->stock_location_id,

                                'product_id' =>
                                    (int)
                                        $batch
                                            ->product_id,

                                'stock_batch_id' =>
                                    $batchId,

                                'movement_type' =>
                                    'landed_cost_adjustment',

                                'quantity' =>
                                    0,

                                'running_balance' =>
                                    $quantity,

                                'reference_type' =>
                                    'finance_landed_cost',

                                'reference_number' =>
                                    $document
                                        ->document_number,

                                'reason' =>
                                    'Landed Cost capitalization',

                                'performed_by' =>
                                    $actorId,

                                'occurred_at' =>
                                    $now,

                                'metadata' =>
                                    json_encode([
                                        'release' =>
                                            self::RELEASE,

                                        'landed_cost_document_uuid' =>
                                            $uuid,

                                        'finance_journal_entry_id' =>
                                            $postingResult
                                                ->id,

                                        'allocated_amount' =>
                                            $amount,

                                        'unit_cost_before' =>
                                            $currentResolvedCost,

                                        'unit_cost_after' =>
                                            $newUnitCost,

                                        'quantity_changed' =>
                                            false,

                                        'before_cost_provenance' =>
                                            $beforeMetadata,
                                    ]),

                                'created_at' =>
                                    $now,

                                'updated_at' =>
                                    $now,

                                'pos_session_id' =>
                                    null,

                                'business_date' =>
                                    $document
                                        ->business_date,

                                'entry_mode' =>
                                    'live',

                                'historical_approval_id' =>
                                    null,
                            ]);

                    DB::table(
                        'finance_landed_cost_allocations'
                    )
                        ->where(
                            'tenant_id',
                            $tenantId
                        )
                        ->where(
                            'finance_landed_cost_document_id',
                            $document->id
                        )
                        ->where(
                            'stock_batch_id',
                            $batchId
                        )
                        ->update([
                            'unit_cost_after' =>
                                $newUnitCost,

                            'status' =>
                                'applied',

                            'applied_stock_movement_id' =>
                                $movementId,

                            'updated_at' =>
                                $now,
                        ]);
                }

                $metadata =
                    $this->decode(
                        $document
                            ->metadata
                    );

                $metadata[
                    'finance_posted_by'
                ] =
                    $actorId;

                $metadata[
                    'finance_journal_entry_id'
                ] =
                    (int)
                        $postingResult
                            ->id;

                DB::table(
                    'finance_landed_cost_documents'
                )
                    ->where(
                        'id',
                        $document->id
                    )
                    ->where(
                        'tenant_id',
                        $tenantId
                    )
                    ->update([
                        'status' =>
                            'posted',

                        'posted_by' =>
                            $actorId,

                        'finance_journal_entry_id' =>
                            $postingResult
                                ->id,

                        'finance_posted_at' =>
                            $now,

                        'metadata' =>
                            json_encode(
                                $metadata
                            ),

                        'updated_at' =>
                            $now,
                    ]);

                $this->action(
                    (int)
                        $document->id,
                    $tenantId,
                    $actorId,
                    'posted',
                    'Landed Cost capitalized and posted to Finance.',
                    [
                        'journal_entry_id' =>
                            (int)
                                $postingResult
                                    ->id,

                        'total_charge_amount' =>
                            (float)
                                $document
                                    ->total_charge_amount,
                    ]
                );

                $result =
                    $this->detail(
                        $tenantId,
                        $branchScope,
                        $uuid
                    );

                $result[
                    'already_posted'
                ] = false;

                return $result;
            }
        );
    }

    private function allocate(
        string $method,
        float $total,
        array $items,
        array $manualAllocations,
    ): array {
        if ($method === 'manual') {
            $manual = [];

            foreach (
                $manualAllocations
                as $row
            ) {
                $uuid =
                    trim(
                        (string)
                            (
                                $row[
                                    'receipt_item_uuid'
                                ]
                                ?? ''
                            )
                    );

                if ($uuid === '') {
                    continue;
                }

                if (isset($manual[$uuid])) {
                    $this->fail(
                        'manual_allocations',
                        'Manual allocation contains duplicate Goods Receipt Item.'
                    );
                }

                $manual[$uuid] =
                    round(
                        (float)
                            (
                                $row[
                                    'amount'
                                ]
                                ?? 0
                            ),
                        4
                    );
            }

            $result = [];
            $sum = 0.0;

            foreach ($items as $item) {
                $amount =
                    $manual[
                        $item[
                            'uuid'
                        ]
                    ]
                    ?? 0.0;

                if ($amount < 0) {
                    $this->fail(
                        'manual_allocations',
                        'Manual Landed Cost allocation cannot be negative.'
                    );
                }

                $result[] =
                    $amount;

                $sum +=
                    $amount;
            }

            if (
                abs(
                    round(
                        $sum,
                        4
                    )
                    -
                    round(
                        $total,
                        4
                    )
                )
                > 0.0001
            ) {
                $this->fail(
                    'manual_allocations',
                    'Manual allocation total must exactly equal total Landed Cost charges.'
                );
            }

            return $result;
        }

        $basis = [];
        $basisTotal = 0.0;

        foreach ($items as $item) {
            $value =
                $method === 'quantity'
                    ? (float)
                        $item[
                            'quantity_received'
                        ]
                    : (float)
                        $item[
                            'purchase_value_basis'
                        ];

            if ($value <= 0) {
                $this->fail(
                    'allocation_method',
                    'Automatic Landed Cost allocation requires positive allocation basis.'
                );
            }

            $basis[] =
                $value;

            $basisTotal +=
                $value;
        }

        if ($basisTotal <= 0) {
            $this->fail(
                'allocation_method',
                'Landed Cost allocation basis is zero.'
            );
        }

        $result = [];
        $allocated = 0.0;

        $lastIndex =
            count($basis)
            -
            1;

        foreach (
            $basis
            as $index => $value
        ) {
            if ($index === $lastIndex) {
                $amount =
                    round(
                        $total
                        -
                        $allocated,
                        4
                    );
            } else {
                $amount =
                    round(
                        $total
                        *
                        (
                            $value
                            /
                            $basisTotal
                        ),
                        4
                    );

                $allocated +=
                    $amount;
            }

            $result[] =
                $amount;
        }

        return $result;
    }

    private function action(
        int $documentId,
        int $tenantId,
        int $actorId,
        string $action,
        ?string $comment,
        array $metadata = [],
    ): void {
        DB::table(
            'finance_landed_cost_actions'
        )
            ->insert([
                'uuid' =>
                    Str::uuid()
                        ->toString(),

                'finance_landed_cost_document_id' =>
                    $documentId,

                'tenant_id' =>
                    $tenantId,

                'actor_id' =>
                    $actorId,

                'action' =>
                    $action,

                'comment' =>
                    $comment,

                'metadata' =>
                    json_encode(
                        array_merge(
                            [
                                'release' =>
                                    self::RELEASE,
                            ],
                            $metadata
                        )
                    ),

                'created_at' =>
                    now(),

                'updated_at' =>
                    now(),
            ]);
    }

    private function decode(
        mixed $value
    ): array {
        if (is_array($value)) {
            return $value;
        }

        if (
            $value === null
            ||
            $value === ''
        ) {
            return [];
        }

        $decoded =
            json_decode(
                (string)
                    $value,
                true
            );

        return is_array($decoded)
            ? $decoded
            : [];
    }

    private function fail(
        string $field,
        string $message,
    ): never {
        throw ValidationException::withMessages([
            $field => [
                $message,
            ],
        ]);
    }


    /**
     * Admin/Owner exception to the normal Landed Cost maker/checker rule.
     *
     * The exception is deliberately narrow:
     * - explicit administrative/owner role only;
     * - active role assignment;
     * - active role;
     * - existing finance.journal.approve permission;
     * - current tenant/branch scope.
     *
     * Standard Finance users continue to require a different approver.
     */
    private function canSelfPostLandedCostAsAdminOrOwner(
        int $tenantId,
        ?int $branchId,
        int $actorId
    ): bool {
        $allowedRoleCodes =
            \App\Support\MakerCheckerExemptionPolicy::roleCodes();

        return \Illuminate\Support\Facades\DB::table('role_user as ru')
            ->join('roles as r', 'r.id', '=', 'ru.role_id')
            ->join('permission_role as pr', 'pr.role_id', '=', 'r.id')
            ->join('permissions as p', 'p.id', '=', 'pr.permission_id')
            ->where('ru.user_id', $actorId)
            ->where('ru.status', 'active')
            ->where('r.status', 'active')
            ->where('p.status', 'active')
            ->where('p.code', 'finance.journal.approve')
            ->whereIn('r.code', $allowedRoleCodes)
            ->where(function ($query) use ($tenantId) {
                $query
                    ->whereNull('ru.tenant_id')
                    ->orWhere('ru.tenant_id', $tenantId);
            })
            ->where(function ($query) use ($branchId) {
                $query->whereNull('ru.branch_id');

                if ($branchId !== null) {
                    $query->orWhere('ru.branch_id', $branchId);
                }
            })
            ->exists();
    }

}
