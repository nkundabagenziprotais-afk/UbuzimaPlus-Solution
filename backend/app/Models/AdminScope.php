<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AdminScope extends Model
{
    protected $fillable = [
        'user_id',
        'scope_type',
        'solution_id',
        'tenant_id',
        'branch_id',
        'status',
        'assigned_by',
        'assigned_at',
    ];

    protected $casts = [
        'assigned_at' => 'datetime',
    ];
}
