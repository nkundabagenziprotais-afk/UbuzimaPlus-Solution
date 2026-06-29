<?php

namespace Tests\Feature\PharmaCo360;

use App\Models\Branch;
use App\Models\PharmacoPurchaseOrder;
use App\Models\PharmacoPurchaseOrderItem;
use App\Models\PharmacoSupplier;
use App\Models\Product;
use App\Models\Solution;
use App\Models\Tenant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class PharmacoProcurementApprovalControlsApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_tenant_admin_can_update_supplier_and_audit_is_recorded(): void
    {
        $this->seed();

        $token = $this->loginAs('admin@vitapharmaafrica.com');
        $supplier = $this->createSupplier();

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->patchJson("/api/v1/pharmaco/suppliers/{$supplier->id}", [
                'name' => 'Updated Procurement Supplier',
                'supplier_type' => 'distributor',
                'status' => 'inactive',
                'payment_terms' => 'Net 15',
            ])
            ->assertOk()
            ->assertJsonPath('message', 'Supplier updated successfully.')
            ->assertJsonPath('supplier.name', 'Updated Procurement Supplier')
            ->assertJsonPath('supplier.status', 'inactive');

        $this->assertDatabaseHas('pharmaco_suppliers', [
            'id' => $supplier->id,
            'name' => 'Updated Procurement Supplier',
            'supplier_type' => 'distributor',
            'status' => 'inactive',
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'pharmaco.supplier.updated',
            'auditable_type' => PharmacoSupplier::class,
            'auditable_id' => $supplier->id,
        ]);
    }

    public function test_duplicate_supplier_code_is_rejected_on_update(): void
    {
        $this->seed();

        $token = $this->loginAs('admin@vitapharmaafrica.com');
        $firstSupplier = $this->createSupplier('SUP-APPROVAL-001');
        $secondSupplier = $this->createSupplier('SUP-APPROVAL-002');

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->patchJson("/api/v1/pharmaco/suppliers/{$secondSupplier->id}", [
                'supplier_code' => $firstSupplier->supplier_code,
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('supplier_code');
    }

    public function test_tenant_admin_can_approve_draft_purchase_order(): void
    {
        $this->seed();

        $token = $this->loginAs('admin@vitapharmaafrica.com');
        $purchaseOrder = $this->createPurchaseOrder();

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->postJson("/api/v1/pharmaco/purchase-orders/{$purchaseOrder->id}/approve")
            ->assertOk()
            ->assertJsonPath('message', 'Purchase order approved successfully.')
            ->assertJsonPath('purchase_order.status', 'approved');

        $purchaseOrder->refresh();

        $this->assertSame('approved', $purchaseOrder->status);
        $this->assertNotNull($purchaseOrder->approved_at);
        $this->assertNotNull($purchaseOrder->approved_by);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'pharmaco.purchase_order.approved',
            'auditable_type' => PharmacoPurchaseOrder::class,
            'auditable_id' => $purchaseOrder->id,
        ]);
    }

    public function test_non_draft_purchase_order_cannot_be_approved_again(): void
    {
        $this->seed();

        $token = $this->loginAs('admin@vitapharmaafrica.com');
        $purchaseOrder = $this->createPurchaseOrder();
        $purchaseOrder->update(['status' => 'approved']);

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->postJson("/api/v1/pharmaco/purchase-orders/{$purchaseOrder->id}/approve")
            ->assertStatus(422)
            ->assertJsonValidationErrors('status');
    }

    public function test_tenant_admin_can_cancel_draft_purchase_order_without_receipts(): void
    {
        $this->seed();

        $token = $this->loginAs('admin@vitapharmaafrica.com');
        $purchaseOrder = $this->createPurchaseOrder();

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->postJson("/api/v1/pharmaco/purchase-orders/{$purchaseOrder->id}/cancel", [
                'reason' => 'Supplier confirmed stock is unavailable.',
            ])
            ->assertOk()
            ->assertJsonPath('message', 'Purchase order cancelled successfully.')
            ->assertJsonPath('purchase_order.status', 'cancelled');

        $purchaseOrder->refresh();

        $this->assertSame('cancelled', $purchaseOrder->status);
        $this->assertSame('cancelled', $purchaseOrder->items()->firstOrFail()->status);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'pharmaco.purchase_order.cancelled',
            'auditable_type' => PharmacoPurchaseOrder::class,
            'auditable_id' => $purchaseOrder->id,
        ]);
    }

    public function test_purchase_order_with_received_stock_cannot_be_cancelled(): void
    {
        $this->seed();

        $token = $this->loginAs('admin@vitapharmaafrica.com');
        $purchaseOrder = $this->createPurchaseOrder();
        $purchaseOrder->items()->firstOrFail()->update([
            'quantity_received' => 1,
            'status' => 'partially_received',
        ]);
        $purchaseOrder->update(['status' => 'partially_received']);

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->postJson("/api/v1/pharmaco/purchase-orders/{$purchaseOrder->id}/cancel", [
                'reason' => 'Trying to cancel after receipt.',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('status');

        $purchaseOrder->refresh();

        $this->assertSame('partially_received', $purchaseOrder->status);
    }

    public function test_tenant_admin_cannot_update_supplier_outside_current_tenant(): void
    {
        $this->seed();

        $token = $this->loginAs('admin@vitapharmaafrica.com');
        $otherSupplier = $this->createOtherTenantSupplier();

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->patchJson("/api/v1/pharmaco/suppliers/{$otherSupplier->id}", [
                'name' => 'Should Not Update',
            ])
            ->assertNotFound();
    }

    public function test_tenant_admin_cannot_approve_purchase_order_outside_current_tenant(): void
    {
        $this->seed();

        $token = $this->loginAs('admin@vitapharmaafrica.com');
        $otherPurchaseOrder = $this->createOtherTenantPurchaseOrder();

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->postJson("/api/v1/pharmaco/purchase-orders/{$otherPurchaseOrder->id}/approve")
            ->assertNotFound();
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
            'device_name' => 'PharmaCo360 Procurement Approval Test Client',
        ]);

        $response->assertOk();

        return $response->json('access_token');
    }

    private function createSupplier(?string $supplierCode = null): PharmacoSupplier
    {
        return PharmacoSupplier::query()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $this->tenant()->id,
            'supplier_code' => $supplierCode ?? ('SUP-CTRL-' . Str::upper(Str::random(5))),
            'name' => 'Approval Control Supplier',
            'supplier_type' => 'wholesaler',
            'status' => 'active',
        ]);
    }

    private function createPurchaseOrder(): PharmacoPurchaseOrder
    {
        $tenant = $this->tenant();
        $branch = Branch::where('tenant_id', $tenant->id)->firstOrFail();
        $supplier = $this->createSupplier();
        $product = Product::where('tenant_id', $tenant->id)->where('status', 'active')->firstOrFail();

        $purchaseOrder = PharmacoPurchaseOrder::query()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $tenant->id,
            'branch_id' => $branch->id,
            'pharmaco_supplier_id' => $supplier->id,
            'po_number' => 'PO-CTRL-' . Str::upper(Str::random(6)),
            'status' => 'draft',
            'order_date' => now()->toDateString(),
            'subtotal_amount' => 1000,
            'discount_amount' => 0,
            'tax_amount' => 0,
            'shipping_amount' => 0,
            'total_amount' => 1000,
        ]);

        PharmacoPurchaseOrderItem::query()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $tenant->id,
            'pharmaco_purchase_order_id' => $purchaseOrder->id,
            'product_id' => $product->id,
            'product_name_snapshot' => $product->name,
            'sku_snapshot' => $product->sku,
            'quantity_ordered' => 1,
            'quantity_received' => 0,
            'unit_cost' => 1000,
            'discount_amount' => 0,
            'tax_amount' => 0,
            'line_total' => 1000,
            'status' => 'pending',
        ]);

        return $purchaseOrder;
    }

    private function createOtherTenantSupplier(): PharmacoSupplier
    {
        $tenant = $this->createOtherTenant();

        return PharmacoSupplier::query()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $tenant->id,
            'supplier_code' => 'OTHER-SUP-' . Str::upper(Str::random(5)),
            'name' => 'Other Tenant Supplier',
            'supplier_type' => 'wholesaler',
            'status' => 'active',
        ]);
    }

    private function createOtherTenantPurchaseOrder(): PharmacoPurchaseOrder
    {
        $tenant = $this->createOtherTenant();
        $branch = Branch::query()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $tenant->id,
            'code' => 'OTHER-BR-' . Str::upper(Str::random(4)),
            'name' => 'Other Branch',
            'branch_type' => 'pharmacy',
            'status' => 'active',
        ]);

        $supplier = PharmacoSupplier::query()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $tenant->id,
            'supplier_code' => 'OTHER-PO-SUP-' . Str::upper(Str::random(5)),
            'name' => 'Other PO Supplier',
            'supplier_type' => 'wholesaler',
            'status' => 'active',
        ]);

        return PharmacoPurchaseOrder::query()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $tenant->id,
            'branch_id' => $branch->id,
            'pharmaco_supplier_id' => $supplier->id,
            'po_number' => 'OTHER-PO-' . Str::upper(Str::random(6)),
            'status' => 'draft',
            'order_date' => now()->toDateString(),
            'subtotal_amount' => 1000,
            'discount_amount' => 0,
            'tax_amount' => 0,
            'shipping_amount' => 0,
            'total_amount' => 1000,
        ]);
    }

    private function createOtherTenant(): Tenant
    {
        $solution = Solution::where('code', 'pharmaco360')->firstOrFail();

        return Tenant::query()->create([
            'uuid' => (string) Str::uuid(),
            'name' => 'Other Procurement Control Pharmacy',
            'slug' => 'other-procurement-control-' . Str::lower(Str::random(6)),
            'legal_name' => 'Other Procurement Control Pharmacy Ltd',
            'primary_solution_id' => $solution->id,
            'tenant_type' => 'pharmacy',
            'status' => 'active',
        ]);
    }
}
