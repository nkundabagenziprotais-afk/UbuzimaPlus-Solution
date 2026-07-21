<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private array $permissions = [
        // POS / Sales home and pharmacist counter duties.
        'tenant.dashboard.view' => ['name' => 'View Tenant Dashboard', 'group' => 'tenant'],
        'pharmaco.pos.use' => ['name' => 'Use POS', 'group' => 'pharmaco.sales'],
        'pharmaco.pos.open_session' => ['name' => 'Open POS Session', 'group' => 'pharmaco.sales'],
        'pharmaco.pos.close_session' => ['name' => 'Close POS Session', 'group' => 'pharmaco.sales'],
        'pharmaco.pos.historical.view' => ['name' => 'View Historical POS', 'group' => 'pharmaco.sales'],
        'pharmaco.pos.historical.open' => ['name' => 'Open Historical POS', 'group' => 'pharmaco.sales'],
        'pharmaco.pos.historical.record' => ['name' => 'Record Historical POS', 'group' => 'pharmaco.sales'],
        'pharmaco.sales.view' => ['name' => 'View Sales', 'group' => 'pharmaco.sales'],
        'pharmaco.sales.create' => ['name' => 'Create Sales', 'group' => 'pharmaco.sales'],
        'pharmaco.sales.manage' => ['name' => 'Manage Sales', 'group' => 'pharmaco.sales'],
        'pharmaco.sales.receipt.reprint' => ['name' => 'Reprint Sales Receipts', 'group' => 'pharmaco.sales'],

        // Product master and inventory recording duties.
        'pharmaco.products.manage' => ['name' => 'Manage Products', 'group' => 'pharmaco.inventory'],
        'pharmaco.product_master.view' => ['name' => 'View Product Master', 'group' => 'pharmaco.inventory'],
        'pharmaco.product_inventory.receive' => ['name' => 'Receive Product Inventory', 'group' => 'pharmaco.inventory'],
        'pharmaco.product_inventory.update' => ['name' => 'Update Product Inventory', 'group' => 'pharmaco.inventory'],
        'pharmaco.inventory.manage' => ['name' => 'Manage Inventory', 'group' => 'pharmaco.inventory'],
        'pharmaco.inventory.view' => ['name' => 'View Inventory', 'group' => 'pharmaco.inventory'],
        'pharmaco.inventory.adjust' => ['name' => 'Adjust Inventory', 'group' => 'pharmaco.inventory'],
        'pharmaco.inventory.transfer' => ['name' => 'Transfer Inventory', 'group' => 'pharmaco.inventory'],
        'pharmaco.inventory.stock_count' => ['name' => 'Perform Inventory Stock Count', 'group' => 'pharmaco.inventory'],
        'pharmaco.inventory.low_stock.view' => ['name' => 'View Low Stock', 'group' => 'pharmaco.inventory'],
        'pharmaco.inventory.batch_expiry.view' => ['name' => 'View Batch Expiry', 'group' => 'pharmaco.inventory'],
        'pharmaco.inventory.batch_expiry.manage' => ['name' => 'Manage Batch Expiry', 'group' => 'pharmaco.inventory'],
        'pharmaco.inventory.valuation.view' => ['name' => 'View Inventory Valuation', 'group' => 'pharmaco.inventory'],

        // Supporting pharmacist duties.
        'pharmaco.customers.view' => ['name' => 'View Customers', 'group' => 'pharmaco.customers'],
        'pharmaco.customers.manage' => ['name' => 'Manage Customers', 'group' => 'pharmaco.customers'],
        'pharmaco.prescriptions.view' => ['name' => 'View Prescriptions', 'group' => 'pharmaco.prescriptions'],
        'pharmaco.prescriptions.manage' => ['name' => 'Manage Prescriptions', 'group' => 'pharmaco.prescriptions'],
        'pharmaco.dispensing.review' => ['name' => 'Review Dispensing', 'group' => 'pharmaco.sales'],
        'pharmaco.clinical.alerts.view' => ['name' => 'View Clinical Alerts', 'group' => 'pharmaco'],
        'pharmaco.reports.view' => ['name' => 'View Reports', 'group' => 'pharmaco.reports'],
        'pharmaco.reports.sales' => ['name' => 'View Sales Reports', 'group' => 'pharmaco.reports'],
        'pharmaco.reports.inventory' => ['name' => 'View Inventory Reports', 'group' => 'pharmaco.reports'],
        'notifications.view' => ['name' => 'View Notifications', 'group' => 'notifications'],
        'ai.use' => ['name' => 'Use AI', 'group' => 'ai'],
        'ai.inventory.assistant' => ['name' => 'Use Inventory AI Assistant', 'group' => 'ai'],
        'ai.sales.assistant' => ['name' => 'Use Sales AI Assistant', 'group' => 'ai'],
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

        $permissionsHasName = Schema::hasColumn('permissions', 'name');
        $permissionsHasGroup = Schema::hasColumn('permissions', 'permission_group');
        $permissionsHasCreatedAt = Schema::hasColumn('permissions', 'created_at');
        $permissionsHasUpdatedAt = Schema::hasColumn('permissions', 'updated_at');

        foreach ($this->permissions as $code => $definition) {
            $values = [];

            if ($permissionsHasName) {
                $values['name'] = $definition['name'];
            }

            if ($permissionsHasGroup) {
                $values['permission_group'] = $definition['group'];
            }

            if ($permissionsHasCreatedAt) {
                $values['created_at'] = $now;
            }

            if ($permissionsHasUpdatedAt) {
                $values['updated_at'] = $now;
            }

            DB::table('permissions')->updateOrInsert(
                ['code' => $code],
                $values,
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

        $pivotHasCreatedAt = Schema::hasColumn('permission_role', 'created_at');
        $pivotHasUpdatedAt = Schema::hasColumn('permission_role', 'updated_at');

        foreach ($roleIds as $roleId) {
            foreach ($permissionIds as $permissionId) {
                $payload = [
                    'role_id' => $roleId,
                    'permission_id' => $permissionId,
                ];

                if ($pivotHasCreatedAt) {
                    $payload['created_at'] = $now;
                }

                if ($pivotHasUpdatedAt) {
                    $payload['updated_at'] = $now;
                }

                DB::table('permission_role')->insertOrIgnore($payload);
            }
        }
    }

    public function down(): void
    {
        /*
         * Do not remove permissions from active production pharmacist roles.
         */
    }
};
