<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProductDuplicateProposal extends Model
{
    protected $fillable = [
        'tenant_id',
        'record_a_product_id',
        'record_b_product_id',
        'match_basis',
        'match_score',
        'status',
        'dependency_snapshot',
        'reviewed_by',
        'reviewed_at',
        'review_notes',
    ];

    protected function casts(): array
    {
        return [
            'match_score' => 'decimal:2',
            'dependency_snapshot' => 'array',
            'reviewed_at' => 'datetime',
        ];
    }

    public function recordA(): BelongsTo
    {
        return $this->belongsTo(Product::class, 'record_a_product_id');
    }

    public function recordB(): BelongsTo
    {
        return $this->belongsTo(Product::class, 'record_b_product_id');
    }
}
