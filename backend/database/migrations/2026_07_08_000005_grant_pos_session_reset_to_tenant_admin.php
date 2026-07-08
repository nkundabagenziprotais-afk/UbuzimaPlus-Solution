<?php

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration {
    public function up(): void
    {
        $permission =
            Permission::query()
                ->where(
                    'code',
                    'pharmaco.pos.session.reset'
                )
                ->first();

        if (! $permission) {
            $permission =
                Permission::query()->create([
                    'code' =>
                        'pharmaco.pos.session.reset',
                    'name' =>
                        'Reset POS Session',
                    'permission_group' =>
                        'pharmaco',
                    'description' =>
                        'Authorize an additional POS session '
                        . 'after a completed daily closure.',
                    'status' =>
                        'active',
                ]);
        }

        Role::query()
            ->where(function ($query) {
                $query
                    ->whereIn(
                        'code',
                        [
                            'ubuzima_plus_super_admin',
                            'tenant_admin',
                        ]
                    )
                    ->orWhereHas(
                        'permissions',
                        fn ($permissionQuery) =>
                            $permissionQuery->where(
                                'permissions.code',
                                'roles.manage'
                            )
                    );
            })
            ->get()
            ->each(
                fn (Role $role) =>
                    $role->permissions()
                        ->syncWithoutDetaching([
                            $permission->id,
                        ])
            );
    }

    public function down(): void
    {
        $permission =
            Permission::query()
                ->where(
                    'code',
                    'pharmaco.pos.session.reset'
                )
                ->first();

        if (! $permission) {
            return;
        }

        Role::query()
            ->where('code', 'tenant_admin')
            ->get()
            ->each(
                fn (Role $role) =>
                    $role->permissions()
                        ->detach($permission->id)
            );

        /*
         * The permission itself is retained because migration 000004
         * may still assign it to platform administrators.
         */
    }
};
