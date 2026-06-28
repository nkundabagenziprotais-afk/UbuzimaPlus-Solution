<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BranchDepartment extends Model
{
    protected $fillable = [
        'uuid',
        'tenant_id',
        'branch_id',
        'name',
        'code',
        'department_type',
        'phone',
        'email',
        'opening_time',
        'closing_time',
        'is_revenue_center',
        'operating_status',
        'notes',
        'metadata',
    ];

    protected $casts = [
        'is_revenue_center' => 'boolean',
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
}
