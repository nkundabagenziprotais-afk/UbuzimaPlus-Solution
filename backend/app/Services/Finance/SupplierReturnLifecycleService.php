<?php

namespace App\Services\Finance;

use App\Data\Finance\FinanceJournalLinePayload;
use App\Data\Finance\FinancePostingPayload;
use App\Models\FinanceJournalEntry;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use RuntimeException;

final class SupplierReturnLifecycleService
{
    public function __construct(
        private readonly FinancePostingService $postingService,
    ) {
    }

    public function index(
        int $tenantId,
        int $branchId,
        ?int $supplierId = null,
    ): array {
        $query = DB::table('pharmaco_supplier_returns as returns')
            ->leftJoin(
                'pharmaco_suppliers as suppliers',
                'suppliers.id',
                '=',
                'returns.pharmaco_supplier_id'
            )
            ->leftJoin(
                'pharmaco_purchase_orders as po',
                'po.id',
                '=',
                'returns.pharmaco_purchase_order_id'
            )
            ->leftJoin(
                'pharmaco_goods_receipts as grn',
                'grn.id',
                '=',
                'returns.pharmaco_goods_receipt_id'
            )
            ->leftJoin(
                'pharmaco_supplier_invoices as invoices',
                'invoices.id',
                '=',
                'returns.pharmaco_supplier_invoice_id'
            )
            ->where('returns.tenant_id', $tenantId)
            ->where('returns.branch_id', $branchId);

        if ($supplierId !== null) {
            $query->where(
                'returns.pharmaco_supplier_id',
                $supplierId
            );
        }

        return $query
            ->orderByDesc('returns.id')
            ->select([
                'returns.*',
                'suppliers.name as supplier_name',
                'po.po_number',
                'grn.receipt_number as grn_number',
                'invoices.invoice_number',
                'invoices.supplier_invoice_number',
            ])
            ->get()
            ->map(
                fn (object $row): array =>
                    (array) $row
            )
            ->all();
    }

    public function show(
        int $tenantId,
        int $branchId,
        int $returnId,
    ): array {
        $return = $this->scopedReturn(
            $tenantId,
            $branchId,
            $returnId
        );

        return [
            'return' => (array) $return,

            'items' =>
                DB::table('pharmaco_supplier_return_items')
                    ->where(
                        'pharmaco_supplier_return_id',
                        $returnId
                    )
                    ->orderBy('id')
                    ->get()
                    ->map(
                        fn (object $row): array =>
                            (array) $row
                    )
                    ->all(),

            'events' =>
                DB::table('pharmaco_supplier_return_events')
                    ->where(
                        'pharmaco_supplier_return_id',
                        $returnId
                    )
                    ->orderBy('id')
                    ->get()
                    ->map(
                        fn (object $row): array =>
                            (array) $row
                    )
                    ->all(),
        ];
    }

