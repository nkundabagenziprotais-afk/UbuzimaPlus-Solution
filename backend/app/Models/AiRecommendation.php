<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AiRecommendation extends Model
{
    protected $fillable = [
        'ai_agent_id',
        'solution_id',
        'tenant_id',
        'branch_id',
        'recommendation_type',
        'title',
        'risk_level',
        'confidence_score',
        'explanation',
        'data_source_summary',
        'recommended_action',
        'requires_approval',
        'status',
        'approved_by',
        'rejected_by',
        'implemented_by',
    ];

    protected $casts = [
        'confidence_score' => 'decimal:2',
        'requires_approval' => 'boolean',
    ];

    public function agent(): BelongsTo
    {
        return $this->belongsTo(AiAgent::class, 'ai_agent_id');
    }
}
