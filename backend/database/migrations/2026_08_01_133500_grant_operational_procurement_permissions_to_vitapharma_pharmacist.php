<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const ROLE_CODES = [
        'vitapharma-pharmacist',
    ];

    private const PERMISSION_CODES = [
        'pharmaco.procurement.view',
        'pharmaco.procurement.purchase_order.create',
        'pharmaco.procurement.purchase_order.receive',
    ];

    public function up(): void
    {
        if (
            ! Schema::hasTable('roles') ||
            ! Schema::hasTable('permissions')
        ) {
            return;
        }

        $roleIds = DB::table('roles')
            ->whereIn('code', self::ROLE_CODES)
            ->pluck('id');

        /*
         * A clean installation may run migrations before RBAC seeders.
         * The dedicated seeder will apply the same grants after role creation.
         */
        if ($roleIds->isEmpty()) {
            return;
        }

        $permissions = DB::table('permissions')
            ->whereIn('code', self::PERMISSION_CODES)
            ->pluck('id', 'code');

        $missing = array_values(array_diff(
            self::PERMISSION_CODES,
            $permissions->keys()->all(),
        ));

        if ($missing !== []) {
            throw new \RuntimeException(
                'Missing required Procurement permissions: ' .
                implode(', ', $missing),
            );
        }

        $pivot = $this->rolePermissionPivot();

        foreach ($roleIds as $roleId) {
            foreach ($permissions as $permissionId) {
                $row = [
                    'role_id' => (int) $roleId,
                    'permission_id' => (int) $permissionId,
                ];

                if (Schema::hasColumn($pivot, 'created_at')) {
                    $row['created_at'] = now();
                }

                if (Schema::hasColumn($pivot, 'updated_at')) {
                    $row['updated_at'] = now();
                }

                DB::table($pivot)->insertOrIgnore($row);
            }
        }
    }

    public function down(): void
    {
        if (
            ! Schema::hasTable('roles') ||
            ! Schema::hasTable('permissions')
        ) {
            return;
        }

        $pivot = $this->findRolePermissionPivot();

        if ($pivot === null) {
            return;
        }

        $roleIds = DB::table('roles')
            ->whereIn('code', self::ROLE_CODES)
            ->pluck('id');

        $permissionIds = DB::table('permissions')
            ->whereIn('code', self::PERMISSION_CODES)
            ->pluck('id');

        if ($roleIds->isEmpty() || $permissionIds->isEmpty()) {
            return;
        }

        DB::table($pivot)
            ->whereIn('role_id', $roleIds)
            ->whereIn('permission_id', $permissionIds)
            ->delete();
    }

    private function rolePermissionPivot(): string
    {
        $pivot = $this->findRolePermissionPivot();

        if ($pivot === null) {
            throw new \RuntimeException(
                'Unable to locate the role-permission pivot table.',
            );
        }

        return $pivot;
    }

    private function findRolePermissionPivot(): ?string
    {
        foreach (
            [
                'role_permissions',
                'role_permission',
                'permission_role',
                'permission_roles',
                'role_has_permissions',
            ] as $table
        ) {
            if (
                Schema::hasTable($table) &&
                Schema::hasColumn($table, 'role_id') &&
                Schema::hasColumn($table, 'permission_id')
            ) {
                return $table;
            }
        }

        return null;
    }
};
