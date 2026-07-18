<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InsuranceSalesRegister extends Model
{
    protected $table = 'insurance_sales_register';

    protected $fillable = [
        'uuid',
        'tenant_id',
        'branch_id',
        'insurance_partner_id',
        'insurance_institution_id',
        'insurance_scheme_id',
        'customer_insurance_membership_id',
        'customer_id',
        'customer_name_snapshot',
        'member_number_snapshot',
        'sale_id',
        'sale_item_id',
        'sale_number',
        'sale_date',
        'claim_period',
        'product_id',
        'product_name_snapshot',
        'sku_snapshot',
        'batch_number_snapshot',
        'quantity',
        'standard_unit_price',
        'insurance_unit_price',
        'gross_amount',
        'customer_contribution_amount',
        'insurer_claim_amount',
        'coverage_status',
        'pre_authorization_number',
        'insurance_claim_id',
        'claim_number',
        'claim_status',
        'insurance_reconciliation_batch_id',
        'invoice_number',
        'receipt_number',
        'metadata',
    ];

    protected $casts = [
        'sale_date' => 'date',
        'claim_period' => 'date',
        'quantity' => 'decimal:4',
        'standard_unit_price' => 'decimal:4',
        'insurance_unit_price' => 'decimal:4',
        'gross_amount' => 'decimal:2',
        'customer_contribution_amount' => 'decimal:2',
        'insurer_claim_amount' => 'decimal:2',
        'metadata' => 'array',
    ];

    public function partner(): BelongsTo
    {
        return $this->belongsTo(InsurancePartner::class, 'insurance_partner_id');
    }

    public function institution(): BelongsTo
    {
        return $this->belongsTo(InsuranceInstitution::class, 'insurance_institution_id');
    }

    public function scheme(): BelongsTo
    {
        return $this->belongsTo(InsuranceScheme::class, 'insurance_scheme_id');
    }

    public function claim(): BelongsTo
    {
        return $this->belongsTo(InsuranceClaim::class, 'insurance_claim_id');
    }
}
