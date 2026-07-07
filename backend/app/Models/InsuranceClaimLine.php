<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InsuranceClaimLine extends Model
{
    protected $fillable = [
        'uuid',
        'tenant_id',
        'insurance_claim_id',
        'product_id',
        'sale_item_id',
        'description',
        'quantity',
        'unit_price',
        'gross_amount',
        'customer_amount',
        'claimed_amount',
        'approved_amount',
        'rejected_amount',
        'status',
        'rejection_code',
        'rejection_reason',
        'metadata',
    ];

    protected $casts = [
        'quantity' => 'decimal:4',
        'unit_price' => 'decimal:4',
        'gross_amount' => 'decimal:2',
        'customer_amount' => 'decimal:2',
        'claimed_amount' => 'decimal:2',
        'approved_amount' => 'decimal:2',
        'rejected_amount' => 'decimal:2',
        'metadata' => 'array',
    ];

    public function claim(): BelongsTo
    {
        return $this->belongsTo(InsuranceClaim::class, 'insurance_claim_id');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(
            Product::class,
            'product_id'
        );
    }

    public function saleItem(): BelongsTo
    {
        return $this->belongsTo(
            PharmacoSaleItem::class,
            'sale_item_id'
        );
    }
}
