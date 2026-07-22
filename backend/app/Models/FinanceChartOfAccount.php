<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FinanceChartOfAccount extends Model
{
    protected $fillable = [
        'tenant_id',
        'parent_id',
        'code',
        'name',
        'account_type',
        'normal_balance',
        'currency_code',
        'is_control_account',
        'is_cash_or_bank',
        'is_active',
        'metadata',
    ];

    protected $casts = [
        'is_control_account' => 'boolean',
        'is_cash_or_bank' => 'boolean',
        'is_active' => 'boolean',
        'metadata' => 'array',
    ];

    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_id');
    }
}
