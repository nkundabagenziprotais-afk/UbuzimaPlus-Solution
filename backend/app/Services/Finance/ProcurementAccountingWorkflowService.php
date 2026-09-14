<?php

namespace App\Services\Finance;

use App\Data\Finance\FinanceJournalLinePayload;
use App\Data\Finance\FinancePostingPayload;
use App\Models\FinanceJournalEntry;
use App\Models\FinancePostingLog;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use RuntimeException;

final class ProcurementAccountingWorkflowService
{
    public const RELEASE =
        'AQUILA_FINANCE_F4_R4_R2_PROCUREMENT_ACCOUNTING_WORKFLOW';

    public function __construct(
        private readonly FinancePostingService $postingService,
    ) {
    }

    public function refreshThreeWayMatch(
        int $purchaseOrderId,
        int $goodsReceiptId,
        int $supplierInvoiceId,
        ?int $actorId = null,
    ): object {
        return DB::transaction(
            function () use (
                $purchaseOrderId,
                $goodsReceiptId,
                $supplierInvoiceId,
                $actorId,
            ): object {
                $po =
                    DB::table('pharmaco_purchase_orders')
                        ->where('id', $purchaseOrderId)
                        ->lockForUpdate()
                        ->first();

                $grn =
                    DB::table('pharmaco_goods_receipts')
                        ->where('id', $goodsReceiptId)
                        ->lockForUpdate()
                        ->first();

                $bill =
                    DB::table('pharmaco_supplier_invoices')
                        ->where('id', $supplierInvoiceId)
                        ->lockForUpdate()
                        ->first();

                if (! $po) {
                    throw ValidationException::withMessages([
                        'purchase_order' => [
                            'Purchase Order was not found.',
                        ],
                    ]);
                }

                if (! $grn) {
                    throw ValidationException::withMessages([
                        'goods_receipt' => [
                            'Goods Receipt was not found.',
                        ],
                    ]);
                }

                if (! $bill) {
                    throw ValidationException::withMessages([
                        'supplier_invoice' => [
                            'Supplier Bill was not found.',
                        ],
                    ]);
                }

                $tenantId =
                    (int) $po->tenant_id;

                $branchId =
                    (int) $po->branch_id;

                $supplierId =
                    (int) $po->pharmaco_supplier_id;

                if (
                    $tenantId !== (int) $grn->tenant_id
                    ||
                    $tenantId !== (int) $bill->tenant_id
                ) {
                    throw ValidationException::withMessages([
                        'tenant' => [
                            'PO, GRN and Supplier Bill tenant lineage must match.',
                        ],
                    ]);
                }

                if (
                    $branchId <= 0
                    ||
                    $branchId !== (int) $grn->branch_id
                    ||
                    $branchId !== (int) $bill->branch_id
                ) {
                    throw ValidationException::withMessages([
                        'branch' => [
                            'PO, GRN and Supplier Bill branch lineage must match.',
                        ],
                    ]);
                }

                if (
                    $supplierId !== (int) $grn->pharmaco_supplier_id
                    ||
                    $supplierId !== (int) $bill->pharmaco_supplier_id
                ) {
                    throw ValidationException::withMessages([
                        'supplier' => [
                            'PO, GRN and Supplier Bill supplier lineage must match.',
                        ],
                    ]);
                }

                if (
                    (int) $grn->pharmaco_purchase_order_id
                    !== $purchaseOrderId
                    ||
                    (int) $bill->pharmaco_purchase_order_id
                    !== $purchaseOrderId
                ) {
                    throw ValidationException::withMessages([
                        'purchase_order' => [
                            'GRN and Supplier Bill must belong to the selected Purchase Order.',
                        ],
                    ]);
                }

                $orderedAmount =
                    round(
                        max(
                            0,
                            (float) $po->subtotal_amount
                            -
                            (float) $po->discount_amount
                        ),
                        2
                    );

                $receivedAmount =
                    round(
                        (float) $grn->subtotal_amount,
                        2
                    );

                $billTax =
                    round(
                        max(
                            0,
                            (float) $bill->tax_amount
                        ),
                        2
                    );

                $invoicedAmount =
                    round(
                        (float) $bill->total_amount
                        -
                        $billTax,
                        2
                    );

                $poTax =
                    round(
                        max(
                            0,
                            (float) $po->tax_amount
                        ),
                        2
                    );

                $orderedQty =
                    round(
                        (float)
                        DB::table(
                            'pharmaco_purchase_order_items'
                        )
                            ->where(
                                'pharmaco_purchase_order_id',
                                $purchaseOrderId
                            )
                            ->sum('quantity_ordered'),
                        3
                    );

                $receivedQty =
                    round(
                        (float)
                        DB::table(
                            'pharmaco_goods_receipt_items'
                        )
                            ->where(
                                'pharmaco_goods_receipt_id',
                                $goodsReceiptId
                            )
                            ->sum('quantity_received'),
                        3
                    );

                $invoicedQty =
                    round(
                        (float)
                        DB::table(
                            'pharmaco_supplier_invoice_items'
                        )
                            ->where(
                                'pharmaco_supplier_invoice_id',
                                $supplierInvoiceId
                            )
                            ->sum('quantity'),
                        3
                    );

                $quantityVariance =
                    round(
                        $invoicedQty
                        -
                        $receivedQty,
                        3
                    );

                $orderedQuantityVariance =
                    round(
                        $orderedQty
                        -
                        $receivedQty,
                        3
                    );

                $orderedReceiptVariance =
                    round(
                        $orderedAmount
                        -
                        $receivedAmount,
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
                        $poTax,
                        2
                    );

                $matched =
                    abs($quantityVariance) <= 0.001
                    &&
                    abs($orderedQuantityVariance) <= 0.001
                    &&
                    abs($orderedReceiptVariance) <= 0.01
                    &&
                    abs($priceVariance) <= 0.01;

                $matchNumber =
                    'F4M-PO'
                    . $purchaseOrderId
                    . '-GR'
                    . $goodsReceiptId
                    . '-SI'
                    . $supplierInvoiceId;

                $existing =
                    DB::table(
                        'pharmaco_procurement_match_records'
                    )
                        ->where('tenant_id', $tenantId)
                        ->where(
                            'match_number',
                            $matchNumber
                        )
                        ->first();

                $payload = [
                    'tenant_id' =>
                        $tenantId,

                    'branch_id' =>
                        $branchId,

                    'pharmaco_purchase_order_id' =>
                        $purchaseOrderId,

                    'pharmaco_goods_receipt_id' =>
                        $goodsReceiptId,

                    'pharmaco_supplier_invoice_id' =>
                        $supplierInvoiceId,

                    'match_number' =>
                        $matchNumber,

                    'status' =>
                        $matched
                            ? 'matched'
                            : 'exception',

                    'ordered_amount' =>
                        $orderedAmount,

                    'received_amount' =>
                        $receivedAmount,

                    'invoiced_amount' =>
                        $invoicedAmount,

                    'variance_amount' =>
                        $priceVariance,

                    'quantity_variance' =>
                        $quantityVariance,

                    'price_variance' =>
                        $priceVariance,

                    'tax_variance' =>
                        $taxVariance,

                    'matched_by' =>
                        $actorId,

                    'matched_at' =>
                        now()->toDateTimeString(),

                    'exception_reason' =>
                        $matched
                            ? null
                            : 'PO / GRN / Supplier Bill variance requires approval.',

                    'metadata' =>
                        json_encode(
                            [
                                'release' =>
                                    self::RELEASE,

                                'ordered_quantity' =>
                                    $orderedQty,

                                'received_quantity' =>
                                    $receivedQty,

                                'invoiced_quantity' =>
                                    $invoicedQty,

                                'ordered_quantity_variance' =>
                                    $orderedQuantityVariance,

                                'ordered_receipt_variance' =>
                                    $orderedReceiptVariance,

                                'amount_tolerance' =>
                                    0.01,

                                'quantity_tolerance' =>
                                    0.001,
                            ],
                            JSON_UNESCAPED_SLASHES
                        ),

                    'updated_at' =>
                        now()->toDateTimeString(),
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
                        now()->toDateTimeString();

                    $id =
                        (int)
                        DB::table(
                            'pharmaco_procurement_match_records'
                        )
                            ->insertGetId(
                                $payload
                            );
                }

                $record =
                    DB::table(
                        'pharmaco_procurement_match_records'
                    )
                        ->where(
                            'id',
                            $id
                        )
                        ->first();

                if (! $record) {
                    throw new RuntimeException(
                        'Three-way match record could not be reloaded.'
                    );
                }

                return $record;
            }
        );
    }

