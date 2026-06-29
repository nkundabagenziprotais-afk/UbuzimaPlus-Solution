<?php

namespace Tests\Feature\PharmaCo360;

use App\Models\Branch;
use App\Models\PharmacoPurchaseOrder;
use App\Models\PharmacoSupplier;
use App\Models\Product;
use App\Models\Solution;
use App\Models\Tenant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class PharmacoProcurementFoundationApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_tenant_admin_can_create_supplier_and_audit_is_recorded(): void
    {
        $this->seed();

        $token = $this->loginAs('admin@vitapharmaafrica.com');

        $response = $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->postJson('/api/v1/pharmaco/suppliers', [
                'supplier_code' => 'SUP-DEMO-001',
                'name' => 'Kigali Wholesale Pharma',
                'supplier_type' => 'wholesaler',
                'contact_person' => 'Procurement Lead',
                'phone' => '+250788200001',
                'email' => 'supply@example.test',
                'license_number' => 'LIC-001',
                'payment_terms' => 'Net 30',
            ])
            ->assertCreated()
            ->assertJsonPath('message', 'Supplier created successfully.')
            ->assertJsonPath('supplier.name', 'Kigali Wholesale Pharma')
            ->assertJsonPath('supplier.supplier_type', 'wholesaler');

        $supplierId = $response->json('supplier.id');

        $this->assertDatabaseHas('pharmaco_suppliers', [
            'id' => $supplierId,
            'tenant_id' => $this->tenant()->id,
            'supplier_code' => 'SUP-DEMO-001',
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'pharmaco.supplier.created',
            'auditable_type' => PharmacoSupplier::class,
            'auditable_id' => $supplierId,
        ]);
    }

    public function test_duplicate_supplier_code_is_rejected_within_tenant(): void
    {
        $this->seed();

        $token = $this->loginAs('admin@vitapharmaafrica.com');

        $payload = [
            'supplier_code' => 'SUP-DUP-001',
            'name' => 'Duplicate Supplier',
            'supplier_type' => 'distributor',
        ];

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->postJson('/api/v1/pharmaco/suppliers', $payload)
            ->assertCreated();

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->postJson('/api/v1/pharmaco/suppliers', $payload)
            ->assertStatus(422)
            ->assertJsonValidationErrors('supplier_code');
    }

    public function test_tenant_admin_can_list_suppliers(): void
    {
        $this->seed();

        $token = $this->loginAs('admin@vitapharmaafrica.com');

        $this->createSupplier();

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->getJson('/api/v1/pharmaco/suppliers')
            ->assertOk()
            ->assertJsonCount(1, 'suppliers')
            ->assertJsonPath('suppliers.0.status', 'active');
    }

    public function test_tenant_admin_can_create_purchase_order_with_items_and_totals(): void
    {
        $this->seed();

        $token = $this->loginAs('admin@vitapharmaafrica.com');
        $tenant = $this->tenant();
        $branch = Branch::where('tenant_id', $tenant->id)->firstOrFail();
        $supplier = $this->createSupplier();
        $firstProduct = Product::where('tenant_id', $tenant->id)->where('status', 'active')->firstOrFail();
        $secondProduct = Product::where('tenant_id', $tenant->id)->where('status', 'active')->skip(1)->firstOrFail();

        $response = $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->postJson('/api/v1/pharmaco/purchase-orders', [
                'branch_id' => $branch->id,
                'pharmaco_supplier_id' => $supplier->id,
                'order_date' => now()->toDateString(),
                'expected_delivery_date' => now()->addDays(7)->toDateString(),
                'discount_amount' => 100,
                'tax_amount' => 50,
                'shipping_amount' => 250,
                'items' => [
                    [
                        'product_id' => $firstProduct->id,
                        'quantity_ordered' => 10,
                        'unit_cost' => 1000,
                        'discount_amount' => 0,
                        'tax_amount' => 0,
                    ],
                    [
                        'product_id' => $secondProduct->id,
                        'quantity_ordered' => 5,
                        'unit_cost' => 500,
                        'discount_amount' => 0,
                        'tax_amount' => 0,
                    ],
                ],
            ])
            ->assertCreated()
            ->assertJsonPath('message', 'Purchase order created successfully.')
            ->assertJsonPath('purchase_order.status', 'draft')
            ->assertJsonPath('purchase_order.items_count', 2)
            ->assertJsonPath('purchase_order.total_amount', 12700);

        $purchaseOrderId = $response->json('purchase_order.id');

        $this->assertDatabaseHas('pharmaco_purchase_orders', [
            'id' => $purchaseOrderId,
            'tenant_id' => $tenant->id,
            'branch_id' => $branch->id,
            'pharmaco_supplier_id' => $supplier->id,
            'status' => 'draft',
        ]);

        $this->assertSame(2, PharmacoPurchaseOrder::findOrFail($purchaseOrderId)->items()->count());

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'pharmaco.purchase_order.created',
            'auditable_type' => PharmacoPurchaseOrder::class,
            'auditable_id' => $purchaseOrderId,
        ]);
    }

    public function test_purchase_order_product_must_belong_to_current_tenant(): void
    {
        $this->seed();

        $token = $this->loginAs('admin@vitapharmaafrica.com');
        $tenant = $this->tenant();
        $branch = Branch::where('tenant_id', $tenant->id)->firstOrFail();
        $supplier = $this->createSupplier();
        $otherProduct = $this->createOtherTenantProduct();

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->postJson('/api/v1/pharmaco/purchase-orders', [
                'branch_id' => $branch->id,
                'pharmaco_supplier_id' => $supplier->id,
                'items' => [
                    [
                        'product_id' => $otherProduct->id,
                        'quantity_ordered' => 1,
                        'unit_cost' => 1000,
                    ],
                ],
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('items');
    }

    public function test_purchase_order_supplier_must_belong_to_current_tenant(): void
    {
        $this->seed();

        $token = $this->loginAs('admin@vitapharmaafrica.com');
        $tenant = $this->tenant();
        $branch = Branch::where('tenant_id', $tenant->id)->firstOrFail();
        $product = Product::where('tenant_id', $tenant->id)->where('status', 'active')->firstOrFail();
        $otherSupplier = $this->createOtherTenantSupplier();

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->postJson('/api/v1/pharmaco/purchase-orders', [
                'branch_id' => $branch->id,
                'pharmaco_supplier_id' => $otherSupplier->id,
                'items' => [
                    [
                        'product_id' => $product->id,
                        'quantity_ordered' => 1,
                        'unit_cost' => 1000,
                    ],
                ],
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('pharmaco_supplier_id');
    }

    public function test_tenant_admin_can_view_own_purchase_order_detail(): void
    {
        $this->seed();

        $token = $this->loginAs('admin@vitapharmaafrica.com');
        $purchaseOrder = $this->createPurchaseOrderThroughApi($token);

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->getJson("/api/v1/pharmaco/purchase-orders/{$purchaseOrder->id}")
            ->assertOk()
            ->assertJsonPath('purchase_order.id', $purchaseOrder->id)
            ->assertJsonCount(1, 'purchase_order.items');
    }

    public function test_procurement_endpoints_require_tenant_header(): void
    {
        $this->seed();

        $token = $this->loginAs('admin@vitapharmaafrica.com');

        $this->withToken($token)
            ->postJson('/api/v1/pharmaco/suppliers', [
                'name' => 'No Tenant Supplier',
                'supplier_type' => 'wholesaler',
            ])
            ->assertStatus(422)
            ->assertJsonPath('required_header', 'X-Tenant-Slug');
    }

    public function test_suppliers_module_permission_is_seeded(): void
    {
        $this->seed();

        $this->assertDatabaseHas('permissions', [
            'code' => 'pharmaco.suppliers.manage',
            'status' => 'active',
        ]);

        $this->assertDatabaseHas('modules', [
            'code' => 'pharmaco.suppliers',
            'status' => 'available',
        ]);
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
            'device_name' => 'PharmaCo360 Procurement API Test Client',
        ]);

        $response->assertOk();

        return $response->json('access_token');
    }

    private function createSupplier(): PharmacoSupplier
    {
        return PharmacoSupplier::query()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $this->tenant()->id,
            'supplier_code' => 'SUP-TEST-' . Str::upper(Str::random(5)),
            'name' => 'Test Supplier',
            'supplier_type' => 'wholesaler',
            'status' => 'active',
        ]);
    }

    private function createPurchaseOrderThroughApi(string $token): PharmacoPurchaseOrder
    {
        $tenant = $this->tenant();
        $branch = Branch::where('tenant_id', $tenant->id)->firstOrFail();
        $supplier = $this->createSupplier();
        $product = Product::where('tenant_id', $tenant->id)->where('status', 'active')->firstOrFail();

        $response = $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->postJson('/api/v1/pharmaco/purchase-orders', [
                'branch_id' => $branch->id,
                'pharmaco_supplier_id' => $supplier->id,
                'items' => [
                    [
                        'product_id' => $product->id,
                        'quantity_ordered' => 1,
                        'unit_cost' => 1000,
                    ],
                ],
            ]);

        $response->assertCreated();

        return PharmacoPurchaseOrder::findOrFail($response->json('purchase_order.id'));
    }

    private function createOtherTenantSupplier(): PharmacoSupplier
    {
        $solution = Solution::where('code', 'pharmaco360')->firstOrFail();

        $tenant = Tenant::query()->create([
            'uuid' => (string) Str::uuid(),
            'name' => 'Other Supplier Pharmacy',
            'slug' => 'other-supplier-pharmacy-' . Str::lower(Str::random(6)),
            'legal_name' => 'Other Supplier Pharmacy Ltd',
            'primary_solution_id' => $solution->id,
            'tenant_type' => 'pharmacy',
            'status' => 'active',
        ]);

        return PharmacoSupplier::query()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $tenant->id,
            'supplier_code' => 'OTHER-SUP-' . Str::upper(Str::random(5)),
            'name' => 'Other Tenant Supplier',
            'supplier_type' => 'wholesaler',
            'status' => 'active',
        ]);
    }

    private function createOtherTenantProduct(): Product
    {
        $solution = Solution::where('code', 'pharmaco360')->firstOrFail();

        $tenant = Tenant::query()->create([
            'uuid' => (string) Str::uuid(),
            'name' => 'Other Procurement Product Pharmacy',
            'slug' => 'other-procurement-product-' . Str::lower(Str::random(6)),
            'legal_name' => 'Other Procurement Product Pharmacy Ltd',
            'primary_solution_id' => $solution->id,
            'tenant_type' => 'pharmacy',
            'status' => 'active',
        ]);

        return Product::query()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $tenant->id,
            'product_category_id' => null,
            'name' => 'Other Tenant Procurement Product',
            'sku' => 'OTHER-PO-' . Str::upper(Str::random(6)),
            'unit' => 'unit',
            'product_type' => 'medicine',
            'regulatory_status' => 'approved',
            'requires_prescription' => false,
            'is_controlled' => false,
            'status' => 'active',
        ]);
    }
}
