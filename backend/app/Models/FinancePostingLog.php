<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FinancePostingLog extends Model
{
    protected $fillable = [
        'tenant_id',
        'branch_id',
        'journal_entry_id',
        'source_module',
        'source_type',
        'source_id',
        'idempotency_key',
        'business_date',
        'status',
        'mode',
        'failure_code',
        'failure_message',
        'attempt_count',
        'posted_at',
        'quarantined_at',
        'source_snapshot',
        'metadata',
    ];

    protected $casts = [
        'business_date' => 'date',
        'posted_at' => 'datetime',
        'quarantined_at' => 'datetime',
        'source_snapshot' => 'array',
        'metadata' => 'array',
    ];
}
