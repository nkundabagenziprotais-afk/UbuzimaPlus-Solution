<?php

namespace App\Models;

use App\Models\Concerns\GeneratesUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TaxProfile extends Model
{
    use GeneratesUuid;

    protected $fillable = [
        'uuid',
        'tenant_id',
        'tax_type_id',
        'default_tax_rate_id',
        'code',
        'name',
        'tax_treatment',
        'requires_registry_match',
        'requires_hs_code',
        'requires_manual_approval',
        'version',
        'change_reason',
        'status',
        'description',
        'metadata',
    ];

    protected $casts = [
        'requires_registry_match' => 'boolean',
        'requires_hs_code' => 'boolean',
        'requires_manual_approval' => 'boolean',
        'metadata' => 'array',
    ];


    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function taxType(): BelongsTo
    {
        return $this->belongsTo(TaxType::class);
    }

    public function defaultRate(): BelongsTo
    {
        return $this->belongsTo(
            TaxRate::class,
            'default_tax_rate_id'
        );
    }

    public function rules(): HasMany
    {
        return $this->hasMany(TaxRule::class);
    }

    public function productAssignments(): HasMany
    {
        return $this->hasMany(ProductTaxAssignment::class);
    }

}
