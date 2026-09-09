<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class FinanceExpense extends Model
{
    protected $table = 'finance_expenses';

    protected $fillable = [
        'uuid',
        'tenant_id',
        'branch_id',
        'expense_number',
        'idempotency_key',
        'request_fingerprint',
        'business_date',
        'supplier_id',
        'payee_name',
        'payment_source',
        'reference_number',
        'receipt_number',
        'purpose',
        'notes',
        'currency_code',
        'total_amount',
        'status',

        'evidence_disk',
        'evidence_path',
        'evidence_original_name',
        'evidence_mime_type',
        'evidence_size',
        'evidence_uploaded_by',
        'evidence_uploaded_at',

        'prepared_by',
        'submitted_by',
        'approved_by',
        'posted_by',
        'rejected_by',
        'reversed_by',

        'finance_journal_draft_id',
        'posted_journal_entry_id',
        'reversal_journal_entry_id',

        'submitted_at',
        'approved_at',
        'posted_at',
        'rejected_at',
        'reversed_at',

        'rejection_reason',
        'reversal_reason',

        'version',
        'metadata',
    ];

    protected $casts = [
        'business_date' => 'date',
        'total_amount' => 'decimal:4',
        'evidence_size' => 'integer',
        'evidence_uploaded_at' => 'datetime',
        'submitted_at' => 'datetime',
        'approved_at' => 'datetime',
        'posted_at' => 'datetime',
        'rejected_at' => 'datetime',
        'reversed_at' => 'datetime',
        'version' => 'integer',
        'metadata' => 'array',
    ];

    public function lines(): HasMany
    {
        return $this
            ->hasMany(
                FinanceExpenseLine::class,
                'finance_expense_id'
            )
            ->orderBy('line_number');
    }

    public function actions(): HasMany
    {
        return $this
            ->hasMany(
                FinanceExpenseAction::class,
                'finance_expense_id'
            )
            ->orderBy('acted_at')
            ->orderBy('id');
    }

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(
            PharmacoSupplier::class,
            'supplier_id'
        );
    }

    public function journalDraft(): BelongsTo
    {
        return $this->belongsTo(
            FinanceJournalDraft::class,
            'finance_journal_draft_id'
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
}
