<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PharmacoPurchaseOrder extends Model
{
    protected $fillable = [
        'uuid',
        'tenant_id',
        'branch_id',
        'pharmaco_supplier_id',
        'po_number',
        'purchase_type',
        'status',
        'order_date',
        'expected_delivery_date',
        'subtotal_amount',
        'discount_amount',
        'tax_amount',
        'shipping_amount',
        'total_amount',
        'created_by',
        'approved_by',
        'approved_at',
        'notes',
        'metadata',
    ];

    protected $casts = [
        'order_date' => 'date',
        'expected_delivery_date' => 'date',
        'approved_at' => 'datetime',
        'subtotal_amount' => 'decimal:2',
        'discount_amount' => 'decimal:2',
        'tax_amount' => 'decimal:2',
        'shipping_amount' => 'decimal:2',
        'total_amount' => 'decimal:2',
        'metadata' => 'array',
    ];

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(PharmacoSupplier::class, 'pharmaco_supplier_id');
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(
            PharmacoPurchaseOrderItem::class
        );
    }

    public function generalItems(): HasMany
    {
        return $this->hasMany(
            PharmacoGeneralPurchaseOrderItem::class
        );
    }
}
