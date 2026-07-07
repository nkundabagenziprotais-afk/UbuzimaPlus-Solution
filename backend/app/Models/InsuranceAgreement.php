<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InsuranceAgreement extends Model
{
    protected $fillable = [
        'uuid',
        'tenant_id',
        'insurance_partner_id',
        'insurance_institution_id',
        'agreement_number',
        'title',
        'effective_from',
        'effective_to',
        'payment_terms_days',
        'claim_submission_deadline_days',
        'credit_limit',
        'status',
        'document_path',
        'terms',
        'metadata',
    ];

    protected $casts = [
        'effective_from' => 'date',
        'effective_to' => 'date',
        'credit_limit' => 'decimal:2',
        'terms' => 'array',
        'metadata' => 'array',
    ];

    public function partner(): BelongsTo
    {
        return $this->belongsTo(InsurancePartner::class, 'insurance_partner_id');
    }
}
