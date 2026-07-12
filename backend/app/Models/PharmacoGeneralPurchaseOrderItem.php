<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PharmacoGeneralPurchaseOrderItem extends Model
{
    protected $fillable = [
        'uuid',
        'tenant_id',
        'pharmaco_purchase_order_id',
        'pharmaco_general_item_id',
        'item_name',
        'item_code',
        'category',
        'unit_of_measure',
        'quantity_ordered',
        'quantity_received',
        'unit_cost',
        'discount_amount',
        'tax_amount',
        'line_total',
        'status',
        'notes',
        'metadata',
    ];

    protected $casts = [
        'quantity_ordered' => 'decimal:3',
        'quantity_received' => 'decimal:3',
        'unit_cost' => 'decimal:2',
        'discount_amount' => 'decimal:2',
        'tax_amount' => 'decimal:2',
        'line_total' => 'decimal:2',
        'metadata' => 'array',
    ];

    public function purchaseOrder(): BelongsTo
    {
        return $this->belongsTo(
            PharmacoPurchaseOrder::class,
            'pharmaco_purchase_order_id'
        );
    }

    public function generalItem(): BelongsTo
    {
        return $this->belongsTo(
            PharmacoGeneralItem::class,
            'pharmaco_general_item_id'
        );
    }
}
