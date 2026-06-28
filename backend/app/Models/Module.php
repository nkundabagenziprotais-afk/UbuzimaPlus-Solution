<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Module extends Model
{
    protected $fillable = [
        'name',
        'code',
        'module_group',
        'solution_scope',
        'description',
        'status',
        'dependencies',
    ];

    protected $casts = [
        'dependencies' => 'array',
    ];

    public function solutions(): BelongsToMany
    {
        return $this->belongsToMany(Solution::class, 'solution_modules')
            ->withPivot(['status', 'default_config'])
            ->withTimestamps();
    }

    public function tenants(): BelongsToMany
    {
        return $this->belongsToMany(Tenant::class, 'tenant_module_activations')
            ->withPivot(['solution_id', 'status', 'configuration', 'activated_by', 'activated_at', 'suspended_at'])
            ->withTimestamps();
    }
}
