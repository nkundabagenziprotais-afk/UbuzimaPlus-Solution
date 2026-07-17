<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private array $profiles = [
        'pharmacist' => [
            'grant' => [
                'pharmaco.pos.use',
                'pharmaco.sales.view',
                'pharmaco.sales.create',
                'pos.sales.view',
                'pos.sales.add',
                'pos.payments.view',
                'pos.payments.add',
                'pharmaco.inventory.view',
                'pharmaco.product_master.view',
                'inventory.dashboard.view',
                'inventory.products.view',
                'inventory.batches.view',
                'inventory.low_stock.view',
                'inventory.expiry_review.view',
                'pharmaco.pos.historical.view',
                'pharmaco.pos.historical.open',
                'pharmaco.pos.historical.record',
            ],
            'revoke' => [
                'pharmaco.sales.manage',
                'pharmaco.inventory.manage',
                'pharmaco.pos.historical.approve',
            ],
        ],
        'vitapharma-pharmacist' => [
            'grant' => [
                'pharmaco.pos.use',
                'pharmaco.sales.view',
                'pharmaco.sales.create',
                'pos.sales.view',
                'pos.sales.add',
                'pos.payments.view',
                'pos.payments.add',
                'pharmaco.inventory.view',
                'pharmaco.product_master.view',
                'inventory.dashboard.view',
                'inventory.products.view',
                'inventory.batches.view',
                'inventory.low_stock.view',
                'inventory.expiry_review.view',
                'pharmaco.pos.historical.view',
                'pharmaco.pos.historical.open',
                'pharmaco.pos.historical.record',
            ],
            'revoke' => [
                'pharmaco.sales.manage',
                'pharmaco.inventory.manage',
                'pharmaco.pos.historical.approve',
            ],
        ],
        'cashier' => [
            'grant' => [
                'pharmaco.pos.use',
                'pharmaco.sales.view',
                'pharmaco.sales.create',
                'pos.sales.view',
                'pos.sales.add',
                'pos.payments.view',
                'pos.payments.add',
            ],
            'revoke' => [
                'pharmaco.sales.manage',
                'pharmaco.inventory.manage',
                'pharmaco.pos.historical.approve',
            ],
        ],
        'vitapharma-cashier' => [
            'grant' => [
                'pharmaco.pos.use',
                'pharmaco.sales.view',
                'pharmaco.sales.create',
                'pos.sales.view',
                'pos.sales.add',
                'pos.payments.view',
                'pos.payments.add',
            ],
            'revoke' => [
                'pharmaco.sales.manage',
                'pharmaco.inventory.manage',
                'pharmaco.pos.historical.approve',
            ],
        ],
        'auditor' => [
            'grant' => [
                'pharmaco.sales.view',
                'pos.sales.view',
                'pos.payments.view',
                'pharmaco.inventory.view',
                'pharmaco.product_master.view',
                'inventory.dashboard.view',
                'inventory.products.view',
                'inventory.batches.view',
                'inventory.low_stock.view',
                'inventory.expiry_review.view',
                'pharmaco.pos.historical.view',
            ],
            'revoke' => [
                'pharmaco.sales.create',
                'pharmaco.sales.manage',
                'pos.sales.add',
                'pos.payments.add',
                'pharmaco.inventory.manage',
                'pharmaco.pos.historical.open',
                'pharmaco.pos.historical.record',
                'pharmaco.pos.historical.approve',
            ],
        ],
    ];

    public function up(): void
    {
        if (! Schema::hasTable('roles') || ! Schema::hasTable('permissions') || ! Schema::hasTable('permission_role')) {
            return;
        }

        DB::transaction(function (): void {
            foreach ($this->profiles as $roleCode => $profile) {
                $role = DB::table('roles')
                    ->where('code', $roleCode)
                    ->when(Schema::hasColumn('roles', 'status'), fn ($q) => $q->where('status', 'active'))
                    ->first();

                if (! $role) {
                    continue;
                }

                foreach ($profile['grant'] as $permissionCode) {
                    $this->attach((int) $role->id, $permissionCode);
                }

                foreach ($profile['revoke'] as $permissionCode) {
                    $this->detach((int) $role->id, $permissionCode);
                }
            }
        });
    }

    public function down(): void
    {
        foreach (['pharmacist', 'vitapharma-pharmacist'] as $roleCode) {
            $role = DB::table('roles')->where('code', $roleCode)->first();

            if (! $role) {
                continue;
            }

            $this->attach((int) $role->id, 'pharmaco.sales.manage');
            $this->attach((int) $role->id, 'pharmaco.inventory.manage');
        }
    }

    private function attach(int $roleId, string $permissionCode): void
    {
        $permission = DB::table('permissions')
            ->where('code', $permissionCode)
            ->when(Schema::hasColumn('permissions', 'status'), fn ($q) => $q->where('status', 'active'))
            ->first();

        if (! $permission) {
            return;
        }

        $exists = DB::table('permission_role')
            ->where('role_id', $roleId)
            ->where('permission_id', $permission->id)
            ->exists();

        if ($exists) {
            return;
        }

        $columns = Schema::getColumnListing('permission_role');

        $payload = [
            'role_id' => $roleId,
            'permission_id' => $permission->id,
        ];

        if (in_array('status', $columns, true)) {
            $payload['status'] = 'active';
        }

        if (in_array('created_at', $columns, true)) {
            $payload['created_at'] = now();
        }

        if (in_array('updated_at', $columns, true)) {
            $payload['updated_at'] = now();
        }

        DB::table('permission_role')->insert($payload);
    }

    private function detach(int $roleId, string $permissionCode): void
    {
        $permission = DB::table('permissions')->where('code', $permissionCode)->first();

        if (! $permission) {
            return;
        }

        DB::table('permission_role')
            ->where('role_id', $roleId)
            ->where('permission_id', $permission->id)
            ->delete();
    }
};
