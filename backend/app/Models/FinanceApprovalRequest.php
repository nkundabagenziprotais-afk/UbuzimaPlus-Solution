<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class FinanceApprovalRequest extends Model
{
    protected $table =
        'finance_approval_requests';

    protected $fillable = [
        'uuid',
        'tenant_id',
        'branch_id',
        'workflow_type',
        'subject_type',
        'subject_id',
        'subject_uuid',
        'status',
        'requested_by',
        'requested_at',
        'decided_by',
        'decided_at',
        'decision_comment',
        'version',
        'metadata',
    ];

    protected $casts = [
        'subject_id' => 'integer',
        'requested_at' => 'datetime',
        'decided_at' => 'datetime',
        'version' => 'integer',
        'metadata' => 'array',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(
            Tenant::class
        );
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(
            Branch::class
        );
    }

    public function requester(): BelongsTo
    {
        return $this->belongsTo(
            User::class,
            'requested_by'
        );
    }

    public function decider(): BelongsTo
    {
        return $this->belongsTo(
            User::class,
            'decided_by'
        );
    }

    public function subject(): MorphTo
    {
        return $this->morphTo(
            'subject',
            'subject_type',
            'subject_id'
        );
    }

    public function actions(): HasMany
    {
        return $this->hasMany(
            FinanceApprovalAction::class,
            'approval_request_id'
        )->orderBy('acted_at');
    }
}
