<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Tenant extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'uuid',
        'name',
        'slug',
        'legal_name',
        'website_url',
        'primary_solution_id',
        'tenant_type',
        'status',
        'branding',
        'settings',
    ];

    protected $casts = [
        'branding' => 'array',
        'settings' => 'array',
    ];

    public function primarySolution(): BelongsTo
    {
        return $this->belongsTo(Solution::class, 'primary_solution_id');
    }

    public function branches(): HasMany
    {
        return $this->hasMany(Branch::class);
    }

    public function modules(): BelongsToMany
    {
        return $this->belongsToMany(Module::class, 'tenant_module_activations')
            ->withPivot(['solution_id', 'status', 'configuration', 'activated_by', 'activated_at', 'suspended_at'])
            ->withTimestamps();
    }

    public function marketAssignments(): HasMany
    {
        return $this->hasMany(TenantMarketAssignment::class);
    }

    public function serviceProviderLocations(): HasMany
    {
        return $this->hasMany(ServiceProviderLocation::class);
    }
}
