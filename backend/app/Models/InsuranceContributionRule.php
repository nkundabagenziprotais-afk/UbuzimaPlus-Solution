<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InsuranceContributionRule extends Model
{
    protected $fillable = [
        'uuid',
        'tenant_id',
        'insurance_partner_id',
        'insurance_scheme_id',
        'insurance_institution_id',
        'product_id',
        'rule_name',
        'rule_scope',
        'customer_contribution_percent',
        'insurer_contribution_percent',
        'fixed_customer_amount',
        'maximum_insurer_amount',
        'priority',
        'effective_from',
        'effective_to',
        'status',
        'conditions',
        'metadata',
    ];

    protected $casts = [
        'customer_contribution_percent' => 'decimal:4',
        'insurer_contribution_percent' => 'decimal:4',
        'fixed_customer_amount' => 'decimal:2',
        'maximum_insurer_amount' => 'decimal:2',
        'effective_from' => 'date',
        'effective_to' => 'date',
        'conditions' => 'array',
        'metadata' => 'array',
    ];

    public function partner(): BelongsTo
    {
        return $this->belongsTo(InsurancePartner::class, 'insurance_partner_id');
    }
}
