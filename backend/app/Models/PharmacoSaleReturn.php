<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PharmacoSaleReturn extends Model
{
    use HasFactory;

    protected $fillable = [
        'uuid',
        'tenant_id',
        'branch_id',
        'pharmaco_sale_id',
        'return_number',
        'status',
        'reason',
        'requested_refund_amount',
        'approved_refund_amount',
        'refund_method',
        'refund_reference',
        'credit_note_number',
        'requested_by',
        'approved_by',
        'requested_at',
        'approved_at',
        'refunded_at',
        'notes',
        'metadata',
    ];

    protected $casts = [
        'requested_refund_amount' => 'decimal:2',
        'approved_refund_amount' => 'decimal:2',
        'requested_at' => 'datetime',
        'approved_at' => 'datetime',
        'refunded_at' => 'datetime',
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

    public function sale(): BelongsTo
    {
        return $this->belongsTo(
            PharmacoSale::class,
            'pharmaco_sale_id'
        );
    }

    public function requestedBy(): BelongsTo
    {
        return $this->belongsTo(
            User::class,
            'requested_by'
        );
    }

    public function approvedBy(): BelongsTo
    {
        return $this->belongsTo(
            User::class,
            'approved_by'
        );
    }

    public function items(): HasMany
    {
        return $this->hasMany(
            PharmacoSaleReturnItem::class,
            'pharmaco_sale_return_id'
        );
    }
}
