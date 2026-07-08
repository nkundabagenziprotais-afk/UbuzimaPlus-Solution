<?php

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration {
    public function up(): void
    {
        $permission =
            Permission::query()->firstOrCreate(
                [
                    'code' =>
                        'pharmaco.pos.session.reset',
                ],
                [
                    'name' =>
                        'Reset POS Session',
                    'permission_group' =>
                        'pharmaco',
                    'description' =>
                        'Authorize an additional POS session '
                        . 'after a completed daily closure.',
                    'status' =>
                        'active',
                ]
            );

        /*
         * Existing administrators are identified by their current
         * roles.manage permission rather than by hard-coded role names.
         */
        Role::query()
            ->whereHas(
                'permissions',
                fn ($query) =>
                    $query->where(
                        'permissions.code',
                        'roles.manage'
                    )
            )
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
            ->whereHas(
                'permissions',
                fn ($query) =>
                    $query->where(
                        'permissions.id',
                        $permission->id
                    )
            )
            ->get()
            ->each(
                fn (Role $role) =>
                    $role->permissions()
                        ->detach($permission->id)
            );

        $permission->delete();
    }
};
