<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PharmacoPayment extends Model
{
    use HasFactory;

    protected $fillable = [
        'uuid',
        'tenant_id',
        'pharmaco_sale_id',
        'pos_session_id',
        'business_date',
        'entry_mode',
        'historical_approval_id',
        'amount',
        'payment_method',
        'status',
        'reference_number',
        'receipt_number',
        'received_by',
        'received_at',
        'metadata',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'business_date' => 'date',
        'received_at' => 'datetime',
        'metadata' => 'array',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function posSession(): BelongsTo
    {
        return $this->belongsTo(
            PharmacoPosSession::class,
            'pos_session_id'
        );
    }

    public function historicalApproval(): BelongsTo
    {
        return $this->belongsTo(
            PharmacoHistoricalPosApproval::class,
            'historical_approval_id'
        );
    }

    public function sale(): BelongsTo
    {
        return $this->belongsTo(PharmacoSale::class, 'pharmaco_sale_id');
    }
}
