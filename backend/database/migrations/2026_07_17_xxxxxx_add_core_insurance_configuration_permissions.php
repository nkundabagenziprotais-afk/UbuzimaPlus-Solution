<?php

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        $definitions = [
            ['insurance.providers.view', 'View Insurance Providers', 'insurance'],
            ['insurance.providers.manage', 'Manage Insurance Providers', 'insurance'],
            ['insurance.plans.view', 'View Insurance Plans', 'insurance'],
            ['insurance.plans.manage', 'Manage Insurance Plans', 'insurance'],
            ['insurance.pricing.view', 'View Insurance Pricing', 'insurance'],
            ['insurance.pricing.create', 'Create Insurance Pricing', 'insurance'],
            ['insurance.pricing.edit', 'Edit Insurance Pricing', 'insurance'],
            ['insurance.pricing.approve', 'Approve Insurance Pricing', 'insurance'],
            ['insurance.pricing.import', 'Import Insurance Price Lists', 'insurance'],
            ['insurance.pricing.ai_suggest', 'Use Insurance Pricing AI Suggestions', 'insurance'],
            ['insurance.claims.edit', 'Edit Insurance Claims', 'insurance'],
            ['insurance.claims.approve', 'Approve Insurance Claims', 'insurance'],
            ['insurance.analytics.view', 'View Insurance Analytics', 'insurance'],
            ['insurance.custom_fields.manage', 'Manage Insurance Custom Fields', 'insurance'],
        ];

        foreach ($definitions as [$code, $name, $group]) {
            Permission::query()->updateOrCreate(
                ['code' => $code],
                [
                    'name' => $name,
                    'permission_group' => $group,
                    'status' => 'active',
                ]
            );
        }

        $managerPermissionCodes = array_merge(
            [
                'pharmaco.insurance.manage',
                'insurance.dashboard.view',
                'insurance.configuration.view',
                'insurance.configuration.manage',
                'insurance.claims.view',
                'insurance.claims.create',
                'insurance.claims.adjudicate',
                'insurance.claims.payments',
                'insurance.reconciliation.view',
                'insurance.reconciliation.manage',
                'insurance.audit.view',
            ],
            array_column($definitions, 0)
        );

        $viewOnlyPermissionCodes = [
            'insurance.providers.view',
            'insurance.plans.view',
            'insurance.pricing.view',
            'insurance.claims.view',
            'insurance.reconciliation.view',
            'insurance.analytics.view',
        ];

        $managerPermissionIds = Permission::query()
            ->whereIn('code', $managerPermissionCodes)
            ->pluck('id')
            ->all();

        $viewOnlyPermissionIds = Permission::query()
            ->whereIn('code', $viewOnlyPermissionCodes)
            ->pluck('id')
            ->all();

        Role::query()
            ->whereIn('code', [
                'platform_owner',
                'platform_admin',
                'tenant_owner',
                'tenant_admin',
                'pharmacy_manager',
                'branch_manager',
            ])
            ->get()
            ->each(function (Role $role) use ($managerPermissionIds): void {
                $role->permissions()->syncWithoutDetaching($managerPermissionIds);
            });

        Role::query()
            ->whereIn('code', [
                'pharmacist',
                'cashier',
                'inventory_manager',
            ])
            ->get()
            ->each(function (Role $role) use ($viewOnlyPermissionIds): void {
                $role->permissions()->syncWithoutDetaching($viewOnlyPermissionIds);
            });
    }

    public function down(): void
    {
        /*
         * Do not remove permissions from production roles automatically.
         * Permission removal can break active users and should be handled
         * through the role governance UI when needed.
         */
    }
};
