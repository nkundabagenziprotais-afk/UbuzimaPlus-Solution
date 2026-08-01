<?php

namespace Tests\Feature\Auth;

use Database\Seeders\PharmacistProcurementAccessSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use RuntimeException;
use Tests\TestCase;

class PharmacistProcurementAccessTest extends TestCase
{
    use RefreshDatabase;

    private const REQUIRED_PERMISSIONS = [
        'pharmaco.procurement.view',
        'pharmaco.procurement.purchase_order.create',
        'pharmaco.procurement.purchase_order.receive',
    ];

    private const RESTRICTED_PERMISSIONS = [
        'pharmaco.procurement.suppliers.manage',
        'pharmaco.procurement.purchase_order.approve',
        'pharmaco.procurement.invoice.manage',
        'pharmaco.procurement.invoice.approve',
        'pharmaco.procurement.payment.view',
        'pharmaco.procurement.payment.manage',
        'tenant.admin',
        'tenant.users.manage',
        'roles.manage',
    ];

    public function test_vitapharma_pharmacist_receives_only_operational_procurement_access(): void
    {
        $this->seedMinimalRbacFixture();
        $this->seed(PharmacistProcurementAccessSeeder::class);

        $codes = $this->permissionCodesForRole(
            'vitapharma-pharmacist',
        );

        foreach (self::REQUIRED_PERMISSIONS as $permission) {
            $this->assertContains($permission, $codes);
        }

        foreach (self::RESTRICTED_PERMISSIONS as $permission) {
            $this->assertNotContains($permission, $codes);
        }
    }

    public function test_procurement_access_seeder_is_idempotent(): void
    {
        $this->seedMinimalRbacFixture();
        $this->seed(PharmacistProcurementAccessSeeder::class);
        $this->seed(PharmacistProcurementAccessSeeder::class);

        $codes = $this->permissionCodesForRole(
            'vitapharma-pharmacist',
        );

        foreach (self::REQUIRED_PERMISSIONS as $permission) {
            $this->assertSame(
                1,
                count(array_keys($codes, $permission, true)),
                "Permission {$permission} was assigned more than once.",
            );
        }
    }

    public function test_frontend_navigation_and_receiving_guards_remain_permission_driven(): void
    {
        $appSourcePath = base_path(
            '../web/admin-dashboard/src/App.tsx',
        );

        $receivingSourcePath = base_path(
            '../web/admin-dashboard/src/components/' .
            'GeneralItemPurchaseOrderReceivingWorkspace.tsx',
        );

        $this->assertFileExists($appSourcePath);
        $this->assertFileExists($receivingSourcePath);

        $appSource = file_get_contents($appSourcePath);
        $receivingSource = file_get_contents(
            $receivingSourcePath,
        );

        $this->assertIsString($appSource);
        $this->assertIsString($receivingSource);

        $this->assertStringContainsString(
            "'pharmaco.procurement.view': [",
            $appSource,
        );

        $this->assertStringContainsString(
            "'procurement.suppliers.view'",
            $appSource,
        );

        $this->assertStringContainsString(
            "'procurement.purchase_orders.view'",
            $appSource,
        );

        $this->assertStringContainsString(
            "'procurement.receiving.view'",
            $appSource,
        );

        $this->assertStringContainsString(
            "'pharmaco.procurement.purchase_order.create': [",
            $appSource,
        );

        $this->assertStringContainsString(
            "'procurement.purchase_orders.add'",
            $appSource,
        );

        $this->assertStringContainsString(
            "'pharmaco.procurement.purchase_order.receive': [",
            $appSource,
        );

        $this->assertStringContainsString(
            "'procurement.receiving.add'",
            $appSource,
        );

        $this->assertStringContainsString(
            "'pharmaco.procurement.purchase_order.receive'",
            $receivingSource,
        );

        $this->assertStringContainsString(
            'if (!canReceive)',
            $receivingSource,
        );
    }

    private function seedMinimalRbacFixture(): void
    {
        $now = now();

        DB::table('roles')->updateOrInsert(
            [
                'code' => 'vitapharma-pharmacist',
            ],
            [
                'name' => 'VitaPharma Pharmacist',
                'scope_type' => 'tenant',
                'status' => 'active',
                'created_at' => $now,
                'updated_at' => $now,
            ],
        );

        $permissionNames = [
            'pharmaco.procurement.view' =>
                'View Procurement',
            'pharmaco.procurement.purchase_order.create' =>
                'Create Purchase Orders',
            'pharmaco.procurement.purchase_order.receive' =>
                'Receive Purchase Orders',
            'pharmaco.procurement.suppliers.manage' =>
                'Manage Procurement Suppliers',
            'pharmaco.procurement.purchase_order.approve' =>
                'Approve Purchase Orders',
            'pharmaco.procurement.invoice.manage' =>
                'Manage Supplier Invoices',
            'pharmaco.procurement.invoice.approve' =>
                'Approve Supplier Invoices',
            'pharmaco.procurement.payment.view' =>
                'View Supplier Payments',
            'pharmaco.procurement.payment.manage' =>
                'Record Supplier Payments',
            'tenant.admin' =>
                'Tenant Administration',
            'tenant.users.manage' =>
                'Manage Tenant Users',
            'roles.manage' =>
                'Manage Roles',
        ];

        foreach ($permissionNames as $code => $name) {
            DB::table('permissions')->updateOrInsert(
                [
                    'code' => $code,
                ],
                [
                    'name' => $name,
                    'permission_group' => str_starts_with(
                        $code,
                        'pharmaco.',
                    )
                        ? 'pharmaco'
                        : 'security',
                    'status' => 'active',
                    'created_at' => $now,
                    'updated_at' => $now,
                ],
            );
        }
    }
    private function permissionCodesForRole(
        string $roleCode,
    ): array {
        $roleId = DB::table('roles')
            ->where('code', $roleCode)
            ->value('id');

        $this->assertNotNull(
            $roleId,
            "Role {$roleCode} was not created.",
        );

        $pivot = $this->rolePermissionPivot();

        $permissionIds = DB::table($pivot)
            ->where('role_id', $roleId)
            ->pluck('permission_id');

        return DB::table('permissions')
            ->whereIn('id', $permissionIds)
            ->orderBy('code')
            ->pluck('code')
            ->all();
    }

    private function rolePermissionPivot(): string
    {
        foreach (
            [
                'role_permissions',
                'role_permission',
                'permission_role',
                'permission_roles',
                'role_has_permissions',
            ] as $table
        ) {
            if (
                Schema::hasTable($table) &&
                Schema::hasColumn($table, 'role_id') &&
                Schema::hasColumn($table, 'permission_id')
            ) {
                return $table;
            }
        }

        throw new RuntimeException(
            'Unable to locate the role-permission pivot table.',
        );
    }
}
