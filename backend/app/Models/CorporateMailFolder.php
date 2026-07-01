<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CorporateMailFolder extends Model
{
    protected $fillable = [
        'corporate_mail_account_id',
        'folder_key',
        'name',
        'sort_order',
        'unread_count',
        'metadata',
    ];

    protected $casts = [
        'metadata' => 'array',
    ];

    public function account(): BelongsTo
    {
        return $this->belongsTo(CorporateMailAccount::class, 'corporate_mail_account_id');
    }

    public function messages(): HasMany
    {
        return $this->hasMany(CorporateMailMessage::class);
    }
}
