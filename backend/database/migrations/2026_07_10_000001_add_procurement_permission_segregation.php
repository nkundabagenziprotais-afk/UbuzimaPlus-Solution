<?php

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration {
    /**
     * Introduce granular Procurement authority without removing the
     * historical pharmaco.suppliers.manage permission.
     *
     * Existing roles holding the historical permission are backfilled so
     * deployment does not interrupt current Procurement operations.
     */
    public function up(): void
    {
        $definitions = [
            [
                'code' => 'branches.view',
                'name' => 'View Pharmacy Branches',
                'description' => 'View tenant pharmacy branches needed for controlled operational workflows.',
            ],
            [
                'code' => 'pharmaco.inventory.view',
                'name' => 'View Inventory',
                'description' => 'View inventory locations and stock information without mutation authority.',
            ],
            [
                'code' => 'pharmaco.product_master.view',
                'name' => 'View Product Master',
                'description' => 'View tenant products used by operational and Procurement workflows.',
            ],
            [
                'code' => 'pharmaco.product_inventory.receive',
                'name' => 'Receive Product Inventory',
                'description' => 'Receive stock into controlled inventory locations.',
            ],
            [
                'code' => 'pharmaco.procurement.view',
                'name' => 'View Procurement',
                'description' => 'View suppliers, purchase orders, supplier invoices and Procurement summaries.',
            ],
            [
                'code' => 'pharmaco.procurement.suppliers.manage',
                'name' => 'Manage Procurement Suppliers',
                'description' => 'Create and update Procurement supplier records.',
            ],
            [
                'code' => 'pharmaco.procurement.purchase_order.create',
                'name' => 'Create Purchase Orders',
                'description' => 'Create draft purchase orders and purchase-order line items.',
            ],
            [
                'code' => 'pharmaco.procurement.purchase_order.approve',
                'name' => 'Approve Purchase Orders',
                'description' => 'Approve or cancel controlled purchase orders.',
            ],
            [
                'code' => 'pharmaco.procurement.purchase_order.receive',
                'name' => 'Receive Purchase Orders',
                'description' => 'Receive stock against approved or partially received purchase orders.',
            ],
            [
                'code' => 'pharmaco.procurement.invoice.manage',
                'name' => 'Manage Supplier Invoices',
                'description' => 'Create and maintain supplier invoice records.',
            ],
            [
                'code' => 'pharmaco.procurement.invoice.approve',
                'name' => 'Approve Supplier Invoices',
                'description' => 'Approve supplier invoices for controlled payment processing.',
            ],
            [
                'code' => 'pharmaco.procurement.payment.view',
                'name' => 'View Supplier Payments',
                'description' => 'View supplier balances, payment history and payables summaries.',
            ],
            [
                'code' => 'pharmaco.procurement.payment.manage',
                'name' => 'Record Supplier Payments',
                'description' => 'Record controlled supplier payments against approved invoices.',
            ],
            [
                'code' => 'pharmaco.procurement.supplier_performance.view',
                'name' => 'View Supplier Performance',
                'description' => 'View supplier delivery, fulfilment and Procurement performance evidence.',
            ],
        ];

        $permissions = collect($definitions)
            ->mapWithKeys(function (array $definition): array {
                $permission = Permission::query()
                    ->updateOrCreate(
                        ['code' => $definition['code']],
                        [
                            'name' => $definition['name'],
                            'permission_group' => 'pharmaco',
                            'description' => $definition['description'],
                            'status' => 'active',
                        ],
                    );

                return [$definition['code'] => $permission];
            });

        $procurementPermissionIds = $permissions
            ->filter(
                fn (Permission $permission, string $code): bool =>
                    str_starts_with(
                        $code,
                        'pharmaco.procurement.'
                    )
            )
            ->pluck('id')
            ->all();

        Role::query()
            ->whereHas(
                'permissions',
                fn ($query) => $query->where(
                    'permissions.code',
                    'pharmaco.suppliers.manage'
                )
            )
            ->get()
            ->each(
                fn (Role $role) => $role->permissions()
                    ->syncWithoutDetaching($procurementPermissionIds)
            );

        $inventoryPermissionIds = collect([
            $permissions->get('pharmaco.inventory.view')?->id,
            $permissions->get('pharmaco.product_master.view')?->id,
            $permissions->get('pharmaco.product_inventory.receive')?->id,
        ])
            ->filter()
            ->values()
            ->all();

        Role::query()
            ->whereHas(
                'permissions',
                fn ($query) => $query->where(
                    'permissions.code',
                    'pharmaco.inventory.manage'
                )
            )
            ->get()
            ->each(
                fn (Role $role) => $role->permissions()
                    ->syncWithoutDetaching($inventoryPermissionIds)
            );

        $branchViewPermission = $permissions->get('branches.view');

        Role::query()
            ->whereHas(
                'permissions',
                fn ($query) => $query->where(
                    'permissions.code',
                    'pharmaco.branches.manage'
                )
            )
            ->get()
            ->each(
                fn (Role $role) => $role->permissions()
                    ->syncWithoutDetaching([
                        $branchViewPermission->id,
                    ])
            );
    }

    /**
     * Granular permission records and role assignments are intentionally
     * retained during rollback. Tenant-specific role management may have
     * created or assigned these codes before this migration, so destructive
     * deletion would risk removing live authorization data.
     */
    public function down(): void
    {
        // Non-destructive rollback by design.
    }
};
