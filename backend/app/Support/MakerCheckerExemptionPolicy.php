<?php

namespace App\Support;

use Illuminate\Support\Facades\DB;

/**
 * Central Admin/Owner maker-checker exemption.
 *
 * This does NOT grant a permission.
 *
 * The actor must already satisfy the route/service permission,
 * transaction state, tenant/branch scope and business validation.
 *
 * This policy answers only:
 *
 * May an already-authorized actor also act as checker
 * where that actor is the maker?
 */
final class MakerCheckerExemptionPolicy
{
    /**
     * @var array<int,string>
     */
    private const EXEMPT_ROLE_CODES = [
        'ubuzima_plus_super_admin',
        'pharmaco360_solution_admin',
        'tenant_admin',
        'vitapharma-owner',
    ];

    /**
     * @return array<int,string>
     */
    public static function roleCodes(): array
    {
        return self::EXEMPT_ROLE_CODES;
    }

    public static function allows(
        int $actorId,
        ?int $tenantId = null,
        ?int $branchId = null
    ): bool {
        if ($actorId <= 0) {
            return false;
        }

        $query = DB::table('role_user as ru')
            ->join('roles as r', 'r.id', '=', 'ru.role_id')
            ->where('ru.user_id', $actorId)
            ->where('ru.status', 'active')
            ->where('r.status', 'active')
            ->whereIn('r.code', self::EXEMPT_ROLE_CODES);

        if ($tenantId !== null) {
            $query->where(
                function ($scope) use ($tenantId): void {
                    $scope
                        ->whereNull('ru.tenant_id')
                        ->orWhere('ru.tenant_id', $tenantId);
                }
            );
        }

        if ($branchId !== null) {
            $query->where(
                function ($scope) use ($branchId): void {
                    $scope
                        ->whereNull('ru.branch_id')
                        ->orWhere('ru.branch_id', $branchId);
                }
            );
        }

        return $query->exists();
    }
}
