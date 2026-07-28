<?php

namespace App\Models;

use App\Models\Concerns\GeneratesUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ProductTaxAssignment extends Model
{
    use GeneratesUuid;

    protected $fillable = [
        'uuid',
        'tenant_id',
        'product_id',
        'tax_profile_id',
        'tax_rate_id',
        'rra_exemption_item_id',
        'business_category_code',
        'category_confidence',
        'tax_treatment',
        'exemption_status',
        'match_method',
        'match_score',
        'review_status',
        'source',
        'reason',
        'effective_from',
        'effective_to',
        'version',
        'status',
        'reviewed_by',
        'reviewed_at',
        'approved_by',
        'approved_at',
        'metadata',
    ];

    protected $casts = [
        'category_confidence' => 'decimal:4',
        'match_score' => 'decimal:4',
        'effective_from' => 'date',
        'effective_to' => 'date',
        'reviewed_at' => 'datetime',
        'approved_at' => 'datetime',
        'metadata' => 'array',
    ];


    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function taxProfile(): BelongsTo
    {
        return $this->belongsTo(TaxProfile::class);
    }

    public function taxRate(): BelongsTo
    {
        return $this->belongsTo(TaxRate::class);
    }

    public function exemptionItem(): BelongsTo
    {
        return $this->belongsTo(
            RraExemptionItem::class,
            'rra_exemption_item_id'
        );
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

}
