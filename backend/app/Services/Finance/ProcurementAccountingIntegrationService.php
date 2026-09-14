<?php

namespace App\Services\Finance;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use RuntimeException;

final class ProcurementAccountingIntegrationService
{
    public const RELEASE =
        'AQUILA_FINANCE_F4_R4_R3_PROCUREMENT_CONTROLLER_INTEGRATION';

    public function __construct(
        private readonly ProcurementAccountingWorkflowService $workflow,
    ) {
    }

    public function captureProductReceipt(
        int $stockMovementId,
        int $purchaseOrderItemId,
        ?int $actorId = null,
    ): array {
        return DB::transaction(
            function () use (
                $stockMovementId,
                $purchaseOrderItemId,
                $actorId,
            ): array {
                $movement =
                    DB::table('stock_movements')
                        ->where('id', $stockMovementId)
                        ->lockForUpdate()
                        ->first();

                if (! $movement) {
                    throw ValidationException::withMessages([
                        'stock_movement' => [
                            'Stock receipt movement was not found.',
                        ],
                    ]);
                }

                if (
                    strtolower(
                        (string) $movement->movement_type
                    ) !== 'stock_received'
                ) {
                    throw ValidationException::withMessages([
                        'stock_movement' => [
                            'Only a stock_received movement may create a Goods Receipt.',
                        ],
                    ]);
                }

                $poItem =
                    DB::table('pharmaco_purchase_order_items')
                        ->where('id', $purchaseOrderItemId)
                        ->lockForUpdate()
                        ->first();

                if (! $poItem) {
                    throw ValidationException::withMessages([
                        'purchase_order_item' => [
                            'Purchase Order item was not found.',
                        ],
                    ]);
                }

                $po =
                    DB::table('pharmaco_purchase_orders')
                        ->where(
                            'id',
                            $poItem->pharmaco_purchase_order_id
                        )
                        ->lockForUpdate()
                        ->first();

                if (! $po) {
                    throw ValidationException::withMessages([
                        'purchase_order' => [
                            'Purchase Order was not found.',
                        ],
                    ]);
                }

                $batch =
                    DB::table('stock_batches')
                        ->where(
                            'id',
                            $movement->stock_batch_id
                        )
                        ->lockForUpdate()
                        ->first();

                if (! $batch) {
                    throw ValidationException::withMessages([
                        'stock_batch' => [
                            'Stock batch was not found.',
                        ],
                    ]);
                }

                $tenantId =
                    (int) $movement->tenant_id;

                $branchId =
                    (int) $movement->branch_id;

                $productId =
                    (int) $movement->product_id;

                if (
                    $tenantId !== (int) $po->tenant_id
                    ||
                    $tenantId !== (int) $poItem->tenant_id
                    ||
                    $tenantId !== (int) $batch->tenant_id
                ) {
                    throw ValidationException::withMessages([
                        'tenant' => [
                            'Stock movement, batch and Purchase Order tenant lineage must agree.',
                        ],
                    ]);
                }

                if (
                    $branchId <= 0
                    ||
                    $branchId !== (int) $po->branch_id
                ) {
                    throw ValidationException::withMessages([
                        'branch' => [
                            'Stock receipt branch must agree with the Purchase Order branch.',
                        ],
                    ]);
                }

                if (
                    isset($batch->branch_id)
                    &&
                    $batch->branch_id !== null
                    &&
                    $branchId !== (int) $batch->branch_id
                ) {
                    throw ValidationException::withMessages([
                        'branch' => [
                            'Stock batch branch does not agree with the stock receipt branch.',
                        ],
                    ]);
                }

                if (
                    $productId <= 0
                    ||
                    $productId !== (int) $poItem->product_id
                    ||
                    $productId !== (int) $batch->product_id
                ) {
                    throw ValidationException::withMessages([
                        'product' => [
                            'Product lineage does not agree across PO item, batch and movement.',
                        ],
                    ]);
                }

                if (
                    (int) $movement->stock_location_id
                    !==
                    (int) $batch->stock_location_id
                ) {
                    throw ValidationException::withMessages([
                        'stock_location' => [
                            'Stock batch location does not agree with stock movement location.',
                        ],
                    ]);
                }

                $quantity =
                    round(
                        (float) $movement->quantity,
                        3
                    );

                if ($quantity <= 0) {
                    throw ValidationException::withMessages([
                        'quantity' => [
                            'Goods Receipt quantity must be positive.',
                        ],
                    ]);
                }

                $unitCost =
                    round(
                        (float)
                        (
                            $batch->unit_cost
                            ?: $poItem->unit_cost
                        ),
                        4
                    );

                if ($unitCost <= 0) {
                    throw ValidationException::withMessages([
                        'unit_cost' => [
                            'A positive receipt unit cost is required for GRNI accounting.',
                        ],
                    ]);
                }

                $lineValue =
                    round(
                        $quantity
                        *
                        $unitCost,
                        2
                    );

                $existingItem =
                    DB::table(
                        'pharmaco_goods_receipt_items'
                    )
                        ->where(
                            'stock_movement_id',
                            $stockMovementId
                        )
                        ->lockForUpdate()
                        ->first();

                if ($existingItem) {
                    if (
                        (int)
                        $existingItem
                            ->pharmaco_purchase_order_item_id
                        !==
                        $purchaseOrderItemId
                    ) {
                        throw new RuntimeException(
                            'Existing Goods Receipt item points to another Purchase Order item.'
                        );
                    }

                    $receipt =
                        DB::table(
                            'pharmaco_goods_receipts'
                        )
                            ->where(
                                'id',
                                $existingItem
                                    ->pharmaco_goods_receipt_id
                            )
                            ->lockForUpdate()
                            ->first();

                    if (! $receipt) {
                        throw new RuntimeException(
                            'Existing Goods Receipt item has no parent receipt.'
                        );
                    }

                    $journal =
                        $this
                            ->workflow
                            ->postGoodsReceipt(
                                (int) $receipt->id,
                                $actorId
                            );

                    $receipt =
                        DB::table(
                            'pharmaco_goods_receipts'
                        )
                            ->where(
                                'id',
                                $receipt->id
                            )
                            ->first();

                    return [
                        'goods_receipt_id' =>
                            (int) $receipt->id,

                        'goods_receipt_number' =>
                            (string) $receipt->receipt_number,

                        'finance_journal_entry_id' =>
                            (int) $journal->id,

                        'accounting_status' =>
                            (string)
                            $receipt->accounting_status,

                        'idempotent' =>
                            true,
                    ];
                }

                $receiptNumber =
                    'F4-GRN-M'
                    .
                    $stockMovementId;

                $idempotencyKey =
                    'procurement-grn-movement-'
                    .
                    $stockMovementId;

                $businessDate =
                    substr(
                        (string)
                        (
                            $movement->occurred_at
                            ?: now()->toDateTimeString()
                        ),
                        0,
                        10
                    );

                $timestamp =
                    now()->toDateTimeString();

                $receiptId =
                    (int)
                    DB::table(
                        'pharmaco_goods_receipts'
                    )
                        ->insertGetId([
                            'uuid' =>
                                (string) Str::uuid(),

                            'tenant_id' =>
                                $tenantId,

                            'branch_id' =>
                                $branchId,

                            'pharmaco_purchase_order_id' =>
                                (int) $po->id,

                            'pharmaco_supplier_id' =>
                                (int)
                                $po->pharmaco_supplier_id,

                            'stock_location_id' =>
                                (int)
                                $movement->stock_location_id,

                            'receipt_number' =>
                                $receiptNumber,

                            'source_type' =>
                                'core_products',

                            'status' =>
                                'approved',

                            'receipt_date' =>
                                $businessDate,

                            'subtotal_amount' =>
                                $lineValue,

                            /*
                             * VAT is recognized from the Supplier Bill.
                             * GRNI represents inventory receipt cost only.
                             */
                            'tax_amount' =>
                                0,

                            'total_amount' =>
                                $lineValue,

                            'currency_code' =>
                                'RWF',

                            'exchange_rate' =>
                                1,

                            'accounting_status' =>
                                'unposted',

                            'received_by' =>
                                $actorId,

                            'approved_by' =>
                                $actorId,

                            'approved_at' =>
                                $timestamp,

                            'finance_journal_entry_id' =>
                                null,

                            'finance_posted_at' =>
                                null,

                            'idempotency_key' =>
                                $idempotencyKey,

                            'notes' =>
                                'Automatically captured from a PO-linked medicine stock receipt.',

                            'metadata' =>
                                json_encode(
                                    [
                                        'release' =>
                                            self::RELEASE,

                                        'source' =>
                                            'product_inventory_receive_stock',

                                        'stock_movement_id' =>
                                            $stockMovementId,

                                        'purchase_order_item_id' =>
                                            $purchaseOrderItemId,

                                        'grni_policy' =>
                                            'inventory_cost_on_receipt_vat_on_supplier_bill',
                                    ],
                                    JSON_UNESCAPED_SLASHES
                                ),

                            'created_at' =>
                                $timestamp,

                            'updated_at' =>
                                $timestamp,
                        ]);

                DB::table(
                    'pharmaco_goods_receipt_items'
                )
                    ->insert([
                        'uuid' =>
                            (string) Str::uuid(),

                        'tenant_id' =>
                            $tenantId,

                        'branch_id' =>
                            $branchId,

                        'pharmaco_goods_receipt_id' =>
                            $receiptId,

                        'pharmaco_purchase_order_item_id' =>
                            $purchaseOrderItemId,

                        'pharmaco_general_purchase_order_item_id' =>
                            null,

                        'product_id' =>
                            $productId,

                        'pharmaco_general_item_id' =>
                            null,

                        'description' =>
                            'Medicine stock received against PO '
                            .
                            $po->po_number,

                        'batch_number' =>
                            $batch->batch_number,

                        'expiry_date' =>
                            $batch->expiry_date,

                        'quantity_received' =>
                            $quantity,

                        'unit_cost' =>
                            $unitCost,

                        'tax_amount' =>
                            0,

                        'line_total' =>
                            $lineValue,

                        'stock_batch_id' =>
                            (int) $batch->id,

                        'stock_movement_id' =>
                            $stockMovementId,

                        'status' =>
                            'received',

                        'metadata' =>
                            json_encode(
                                [
                                    'release' =>
                                        self::RELEASE,

                                    'stock_movement_id' =>
                                        $stockMovementId,

                                    'stock_batch_id' =>
                                        (int) $batch->id,

                                    'batch_number' =>
                                        $batch->batch_number,

                                    'expiry_date' =>
                                        $batch->expiry_date,
                                ],
                                JSON_UNESCAPED_SLASHES
                            ),

                        'created_at' =>
                            $timestamp,

                        'updated_at' =>
                            $timestamp,
                    ]);

                $journal =
                    $this
                        ->workflow
                        ->postGoodsReceipt(
                            $receiptId,
                            $actorId
                        );

                $receipt =
                    DB::table(
                        'pharmaco_goods_receipts'
                    )
                        ->where(
                            'id',
                            $receiptId
                        )
                        ->first();

                if (! $receipt) {
                    throw new RuntimeException(
                        'Durable Goods Receipt could not be reloaded.'
                    );
                }

                return [
                    'goods_receipt_id' =>
                        $receiptId,

                    'goods_receipt_number' =>
                        $receiptNumber,

                    'finance_journal_entry_id' =>
                        (int) $journal->id,

                    'accounting_status' =>
                        (string)
                        $receipt->accounting_status,

                    'idempotent' =>
                        false,
                ];
            }
        );
    }

