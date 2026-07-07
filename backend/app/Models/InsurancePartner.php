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
        'registration_number',
        'tax_identification_number',
        'contact_name',
        'contact_email',
        'contact_phone',
        'claims_email',
        'currency',
        'status',
        'is_default',
        'integration_settings',
        'metadata',
    ];

    protected $casts = [
        'is_default' => 'boolean',
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