    public function postGoodsReceipt(
        int $goodsReceiptId,
        ?int $actorId = null,
    ): FinanceJournalEntry {
        return DB::transaction(
            function () use (
                $goodsReceiptId,
                $actorId,
            ): FinanceJournalEntry {
                $grn =
                    DB::table(
                        'pharmaco_goods_receipts'
                    )
                        ->where(
                            'id',
                            $goodsReceiptId
                        )
                        ->lockForUpdate()
                        ->first();

                if (! $grn) {
                    throw ValidationException::withMessages([
                        'goods_receipt' => [
                            'Goods Receipt was not found.',
                        ],
                    ]);
                }

                if (
                    ! in_array(
                        strtolower(
                            (string) $grn->status
                        ),
                        [
                            'approved',
                            'posted',
                        ],
                        true
                    )
                ) {
                    throw ValidationException::withMessages([
                        'status' => [
                            'Only an approved Goods Receipt may post to Finance.',
                        ],
                    ]);
                }

                if (
                    strtolower(
                        (string)
                        $grn->accounting_status
                    ) === 'posted'
                    &&
                    $grn->finance_journal_entry_id
                ) {
                    $existing =
                        FinanceJournalEntry::query()
                            ->find(
                                (int)
                                $grn->finance_journal_entry_id
                            );

                    if (
                        $existing
                        &&
                        strtolower(
                            (string) $existing->status
                        ) === 'posted'
                    ) {
                        return $existing->load('lines');
                    }
                }

                $items =
                    DB::table(
                        'pharmaco_goods_receipt_items'
                    )
                        ->where(
                            'pharmaco_goods_receipt_id',
                            $goodsReceiptId
                        )
                        ->orderBy('id')
                        ->get();

                if ($items->isEmpty()) {
                    throw ValidationException::withMessages([
                        'items' => [
                            'Goods Receipt must contain at least one item.',
                        ],
                    ]);
                }

                $tenantId =
                    (int) $grn->tenant_id;

                $branchId =
                    (int) $grn->branch_id;

                $supplierId =
                    (int) $grn->pharmaco_supplier_id;

                if ($branchId <= 0) {
                    throw ValidationException::withMessages([
                        'branch' => [
                            'Goods Receipt branch lineage is required.',
                        ],
                    ]);
                }

                $inventoryTotal = 0.0;

                $lines = [];

                foreach ($items as $item) {
                    $quantity =
                        round(
                            (float)
                            $item->quantity_received,
                            3
                        );

                    $unitCost =
                        round(
                            (float)
                            $item->unit_cost,
                            4
                        );

                    if (
                        $quantity <= 0
                        ||
                        $unitCost < 0
                    ) {
                        throw ValidationException::withMessages([
                            'items' => [
                                'Goods Receipt quantity or unit cost is invalid.',
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

                    if ($lineValue <= 0) {
                        throw ValidationException::withMessages([
                            'items' => [
                                'Goods Receipt item value must be positive.',
                            ],
                        ]);
                    }

                    $inventoryTotal +=
                        $lineValue;

                    $lines[] =
                        new FinanceJournalLinePayload(
                            mappingKey:
                                ProcurementAccountingContract::INVENTORY_ASSET,

                            debit:
                                $lineValue,

                            description:
                                'Inventory received under GRN '
                                . $grn->receipt_number,

                            lineType:
                                'goods_receipt_inventory',

                            branchId:
                                $branchId,

                            supplierId:
                                $supplierId,

                            productId:
                                $item->product_id
                                    ? (int) $item->product_id
                                    : null,

                            stockLocationId:
                                $grn->stock_location_id
                                    ? (int) $grn->stock_location_id
                                    : null,

                            metadata: [
                                'goods_receipt_id' =>
                                    $goodsReceiptId,

                                'goods_receipt_item_id' =>
                                    (int) $item->id,

                                'purchase_order_id' =>
                                    (int)
                                    $grn
                                        ->pharmaco_purchase_order_id,

                                'batch_number' =>
                                    $item->batch_number,

                                'expiry_date' =>
                                    $item->expiry_date,

                                'quantity_received' =>
                                    $quantity,

                                'unit_cost' =>
                                    $unitCost,
                            ]
                        );
                }

                $inventoryTotal =
                    round(
                        $inventoryTotal,
                        2
                    );

                $lines[] =
                    new FinanceJournalLinePayload(
                        mappingKey:
                            ProcurementAccountingContract::GRNI,

                        credit:
                            $inventoryTotal,

                        description:
                            'GRNI recognition for GRN '
                            . $grn->receipt_number,

                        lineType:
                            'goods_receipt_grni',

                        branchId:
                            $branchId,

                        supplierId:
                            $supplierId,

                        metadata: [
                            'goods_receipt_id' =>
                                $goodsReceiptId,

                            'purchase_order_id' =>
                                (int)
                                $grn
                                    ->pharmaco_purchase_order_id,
                        ]
                    );

                $idempotencyKey =
                    trim(
                        (string)
                        (
                            $grn->idempotency_key
                            ?: ''
                        )
                    );

                if ($idempotencyKey === '') {
                    $idempotencyKey =
                        'procurement-grn-'
                        . (string) $grn->uuid;
                }

                $journal =
                    $this->postedOrThrow(
                        $this
                            ->postingService
                            ->post(
                                new FinancePostingPayload(
                                    tenantId:
                                        $tenantId,

                                    branchId:
                                        $branchId,

                                    businessDate:
                                        substr(
                                            (string)
                                            $grn->receipt_date,
                                            0,
                                            10
                                        ),

                                    sourceModule:
                                        'procurement',

                                    sourceType:
                                        'goods_receipt',

                                    sourceId:
                                        (string)
                                        $goodsReceiptId,

                                    idempotencyKey:
                                        $idempotencyKey,

                                    lines:
                                        $lines,

                                    currencyCode:
                                        strtoupper(
                                            (string)
                                            (
                                                $grn->currency_code
                                                ?: 'RWF'
                                            )
                                        ),

                                    exchangeRate:
                                        (float)
                                        (
                                            $grn->exchange_rate
                                            ?: 1
                                        ),

                                    memo:
                                        'Procurement GRN '
                                        . $grn->receipt_number,

                                    createdBy:
                                        $actorId,

                                    sourceSnapshot: [
                                        'goods_receipt_id' =>
                                            $goodsReceiptId,

                                        'purchase_order_id' =>
                                            (int)
                                            $grn
                                                ->pharmaco_purchase_order_id,

                                        'supplier_id' =>
                                            $supplierId,

                                        'inventory_amount' =>
                                            $inventoryTotal,
                                    ],

                                    metadata: [
                                        'release' =>
                                            self::RELEASE,

                                        'accounting_event' =>
                                            'goods_receipt',

                                        'grni' =>
                                            true,

                                        'pharmacy_batch_expiry_provenance' =>
                                            true,
                                    ],

                                    mode:
                                        'live'
                                )
                            ),
                        'Goods Receipt'
                    );

                DB::table(
                    'pharmaco_goods_receipts'
                )
                    ->where(
                        'id',
                        $goodsReceiptId
                    )
                    ->update([
                        'accounting_status' =>
                            'posted',

                        'finance_journal_entry_id' =>
                            $journal->id,

                        'finance_posted_at' =>
                            now()->toDateTimeString(),

                        'idempotency_key' =>
                            $idempotencyKey,

                        'updated_at' =>
                            now()->toDateTimeString(),
                    ]);

                return $journal;
            }
        );
    }

    public function postSupplierBill(
        int $supplierInvoiceId,
        int $matchId,
        ?int $actorId = null,
    ): FinanceJournalEntry {
        return DB::transaction(
            function () use (
                $supplierInvoiceId,
                $matchId,
                $actorId,
            ): FinanceJournalEntry {
                $bill =
                    DB::table(
                        'pharmaco_supplier_invoices'
                    )
                        ->where(
                            'id',
                            $supplierInvoiceId
                        )
                        ->lockForUpdate()
                        ->first();

                $match =
                    DB::table(
                        'pharmaco_procurement_match_records'
                    )
                        ->where(
                            'id',
                            $matchId
                        )
                        ->lockForUpdate()
                        ->first();

                if (! $bill) {
                    throw ValidationException::withMessages([
                        'supplier_invoice' => [
                            'Supplier Bill was not found.',
                        ],
                    ]);
                }

                if (! $match) {
                    throw ValidationException::withMessages([
                        'three_way_match' => [
                            'Three-way match record was not found.',
                        ],
                    ]);
                }

                if (
                    ! in_array(
                        strtolower(
                            (string) $bill->status
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
                            'Supplier Bill must be approved before Finance posting.',
                        ],
                    ]);
                }

                if (
                    strtolower(
                        (string)
                        $bill->accounting_status
                    ) === 'posted'
                    &&
                    $bill->finance_journal_entry_id
                ) {
                    $existing =
                        FinanceJournalEntry::query()
                            ->find(
                                (int)
                                $bill
                                    ->finance_journal_entry_id
                            );

                    if (
                        $existing
                        &&
                        strtolower(
                            (string) $existing->status
                        ) === 'posted'
                    ) {
                        return $existing->load('lines');
                    }
                }

                if (
                    (int)
                    $match
                        ->pharmaco_supplier_invoice_id
                    !==
                    $supplierInvoiceId
                ) {
                    throw ValidationException::withMessages([
                        'three_way_match' => [
                            'Three-way match belongs to another Supplier Bill.',
                        ],
                    ]);
                }

                if (
                    ! in_array(
                        strtolower(
                            (string) $match->status
                        ),
                        [
                            'matched',
                            'approved',
                        ],
                        true
                    )
                ) {
                    throw ValidationException::withMessages([
                        'three_way_match' => [
                            'Supplier Bill has an unresolved three-way match exception.',
                        ],
                    ]);
                }

                if (
                    ! $bill->pharmaco_purchase_order_id
                ) {
                    throw ValidationException::withMessages([
                        'purchase_order' => [
                            'GRNI Supplier Bill posting requires a Purchase Order.',
                        ],
                    ]);
                }

                $tenantId =
                    (int) $bill->tenant_id;

                $branchId =
                    (int) $bill->branch_id;

                $supplierId =
                    (int) $bill->pharmaco_supplier_id;

                if (
                    $branchId <= 0
                    ||
                    $tenantId !== (int) $match->tenant_id
                    ||
                    $branchId !== (int) $match->branch_id
                ) {
                    throw ValidationException::withMessages([
                        'branch' => [
                            'Supplier Bill and three-way match lineage does not agree.',
                        ],
                    ]);
                }

                $total =
                    round(
                        (float)
                        $bill->total_amount,
                        2
                    );

                $vat =
                    round(
                        max(
                            0,
                            (float)
                            $bill->tax_amount
                        ),
                        2
                    );

                $net =
                    round(
                        $total
                        -
                        $vat,
                        2
                    );

                $grni =
                    round(
                        (float)
                        $match->received_amount,
                        2
                    );

                if (
                    $total <= 0
                    ||
                    $net < 0
                    ||
                    $grni <= 0
                ) {
                    throw ValidationException::withMessages([
                        'amount' => [
                            'Supplier Bill accounting amounts are invalid.',
                        ],
                    ]);
                }

                $ppv =
                    round(
                        $net
                        -
                        $grni,
                        2
                    );

                $lines = [
                    new FinanceJournalLinePayload(
                        mappingKey:
                            ProcurementAccountingContract::GRNI,

                        debit:
                            $grni,

                        description:
                            'Clear GRNI for Supplier Bill '
                            . $bill->invoice_number,

                        lineType:
                            'supplier_bill_grni',

                        branchId:
                            $branchId,

                        supplierId:
                            $supplierId
                    ),
                ];

                if ($vat > 0) {
                    $lines[] =
                        new FinanceJournalLinePayload(
                            mappingKey:
                                ProcurementAccountingContract::VAT_INPUT,

                            debit:
                                $vat,

                            description:
                                'VAT Input on Supplier Bill '
                                . $bill->invoice_number,

                            lineType:
                                'supplier_bill_vat_input',

                            branchId:
                                $branchId,

                            supplierId:
                                $supplierId
                        );
                }

                if ($ppv > 0) {
                    $lines[] =
                        new FinanceJournalLinePayload(
                            mappingKey:
                                ProcurementAccountingContract::PURCHASE_PRICE_VARIANCE,

                            debit:
                                $ppv,

                            description:
                                'Purchase Price Variance on Supplier Bill '
                                . $bill->invoice_number,

                            lineType:
                                'supplier_bill_ppv',

                            branchId:
                                $branchId,

                            supplierId:
                                $supplierId
                        );
                } elseif ($ppv < 0) {
                    $lines[] =
                        new FinanceJournalLinePayload(
                            mappingKey:
                                ProcurementAccountingContract::PURCHASE_PRICE_VARIANCE,

                            credit:
                                abs(
                                    $ppv
                                ),

                            description:
                                'Purchase Price Variance on Supplier Bill '
                                . $bill->invoice_number,

                            lineType:
                                'supplier_bill_ppv',

                            branchId:
                                $branchId,

                            supplierId:
                                $supplierId
                        );
                }

                $lines[] =
                    new FinanceJournalLinePayload(
                        mappingKey:
                            ProcurementAccountingContract::ACCOUNTS_PAYABLE,

                        credit:
                            $total,

                        description:
                            'Accounts Payable for Supplier Bill '
                            . $bill->invoice_number,

                        lineType:
                            'supplier_bill_ap',

                        branchId:
                            $branchId,

                        supplierId:
                            $supplierId
                    );

                $idempotencyKey =
                    trim(
                        (string)
                        (
                            $bill->idempotency_key
                            ?: ''
                        )
                    );

                if ($idempotencyKey === '') {
                    $idempotencyKey =
                        'procurement-supplier-bill-'
                        . (string) $bill->uuid;
                }

                $journal =
                    $this->postedOrThrow(
                        $this
                            ->postingService
                            ->post(
                                new FinancePostingPayload(
                                    tenantId:
                                        $tenantId,

                                    branchId:
                                        $branchId,

                                    businessDate:
                                        substr(
                                            (string)
                                            $bill->invoice_date,
                                            0,
                                            10
                                        ),

                                    sourceModule:
                                        'procurement',

                                    sourceType:
                                        'supplier_bill',

                                    sourceId:
                                        (string)
                                        $supplierInvoiceId,

                                    idempotencyKey:
                                        $idempotencyKey,

                                    lines:
                                        $lines,

                                    currencyCode:
                                        strtoupper(
                                            (string)
                                            (
                                                $bill->currency_code
                                                ?: 'RWF'
                                            )
                                        ),

                                    exchangeRate:
                                        (float)
                                        (
                                            $bill->exchange_rate
                                            ?: 1
                                        ),

                                    memo:
                                        'Supplier Bill '
                                        . $bill->invoice_number,

                                    createdBy:
                                        $actorId,

                                    sourceSnapshot: [
                                        'supplier_invoice_id' =>
                                            $supplierInvoiceId,

                                        'purchase_order_id' =>
                                            (int)
                                            $bill
                                                ->pharmaco_purchase_order_id,

                                        'supplier_id' =>
                                            $supplierId,

                                        'match_id' =>
                                            $matchId,

                                        'grni' =>
                                            $grni,

                                        'vat_input' =>
                                            $vat,

                                        'purchase_price_variance' =>
                                            $ppv,

                                        'accounts_payable' =>
                                            $total,
                                    ],

                                    metadata: [
                                        'release' =>
                                            self::RELEASE,

                                        'accounting_event' =>
                                            'supplier_bill',

                                        'three_way_match' =>
                                            true,
                                    ],

                                    mode:
                                        'live'
                                )
                            ),
                        'Supplier Bill'
                    );

                DB::table(
                    'pharmaco_supplier_invoices'
                )
                    ->where(
                        'id',
                        $supplierInvoiceId
                    )
                    ->update([
                        'accounting_status' =>
                            'posted',

                        'finance_journal_entry_id' =>
                            $journal->id,

                        'finance_posted_at' =>
                            now()->toDateTimeString(),

                        'idempotency_key' =>
                            $idempotencyKey,

                        'updated_at' =>
                            now()->toDateTimeString(),
                    ]);

                return $journal;
            }
        );
    }

    public function postSupplierPayment(
        int $supplierPaymentId,
        ?int $actorId = null,
    ): FinanceJournalEntry {
        return DB::transaction(
            function () use (
                $supplierPaymentId,
                $actorId,
            ): FinanceJournalEntry {
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

                if (
                    ! in_array(
                        strtolower(
                            (string) $payment->status
                        ),
                        [
                            'completed',
                            'paid',
                            'recorded',
                        ],
                        true
                    )
                ) {
                    throw ValidationException::withMessages([
                        'status' => [
                            'Only a completed Supplier Payment may post to Finance.',
                        ],
                    ]);
                }

                if (
                    strtolower(
                        (string)
                        $payment->accounting_status
                    ) === 'posted'
                    &&
                    $payment->finance_journal_entry_id
                ) {
                    $existing =
                        FinanceJournalEntry::query()
                            ->find(
                                (int)
                                $payment
                                    ->finance_journal_entry_id
                            );

                    if (
                        $existing
                        &&
                        strtolower(
                            (string) $existing->status
                        ) === 'posted'
                    ) {
                        return $existing->load('lines');
                    }
                }

                $bill =
                    DB::table(
                        'pharmaco_supplier_invoices'
                    )
                        ->where(
                            'id',
                            $payment
                                ->pharmaco_supplier_invoice_id
                        )
                        ->first();

                if (! $bill) {
                    throw ValidationException::withMessages([
                        'supplier_invoice' => [
                            'Supplier Payment invoice lineage is missing.',
                        ],
                    ]);
                }

                $tenantId =
                    (int) $payment->tenant_id;

                $branchId =
                    (int) $payment->branch_id;

                $supplierId =
                    (int)
                    $payment->pharmaco_supplier_id;

                if (
                    $branchId <= 0
                    ||
                    $tenantId !== (int) $bill->tenant_id
                    ||
                    $branchId !== (int) $bill->branch_id
                ) {
                    throw ValidationException::withMessages([
                        'branch' => [
                            'Supplier Payment and Supplier Bill branch lineage does not agree.',
                        ],
                    ]);
                }

                $amount =
                    round(
                        (float)
                        $payment->amount,
                        2
                    );

                if ($amount <= 0) {
                    throw ValidationException::withMessages([
                        'amount' => [
                            'Supplier Payment amount must be positive.',
                        ],
                    ]);
                }

                $method =
                    strtolower(
                        trim(
                            (string)
                            $payment->payment_method
                        )
                    );

                $settlementMethod =
                    $method === 'cheque'
                        ? 'bank_transfer'
                        : $method;

                $settlementMapping =
                    ProcurementAccountingContract::settlementMapping(
                        $settlementMethod
                    );

                $idempotencyKey =
                    trim(
                        (string)
                        (
                            $payment->idempotency_key
                            ?: ''
                        )
                    );

                if ($idempotencyKey === '') {
                    $idempotencyKey =
                        'procurement-supplier-payment-'
                        . (string) $payment->uuid;
                }

                $journal =
                    $this->postedOrThrow(
                        $this
                            ->postingService
                            ->post(
                                new FinancePostingPayload(
                                    tenantId:
                                        $tenantId,

                                    branchId:
                                        $branchId,

                                    businessDate:
                                        substr(
                                            (string)
                                            $payment->paid_at,
                                            0,
                                            10
                                        ),

                                    sourceModule:
                                        'procurement',

                                    sourceType:
                                        'supplier_payment',

                                    sourceId:
                                        (string)
                                        $supplierPaymentId,

                                    idempotencyKey:
                                        $idempotencyKey,

                                    lines: [
                                        new FinanceJournalLinePayload(
                                            mappingKey:
                                                ProcurementAccountingContract::ACCOUNTS_PAYABLE,

                                            debit:
                                                $amount,

                                            description:
                                                'AP settlement for Supplier Payment '
                                                . $payment->payment_number,

                                            lineType:
                                                'supplier_payment_ap',

                                            branchId:
                                                $branchId,

                                            supplierId:
                                                $supplierId,

                                            paymentMethod:
                                                $method
                                        ),

                                        new FinanceJournalLinePayload(
                                            mappingKey:
                                                $settlementMapping,

                                            credit:
                                                $amount,

                                            description:
                                                'Supplier settlement via '
                                                . strtoupper(
                                                    $method
                                                ),

                                            lineType:
                                                'supplier_payment_settlement',

                                            branchId:
                                                $branchId,

                                            supplierId:
                                                $supplierId,

                                            paymentMethod:
                                                $method
                                        ),
                                    ],

                                    currencyCode:
                                        strtoupper(
                                            (string)
                                            (
                                                $payment->currency_code
                                                ?: 'RWF'
                                            )
                                        ),

                                    exchangeRate:
                                        (float)
                                        (
                                            $payment->exchange_rate
                                            ?: 1
                                        ),

                                    memo:
                                        'Supplier Payment '
                                        . $payment->payment_number,

                                    createdBy:
                                        $actorId,

                                    sourceSnapshot: [
                                        'supplier_payment_id' =>
                                            $supplierPaymentId,

                                        'supplier_invoice_id' =>
                                            (int)
                                            $payment
                                                ->pharmaco_supplier_invoice_id,

                                        'supplier_id' =>
                                            $supplierId,

                                        'amount' =>
                                            $amount,

                                        'payment_method' =>
                                            $method,

                                        'settlement_mapping' =>
                                            $settlementMapping,
                                    ],

                                    metadata: [
                                        'release' =>
                                            self::RELEASE,

                                        'accounting_event' =>
                                            'supplier_payment',
                                    ],

                                    mode:
                                        'live'
                                )
                            ),
                        'Supplier Payment'
                    );

                DB::table(
                    'pharmaco_supplier_payments'
                )
                    ->where(
                        'id',
                        $supplierPaymentId
                    )
                    ->update([
                        'accounting_status' =>
                            'posted',

                        'finance_journal_entry_id' =>
                            $journal->id,

                        'finance_posted_at' =>
                            now()->toDateTimeString(),

                        'idempotency_key' =>
                            $idempotencyKey,

                        'updated_at' =>
                            now()->toDateTimeString(),
                    ]);

                return $journal;
            }
        );
    }

    private function postedOrThrow(
        FinanceJournalEntry|FinancePostingLog $result,
        string $context,
    ): FinanceJournalEntry {
        if (
            $result instanceof FinanceJournalEntry
            &&
            strtolower(
                (string) $result->status
            ) === 'posted'
        ) {
            return $result->load('lines');
        }

        $message =
            $result instanceof FinancePostingLog
                ? (
                    $result->failure_message
                    ?: 'Finance posting was quarantined.'
                )
                : 'Finance posting did not return a posted journal.';

        throw ValidationException::withMessages([
            'accounting' => [
                $context
                . ' accounting posting failed: '
                . $message,
            ],
        ]);
    }
}
