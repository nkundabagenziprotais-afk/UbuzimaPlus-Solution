<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PharmacoPosClockEvent extends Model
{
    use HasFactory;

    protected $fillable = ['uuid', 'tenant_id', 'pos_session_id', 'user_id', 'event_type', 'amount', 'notes', 'metadata'];
    protected $casts = ['amount' => 'decimal:2', 'metadata' => 'array'];

    public function session(): BelongsTo { return $this->belongsTo(PharmacoPosSession::class, 'pos_session_id'); }
    public function user(): BelongsTo { return $this->belongsTo(User::class); }
}
