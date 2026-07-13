<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProductReconciliationRow extends Model
{
    protected $fillable = [
        'batch_id',
        'tenant_id',
        'source_row',
        'source_code',
        'product_name',
        'generic_name',
        'strength',
        'dosage_form',
        'pack',
        'selling_unit',
        'source_price',
        'currency',
        'effective_from',
        'effective_to',
        'normalized_key',
        'matched_product_id',
        'match_method',
        'match_score',
        'proposed_action',
        'review_status',
        'reviewed_by',
        'reviewed_at',
        'review_notes',
        'source_payload',
        'dependency_snapshot',
    ];

    protected function casts(): array
    {
        return [
            'source_price' => 'decimal:2',
            'match_score' => 'decimal:2',
            'effective_from' => 'date',
            'effective_to' => 'date',
            'reviewed_at' => 'datetime',
            'source_payload' => 'array',
            'dependency_snapshot' => 'array',
        ];
    }

    public function batch(): BelongsTo
    {
        return $this->belongsTo(ProductReconciliationBatch::class, 'batch_id');
    }

    public function matchedProduct(): BelongsTo
    {
        return $this->belongsTo(Product::class, 'matched_product_id');
    }
}
