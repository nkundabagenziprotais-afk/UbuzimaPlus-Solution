<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PharmacoSaleItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'uuid',
        'tenant_id',
        'pharmaco_sale_id',
        'product_id',
        'stock_batch_id',
        'stock_location_id',
        'product_name_snapshot',
        'sku_snapshot',
        'quantity',
        'unit_price',
        'discount_amount',
        'tax_amount',
        'line_total',
        'requires_prescription',
        'prescription_verified',
        'status',
        'metadata',
    ];

    protected $casts = [
        'quantity' => 'decimal:3',
        'unit_price' => 'decimal:2',
        'discount_amount' => 'decimal:2',
        'tax_amount' => 'decimal:2',
        'line_total' => 'decimal:2',
        'requires_prescription' => 'boolean',
        'prescription_verified' => 'boolean',
        'metadata' => 'array',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function sale(): BelongsTo
    {
        return $this->belongsTo(PharmacoSale::class, 'pharmaco_sale_id');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function stockBatch(): BelongsTo
    {
        return $this->belongsTo(StockBatch::class);
    }

    public function stockLocation(): BelongsTo
    {
        return $this->belongsTo(StockLocation::class);
    }

    public function insuranceClaimLines(): HasMany
    {
        return $this->hasMany(
            InsuranceClaimLine::class,
            'sale_item_id'
        );
    }
}
