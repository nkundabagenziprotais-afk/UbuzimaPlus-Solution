<?php

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        $permission = Permission::query()->updateOrCreate(
            [
                'code' =>
                    'pharmaco.inventory.duplicate_override',
            ],
            [
                'name' =>
                    'Inventory Duplicate Override',
                'permission_group' => 'inventory',
                'description' =>
                    'Allows an authorized user to record a '
                    . 'suspected duplicate stock receipt after '
                    . 'reviewing the existing transaction and '
                    . 'providing a mandatory reason.',
                'status' => 'active',
            ],
        );

        Role::query()
            ->with('permissions:id,code')
            ->chunkById(
                100,
                function ($roles) use ($permission): void {
                    foreach ($roles as $role) {
                        if (
                            $role->permissions
                                ->pluck('code')
                                ->contains(
                                    'pharmaco.inventory.manage'
                                )
                        ) {
                            $role->permissions()
                                ->syncWithoutDetaching([
                                    $permission->id,
                                ]);
                        }
                    }
                }
            );
    }

    public function down(): void
    {
        /*
         * Intentionally non-destructive.
         *
         * Existing role assignments are retained so rollback does
         * not silently revoke access configured after deployment.
         */
    }
};
