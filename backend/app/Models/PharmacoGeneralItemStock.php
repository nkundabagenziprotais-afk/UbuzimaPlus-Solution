<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PharmacoGeneralItemStock extends Model
{
    use HasFactory;

    protected $fillable = [
        'uuid',
        'tenant_id',
        'branch_id',
        'pharmaco_general_item_id',
        'pharmaco_general_item_location_id',
        'quantity_on_hand',
        'quantity_reserved',
        'average_unit_cost',
        'last_unit_cost',
        'last_received_at',
        'last_issued_at',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'quantity_on_hand' => 'decimal:3',
            'quantity_reserved' => 'decimal:3',
            'average_unit_cost' => 'decimal:2',
            'last_unit_cost' => 'decimal:2',
            'last_received_at' => 'datetime',
            'last_issued_at' => 'datetime',
            'metadata' => 'array',
        ];
    }

    public function item(): BelongsTo
    {
        return $this->belongsTo(
            PharmacoGeneralItem::class,
            'pharmaco_general_item_id'
        );
    }

    public function location(): BelongsTo
    {
        return $this->belongsTo(
            PharmacoGeneralItemLocation::class,
            'pharmaco_general_item_location_id'
        );
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function movements(): HasMany
    {
        return $this->hasMany(
            PharmacoGeneralItemMovement::class,
            'pharmaco_general_item_stock_id'
        );
    }
}
