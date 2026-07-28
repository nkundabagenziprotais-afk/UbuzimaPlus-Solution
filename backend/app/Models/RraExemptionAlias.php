<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class RraExemptionAlias extends Model
{
    protected $fillable = [
        'rra_exemption_item_id',
        'alias',
        'normalised_alias',
        'alias_type',
        'status',
        'metadata',
    ];

    protected $casts = [
        'metadata' => 'array',
    ];


    public function exemptionItem(): BelongsTo
    {
        return $this->belongsTo(
            RraExemptionItem::class,
            'rra_exemption_item_id'
        );
    }

}