    public function create(
        array $data,
        int $actorId,
    ): object {
        return DB::transaction(
            function () use ($data, $actorId): object {
                $tenantId =
                    (int) $data['tenant_id'];

                $branchId =
                    (int) $data['branch_id'];

                $supplierId =
                    (int) $data['supplier_id'];

                $purchaseOrderId =
                    (int) $data['purchase_order_id'];

                $goodsReceiptId =
                    (int) $data['goods_receipt_id'];

                $supplierInvoiceId =
                    (int) $data['supplier_invoice_id'];

                $idempotencyKey =
                    trim(
                        (string) $data['idempotency_key']
                    );

                $existing =
                    DB::table('pharmaco_supplier_returns')
                        ->where(
                            'tenant_id',
                            $tenantId
                        )
                        ->where(
                            'idempotency_key',
                            $idempotencyKey
                        )
                        ->first();

                if ($existing) {
                    return $existing;
                }

                $this->assertLineage(
                    $tenantId,
                    $branchId,
                    $supplierId,
                    $purchaseOrderId,
                    $goodsReceiptId,
                    $supplierInvoiceId
                );

                $returnNumber =
                    'SRET-'
                    . str_replace(
                        '-',
                        '',
                        (string) $data['business_date']
                    )
                    . '-T'
                    . $tenantId
                    . '-'
                    . Str::upper(
                        Str::random(8)
                    );

                $returnId =
                    DB::table(
                        'pharmaco_supplier_returns'
                    )
                        ->insertGetId([
                            'uuid' =>
                                (string) Str::uuid(),

                            'tenant_id' =>
                                $tenantId,

                            'branch_id' =>
                                $branchId,

                            'pharmaco_supplier_id' =>
                                $supplierId,

                            'pharmaco_purchase_order_id' =>
                                $purchaseOrderId,

                            'pharmaco_goods_receipt_id' =>
                                $goodsReceiptId,

                            'pharmaco_supplier_invoice_id' =>
                                $supplierInvoiceId,

                            'return_number' =>
                                $returnNumber,

                            'business_date' =>
                                $data['business_date'],

                            'reason_code' =>
                                $data['reason_code'] ?? null,

                            'notes' =>
                                $data['notes'] ?? null,

                            'status' =>
                                'draft',

                            'subtotal_amount' =>
                                0,

                            'tax_amount' =>
                                0,

                            'total_amount' =>
                                0,

                            'currency_code' =>
                                'RWF',

                            'idempotency_key' =>
                                $idempotencyKey,

                            'created_by' =>
                                $actorId,

                            'metadata' =>
                                json_encode(
                                    [
                                        'workflow' =>
                                            'supplier_return',

                                        'accounting_owner' =>
                                            'FinancePostingService',

                                        'physical_return' =>
                                            true,
                                    ],
                                    JSON_UNESCAPED_SLASHES
                                ),

                            'created_at' =>
                                now(),

                            'updated_at' =>
                                now(),
                        ]);

                $return =
                    $this->scopedReturn(
                        $tenantId,
                        $branchId,
                        $returnId
                    );

                $subtotal = 0.0;
                $tax = 0.0;

                foreach (
                    $data['items']
                    as $input
                ) {
                    $validated =
                        $this->validateItem(
                            $return,
                            $input,
                            false
                        );

                    $subtotal +=
                        $validated['subtotal'];

                    $tax +=
                        $validated['tax'];

                    DB::table(
                        'pharmaco_supplier_return_items'
                    )
                        ->insert([
                            'uuid' =>
                                (string) Str::uuid(),

                            'tenant_id' =>
                                $tenantId,

                            'branch_id' =>
                                $branchId,

                            'pharmaco_supplier_return_id' =>
                                $returnId,

                            'pharmaco_purchase_order_item_id' =>
                                $validated['purchase_order_item_id'],

                            'pharmaco_goods_receipt_item_id' =>
                                $validated['goods_receipt_item_id'],

                            'pharmaco_supplier_invoice_item_id' =>
                                $validated['supplier_invoice_item_id'],

                            'product_id' =>
                                $validated['product_id'],

                            'stock_batch_id' =>
                                $validated['stock_batch_id'],

                            'batch_number' =>
                                $validated['batch_number'],

                            'expiry_date' =>
                                $validated['expiry_date'],

                            'quantity' =>
                                $validated['quantity'],

                            'unit_cost' =>
                                $validated['unit_cost'],

                            'tax_amount' =>
                                $validated['tax'],

                            'line_total' =>
                                $validated['line_total'],

                            'reason_code' =>
                                $input['reason_code']
                                    ?? $data['reason_code']
                                    ?? null,

                            'metadata' =>
                                json_encode(
                                    [
                                        'source' =>
                                            'supplier_return',

                                        'grn_quantity_received' =>
                                            $validated[
                                                'quantity_received'
                                            ],

                                        'available_stock_at_creation' =>
                                            $validated[
                                                'available_stock'
                                            ],
                                    ],
                                    JSON_UNESCAPED_SLASHES
                                ),

                            'created_at' =>
                                now(),

                            'updated_at' =>
                                now(),
                        ]);
                }

                $subtotal =
                    round($subtotal, 2);

                $tax =
                    round($tax, 2);

                $total =
                    round(
                        $subtotal + $tax,
                        2
                    );

                DB::table(
                    'pharmaco_supplier_returns'
                )
                    ->where('id', $returnId)
                    ->update([
                        'subtotal_amount' =>
                            $subtotal,

                        'tax_amount' =>
                            $tax,

                        'total_amount' =>
                            $total,

                        'updated_at' =>
                            now(),
                    ]);

                $this->recordEvent(
                    $tenantId,
                    $branchId,
                    $returnId,
                    'created',
                    $actorId,
                    [
                        'return_number' =>
                            $returnNumber,

                        'subtotal_amount' =>
                            $subtotal,

                        'tax_amount' =>
                            $tax,

                        'total_amount' =>
                            $total,
                    ]
                );

                return $this->scopedReturn(
                    $tenantId,
                    $branchId,
                    $returnId
                );
            }
        );
    }

    public function submit(
        int $tenantId,
        int $branchId,
        int $returnId,
        int $actorId,
    ): object {
        return DB::transaction(
            function () use (
                $tenantId,
                $branchId,
                $returnId,
                $actorId
            ): object {
                $return =
                    DB::table(
                        'pharmaco_supplier_returns'
                    )
                        ->where(
                            'tenant_id',
                            $tenantId
                        )
                        ->where(
                            'branch_id',
                            $branchId
                        )
                        ->where(
                            'id',
                            $returnId
                        )
                        ->lockForUpdate()
                        ->first();

                if (! $return) {
                    throw ValidationException::withMessages([
                        'supplier_return' =>
                            'Supplier Return not found in the verified branch scope.',
                    ]);
                }

                if (
                    in_array(
                        (string) $return->status,
                        ['submitted', 'approved'],
                        true
                    )
                ) {
                    return $return;
                }

                if (
                    (string) $return->status
                    !== 'draft'
                ) {
                    throw ValidationException::withMessages([
                        'status' =>
                            'Only a draft Supplier Return may be submitted.',
                    ]);
                }

                $this->revalidateStoredItems(
                    $return,
                    false
                );

                DB::table(
                    'pharmaco_supplier_returns'
                )
                    ->where('id', $returnId)
                    ->update([
                        'status' =>
                            'submitted',

                        'submitted_by' =>
                            $actorId,

                        'submitted_at' =>
                            now(),

                        'updated_at' =>
                            now(),
                    ]);

                $this->recordEvent(
                    $tenantId,
                    $branchId,
                    $returnId,
                    'submitted',
                    $actorId,
                    []
                );

                return $this->scopedReturn(
                    $tenantId,
                    $branchId,
                    $returnId
                );
            }
        );
    }