    public function handleSupplierInvoiceApproval(
        int $supplierInvoiceId,
        ?int $actorId = null,
    ): object {
        return DB::transaction(
            function () use (
                $supplierInvoiceId,
                $actorId,
            ): object {
                $invoice =
                    DB::table(
                        'pharmaco_supplier_invoices'
                    )
                        ->where(
                            'id',
                            $supplierInvoiceId
                        )
                        ->lockForUpdate()
                        ->first();

                if (! $invoice) {
                    throw ValidationException::withMessages([
                        'supplier_invoice' => [
                            'Supplier Bill was not found.',
                        ],
                    ]);
                }

                if (
                    strtolower(
                        (string)
                        $invoice->accounting_status
                    ) === 'posted'
                    &&
                    $invoice->finance_journal_entry_id
                ) {
                    $match =
                        DB::table(
                            'pharmaco_procurement_match_records'
                        )
                            ->where(
                                'pharmaco_supplier_invoice_id',
                                $supplierInvoiceId
                            )
                            ->orderByDesc('id')
                            ->first();

                    return (object) [
                        'status' =>
                            'posted',

                        'match' =>
                            $match,

                        'journal_entry_id' =>
                            (int)
                            $invoice
                                ->finance_journal_entry_id,

                        'idempotent' =>
                            true,
                    ];
                }

                if (
                    ! in_array(
                        strtolower(
                            (string) $invoice->status
                        ),
                        [
                            'approved',
                            'partially_paid',
                            'paid',
                        ],
                        true
                    )
                ) {
                    throw ValidationException::withMessages([
                        'status' => [
                            'Supplier Bill must be approved before accounting integration.',
                        ],
                    ]);
                }

                if (
                    ! $invoice->pharmaco_purchase_order_id
                ) {
                    return $this
                        ->recordInvoiceException(
                            $invoice,
                            null,
                            'Supplier Bill is not linked to a Purchase Order; GRNI settlement cannot be manufactured.',
                            $actorId
                        );
                }

                $po =
                    DB::table(
                        'pharmaco_purchase_orders'
                    )
                        ->where(
                            'id',
                            $invoice
                                ->pharmaco_purchase_order_id
                        )
                        ->lockForUpdate()
                        ->first();

                if (! $po) {
                    throw ValidationException::withMessages([
                        'purchase_order' => [
                            'Supplier Bill Purchase Order was not found.',
                        ],
                    ]);
                }

                $tenantId =
                    (int) $invoice->tenant_id;

                $branchId =
                    (int) $po->branch_id;

                if (
                    $tenantId !== (int) $po->tenant_id
                    ||
                    (int)
                    $invoice->pharmaco_supplier_id
                    !==
                    (int)
                    $po->pharmaco_supplier_id
                ) {
                    throw ValidationException::withMessages([
                        'lineage' => [
                            'Supplier Bill and Purchase Order lineage does not agree.',
                        ],
                    ]);
                }

                if (
                    $invoice->branch_id !== null
                    &&
                    (int) $invoice->branch_id !== $branchId
                ) {
                    throw ValidationException::withMessages([
                        'branch' => [
                            'Supplier Bill branch conflicts with its Purchase Order.',
                        ],
                    ]);
                }

                DB::table(
                    'pharmaco_supplier_invoices'
                )
                    ->where(
                        'id',
                        $supplierInvoiceId
                    )
                    ->update([
                        'branch_id' =>
                            $branchId,

                        'updated_at' =>
                            now()->toDateTimeString(),
                    ]);

                $invoiceItems =
                    DB::table(
                        'pharmaco_supplier_invoice_items'
                    )
                        ->where(
                            'pharmaco_supplier_invoice_id',
                            $supplierInvoiceId
                        )
                        ->orderBy('id')
                        ->get();

                if ($invoiceItems->isEmpty()) {
                    return $this
                        ->recordInvoiceException(
                            $invoice,
                            $po,
                            'Supplier Bill has no lines for three-way matching.',
                            $actorId
                        );
                }

                foreach ($invoiceItems as $invoiceItem) {
                    if (
                        $invoiceItem->branch_id !== null
                        &&
                        (int) $invoiceItem->branch_id
                        !== $branchId
                    ) {
                        throw ValidationException::withMessages([
                            'branch' => [
                                'Supplier Bill line branch conflicts with its Purchase Order.',
                            ],
                        ]);
                    }
                }

                DB::table(
                    'pharmaco_supplier_invoice_items'
                )
                    ->where(
                        'pharmaco_supplier_invoice_id',
                        $supplierInvoiceId
                    )
                    ->update([
                        'branch_id' =>
                            $branchId,

                        'updated_at' =>
                            now()->toDateTimeString(),
                    ]);

                $billTax =
                    round(
                        max(
                            0,
                            (float) $invoice->tax_amount
                        ),
                        2
                    );

                $invoicedAmount =
                    round(
                        (float) $invoice->total_amount
                        -
                        $billTax,
                        2
                    );

                if ($invoicedAmount < 0) {
                    return $this
                        ->recordInvoiceException(
                            $invoice,
                            $po,
                            'Supplier Bill net amount is invalid.',
                            $actorId
                        );
                }

                $orderedAmount = 0.0;
                $receivedAmount = 0.0;
                $orderedTax = 0.0;

                $receiptIds = [];
                $allocationEvidence = [];

                foreach ($invoiceItems as $invoiceItem) {
                    $poItemId =
                        (int)
                        (
                            $invoiceItem
                                ->pharmaco_purchase_order_item_id
                            ?: 0
                        );

                    $invoiceQty =
                        round(
                            (float) $invoiceItem->quantity,
                            3
                        );

                    if (
                        $poItemId <= 0
                        ||
                        $invoiceQty <= 0
                    ) {
                        return $this
                            ->recordInvoiceException(
                                $invoice,
                                $po,
                                'Every Supplier Bill line requires a positive quantity and Purchase Order item lineage.',
                                $actorId,
                                $orderedAmount,
                                $receivedAmount,
                                $invoicedAmount
                            );
                    }

                    $poItem =
                        DB::table(
                            'pharmaco_purchase_order_items'
                        )
                            ->where(
                                'id',
                                $poItemId
                            )
                            ->first();

                    if (
                        ! $poItem
                        ||
                        (int)
                        $poItem
                            ->pharmaco_purchase_order_id
                        !==
                        (int) $po->id
                    ) {
                        return $this
                            ->recordInvoiceException(
                                $invoice,
                                $po,
                                'Supplier Bill line is not linked to the selected Purchase Order.',
                                $actorId,
                                $orderedAmount,
                                $receivedAmount,
                                $invoicedAmount
                            );
                    }

                    $receiptRows =
                        DB::table(
                            'pharmaco_goods_receipt_items as gri'
                        )
                            ->join(
                                'pharmaco_goods_receipts as gr',
                                'gr.id',
                                '=',
                                'gri.pharmaco_goods_receipt_id'
                            )
                            ->where(
                                'gri.tenant_id',
                                $tenantId
                            )
                            ->where(
                                'gri.branch_id',
                                $branchId
                            )
                            ->where(
                                'gri.pharmaco_purchase_order_item_id',
                                $poItemId
                            )
                            ->whereIn(
                                'gr.status',
                                [
                                    'approved',
                                    'posted',
                                ]
                            )
                            ->where(
                                'gr.accounting_status',
                                'posted'
                            )
                            ->orderBy('gri.id')
                            ->get([
                                'gr.id as receipt_id',
                                'gr.receipt_number',
                                'gr.branch_id',
                                'gri.id as receipt_item_id',
                                'gri.quantity_received',
                                'gri.unit_cost',
                            ]);

                    $receivedQty = 0.0;
                    $receivedValue = 0.0;

                    foreach ($receiptRows as $receiptRow) {
                        if (
                            (int) $receiptRow->branch_id
                            !== $branchId
                        ) {
                            throw ValidationException::withMessages([
                                'branch' => [
                                    'Posted Goods Receipt branch conflicts with Supplier Bill branch.',
                                ],
                            ]);
                        }

                        $rowQty =
                            round(
                                (float)
                                $receiptRow
                                    ->quantity_received,
                                3
                            );

                        $rowCost =
                            round(
                                (float)
                                $receiptRow
                                    ->unit_cost,
                                4
                            );

                        $receivedQty +=
                            $rowQty;

                        $receivedValue +=
                            $rowQty
                            *
                            $rowCost;

                        $receiptIds[
                            (int)
                            $receiptRow->receipt_id
                        ] = true;
                    }

                    $receivedQty =
                        round(
                            $receivedQty,
                            3
                        );

                    $receivedValue =
                        round(
                            $receivedValue,
                            2
                        );

                    $previouslyAllocatedQty =
                        round(
                            (float)
                            DB::table(
                                'pharmaco_supplier_invoice_items as sii'
                            )
                                ->join(
                                    'pharmaco_supplier_invoices as si',
                                    'si.id',
                                    '=',
                                    'sii.pharmaco_supplier_invoice_id'
                                )
                                ->where(
                                    'si.tenant_id',
                                    $tenantId
                                )
                                ->where(
                                    'sii.pharmaco_purchase_order_item_id',
                                    $poItemId
                                )
                                ->where(
                                    'si.accounting_status',
                                    'posted'
                                )
                                ->where(
                                    'si.id',
                                    '<>',
                                    $supplierInvoiceId
                                )
                                ->sum(
                                    'sii.quantity'
                                ),
                            3
                        );

                    $availableQty =
                        round(
                            max(
                                0,
                                $receivedQty
                                -
                                $previouslyAllocatedQty
                            ),
                            3
                        );

                    if (
                        $receivedQty <= 0
                        ||
                        $invoiceQty
                        >
                        $availableQty + 0.001
                    ) {
                        $shortage =
                            round(
                                max(
                                    0,
                                    $invoiceQty
                                    -
                                    $availableQty
                                ),
                                3
                            );

                        return $this
                            ->recordInvoiceException(
                                $invoice,
                                $po,
                                'Supplier Bill quantity exceeds posted, unallocated Goods Receipt quantity.',
                                $actorId,
                                $orderedAmount,
                                $receivedAmount,
                                $invoicedAmount,
                                $shortage,
                                $receiptIds
                            );
                    }

                    $weightedAverageCost =
                        $receivedQty > 0
                            ? round(
                                $receivedValue
                                /
                                $receivedQty,
                                4
                            )
                            : 0;

                    if ($weightedAverageCost <= 0) {
                        return $this
                            ->recordInvoiceException(
                                $invoice,
                                $po,
                                'Posted Goods Receipt cost basis is unavailable.',
                                $actorId,
                                $orderedAmount,
                                $receivedAmount,
                                $invoicedAmount,
                                0,
                                $receiptIds
                            );
                    }

                    $allocatedReceiptValue =
                        round(
                            $invoiceQty
                            *
                            $weightedAverageCost,
                            2
                        );

                    $orderedLineValue =
                        round(
                            $invoiceQty
                            *
                            (float) $poItem->unit_cost,
                            2
                        );

                    $orderedAmount +=
                        $orderedLineValue;

                    $receivedAmount +=
                        $allocatedReceiptValue;

                    $orderedQty =
                        round(
                            (float)
                            $poItem->quantity_ordered,
                            3
                        );

                    if ($orderedQty > 0) {
                        $orderedTax +=
                            round(
                                (
                                    (float)
                                    $poItem->tax_amount
                                )
                                *
                                (
                                    $invoiceQty
                                    /
                                    $orderedQty
                                ),
                                2
                            );
                    }

                    $allocationEvidence[] = [
                        'purchase_order_item_id' =>
                            $poItemId,

                        'invoice_quantity' =>
                            $invoiceQty,

                        'posted_received_quantity' =>
                            $receivedQty,

                        'previously_allocated_quantity' =>
                            $previouslyAllocatedQty,

                        'available_quantity' =>
                            $availableQty,

                        'weighted_average_receipt_cost' =>
                            $weightedAverageCost,

                        'allocated_grni_amount' =>
                            $allocatedReceiptValue,
                    ];
                }

                $orderedAmount =
                    round(
                        $orderedAmount,
                        2
                    );

                $receivedAmount =
                    round(
                        $receivedAmount,
                        2
                    );

                $orderedTax =
                    round(
                        $orderedTax,
                        2
                    );

                $priceVariance =
                    round(
                        $invoicedAmount
                        -
                        $receivedAmount,
                        2
                    );

                $taxVariance =
                    round(
                        $billTax
                        -
                        $orderedTax,
                        2
                    );

                /*
                 * Price variance does NOT block the match.
                 * The existing posting workflow routes the difference to
                 * Purchase Price Variance.
                 */
                $match =
                    $this
                        ->storeMatch(
                            invoice:
                                $invoice,

                            po:
                                $po,

                            status:
                                'matched',

                            orderedAmount:
                                $orderedAmount,

                            receivedAmount:
                                $receivedAmount,

                            invoicedAmount:
                                $invoicedAmount,

                            quantityVariance:
                                0,

                            priceVariance:
                                $priceVariance,

                            taxVariance:
                                $taxVariance,

                            receiptIds:
                                $receiptIds,

                            actorId:
                                $actorId,

                            reason:
                                null,

                            metadata: [
                                'allocation_policy' =>
                                    'posted_grn_weighted_average_unallocated_quantity',

                                'price_variance_blocks_match' =>
                                    false,

                                'allocations' =>
                                    $allocationEvidence,
                            ]
                        );

                $metadata =
                    $this
                        ->metadataArray(
                            $invoice->metadata
                        );

                $metadata['f4_accounting'] = [
                    'release' =>
                        self::RELEASE,

                    'status' =>
                        'matched',

                    'match_id' =>
                        (int) $match->id,

                    'matched_at' =>
                        now()->toDateTimeString(),

                    'price_variance' =>
                        $priceVariance,

                    'tax_variance' =>
                        $taxVariance,
                ];

                DB::table(
                    'pharmaco_supplier_invoices'
                )
                    ->where(
                        'id',
                        $supplierInvoiceId
                    )
                    ->update([
                        'branch_id' =>
                            $branchId,

                        'accounting_status' =>
                            'matched',

                        'metadata' =>
                            json_encode(
                                $metadata,
                                JSON_UNESCAPED_SLASHES
                            ),

                        'updated_at' =>
                            now()->toDateTimeString(),
                    ]);

                $journal =
                    $this
                        ->workflow
                        ->postSupplierBill(
                            $supplierInvoiceId,
                            (int) $match->id,
                            $actorId
                        );

                return (object) [
                    'status' =>
                        'posted',

                    'match' =>
                        DB::table(
                            'pharmaco_procurement_match_records'
                        )
                            ->where(
                                'id',
                                $match->id
                            )
                            ->first(),

                    'journal_entry_id' =>
                        (int) $journal->id,

                    'idempotent' =>
                        false,
                ];
            }
        );
    }

