<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;

class FinanceJournalDraft extends Model
{
    protected $table =
        'finance_journal_drafts';

    protected $fillable = [
        'uuid',
        'tenant_id',
        'branch_id',
        'business_date',
        'reference',
        'description',
        'currency_code',
        'status',
        'version',
        'created_by',
        'submitted_by',
        'submitted_at',
        'approved_by',
        'approved_at',
        'rejected_by',
        'rejected_at',
        'rejection_reason',
        'posted_by',
        'posted_at',
        'posted_journal_entry_id',
        'reversed_by',
        'reversed_at',
        'reversal_journal_entry_id',
        'metadata',
    ];

    protected $casts = [
        'business_date' => 'date',
        'version' => 'integer',
        'submitted_at' => 'datetime',
        'approved_at' => 'datetime',
        'rejected_at' => 'datetime',
        'posted_at' => 'datetime',
        'reversed_at' => 'datetime',
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

    public function creator(): BelongsTo
    {
        return $this->belongsTo(
            User::class,
            'created_by'
        );
    }

    public function submitter(): BelongsTo
    {
        return $this->belongsTo(
            User::class,
            'submitted_by'
        );
    }

    public function approver(): BelongsTo
    {
        return $this->belongsTo(
            User::class,
            'approved_by'
        );
    }

    public function rejector(): BelongsTo
    {
        return $this->belongsTo(
            User::class,
            'rejected_by'
        );
    }

    public function poster(): BelongsTo
    {
        return $this->belongsTo(
            User::class,
            'posted_by'
        );
    }

    public function reverser(): BelongsTo
    {
        return $this->belongsTo(
            User::class,
            'reversed_by'
        );
    }

    public function postedJournal(): BelongsTo
    {
        return $this->belongsTo(
            FinanceJournalEntry::class,
            'posted_journal_entry_id'
        );
    }

    public function reversalJournal(): BelongsTo
    {
        return $this->belongsTo(
            FinanceJournalEntry::class,
            'reversal_journal_entry_id'
        );
    }

    public function lines(): HasMany
    {
        return $this->hasMany(
            FinanceJournalDraftLine::class,
            'journal_draft_id'
        )->orderBy('line_number');
    }

    public function approvalRequests(): MorphMany
    {
        return $this->morphMany(
            FinanceApprovalRequest::class,
            'subject'
        );
    }
}
