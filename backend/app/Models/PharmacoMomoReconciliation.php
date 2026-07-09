<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PharmacoMomoReconciliation extends Model
{
    use HasFactory;

    protected $fillable = [
        'uuid',
        'tenant_id',
        'momo_message_id',
        'pharmaco_payment_id',
        'pharmaco_sale_id',
        'status',
        'decision',
        'confidence_score',
        'amount_variance',
        'matching_reasons',
        'reviewed_by',
        'reviewed_at',
        'review_notes',
        'metadata',
    ];

    protected $casts = [
        'confidence_score' => 'decimal:2',
        'amount_variance' => 'decimal:2',
        'matching_reasons' => 'array',
        'reviewed_at' => 'datetime',
        'metadata' => 'array',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function message(): BelongsTo
    {
        return $this->belongsTo(
            PharmacoMomoMessage::class,
            'momo_message_id'
        );
    }

    public function payment(): BelongsTo
    {
        return $this->belongsTo(
            PharmacoPayment::class,
            'pharmaco_payment_id'
        );
    }

    public function sale(): BelongsTo
    {
        return $this->belongsTo(
            PharmacoSale::class,
            'pharmaco_sale_id'
        );
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(
            User::class,
            'reviewed_by'
        );
    }
}
