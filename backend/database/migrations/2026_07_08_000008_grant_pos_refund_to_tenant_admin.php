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
                    'pharmaco.pos.refund'
                )
                ->first();

        if (! $permission) {
            $permission =
                Permission::query()->create([
                    'code' =>
                        'pharmaco.pos.refund',
                    'name' =>
                        'Approve POS Sale Refund',
                    'permission_group' =>
                        'pharmaco',
                    'description' =>
                        'Approve controlled POS sale returns, refunds, '
                        . 'credit notes, and payment reconciliation.',
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
                    'pharmaco.pos.refund'
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
         * The permission itself is retained because migration 000007
         * defines it and platform administrators may still require it.
         */
    }
};
