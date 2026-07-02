<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Market extends Model
{
    protected $fillable = [
        'uuid',
        'code',
        'name',
        'country_code',
        'default_language',
        'currency_code',
        'timezone',
        'service_radius_km',
        'status',
        'metadata',
    ];

    protected $casts = [
        'service_radius_km' => 'decimal:2',
        'metadata' => 'array',
    ];

    public function tenantAssignments(): HasMany
    {
        return $this->hasMany(TenantMarketAssignment::class);
    }

    public function serviceProviders(): HasMany
    {
        return $this->hasMany(ServiceProviderLocation::class);
    }
}
