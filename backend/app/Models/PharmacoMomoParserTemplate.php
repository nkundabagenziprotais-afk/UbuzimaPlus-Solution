<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PharmacoMomoParserTemplate extends Model
{
    use HasFactory;

    protected $fillable = [
        'uuid',
        'tenant_id',
        'name',
        'sender_id',
        'version',
        'status',
        'message_regex',
        'timezone',
        'sample_message',
        'metadata',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'version' => 'integer',
        'metadata' => 'array',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function messages(): HasMany
    {
        return $this->hasMany(
            PharmacoMomoMessage::class,
            'parser_template_id'
        );
    }
}
