<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CorporateMailMessage extends Model
{
    protected $fillable = [
        'uuid',
        'corporate_mail_account_id',
        'corporate_mail_folder_id',
        'message_uid',
        'direction',
        'subject',
        'from_name',
        'from_email',
        'to_recipients',
        'cc_recipients',
        'body_preview',
        'body',
        'importance',
        'status',
        'read_at',
        'sent_at',
        'received_at',
        'metadata',
    ];

    protected $casts = [
        'to_recipients' => 'array',
        'cc_recipients' => 'array',
        'read_at' => 'datetime',
        'sent_at' => 'datetime',
        'received_at' => 'datetime',
        'metadata' => 'array',
    ];

    public function account(): BelongsTo
    {
        return $this->belongsTo(CorporateMailAccount::class, 'corporate_mail_account_id');
    }

    public function folder(): BelongsTo
    {
        return $this->belongsTo(CorporateMailFolder::class, 'corporate_mail_folder_id');
    }
}
