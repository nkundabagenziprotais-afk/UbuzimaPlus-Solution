<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AiModel extends Model
{
    protected $fillable = [
        'ai_provider_id',
        'solution_id',
        'tenant_id',
        'name',
        'code',
        'model_type',
        'status',
        'risk_level',
        'requires_human_approval',
        'allowed_data_types',
        'approved_by',
        'approved_at',
    ];

    protected $casts = [
        'requires_human_approval' => 'boolean',
        'allowed_data_types' => 'array',
        'approved_at' => 'datetime',
    ];
}
