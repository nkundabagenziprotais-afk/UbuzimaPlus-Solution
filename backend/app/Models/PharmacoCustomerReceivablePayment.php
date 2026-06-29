<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PharmacoCustomerReceivablePayment extends Model
{
    protected $fillable = [
        'uuid',
        'tenant_id',
        'pharmaco_customer_receivable_id',
        'pharmaco_customer_id',
        'payment_number',
        'amount',
        'payment_method',
        'reference_number',
        'status',
        'paid_at',
        'recorded_by',
        'notes',
        'metadata',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'paid_at' => 'datetime',
        'metadata' => 'array',
    ];

    public function receivable(): BelongsTo
    {
        return $this->belongsTo(PharmacoCustomerReceivable::class, 'pharmaco_customer_receivable_id');
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(PharmacoCustomer::class, 'pharmaco_customer_id');
    }
}
