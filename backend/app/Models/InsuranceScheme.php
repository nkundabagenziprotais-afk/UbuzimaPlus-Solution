<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class InsuranceScheme extends Model
{
    protected $fillable = [
        'uuid',
        'tenant_id',
        'insurance_partner_id',
        'insurance_institution_id',
        'name',
        'code',
        'scheme_type',
        'annual_limit',
        'per_visit_limit',
        'default_customer_contribution_percent',
        'default_insurer_contribution_percent',
        'effective_from',
        'effective_to',
        'status',
        'coverage_settings',
        'metadata',
    ];

    protected $casts = [
        'annual_limit' => 'decimal:2',
        'per_visit_limit' => 'decimal:2',
        'default_customer_contribution_percent' => 'decimal:4',
        'default_insurer_contribution_percent' => 'decimal:4',
        'effective_from' => 'date',
        'effective_to' => 'date',
        'coverage_settings' => 'array',
        'metadata' => 'array',
    ];

    public function partner(): BelongsTo
    {
        return $this->belongsTo(InsurancePartner::class, 'insurance_partner_id');
    }

    public function institution(): BelongsTo
    {
        return $this->belongsTo(
            InsuranceInstitution::class,
            'insurance_institution_id'
        );
    }

    public function priceLists(): HasMany
    {
        return $this->hasMany(InsurancePriceList::class);
    }
}