    public function approve(
        int $tenantId,
        int $branchId,
        int $returnId,
        int $actorId,
    ): object {
        return DB::transaction(
            function () use (
                $tenantId,
                $branchId,
                $returnId,
                $actorId
            ): object {
                $return =
                    DB::table(
                        'pharmaco_supplier_returns'
                    )
                        ->where(
                            'tenant_id',
                            $tenantId
                        )
                        ->where(
                            'branch_id',
                            $branchId
                        )
                        ->where(
                            'id',
                            $returnId
                        )
                        ->lockForUpdate()
                        ->first();

                if (! $return) {
                    throw ValidationException::withMessages([
                        'supplier_return' =>
                            'Supplier Return not found in the verified branch scope.',
                    ]);
                }

                if (
                    (string) $return->status
                    === 'approved'
                ) {
                    return $return;
                }

                if (
                    (string) $return->status
                    !== 'submitted'
                ) {
                    throw ValidationException::withMessages([
                        'status' =>
                            'Only a submitted Supplier Return may be approved.',
                    ]);
                }

                if (
                    (
                        (int) $return->submitted_by === $actorId
                        && ! \App\Support\MakerCheckerExemptionPolicy::allows(
                            $actorId,
                            isset($return->tenant_id)
                                ? (int) $return->tenant_id
                                : null,
                            isset($return->branch_id)
                                ? (int) $return->branch_id
                                : null
                        )
                    )
                ) {
                    throw ValidationException::withMessages([
                        'approval' =>
                            'Maker-checker control requires a different authorized user to approve the Supplier Return.',
                    ]);
                }

                $this->assertOpenPeriod(
                    $tenantId,
                    $branchId,
                    (string) $return->business_date
                );

                $validatedItems =
                    $this->revalidateStoredItems(
                        $return,
                        true
                    );

                $creditNumber =
                    'SCN-RET-'
                    . $return->id;

                $creditId =
                    DB::table(
                        'pharmaco_supplier_credit_notes'
                    )
                        ->insertGetId([
                            'uuid' =>
                                (string) Str::uuid(),

                            'tenant_id' =>
                                $tenantId,

                            'branch_id' =>
                                $branchId,

                            'pharmaco_supplier_id' =>
                                $return->pharmaco_supplier_id,

                            'pharmaco_supplier_invoice_id' =>
                                $return->pharmaco_supplier_invoice_id,

                            'pharmaco_purchase_order_id' =>
                                $return->pharmaco_purchase_order_id,

                            'credit_number' =>
                                $creditNumber,

                            'supplier_credit_number' =>
                                null,

                            'status' =>
                                'draft',

                            'credit_date' =>
                                $return->business_date,

                            'reason_code' =>
                                $return->reason_code
                                    ?: 'supplier_return',

                            'subtotal_amount' =>
                                $return->subtotal_amount,

                            'tax_amount' =>
                                $return->tax_amount,

                            'total_amount' =>
                                $return->total_amount,

                            'applied_amount' =>
                                0,

                            'balance_amount' =>
                                $return->total_amount,

                            'currency_code' =>
                                $return->currency_code
                                    ?: 'RWF',

                            'exchange_rate' =>
                                1,

                            'accounting_status' =>
                                'unposted',

                            'idempotency_key' =>
                                'supplier-return-credit-'
                                . $return->id,

                            'notes' =>
                                'Generated by approved physical Supplier Return '
                                . $return->return_number,

                            'metadata' =>
                                json_encode(
                                    [
                                        'supplier_return_id' =>
                                            $return->id,

                                        'supplier_return_number' =>
                                            $return->return_number,

                                        'physical_stock_return' =>
                                            true,
                                    ],
                                    JSON_UNESCAPED_SLASHES
                                ),

                            'created_at' =>
                                now(),

                            'updated_at' =>
                                now(),
                        ]);

                foreach (
                    $validatedItems
                    as $item
                ) {
                    $batch =
                        $item['batch'];

                    $quantity =
                        $item['quantity'];

                    $before =
                        (float)
                        $batch->quantity_on_hand;

                    $after =
                        round(
                            $before - $quantity,
                            4
                        );

                    if (
                        $after
                        <
                        (float)
                        $batch->quantity_reserved
                    ) {
                        throw ValidationException::withMessages([
                            'quantity' =>
                                'Supplier Return would reduce stock below the reserved quantity.',
                        ]);
                    }

                    DB::table(
                        'stock_batches'
                    )
                        ->where(
                            'id',
                            $batch->id
                        )
                        ->update([
                            'quantity_on_hand' =>
                                $after,

                            'updated_at' =>
                                now(),
                        ]);

                    $movementId =
                        DB::table(
                            'stock_movements'
                        )
                            ->insertGetId([
                                'uuid' =>
                                    (string) Str::uuid(),

                                'tenant_id' =>
                                    $tenantId,

                                'branch_id' =>
                                    $branchId,

                                'stock_location_id' =>
                                    $batch->stock_location_id,

                                'product_id' =>
                                    $batch->product_id,

                                'stock_batch_id' =>
                                    $batch->id,

                                'movement_type' =>
                                    'return_to_supplier',

                                'quantity' =>
                                    -1 * $quantity,

                                'running_balance' =>
                                    $after,

                                'reference_type' =>
                                    'pharmaco_supplier_return',

                                'reference_number' =>
                                    $return->return_number,

                                'reason' =>
                                    'Physical stock returned to supplier under approved Supplier Return.',

                                'performed_by' =>
                                    $actorId,

                                'occurred_at' =>
                                    now(),

                                'business_date' =>
                                    $return->business_date,

                                'entry_mode' =>
                                    'live',

                                'metadata' =>
                                    json_encode(
                                        [
                                            'supplier_return_id' =>
                                                $return->id,

                                            'goods_receipt_item_id' =>
                                                $item[
                                                    'goods_receipt_item_id'
                                                ],

                                            'supplier_invoice_item_id' =>
                                                $item[
                                                    'supplier_invoice_item_id'
                                                ],

                                            'before_quantity' =>
                                                $before,

                                            'after_quantity' =>
                                                $after,

                                            'unit_cost' =>
                                                $item['unit_cost'],
                                        ],
                                        JSON_UNESCAPED_SLASHES
                                    ),

                                'created_at' =>
                                    now(),

                                'updated_at' =>
                                    now(),
                            ]);

                    DB::table(
                        'pharmaco_supplier_credit_note_items'
                    )
                        ->insert([
                            'uuid' =>
                                (string) Str::uuid(),

                            'tenant_id' =>
                                $tenantId,

                            'branch_id' =>
                                $branchId,

                            'pharmaco_supplier_credit_note_id' =>
                                $creditId,

                            'pharmaco_supplier_invoice_item_id' =>
                                $item[
                                    'supplier_invoice_item_id'
                                ],

                            'pharmaco_goods_receipt_item_id' =>
                                $item[
                                    'goods_receipt_item_id'
                                ],

                            'product_id' =>
                                $item['product_id'],

                            'description' =>
                                'Physical Supplier Return '
                                . $return->return_number
                                . ' / batch '
                                . $item['batch_number'],

                            'quantity' =>
                                $quantity,

                            'unit_cost' =>
                                $item['unit_cost'],

                            'tax_amount' =>
                                $item['tax'],

                            'line_total' =>
                                $item['line_total'],

                            'stock_return_required' =>
                                1,

                            'metadata' =>
                                json_encode(
                                    [
                                        'supplier_return_id' =>
                                            $return->id,

                                        'stock_batch_id' =>
                                            $batch->id,

                                        'stock_movement_id' =>
                                            $movementId,

                                        'batch_number' =>
                                            $item['batch_number'],

                                        'expiry_date' =>
                                            $item['expiry_date'],
                                    ],
                                    JSON_UNESCAPED_SLASHES
                                ),

                            'created_at' =>
                                now(),

                            'updated_at' =>
                                now(),
                        ]);

                    DB::table(
                        'pharmaco_supplier_return_items'
                    )
                        ->where(
                            'id',
                            $item['return_item_id']
                        )
                        ->update([
                            'stock_movement_id' =>
                                $movementId,

                            'updated_at' =>
                                now(),
                        ]);
                }

                $financeLines = [
                    new FinanceJournalLinePayload(
                        mappingKey:
                            'supplier.ap',

                        debit:
                            (float)
                            $return->total_amount,

                        description:
                            'Supplier Return '
                            . $return->return_number
                            . ' — Accounts Payable reduction',

                        lineType:
                            'supplier_return_ap',

                        branchId:
                            $branchId,

                        supplierId:
                            (int)
                            $return->pharmaco_supplier_id,

                        metadata: [
                            'supplier_return_id' =>
                                $return->id,

                            'supplier_credit_note_id' =>
                                $creditId,
                        ],
                    ),

                    new FinanceJournalLinePayload(
                        mappingKey:
                            'inventory.asset',

                        credit:
                            (float)
                            $return->subtotal_amount,

                        description:
                            'Supplier Return '
                            . $return->return_number
                            . ' — inventory reversal',

                        lineType:
                            'supplier_return_inventory',

                        branchId:
                            $branchId,

                        supplierId:
                            (int)
                            $return->pharmaco_supplier_id,

                        metadata: [
                            'supplier_return_id' =>
                                $return->id,

                            'supplier_credit_note_id' =>
                                $creditId,
                        ],
                    ),
                ];

                if (
                    (float)
                    $return->tax_amount
                    > 0
                ) {
                    $financeLines[] =
                        new FinanceJournalLinePayload(
                            mappingKey:
                                'tax.vat_input',

                            credit:
                                (float)
                                $return->tax_amount,

                            description:
                                'Supplier Return '
                                . $return->return_number
                                . ' — input VAT reversal',

                            lineType:
                                'supplier_return_vat',

                            branchId:
                                $branchId,

                            supplierId:
                                (int)
                                $return->pharmaco_supplier_id,

                            metadata: [
                                'supplier_return_id' =>
                                    $return->id,

                                'supplier_credit_note_id' =>
                                    $creditId,
                            ],
                        );
                }

                $posting =
                    $this->postingService->post(
                        new FinancePostingPayload(
                            tenantId:
                                $tenantId,

                            branchId:
                                $branchId,

                            businessDate:
                                (string)
                                $return->business_date,

                            sourceModule:
                                'procurement',

                            sourceType:
                                'supplier_return',

                            sourceId:
                                (string)
                                $return->id,

                            idempotencyKey:
                                'supplier-return-posting-'
                                . $return->id,

                            lines:
                                $financeLines,

                            currencyCode:
                                $return->currency_code
                                    ?: 'RWF',

                            exchangeRate:
                                1,

                            memo:
                                'Physical Supplier Return '
                                . $return->return_number,

                            createdBy:
                                $actorId,

                            sourceSnapshot: [
                                'supplier_return_id' =>
                                    $return->id,

                                'supplier_return_number' =>
                                    $return->return_number,

                                'supplier_id' =>
                                    $return->pharmaco_supplier_id,

                                'purchase_order_id' =>
                                    $return->pharmaco_purchase_order_id,

                                'goods_receipt_id' =>
                                    $return->pharmaco_goods_receipt_id,

                                'supplier_invoice_id' =>
                                    $return->pharmaco_supplier_invoice_id,

                                'supplier_credit_note_id' =>
                                    $creditId,
                            ],

                            metadata: [
                                'physical_stock_return' =>
                                    true,

                                'maker_checker' =>
                                    true,

                                'inventory_and_ap_atomic' =>
                                    true,
                            ],

                            mode:
                                'live',
                        )
                    );

                if (
                    ! $posting
                        instanceof
                        FinanceJournalEntry
                    ||
                    strtolower(
                        (string)
                        $posting->status
                    )
                    !== 'posted'
                ) {
                    throw new RuntimeException(
                        'Supplier Return FinancePostingService posting did not complete as a posted journal. Entire physical return has been rolled back.'
                    );
                }

                DB::table(
                    'pharmaco_supplier_credit_notes'
                )
                    ->where('id', $creditId)
                    ->update([
                        'status' =>
                            'approved',

                        'accounting_status' =>
                            'posted',

                        'approved_by' =>
                            $actorId,

                        'approved_at' =>
                            now(),

                        'finance_journal_entry_id' =>
                            $posting->id,

                        'finance_posted_at' =>
                            now(),

                        'updated_at' =>
                            now(),
                    ]);

                DB::table(
                    'pharmaco_supplier_returns'
                )
                    ->where('id', $returnId)
                    ->update([
                        'status' =>
                            'approved',

                        'approved_by' =>
                            $actorId,

                        'approved_at' =>
                            now(),

                        'pharmaco_supplier_credit_note_id' =>
                            $creditId,

                        'finance_journal_entry_id' =>
                            $posting->id,

                        'updated_at' =>
                            now(),
                    ]);

                $this->recordEvent(
                    $tenantId,
                    $branchId,
                    $returnId,
                    'approved_and_posted',
                    $actorId,
                    [
                        'supplier_credit_note_id' =>
                            $creditId,

                        'finance_journal_entry_id' =>
                            $posting->id,

                        'stock_return' =>
                            'completed',

                        'ap_reduction' =>
                            'completed',
                    ]
                );

                return $this->scopedReturn(
                    $tenantId,
                    $branchId,
                    $returnId
                );
            }
        );
    }

