<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InsurancePayment extends Model
{
    protected $fillable = [
        'uuid',
        'tenant_id',
        'insurance_partner_id',
        'insurance_reconciliation_batch_id',
        'payment_reference',
        'payment_date',
        'amount',
        'currency',
        'payment_method',
        'bank_reference',
        'status',
        'allocation_details',
        'metadata',
    ];

    protected $casts = [
        'payment_date' => 'date',
        'amount' => 'decimal:2',
        'allocation_details' => 'array',
        'metadata' => 'array',
    ];

    public function partner(): BelongsTo
    {
        return $this->belongsTo(InsurancePartner::class, 'insurance_partner_id');
    }

    public function reconciliationBatch(): BelongsTo
    {
        return $this->belongsTo(
            InsuranceReconciliationBatch::class,
            'insurance_reconciliation_batch_id'
        );
    }
}
