<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class InsuranceReconciliationBatch extends Model
{
    protected $fillable = [
        'uuid',
        'tenant_id',
        'insurance_partner_id',
        'batch_number',
        'period_from',
        'period_to',
        'submitted_at',
        'reconciled_at',
        'claim_count',
        'submitted_amount',
        'approved_amount',
        'rejected_amount',
        'paid_amount',
        'status',
        'metadata',
    ];

    protected $casts = [
        'period_from' => 'date',
        'period_to' => 'date',
        'submitted_at' => 'datetime',
        'reconciled_at' => 'datetime',
        'submitted_amount' => 'decimal:2',
        'approved_amount' => 'decimal:2',
        'rejected_amount' => 'decimal:2',
        'paid_amount' => 'decimal:2',
        'metadata' => 'array',
    ];

    public function partner(): BelongsTo
    {
        return $this->belongsTo(InsurancePartner::class, 'insurance_partner_id');
    }

    public function payments(): HasMany
    {
        return $this->hasMany(
            InsurancePayment::class,
            'insurance_reconciliation_batch_id'
        );
    }
}