    public function reject(
        int $tenantId,
        int $branchId,
        int $returnId,
        int $actorId,
        string $reason,
    ): object {
        return DB::transaction(
            function () use (
                $tenantId,
                $branchId,
                $returnId,
                $actorId,
                $reason
            ): object {
                $return =
                    DB::table(
                        'pharmaco_supplier_returns'
                    )
                        ->where(
                            'tenant_id',
                            $tenantId
                        )
                        ->where(
                            'branch_id',
                            $branchId
                        )
                        ->where(
                            'id',
                            $returnId
                        )
                        ->lockForUpdate()
                        ->first();

                if (! $return) {
                    throw ValidationException::withMessages([
                        'supplier_return' =>
                            'Supplier Return not found.',
                    ]);
                }

                if (
                    (string)
                    $return->status
                    === 'rejected'
                ) {
                    return $return;
                }

                if (
                    (string)
                    $return->status
                    !== 'submitted'
                ) {
                    throw ValidationException::withMessages([
                        'status' =>
                            'Only a submitted Supplier Return may be rejected.',
                    ]);
                }

                if (
                    (
                        (int) $return->submitted_by === $actorId
                        && ! \App\Support\MakerCheckerExemptionPolicy::allows(
                            $actorId,
                            isset($return->tenant_id)
                                ? (int) $return->tenant_id
                                : null,
                            isset($return->branch_id)
                                ? (int) $return->branch_id
                                : null
                        )
                    )
                ) {
                    throw ValidationException::withMessages([
                        'approval' =>
                            'Maker-checker control requires another authorized user to reject the Supplier Return.',
                    ]);
                }

                DB::table(
                    'pharmaco_supplier_returns'
                )
                    ->where('id', $returnId)
                    ->update([
                        'status' =>
                            'rejected',

                        'rejected_by' =>
                            $actorId,

                        'rejected_at' =>
                            now(),

                        'rejection_reason' =>
                            trim($reason),

                        'updated_at' =>
                            now(),
                    ]);

                $this->recordEvent(
                    $tenantId,
                    $branchId,
                    $returnId,
                    'rejected',
                    $actorId,
                    [
                        'reason' =>
                            trim($reason),
                    ]
                );

                return $this->scopedReturn(
                    $tenantId,
                    $branchId,
                    $returnId
                );
            }
        );
    }

