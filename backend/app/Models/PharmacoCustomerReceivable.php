<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PharmacoCustomerReceivable extends Model
{
    protected $fillable = [
        'uuid',
        'tenant_id',
        'pharmaco_customer_id',
        'pharmaco_sale_id',
        'receivable_number',
        'status',
        'original_amount',
        'paid_amount',
        'balance_amount',
        'issued_at',
        'due_date',
        'closed_at',
        'created_by',
        'notes',
        'metadata',
    ];

    protected $casts = [
        'original_amount' => 'decimal:2',
        'paid_amount' => 'decimal:2',
        'balance_amount' => 'decimal:2',
        'issued_at' => 'date',
        'due_date' => 'date',
        'closed_at' => 'datetime',
        'metadata' => 'array',
    ];

    public function customer(): BelongsTo
    {
        return $this->belongsTo(PharmacoCustomer::class, 'pharmaco_customer_id');
    }

    public function sale(): BelongsTo
    {
        return $this->belongsTo(PharmacoSale::class, 'pharmaco_sale_id');
    }

    public function payments(): HasMany
    {
        return $this->hasMany(PharmacoCustomerReceivablePayment::class, 'pharmaco_customer_receivable_id');
    }
}
