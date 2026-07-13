<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ProductReconciliationBatch extends Model
{
    protected $fillable = [
        'tenant_id',
        'source_key',
        'source_name',
        'source_version',
        'source_file',
        'status',
        'imported_rows',
        'matched_rows',
        'review_rows',
        'approved_rows',
        'rejected_rows',
        'metadata',
        'imported_by',
        'completed_at',
    ];

    protected function casts(): array
    {
        return [
            'metadata' => 'array',
            'completed_at' => 'datetime',
        ];
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function rows(): HasMany
    {
        return $this->hasMany(ProductReconciliationRow::class, 'batch_id');
    }
}
