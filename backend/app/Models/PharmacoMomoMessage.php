<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class PharmacoMomoMessage extends Model
{
    use HasFactory;

    protected $fillable = [
        'uuid',
        'tenant_id',
        'parser_template_id',
        'device_uuid',
        'sender_id',
        'raw_message',
        'received_at',
        'transaction_at',
        'customer_name',
        'phone_masked',
        'phone_suffix',
        'amount',
        'currency',
        'provider_transaction_id',
        'balance',
        'et_id',
        'parse_status',
        'parse_confidence',
        'duplicate_hash',
        'parse_errors',
        'metadata',
    ];

    protected $hidden = [
        'raw_message',
    ];

    protected $casts = [
        'raw_message' => 'encrypted',
        'received_at' => 'datetime',
        'transaction_at' => 'datetime',
        'amount' => 'decimal:2',
        'balance' => 'decimal:2',
        'parse_confidence' => 'decimal:2',
        'parse_errors' => 'array',
        'metadata' => 'array',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function parserTemplate(): BelongsTo
    {
        return $this->belongsTo(
            PharmacoMomoParserTemplate::class,
            'parser_template_id'
        );
    }

    public function reconciliation(): HasOne
    {
        return $this->hasOne(
            PharmacoMomoReconciliation::class,
            'momo_message_id'
        );
    }
}
