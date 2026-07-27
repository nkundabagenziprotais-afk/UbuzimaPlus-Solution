<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FinanceReportingExclusion extends Model
{
    protected $fillable = [
        'tenant_id',
        'finance_journal_entry_id',
        'scope',
        'classification',
        'cohort_key',
        'effective_from',
        'status',
        'approved_by_user_id',
        'approved_by_name',
        'approved_at',
        'evidence_reference',
        'evidence_sha256',
        'cohort_sha256',
        'reason',
        'metadata',
    ];

    protected $casts = [
        'effective_from' => 'date',
        'approved_at' => 'datetime',
        'metadata' => 'array',
    ];

    public function journalEntry(): BelongsTo
    {
        return $this->belongsTo(
            FinanceJournalEntry::class,
            'finance_journal_entry_id'
        );
    }
}
