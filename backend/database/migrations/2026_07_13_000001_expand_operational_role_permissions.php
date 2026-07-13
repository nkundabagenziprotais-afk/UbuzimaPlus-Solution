<?php

use App\Models\Permission;
use App\Models\Role;
use App\Support\OperationalPermissionContract;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        foreach (OperationalPermissionContract::definitions() as $code => $definition) {
            Permission::query()->updateOrCreate(
                ['code' => $code],
                [
                    'name' => $definition['name'],
                    'permission_group' => $definition['group'],
                    'description' =>
                        'Operational workspace permission maintained by the '
                        . 'Ubuzima+ permission compatibility contract.',
                    'status' => 'active',
                ],
            );
        }

        Role::query()
            ->with('permissions:id,code')
            ->chunkById(100, function ($roles): void {
                foreach ($roles as $role) {
                    $currentCodes = $role->permissions
                        ->pluck('code')
                        ->values()
                        ->all();

                    $effectiveCodes =
                        OperationalPermissionContract::expand($currentCodes);

                    $permissionIds = Permission::query()
                        ->whereIn('code', $effectiveCodes)
                        ->where('status', 'active')
                        ->pluck('id')
                        ->all();

                    $role->permissions()->syncWithoutDetaching(
                        $permissionIds,
                    );
                }
            });
    }

    public function down(): void
    {
        /*
         * Intentionally non-destructive.
         *
         * Removing permissions from production roles during rollback could
         * revoke access configured after deployment. The permission records
         * and role assignments are therefore retained.
         */
    }
};
