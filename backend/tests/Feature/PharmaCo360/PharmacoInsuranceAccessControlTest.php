<?php

namespace Tests\Feature\PharmaCo360;

use App\Models\Module;
use App\Models\Permission;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PharmacoInsuranceAccessControlTest extends TestCase
{
    use RefreshDatabase;

    public function test_insurance_permission_and_module_are_seeded(): void
    {
        $this->seed();

        $permission = Permission::query()
            ->where('code', 'pharmaco.insurance.manage')
            ->firstOrFail();

        $module = Module::query()
            ->where('code', 'pharmaco.insurance')
            ->firstOrFail();

        $tenant = Tenant::query()
            ->where('slug', 'vitapharma')
            ->firstOrFail();

        $this->assertSame('active', $permission->status);
        $this->assertSame('available', $module->status);

        $this->assertDatabaseHas('solution_modules', [
            'module_id' => $module->id,
            'status' => 'available',
        ]);

        $this->assertDatabaseHas('tenant_module_activations', [
            'tenant_id' => $tenant->id,
            'module_id' => $module->id,
            'status' => 'active',
        ]);
    }

    public function test_tenant_admin_has_insurance_permission(): void
    {
        $this->seed();

        $role = Role::query()
            ->where('code', 'tenant_admin')
            ->firstOrFail();

        $this->assertTrue(
            $role->permissions()
                ->where(
                    'permissions.code',
                    'pharmaco.insurance.manage'
                )
                ->exists()
        );
    }

    public function test_branch_manager_has_insurance_permission(): void
    {
        $this->seed();

        $role = Role::query()
            ->where('code', 'branch_manager')
            ->firstOrFail();

        $this->assertTrue(
            $role->permissions()
                ->where(
                    'permissions.code',
                    'pharmaco.insurance.manage'
                )
                ->exists()
        );
    }

    public function test_tenant_admin_can_access_insurance_routes(): void
    {
        $this->seed();

        $user = User::query()
            ->where(
                'email',
                'admin@vitapharmaafrica.com'
            )
            ->firstOrFail();

        Sanctum::actingAs($user);

        $this->withHeader(
            'X-Tenant-Slug',
            'vitapharma'
        )
            ->getJson(
                '/api/v1/pharmaco/insurance/partners'
            )
            ->assertOk();
    }

    public function test_user_without_insurance_permission_is_forbidden(): void
    {
        $this->seed();

        $user = User::query()
            ->where(
                'email',
                'admin@vitapharmaafrica.com'
            )
            ->firstOrFail();

        $tenantAdminRole = Role::query()
            ->where('code', 'tenant_admin')
            ->firstOrFail();

        $insurancePermission = Permission::query()
            ->where('code', 'pharmaco.insurance.manage')
            ->firstOrFail();

        $tenantAdminRole->permissions()->detach(
            $insurancePermission->id
        );

        Sanctum::actingAs($user);

        $this->withHeader(
            'X-Tenant-Slug',
            'vitapharma'
        )
            ->getJson(
                '/api/v1/pharmaco/insurance/partners'
            )
            ->assertForbidden();
    }

    public function test_inactive_insurance_module_blocks_access(): void
    {
        $this->seed();

        $user = User::query()
            ->where(
                'email',
                'admin@vitapharmaafrica.com'
            )
            ->firstOrFail();

        $tenant = Tenant::query()
            ->where('slug', 'vitapharma')
            ->firstOrFail();

        $module = Module::query()
            ->where('code', 'pharmaco.insurance')
            ->firstOrFail();

        DB::table('tenant_module_activations')
            ->where('tenant_id', $tenant->id)
            ->where('module_id', $module->id)
            ->update([
                'status' => 'inactive',
                'updated_at' => now(),
            ]);

        Sanctum::actingAs($user);

        $this->withHeader(
            'X-Tenant-Slug',
            'vitapharma'
        )
            ->getJson(
                '/api/v1/pharmaco/insurance/partners'
            )
            ->assertForbidden();
    }

    public function test_sales_permission_alone_does_not_grant_insurance_access(): void
    {
        $this->seed();

        $user = User::query()
            ->where(
                'email',
                'admin@vitapharmaafrica.com'
            )
            ->firstOrFail();

        $tenantAdminRole = Role::query()
            ->where('code', 'tenant_admin')
            ->firstOrFail();

        $insurancePermission = Permission::query()
            ->where('code', 'pharmaco.insurance.manage')
            ->firstOrFail();

        $salesPermission = Permission::query()
            ->where('code', 'pharmaco.sales.manage')
            ->firstOrFail();

        $this->assertTrue(
            $tenantAdminRole->permissions()
                ->whereKey($salesPermission->id)
                ->exists()
        );

        $tenantAdminRole->permissions()->detach(
            $insurancePermission->id
        );

        Sanctum::actingAs($user);

        $this->withHeader(
            'X-Tenant-Slug',
            'vitapharma'
        )
            ->getJson(
                '/api/v1/pharmaco/insurance/partners'
            )
            ->assertForbidden();
    }
}
