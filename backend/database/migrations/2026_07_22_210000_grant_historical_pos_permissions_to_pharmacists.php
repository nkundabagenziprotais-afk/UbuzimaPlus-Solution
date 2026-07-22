<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private array $permissions = [
        'pharmaco.pos.historical.view' => 'View Historical POS',
        'pharmaco.pos.historical.open' => 'Open Historical POS Sessions',
        'pharmaco.pos.historical.record' => 'Record Historical POS Transactions',
    ];

    public function up(): void
    {
        if (
            ! Schema::hasTable('permissions')
            || ! Schema::hasTable('roles')
            || ! Schema::hasTable('permission_role')
        ) {
            return;
        }

        $now = now();

        foreach ($this->permissions as $code => $name) {
            DB::table('permissions')->updateOrInsert(
                ['code' => $code],
                [
                    'name' => $name,
                    'permission_group' => 'pharmaco',
                    'updated_at' => $now,
                    'created_at' => $now,
                ],
            );
        }

        $permissionIds = DB::table('permissions')
            ->whereIn('code', array_keys($this->permissions))
            ->pluck('id');

        if ($permissionIds->isEmpty()) {
            return;
        }

        $roles = DB::table('roles')
            ->where(function ($query): void {
                $query
                    ->whereRaw('LOWER(code) LIKE ?', ['%pharmacist%'])
                    ->orWhereRaw('LOWER(name) LIKE ?', ['%pharmacist%'])
                    ->orWhereRaw('LOWER(code) LIKE ?', ['%pharmacy%'])
                    ->orWhereRaw('LOWER(name) LIKE ?', ['%pharmacy%']);
            })
            ->pluck('id');

        foreach ($roles as $roleId) {
            foreach ($permissionIds as $permissionId) {
                DB::table('permission_role')->insertOrIgnore([
                    'permission_id' => $permissionId,
                    'role_id' => $roleId,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }
        }
    }

    public function down(): void
    {
        /*
         * Do not remove production permissions from pharmacist roles.
         * Permission removal should be handled through role governance.
         */
    }
};
