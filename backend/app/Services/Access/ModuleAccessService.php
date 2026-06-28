<?php

namespace App\Services\Access;

use App\Models\Module;
use App\Models\Tenant;

class ModuleAccessService
{
    public function isActiveForTenant(Tenant $tenant, string $moduleCode): bool
    {
        return $tenant->modules()
            ->where('modules.code', $moduleCode)
            ->wherePivot('status', 'active')
            ->exists();
    }

    public function isControlledForTenant(Tenant $tenant, string $moduleCode): bool
    {
        return $tenant->modules()
            ->where('modules.code', $moduleCode)
            ->wherePivot('status', 'controlled')
            ->exists();
    }

    public function moduleExists(string $moduleCode): bool
    {
        return Module::query()->where('code', $moduleCode)->exists();
    }

    public function requireActiveForTenant(Tenant $tenant, string $moduleCode): void
    {
        abort_unless(
            $this->isActiveForTenant($tenant, $moduleCode),
            403,
            'Module is not active for this tenant.'
        );
    }
}
