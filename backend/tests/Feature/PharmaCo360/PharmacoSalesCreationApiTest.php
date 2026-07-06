<?php

namespace Tests\Feature\PharmaCo360;

use App\Models\AuditLog;
use App\Models\Branch;
use App\Models\PharmacoCustomer;
use App\Models\PharmacoPrescription;
use App\Models\PharmacoSale;
use App\Models\PharmacoTaxComplianceRule;
use App\Models\Product;
use App\Models\Solution;
use App\Models\StockBatch;
use App\Models\Tenant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class PharmacoSalesCreationApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_tenant_admin_can_create_customer_and_audit_is_recorded(): void
    {
        $this->seed();

        $token = $this->loginAs('admin@vitapharmaafrica.com');

        $response = $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->postJson('/api/v1/pharmaco/customers', [
                'first_name' => 'Alice',
                'last_name' => 'Uwase',
                'phone' => '+250788100001',
                'email' => 'alice.uwase@example.test',
                'gender' => 'female',
                'insurance_provider' => 'RSSB',
                'insurance_membership_number' => 'RSSB-001',
            ])
            ->assertCreated()
            ->assertJsonPath('message', 'Customer created successfully.')
            ->assertJsonPath('customer.first_name', 'Alice');

        $customerId = $response->json('customer.id');

        $this->assertDatabaseHas('pharmaco_customers', [
            'id' => $customerId,
            'phone' => '+250788100001',
            'tenant_id' => $this->tenant()->id,
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'pharmaco.customer.created',
            'auditable_type' => PharmacoCustomer::class,
            'auditable_id' => $customerId,
        ]);
    }

    public function test_duplicate_customer_phone_is_rejected_within_tenant(): void
    {
        $this->seed();

        $token = $this->loginAs('admin@vitapharmaafrica.com');

        $payload = [
            'first_name' => 'Alice',
            'phone' => '+250788100002',
        ];

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->postJson('/api/v1/pharmaco/customers', $payload)
            ->assertCreated();

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->postJson('/api/v1/pharmaco/customers', $payload)
            ->assertStatus(422)
            ->assertJsonValidationErrors('phone');
    }

    public function test_tenant_admin_can_create_prescription_for_customer(): void
    {
        $this->seed();

        $token = $this->loginAs('admin@vitapharmaafrica.com');
        $customer = PharmacoCustomer::where('tenant_id', $this->tenant()->id)->firstOrFail();

        $response = $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->postJson('/api/v1/pharmaco/prescriptions', [
                'pharmaco_customer_id' => $customer->id,
                'prescriber_name' => 'Dr. Demo',
                'prescriber_facility' => 'Demo Clinic',
                'issued_at' => now()->toDateString(),
                'expires_at' => now()->addDays(30)->toDateString(),
                'notes' => 'Controlled prescription demo.',
            ])
            ->assertCreated()
            ->assertJsonPath('message', 'Prescription created successfully.')
            ->assertJsonPath('prescription.customer.id', $customer->id);

        $prescriptionId = $response->json('prescription.id');

        $this->assertDatabaseHas('pharmaco_prescriptions', [
            'id' => $prescriptionId,
            'tenant_id' => $this->tenant()->id,
            'pharmaco_customer_id' => $customer->id,
        ]);

        $this->assertNotNull($response->json('prescription.prescription_number'));

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'pharmaco.prescription.created',
            'auditable_type' => PharmacoPrescription::class,
            'auditable_id' => $prescriptionId,
        ]);
    }

    public function test_prescription_customer_must_belong_to_current_tenant(): void
    {
        $this->seed();

        $token = $this->loginAs('admin@vitapharmaafrica.com');
        $otherCustomer = $this->createOtherTenantCustomer();

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->postJson('/api/v1/pharmaco/prescriptions', [
                'pharmaco_customer_id' => $otherCustomer->id,
                'prescriber_name' => 'Dr. Other',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('pharmaco_customer_id');
    }

    public function test_tenant_admin_can_create_draft_sale_with_items_and_totals(): void
    {
        $this->seed();

        $token = $this->loginAs('admin@vitapharmaafrica.com');
        $tenant = $this->tenant();
        $branch = Branch::where('tenant_id', $tenant->id)->firstOrFail();
        $customer = PharmacoCustomer::where('tenant_id', $tenant->id)->firstOrFail();
        $prescription = PharmacoPrescription::where('tenant_id', $tenant->id)->firstOrFail();
        $prescriptionProduct = Product::where('tenant_id', $tenant->id)->where('requires_prescription', true)->firstOrFail();
        $openProduct = Product::where('tenant_id', $tenant->id)->where('requires_prescription', false)->firstOrFail();

        $response = $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->postJson('/api/v1/pharmaco/sales', [
                'branch_id' => $branch->id,
                'pharmaco_customer_id' => $customer->id,
                'pharmaco_prescription_id' => $prescription->id,
                'sale_type' => 'prescription_sale',
                'discount_amount' => 100,
                'tax_amount' => 0,
                'items' => [
                    [
                        'product_id' => $prescriptionProduct->id,
                        'quantity' => 2,
                        'unit_price' => 1500,
                        'discount_amount' => 0,
                        'tax_amount' => 0,
                    ],
                    [
                        'product_id' => $openProduct->id,
                        'quantity' => 1,
                        'unit_price' => 500,
                        'discount_amount' => 0,
                        'tax_amount' => 0,
                    ],
                ],
            ])
            ->assertCreated()
            ->assertJsonPath('message', 'Draft sale created successfully.')
            ->assertJsonPath('sale.status', 'draft')
            ->assertJsonPath('sale.payment_status', 'unpaid')
            ->assertJsonPath('sale.items_count', 2)
            ->assertJsonPath('sale.total_amount', 3400)
            ->assertJsonPath('sale.balance_amount', 3400);

        $saleId = $response->json('sale.id');

        $this->assertDatabaseHas('pharmaco_sales', [
            'id' => $saleId,
            'tenant_id' => $tenant->id,
            'status' => 'draft',
            'payment_status' => 'unpaid',
        ]);

        $this->assertSame(2, PharmacoSale::findOrFail($saleId)->items()->count());

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'pharmaco.sale.created',
            'auditable_type' => PharmacoSale::class,
            'auditable_id' => $saleId,
        ]);
    }

    public function test_tenant_admin_can_create_single_unit_sale_with_stock_pick(): void
    {
        $this->seed();

        $token = $this->loginAs('admin@vitapharmaafrica.com');
        $tenant = $this->tenant();
        $branch = Branch::where('tenant_id', $tenant->id)->firstOrFail();
        $product = Product::where('tenant_id', $tenant->id)
            ->where('requires_prescription', false)
            ->firstOrFail();
        $stockBatch = StockBatch::where('tenant_id', $tenant->id)
            ->where('branch_id', $branch->id)
            ->where('product_id', $product->id)
            ->where('status', 'active')
            ->firstOrFail();

        $response = $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->postJson('/api/v1/pharmaco/sales', [
                'branch_id' => $branch->id,
                'sale_type' => 'cash_sale',
                'items' => [
                    [
                        'product_id' => $product->id,
                        'stock_batch_id' => $stockBatch->id,
                        'quantity' => 1,
                        'unit_price' => 25,
                        'discount_amount' => 0,
                        'tax_amount' => 0,
                    ],
                ],
            ])
            ->assertCreated()
            ->assertJsonPath('message', 'Draft sale created successfully.')
            ->assertJsonPath('sale.items_count', 1)
            ->assertJsonPath('sale.items.0.quantity', 1)
            ->assertJsonPath('sale.items.0.stock_batch.id', $stockBatch->id)
            ->assertJsonPath('sale.items.0.stock_location.id', $stockBatch->stock_location_id)
            ->assertJsonPath('sale.total_amount', 25);

        $this->assertDatabaseHas('pharmaco_sale_items', [
            'pharmaco_sale_id' => $response->json('sale.id'),
            'product_id' => $product->id,
            'stock_batch_id' => $stockBatch->id,
            'quantity' => 1,
        ]);
    }

    public function test_tenant_admin_can_sync_and_read_tax_compliance_rules_without_vat_source_column(): void
    {
        $this->seed();

        $token = $this->loginAs('admin@vitapharmaafrica.com');

        $syncResponse = $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->postJson('/api/v1/pharmaco/tax-compliance/rules/sync', [
                'rules' => [
                    [
                        'code' => 'STANDARD_TAX',
                        'name' => 'Standard taxable retail sale',
                        'applies_to' => 'all_products',
                        'tax_rate' => 18,
                        'status' => 'active',
                    ],
                ],
            ])
            ->assertOk()
            ->assertJsonPath('message', 'Tax compliance rules synced successfully.')
            ->assertJsonPath('rules.0.code', 'STANDARD_TAX')
            ->assertJsonPath('rules.0.applies_to', 'all_products');

        $this->assertDatabaseHas('pharmaco_tax_compliance_rules', [
            'tenant_id' => $this->tenant()->id,
            'code' => 'STANDARD_TAX',
            'status' => 'active',
        ]);

        $readResponse = $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->getJson('/api/v1/pharmaco/tax-compliance/rules')
            ->assertOk()
            ->assertJsonPath('api_sync.status', 'ready_for_rra_integration')
            ->assertJsonPath('rules.0.name', 'Standard taxable retail sale');

        $rule = $readResponse->json('rules.0');

        $this->assertArrayNotHasKey('source', $rule);
        $this->assertArrayNotHasKey('vat_source', $rule);
        $this->assertSame($syncResponse->json('rules.0.uuid'), $rule['uuid']);
        $this->assertSame(1, PharmacoTaxComplianceRule::where('tenant_id', $this->tenant()->id)->count());
    }

    public function test_prescription_required_product_requires_prescription_on_sale_creation(): void
    {
        $this->seed();

        $token = $this->loginAs('admin@vitapharmaafrica.com');
        $tenant = $this->tenant();
        $branch = Branch::where('tenant_id', $tenant->id)->firstOrFail();
        $product = Product::where('tenant_id', $tenant->id)->where('requires_prescription', true)->firstOrFail();

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->postJson('/api/v1/pharmaco/sales', [
                'branch_id' => $branch->id,
                'items' => [
                    [
                        'product_id' => $product->id,
                        'quantity' => 1,
                        'unit_price' => 1000,
                    ],
                ],
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('pharmaco_prescription_id');
    }

    public function test_sale_creation_rejects_product_outside_current_tenant(): void
    {
        $this->seed();

        $token = $this->loginAs('admin@vitapharmaafrica.com');
        $tenant = $this->tenant();
        $branch = Branch::where('tenant_id', $tenant->id)->firstOrFail();
        $otherProduct = $this->createOtherTenantProduct();

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->postJson('/api/v1/pharmaco/sales', [
                'branch_id' => $branch->id,
                'items' => [
                    [
                        'product_id' => $otherProduct->id,
                        'quantity' => 1,
                        'unit_price' => 1000,
                    ],
                ],
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('items');
    }

    public function test_creation_endpoints_require_tenant_header(): void
    {
        $this->seed();

        $token = $this->loginAs('admin@vitapharmaafrica.com');

        $this->withToken($token)
            ->postJson('/api/v1/pharmaco/customers', [
                'first_name' => 'No Tenant',
            ])
            ->assertStatus(422)
            ->assertJsonPath('required_header', 'X-Tenant-Slug');
    }

    private function tenant(): Tenant
    {
        return Tenant::where('slug', 'vitapharma')->firstOrFail();
    }

    private function loginAs(string $email): string
    {
        $response = $this->postJson('/api/v1/auth/login', [
            'email' => $email,
            'password' => 'ChangeThisPassword123!',
            'device_name' => 'PharmaCo360 Sales Creation API Test Client',
        ]);

        $response->assertOk();

        return $response->json('access_token');
    }

    private function createOtherTenantCustomer(): PharmacoCustomer
    {
        $solution = Solution::where('code', 'pharmaco360')->firstOrFail();

        $tenant = Tenant::query()->create([
            'uuid' => (string) Str::uuid(),
            'name' => 'Other Customer Pharmacy',
            'slug' => 'other-customer-pharmacy-' . Str::lower(Str::random(6)),
            'legal_name' => 'Other Customer Pharmacy Ltd',
            'primary_solution_id' => $solution->id,
            'tenant_type' => 'pharmacy',
            'status' => 'active',
        ]);

        return PharmacoCustomer::query()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $tenant->id,
            'first_name' => 'Other',
            'last_name' => 'Customer',
            'phone' => '+250788' . random_int(100000, 999999),
            'customer_type' => 'patient',
            'status' => 'active',
        ]);
    }

    private function createOtherTenantProduct(): Product
    {
        $solution = Solution::where('code', 'pharmaco360')->firstOrFail();

        $tenant = Tenant::query()->create([
            'uuid' => (string) Str::uuid(),
            'name' => 'Other Product Pharmacy',
            'slug' => 'other-product-pharmacy-' . Str::lower(Str::random(6)),
            'legal_name' => 'Other Product Pharmacy Ltd',
            'primary_solution_id' => $solution->id,
            'tenant_type' => 'pharmacy',
            'status' => 'active',
        ]);

        return Product::query()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $tenant->id,
            'product_category_id' => null,
            'name' => 'Other Tenant Product',
            'sku' => 'OTHER-' . Str::upper(Str::random(6)),
            'unit' => 'unit',
            'product_type' => 'medicine',
            'regulatory_status' => 'approved',
            'requires_prescription' => false,
            'is_controlled' => false,
            'status' => 'active',
        ]);
    }
}
