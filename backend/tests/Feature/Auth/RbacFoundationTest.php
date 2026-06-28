<?php

namespace Tests\Feature\Auth;

use App\Models\Permission;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\TenantUser;
use App\Models\User;
use App\Services\Access\ScopeResolver;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RbacFoundationTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_roles_permissions_and_scopes_are_seeded(): void
    {
        $this->seed();

        $this->assertDatabaseHas('roles', [
            'code' => 'ubuzima_plus_super_admin',
            'scope_type' => 'platform',
        ]);

        $this->assertDatabaseHas('roles', [
            'code' => 'pharmaco360_solution_admin',
            'scope_type' => 'solution',
        ]);

        $this->assertDatabaseHas('roles', [
            'code' => 'tenant_admin',
            'scope_type' => 'tenant',
        ]);

        $this->assertDatabaseHas('permissions', [
            'code' => 'pharmaco.inventory.manage',
        ]);

        $this->assertGreaterThanOrEqual(7, Role::query()->count());
        $this->assertGreaterThanOrEqual(10, Permission::query()->count());
    }

    public function test_platform_solution_and_tenant_admin_users_are_seeded(): void
    {
        $this->seed();

        $this->assertDatabaseHas('users', [
            'email' => 'admin@ubuzimaplus.local',
            'status' => 'active',
        ]);

        $this->assertDatabaseHas('users', [
            'email' => 'pharmaco.admin@ubuzimaplus.local',
            'status' => 'active',
        ]);

        $this->assertDatabaseHas('users', [
            'email' => 'admin@vitapharmaafrica.com',
            'status' => 'active',
        ]);

        $tenant = Tenant::query()->where('slug', 'vitapharma')->firstOrFail();
        $tenantAdmin = User::query()->where('email', 'admin@vitapharmaafrica.com')->firstOrFail();

        $this->assertSame(1, TenantUser::query()
            ->where('tenant_id', $tenant->id)
            ->where('user_id', $tenantAdmin->id)
            ->where('status', 'active')
            ->count());
    }

    public function test_scope_resolver_identifies_seeded_admin_levels(): void
    {
        $this->seed();

        $platformAdmin = User::query()->where('email', 'admin@ubuzimaplus.local')->firstOrFail();
        $solutionAdmin = User::query()->where('email', 'pharmaco.admin@ubuzimaplus.local')->firstOrFail();
        $tenantAdmin = User::query()->where('email', 'admin@vitapharmaafrica.com')->firstOrFail();

        $resolver = app(ScopeResolver::class);

        $this->assertSame('platform', $resolver->resolveForUser($platformAdmin)->scopeType);
        $this->assertSame('solution', $resolver->resolveForUser($solutionAdmin)->scopeType);
        $this->assertSame('tenant', $resolver->resolveForUser($tenantAdmin)->scopeType);
    }

    public function test_tenant_admin_does_not_receive_platform_super_admin_role(): void
    {
        $this->seed();

        $tenantAdmin = User::query()->where('email', 'admin@vitapharmaafrica.com')->firstOrFail();

        $roleCodes = $tenantAdmin->roles()->pluck('code')->all();

        $this->assertContains('tenant_admin', $roleCodes);
        $this->assertNotContains('ubuzima_plus_super_admin', $roleCodes);
    }
}
