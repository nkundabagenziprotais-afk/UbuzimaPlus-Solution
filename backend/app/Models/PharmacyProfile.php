<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PharmacyProfile extends Model
{
    protected $fillable = [
        'uuid',
        'tenant_id',
        'legal_name',
        'trading_name',
        'pharmacy_category',
        'ownership_type',
        'license_number',
        'tin',
        'rssb_provider_code',
        'insurance_partner_code',
        'regulator_name',
        'primary_contact_name',
        'primary_phone',
        'primary_email',
        'website',
        'country',
        'city',
        'district',
        'sector',
        'physical_address',
        'capabilities',
        'insurance_partners',
        'operating_hours',
        'metadata',
        'status',
        'is_primary',
        'verified_at',
    ];

    protected $casts = [
        'capabilities' => 'array',
        'insurance_partners' => 'array',
        'operating_hours' => 'array',
        'metadata' => 'array',
        'is_primary' => 'boolean',
        'verified_at' => 'datetime',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }
}
