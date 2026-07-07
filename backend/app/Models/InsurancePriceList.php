<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class InsurancePriceList extends Model
{
    protected $fillable = [
        'uuid',
        'tenant_id',
        'insurance_partner_id',
        'insurance_scheme_id',
        'name',
        'code',
        'currency',
        'effective_from',
        'effective_to',
        'priority',
        'status',
        'is_default',
        'metadata',
    ];

    protected $casts = [
        'effective_from' => 'date',
        'effective_to' => 'date',
        'is_default' => 'boolean',
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

    public function productPrices(): HasMany
    {
        return $this->hasMany(InsuranceProductPrice::class);
    }
}
