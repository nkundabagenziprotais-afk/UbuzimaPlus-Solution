<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AiAgent extends Model
{
    protected $fillable = [
        'solution_id',
        'tenant_id',
        'name',
        'code',
        'description',
        'status',
        'risk_level',
        'instructions_summary',
        'created_by',
    ];
}
