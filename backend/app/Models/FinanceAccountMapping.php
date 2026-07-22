<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FinanceAccountMapping extends Model
{
    protected $fillable = [
        'tenant_id',
        'branch_id',
        'mapping_key',
        'finance_chart_of_account_id',
        'source_module',
        'source_type',
        'payment_method',
        'currency_code',
        'is_default',
        'is_active',
        'metadata',
    ];

    protected $casts = [
        'is_default' => 'boolean',
        'is_active' => 'boolean',
        'metadata' => 'array',
    ];

    public function account(): BelongsTo
    {
        return $this->belongsTo(FinanceChartOfAccount::class, 'finance_chart_of_account_id');
    }
}
