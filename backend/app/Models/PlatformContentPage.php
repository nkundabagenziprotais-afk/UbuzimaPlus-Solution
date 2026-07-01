<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PlatformContentPage extends Model
{
    protected $fillable = [
        'slug',
        'title',
        'description',
        'template',
        'status',
        'seo',
        'style',
        'updated_by',
        'published_at',
    ];

    protected $casts = [
        'seo' => 'array',
        'style' => 'array',
        'published_at' => 'datetime',
    ];

    public function sections(): HasMany
    {
        return $this->hasMany(PlatformContentSection::class, 'page_id')
            ->orderBy('sort_order')
            ->orderBy('id');
    }
}
