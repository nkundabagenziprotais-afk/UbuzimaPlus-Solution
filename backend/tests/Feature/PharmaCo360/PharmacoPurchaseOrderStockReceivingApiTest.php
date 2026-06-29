<?php

namespace Tests\Feature\PharmaCo360;

use App\Models\Branch;
use App\Models\PharmacoPurchaseOrder;
use App\Models\PharmacoPurchaseOrderItem;
use App\Models\PharmacoSupplier;
use App\Models\Product;
use App\Models\Solution;
use App\Models\StockLocation;
use App\Models\StockMovement;
use App\Models\Tenant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class PharmacoPurchaseOrderStockReceivingApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_tenant_admin_can_receive_stock_against_purchase_order_item(): void
    {
        $this->seed();

        $token = $this->loginAs('admin@vitapharmaafrica.com');
        [$purchaseOrder, $purchaseOrderItem, $product, $location] = $this->createPurchaseOrderItem(quantityOrdered: 10);

        $response = $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->postJson('/api/v1/pharmaco/inventory/receive', [
                'product_id' => $product->id,
                'stock_location_id' => $location->id,
                'pharmaco_purchase_order_item_id' => $purchaseOrderItem->id,
                'batch_number' => 'PO-LINK-B001',
                'quantity' => 4,
                'unit_cost' => 900,
                'selling_price' => 1200,
            ])
            ->assertCreated()
            ->assertJsonPath('message', 'Stock received against purchase order successfully.')
            ->assertJsonPath('movement.reference_type', 'pharmaco_purchase_order')
            ->assertJsonPath('movement.reference_number', $purchaseOrder->po_number)
            ->assertJsonPath('purchase_order_receipt.purchase_order_id', $purchaseOrder->id)
            ->assertJsonPath('purchase_order_receipt.purchase_order_item_id', $purchaseOrderItem->id)
            ->assertJsonPath('purchase_order_receipt.purchase_order_status', 'partially_received');

        $purchaseOrderItem->refresh();
        $purchaseOrder->refresh();

        $this->assertSame(4.0, (float) $purchaseOrderItem->quantity_received);
        $this->assertSame('partially_received', $purchaseOrderItem->status);
        $this->assertSame('partially_received', $purchaseOrder->status);

        $this->assertDatabaseHas('stock_movements', [
            'reference_type' => 'pharmaco_purchase_order',
            'reference_number' => $purchaseOrder->po_number,
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'pharmaco.purchase_order.stock_received',
        ]);
    }

    public function test_full_purchase_order_item_receipt_marks_item_and_purchase_order_received(): void
    {
        $this->seed();

        $token = $this->loginAs('admin@vitapharmaafrica.com');
        [$purchaseOrder, $purchaseOrderItem, $product, $location] = $this->createPurchaseOrderItem(quantityOrdered: 5);

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->postJson('/api/v1/pharmaco/inventory/receive', [
                'product_id' => $product->id,
                'stock_location_id' => $location->id,
                'pharmaco_purchase_order_item_id' => $purchaseOrderItem->id,
                'batch_number' => 'PO-LINK-B002',
                'quantity' => 5,
                'unit_cost' => 700,
            ])
            ->assertCreated()
            ->assertJsonPath('purchase_order_receipt.purchase_order_status', 'received')
            ->assertJsonPath('purchase_order_receipt.item_status', 'received')
            ->assertJsonPath('purchase_order_receipt.remaining_quantity_after', 0);

        $purchaseOrderItem->refresh();
        $purchaseOrder->refresh();

        $this->assertSame(5.0, (float) $purchaseOrderItem->quantity_received);
        $this->assertSame('received', $purchaseOrderItem->status);
        $this->assertSame('received', $purchaseOrder->status);
    }

    public function test_purchase_order_linked_receiving_rejects_over_receipt(): void
    {
        $this->seed();

        $token = $this->loginAs('admin@vitapharmaafrica.com');
        [$purchaseOrder, $purchaseOrderItem, $product, $location] = $this->createPurchaseOrderItem(quantityOrdered: 3);

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->postJson('/api/v1/pharmaco/inventory/receive', [
                'product_id' => $product->id,
                'stock_location_id' => $location->id,
                'pharmaco_purchase_order_item_id' => $purchaseOrderItem->id,
                'batch_number' => 'PO-LINK-B003',
                'quantity' => 4,
                'unit_cost' => 700,
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('quantity');

        $purchaseOrderItem->refresh();
        $purchaseOrder->refresh();

        $this->assertSame(0.0, (float) $purchaseOrderItem->quantity_received);
        $this->assertSame('pending', $purchaseOrderItem->status);
        $this->assertSame('draft', $purchaseOrder->status);
    }

    public function test_purchase_order_linked_receiving_requires_matching_product(): void
    {
        $this->seed();

        $token = $this->loginAs('admin@vitapharmaafrica.com');
        [$purchaseOrder, $purchaseOrderItem, $product, $location] = $this->createPurchaseOrderItem(quantityOrdered: 3);
        $otherProduct = Product::where('tenant_id', $this->tenant()->id)
            ->where('id', '!=', $product->id)
            ->where('status', 'active')
            ->firstOrFail();

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->postJson('/api/v1/pharmaco/inventory/receive', [
                'product_id' => $otherProduct->id,
                'stock_location_id' => $location->id,
                'pharmaco_purchase_order_item_id' => $purchaseOrderItem->id,
                'batch_number' => 'PO-LINK-B004',
                'quantity' => 1,
                'unit_cost' => 700,
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('product_id');
    }

    public function test_purchase_order_linked_receiving_rejects_item_outside_current_tenant(): void
    {
        $this->seed();

        $token = $this->loginAs('admin@vitapharmaafrica.com');
        $tenant = $this->tenant();
        $product = Product::where('tenant_id', $tenant->id)->where('status', 'active')->firstOrFail();
        $location = StockLocation::where('tenant_id', $tenant->id)->firstOrFail();
        $otherTenantItem = $this->createOtherTenantPurchaseOrderItem();

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->postJson('/api/v1/pharmaco/inventory/receive', [
                'product_id' => $product->id,
                'stock_location_id' => $location->id,
                'pharmaco_purchase_order_item_id' => $otherTenantItem->id,
                'batch_number' => 'PO-LINK-B005',
                'quantity' => 1,
                'unit_cost' => 700,
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('pharmaco_purchase_order_item_id');
    }

    public function test_manual_stock_receiving_still_works_without_purchase_order_item(): void
    {
        $this->seed();

        $token = $this->loginAs('admin@vitapharmaafrica.com');
        $tenant = $this->tenant();
        $product = Product::where('tenant_id', $tenant->id)->where('status', 'active')->firstOrFail();
        $location = StockLocation::where('tenant_id', $tenant->id)->firstOrFail();

        $response = $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->postJson('/api/v1/pharmaco/inventory/receive', [
                'product_id' => $product->id,
                'stock_location_id' => $location->id,
                'batch_number' => 'MANUAL-STILL-WORKS',
                'quantity' => 2,
                'unit_cost' => 700,
            ])
            ->assertCreated()
            ->assertJsonPath('message', 'Stock received successfully.')
            ->assertJsonPath('movement.reference_type', 'stock_receipt')
            ->assertJsonPath('purchase_order_receipt', null);

        $movementId = $response->json('movement.id');

        $this->assertDatabaseHas('stock_movements', [
            'id' => $movementId,
            'reference_type' => 'stock_receipt',
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'pharmaco.stock.received',
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
            'device_name' => 'PharmaCo360 PO Linked Receiving Test Client',
        ]);

        $response->assertOk();

        return $response->json('access_token');
    }

    private function createPurchaseOrderItem(float $quantityOrdered): array
    {
        $tenant = $this->tenant();
        $branch = Branch::where('tenant_id', $tenant->id)->firstOrFail();
        $location = StockLocation::where('tenant_id', $tenant->id)
            ->where('branch_id', $branch->id)
            ->firstOrFail();
        $supplier = PharmacoSupplier::query()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $tenant->id,
            'supplier_code' => 'SUP-RCV-' . Str::upper(Str::random(5)),
            'name' => 'Receiving Test Supplier',
            'supplier_type' => 'wholesaler',
            'status' => 'active',
        ]);
        $product = Product::where('tenant_id', $tenant->id)->where('status', 'active')->firstOrFail();

        $purchaseOrder = PharmacoPurchaseOrder::query()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $tenant->id,
            'branch_id' => $branch->id,
            'pharmaco_supplier_id' => $supplier->id,
            'po_number' => 'PO-RCV-' . Str::upper(Str::random(6)),
            'status' => 'draft',
            'order_date' => now()->toDateString(),
            'subtotal_amount' => $quantityOrdered * 1000,
            'discount_amount' => 0,
            'tax_amount' => 0,
            'shipping_amount' => 0,
            'total_amount' => $quantityOrdered * 1000,
            'metadata' => [
                'receiving_status' => 'not_received',
            ],
        ]);

        $purchaseOrderItem = PharmacoPurchaseOrderItem::query()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $tenant->id,
            'pharmaco_purchase_order_id' => $purchaseOrder->id,
            'product_id' => $product->id,
            'product_name_snapshot' => $product->name,
            'sku_snapshot' => $product->sku,
            'quantity_ordered' => $quantityOrdered,
            'quantity_received' => 0,
            'unit_cost' => 1000,
            'discount_amount' => 0,
            'tax_amount' => 0,
            'line_total' => $quantityOrdered * 1000,
            'status' => 'pending',
        ]);

        return [$purchaseOrder, $purchaseOrderItem, $product, $location];
    }

    private function createOtherTenantPurchaseOrderItem(): PharmacoPurchaseOrderItem
    {
        $solution = Solution::where('code', 'pharmaco360')->firstOrFail();

        $tenant = Tenant::query()->create([
            'uuid' => (string) Str::uuid(),
            'name' => 'Other Receiving Pharmacy',
            'slug' => 'other-receiving-pharmacy-' . Str::lower(Str::random(6)),
            'legal_name' => 'Other Receiving Pharmacy Ltd',
            'primary_solution_id' => $solution->id,
            'tenant_type' => 'pharmacy',
            'status' => 'active',
        ]);

        $branch = Branch::query()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $tenant->id,
            'code' => 'OTHER-HQ-' . Str::upper(Str::random(4)),
            'name' => 'Other HQ',
            'branch_type' => 'pharmacy',
            'status' => 'active',
        ]);

        $supplier = PharmacoSupplier::query()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $tenant->id,
            'supplier_code' => 'OTHER-SUP-' . Str::upper(Str::random(5)),
            'name' => 'Other Supplier',
            'supplier_type' => 'wholesaler',
            'status' => 'active',
        ]);

        $product = Product::query()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $tenant->id,
            'product_category_id' => null,
            'name' => 'Other Tenant Product',
            'sku' => 'OTHER-RCV-' . Str::upper(Str::random(6)),
            'unit' => 'unit',
            'product_type' => 'medicine',
            'regulatory_status' => 'approved',
            'requires_prescription' => false,
            'is_controlled' => false,
            'status' => 'active',
        ]);

        $purchaseOrder = PharmacoPurchaseOrder::query()->create([
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

        return PharmacoPurchaseOrderItem::query()->create([
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
    }
}
