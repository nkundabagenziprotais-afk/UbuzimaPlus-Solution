<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PharmacoTaxComplianceRule extends Model
{
    protected $fillable = [
        'uuid',
        'tenant_id',
        'product_category_id',
        'code',
        'name',
        'applies_to',
        'product_type',
        'tax_rate',
        'effective_from',
        'effective_until',
        'status',
        'metadata',
    ];

    protected $casts = [
        'tax_rate' => 'decimal:4',
        'effective_from' => 'date',
        'effective_until' => 'date',
        'metadata' => 'array',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function productCategory(): BelongsTo
    {
        return $this->belongsTo(ProductCategory::class);
    }
}
