<?php

namespace App\Services\Hrm;

use App\Models\Tenant;
use App\Services\Access\ScopeContext;
use App\Services\Access\ScopeResolver;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;

class HrmTenantContextService
{
    /**
     * @return array{tenant: Tenant, scope: ScopeContext}
     */
    public function resolve(
        Request $request,
        ScopeResolver $scopeResolver
    ): array {
        $user = $request->user();

        abort_unless(
            $user,
            401,
            'Authentication is required.'
        );

        $scope = $scopeResolver->resolveForUser(
            $user
        );

        $tenant = null;

        $attributeTenant = $request->attributes->get(
            'tenant'
        );

        if (
            $attributeTenant instanceof Tenant
        ) {
            $tenant = $attributeTenant;
        }

        $headerSlug = trim(
            (string) (
                $request->header(
                    'X-Tenant-Slug'
                )
                ?? ''
            )
        );

        if (
            ! $tenant
            &&
            $headerSlug !== ''
        ) {
            $tenant = Tenant::query()
                ->where(
                    'slug',
                    $headerSlug
                )
                ->first();
        }

        if (
            ! $tenant
            &&
            $scope->tenantId
        ) {
            $tenant = Tenant::query()
                ->find(
                    $scope->tenantId
                );
        }

        abort_unless(
            $tenant,
            422,
            'A valid tenant context is required for Human Resources.'
        );

        if (
            (
                $scope->isTenant()
                ||
                $scope->isBranch()
            )
            &&
            (int) $scope->tenantId
                !==
            (int) $tenant->id
        ) {
            abort(
                403,
                'The selected tenant is outside your authorized scope.'
            );
        }

        if (
            $scope->isSolution()
            &&
            $scope->solutionId
            &&
            Schema::hasColumn(
                'tenants',
                'solution_id'
            )
        ) {
            abort_unless(
                (int) $tenant->solution_id
                    ===
                (int) $scope->solutionId,
                403,
                'The selected tenant is outside your solution scope.'
            );
        }

        if (
            $scope->isBranch()
            &&
            ! $scope->branchId
        ) {
            abort(
                403,
                'Branch-scoped HR access requires an authorized branch.'
            );
        }

        $request->attributes->set(
            'tenant',
            $tenant
        );

        return [
            'tenant' => $tenant,
            'scope' => $scope,
        ];
    }
}
