<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProductAlias extends Model
{
    protected $fillable = [
        'tenant_id',
        'product_id',
        'alias',
        'normalized_alias',
        'source_key',
        'approved_by',
    ];

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
