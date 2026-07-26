<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use LogicException;

class StockMovement extends Model
{
    protected $fillable = [
        'uuid',
        'tenant_id',
        'branch_id',
        'stock_location_id',
        'product_id',
        'stock_batch_id',
        'pos_session_id',
        'business_date',
        'entry_mode',
        'historical_approval_id',
        'movement_type',
        'quantity',
        'running_balance',
        'reference_type',
        'reference_number',
        'reason',
        'performed_by',
        'occurred_at',
        'unit_cost_snapshot',
        'total_cost_snapshot',
        'cost_source_snapshot',
        'cost_snapshot_at',
        'cost_snapshot_metadata',
        'metadata',
    ];

    protected $casts = [
        'quantity' => 'decimal:2',
        'business_date' => 'date',
        'running_balance' => 'decimal:2',
        'occurred_at' => 'datetime',
        'unit_cost_snapshot' => 'decimal:4',
        'total_cost_snapshot' => 'decimal:4',
        'cost_snapshot_at' => 'datetime',
        'cost_snapshot_metadata' => 'array',
        'metadata' => 'array',
    ];

    protected static function booted(): void
    {
        static::updating(function (self $movement): void {
            foreach (
                [
                    'unit_cost_snapshot',
                    'total_cost_snapshot',
                    'cost_source_snapshot',
                    'cost_snapshot_at',
                    'cost_snapshot_metadata',
                ]
                as $field
            ) {
                if (
                    $movement->getOriginal($field) !== null
                    && $movement->isDirty($field)
                ) {
                    throw new LogicException(
                        "Inventory cost snapshot field {$field} is immutable."
                    );
                }
            }
        });
    }

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

    public function stockBatch(): BelongsTo
    {
        return $this->belongsTo(StockBatch::class);
    }

    public function posSession(): BelongsTo
    {
        return $this->belongsTo(
            PharmacoPosSession::class,
            'pos_session_id'
        );
    }

    public function historicalApproval(): BelongsTo
    {
        return $this->belongsTo(
            PharmacoHistoricalPosApproval::class,
            'historical_approval_id'
        );
    }

    public function performedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'performed_by');
    }
}
