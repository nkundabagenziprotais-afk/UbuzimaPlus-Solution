<?php

namespace Tests\Feature\PharmaCo360;

use App\Models\Branch;
use App\Models\Module;
use App\Models\Solution;
use App\Models\Tenant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class PharmacoCoreApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_tenant_admin_can_view_own_pharmacy_profile(): void
    {
        $this->seed();

        $token = $this->loginAs('admin@vitapharmaafrica.com');

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->getJson('/api/v1/pharmaco/profile')
            ->assertOk()
            ->assertJsonPath('tenant.slug', 'vitapharma')
            ->assertJsonPath('profile.legal_name', 'VitaPharma Africa Ltd')
            ->assertJsonPath('profile.trading_name', 'VitaPharma')
            ->assertJsonPath('profile.status', 'active')
            ->assertJsonPath('profile.capabilities.0', 'retail_sales');
    }

    public function test_pharmacy_profile_requires_tenant_header(): void
    {
        $this->seed();

        $token = $this->loginAs('admin@vitapharmaafrica.com');

        $this->withToken($token)
            ->getJson('/api/v1/pharmaco/profile')
            ->assertStatus(422)
            ->assertJsonPath('required_header', 'X-Tenant-Slug');
    }

    public function test_tenant_admin_can_list_own_branches(): void
    {
        $this->seed();

        $token = $this->loginAs('admin@vitapharmaafrica.com');

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->getJson('/api/v1/pharmaco/branches')
            ->assertOk()
            ->assertJsonPath('tenant.slug', 'vitapharma')
            ->assertJsonPath('branches.0.code', 'HQ')
            ->assertJsonPath('branches.0.name', 'VitaPharma Main Branch');
    }

    public function test_tenant_admin_can_list_branch_departments(): void
    {
        $this->seed();

        $branch = Branch::where('code', 'HQ')->firstOrFail();
        $token = $this->loginAs('admin@vitapharmaafrica.com');

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->getJson("/api/v1/pharmaco/branches/{$branch->id}/departments")
            ->assertOk()
            ->assertJsonPath('tenant.slug', 'vitapharma')
            ->assertJsonPath('branch.code', 'HQ')
            ->assertJsonFragment(['code' => 'DISPENSARY'])
            ->assertJsonFragment(['code' => 'CASHIER'])
            ->assertJsonFragment(['code' => 'STORE']);
    }

    public function test_tenant_admin_cannot_use_other_tenant_context(): void
    {
        $this->seed();

        $this->createOtherPharmacyTenant();

        $token = $this->loginAs('admin@vitapharmaafrica.com');

        $this->withHeader('X-Tenant-Slug', 'other-pharmacy')
            ->withToken($token)
            ->getJson('/api/v1/pharmaco/profile')
            ->assertForbidden()
            ->assertJsonPath('message', 'Tenant boundary violation.');
    }

    public function test_tenant_admin_cannot_read_departments_for_branch_outside_tenant(): void
    {
        $this->seed();

        $otherTenant = $this->createOtherPharmacyTenant();
        $otherBranch = Branch::query()->create([
            'tenant_id' => $otherTenant->id,
            'name' => 'Other Pharmacy HQ',
            'code' => 'OTHER-HQ',
            'branch_type' => 'pharmacy',
            'status' => 'active',
        ]);

        $token = $this->loginAs('admin@vitapharmaafrica.com');

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->getJson("/api/v1/pharmaco/branches/{$otherBranch->id}/departments")
            ->assertNotFound();
    }

    private function loginAs(string $email): string
    {
        $response = $this->postJson('/api/v1/auth/login', [
            'email' => $email,
            'password' => 'ChangeThisPassword123!',
            'device_name' => 'PharmaCo360 API Test Client',
        ]);

        $response->assertOk();

        return $response->json('access_token');
    }

    private function createOtherPharmacyTenant(): Tenant
    {
        $solution = Solution::where('code', 'pharmaco360')->firstOrFail();

        $tenant = Tenant::query()->create([
            'uuid' => (string) Str::uuid(),
            'solution_id' => $solution->id,
            'primary_solution_id' => $solution->id,
            'name' => 'Other Pharmacy',
            'legal_name' => 'Other Pharmacy Ltd',
            'slug' => 'other-pharmacy',
            'tenant_type' => 'pharmacy',
            'status' => 'active',
        ]);

        foreach (['pharmaco.profile', 'pharmaco.branches'] as $moduleCode) {
            $module = Module::where('code', $moduleCode)->firstOrFail();

            DB::table('tenant_module_activations')->insert([
                'tenant_id' => $tenant->id,
                'solution_id' => $solution->id,
                'module_id' => $module->id,
                'status' => 'active',
                'configuration' => json_encode(['phase' => 'test']),
                'activated_at' => now(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        return $tenant;
    }
}
