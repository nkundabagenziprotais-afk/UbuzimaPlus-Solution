<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class InsuranceClaim extends Model
{
    protected $fillable = [
        'uuid',
        'tenant_id',
        'insurance_partner_id',
        'insurance_scheme_id',
        'customer_insurance_membership_id',
        'sale_id',
        'claim_number',
        'external_claim_reference',
        'service_date',
        'submitted_at',
        'adjudicated_at',
        'gross_amount',
        'customer_amount',
        'claimed_amount',
        'approved_amount',
        'rejected_amount',
        'paid_amount',
        'status',
        'rejection_reason',
        'submission_payload',
        'adjudication_response',
        'metadata',
    ];

    protected $casts = [
        'service_date' => 'date',
        'submitted_at' => 'datetime',
        'adjudicated_at' => 'datetime',
        'gross_amount' => 'decimal:2',
        'customer_amount' => 'decimal:2',
        'claimed_amount' => 'decimal:2',
        'approved_amount' => 'decimal:2',
        'rejected_amount' => 'decimal:2',
        'paid_amount' => 'decimal:2',
        'submission_payload' => 'array',
        'adjudication_response' => 'array',
        'metadata' => 'array',
    ];

    public function partner(): BelongsTo
    {
        return $this->belongsTo(InsurancePartner::class, 'insurance_partner_id');
    }

    public function lines(): HasMany
    {
        return $this->hasMany(InsuranceClaimLine::class);
    }
}
