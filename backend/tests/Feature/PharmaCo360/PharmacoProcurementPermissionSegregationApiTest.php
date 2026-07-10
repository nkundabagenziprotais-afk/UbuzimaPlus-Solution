<?php

namespace Tests\Feature\PharmaCo360;

use App\Models\Branch;
use App\Models\Permission;
use App\Models\PharmacoPurchaseOrder;
use App\Models\PharmacoPurchaseOrderItem;
use App\Models\PharmacoSupplier;
use App\Models\PharmacoSupplierInvoice;
use App\Models\Product;
use App\Models\Role;
use App\Models\StockLocation;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PharmacoProcurementPermissionSegregationApiTest extends TestCase
{
    use RefreshDatabase;

    private const TENANT_SLUG = 'vitapharma';

    public function test_granular_procurement_permissions_are_seeded_and_assigned_to_tenant_admin(): void
    {
        $this->seed();

        $codes = $this->granularPermissionCodes();

        $this->assertSame(
            count($codes),
            Permission::query()
                ->whereIn('code', $codes)
                ->where('status', 'active')
                ->count()
        );

        $tenantAdminRole = $this->tenantAdminRole();

        foreach ($codes as $code) {
            $this->assertTrue(
                $tenantAdminRole->permissions()
                    ->where('permissions.code', $code)
                    ->exists(),
                "Tenant admin is missing {$code}."
            );
        }
    }

    public function test_procurement_workspace_dependencies_use_read_permissions_without_manage_authority(): void
    {
        $this->seed();

        $this->actAsTenantAdminWithPermissions([
            'branches.view',
            'pharmaco.inventory.view',
            'pharmaco.product_master.view',
            'pharmaco.procurement.view',
        ]);

        $this->withTenant()
            ->getJson('/api/v1/pharmaco/branches')
            ->assertOk();

        $this->withTenant()
            ->getJson('/api/v1/pharmaco/products')
            ->assertOk();

        $this->withTenant()
            ->getJson('/api/v1/pharmaco/inventory/locations')
            ->assertOk();

        $this->withTenant()
            ->getJson('/api/v1/pharmaco/suppliers')
            ->assertOk();

        $this->withTenant()
            ->getJson('/api/v1/pharmaco/purchase-orders')
            ->assertOk();

        $this->withTenant()
            ->postJson('/api/v1/pharmaco/products', [
                'name' => 'Unauthorized Product',
                'sku' => 'UNAUTHORIZED-PRODUCT',
                'unit' => 'unit',
                'product_type' => 'medicine',
            ])
            ->assertForbidden()
            ->assertJsonPath(
                'missing_permissions.0',
                'pharmaco.inventory.manage'
            );

        $branch = Branch::query()
            ->where('tenant_id', $this->tenant()->id)
            ->firstOrFail();

        $this->withTenant()
            ->postJson('/api/v1/pharmaco/inventory/locations', [
                'branch_id' => $branch->id,
                'code' => 'UNAUTHORIZED-LOCATION',
                'name' => 'Unauthorized Location',
                'location_type' => 'store',
            ])
            ->assertForbidden()
            ->assertJsonPath(
                'missing_permissions.0',
                'pharmaco.inventory.manage'
            );
    }

    public function test_procurement_view_does_not_grant_supplier_management(): void
    {
        $this->seed();

        $this->actAsTenantAdminWithPermissions([
            'pharmaco.procurement.view',
        ]);

        $this->withTenant()
            ->getJson('/api/v1/pharmaco/suppliers')
            ->assertOk();

        $this->withTenant()
            ->postJson('/api/v1/pharmaco/suppliers', [
                'name' => 'Unauthorized Supplier',
                'supplier_type' => 'wholesaler',
            ])
            ->assertForbidden()
            ->assertJsonPath(
                'missing_permissions.0',
                'pharmaco.procurement.suppliers.manage'
            );

        $this->assertDatabaseMissing('pharmaco_suppliers', [
            'name' => 'Unauthorized Supplier',
        ]);
    }

    public function test_purchase_order_creator_cannot_approve_purchase_order_without_approval_permission(): void
    {
        $this->seed();

        $tenant = $this->tenant();
        $branch = Branch::query()
            ->where('tenant_id', $tenant->id)
            ->where('status', 'active')
            ->firstOrFail();

        $supplier = $this->createSupplier();

        $product = Product::query()
            ->where('tenant_id', $tenant->id)
            ->where('status', 'active')
            ->firstOrFail();

        $this->actAsTenantAdminWithPermissions([
            'pharmaco.procurement.view',
            'pharmaco.procurement.purchase_order.create',
        ]);

        $createResponse = $this->withTenant()
            ->postJson('/api/v1/pharmaco/purchase-orders', [
                'branch_id' => $branch->id,
                'pharmaco_supplier_id' => $supplier->id,
                'items' => [
                    [
                        'product_id' => $product->id,
                        'quantity_ordered' => 5,
                        'unit_cost' => 1000,
                    ],
                ],
            ])
            ->assertCreated();

        $purchaseOrderId = $createResponse->json('purchase_order.id');

        $this->withTenant()
            ->postJson("/api/v1/pharmaco/purchase-orders/{$purchaseOrderId}/approve")
            ->assertForbidden()
            ->assertJsonPath(
                'missing_permissions.0',
                'pharmaco.procurement.purchase_order.approve'
            );

        $this->assertDatabaseHas('pharmaco_purchase_orders', [
            'id' => $purchaseOrderId,
            'status' => 'draft',
        ]);
    }

    public function test_invoice_management_does_not_grant_invoice_approval_or_payment_execution(): void
    {
        $this->seed();

        $draftInvoice = $this->createSupplierInvoice(status: 'draft');
        $approvedInvoice = $this->createSupplierInvoice(status: 'approved');

        $this->actAsTenantAdminWithPermissions([
            'pharmaco.procurement.view',
            'pharmaco.procurement.invoice.manage',
            'pharmaco.procurement.payment.view',
        ]);

        $this->withTenant()
            ->postJson(
                "/api/v1/pharmaco/supplier-invoices/{$draftInvoice->id}/approve"
            )
            ->assertForbidden()
            ->assertJsonPath(
                'missing_permissions.0',
                'pharmaco.procurement.invoice.approve'
            );

        $this->withTenant()
            ->postJson(
                "/api/v1/pharmaco/supplier-invoices/{$approvedInvoice->id}/payments",
                [
                    'amount' => 1000,
                    'payment_method' => 'bank_transfer',
                ]
            )
            ->assertForbidden()
            ->assertJsonPath(
                'missing_permissions.0',
                'pharmaco.procurement.payment.manage'
            );

        $this->assertDatabaseHas('pharmaco_supplier_invoices', [
            'id' => $draftInvoice->id,
            'status' => 'draft',
            'paid_amount' => 0,
        ]);

        $this->assertDatabaseHas('pharmaco_supplier_invoices', [
            'id' => $approvedInvoice->id,
            'status' => 'approved',
            'paid_amount' => 0,
        ]);
    }

    public function test_po_linked_receiving_requires_procurement_receiving_permission_but_manual_receiving_remains_available(): void
    {
        $this->seed();

        $tenant = $this->tenant();
        $branch = Branch::query()
            ->where('tenant_id', $tenant->id)
            ->where('status', 'active')
            ->firstOrFail();

        $product = Product::query()
            ->where('tenant_id', $tenant->id)
            ->where('status', 'active')
            ->firstOrFail();

        $location = StockLocation::query()
            ->where('tenant_id', $tenant->id)
            ->where('branch_id', $branch->id)
            ->firstOrFail();

        [$purchaseOrder, $purchaseOrderItem] = $this->createApprovedPurchaseOrderItem(
            $branch,
            $product,
        );

        $this->actAsTenantAdminWithPermissions([
            'pharmaco.product_inventory.receive',
        ]);

        $this->withTenant()
            ->postJson('/api/v1/pharmaco/inventory/receive', [
                'product_id' => $product->id,
                'stock_location_id' => $location->id,
                'batch_number' => 'MANUAL-' . Str::upper(Str::random(8)),
                'quantity' => 1,
                'unit_cost' => 1000,
                'reason' => 'Manual receiving remains controlled by inventory authority.',
            ])
            ->assertCreated();

        $this->withTenant()
            ->postJson('/api/v1/pharmaco/inventory/receive', [
                'product_id' => $product->id,
                'stock_location_id' => $location->id,
                'pharmaco_purchase_order_item_id' => $purchaseOrderItem->id,
                'batch_number' => 'PO-DENIED-' . Str::upper(Str::random(8)),
                'quantity' => 1,
                'unit_cost' => 1000,
            ])
            ->assertForbidden()
            ->assertJsonPath(
                'missing_permissions.0',
                'pharmaco.procurement.purchase_order.receive'
            );

        $purchaseOrderItem->refresh();
        $purchaseOrder->refresh();

        $this->assertSame(0.0, (float) $purchaseOrderItem->quantity_received);
        $this->assertSame('approved', $purchaseOrder->status);

        $this->actAsTenantAdminWithPermissions([
            'pharmaco.product_inventory.receive',
            'pharmaco.procurement.purchase_order.receive',
        ]);

        $this->withTenant()
            ->postJson('/api/v1/pharmaco/inventory/receive', [
                'product_id' => $product->id,
                'stock_location_id' => $location->id,
                'pharmaco_purchase_order_item_id' => $purchaseOrderItem->id,
                'batch_number' => 'PO-ALLOWED-' . Str::upper(Str::random(8)),
                'quantity' => 1,
                'unit_cost' => 1000,
            ])
            ->assertCreated();

        $purchaseOrderItem->refresh();

        $this->assertSame(1.0, (float) $purchaseOrderItem->quantity_received);
    }

    private function granularPermissionCodes(): array
    {
        return [
            'branches.view',
            'pharmaco.inventory.view',
            'pharmaco.product_master.view',
            'pharmaco.procurement.view',
            'pharmaco.procurement.suppliers.manage',
            'pharmaco.procurement.purchase_order.create',
            'pharmaco.procurement.purchase_order.approve',
            'pharmaco.procurement.purchase_order.receive',
            'pharmaco.procurement.invoice.manage',
            'pharmaco.procurement.invoice.approve',
            'pharmaco.procurement.payment.view',
            'pharmaco.procurement.payment.manage',
            'pharmaco.procurement.supplier_performance.view',
        ];
    }

    private function tenant(): Tenant
    {
        return Tenant::query()
            ->where('slug', self::TENANT_SLUG)
            ->firstOrFail();
    }

    private function tenantAdmin(): User
    {
        return User::query()
            ->where('email', 'admin@vitapharmaafrica.com')
            ->firstOrFail();
    }

    private function tenantAdminRole(): Role
    {
        return Role::query()
            ->where('code', 'tenant_admin')
            ->firstOrFail();
    }

    private function actAsTenantAdminWithPermissions(array $codes): void
    {
        $permissions = Permission::query()
            ->whereIn('code', $codes)
            ->get();

        $this->assertSame(
            count(array_unique($codes)),
            $permissions->count(),
            'One or more requested test permissions were not seeded.'
        );

        $this->tenantAdminRole()
            ->permissions()
            ->sync($permissions->pluck('id')->all());

        Sanctum::actingAs($this->tenantAdmin());
    }

    private function withTenant(): static
    {
        return $this->withHeader('X-Tenant-Slug', self::TENANT_SLUG);
    }

    private function createSupplier(): PharmacoSupplier
    {
        return PharmacoSupplier::query()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $this->tenant()->id,
            'supplier_code' => 'SUP-PERM-' . Str::upper(Str::random(6)),
            'name' => 'Permission Segregation Supplier',
            'supplier_type' => 'wholesaler',
            'status' => 'active',
        ]);
    }

    private function createSupplierInvoice(
        string $status
    ): PharmacoSupplierInvoice {
        $tenant = $this->tenant();

        $branch = Branch::query()
            ->where('tenant_id', $tenant->id)
            ->where('status', 'active')
            ->firstOrFail();

        $product = Product::query()
            ->where('tenant_id', $tenant->id)
            ->where('status', 'active')
            ->firstOrFail();

        [$purchaseOrder, $purchaseOrderItem] =
            $this->createApprovedPurchaseOrderItem(
                $branch,
                $product
            );

        $invoice = PharmacoSupplierInvoice::query()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $tenant->id,
            'pharmaco_supplier_id' =>
                $purchaseOrder->pharmaco_supplier_id,
            'pharmaco_purchase_order_id' =>
                $purchaseOrder->id,
            'invoice_number' =>
                'SIN-PERM-' . Str::upper(Str::random(6)),
            'status' => $status,
            'invoice_date' => now()->toDateString(),
            'subtotal_amount' => 1000,
            'discount_amount' => 0,
            'tax_amount' => 0,
            'total_amount' => 1000,
            'paid_amount' => 0,
            'balance_amount' => 1000,
        ]);

        $invoice->items()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $tenant->id,
            'pharmaco_purchase_order_item_id' =>
                $purchaseOrderItem->id,
            'product_id' => $purchaseOrderItem->product_id,
            'product_name_snapshot' =>
                $purchaseOrderItem->product_name_snapshot,
            'sku_snapshot' =>
                $purchaseOrderItem->sku_snapshot,
            'quantity' => 1,
            'unit_cost' => 1000,
            'discount_amount' => 0,
            'tax_amount' => 0,
            'line_total' => 1000,
        ]);

        return $invoice;
    }

    private function createApprovedPurchaseOrderItem(
        Branch $branch,
        Product $product
    ): array {
        $supplier = $this->createSupplier();

        $purchaseOrder = PharmacoPurchaseOrder::query()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $this->tenant()->id,
            'branch_id' => $branch->id,
            'pharmaco_supplier_id' => $supplier->id,
            'po_number' => 'PO-PERM-' . Str::upper(Str::random(6)),
            'status' => 'approved',
            'order_date' => now()->toDateString(),
            'subtotal_amount' => 5000,
            'discount_amount' => 0,
            'tax_amount' => 0,
            'shipping_amount' => 0,
            'total_amount' => 5000,
            'approved_at' => now(),
        ]);

        $purchaseOrderItem = PharmacoPurchaseOrderItem::query()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $this->tenant()->id,
            'pharmaco_purchase_order_id' => $purchaseOrder->id,
            'product_id' => $product->id,
            'product_name_snapshot' => $product->name,
            'sku_snapshot' => $product->sku,
            'quantity_ordered' => 5,
            'quantity_received' => 0,
            'unit_cost' => 1000,
            'discount_amount' => 0,
            'tax_amount' => 0,
            'line_total' => 5000,
            'status' => 'pending',
        ]);

        return [$purchaseOrder, $purchaseOrderItem];
    }
}
