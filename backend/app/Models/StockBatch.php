<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class StockBatch extends Model
{
    protected $fillable = [
        'uuid',
        'tenant_id',
        'branch_id',
        'stock_location_id',
        'product_id',
        'batch_number',
        'expiry_date',
        'received_at',
        'quantity_on_hand',
        'quantity_reserved',
        'unit_cost',
        'selling_price',
        'supplier_name',
        'status',
        'metadata',
    ];

    protected $casts = [
        'expiry_date' => 'date',
        'received_at' => 'date',
        'quantity_on_hand' => 'decimal:2',
        'quantity_reserved' => 'decimal:2',
        'unit_cost' => 'decimal:2',
        'selling_price' => 'decimal:2',
        'metadata' => 'array',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function stockLocation(): BelongsTo
    {
        return $this->belongsTo(StockLocation::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function movements(): HasMany
    {
        return $this->hasMany(StockMovement::class);
    }
}
