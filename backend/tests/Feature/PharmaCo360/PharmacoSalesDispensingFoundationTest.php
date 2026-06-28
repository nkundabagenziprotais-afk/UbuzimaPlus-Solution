<?php

namespace Tests\Feature\PharmaCo360;

use App\Models\PharmacoCustomer;
use App\Models\PharmacoPrescription;
use App\Models\PharmacoSale;
use App\Models\PharmacoSaleItem;
use App\Models\StockMovement;
use App\Models\Tenant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PharmacoSalesDispensingFoundationTest extends TestCase
{
    use RefreshDatabase;

    public function test_vitapharma_customer_prescription_and_draft_sale_are_seeded(): void
    {
        $this->seed();

        $tenant = Tenant::where('slug', 'vitapharma')->firstOrFail();

        $this->assertDatabaseHas('pharmaco_customers', [
            'tenant_id' => $tenant->id,
            'phone' => '+250780000001',
            'status' => 'active',
        ]);

        $this->assertDatabaseHas('pharmaco_prescriptions', [
            'tenant_id' => $tenant->id,
            'prescription_number' => 'RX-VITA-0001',
            'status' => 'active',
        ]);

        $this->assertDatabaseHas('pharmaco_sales', [
            'tenant_id' => $tenant->id,
            'sale_number' => 'SALE-VITA-DRAFT-0001',
            'status' => 'draft',
            'payment_status' => 'unpaid',
        ]);
    }

    public function test_seeded_draft_sale_has_items_and_no_stock_deduction(): void
    {
        $this->seed();

        $sale = PharmacoSale::with(['items.product'])->where('sale_number', 'SALE-VITA-DRAFT-0001')->firstOrFail();

        $this->assertCount(2, $sale->items);
        $this->assertSame('draft', $sale->status);
        $this->assertSame(2200.0, (float) $sale->total_amount);
        $this->assertSame(2200.0, (float) $sale->balance_amount);

        $sale->items->each(function (PharmacoSaleItem $item): void {
            $this->assertSame('pending', $item->status);
            $this->assertFalse((bool) ($item->metadata['stock_deducted'] ?? true));
            $this->assertNotNull($item->product_name_snapshot);
            $this->assertNotNull($item->sku_snapshot);
        });

        $this->assertDatabaseMissing('stock_movements', [
            'reference_number' => 'SALE-VITA-DRAFT-0001',
        ]);

        $this->assertSame(0, StockMovement::where('movement_type', 'sale_dispensed')->count());
    }

    public function test_prescription_sale_links_customer_prescription_branch_and_items(): void
    {
        $this->seed();

        $sale = PharmacoSale::with(['customer', 'prescription', 'branch', 'items'])->where('sale_number', 'SALE-VITA-DRAFT-0001')->firstOrFail();

        $this->assertNotNull($sale->customer);
        $this->assertNotNull($sale->prescription);
        $this->assertNotNull($sale->branch);
        $this->assertCount(2, $sale->items);

        $this->assertSame('Jean', $sale->customer->first_name);
        $this->assertSame('RX-VITA-0001', $sale->prescription->prescription_number);
        $this->assertSame('prescription_sale', $sale->sale_type);
    }

    public function test_sales_records_are_tenant_scoped(): void
    {
        $this->seed();

        $tenant = Tenant::where('slug', 'vitapharma')->firstOrFail();

        $customer = PharmacoCustomer::where('tenant_id', $tenant->id)->firstOrFail();
        $prescription = PharmacoPrescription::where('tenant_id', $tenant->id)->firstOrFail();
        $sale = PharmacoSale::where('tenant_id', $tenant->id)->firstOrFail();

        $this->assertSame($tenant->id, $customer->tenant_id);
        $this->assertSame($tenant->id, $prescription->tenant_id);
        $this->assertSame($tenant->id, $sale->tenant_id);

        PharmacoSaleItem::where('pharmaco_sale_id', $sale->id)->get()->each(function (PharmacoSaleItem $item) use ($tenant): void {
            $this->assertSame($tenant->id, $item->tenant_id);
        });
    }
}
