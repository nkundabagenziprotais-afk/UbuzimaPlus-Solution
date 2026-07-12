<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PharmacoGeneralItemMovement extends Model
{
    use HasFactory;

    protected $fillable = [
        'uuid',
        'tenant_id',
        'branch_id',
        'pharmaco_general_item_id',
        'pharmaco_general_item_stock_id',
        'pharmaco_general_item_location_id',
        'performed_by',
        'movement_type',
        'quantity',
        'unit_cost',
        'total_value',
        'running_balance',
        'reference_type',
        'reference_number',
        'reason',
        'occurred_at',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'decimal:3',
            'unit_cost' => 'decimal:2',
            'total_value' => 'decimal:2',
            'running_balance' => 'decimal:3',
            'occurred_at' => 'datetime',
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

    public function stock(): BelongsTo
    {
        return $this->belongsTo(
            PharmacoGeneralItemStock::class,
            'pharmaco_general_item_stock_id'
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

    public function performedBy(): BelongsTo
    {
        return $this->belongsTo(
            User::class,
            'performed_by'
        );
    }
}
