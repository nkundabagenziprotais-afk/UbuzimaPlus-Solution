<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use RuntimeException;

class PharmacistProcurementAccessSeeder extends Seeder
{
    private const ROLE_CODES = [
        'vitapharma-pharmacist',
    ];

    private const PERMISSION_CODES = [
        'pharmaco.procurement.view',
        'pharmaco.procurement.purchase_order.create',
        'pharmaco.procurement.purchase_order.receive',
    ];

    public function run(): void
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
            throw new RuntimeException(
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

    private function rolePermissionPivot(): string
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

        throw new RuntimeException(
            'Unable to locate the role-permission pivot table.',
        );
    }
}
