<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FinanceJournalDraftLine extends Model
{
    protected $table =
        'finance_journal_draft_lines';

    protected $fillable = [
        'journal_draft_id',
        'line_number',
        'finance_chart_of_account_id',
        'description',
        'debit_amount',
        'credit_amount',
        'metadata',
    ];

    protected $casts = [
        'line_number' => 'integer',
        'debit_amount' => 'decimal:4',
        'credit_amount' => 'decimal:4',
        'metadata' => 'array',
    ];

    public function draft(): BelongsTo
    {
        return $this->belongsTo(
            FinanceJournalDraft::class,
            'journal_draft_id'
        );
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(
            FinanceChartOfAccount::class,
            'finance_chart_of_account_id'
        );
    }
}