    private function assertLineage(
        int $tenantId,
        int $branchId,
        int $supplierId,
        int $purchaseOrderId,
        int $goodsReceiptId,
        int $supplierInvoiceId,
    ): void {
        $supplier =
            DB::table('pharmaco_suppliers')
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->where(
                    'id',
                    $supplierId
                )
                ->first();

        if (! $supplier) {
            throw ValidationException::withMessages([
                'supplier_id' =>
                    'Supplier is outside the verified tenant scope.',
            ]);
        }

        $branch =
            DB::table('branches')
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->where(
                    'id',
                    $branchId
                )
                ->first();

        if (! $branch) {
            throw ValidationException::withMessages([
                'branch_id' =>
                    'Branch is outside the verified tenant scope.',
            ]);
        }

        $po =
            DB::table(
                'pharmaco_purchase_orders'
            )
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->where(
                    'branch_id',
                    $branchId
                )
                ->where(
                    'pharmaco_supplier_id',
                    $supplierId
                )
                ->where(
                    'id',
                    $purchaseOrderId
                )
                ->first();

        if (! $po) {
            throw ValidationException::withMessages([
                'purchase_order_id' =>
                    'Purchase Order does not match the verified tenant, branch and supplier.',
            ]);
        }

        $grn =
            DB::table(
                'pharmaco_goods_receipts'
            )
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->where(
                    'branch_id',
                    $branchId
                )
                ->where(
                    'pharmaco_supplier_id',
                    $supplierId
                )
                ->where(
                    'pharmaco_purchase_order_id',
                    $purchaseOrderId
                )
                ->where(
                    'id',
                    $goodsReceiptId
                )
                ->first();

        if (! $grn) {
            throw ValidationException::withMessages([
                'goods_receipt_id' =>
                    'Goods Receipt does not match the verified Purchase Order and supplier.',
            ]);
        }

        $invoice =
            DB::table(
                'pharmaco_supplier_invoices'
            )
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->where(
                    'pharmaco_supplier_id',
                    $supplierId
                )
                ->where(
                    'pharmaco_purchase_order_id',
                    $purchaseOrderId
                )
                ->where(
                    'id',
                    $supplierInvoiceId
                )
                ->first();

        if (! $invoice) {
            throw ValidationException::withMessages([
                'supplier_invoice_id' =>
                    'Supplier Bill does not match the verified Purchase Order and supplier.',
            ]);
        }
    }

