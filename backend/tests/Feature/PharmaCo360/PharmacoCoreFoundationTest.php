<?php

namespace Tests\Feature\PharmaCo360;

use App\Models\Branch;
use App\Models\BranchDepartment;
use App\Models\PharmacyProfile;
use App\Models\Tenant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PharmacoCoreFoundationTest extends TestCase
{
    use RefreshDatabase;

    public function test_vitapharma_pharmacy_profile_is_seeded(): void
    {
        $this->seed();

        $tenant = Tenant::where('slug', 'vitapharma')->firstOrFail();
        $profile = PharmacyProfile::where('tenant_id', $tenant->id)->first();

        $this->assertNotNull($profile);
        $this->assertSame('VitaPharma Africa Ltd', $profile->legal_name);
        $this->assertSame('VitaPharma', $profile->trading_name);
        $this->assertSame('retail_pharmacy', $profile->pharmacy_category);
        $this->assertSame('active', $profile->status);
        $this->assertTrue($profile->is_primary);
        $this->assertNotNull($profile->verified_at);
        $this->assertContains('stock_management', $profile->capabilities);
    }

    public function test_vitapharma_main_branch_departments_are_seeded(): void
    {
        $this->seed();

        $tenant = Tenant::where('slug', 'vitapharma')->firstOrFail();
        $branch = Branch::where('tenant_id', $tenant->id)->where('code', 'HQ')->firstOrFail();

        $departments = BranchDepartment::where('tenant_id', $tenant->id)
            ->where('branch_id', $branch->id)
            ->pluck('code')
            ->all();

        $this->assertContains('DISPENSARY', $departments);
        $this->assertContains('CASHIER', $departments);
        $this->assertContains('STORE', $departments);
        $this->assertContains('PROCUREMENT', $departments);
        $this->assertContains('CUSTOMER_CARE', $departments);
    }

    public function test_branch_department_is_tenant_and_branch_scoped(): void
    {
        $this->seed();

        $tenant = Tenant::where('slug', 'vitapharma')->firstOrFail();
        $branch = Branch::where('tenant_id', $tenant->id)->where('code', 'HQ')->firstOrFail();

        $department = BranchDepartment::where('code', 'DISPENSARY')->firstOrFail();

        $this->assertSame($tenant->id, $department->tenant_id);
        $this->assertSame($branch->id, $department->branch_id);
        $this->assertTrue($department->is_revenue_center);
        $this->assertSame('active', $department->operating_status);
    }
}
