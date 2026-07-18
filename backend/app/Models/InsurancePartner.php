<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class InsurancePartner extends Model
{
    protected $fillable = [
        'uuid',
        'tenant_id',
        'name',
        'code',
        'partner_type',
        'pricing_mode',
        'contract_start_date',
        'contract_expiry_date',
        'default_customer_contribution_percent',
        'default_insurer_contribution_percent',
        'coverage_limit',
        'required_documentation',
        'invoice_claim_settings',
        'external_portal_reference',
        'requires_price_approval',
        'created_by',
        'updated_by',
        'registration_number',
        'tax_identification_number',
        'contact_name',
        'contact_email',
        'contact_phone',
        'alternative_phone',
        'claims_email',
        'currency',
        'status',
        'is_default',
        'integration_settings',
        'metadata',
    ];

    protected $casts = [
        'is_default' => 'boolean',
        'contract_start_date' => 'date',
        'contract_expiry_date' => 'date',
        'default_customer_contribution_percent' => 'decimal:4',
        'default_insurer_contribution_percent' => 'decimal:4',
        'coverage_limit' => 'decimal:2',
        'required_documentation' => 'array',
        'invoice_claim_settings' => 'array',
        'requires_price_approval' => 'boolean',
        'integration_settings' => 'array',
        'metadata' => 'array',
    ];

    public function institutions(): HasMany
    {
        return $this->hasMany(InsuranceInstitution::class);
    }

    public function schemes(): HasMany
    {
        return $this->hasMany(InsuranceScheme::class);
    }

    public function priceLists(): HasMany
    {
        return $this->hasMany(InsurancePriceList::class);
    }

    public function contributionRules(): HasMany
    {
        return $this->hasMany(InsuranceContributionRule::class);
    }

    public function agreements(): HasMany
    {
        return $this->hasMany(InsuranceAgreement::class);
    }

    public function claims(): HasMany
    {
        return $this->hasMany(InsuranceClaim::class);
    }
}
