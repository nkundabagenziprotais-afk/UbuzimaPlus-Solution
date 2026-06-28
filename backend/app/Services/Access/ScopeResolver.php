<?php

namespace App\Services\Access;

use App\Models\AdminScope;
use App\Models\User;

class ScopeResolver
{
    public function resolveForUser(User $user): ScopeContext
    {
        $scope = AdminScope::query()
            ->where('user_id', $user->id)
            ->where('status', 'active')
            ->orderByRaw("CASE scope_type WHEN 'platform' THEN 1 WHEN 'solution' THEN 2 WHEN 'tenant' THEN 3 WHEN 'branch' THEN 4 ELSE 5 END")
            ->first();

        if (! $scope) {
            return new ScopeContext(
                userId: $user->id,
                scopeType: 'user'
            );
        }

        return new ScopeContext(
            userId: $user->id,
            scopeType: $scope->scope_type,
            solutionId: $scope->solution_id,
            tenantId: $scope->tenant_id,
            branchId: $scope->branch_id
        );
    }

    public function canSupervise(ScopeContext $higher, ScopeContext $lower): bool
    {
        if ($higher->isPlatform()) {
            return true;
        }

        if ($higher->isSolution()) {
            return $lower->solutionId === $higher->solutionId;
        }

        if ($higher->isTenant()) {
            return $lower->tenantId === $higher->tenantId;
        }

        if ($higher->isBranch()) {
            return $lower->branchId === $higher->branchId;
        }

        return false;
    }
}
