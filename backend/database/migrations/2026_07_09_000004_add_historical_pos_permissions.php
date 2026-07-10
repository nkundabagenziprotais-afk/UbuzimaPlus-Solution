<?php

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        $definitions = [
            [
                'pharmaco.pos.historical.view',
                'View Historical POS',
            ],
            [
                'pharmaco.pos.historical.open',
                'Open Historical POS Sessions',
            ],
            [
                'pharmaco.pos.historical.record',
                'Record Historical POS Transactions',
            ],
            [
                'pharmaco.pos.historical.approve',
                'Approve Historical POS Sessions',
            ],
        ];

        $permissions = [];

        foreach ($definitions as [$code, $name]) {
            $permissions[$code] =
                Permission::query()->updateOrCreate(
                    ['code' => $code],
                    [
                        'name' => $name,
                        'permission_group' => 'pharmaco',
                        'status' => 'active',
                    ]
                );
        }

        $rolePermissions = [
            'ubuzima_plus_super_admin' => [
                'pharmaco.pos.historical.view',
                'pharmaco.pos.historical.open',
                'pharmaco.pos.historical.record',
                'pharmaco.pos.historical.approve',
            ],
            'pharmaco360_solution_admin' => [
                'pharmaco.pos.historical.view',
                'pharmaco.pos.historical.open',
                'pharmaco.pos.historical.record',
                'pharmaco.pos.historical.approve',
            ],
            'tenant_admin' => [
                'pharmaco.pos.historical.view',
                'pharmaco.pos.historical.open',
                'pharmaco.pos.historical.record',
                'pharmaco.pos.historical.approve',
            ],
            'branch_manager' => [
                'pharmaco.pos.historical.view',
                'pharmaco.pos.historical.open',
                'pharmaco.pos.historical.record',
            ],
            'pharmacist' => [
                'pharmaco.pos.historical.view',
                'pharmaco.pos.historical.open',
                'pharmaco.pos.historical.record',
            ],
            'cashier' => [
                'pharmaco.pos.historical.view',
                'pharmaco.pos.historical.open',
                'pharmaco.pos.historical.record',
            ],
        ];

        foreach (
            $rolePermissions
            as $roleCode => $permissionCodes
        ) {
            $role = Role::query()
                ->where('code', $roleCode)
                ->first();

            if (! $role) {
                continue;
            }

            $ids = collect($permissionCodes)
                ->map(
                    fn (string $code) =>
                        $permissions[$code]->id
                )
                ->all();

            $role->permissions()
                ->syncWithoutDetaching($ids);
        }
    }

    public function down(): void
    {
        $codes = [
            'pharmaco.pos.historical.view',
            'pharmaco.pos.historical.open',
            'pharmaco.pos.historical.record',
            'pharmaco.pos.historical.approve',
        ];

        $permissions = Permission::query()
            ->whereIn('code', $codes)
            ->get();

        foreach ($permissions as $permission) {
            $permission->roles()->detach();
            $permission->delete();
        }
    }
};
