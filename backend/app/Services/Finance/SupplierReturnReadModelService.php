<?php

namespace App\Services\Finance;

use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final class SupplierReturnReadModelService
{
    public function referenceData(
        int $tenantId,
        ?int $requestedBranchId = null,
    ): array {
        $branchQuery =
            DB::table('branches')
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->orderBy('id');

        if ($requestedBranchId !== null) {
            $branchQuery->where(
                'id',
                $requestedBranchId
            );
        }

        $branch =
            $branchQuery->first();

        if (! $branch) {
            throw ValidationException::withMessages([
                'branch_id' =>
                    'No eligible branch is available in the verified tenant scope.',
            ]);
        }

        $branchId =
            (int) $branch->id;

        $suppliers =
            DB::table('pharmaco_suppliers')
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->where(
                    'status',
                    'active'
                )
                ->orderBy('name')
                ->select([
                    'id',
                    'supplier_code',
                    'name',
                    'legal_name',
                    'payment_terms',
                    'status',
                ])
                ->get();

        /*
         * Returnable source-line candidates.
         *
         * One candidate preserves:
         * Supplier -> PO -> GRN -> Supplier Bill
         * -> product -> exact stock batch -> expiry.
         */
        $rows =
            DB::table(
                'pharmaco_goods_receipt_items as gri'
            )
                ->join(
                    'pharmaco_goods_receipts as grn',
                    'grn.id',
                    '=',
                    'gri.pharmaco_goods_receipt_id'
                )
                ->join(
                    'pharmaco_purchase_orders as po',
                    'po.id',
                    '=',
                    'grn.pharmaco_purchase_order_id'
                )
                ->join(
                    'pharmaco_suppliers as supplier',
                    'supplier.id',
                    '=',
                    'grn.pharmaco_supplier_id'
                )
                ->join(
                    'pharmaco_supplier_invoice_items as sii',
                    function ($join): void {
                        $join
                            ->on(
                                'sii.pharmaco_purchase_order_item_id',
                                '=',
                                'gri.pharmaco_purchase_order_item_id'
                            )
                            ->on(
                                'sii.product_id',
                                '=',
                                'gri.product_id'
                            );
                    }
                )
                ->join(
                    'pharmaco_supplier_invoices as invoice',
                    function ($join): void {
                        $join
                            ->on(
                                'invoice.id',
                                '=',
                                'sii.pharmaco_supplier_invoice_id'
                            )
                            ->on(
                                'invoice.pharmaco_purchase_order_id',
                                '=',
                                'po.id'
                            )
                            ->on(
                                'invoice.pharmaco_supplier_id',
                                '=',
                                'supplier.id'
                            );
                    }
                )
                ->join(
                    'stock_batches as batch',
                    'batch.id',
                    '=',
                    'gri.stock_batch_id'
                )
                ->leftJoin(
                    'products as product',
                    'product.id',
                    '=',
                    'gri.product_id'
                )
                ->where(
                    'grn.tenant_id',
                    $tenantId
                )
                ->where(
                    'grn.branch_id',
                    $branchId
                )
                ->where(
                    'po.tenant_id',
                    $tenantId
                )
                ->where(
                    'invoice.tenant_id',
                    $tenantId
                )
                ->where(
                    'batch.tenant_id',
                    $tenantId
                )
                ->where(
                    'batch.branch_id',
                    $branchId
                )
                ->where(
                    'batch.status',
                    'active'
                )
                ->where(
                    'batch.quantity_on_hand',
                    '>',
                    0
                )
                ->whereIn(
                    'invoice.status',
                    ['approved', 'partially_paid', 'paid']
                )
                ->select([
                    'supplier.id as supplier_id',
                    'supplier.supplier_code',
                    'supplier.name as supplier_name',

                    'po.id as purchase_order_id',
                    'po.po_number',

                    'grn.id as goods_receipt_id',
                    'grn.receipt_number as grn_number',
                    'grn.receipt_date',

                    'invoice.id as supplier_invoice_id',
                    'invoice.invoice_number',
                    'invoice.supplier_invoice_number',
                    'invoice.invoice_date',

                    'gri.id as goods_receipt_item_id',
                    'sii.id as supplier_invoice_item_id',

                    'gri.product_id',
                    'product.name as product_name',

                    'gri.batch_number',
                    'gri.expiry_date',
                    'gri.quantity_received',
                    'gri.unit_cost',
                    'gri.tax_amount',

                    'batch.id as stock_batch_id',
                    'batch.quantity_on_hand',
                    'batch.quantity_reserved',
                    'batch.unit_cost as current_batch_unit_cost',
                ])
                ->orderByDesc(
                    'grn.receipt_date'
                )
                ->orderByDesc(
                    'grn.id'
                )
                ->get();

        $eligible = [];

        foreach ($rows as $row) {
            $alreadyCommitted =
                (float)
                DB::table(
                    'pharmaco_supplier_return_items as sri'
                )
                    ->join(
                        'pharmaco_supplier_returns as sr',
                        'sr.id',
                        '=',
                        'sri.pharmaco_supplier_return_id'
                    )
                    ->where(
                        'sri.pharmaco_goods_receipt_item_id',
                        $row->goods_receipt_item_id
                    )
                    ->whereIn(
                        'sr.status',
                        ['submitted', 'approved']
                    )
                    ->sum(
                        'sri.quantity'
                    );

            $received =
                (float)
                $row->quantity_received;

            $availableStock =
                max(
                    0,
                    (float)
                    $row->quantity_on_hand
                    -
                    (float)
                    $row->quantity_reserved
                );

            $remainingReceipt =
                max(
                    0,
                    $received - $alreadyCommitted
                );

            $returnable =
                min(
                    $remainingReceipt,
                    $availableStock
                );

            if ($returnable <= 0) {
                continue;
            }

            $taxPerUnit =
                $received > 0
                    ? (
                        (float)
                        $row->tax_amount
                        /
                        $received
                    )
                    : 0;

            $eligible[] = [
                'supplier_id' =>
                    (int) $row->supplier_id,

                'supplier_code' =>
                    $row->supplier_code,

                'supplier_name' =>
                    $row->supplier_name,

                'purchase_order_id' =>
                    (int) $row->purchase_order_id,

                'po_number' =>
                    $row->po_number,

                'goods_receipt_id' =>
                    (int) $row->goods_receipt_id,

                'grn_number' =>
                    $row->grn_number,

                'receipt_date' =>
                    $row->receipt_date,

                'supplier_invoice_id' =>
                    (int) $row->supplier_invoice_id,

                'invoice_number' =>
                    $row->invoice_number,

                'supplier_invoice_number' =>
                    $row->supplier_invoice_number,

                'invoice_date' =>
                    $row->invoice_date,

                'goods_receipt_item_id' =>
                    (int) $row->goods_receipt_item_id,

                'supplier_invoice_item_id' =>
                    (int) $row->supplier_invoice_item_id,

                'product_id' =>
                    (int) $row->product_id,

                'product_name' =>
                    $row->product_name
                    ?: 'Product #'
                    . $row->product_id,

                'stock_batch_id' =>
                    (int) $row->stock_batch_id,

                'batch_number' =>
                    $row->batch_number,

                'expiry_date' =>
                    $row->expiry_date,

                'quantity_received' =>
                    $received,

                'already_returned_or_submitted' =>
                    $alreadyCommitted,

                'quantity_on_hand' =>
                    (float)
                    $row->quantity_on_hand,

                'quantity_reserved' =>
                    (float)
                    $row->quantity_reserved,

                'available_stock' =>
                    $availableStock,

                'returnable_quantity' =>
                    $returnable,

                'unit_cost' =>
                    (float)
                    $row->unit_cost,

                'tax_per_unit' =>
                    round(
                        $taxPerUnit,
                        4
                    ),
            ];
        }

        return [
            'branch' => [
                'id' =>
                    $branchId,

                'name' =>
                    $branch->name ?? (
                        'Branch #'
                        . $branchId
                    ),

                'code' =>
                    $branch->code ?? null,
            ],

            'suppliers' =>
                $suppliers,

            'eligible_lines' =>
                $eligible,

            'controls' => [
                'physical_stock_required' =>
                    true,

                'maker_checker_required' =>
                    true,

                'batch_lineage_required' =>
                    true,

                'grn_lineage_required' =>
                    true,

                'supplier_bill_lineage_required' =>
                    true,

                'negative_stock_allowed' =>
                    false,
            ],
        ];
    }
}
