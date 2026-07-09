<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PharmacoHistoricalPosApproval extends Model
{
    use HasFactory;

    protected $fillable = [
        'uuid',
        'tenant_id',
        'branch_id',
        'business_date',
        'requested_by',
        'approved_by',
        'status',
        'requires_code',
        'approval_code_hash',
        'failed_attempts',
        'live_activity_count',
        'live_activity_total',
        'request_reason',
        'historical_reference',
        'decision_notes',
        'approved_at',
        'rejected_at',
        'expires_at',
        'used_at',
        'metadata',
    ];

    protected $hidden = [
        'approval_code_hash',
    ];

    protected $casts = [
        'business_date' => 'date',
        'requires_code' => 'boolean',
        'failed_attempts' => 'integer',
        'live_activity_count' => 'integer',
        'live_activity_total' => 'decimal:2',
        'approved_at' => 'datetime',
        'rejected_at' => 'datetime',
        'expires_at' => 'datetime',
        'used_at' => 'datetime',
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

    public function requester(): BelongsTo
    {
        return $this->belongsTo(
            User::class,
            'requested_by'
        );
    }

    public function approver(): BelongsTo
    {
        return $this->belongsTo(
            User::class,
            'approved_by'
        );
    }

    public function sessions(): HasMany
    {
        return $this->hasMany(
            PharmacoPosSession::class,
            'historical_approval_id'
        );
    }

    public function sales(): HasMany
    {
        return $this->hasMany(
            PharmacoSale::class,
            'historical_approval_id'
        );
    }

    public function payments(): HasMany
    {
        return $this->hasMany(
            PharmacoPayment::class,
            'historical_approval_id'
        );
    }

    public function stockMovements(): HasMany
    {
        return $this->hasMany(
            StockMovement::class,
            'historical_approval_id'
        );
    }
}
