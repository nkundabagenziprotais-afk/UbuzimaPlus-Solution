<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const CREATE_PERMISSION =
        'pharmaco.procurement.suppliers.create';

    private const MANAGE_PERMISSION =
        'pharmaco.procurement.suppliers.manage';

    private const PHARMACIST_ROLE =
        'vitapharma-pharmacist';

    public function up(): void
    {
        foreach (
            ['roles', 'permissions', 'permission_role'] as $table
        ) {
            if (! Schema::hasTable($table)) {
                throw new \RuntimeException(
                    "Required RBAC table {$table} does not exist.",
                );
            }
        }

        $now = now();

        $permissionValues = [];

        if (Schema::hasColumn('permissions', 'name')) {
            $permissionValues['name'] =
                'Create Procurement Suppliers';
        }

        if (
            Schema::hasColumn(
                'permissions',
                'permission_group',
            )
        ) {
            $permissionValues['permission_group'] = 'pharmaco';
        }

        if (Schema::hasColumn('permissions', 'description')) {
            $permissionValues['description'] =
                'Create suppliers without supplier-master update authority.';
        }

        if (Schema::hasColumn('permissions', 'status')) {
            $permissionValues['status'] = 'active';
        }

        if (Schema::hasColumn('permissions', 'created_at')) {
            $permissionValues['created_at'] = $now;
        }

        if (Schema::hasColumn('permissions', 'updated_at')) {
            $permissionValues['updated_at'] = $now;
        }

        DB::table('permissions')->updateOrInsert(
            ['code' => self::CREATE_PERMISSION],
            $permissionValues,
        );

        $createPermissionId = DB::table('permissions')
            ->where('code', self::CREATE_PERMISSION)
            ->value('id');

        if ($createPermissionId === null) {
            throw new \RuntimeException(
                'Unable to create the supplier-create permission.',
            );
        }

        $managePermissionId = DB::table('permissions')
            ->where('code', self::MANAGE_PERMISSION)
            ->value('id');

        $roleIds = collect();

        if ($managePermissionId !== null) {
            $roleIds = DB::table('permission_role')
                ->where(
                    'permission_id',
                    $managePermissionId,
                )
                ->pluck('role_id');
        }

        $pharmacistRoleId = DB::table('roles')
            ->where('code', self::PHARMACIST_ROLE)
            ->value('id');

        if ($pharmacistRoleId !== null) {
            $roleIds->push($pharmacistRoleId);
        }

        foreach ($roleIds->unique()->values() as $roleId) {
            $row = [
                'role_id' => (int) $roleId,
                'permission_id' => (int) $createPermissionId,
            ];

            if (
                Schema::hasColumn(
                    'permission_role',
                    'created_at',
                )
            ) {
                $row['created_at'] = $now;
            }

            if (
                Schema::hasColumn(
                    'permission_role',
                    'updated_at',
                )
            ) {
                $row['updated_at'] = $now;
            }

            DB::table('permission_role')
                ->insertOrIgnore($row);
        }
    }

    public function down(): void
    {
        if (
            ! Schema::hasTable('permissions') ||
            ! Schema::hasTable('permission_role')
        ) {
            return;
        }

        $permissionId = DB::table('permissions')
            ->where('code', self::CREATE_PERMISSION)
            ->value('id');

        if ($permissionId === null) {
            return;
        }

        DB::table('permission_role')
            ->where('permission_id', $permissionId)
            ->delete();

        DB::table('permissions')
            ->where('id', $permissionId)
            ->delete();
    }
};
