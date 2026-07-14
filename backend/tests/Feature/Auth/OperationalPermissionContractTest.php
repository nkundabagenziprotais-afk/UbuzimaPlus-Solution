<?php

namespace Tests\Feature\Auth;

use App\Support\OperationalPermissionContract;
use Tests\TestCase;

class OperationalPermissionContractTest extends TestCase
{
    public function test_cashier_permissions_expand_to_pos_workspace(): void
    {
        $permissions = OperationalPermissionContract::expand([
            'tenant.dashboard.view',
            'pharmaco.pos.use',
            'pharmaco.pos.open_session',
            'pharmaco.pos.close_session',
            'pharmaco.sales.view',
            'pharmaco.sales.create',
        ]);

        $expected = [
            'pos.sales.view',
            'pos.sales.add',
            'pos.receipts.view',
            'pos.receipts.add',
            'pos.payments.view',
            'pos.payments.add',
            'pos.cashier_close.view',
            'pos.cashier_close.add',
            'pos.cashier_close.edit',
        ];

        foreach ($expected as $permission) {
            $this->assertContains(
                $permission,
                $permissions,
            );
        }
    }

    public function test_pos_admin_permission_expands_to_session_support_controls(): void
    {
        $permissions = OperationalPermissionContract::expand([
            'pharmaco.pos.session.reset',
        ]);

        $this->assertContains(
            'pos.session_support.view',
            $permissions,
        );

        $this->assertContains(
            'pos.session_support.edit',
            $permissions,
        );
    }


    public function test_inventory_permissions_expand_to_inventory_workspace(): void
    {
        $permissions = OperationalPermissionContract::expand([
            'pharmaco.inventory.manage',
            'pharmaco.product_master.manage',
            'pharmaco.product_inventory.receive',
        ]);

        $expected = [
            'inventory.dashboard.view',
            'inventory.products.view',
            'inventory.products.add',
            'inventory.products.edit',
            'inventory.batches.view',
            'inventory.receiving.view',
            'inventory.receiving.add',
            'inventory.expiry_review.view',
        ];

        foreach ($expected as $permission) {
            $this->assertContains(
                $permission,
                $permissions,
            );
        }
    }

    public function test_expansion_preserves_authority_without_duplicates(): void
    {
        $permissions = OperationalPermissionContract::expand([
            'pharmaco.pos.use',
            'pharmaco.pos.use',
            'pos.sales.view',
        ]);

        $this->assertContains(
            'pharmaco.pos.use',
            $permissions,
        );

        $this->assertContains(
            'pos.sales.view',
            $permissions,
        );

        $this->assertSame(
            count($permissions),
            count(array_unique($permissions)),
        );
    }
}
