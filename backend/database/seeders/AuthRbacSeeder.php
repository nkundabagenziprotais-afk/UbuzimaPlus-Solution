<?php

namespace Database\Seeders;

use App\Models\AdminScope;
use App\Models\Branch;
use App\Models\Permission;
use App\Models\Role;
use App\Models\Solution;
use App\Models\Tenant;
use App\Models\TenantUser;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class AuthRbacSeeder extends Seeder
{
    public function run(): void
    {
        $permissions = [
            ['platform.manage', 'Manage Platform', 'platform'],
            ['platform.content.manage', 'Manage Platform Content', 'platform'],
            ['communications.email.use', 'Use Corporate Email', 'communications'],
            ['notifications.view', 'View Notifications', 'communications'],
            ['notifications.manage', 'Manage Notifications', 'communications'],
            ['data.layer.manage', 'Manage Data Layer', 'platform'],
            ['markets.view', 'View Markets', 'market'],
            ['markets.manage', 'Manage Markets', 'market'],
            ['localization.use', 'Use Localization', 'market'],
            ['localization.manage', 'Manage Localization', 'market'],
            ['solutions.manage', 'Manage Solutions', 'solutions'],
            ['tenants.manage', 'Manage Tenants', 'tenancy'],
            ['modules.manage', 'Manage Modules', 'modules'],
            ['users.manage', 'Manage Users', 'users'],
            ['roles.manage', 'Manage Roles and Permissions', 'security'],
            ['audit.view', 'View Audit Logs', 'security'],
            ['ai.manage', 'Manage AI Center', 'ai'],
            ['ai.use', 'Use AI Assistant', 'ai'],
            ['pharmaco.chat.manage', 'Manage Pharmacist Chat', 'pharmaco'],
            ['pharmaco.profile.manage', 'Manage Pharmacy Profile', 'pharmaco'],
            ['pharmaco.branches.manage', 'Manage Pharmacy Branches', 'pharmaco'],
            ['pharmaco.products.manage', 'Manage Product Master', 'pharmaco'],
            ['pharmaco.inventory.manage', 'Manage Inventory', 'pharmaco'],
            ['pharmaco.insurance.manage', 'Manage Insurance', 'pharmaco'],
            ['insurance.dashboard.view', 'View Insurance Dashboard', 'insurance'],
            ['insurance.configuration.view', 'View Insurance Configuration', 'insurance'],
            ['insurance.configuration.manage', 'Manage Insurance Configuration', 'insurance'],
            ['insurance.memberships.view', 'View Insurance Memberships', 'insurance'],
            ['insurance.memberships.manage', 'Manage Insurance Memberships', 'insurance'],
            ['insurance.eligibility.check', 'Check Insurance Eligibility', 'insurance'],
            ['insurance.claims.view', 'View Insurance Claims', 'insurance'],
            ['insurance.claims.create', 'Create Insurance Claims', 'insurance'],
            ['insurance.claims.adjudicate', 'Adjudicate Insurance Claims', 'insurance'],
            ['insurance.claims.payments', 'Manage Insurance Claim Payments', 'insurance'],
            ['insurance.reconciliation.view', 'View Insurance Reconciliation', 'insurance'],
            ['insurance.reconciliation.manage', 'Manage Insurance Reconciliation', 'insurance'],
            ['insurance.audit.view', 'View Insurance Audit Evidence', 'insurance'],
            ['pharmaco.pos.use', 'Use POS and Sales', 'pharmaco'],
            ['pharmaco.sales.manage', 'Manage Sales and Dispensing', 'pharmaco'],
            ['pharmaco.suppliers.manage', 'Manage Suppliers', 'pharmaco'],
            ['pharmaco.reports.view', 'View PharmaCo360 Reports', 'analytics'],
        ];

        foreach ($permissions as [$code, $name, $group]) {
            Permission::query()->updateOrCreate(
                ['code' => $code],
                [
                    'name' => $name,
                    'permission_group' => $group,
                    'status' => 'active',
                ]
            );
        }

        $roles = [
            'ubuzima_plus_super_admin' => [
                'name' => 'Ubuzima+ Super Admin',
                'scope_type' => 'platform',
                'permissions' => Permission::query()->pluck('code')->all(),
            ],
            'pharmaco360_solution_admin' => [
                'name' => 'PharmaCo360 Solution Admin',
                'scope_type' => 'solution',
                'permissions' => [
                    'solutions.manage',
                    'tenants.manage',
                    'modules.manage',
                    'users.manage',
                    'audit.view',
                    'ai.manage',
                    'communications.email.use',
                    'notifications.view',
                    'notifications.manage',
                    'markets.view',
                    'markets.manage',
                    'localization.manage',
                    'pharmaco.chat.manage',
                    'pharmaco.profile.manage',
                    'pharmaco.branches.manage',
                    'pharmaco.products.manage',
                    'pharmaco.inventory.manage',
                    'pharmaco.insurance.manage',
                    'insurance.dashboard.view',
                    'insurance.configuration.view',
                    'insurance.configuration.manage',
                    'insurance.memberships.view',
                    'insurance.memberships.manage',
                    'insurance.eligibility.check',
                    'insurance.claims.view',
                    'insurance.claims.create',
                    'insurance.claims.adjudicate',
                    'insurance.claims.payments',
                    'insurance.reconciliation.view',
                    'insurance.reconciliation.manage',
                    'insurance.audit.view',
                    'pharmaco.sales.manage',
                    'pharmaco.suppliers.manage',
                    'pharmaco.reports.view',
                ],
            ],
            'tenant_admin' => [
                'name' => 'Tenant Admin',
                'scope_type' => 'tenant',
                'permissions' => [
                    'users.manage',
                    'modules.manage',
                    'audit.view',
                    'ai.manage',
                    'ai.use',
                    'communications.email.use',
                    'notifications.view',
                    'notifications.manage',
                    'markets.view',
                    'localization.use',
                    'pharmaco.chat.manage',
                    'pharmaco.profile.manage',
                    'pharmaco.branches.manage',
                    'pharmaco.products.manage',
                    'pharmaco.inventory.manage',
                    'pharmaco.insurance.manage',
                    'insurance.dashboard.view',
                    'insurance.configuration.view',
                    'insurance.configuration.manage',
                    'insurance.memberships.view',
                    'insurance.memberships.manage',
                    'insurance.eligibility.check',
                    'insurance.claims.view',
                    'insurance.claims.create',
                    'insurance.claims.adjudicate',
                    'insurance.claims.payments',
                    'insurance.reconciliation.view',
                    'insurance.reconciliation.manage',
                    'insurance.audit.view',
                    'pharmaco.pos.use',
                    'pharmaco.sales.manage',
                    'pharmaco.suppliers.manage',
                    'pharmaco.reports.view',
                ],
            ],
            'branch_manager' => [
                'name' => 'Branch Manager',
                'scope_type' => 'branch',
                'permissions' => [
                    'pharmaco.products.manage',
                    'pharmaco.inventory.manage',
                    'pharmaco.insurance.manage',
                    'insurance.dashboard.view',
                    'insurance.configuration.view',
                    'insurance.configuration.manage',
                    'insurance.memberships.view',
                    'insurance.memberships.manage',
                    'insurance.eligibility.check',
                    'insurance.claims.view',
                    'insurance.claims.create',
                    'insurance.claims.adjudicate',
                    'insurance.claims.payments',
                    'insurance.reconciliation.view',
                    'insurance.reconciliation.manage',
                    'insurance.audit.view',
                    'pharmaco.pos.use',
                    'pharmaco.sales.manage',
                    'communications.email.use',
                    'notifications.view',
                    'localization.use',
                    'pharmaco.chat.manage',
                    'pharmaco.reports.view',
                ],
            ],
            'pharmacist' => [
                'name' => 'Pharmacist',
                'scope_type' => 'branch',
                'permissions' => [
                    'pharmaco.products.manage',
                    'pharmaco.inventory.manage',
                    'pharmaco.pos.use',
                    'pharmaco.sales.manage',
                    'communications.email.use',
                    'notifications.view',
                    'localization.use',
                    'pharmaco.chat.manage',
                ],
            ],
            'cashier' => [
                'name' => 'Cashier',
                'scope_type' => 'branch',
                'permissions' => [
                    'pharmaco.pos.use',
                    'pharmaco.sales.manage',
                    'communications.email.use',
                    'notifications.view',
                    'localization.use',
                ],
            ],
            'auditor' => [
                'name' => 'Auditor',
                'scope_type' => 'tenant',
                'permissions' => [
                    'audit.view',
                    'pharmaco.reports.view',
                    'notifications.view',
                ],
            ],
        ];

        foreach ($roles as $code => $roleData) {
            $role = Role::query()->updateOrCreate(
                ['code' => $code],
                [
                    'name' => $roleData['name'],
                    'scope_type' => $roleData['scope_type'],
                    'status' => 'active',
                ]
            );

            $permissionIds = Permission::query()
                ->whereIn('code', $roleData['permissions'])
                ->pluck('id')
                ->all();

            $role->permissions()->sync($permissionIds);
        }

        $pharma = Solution::query()->where('code', 'pharmaco360')->firstOrFail();
        $vita = Tenant::query()->where('slug', 'vitapharma')->firstOrFail();
        $mainBranch = Branch::query()
            ->where('tenant_id', $vita->id)
            ->where('code', 'HQ')
            ->firstOrFail();

        $defaultPassword = app()->environment('testing')
            ? env('UBUZIMA_SEED_ADMIN_PASSWORD', 'ChangeThisPassword123!')
            : env('UBUZIMA_SEED_ADMIN_PASSWORD');

        if (! $defaultPassword) {
            throw new \RuntimeException('UBUZIMA_SEED_ADMIN_PASSWORD must be configured before seeding admin users outside testing.');
        }
        $defaultPin = env('UBUZIMA_SEED_ADMIN_PIN', '1234');

        $platformAdmin = User::query()->updateOrCreate(
            ['email' => app()->environment('testing') ? 'admin@ubuzimaplus.local' : env('UBUZIMA_PLATFORM_ADMIN_EMAIL', 'admin@ubuzimaplus.com')],
            [
                'name' => 'Ubuzima+ Super Admin',
                'phone' => '+250780000001',
                'password' => Hash::make($defaultPassword),
                'login_pin' => Hash::make($defaultPin),
                'status' => 'active',
                'must_change_password' => true,
            ]
        );

        $solutionAdmin = User::query()->updateOrCreate(
            ['email' => app()->environment('testing') ? 'pharmaco.admin@ubuzimaplus.local' : env('UBUZIMA_PHARMACO_ADMIN_EMAIL', 'pharmaco.admin@ubuzimaplus.com')],
            [
                'name' => 'PharmaCo360 Solution Admin',
                'phone' => '+250780000002',
                'password' => Hash::make($defaultPassword),
                'login_pin' => Hash::make($defaultPin),
                'status' => 'active',
                'must_change_password' => true,
            ]
        );

        $tenantAdmin = User::query()->updateOrCreate(
            ['email' => 'admin@vitapharmaafrica.com'],
            [
                'name' => 'VitaPharma Tenant Admin',
                'phone' => '+250780000003',
                'password' => Hash::make($defaultPassword),
                'login_pin' => Hash::make($defaultPin),
                'status' => 'active',
                'must_change_password' => true,
            ]
        );

        $this->assignRole($platformAdmin, 'ubuzima_plus_super_admin');
        $this->assignRole($solutionAdmin, 'pharmaco360_solution_admin', $pharma->id);
        $this->assignRole($tenantAdmin, 'tenant_admin', $pharma->id, $vita->id);

        AdminScope::query()->updateOrCreate(
            ['user_id' => $platformAdmin->id, 'scope_type' => 'platform'],
            [
                'status' => 'active',
                'assigned_at' => now(),
            ]
        );

        AdminScope::query()->updateOrCreate(
            ['user_id' => $solutionAdmin->id, 'scope_type' => 'solution', 'solution_id' => $pharma->id],
            [
                'status' => 'active',
                'assigned_at' => now(),
            ]
        );

        AdminScope::query()->updateOrCreate(
            ['user_id' => $tenantAdmin->id, 'scope_type' => 'tenant', 'solution_id' => $pharma->id, 'tenant_id' => $vita->id],
            [
                'status' => 'active',
                'assigned_at' => now(),
            ]
        );

        TenantUser::query()->updateOrCreate(
            ['tenant_id' => $vita->id, 'user_id' => $tenantAdmin->id],
            [
                'branch_id' => $mainBranch->id,
                'job_title' => 'Tenant Administrator',
                'status' => 'active',
                'joined_at' => now(),
            ]
        );

        // AQUILA_POS_SESSION_RESET_PERMISSION_START
        /*
         * POS Session Reset is restricted to platform and tenant
         * administrators. Ordinary POS operators are deliberately excluded.
         */
        $posSessionResetPermission =
            Permission::query()->firstOrCreate(
                [
                    'code' =>
                        'pharmaco.pos.session.reset',
                ],
                [
                    'name' =>
                        'Reset POS Session',
                    'permission_group' =>
                        'pharmaco',
                    'description' =>
                        'Authorize an additional POS session '
                        . 'after a completed daily closure.',
                    'status' =>
                        'active',
                ]
            );

        Role::query()
            ->where(function ($query) {
                $query
                    ->whereIn(
                        'code',
                        [
                            'ubuzima_plus_super_admin',
                            'tenant_admin',
                        ]
                    )
                    ->orWhereHas(
                        'permissions',
                        fn ($permissionQuery) =>
                            $permissionQuery->where(
                                'permissions.code',
                                'roles.manage'
                            )
                    );
            })
            ->get()
            ->each(
                fn (Role $role) =>
                    $role->permissions()
                        ->syncWithoutDetaching([
                            $posSessionResetPermission->id,
                        ])
            );
        // AQUILA_POS_SESSION_RESET_PERMISSION_END
}

    private function assignRole(User $user, string $roleCode, ?int $solutionId = null, ?int $tenantId = null, ?int $branchId = null): void
    {
        $role = Role::query()->where('code', $roleCode)->firstOrFail();

        DB::table('role_user')->updateOrInsert(
            [
                'role_id' => $role->id,
                'user_id' => $user->id,
                'solution_id' => $solutionId,
                'tenant_id' => $tenantId,
                'branch_id' => $branchId,
            ],
            [
                'status' => 'active',
                'updated_at' => now(),
                'created_at' => now(),
            ]
        );
    }
}
