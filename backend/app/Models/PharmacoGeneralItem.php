<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PharmacoGeneralItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'uuid',
        'tenant_id',
        'pharmaco_general_item_category_id',
        'preferred_supplier_id',
        'name',
        'code',
        'unit_of_measure',
        'reorder_level',
        'minimum_stock_level',
        'track_stock',
        'status',
        'description',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'reorder_level' => 'decimal:3',
            'minimum_stock_level' => 'decimal:3',
            'track_stock' => 'boolean',
            'metadata' => 'array',
        ];
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(
            PharmacoGeneralItemCategory::class,
            'pharmaco_general_item_category_id'
        );
    }

    public function preferredSupplier(): BelongsTo
    {
        return $this->belongsTo(
            PharmacoSupplier::class,
            'preferred_supplier_id'
        );
    }

    public function stocks(): HasMany
    {
        return $this->hasMany(
            PharmacoGeneralItemStock::class,
            'pharmaco_general_item_id'
        );
    }

    public function movements(): HasMany
    {
        return $this->hasMany(
            PharmacoGeneralItemMovement::class,
            'pharmaco_general_item_id'
        );
    }

    public function purchaseOrderItems(): HasMany
    {
        return $this->hasMany(
            PharmacoGeneralPurchaseOrderItem::class,
            'pharmaco_general_item_id'
        );
    }
}
