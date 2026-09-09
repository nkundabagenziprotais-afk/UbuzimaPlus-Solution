<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FinanceExpenseItem extends Model
{
    protected $table = 'finance_expense_items';

    protected $fillable = [
        'uuid',
        'tenant_id',
        'finance_chart_of_account_id',
        'code',
        'name',
        'group_name',
        'description',
        'status',
        'is_system_seed',
        'metadata',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'is_system_seed' => 'boolean',
        'metadata' => 'array',
    ];

    public function account(): BelongsTo
    {
        return $this->belongsTo(
            FinanceChartOfAccount::class,
            'finance_chart_of_account_id'
        );
    }
}
