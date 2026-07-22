<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FinanceJournalLine extends Model
{
    protected $fillable = [
        'tenant_id',
        'journal_entry_id',
        'chart_of_account_id',
        'branch_id',
        'department_id',
        'customer_id',
        'supplier_id',
        'product_id',
        'stock_location_id',
        'insurance_partner_id',
        'payment_method',
        'line_type',
        'debit',
        'credit',
        'description',
        'metadata',
    ];

    protected $casts = [
        'debit' => 'decimal:4',
        'credit' => 'decimal:4',
        'metadata' => 'array',
    ];

    public function entry(): BelongsTo
    {
        return $this->belongsTo(FinanceJournalEntry::class, 'journal_entry_id');
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(FinanceChartOfAccount::class, 'chart_of_account_id');
    }
}