    private function validateItem(
        object $return,
        array|object $input,
        bool $lockBatch,
    ): array {
        $get =
            static function (
                array|object $value,
                string $key
            ): mixed {
                return is_array($value)
                    ? ($value[$key] ?? null)
                    : ($value->{$key} ?? null);
            };

        $goodsReceiptItemId =
            (int)
            $get(
                $input,
                'goods_receipt_item_id'
            );

        if ($goodsReceiptItemId === 0) {
            $goodsReceiptItemId =
                (int)
                $get(
                    $input,
                    'pharmaco_goods_receipt_item_id'
                );
        }

        $supplierInvoiceItemId =
            (int)
            $get(
                $input,
                'supplier_invoice_item_id'
            );

        if ($supplierInvoiceItemId === 0) {
            $supplierInvoiceItemId =
                (int)
                $get(
                    $input,
                    'pharmaco_supplier_invoice_item_id'
                );
        }

        $productId =
            (int)
            $get(
                $input,
                'product_id'
            );

        $stockBatchId =
            (int)
            $get(
                $input,
                'stock_batch_id'
            );

        $quantity =
            (float)
            $get(
                $input,
                'quantity'
            );

        if ($quantity <= 0) {
            throw ValidationException::withMessages([
                'quantity' =>
                    'Supplier Return quantity must be greater than zero.',
            ]);
        }

        $grnItem =
            DB::table(
                'pharmaco_goods_receipt_items'
            )
                ->where(
                    'tenant_id',
                    $return->tenant_id
                )
                ->where(
                    'branch_id',
                    $return->branch_id
                )
                ->where(
                    'pharmaco_goods_receipt_id',
                    $return->pharmaco_goods_receipt_id
                )
                ->where(
                    'id',
                    $goodsReceiptItemId
                )
                ->first();

        if (! $grnItem) {
            throw ValidationException::withMessages([
                'goods_receipt_item_id' =>
                    'Goods Receipt line is outside the verified Supplier Return lineage.',
            ]);
        }

        if (
            (int)
            $grnItem->product_id
            !== $productId
        ) {
            throw ValidationException::withMessages([
                'product_id' =>
                    'Returned product does not match the Goods Receipt line.',
            ]);
        }

        if (
            (int)
            $grnItem->stock_batch_id
            !== $stockBatchId
        ) {
            throw ValidationException::withMessages([
                'stock_batch_id' =>
                    'Returned batch does not match the original Goods Receipt batch.',
            ]);
        }

        $poItemId =
            (int)
            $grnItem->pharmaco_purchase_order_item_id;

        $poItem =
            DB::table(
                'pharmaco_purchase_order_items'
            )
                ->where(
                    'tenant_id',
                    $return->tenant_id
                )
                ->where(
                    'pharmaco_purchase_order_id',
                    $return->pharmaco_purchase_order_id
                )
                ->where(
                    'id',
                    $poItemId
                )
                ->where(
                    'product_id',
                    $productId
                )
                ->first();

        if (! $poItem) {
            throw ValidationException::withMessages([
                'purchase_order_item_id' =>
                    'Purchase Order line does not match the Goods Receipt line.',
            ]);
        }

        $invoiceItem =
            DB::table(
                'pharmaco_supplier_invoice_items'
            )
                ->where(
                    'tenant_id',
                    $return->tenant_id
                )
                ->where(
                    'pharmaco_supplier_invoice_id',
                    $return->pharmaco_supplier_invoice_id
                )
                ->where(
                    'pharmaco_purchase_order_item_id',
                    $poItemId
                )
                ->where(
                    'product_id',
                    $productId
                )
                ->where(
                    'id',
                    $supplierInvoiceItemId
                )
                ->first();

        if (! $invoiceItem) {
            throw ValidationException::withMessages([
                'supplier_invoice_item_id' =>
                    'Supplier Bill line does not match the PO and GRN lineage.',
            ]);
        }

        $batchQuery =
            DB::table(
                'stock_batches'
            )
                ->where(
                    'tenant_id',
                    $return->tenant_id
                )
                ->where(
                    'branch_id',
                    $return->branch_id
                )
                ->where(
                    'product_id',
                    $productId
                )
                ->where(
                    'id',
                    $stockBatchId
                );

        if ($lockBatch) {
            $batchQuery->lockForUpdate();
        }

        $batch =
            $batchQuery->first();

        if (! $batch) {
            throw ValidationException::withMessages([
                'stock_batch_id' =>
                    'Stock batch is outside the verified tenant/branch/product scope.',
            ]);
        }

        if (
            trim(
                (string)
                $grnItem->batch_number
            ) !== ''
            &&
            trim(
                (string)
                $grnItem->batch_number
            )
            !==
            trim(
                (string)
                $batch->batch_number
            )
        ) {
            throw ValidationException::withMessages([
                'batch_number' =>
                    'Current stock batch number differs from the original Goods Receipt.',
            ]);
        }

        if (
            $grnItem->expiry_date
            &&
            $batch->expiry_date
            &&
            (string)
            $grnItem->expiry_date
            !==
            (string)
            $batch->expiry_date
        ) {
            throw ValidationException::withMessages([
                'expiry_date' =>
                    'Current stock expiry differs from the original Goods Receipt.',
            ]);
        }

        $alreadyCommitted =
            (float)
            DB::table(
                'pharmaco_supplier_return_items as return_items'
            )
                ->join(
                    'pharmaco_supplier_returns as returns',
                    'returns.id',
                    '=',
                    'return_items.pharmaco_supplier_return_id'
                )
                ->where(
                    'return_items.pharmaco_goods_receipt_item_id',
                    $goodsReceiptItemId
                )
                ->whereIn(
                    'returns.status',
                    ['submitted', 'approved']
                )
                ->where(
                    'returns.id',
                    '<>',
                    $return->id
                )
                ->sum(
                    'return_items.quantity'
                );

        $originalReceived =
            (float)
            $grnItem->quantity_received;

        if (
            $quantity
            >
            ($originalReceived - $alreadyCommitted)
            + 0.0001
        ) {
            throw ValidationException::withMessages([
                'quantity' =>
                    'Supplier Return quantity exceeds the unreturned quantity from the original Goods Receipt.',
            ]);
        }

        $availableStock =
            round(
                (float)
                $batch->quantity_on_hand
                -
                (float)
                $batch->quantity_reserved,
                4
            );

        if (
            $quantity
            >
            $availableStock
            + 0.0001
        ) {
            throw ValidationException::withMessages([
                'quantity' =>
                    'Supplier Return quantity exceeds currently available physical stock after reservations.',
            ]);
        }

        $unitCost =
            (float)
            $grnItem->unit_cost;

        if ($unitCost <= 0) {
            throw ValidationException::withMessages([
                'unit_cost' =>
                    'Original Goods Receipt unit cost is missing or invalid.',
            ]);
        }

        $subtotal =
            round(
                $quantity * $unitCost,
                2
            );

        $taxPerUnit =
            $originalReceived > 0
                ? (
                    (float)
                    $grnItem->tax_amount
                    /
                    $originalReceived
                )
                : 0;

        $tax =
            round(
                $quantity * $taxPerUnit,
                2
            );

        return [
            'return_item_id' =>
                (int)
                $get(
                    $input,
                    'id'
                ),

            'purchase_order_item_id' =>
                $poItemId,

            'goods_receipt_item_id' =>
                $goodsReceiptItemId,

            'supplier_invoice_item_id' =>
                $supplierInvoiceItemId,

            'product_id' =>
                $productId,

            'stock_batch_id' =>
                $stockBatchId,

            'batch_number' =>
                (string)
                $batch->batch_number,

            'expiry_date' =>
                $batch->expiry_date,

            'quantity' =>
                $quantity,

            'quantity_received' =>
                $originalReceived,

            'available_stock' =>
                $availableStock,

            'unit_cost' =>
                $unitCost,

            'subtotal' =>
                $subtotal,

            'tax' =>
                $tax,

            'line_total' =>
                round(
                    $subtotal + $tax,
                    2
                ),

            'batch' =>
                $batch,
        ];
    }

