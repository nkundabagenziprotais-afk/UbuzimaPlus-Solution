<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PharmacoGeneralItemCategory extends Model
{
    use HasFactory;

    protected $fillable = [
        'uuid',
        'tenant_id',
        'name',
        'code',
        'status',
        'description',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'metadata' => 'array',
        ];
    }

    public function items(): HasMany
    {
        return $this->hasMany(
            PharmacoGeneralItem::class,
            'pharmaco_general_item_category_id'
        );
    }
}
