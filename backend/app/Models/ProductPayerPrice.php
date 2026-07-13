<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProductPayerPrice extends Model
{
    protected $fillable = [
        'tenant_id',
        'product_id',
        'payer_code',
        'payer_name',
        'amount',
        'currency',
        'effective_from',
        'effective_to',
        'source_key',
        'source_reference',
        'status',
        'approved_by',
        'approved_at',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'effective_from' => 'date',
            'effective_to' => 'date',
            'approved_at' => 'datetime',
            'metadata' => 'array',
        ];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
