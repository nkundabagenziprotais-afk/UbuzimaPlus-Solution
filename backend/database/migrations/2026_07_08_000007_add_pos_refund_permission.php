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
                        'pharmaco.pos.refund',
                ],
                [
                    'name' =>
                        'Approve POS Sale Refund',
                    'permission_group' =>
                        'pharmaco',
                    'description' =>
                        'Approve controlled POS sale returns, refunds, '
                        . 'credit notes, and payment reconciliation.',
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
                    'pharmaco.pos.refund'
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
