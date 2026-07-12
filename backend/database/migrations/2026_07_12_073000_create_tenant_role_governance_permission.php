<?php

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $platformPermission = Permission::query()
            ->where('code', 'roles.manage')
            ->first();

        if (! $platformPermission) {
            return;
        }

        $tenantPermission = Permission::query()
            ->where('code', 'tenant.roles.manage')
            ->first();

        if (! $tenantPermission) {
            $tenantPermission = $platformPermission->replicate();

            $tenantPermission->code = 'tenant.roles.manage';

            if (Schema::hasColumn('permissions', 'name')) {
                $tenantPermission->name =
                    'Manage tenant roles';
            }

            if (Schema::hasColumn(
                'permissions',
                'description',
            )) {
                $tenantPermission->description =
                    'Create and manage roles inside the active tenant.';
            }

            if (Schema::hasColumn(
                'permissions',
                'scope_type',
            )) {
                $tenantPermission->scope_type = 'tenant';
            }

            if (Schema::hasColumn(
                'permissions',
                'scope',
            )) {
                $tenantPermission->scope = 'tenant';
            }

            $tenantPermission->save();
        }

        $roleIds = Role::query()
            ->whereIn('code', [
                'tenant_admin',
                'tenant_user_administrator',
                'tenant_security_administrator',
            ])
            ->orWhereHas(
                'permissions',
                fn ($query) =>
                    $query->where(
                        'permissions.code',
                        'roles.manage',
                    ),
            )
            ->pluck('id');

        Role::query()
            ->whereIn('id', $roleIds)
            ->each(
                fn (Role $role) =>
                    $role->permissions()
                        ->syncWithoutDetaching([
                            $tenantPermission->getKey(),
                        ]),
            );
    }

    public function down(): void
    {
        $tenantPermission = Permission::query()
            ->where('code', 'tenant.roles.manage')
            ->first();

        if (! $tenantPermission) {
            return;
        }

        Role::query()
            ->whereHas(
                'permissions',
                fn ($query) =>
                    $query->where(
                        'permissions.id',
                        $tenantPermission->getKey(),
                    ),
            )
            ->each(
                fn (Role $role) =>
                    $role->permissions()
                        ->detach(
                            $tenantPermission->getKey(),
                        ),
            );

        $tenantPermission->delete();
    }
};
