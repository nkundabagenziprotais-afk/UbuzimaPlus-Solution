<?php

namespace Tests\Feature\PharmaCo360;

use App\Models\Branch;
use App\Models\PharmacoSale;
use App\Models\Solution;
use App\Models\Tenant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class PharmacoSalesDispensingApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_tenant_admin_can_list_sales(): void
    {
        $this->seed();

        $token = $this->loginAs('admin@vitapharmaafrica.com');

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->getJson('/api/v1/pharmaco/sales')
            ->assertOk()
            ->assertJsonPath('tenant.slug', 'vitapharma')
            ->assertJsonPath('sales.0.sale_number', 'SALE-VITA-DRAFT-0001')
            ->assertJsonPath('sales.0.status', 'draft')
            ->assertJsonPath('sales.0.payment_status', 'unpaid');
    }

    public function test_tenant_admin_can_view_sale_detail_with_items(): void
    {
        $this->seed();

        $sale = PharmacoSale::where('sale_number', 'SALE-VITA-DRAFT-0001')->firstOrFail();
        $token = $this->loginAs('admin@vitapharmaafrica.com');

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->getJson("/api/v1/pharmaco/sales/{$sale->id}")
            ->assertOk()
            ->assertJsonPath('tenant.slug', 'vitapharma')
            ->assertJsonPath('sale.sale_number', 'SALE-VITA-DRAFT-0001')
            ->assertJsonPath('sale.customer.first_name', 'Jean')
            ->assertJsonPath('sale.prescription.prescription_number', 'RX-VITA-0001')
            ->assertJsonCount(2, 'sale.items');
    }

    public function test_tenant_admin_can_list_customers_and_prescriptions(): void
    {
        $this->seed();

        $token = $this->loginAs('admin@vitapharmaafrica.com');

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->getJson('/api/v1/pharmaco/customers')
            ->assertOk()
            ->assertJsonPath('tenant.slug', 'vitapharma')
            ->assertJsonPath('customers.0.first_name', 'Jean');

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->getJson('/api/v1/pharmaco/prescriptions')
            ->assertOk()
            ->assertJsonPath('tenant.slug', 'vitapharma')
            ->assertJsonPath('prescriptions.0.prescription_number', 'RX-VITA-0001')
            ->assertJsonPath('prescriptions.0.customer.first_name', 'Jean');
    }

    public function test_sales_endpoints_require_tenant_header(): void
    {
        $this->seed();

        $token = $this->loginAs('admin@vitapharmaafrica.com');

        $this->withToken($token)
            ->getJson('/api/v1/pharmaco/sales')
            ->assertStatus(422)
            ->assertJsonPath('required_header', 'X-Tenant-Slug');
    }

    public function test_tenant_admin_cannot_view_sale_outside_current_tenant(): void
    {
        $this->seed();

        $otherSale = $this->createOtherTenantSale();
        $token = $this->loginAs('admin@vitapharmaafrica.com');

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->getJson("/api/v1/pharmaco/sales/{$otherSale->id}")
            ->assertNotFound();
    }

    public function test_sales_module_and_permission_are_seeded(): void
    {
        $this->seed();

        $this->assertDatabaseHas('modules', [
            'code' => 'pharmaco.sales',
            'status' => 'available',
        ]);

        $this->assertDatabaseHas('permissions', [
            'code' => 'pharmaco.sales.manage',
            'status' => 'active',
        ]);

        $tenant = Tenant::where('slug', 'vitapharma')->firstOrFail();

        $this->assertDatabaseHas('tenant_module_activations', [
            'tenant_id' => $tenant->id,
            'status' => 'active',
        ]);
    }

    private function loginAs(string $email): string
    {
        $response = $this->postJson('/api/v1/auth/login', [
            'email' => $email,
            'password' => 'ChangeThisPassword123!',
            'device_name' => 'PharmaCo360 Sales API Test Client',
        ]);

        $response->assertOk();

        return $response->json('access_token');
    }

    private function createOtherTenantSale(): PharmacoSale
    {
        $solution = Solution::where('code', 'pharmaco360')->firstOrFail();

        $tenant = Tenant::query()->create([
            'uuid' => (string) Str::uuid(),
            'name' => 'Other Sales Pharmacy',
            'slug' => 'other-sales-pharmacy-' . Str::lower(Str::random(6)),
            'legal_name' => 'Other Sales Pharmacy Ltd',
            'primary_solution_id' => $solution->id,
            'tenant_type' => 'pharmacy',
            'status' => 'active',
        ]);

        $branch = Branch::query()->create([
            'tenant_id' => $tenant->id,
            'name' => 'Other Sales Branch',
            'code' => 'OTHER-SALES-BRANCH',
            'branch_type' => 'pharmacy',
            'status' => 'active',
        ]);

        return PharmacoSale::query()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $tenant->id,
            'branch_id' => $branch->id,
            'sale_number' => 'OTHER-SALE-' . Str::upper(Str::random(6)),
            'sale_type' => 'cash_sale',
            'status' => 'draft',
            'subtotal_amount' => 1000,
            'discount_amount' => 0,
            'tax_amount' => 0,
            'total_amount' => 1000,
            'paid_amount' => 0,
            'balance_amount' => 1000,
            'payment_status' => 'unpaid',
        ]);
    }
}
