<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TwoFactorChallenge extends Model
{
    protected $fillable = [
        'user_id',
        'challenge_token_hash',
        'purpose',
        'setup_secret',
        'device_name',
        'ip_address',
        'user_agent',
        'expires_at',
        'used_at',
    ];

    protected $casts = [
        'setup_secret' => 'encrypted',
        'expires_at' => 'datetime',
        'used_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
