<?php

namespace App\Models;

use App\Models\Concerns\GeneratesUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TaxRule extends Model
{
    use GeneratesUuid;

    protected $fillable = [
        'uuid',
        'tenant_id',
        'tax_profile_id',
        'code',
        'name',
        'module_code',
        'transaction_type',
        'product_category_code',
        'hs_code_prefix',
        'party_condition',
        'priority',
        'conditions',
        'effective_from',
        'effective_to',
        'requires_manual_review',
        'legal_reference',
        'version',
        'change_reason',
        'status',
        'created_by',
        'approved_by',
        'approved_at',
        'metadata',
    ];

    protected $casts = [
        'conditions' => 'array',
        'effective_from' => 'date',
        'effective_to' => 'date',
        'requires_manual_review' => 'boolean',
        'approved_at' => 'datetime',
        'metadata' => 'array',
    ];


    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function taxProfile(): BelongsTo
    {
        return $this->belongsTo(TaxProfile::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

}
