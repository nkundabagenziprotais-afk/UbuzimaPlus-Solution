<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private array $permissions = [
        'finance.dashboard.view' => 'View Finance Dashboard',
        'finance.chart_of_accounts.manage' => 'Manage Chart of Accounts',
        'finance.journal.view' => 'View Finance Journal',
        'finance.journal.create' => 'Create Finance Journal Entries',
        'finance.journal.approve' => 'Approve Finance Journal Entries',
        'finance.reports.view' => 'View Finance Reports',
        'finance.reconciliation.manage' => 'Manage Finance Reconciliation',
        'finance.period.close' => 'Close Finance Periods',
        'finance.settings.manage' => 'Manage Finance Settings',
    ];

    public function up(): void
    {
        $now = now();

        if (Schema::hasTable('modules')) {
            $moduleValues = [
                'code' => 'pharmaco.finance',
                'name' => 'Finance',
            ];

            foreach ([
                'description' => 'Double-entry accounting, ledgers, reconciliation, financial reports, and period controls for PharmaCo360.',
                'module_group' => 'pharmaco',
                'group' => 'pharmaco',
                'scope' => 'pharmaco360',
                'status' => 'active',
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ] as $column => $value) {
                if (Schema::hasColumn('modules', $column)) {
                    $moduleValues[$column] = $value;
                }
            }

            DB::table('modules')->updateOrInsert(
                ['code' => 'pharmaco.finance'],
                $moduleValues,
            );

            $this->attachModuleToPharmaCoSolution($now);
            $this->activateModuleForExistingTenants($now);
        }

        if (Schema::hasTable('permissions')) {
            foreach ($this->permissions as $code => $name) {
                $values = [
                    'code' => $code,
                ];

                if (Schema::hasColumn('permissions', 'name')) {
                    $values['name'] = $name;
                }

                if (Schema::hasColumn('permissions', 'permission_group')) {
                    $values['permission_group'] = 'finance';
                }

                if (Schema::hasColumn('permissions', 'group')) {
                    $values['group'] = 'finance';
                }

                if (Schema::hasColumn('permissions', 'description')) {
                    $values['description'] = $name;
                }

                if (Schema::hasColumn('permissions', 'created_at')) {
                    $values['created_at'] = $now;
                }

                if (Schema::hasColumn('permissions', 'updated_at')) {
                    $values['updated_at'] = $now;
                }

                DB::table('permissions')->updateOrInsert(
                    ['code' => $code],
                    $values,
                );
            }

            $this->grantFinancePermissionsToAdministrativeRoles();
        }
    }

    public function down(): void
    {
        /*
         * Do not remove production permissions or module activations on rollback.
         * They may already be assigned to live roles after deployment.
         */
    }

    private function attachModuleToPharmaCoSolution($now): void
    {
        if (! Schema::hasTable('solution_modules') || ! Schema::hasTable('solutions')) {
            return;
        }

        $moduleId = DB::table('modules')->where('code', 'pharmaco.finance')->value('id');

        $solution = DB::table('solutions')
            ->where('slug', 'pharmaco360')
            ->orWhere('code', 'pharmaco360')
            ->first();

        if (! $moduleId || ! $solution) {
            return;
        }

        $values = [
            'solution_id' => $solution->id,
            'module_id' => $moduleId,
        ];

        foreach ([
            'is_active' => true,
            'status' => 'active',
            'created_at' => $now,
            'updated_at' => $now,
        ] as $column => $value) {
            if (Schema::hasColumn('solution_modules', $column)) {
                $values[$column] = $value;
            }
        }

        DB::table('solution_modules')->updateOrInsert(
            [
                'solution_id' => $solution->id,
                'module_id' => $moduleId,
            ],
            $values,
        );
    }

    private function activateModuleForExistingTenants($now): void
    {
        if (! Schema::hasTable('tenant_modules') || ! Schema::hasTable('tenants')) {
            return;
        }

        $moduleId = DB::table('modules')->where('code', 'pharmaco.finance')->value('id');

        if (! $moduleId) {
            return;
        }

        $tenantIds = DB::table('tenants')->pluck('id');

        foreach ($tenantIds as $tenantId) {
            $values = [
                'tenant_id' => $tenantId,
                'module_id' => $moduleId,
            ];

            foreach ([
                'is_active' => true,
                'status' => 'active',
                'created_at' => $now,
                'updated_at' => $now,
            ] as $column => $value) {
                if (Schema::hasColumn('tenant_modules', $column)) {
                    $values[$column] = $value;
                }
            }

            DB::table('tenant_modules')->updateOrInsert(
                [
                    'tenant_id' => $tenantId,
                    'module_id' => $moduleId,
                ],
                $values,
            );
        }
    }

    private function grantFinancePermissionsToAdministrativeRoles(): void
    {
        if (! Schema::hasTable('roles') || ! Schema::hasTable('role_permissions')) {
            return;
        }

        $permissionIds = DB::table('permissions')
            ->whereIn('code', array_keys($this->permissions))
            ->pluck('id');

        if ($permissionIds->isEmpty()) {
            return;
        }

        $roleIds = DB::table('roles')
            ->whereIn('code', [
                'ubuzima_plus_super_admin',
                'pharmaco360_solution_admin',
                'tenant_admin',
            ])
            ->pluck('id');

        foreach ($roleIds as $roleId) {
            foreach ($permissionIds as $permissionId) {
                DB::table('role_permissions')->updateOrInsert(
                    [
                        'role_id' => $roleId,
                        'permission_id' => $permissionId,
                    ],
                    [],
                );
            }
        }
    }
};
