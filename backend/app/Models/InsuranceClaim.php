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
        'invoice_due_date',
        'invoice_submission_status',
        'invoice_submitted_at',
        'invoice_submitted_by',
        'invoice_submission_reference',
        'invoice_submission_channel',
        'reminder_lead_days',
        'reminder_frequency',
        'next_reminder_at',
        'last_reminder_at',
        'reminder_count',
        'invoice_document_path',
        'annex_document_path',
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
        'invoice_due_date' => 'date',
        'invoice_submitted_at' => 'datetime',
        'next_reminder_at' => 'datetime',
        'last_reminder_at' => 'datetime',
        'reminder_lead_days' => 'integer',
        'reminder_count' => 'integer',
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

    public function scheme(): BelongsTo
    {
        return $this->belongsTo(
            InsuranceScheme::class,
            'insurance_scheme_id'
        );
    }

    public function membership(): BelongsTo
    {
        return $this->belongsTo(
            CustomerInsuranceMembership::class,
            'customer_insurance_membership_id'
        );
    }

    public function sale(): BelongsTo
    {
        return $this->belongsTo(
            PharmacoSale::class,
            'sale_id'
        );
    }

    public function submissionEvents(): HasMany
    {
        return $this->hasMany(
            InsuranceClaimSubmissionEvent::class,
            'insurance_claim_id'
        );
    }

    public function salesRegisterEntries(): HasMany
    {
        return $this->hasMany(
            InsuranceSalesRegister::class,
            'insurance_claim_id'
        );
    }
}