    public function handleSupplierPayment(
        int $supplierPaymentId,
        ?int $actorId = null,
    ): object {
        return DB::transaction(
            function () use (
                $supplierPaymentId,
                $actorId,
            ): object {
                $payment =
                    DB::table(
                        'pharmaco_supplier_payments'
                    )
                        ->where(
                            'id',
                            $supplierPaymentId
                        )
                        ->lockForUpdate()
                        ->first();

                if (! $payment) {
                    throw ValidationException::withMessages([
                        'supplier_payment' => [
                            'Supplier Payment was not found.',
                        ],
                    ]);
                }

                $invoice =
                    DB::table(
                        'pharmaco_supplier_invoices'
                    )
                        ->where(
                            'id',
                            $payment
                                ->pharmaco_supplier_invoice_id
                        )
                        ->lockForUpdate()
                        ->first();

                if (! $invoice) {
                    throw ValidationException::withMessages([
                        'supplier_invoice' => [
                            'Supplier Payment invoice lineage is missing.',
                        ],
                    ]);
                }

                if (
                    strtolower(
                        (string)
                        $invoice->accounting_status
                    ) !== 'posted'
                    ||
                    ! $invoice->finance_journal_entry_id
                ) {
                    throw ValidationException::withMessages([
                        'accounting' => [
                            'Supplier Bill must be posted to Finance before a Supplier Payment can settle Accounts Payable.',
                        ],
                    ]);
                }

                $branchId =
                    (int)
                    (
                        $invoice->branch_id
                        ?: 0
                    );

                if ($branchId <= 0) {
                    throw ValidationException::withMessages([
                        'branch' => [
                            'Supplier Bill branch lineage is required before payment posting.',
                        ],
                    ]);
                }

                if (
                    $payment->branch_id !== null
                    &&
                    (int) $payment->branch_id
                    !== $branchId
                ) {
                    throw ValidationException::withMessages([
                        'branch' => [
                            'Supplier Payment branch conflicts with Supplier Bill branch.',
                        ],
                    ]);
                }

                DB::table(
                    'pharmaco_supplier_payments'
                )
                    ->where(
                        'id',
                        $supplierPaymentId
                    )
                    ->update([
                        'branch_id' =>
                            $branchId,

                        'currency_code' =>
                            strtoupper(
                                (string)
                                (
                                    $invoice->currency_code
                                    ?: 'RWF'
                                )
                            ),

                        'exchange_rate' =>
                            (float)
                            (
                                $invoice->exchange_rate
                                ?: 1
                            ),

                        'updated_at' =>
                            now()->toDateTimeString(),
                    ]);

                return $this
                    ->workflow
                    ->postSupplierPayment(
                        $supplierPaymentId,
                        $actorId
                    );
            }
        );
    }

