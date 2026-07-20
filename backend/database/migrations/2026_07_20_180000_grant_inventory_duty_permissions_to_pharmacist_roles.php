<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private array $permissions = [
        'pharmaco.inventory.manage' => [
            'name' => 'Manage Inventory',
            'group' => 'pharmaco.inventory',
        ],
        'pharmaco.inventory.view' => [
            'name' => 'View Inventory',
            'group' => 'pharmaco.inventory',
        ],
        'pharmaco.product_inventory.update' => [
            'name' => 'Update Product Inventory',
            'group' => 'pharmaco.inventory',
        ],
        'pharmaco.inventory.adjust' => [
            'name' => 'Adjust Inventory',
            'group' => 'pharmaco.inventory',
        ],
        'pharmaco.inventory.transfer' => [
            'name' => 'Transfer Inventory',
            'group' => 'pharmaco.inventory',
        ],
        'pharmaco.inventory.stock_count' => [
            'name' => 'Perform Inventory Stock Count',
            'group' => 'pharmaco.inventory',
        ],
        'pharmaco.inventory.low_stock.view' => [
            'name' => 'View Low Stock',
            'group' => 'pharmaco.inventory',
        ],
        'pharmaco.inventory.batch_expiry.view' => [
            'name' => 'View Batch Expiry',
            'group' => 'pharmaco.inventory',
        ],
        'pharmaco.inventory.batch_expiry.manage' => [
            'name' => 'Manage Batch Expiry',
            'group' => 'pharmaco.inventory',
        ],
        'pharmaco.inventory.valuation.view' => [
            'name' => 'View Inventory Valuation',
            'group' => 'pharmaco.inventory',
        ],
    ];

    public function up(): void
    {
        if (! Schema::hasTable('permissions') || ! Schema::hasTable('roles')) {
            return;
        }

        $now = now();

        foreach ($this->permissions as $code => $definition) {
            DB::table('permissions')->updateOrInsert(
                ['code' => $code],
                [
                    'name' => $definition['name'],
                    'permission_group' => $definition['group'],
                    'updated_at' => $now,
                    'created_at' => DB::raw('COALESCE(created_at, CURRENT_TIMESTAMP)'),
                ],
            );
        }

        $permissionIds = DB::table('permissions')
            ->whereIn('code', array_keys($this->permissions))
            ->pluck('id');

        if ($permissionIds->isEmpty()) {
            return;
        }

        $roleQuery = DB::table('roles');

        $roleQuery->where(function ($query): void {
            $query->whereRaw('LOWER(name) = ?', ['pharmacist'])
                ->orWhereRaw('LOWER(name) LIKE ?', ['%pharmacist%']);

            if (Schema::hasColumn('roles', 'slug')) {
                $query->orWhereRaw('LOWER(slug) = ?', ['pharmacist'])
                    ->orWhereRaw('LOWER(slug) LIKE ?', ['%pharmacist%']);
            }

            if (Schema::hasColumn('roles', 'code')) {
                $query->orWhereRaw('LOWER(code) = ?', ['pharmacist'])
                    ->orWhereRaw('LOWER(code) LIKE ?', ['%pharmacist%']);
            }
        });

        $roleIds = $roleQuery->pluck('id');

        foreach ($roleIds as $roleId) {
            foreach ($permissionIds as $permissionId) {
                DB::table('permission_role')->insertOrIgnore([
                    'role_id' => $roleId,
                    'permission_id' => $permissionId,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }
        }
    }

    public function down(): void
    {
        /*
         * Do not remove permissions from active production pharmacist roles.
         * Permission removal should be handled through role governance.
         */
    }
};
