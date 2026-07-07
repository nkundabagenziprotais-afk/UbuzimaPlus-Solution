<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class InsuranceInstitution extends Model
{
    protected $fillable = [
        'uuid',
        'tenant_id',
        'insurance_partner_id',
        'name',
        'code',
        'institution_type',
        'registration_number',
        'contact_name',
        'contact_email',
        'contact_phone',
        'status',
        'metadata',
    ];

    protected $casts = ['metadata' => 'array'];

    public function partner(): BelongsTo
    {
        return $this->belongsTo(InsurancePartner::class, 'insurance_partner_id');
    }

    public function schemes(): HasMany
    {
        return $this->hasMany(InsuranceScheme::class);
    }
}
