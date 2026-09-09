<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FinanceExpenseAction extends Model
{
    public $timestamps = false;

    protected $table =
        'finance_expense_actions';

    protected $fillable = [
        'uuid',
        'finance_expense_id',
        'tenant_id',
        'actor_id',
        'action',
        'previous_status',
        'new_status',
        'comment',
        'metadata',
        'acted_at',
    ];

    protected $casts = [
        'metadata' => 'array',
        'acted_at' => 'datetime',
    ];

    public function expense(): BelongsTo
    {
        return $this->belongsTo(
            FinanceExpense::class,
            'finance_expense_id'
        );
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(
            User::class,
            'actor_id'
        );
    }
}
