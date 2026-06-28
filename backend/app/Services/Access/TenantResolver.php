<?php

namespace App\Services\Access;

use App\Models\Tenant;

class TenantResolver
{
    public function findActiveBySlug(string $slug): ?Tenant
    {
        return Tenant::query()
            ->where('slug', $slug)
            ->where('status', 'active')
            ->first();
    }

    public function ensureActiveBySlug(string $slug): Tenant
    {
        return Tenant::query()
            ->where('slug', $slug)
            ->where('status', 'active')
            ->firstOrFail();
    }
}
