<?php

namespace Tests\Feature\Auth;

use App\Models\Permission;
use App\Models\Role;
use Database\Seeders\AuthRbacSeeder;
use Database\Seeders\PlatformFoundationSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SeededSecurityRolesTest extends TestCase
{
    use RefreshDatabase;

    public function test_initial_security_roles_have_expected_permissions(): void
    {
        $this->seed([
            PlatformFoundationSeeder::class,
            AuthRbacSeeder::class,
        ]);

        $expected = [
            'tenant_user_administrator' => [
                'users.manage',
                'security.users.view',
                'security.users.add',
                'security.users.edit',
                'security.users.delete',
            ],
            'tenant_security_administrator' => [
                'roles.manage',
                'security.roles.add',
                'security.permissions.edit',
                'security.two_factor.edit',
                'security.audit.view',
            ],
            'tenant_security_auditor' => [
                'audit.view',
                'security.audit.view',
                'security.two_factor.view',
            ],
            'tenant_branch_manager' => [
                'tenant.dashboard.view',
                'pharmaco.inventory.view',
                'security.users.view',
            ],
        ];

        foreach ($expected as $roleCode => $permissions) {
            $role = Role::query()
                ->where('code', $roleCode)
                ->firstOrFail();

            $actual = $role->permissions()
                ->pluck('code')
                ->all();

            foreach ($permissions as $permission) {
                $this->assertContains(
                    $permission,
                    $actual,
                    $roleCode . ' is missing ' . $permission
                );
            }
        }

        $this->assertSame(
            20,
            Permission::query()
                ->where('code', 'like', 'security.%')
                ->count()
        );
    }
}
