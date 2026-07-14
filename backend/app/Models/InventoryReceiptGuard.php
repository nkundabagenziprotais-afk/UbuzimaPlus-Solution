<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InventoryReceiptGuard extends Model
{
    protected $fillable = [
        'uuid',
        'tenant_id',
        'branch_id',
        'operation_type',
        'subject_type',
        'subject_id',
        'location_type',
        'location_id',
        'source_line_type',
        'source_line_id',
        'idempotency_key',
        'request_hash',
        'duplicate_classification',
        'status',
        'matched_transaction_type',
        'matched_transaction_id',
        'result_transaction_type',
        'result_transaction_id',
        'confidence_score',
        'match_reasons',
        'override_user_id',
        'override_reason',
        'duplicate_token_hash',
        'metadata',
        'completed_at',
    ];

    protected function casts(): array
    {
        return [
            'subject_id' => 'integer',
            'location_id' => 'integer',
            'source_line_id' => 'integer',
            'matched_transaction_id' => 'integer',
            'result_transaction_id' => 'integer',
            'confidence_score' => 'decimal:2',
            'match_reasons' => 'array',
            'metadata' => 'array',
            'completed_at' => 'datetime',
        ];
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function overrideUser(): BelongsTo
    {
        return $this->belongsTo(
            User::class,
            'override_user_id'
        );
    }
}
