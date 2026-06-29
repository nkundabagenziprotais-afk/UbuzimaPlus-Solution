<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PharmacoSupplierInvoice extends Model
{
    protected $fillable = [
        'uuid',
        'tenant_id',
        'pharmaco_supplier_id',
        'pharmaco_purchase_order_id',
        'invoice_number',
        'supplier_invoice_number',
        'status',
        'invoice_date',
        'due_date',
        'subtotal_amount',
        'discount_amount',
        'tax_amount',
        'total_amount',
        'paid_amount',
        'balance_amount',
        'approved_by',
        'approved_at',
        'notes',
        'metadata',
    ];

    protected $casts = [
        'invoice_date' => 'date',
        'due_date' => 'date',
        'subtotal_amount' => 'decimal:2',
        'discount_amount' => 'decimal:2',
        'tax_amount' => 'decimal:2',
        'total_amount' => 'decimal:2',
        'paid_amount' => 'decimal:2',
        'balance_amount' => 'decimal:2',
        'approved_at' => 'datetime',
        'metadata' => 'array',
    ];

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(PharmacoSupplier::class, 'pharmaco_supplier_id');
    }

    public function purchaseOrder(): BelongsTo
    {
        return $this->belongsTo(PharmacoPurchaseOrder::class, 'pharmaco_purchase_order_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(PharmacoSupplierInvoiceItem::class, 'pharmaco_supplier_invoice_id');
    }

    public function payments(): HasMany
    {
        return $this->hasMany(PharmacoSupplierPayment::class, 'pharmaco_supplier_invoice_id');
    }
}
