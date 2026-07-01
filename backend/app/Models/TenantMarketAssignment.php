<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TenantMarketAssignment extends Model
{
    protected $fillable = [
        'tenant_id',
        'market_id',
        'status',
        'service_radius_km',
        'assigned_at',
        'metadata',
    ];

    protected $casts = [
        'service_radius_km' => 'decimal:2',
        'assigned_at' => 'datetime',
        'metadata' => 'array',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function market(): BelongsTo
    {
        return $this->belongsTo(Market::class);
    }
}