    private function recordInvoiceException(
        object $invoice,
        ?object $po,
        string $reason,
        ?int $actorId,
        float $orderedAmount = 0,
        float $receivedAmount = 0,
        ?float $invoicedAmount = null,
        float $quantityVariance = 0,
        array $receiptIds = [],
    ): object {
        $invoicedAmount =
            $invoicedAmount
            ??
            round(
                (float) $invoice->total_amount
                -
                max(
                    0,
                    (float) $invoice->tax_amount
                ),
                2
            );

        $match = null;

        if ($po) {
            $match =
                $this
                    ->storeMatch(
                        invoice:
                            $invoice,

                        po:
                            $po,

                        status:
                            'exception',

                        orderedAmount:
                            round(
                                $orderedAmount,
                                2
                            ),

                        receivedAmount:
                            round(
                                $receivedAmount,
                                2
                            ),

                        invoicedAmount:
                            round(
                                $invoicedAmount,
                                2
                            ),

                        quantityVariance:
                            round(
                                $quantityVariance,
                                3
                            ),

                        priceVariance:
                            round(
                                $invoicedAmount
                                -
                                $receivedAmount,
                                2
                            ),

                        taxVariance:
                            0,

                        receiptIds:
                            $receiptIds,

                        actorId:
                            $actorId,

                        reason:
                            $reason,

                        metadata: [
                            'exception_control' =>
                                true,
                        ]
                    );
        }

        $metadata =
            $this
                ->metadataArray(
                    $invoice->metadata
                );

        $metadata['f4_accounting'] = [
            'release' =>
                self::RELEASE,

            'status' =>
                'exception',

            'reason' =>
                $reason,

            'match_id' =>
                $match
                    ? (int) $match->id
                    : null,

            'recorded_at' =>
                now()->toDateTimeString(),
        ];

        DB::table(
            'pharmaco_supplier_invoices'
        )
            ->where(
                'id',
                $invoice->id
            )
            ->update([
                'accounting_status' =>
                    'exception',

                'metadata' =>
                    json_encode(
                        $metadata,
                        JSON_UNESCAPED_SLASHES
                    ),

                'updated_at' =>
                    now()->toDateTimeString(),
            ]);

        return (object) [
            'status' =>
                'exception',

            'reason' =>
                $reason,

            'match' =>
                $match,

            'journal_entry_id' =>
                null,

            'idempotent' =>
                false,
        ];
    }

