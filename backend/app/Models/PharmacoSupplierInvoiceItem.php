<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PharmacoSupplierInvoiceItem extends Model
{
    protected $fillable = [
        'uuid',
        'tenant_id',
        'pharmaco_supplier_invoice_id',
        'pharmaco_purchase_order_item_id',
        'product_id',
        'product_name_snapshot',
        'sku_snapshot',
        'quantity',
        'unit_cost',
        'discount_amount',
        'tax_amount',
        'line_total',
        'notes',
        'metadata',
    ];

    protected $casts = [
        'quantity' => 'decimal:3',
        'unit_cost' => 'decimal:2',
        'discount_amount' => 'decimal:2',
        'tax_amount' => 'decimal:2',
        'line_total' => 'decimal:2',
        'metadata' => 'array',
    ];

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(PharmacoSupplierInvoice::class, 'pharmaco_supplier_invoice_id');
    }

    public function purchaseOrderItem(): BelongsTo
    {
        return $this->belongsTo(PharmacoPurchaseOrderItem::class, 'pharmaco_purchase_order_item_id');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
