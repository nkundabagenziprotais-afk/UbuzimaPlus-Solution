<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PharmacoSale extends Model
{
    use HasFactory;

    protected $fillable = [
        'uuid',
        'pos_checkout_key',
        'tenant_id',
        'branch_id',
        'pos_session_id',
        'entry_mode',
        'business_date',
        'historical_reason',
        'historical_reference',
        'historical_approval_id',
        'pharmaco_customer_id',
        'pharmaco_prescription_id',
        'sale_number',
        'sale_type',
        'status',
        'subtotal_amount',
        'discount_amount',
        'tax_amount',
        'total_amount',
        'paid_amount',
        'balance_amount',
        'payment_status',
        'sold_by',
        'sold_at',
        'notes',
        'metadata',
    ];

    protected $casts = [
        'subtotal_amount' => 'decimal:2',
        'discount_amount' => 'decimal:2',
        'tax_amount' => 'decimal:2',
        'total_amount' => 'decimal:2',
        'paid_amount' => 'decimal:2',
        'balance_amount' => 'decimal:2',
        'business_date' => 'date',
        'sold_at' => 'datetime',
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

    public function customer(): BelongsTo
    {
        return $this->belongsTo(PharmacoCustomer::class, 'pharmaco_customer_id');
    }

    public function prescription(): BelongsTo
    {
        return $this->belongsTo(PharmacoPrescription::class, 'pharmaco_prescription_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(PharmacoSaleItem::class, 'pharmaco_sale_id');
    }

    public function payments(): HasMany
    {
        return $this->hasMany(PharmacoPayment::class, 'pharmaco_sale_id');
    }

    public function insuranceClaims(): HasMany
    {
        return $this->hasMany(
            InsuranceClaim::class,
            'sale_id'
        );
    }
}
