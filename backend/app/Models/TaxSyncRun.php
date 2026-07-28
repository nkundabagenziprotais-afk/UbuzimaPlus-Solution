<?php

namespace App\Models;

use App\Models\Concerns\GeneratesUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TaxSyncRun extends Model
{
    use GeneratesUuid;

    protected $fillable = [
        'uuid',
        'tax_integration_endpoint_id',
        'sync_type',
        'status',
        'started_at',
        'completed_at',
        'records_received',
        'records_created',
        'records_updated',
        'records_rejected',
        'source_sha256',
        'error_summary',
        'metadata',
    ];

    protected $casts = [
        'started_at' => 'datetime',
        'completed_at' => 'datetime',
        'metadata' => 'array',
    ];


    public function endpoint(): BelongsTo
    {
        return $this->belongsTo(
            TaxIntegrationEndpoint::class,
            'tax_integration_endpoint_id'
        );
    }

}
