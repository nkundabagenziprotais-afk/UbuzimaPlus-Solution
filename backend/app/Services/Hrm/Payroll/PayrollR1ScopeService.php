<?php

declare(strict_types=1);

namespace App\Services\Hrm\Payroll;

use App\Models\Tenant;
use App\Services\Access\ScopeResolver;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

final class PayrollR1ScopeService
{
    public function __construct(
        private readonly ScopeResolver $resolver
    ) {
    }

    public function resolve(
        Request $request
    ): array {
        $user = $request->user();

        abort_unless(
            $user,
            401
        );

        $scope = $this->resolver
            ->resolveForUser(
                $user
            );

        $slug = trim(
            (string) (
                $request->header(
                    'X-Tenant-Slug'
                )
                ?: $request->input(
                    'tenant_slug'
                )
                ?: $request->query(
                    'tenant_slug'
                )
                ?: ''
            )
        );

        $tenantId = null;

        if ($slug !== '') {
            $tenantId = Tenant::query()
                ->where(
                    'slug',
                    $slug
                )
                ->where(
                    'status',
                    'active'
                )
                ->value('id');
        }

        if (
            $tenantId === null
            &&
            $scope->tenantId !== null
        ) {
            $tenantId =
                (int) $scope->tenantId;
        }

        /*
         * Platform/solution users may still have an active
         * tenant assignment in the current Admin session.
         * This is a fallback only when no explicit/current
         * tenant was supplied.
         */
        if ($tenantId === null) {
            $assignment = $user
                ->tenantAssignments()
                ->where(
                    'status',
                    'active'
                )
                ->orderBy('id')
                ->first();

            if ($assignment !== null) {
                $tenantId =
                    (int) $assignment->tenant_id;
            }
        }

        if ($tenantId === null) {
            throw ValidationException::
                withMessages([
                    'tenant' => [
                        'Select an active tenant before using Payroll Control Center.',
                    ],
                ]);
        }

        if (
            (
                $scope->isTenant()
                ||
                $scope->isBranch()
            )
            &&
            $scope->tenantId !== null
            &&
            (int) $scope->tenantId
                !==
                (int) $tenantId
        ) {
            abort(
                403,
                'Tenant scope mismatch.'
            );
        }

        $branchId =
            $scope->branchId === null
                ? null
                : (int) $scope->branchId;

        return [
            'user' => $user,
            'scope' => $scope,
            'user_id' => (int) $user->id,
            'tenant_id' => (int) $tenantId,
            'branch_id' => $branchId,
        ];
    }
}
