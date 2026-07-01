<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PharmacistChatMessage extends Model
{
    protected $fillable = [
        'uuid',
        'pharmacist_chat_conversation_id',
        'sender_type',
        'sender_user_id',
        'sender_display_name',
        'body',
        'attachments',
        'read_at',
        'metadata',
    ];

    protected $casts = [
        'attachments' => 'array',
        'read_at' => 'datetime',
        'metadata' => 'array',
    ];

    public function conversation(): BelongsTo
    {
        return $this->belongsTo(PharmacistChatConversation::class, 'pharmacist_chat_conversation_id');
    }

    public function sender(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sender_user_id');
    }
}
