<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CustomerInsuranceMembership extends Model
{
    protected $fillable = [
        'uuid',
        'tenant_id',
        'customer_id',
        'insurance_partner_id',
        'insurance_scheme_id',
        'insurance_institution_id',
        'member_number',
        'policy_number',
        'principal_member_number',
        'relationship_to_principal',
        'coverage_from',
        'coverage_to',
        'verification_status',
        'verified_at',
        'verified_by',
        'status',
        'eligibility_response',
        'metadata',
    ];

    protected $casts = [
        'coverage_from' => 'date',
        'coverage_to' => 'date',
        'verified_at' => 'datetime',
        'eligibility_response' => 'array',
        'metadata' => 'array',
    ];

    public function partner(): BelongsTo
    {
        return $this->belongsTo(InsurancePartner::class, 'insurance_partner_id');
    }

    public function scheme(): BelongsTo
    {
        return $this->belongsTo(InsuranceScheme::class, 'insurance_scheme_id');
    }
}
