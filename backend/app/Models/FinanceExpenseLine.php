<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FinanceExpenseLine extends Model
{
    protected $table =
        'finance_expense_lines';

    protected $fillable = [
        'finance_expense_id',
        'finance_expense_item_id',
        'line_number',
        'finance_chart_of_account_id',
        'description',
        'amount',
        'mapping_key',
        'metadata',
    ];

    protected $casts = [
        'line_number' => 'integer',
        'amount' => 'decimal:4',
        'metadata' => 'array',
    ];

    public function expense(): BelongsTo
    {
        return $this->belongsTo(
            FinanceExpense::class,
            'finance_expense_id'
        );
    }


    public function expenseItem(): BelongsTo
    {
        return $this->belongsTo(
            FinanceExpenseItem::class,
            'finance_expense_item_id'
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
