<?php

namespace App\Models;

use App\Models\Concerns\GeneratesUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TaxIntegrationEndpoint extends Model
{
    use GeneratesUuid;

    protected $fillable = [
        'uuid',
        'tenant_id',
        'provider_code',
        'integration_type',
        'name',
        'base_url',
        'auth_mode',
        'credentials_secret_ref',
        'status',
        'last_sync_at',
        'last_success_at',
        'configuration',
        'metadata',
    ];

    protected $casts = [
        'last_sync_at' => 'datetime',
        'last_success_at' => 'datetime',
        'configuration' => 'array',
        'metadata' => 'array',
    ];


    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function syncRuns(): HasMany
    {
        return $this->hasMany(TaxSyncRun::class);
    }

}
