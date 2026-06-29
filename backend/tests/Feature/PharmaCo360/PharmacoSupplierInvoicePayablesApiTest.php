<?php

namespace Tests\Feature\PharmaCo360;

use App\Models\Branch;
use App\Models\PharmacoPurchaseOrder;
use App\Models\PharmacoPurchaseOrderItem;
use App\Models\PharmacoSupplier;
use App\Models\PharmacoSupplierInvoice;
use App\Models\Product;
use App\Models\Solution;
use App\Models\Tenant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class PharmacoSupplierInvoicePayablesApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_tenant_admin_can_create_supplier_invoice_from_purchase_order(): void
    {
        $this->seed();

        $token = $this->loginAs('admin@vitapharmaafrica.com');
        [$purchaseOrder, $purchaseOrderItem] = $this->createApprovedPurchaseOrder();

        $response = $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->postJson('/api/v1/pharmaco/supplier-invoices', [
                'pharmaco_supplier_id' => $purchaseOrder->pharmaco_supplier_id,
                'pharmaco_purchase_order_id' => $purchaseOrder->id,
                'supplier_invoice_number' => 'SUP-INV-001',
                'items' => [
                    [
                        'pharmaco_purchase_order_item_id' => $purchaseOrderItem->id,
                        'quantity' => 2,
                        'unit_cost' => 1000,
                    ],
                ],
            ])
            ->assertCreated()
            ->assertJsonPath('message', 'Supplier invoice created successfully.')
            ->assertJsonPath('supplier_invoice.status', 'draft')
            ->assertJsonPath('supplier_invoice.total_amount', 2000);

        $invoiceId = $response->json('supplier_invoice.id');

        $this->assertDatabaseHas('pharmaco_supplier_invoices', [
            'id' => $invoiceId,
            'tenant_id' => $this->tenant()->id,
            'pharmaco_purchase_order_id' => $purchaseOrder->id,
            'total_amount' => 2000,
            'balance_amount' => 2000,
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'pharmaco.supplier_invoice.created',
            'auditable_type' => PharmacoSupplierInvoice::class,
            'auditable_id' => $invoiceId,
        ]);
    }

    public function test_purchase_order_supplier_must_match_invoice_supplier(): void
    {
        $this->seed();

        $token = $this->loginAs('admin@vitapharmaafrica.com');
        [$purchaseOrder, $purchaseOrderItem] = $this->createApprovedPurchaseOrder();
        $otherSupplier = $this->createSupplier();

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->postJson('/api/v1/pharmaco/supplier-invoices', [
                'pharmaco_supplier_id' => $otherSupplier->id,
                'pharmaco_purchase_order_id' => $purchaseOrder->id,
                'items' => [
                    [
                        'pharmaco_purchase_order_item_id' => $purchaseOrderItem->id,
                        'quantity' => 1,
                        'unit_cost' => 1000,
                    ],
                ],
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('pharmaco_purchase_order_id');
    }

    public function test_only_approved_or_received_purchase_orders_can_be_invoiced(): void
    {
        $this->seed();

        $token = $this->loginAs('admin@vitapharmaafrica.com');
        [$purchaseOrder, $purchaseOrderItem] = $this->createApprovedPurchaseOrder();
        $purchaseOrder->update(['status' => 'draft']);

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->postJson('/api/v1/pharmaco/supplier-invoices', [
                'pharmaco_supplier_id' => $purchaseOrder->pharmaco_supplier_id,
                'pharmaco_purchase_order_id' => $purchaseOrder->id,
                'items' => [
                    [
                        'pharmaco_purchase_order_item_id' => $purchaseOrderItem->id,
                        'quantity' => 1,
                        'unit_cost' => 1000,
                    ],
                ],
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('pharmaco_purchase_order_id');
    }

    public function test_tenant_admin_can_approve_supplier_invoice(): void
    {
        $this->seed();

        $token = $this->loginAs('admin@vitapharmaafrica.com');
        $invoice = $this->createSupplierInvoice();

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->postJson("/api/v1/pharmaco/supplier-invoices/{$invoice->id}/approve")
            ->assertOk()
            ->assertJsonPath('message', 'Supplier invoice approved successfully.')
            ->assertJsonPath('supplier_invoice.status', 'approved');

        $invoice->refresh();

        $this->assertSame('approved', $invoice->status);
        $this->assertNotNull($invoice->approved_at);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'pharmaco.supplier_invoice.approved',
            'auditable_type' => PharmacoSupplierInvoice::class,
            'auditable_id' => $invoice->id,
        ]);
    }

    public function test_supplier_payment_updates_invoice_balance_and_status(): void
    {
        $this->seed();

        $token = $this->loginAs('admin@vitapharmaafrica.com');
        $invoice = $this->createSupplierInvoice(status: 'approved', total: 3000);

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->postJson("/api/v1/pharmaco/supplier-invoices/{$invoice->id}/payments", [
                'amount' => 1000,
                'payment_method' => 'bank_transfer',
                'reference_number' => 'BANK-001',
            ])
            ->assertCreated()
            ->assertJsonPath('message', 'Supplier payment recorded successfully.')
            ->assertJsonPath('supplier_invoice.status', 'partially_paid')
            ->assertJsonPath('supplier_invoice.paid_amount', 1000)
            ->assertJsonPath('supplier_invoice.balance_amount', 2000);

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->postJson("/api/v1/pharmaco/supplier-invoices/{$invoice->id}/payments", [
                'amount' => 2000,
                'payment_method' => 'bank_transfer',
                'reference_number' => 'BANK-002',
            ])
            ->assertCreated()
            ->assertJsonPath('supplier_invoice.status', 'paid')
            ->assertJsonPath('supplier_invoice.balance_amount', 0);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'pharmaco.supplier_payment.recorded',
        ]);
    }

    public function test_supplier_payment_cannot_exceed_invoice_balance(): void
    {
        $this->seed();

        $token = $this->loginAs('admin@vitapharmaafrica.com');
        $invoice = $this->createSupplierInvoice(status: 'approved', total: 1000);

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->postJson("/api/v1/pharmaco/supplier-invoices/{$invoice->id}/payments", [
                'amount' => 1200,
                'payment_method' => 'bank_transfer',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('amount');

        $invoice->refresh();

        $this->assertSame(0.0, (float) $invoice->paid_amount);
        $this->assertSame(1000.0, (float) $invoice->balance_amount);
    }

    public function test_supplier_payment_requires_approved_invoice(): void
    {
        $this->seed();

        $token = $this->loginAs('admin@vitapharmaafrica.com');
        $invoice = $this->createSupplierInvoice(status: 'draft', total: 1000);

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->postJson("/api/v1/pharmaco/supplier-invoices/{$invoice->id}/payments", [
                'amount' => 500,
                'payment_method' => 'bank_transfer',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('status');
    }

    public function test_tenant_admin_cannot_access_supplier_invoice_outside_current_tenant(): void
    {
        $this->seed();

        $token = $this->loginAs('admin@vitapharmaafrica.com');
        $otherInvoice = $this->createOtherTenantSupplierInvoice();

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->getJson("/api/v1/pharmaco/supplier-invoices/{$otherInvoice->id}")
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
            'device_name' => 'PharmaCo360 Supplier Invoice Test Client',
        ]);

        $response->assertOk();

        return $response->json('access_token');
    }

    private function createSupplier(): PharmacoSupplier
    {
        return PharmacoSupplier::query()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $this->tenant()->id,
            'supplier_code' => 'SUP-INV-' . Str::upper(Str::random(5)),
            'name' => 'Invoice Supplier',
            'supplier_type' => 'wholesaler',
            'status' => 'active',
        ]);
    }

    private function createApprovedPurchaseOrder(): array
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
            'po_number' => 'PO-INV-' . Str::upper(Str::random(6)),
            'status' => 'approved',
            'order_date' => now()->toDateString(),
            'subtotal_amount' => 2000,
            'discount_amount' => 0,
            'tax_amount' => 0,
            'shipping_amount' => 0,
            'total_amount' => 2000,
        ]);

        $purchaseOrderItem = PharmacoPurchaseOrderItem::query()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $tenant->id,
            'pharmaco_purchase_order_id' => $purchaseOrder->id,
            'product_id' => $product->id,
            'product_name_snapshot' => $product->name,
            'sku_snapshot' => $product->sku,
            'quantity_ordered' => 2,
            'quantity_received' => 0,
            'unit_cost' => 1000,
            'discount_amount' => 0,
            'tax_amount' => 0,
            'line_total' => 2000,
            'status' => 'pending',
        ]);

        return [$purchaseOrder, $purchaseOrderItem];
    }

    private function createSupplierInvoice(string $status = 'draft', float $total = 2000): PharmacoSupplierInvoice
    {
        [$purchaseOrder, $purchaseOrderItem] = $this->createApprovedPurchaseOrder();

        $invoice = PharmacoSupplierInvoice::query()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $this->tenant()->id,
            'pharmaco_supplier_id' => $purchaseOrder->pharmaco_supplier_id,
            'pharmaco_purchase_order_id' => $purchaseOrder->id,
            'invoice_number' => 'SIN-TEST-' . Str::upper(Str::random(6)),
            'status' => $status,
            'invoice_date' => now()->toDateString(),
            'subtotal_amount' => $total,
            'discount_amount' => 0,
            'tax_amount' => 0,
            'total_amount' => $total,
            'paid_amount' => 0,
            'balance_amount' => $total,
        ]);

        $invoice->items()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $this->tenant()->id,
            'pharmaco_purchase_order_item_id' => $purchaseOrderItem->id,
            'product_id' => $purchaseOrderItem->product_id,
            'product_name_snapshot' => $purchaseOrderItem->product_name_snapshot,
            'sku_snapshot' => $purchaseOrderItem->sku_snapshot,
            'quantity' => $total / 1000,
            'unit_cost' => 1000,
            'discount_amount' => 0,
            'tax_amount' => 0,
            'line_total' => $total,
        ]);

        return $invoice;
    }

    private function createOtherTenantSupplierInvoice(): PharmacoSupplierInvoice
    {
        $solution = Solution::where('code', 'pharmaco360')->firstOrFail();

        $tenant = Tenant::query()->create([
            'uuid' => (string) Str::uuid(),
            'name' => 'Other Invoice Pharmacy',
            'slug' => 'other-invoice-pharmacy-' . Str::lower(Str::random(6)),
            'legal_name' => 'Other Invoice Pharmacy Ltd',
            'primary_solution_id' => $solution->id,
            'tenant_type' => 'pharmacy',
            'status' => 'active',
        ]);

        $supplier = PharmacoSupplier::query()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $tenant->id,
            'supplier_code' => 'OTHER-SINV-' . Str::upper(Str::random(5)),
            'name' => 'Other Invoice Supplier',
            'supplier_type' => 'wholesaler',
            'status' => 'active',
        ]);

        return PharmacoSupplierInvoice::query()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $tenant->id,
            'pharmaco_supplier_id' => $supplier->id,
            'invoice_number' => 'OTHER-SIN-' . Str::upper(Str::random(6)),
            'status' => 'draft',
            'invoice_date' => now()->toDateString(),
            'subtotal_amount' => 1000,
            'discount_amount' => 0,
            'tax_amount' => 0,
            'total_amount' => 1000,
            'paid_amount' => 0,
            'balance_amount' => 1000,
        ]);
    }
}
