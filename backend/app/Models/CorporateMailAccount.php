<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CorporateMailAccount extends Model
{
    protected $fillable = [
        'user_id',
        'display_name',
        'email_address',
        'provider',
        'status',
        'sync_status',
        'last_synced_at',
        'configuration',
    ];

    protected $casts = [
        'last_synced_at' => 'datetime',
        'configuration' => 'array',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function folders(): HasMany
    {
        return $this->hasMany(CorporateMailFolder::class);
    }

    public function messages(): HasMany
    {
        return $this->hasMany(CorporateMailMessage::class);
    }
}
