<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PharmacoPosSession extends Model
{
    use HasFactory;

    protected $fillable = [
        'uuid',
        'tenant_id',
        'branch_id',
        'user_id',
        'business_date',
        'status',
        'opening_mode',
        'close_mode',
        'starting_cash',
        'expected_cash',
        'counted_cash',
        'closing_cash_balance',
        'cash_variance',
        'till_zeroized',
        'opened_at',
        'closed_at',
        'deposit_reference',
        'opening_note',
        'closing_note',
        'metadata',
    ];

    protected $casts = [
        'business_date' => 'date',
        'starting_cash' => 'decimal:2',
        'expected_cash' => 'decimal:2',
        'counted_cash' => 'decimal:2',
        'closing_cash_balance' => 'decimal:2',
        'cash_variance' => 'decimal:2',
        'till_zeroized' => 'boolean',
        'opened_at' => 'datetime',
        'closed_at' => 'datetime',
        'metadata' => 'array',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
