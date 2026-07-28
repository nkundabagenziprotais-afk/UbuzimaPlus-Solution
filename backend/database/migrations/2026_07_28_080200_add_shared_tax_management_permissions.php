<?php

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::transaction(function (): void {
            $definitions = [
                [
                    'pharmaco.tax.configuration.view',
                    'View Tax Configuration',
                    'tax',
                ],
                [
                    'pharmaco.tax.configuration.manage',
                    'Manage Tax Configuration',
                    'tax',
                ],
                [
                    'pharmaco.tax.configuration.approve',
                    'Approve Tax Configuration',
                    'tax',
                ],
                [
                    'pharmaco.tax.registry.view',
                    'View RRA Tax Registry',
                    'tax',
                ],
                [
                    'pharmaco.tax.registry.import',
                    'Import RRA Tax Registry',
                    'tax',
                ],
                [
                    'pharmaco.tax.registry.approve',
                    'Approve RRA Tax Registry',
                    'tax',
                ],
                [
                    'pharmaco.tax.classification.view',
                    'View Product Tax Classification',
                    'tax',
                ],
                [
                    'pharmaco.tax.classification.review',
                    'Review Product Tax Classification',
                    'tax',
                ],
                [
                    'pharmaco.tax.classification.approve',
                    'Approve Product Tax Classification',
                    'tax',
                ],
                [
                    'pharmaco.tax.audit.view',
                    'View Tax Audit Trail',
                    'tax',
                ],
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

            $allCodes = array_column($definitions, 0);

            $managerCodes = [
                'pharmaco.tax.configuration.view',
                'pharmaco.tax.configuration.manage',
                'pharmaco.tax.registry.view',
                'pharmaco.tax.registry.import',
                'pharmaco.tax.classification.view',
                'pharmaco.tax.classification.review',
                'pharmaco.tax.audit.view',
            ];

            $reviewerCodes = [
                'pharmaco.tax.configuration.view',
                'pharmaco.tax.registry.view',
                'pharmaco.tax.classification.view',
                'pharmaco.tax.classification.review',
            ];

            $viewerCodes = [
                'pharmaco.tax.configuration.view',
                'pharmaco.tax.registry.view',
                'pharmaco.tax.classification.view',
            ];

            $allIds = Permission::query()
                ->whereIn('code', $allCodes)
                ->pluck('id')
                ->all();

            $managerIds = Permission::query()
                ->whereIn('code', $managerCodes)
                ->pluck('id')
                ->all();

            $reviewerIds = Permission::query()
                ->whereIn('code', $reviewerCodes)
                ->pluck('id')
                ->all();

            $viewerIds = Permission::query()
                ->whereIn('code', $viewerCodes)
                ->pluck('id')
                ->all();

            Role::query()
                ->whereIn('code', [
                    'platform_owner',
                    'platform_admin',
                    'tenant_owner',
                    'tenant_admin',
                ])
                ->get()
                ->each(function (Role $role) use ($allIds): void {
                    $role->permissions()
                        ->syncWithoutDetaching($allIds);
                });

            Role::query()
                ->whereIn('code', [
                    'pharmacy_manager',
                ])
                ->get()
                ->each(function (Role $role) use ($managerIds): void {
                    $role->permissions()
                        ->syncWithoutDetaching($managerIds);
                });

            Role::query()
                ->whereIn('code', [
                    'branch_manager',
                    'inventory_manager',
                ])
                ->get()
                ->each(function (Role $role) use ($reviewerIds): void {
                    $role->permissions()
                        ->syncWithoutDetaching($reviewerIds);
                });

            Role::query()
                ->whereIn('code', [
                    'pharmacist',
                ])
                ->get()
                ->each(function (Role $role) use ($viewerIds): void {
                    $role->permissions()
                        ->syncWithoutDetaching($viewerIds);
                });
        });
    }

    public function down(): void
    {
        /*
         * Do not automatically remove tax permissions from production
         * roles. Permission removal can break active users and must be
         * handled through the role-governance workflow.
         */
    }
};
