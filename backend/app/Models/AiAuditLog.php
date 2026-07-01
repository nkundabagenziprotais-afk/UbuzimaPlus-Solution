<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AiAuditLog extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'ai_agent_id',
        'ai_model_id',
        'solution_id',
        'tenant_id',
        'user_id',
        'action',
        'risk_level',
        'metadata',
        'created_at',
    ];

    protected $casts = [
        'metadata' => 'array',
        'created_at' => 'datetime',
    ];
}
