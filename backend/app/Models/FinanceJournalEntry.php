<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class FinanceJournalEntry extends Model
{
    protected $fillable = [
        'tenant_id',
        'branch_id',
        'accounting_period_id',
        'journal_number',
        'business_date',
        'source_module',
        'source_type',
        'source_id',
        'idempotency_key',
        'status',
        'currency_code',
        'exchange_rate',
        'total_debit',
        'total_credit',
        'memo',
        'created_by',
        'approved_by',
        'approved_at',
        'reversed_entry_id',
        'source_snapshot',
        'metadata',
    ];

    protected $casts = [
        'business_date' => 'date',
        'approved_at' => 'datetime',
        'total_debit' => 'decimal:4',
        'total_credit' => 'decimal:4',
        'exchange_rate' => 'decimal:8',
        'source_snapshot' => 'array',
        'metadata' => 'array',
    ];

    public function lines(): HasMany
    {
        return $this->hasMany(FinanceJournalLine::class, 'journal_entry_id');
    }
}
