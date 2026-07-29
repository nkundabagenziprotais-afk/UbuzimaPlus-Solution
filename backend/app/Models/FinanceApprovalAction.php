<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FinanceApprovalAction extends Model
{
    protected $table =
        'finance_approval_actions';

    protected $fillable = [
        'uuid',
        'approval_request_id',
        'tenant_id',
        'actor_id',
        'action',
        'previous_status',
        'new_status',
        'comment',
        'metadata',
        'acted_at',
    ];

    protected $casts = [
        'metadata' => 'array',
        'acted_at' => 'datetime',
    ];

    public function approvalRequest(): BelongsTo
    {
        return $this->belongsTo(
            FinanceApprovalRequest::class,
            'approval_request_id'
        );
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(
            Tenant::class
        );
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(
            User::class,
            'actor_id'
        );
    }
}
