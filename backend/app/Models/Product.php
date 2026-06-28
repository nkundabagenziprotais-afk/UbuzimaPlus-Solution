<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Product extends Model
{
    protected $fillable = [
        'uuid',
        'tenant_id',
        'product_category_id',
        'name',
        'generic_name',
        'brand_name',
        'sku',
        'barcode',
        'registration_number',
        'dosage_form',
        'strength',
        'unit',
        'pack_size',
        'route_of_administration',
        'product_type',
        'regulatory_status',
        'requires_prescription',
        'is_controlled',
        'reorder_level',
        'minimum_stock_level',
        'maximum_stock_level',
        'status',
        'metadata',
    ];

    protected $casts = [
        'requires_prescription' => 'boolean',
        'is_controlled' => 'boolean',
        'reorder_level' => 'decimal:2',
        'minimum_stock_level' => 'decimal:2',
        'maximum_stock_level' => 'decimal:2',
        'metadata' => 'array',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(ProductCategory::class, 'product_category_id');
    }

    public function stockBatches(): HasMany
    {
        return $this->hasMany(StockBatch::class);
    }

    public function stockMovements(): HasMany
    {
        return $this->hasMany(StockMovement::class);
    }
}
