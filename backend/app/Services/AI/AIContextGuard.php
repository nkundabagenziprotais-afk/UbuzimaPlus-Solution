<?php

namespace App\Services\AI;

use App\Models\Tenant;
use App\Services\Access\ModuleAccessService;

class AIContextGuard
{
    public function __construct(
        private readonly ModuleAccessService $moduleAccessService
    ) {
    }

    public function canUseAIForTenant(Tenant $tenant): bool
    {
        return $this->moduleAccessService->isActiveForTenant($tenant, 'platform.ai_center');
    }

    public function isControlledForTenant(Tenant $tenant): bool
    {
        return $this->moduleAccessService->isControlledForTenant($tenant, 'platform.ai_center');
    }

    public function requiresHumanApproval(string $riskLevel): bool
    {
        return in_array($riskLevel, ['medium', 'high', 'critical'], true);
    }

    public function assertTenantBoundary(?int $requestedTenantId, ?int $contextTenantId): void
    {
        abort_if(
            $requestedTenantId !== null && $contextTenantId !== null && $requestedTenantId !== $contextTenantId,
            403,
            'AI access denied because tenant boundary does not match.'
        );
    }
}