    private function revalidateStoredItems(
        object $return,
        bool $lockBatch,
    ): array {
        $rows =
            DB::table(
                'pharmaco_supplier_return_items'
            )
                ->where(
                    'pharmaco_supplier_return_id',
                    $return->id
                )
                ->orderBy('id')
                ->get();

        if ($rows->isEmpty()) {
            throw ValidationException::withMessages([
                'items' =>
                    'Supplier Return has no lines.',
            ]);
        }

        $validated = [];

        foreach ($rows as $row) {
            $validated[] =
                $this->validateItem(
                    $return,
                    $row,
                    $lockBatch
                );
        }

        return $validated;
    }

    private function assertOpenPeriod(
        int $tenantId,
        int $branchId,
        string $businessDate,
    ): void {
        $exists =
            DB::table(
                'finance_accounting_periods'
            )
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->where(
                    'starts_on',
                    '<=',
                    $businessDate
                )
                ->where(
                    'ends_on',
                    '>=',
                    $businessDate
                )
                ->where(
                    'status',
                    'open'
                )
                ->where(
                    'is_locked',
                    0
                )
                ->where(
                    function ($query) use ($branchId): void {
                        $query
                            ->whereNull(
                                'branch_id'
                            )
                            ->orWhere(
                                'branch_id',
                                $branchId
                            );
                    }
                )
                ->exists();

        if (! $exists) {
            throw ValidationException::withMessages([
                'business_date' =>
                    'Supplier Return cannot post because the accounting period is closed, locked or unavailable.',
            ]);
        }
    }

