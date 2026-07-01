<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PlatformContentSection extends Model
{
    protected $fillable = [
        'page_id',
        'section_key',
        'eyebrow',
        'title',
        'body',
        'content',
        'style',
        'sort_order',
        'status',
        'updated_by',
    ];

    protected $casts = [
        'content' => 'array',
        'style' => 'array',
    ];

    public function page(): BelongsTo
    {
        return $this->belongsTo(PlatformContentPage::class, 'page_id');
    }
}