    private function storeMatch(
        object $invoice,
        object $po,
        string $status,
        float $orderedAmount,
        float $receivedAmount,
        float $invoicedAmount,
        float $quantityVariance,
        float $priceVariance,
        float $taxVariance,
        array $receiptIds,
        ?int $actorId,
        ?string $reason,
        array $metadata = [],
    ): object {
        $receiptIds =
            array_values(
                array_map(
                    'intval',
                    array_keys(
                        $receiptIds
                    )
                )
            );

        sort(
            $receiptIds
        );

        $singleReceiptId =
            count(
                $receiptIds
            ) === 1
                ? $receiptIds[0]
                : null;

        $matchNumber =
            'F4M-SI'
            .
            (int) $invoice->id;

        $existing =
            DB::table(
                'pharmaco_procurement_match_records'
            )
                ->where(
                    'tenant_id',
                    $invoice->tenant_id
                )
                ->where(
                    'match_number',
                    $matchNumber
                )
                ->lockForUpdate()
                ->first();

        $timestamp =
            now()->toDateTimeString();

        $payload = [
            'tenant_id' =>
                (int) $invoice->tenant_id,

            'branch_id' =>
                (int) $po->branch_id,

            'pharmaco_purchase_order_id' =>
                (int) $po->id,

            'pharmaco_goods_receipt_id' =>
                $singleReceiptId,

            'pharmaco_supplier_invoice_id' =>
                (int) $invoice->id,

            'match_number' =>
                $matchNumber,

            'status' =>
                $status,

            'ordered_amount' =>
                round(
                    $orderedAmount,
                    2
                ),

            'received_amount' =>
                round(
                    $receivedAmount,
                    2
                ),

            'invoiced_amount' =>
                round(
                    $invoicedAmount,
                    2
                ),

            'variance_amount' =>
                round(
                    $priceVariance,
                    2
                ),

            'quantity_variance' =>
                round(
                    $quantityVariance,
                    3
                ),

            'price_variance' =>
                round(
                    $priceVariance,
                    2
                ),

            'tax_variance' =>
                round(
                    $taxVariance,
                    2
                ),

            'matched_by' =>
                $status === 'matched'
                    ? $actorId
                    : null,

            'matched_at' =>
                $status === 'matched'
                    ? $timestamp
                    : null,

            'exception_reason' =>
                $reason,

            'metadata' =>
                json_encode(
                    array_merge(
                        [
                            'release' =>
                                self::RELEASE,

                            'receipt_ids' =>
                                $receiptIds,

                            'multi_grn' =>
                                count(
                                    $receiptIds
                                ) > 1,
                        ],
                        $metadata
                    ),
                    JSON_UNESCAPED_SLASHES
                ),

            'updated_at' =>
                $timestamp,
        ];

        if ($existing) {
            DB::table(
                'pharmaco_procurement_match_records'
            )
                ->where(
                    'id',
                    $existing->id
                )
                ->update(
                    $payload
                );

            $id =
                (int) $existing->id;
        } else {
            $payload['uuid'] =
                (string) Str::uuid();

            $payload['created_at'] =
                $timestamp;

            $id =
                (int)
                DB::table(
                    'pharmaco_procurement_match_records'
                )
                    ->insertGetId(
                        $payload
                    );
        }

        $match =
            DB::table(
                'pharmaco_procurement_match_records'
            )
                ->where(
                    'id',
                    $id
                )
                ->first();

        if (! $match) {
            throw new RuntimeException(
                'Procurement three-way match could not be reloaded.'
            );
        }

        return $match;
    }

    private function metadataArray(
        mixed $value,
    ): array {
        if (is_array($value)) {
            return $value;
        }

        if (
            is_string($value)
            &&
            trim($value) !== ''
        ) {
            $decoded =
                json_decode(
                    $value,
                    true
                );

            if (is_array($decoded)) {
                return $decoded;
            }
        }

        return [];
    }
}