    private function scopedReturn(
        int $tenantId,
        int $branchId,
        int $returnId,
    ): object {
        $return =
            DB::table(
                'pharmaco_supplier_returns'
            )
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->where(
                    'branch_id',
                    $branchId
                )
                ->where(
                    'id',
                    $returnId
                )
                ->first();

        if (! $return) {
            throw ValidationException::withMessages([
                'supplier_return' =>
                    'Supplier Return not found in the verified branch scope.',
            ]);
        }

        return $return;
    }

    private function recordEvent(
        int $tenantId,
        int $branchId,
        int $returnId,
        string $eventType,
        ?int $actorId,
        array $payload,
    ): void {
        DB::table(
            'pharmaco_supplier_return_events'
        )
            ->insert([
                'uuid' =>
                    (string) Str::uuid(),

                'tenant_id' =>
                    $tenantId,

                'branch_id' =>
                    $branchId,

                'pharmaco_supplier_return_id' =>
                    $returnId,

                'event_type' =>
                    $eventType,

                'actor_id' =>
                    $actorId,

                'payload' =>
                    json_encode(
                        $payload,
                        JSON_UNESCAPED_SLASHES
                    ),

                'occurred_at' =>
                    now(),

                'created_at' =>
                    now(),

                'updated_at' =>
                    now(),
            ]);
    }
}
