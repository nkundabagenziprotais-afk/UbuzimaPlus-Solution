<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InsuranceProductPrice extends Model
{
    protected $fillable = [
        'uuid',
        'tenant_id',
        'insurance_price_list_id',
        'product_id',
        'agreed_unit_price',
        'maximum_claimable_price',
        'customer_contribution_percent',
        'insurer_contribution_percent',
        'requires_pre_authorization',
        'is_covered',
        'coverage_status',
        'restrictions',
        'metadata',
    ];

    protected $casts = [
        'agreed_unit_price' => 'decimal:4',
        'maximum_claimable_price' => 'decimal:4',
        'customer_contribution_percent' => 'decimal:4',
        'insurer_contribution_percent' => 'decimal:4',
        'requires_pre_authorization' => 'boolean',
        'is_covered' => 'boolean',
        'restrictions' => 'array',
        'metadata' => 'array',
    ];

    public function priceList(): BelongsTo
    {
        return $this->belongsTo(
            InsurancePriceList::class,
            'insurance_price_list_id'
        );
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
