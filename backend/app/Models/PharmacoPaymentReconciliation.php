<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PharmacoPaymentReconciliation extends Model
{
    use HasFactory;

    protected $fillable = [
        'uuid',
        'tenant_id',
        'pharmaco_payment_id',
        'reconciliation_status',
        'expected_amount',
        'settled_amount',
        'variance_amount',
        'provider_reference',
        'reconciled_by',
        'reconciled_at',
        'notes',
        'metadata',
    ];

    protected $casts = [
        'expected_amount' => 'decimal:2',
        'settled_amount' => 'decimal:2',
        'variance_amount' => 'decimal:2',
        'reconciled_at' => 'datetime',
        'metadata' => 'array',
    ];

    public function payment(): BelongsTo
    {
        return $this->belongsTo(
            PharmacoPayment::class,
            'pharmaco_payment_id'
        );
    }

    public function reconciledBy(): BelongsTo
    {
        return $this->belongsTo(
            User::class,
            'reconciled_by'
        );
    }
}
