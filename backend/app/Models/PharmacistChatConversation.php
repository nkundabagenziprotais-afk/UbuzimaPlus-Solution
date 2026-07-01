<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PharmacistChatConversation extends Model
{
    protected $fillable = [
        'uuid',
        'tenant_id',
        'branch_id',
        'customer_name',
        'customer_phone',
        'customer_email',
        'source_channel',
        'status',
        'priority',
        'assigned_pharmacist_id',
        'last_message_at',
        'metadata',
    ];

    protected $casts = [
        'last_message_at' => 'datetime',
        'metadata' => 'array',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function assignedPharmacist(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_pharmacist_id');
    }

    public function messages(): HasMany
    {
        return $this->hasMany(PharmacistChatMessage::class);
    }
}
