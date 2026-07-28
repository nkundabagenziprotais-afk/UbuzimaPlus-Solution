<?php

namespace App\Models;

use App\Models\Concerns\GeneratesUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TaxCalculationSnapshot extends Model
{
    use GeneratesUuid;

    protected $fillable = [
        'uuid',
        'tenant_id',
        'module_code',
        'transaction_type',
        'source_type',
        'source_id',
        'source_line_id',
        'product_id',
        'business_date',
        'tax_rule_id',
        'tax_rate_id',
        'rra_exemption_list_id',
        'rra_exemption_item_id',
        'tax_type_code',
        'tax_profile_code',
        'tax_treatment',
        'tax_rate',
        'taxable_amount',
        'tax_amount',
        'currency_code',
        'idempotency_key',
        'calculation_basis',
        'source_snapshot',
        'created_by',
    ];

    protected $casts = [
        'business_date' => 'date',
        'tax_rate' => 'decimal:6',
        'taxable_amount' => 'decimal:2',
        'tax_amount' => 'decimal:2',
        'calculation_basis' => 'array',
        'source_snapshot' => 'array',
    ];


    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function taxRule(): BelongsTo
    {
        return $this->belongsTo(TaxRule::class);
    }

    public function taxRateDefinition(): BelongsTo
    {
        return $this->belongsTo(TaxRate::class, 'tax_rate_id');
    }

    public function exemptionList(): BelongsTo
    {
        return $this->belongsTo(
            RraExemptionList::class,
            'rra_exemption_list_id'
        );
    }

    public function exemptionItem(): BelongsTo
    {
        return $this->belongsTo(
            RraExemptionItem::class,
            'rra_exemption_item_id'
        );
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

}
