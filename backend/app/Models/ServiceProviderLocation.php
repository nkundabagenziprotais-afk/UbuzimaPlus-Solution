<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ServiceProviderLocation extends Model
{
    protected $fillable = [
        'uuid',
        'tenant_id',
        'branch_id',
        'market_id',
        'name',
        'provider_type',
        'service_channels',
        'phone',
        'email',
        'address',
        'latitude',
        'longitude',
        'service_radius_km',
        'status',
        'metadata',
    ];

    protected $casts = [
        'service_channels' => 'array',
        'latitude' => 'decimal:7',
        'longitude' => 'decimal:7',
        'service_radius_km' => 'decimal:2',
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

    public function market(): BelongsTo
    {
        return $this->belongsTo(Market::class);
    }
}
