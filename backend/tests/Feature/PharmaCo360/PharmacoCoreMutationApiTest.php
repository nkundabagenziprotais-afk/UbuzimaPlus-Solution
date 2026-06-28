<?php

namespace Tests\Feature\PharmaCo360;

use App\Models\AuditLog;
use App\Models\Branch;
use App\Models\BranchDepartment;
use App\Models\Module;
use App\Models\Solution;
use App\Models\Tenant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class PharmacoCoreMutationApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_tenant_admin_can_update_own_branch_and_audit_is_recorded(): void
    {
        $this->seed();

        $branch = Branch::where('code', 'HQ')->firstOrFail();
        $token = $this->loginAs('admin@vitapharmaafrica.com');

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->patchJson("/api/v1/pharmaco/branches/{$branch->id}", [
                'phone' => '+250788000001',
                'email' => 'hq@vitapharmaafrica.com',
                'address' => 'Kigali, Rwanda',
                'status' => 'active',
            ])
            ->assertOk()
            ->assertJsonPath('message', 'Branch updated successfully.')
            ->assertJsonPath('branch.phone', '+250788000001')
            ->assertJsonPath('branch.email', 'hq@vitapharmaafrica.com');

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'pharmaco.branch.updated',
            'auditable_type' => Branch::class,
            'auditable_id' => $branch->id,
        ]);
    }

    public function test_tenant_admin_can_create_branch_department_and_audit_is_recorded(): void
    {
        $this->seed();

        $branch = Branch::where('code', 'HQ')->firstOrFail();
        $token = $this->loginAs('admin@vitapharmaafrica.com');

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->postJson("/api/v1/pharmaco/branches/{$branch->id}/departments", [
                'name' => 'Night Counter',
                'code' => 'NIGHT_COUNTER',
                'department_type' => 'extended_hours_service',
                'opening_time' => '20:00',
                'closing_time' => '23:00',
                'is_revenue_center' => true,
                'notes' => 'Evening customer service and urgent medicine counter.',
            ])
            ->assertCreated()
            ->assertJsonPath('message', 'Branch department created successfully.')
            ->assertJsonPath('department.code', 'NIGHT_COUNTER')
            ->assertJsonPath('department.is_revenue_center', true);

        $department = BranchDepartment::where('code', 'NIGHT_COUNTER')->firstOrFail();

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'pharmaco.branch_department.created',
            'auditable_type' => BranchDepartment::class,
            'auditable_id' => $department->id,
        ]);
    }

    public function test_tenant_admin_can_update_branch_department_and_audit_is_recorded(): void
    {
        $this->seed();

        $branch = Branch::where('code', 'HQ')->firstOrFail();
        $department = BranchDepartment::where('code', 'CUSTOMER_CARE')->firstOrFail();
        $token = $this->loginAs('admin@vitapharmaafrica.com');

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->patchJson("/api/v1/pharmaco/branches/{$branch->id}/departments/{$department->id}", [
                'name' => 'Customer Success',
                'operating_status' => 'active',
                'notes' => 'Customer reminders, adherence support and follow-up.',
            ])
            ->assertOk()
            ->assertJsonPath('message', 'Branch department updated successfully.')
            ->assertJsonPath('department.name', 'Customer Success')
            ->assertJsonPath('department.notes', 'Customer reminders, adherence support and follow-up.');

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'pharmaco.branch_department.updated',
            'auditable_type' => BranchDepartment::class,
            'auditable_id' => $department->id,
        ]);
    }

    public function test_duplicate_department_code_is_rejected_within_same_branch(): void
    {
        $this->seed();

        $branch = Branch::where('code', 'HQ')->firstOrFail();
        $token = $this->loginAs('admin@vitapharmaafrica.com');

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->postJson("/api/v1/pharmaco/branches/{$branch->id}/departments", [
                'name' => 'Another Store',
                'code' => 'STORE',
                'department_type' => 'inventory_operations',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['code']);
    }

    public function test_tenant_admin_cannot_update_branch_outside_tenant(): void
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
            ->patchJson("/api/v1/pharmaco/branches/{$otherBranch->id}", [
                'phone' => '+250788999999',
            ])
            ->assertNotFound();
    }

    public function test_tenant_admin_cannot_update_department_outside_branch(): void
    {
        $this->seed();

        $branch = Branch::where('code', 'HQ')->firstOrFail();
        $otherTenant = $this->createOtherPharmacyTenant();
        $otherBranch = Branch::query()->create([
            'tenant_id' => $otherTenant->id,
            'name' => 'Other Pharmacy HQ',
            'code' => 'OTHER-HQ',
            'branch_type' => 'pharmacy',
            'status' => 'active',
        ]);

        $otherDepartment = BranchDepartment::query()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $otherTenant->id,
            'branch_id' => $otherBranch->id,
            'name' => 'Other Dispensary',
            'code' => 'OTHER_DISPENSARY',
            'department_type' => 'clinical_operations',
            'operating_status' => 'active',
        ]);

        $token = $this->loginAs('admin@vitapharmaafrica.com');

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->patchJson("/api/v1/pharmaco/branches/{$branch->id}/departments/{$otherDepartment->id}", [
                'name' => 'Should Not Update',
            ])
            ->assertNotFound();
    }

    private function loginAs(string $email): string
    {
        $response = $this->postJson('/api/v1/auth/login', [
            'email' => $email,
            'password' => 'ChangeThisPassword123!',
            'device_name' => 'PharmaCo360 Mutation API Test Client',
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
