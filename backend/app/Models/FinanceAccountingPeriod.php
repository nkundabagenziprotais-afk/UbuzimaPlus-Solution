<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FinanceAccountingPeriod extends Model
{
    protected $fillable = [
        'tenant_id',
        'branch_id',
        'name',
        'starts_on',
        'ends_on',
        'status',
        'is_locked',
        'closed_by',
        'closed_at',
        'close_reason',
        'metadata',
    ];

    protected $casts = [
        'starts_on' => 'date',
        'ends_on' => 'date',
        'is_locked' => 'boolean',
        'closed_at' => 'datetime',
        'metadata' => 'array',
    ];

    public function isClosedOrLocked(): bool
    {
        return $this->is_locked || in_array($this->status, ['closed', 'locked'], true);
    }
}
