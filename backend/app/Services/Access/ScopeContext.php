<?php

namespace App\Services\Access;

class ScopeContext
{
    public function __construct(
        public readonly ?int $userId,
        public readonly string $scopeType,
        public readonly ?int $solutionId = null,
        public readonly ?int $tenantId = null,
        public readonly ?int $branchId = null,
    ) {
    }

    public function isPlatform(): bool
    {
        return $this->scopeType === 'platform';
    }

    public function isSolution(): bool
    {
        return $this->scopeType === 'solution';
    }

    public function isTenant(): bool
    {
        return $this->scopeType === 'tenant';
    }

    public function isBranch(): bool
    {
        return $this->scopeType === 'branch';
    }

    public function toArray(): array
    {
        return [
            'user_id' => $this->userId,
            'scope_type' => $this->scopeType,
            'solution_id' => $this->solutionId,
            'tenant_id' => $this->tenantId,
            'branch_id' => $this->branchId,
        ];
    }
}
