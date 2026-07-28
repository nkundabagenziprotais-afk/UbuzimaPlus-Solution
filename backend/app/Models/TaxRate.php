<?php

namespace App\Models;

use App\Models\Concerns\GeneratesUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TaxRate extends Model
{
    use GeneratesUuid;

    protected $fillable = [
        'uuid',
        'tax_type_id',
        'tenant_id',
        'code',
        'name',
        'rate',
        'fixed_amount',
        'currency_code',
        'calculation_basis',
        'effective_from',
        'effective_to',
        'legal_reference',
        'source_url',
        'source_document_sha256',
        'version',
        'change_reason',
        'status',
        'created_by',
        'approved_by',
        'approved_at',
        'metadata',
    ];

    protected $casts = [
        'rate' => 'decimal:6',
        'fixed_amount' => 'decimal:2',
        'effective_from' => 'date',
        'effective_to' => 'date',
        'approved_at' => 'datetime',
        'metadata' => 'array',
    ];


    public function taxType(): BelongsTo
    {
        return $this->belongsTo(TaxType::class);
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
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
