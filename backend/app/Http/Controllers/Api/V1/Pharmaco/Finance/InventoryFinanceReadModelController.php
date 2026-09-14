<?php

namespace App\Http\Controllers\Api\V1\Pharmaco\Finance;

use App\Http\Controllers\Controller;
use App\Services\InventoryFinance\InventoryFinanceReadModelService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class InventoryFinanceReadModelController extends Controller
{
    public function index(
        Request $request,
        InventoryFinanceReadModelService $service
    ) {
        $user = $request->user();

        if (!$user) {
            abort(
                401,
                'Authentication required.'
            );
        }

        $this->assertFinancePermission(
            $user
        );

        $tenantId =
            $this->resolveTenantId(
                $request,
                $user
            );

        $limit = (int) $request->query(
            'limit',
            100
        );

        $limit = max(
            25,
            min(
                250,
                $limit
            )
        );

        try {
            return response()->json(
                $service->build(
                    $tenantId,
                    $limit
                ),
                200,
                array(
                    'Cache-Control' =>
                        'no-store, private',

                    'X-Aquila-Inventory-Finance' =>
                        'IF1-B1-READ-ONLY',
                )
            );

        } catch (\Throwable $e) {
            report($e);

            return response()->json(
                array(
                    'message' =>
                        'Inventory Finance read model could not be generated safely.',

                    'read_only' =>
                        true,

                    'revision' =>
                        'IF1-B1',
                ),
                500
            );
        }
    }

    protected function resolveTenantId(
        Request $request,
        $user
    ) {
        $userId =
            (int) $user->getAuthIdentifier();

        $allowed = array();

        if (
            Schema::hasTable(
                'tenant_users'
            )
        ) {
            $columns =
                Schema::getColumnListing(
                    'tenant_users'
                );

            if (
                in_array(
                    'user_id',
                    $columns,
                    true
                ) &&
                in_array(
                    'tenant_id',
                    $columns,
                    true
                )
            ) {
                $ids =
                    DB::table(
                        'tenant_users'
                    )
                        ->where(
                            'user_id',
                            $userId
                        )
                        ->pluck(
                            'tenant_id'
                        );

                foreach ($ids as $id) {
                    $id = (int) $id;

                    if ($id > 0) {
                        $allowed[$id] = $id;
                    }
                }
            }
        }

        if (
            Schema::hasTable(
                'users'
            )
        ) {
            $columns =
                Schema::getColumnListing(
                    'users'
                );

            if (
                in_array(
                    'tenant_id',
                    $columns,
                    true
                )
            ) {
                $tenantId =
                    (int) DB::table(
                        'users'
                    )
                        ->where(
                            'id',
                            $userId
                        )
                        ->value(
                            'tenant_id'
                        );

                if ($tenantId > 0) {
                    $allowed[$tenantId] =
                        $tenantId;
                }
            }
        }

        $requested =
            $request->header(
                'X-Tenant-ID'
            );

        if (
            $requested === null ||
            trim((string) $requested) === ''
        ) {
            $requested =
                $request->query(
                    'tenant_id'
                );
        }

        $requestedId =
            $requested !== null &&
            $requested !== ''
                ? (int) $requested
                : 0;

        $global =
            $this->isGlobalAdmin(
                $userId
            );

        if ($requestedId > 0) {
            if (
                $global &&
                $this->tenantExists(
                    $requestedId
                )
            ) {
                return $requestedId;
            }

            if (
                isset(
                    $allowed[$requestedId]
                )
            ) {
                return $requestedId;
            }

            abort(
                403,
                'Requested tenant is outside the authenticated user scope.'
            );
        }

        if (
            count($allowed) === 1
        ) {
            return (int) reset(
                $allowed
            );
        }

        if (
            count($allowed) > 1
        ) {
            abort(
                422,
                'Tenant context is required for Inventory Finance.'
            );
        }

        if ($global) {
            abort(
                422,
                'Global administrators must provide an explicit tenant context.'
            );
        }

        abort(
            403,
            'No authorized tenant context is available.'
        );
    }

    protected function assertFinancePermission(
        $user
    ) {
        $userId =
            (int) $user->getAuthIdentifier();

        if (
            $this->isGlobalAdmin(
                $userId
            )
        ) {
            return;
        }

        if (
            !Schema::hasTable(
                'roles'
            ) ||
            !Schema::hasTable(
                'role_user'
            ) ||
            !Schema::hasTable(
                'permissions'
            ) ||
            !Schema::hasTable(
                'permission_role'
            )
        ) {
            return;
        }

        $roleColumns =
            Schema::getColumnListing(
                'roles'
            );

        $roleUserColumns =
            Schema::getColumnListing(
                'role_user'
            );

        $permissionColumns =
            Schema::getColumnListing(
                'permissions'
            );

        $permissionRoleColumns =
            Schema::getColumnListing(
                'permission_role'
            );

        $permissionNameColumn =
            $this->firstExisting(
                array(
                    'name',
                    'slug',
                    'code'
                ),
                $permissionColumns
            );

        if (
            !$permissionNameColumn ||
            !in_array(
                'user_id',
                $roleUserColumns,
                true
            ) ||
            !in_array(
                'role_id',
                $roleUserColumns,
                true
            ) ||
            !in_array(
                'role_id',
                $permissionRoleColumns,
                true
            ) ||
            !in_array(
                'permission_id',
                $permissionRoleColumns,
                true
            )
        ) {
            return;
        }

        $financePermissionIds =
            DB::table(
                'permissions'
            )
                ->select(
                    'id',
                    $permissionNameColumn
                )
                ->get()
                ->filter(
                    function ($row) use (
                        $permissionNameColumn
                    ) {
                        $value = strtolower(
                            (string)
                            $row->{$permissionNameColumn}
                        );

                        return
                            strpos(
                                $value,
                                'finance'
                            ) !== false ||
                            strpos(
                                $value,
                                'account'
                            ) !== false ||
                            strpos(
                                $value,
                                'ledger'
                            ) !== false;
                    }
                )
                ->pluck(
                    'id'
                )
                ->map(
                    function ($id) {
                        return (int) $id;
                    }
                )
                ->values()
                ->all();

        /*
         * If the installation has no Finance-specific
         * permissions at all, tenant membership remains
         * the existing fallback rather than inventing a
         * new permission convention.
         */
        if (
            count(
                $financePermissionIds
            ) === 0
        ) {
            return;
        }

        $hasPermission =
            DB::table(
                'role_user as ru'
            )
                ->join(
                    'permission_role as pr',
                    'pr.role_id',
                    '=',
                    'ru.role_id'
                )
                ->where(
                    'ru.user_id',
                    $userId
                )
                ->whereIn(
                    'pr.permission_id',
                    $financePermissionIds
                )
                ->exists();

        if (!$hasPermission) {
            abort(
                403,
                'Finance permission is required.'
            );
        }
    }

    protected function isGlobalAdmin(
        $userId
    ) {
        if (
            !Schema::hasTable(
                'roles'
            ) ||
            !Schema::hasTable(
                'role_user'
            )
        ) {
            return false;
        }

        $roleColumns =
            Schema::getColumnListing(
                'roles'
            );

        $pivotColumns =
            Schema::getColumnListing(
                'role_user'
            );

        if (
            !in_array(
                'user_id',
                $pivotColumns,
                true
            ) ||
            !in_array(
                'role_id',
                $pivotColumns,
                true
            )
        ) {
            return false;
        }

        $nameColumn =
            $this->firstExisting(
                array(
                    'name',
                    'slug',
                    'code'
                ),
                $roleColumns
            );

        if (!$nameColumn) {
            return false;
        }

        $roles =
            DB::table(
                'role_user as ru'
            )
                ->join(
                    'roles as r',
                    'r.id',
                    '=',
                    'ru.role_id'
                )
                ->where(
                    'ru.user_id',
                    $userId
                )
                ->pluck(
                    'r.' . $nameColumn
                );

        foreach ($roles as $role) {
            $normalized =
                strtolower(
                    trim(
                        (string) $role
                    )
                );

            $normalized =
                preg_replace(
                    '/[^a-z0-9]+/',
                    '_',
                    $normalized
                );

            $normalized =
                trim(
                    $normalized,
                    '_'
                );

            if (
                in_array(
                    $normalized,
                    array(
                        'super_admin',
                        'platform_admin',
                        'system_admin'
                    ),
                    true
                )
            ) {
                return true;
            }
        }

        return false;
    }

    protected function tenantExists(
        $tenantId
    ) {
        if (
            !Schema::hasTable(
                'tenants'
            )
        ) {
            return false;
        }

        return DB::table(
            'tenants'
        )
            ->where(
                'id',
                (int) $tenantId
            )
            ->exists();
    }

    protected function firstExisting(
        array $candidates,
        array $columns
    ) {
        foreach ($candidates as $candidate) {
            if (
                in_array(
                    $candidate,
                    $columns,
                    true
                )
            ) {
                return $candidate;
            }
        }

        return null;
    }
}
