<?php

namespace Database\Seeders;

use App\Models\Branch;
use App\Models\PharmacoCustomer;
use App\Models\PharmacoPrescription;
use App\Models\PharmacoSale;
use App\Models\PharmacoSaleItem;
use App\Models\Product;
use App\Models\Tenant;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class PharmacoSalesDispensingSeeder extends Seeder
{
    public function run(): void
    {
        $tenant = Tenant::where('slug', 'vitapharma')->firstOrFail();
        $branch = Branch::where('tenant_id', $tenant->id)
            ->where('status', 'active')
            ->orderBy('id')
            ->firstOrFail();

        $customer = PharmacoCustomer::firstOrCreate(
            [
                'tenant_id' => $tenant->id,
                'phone' => '+250780000001',
            ],
            [
                'uuid' => (string) Str::uuid(),
                'first_name' => 'Jean',
                'last_name' => 'Uwimana',
                'email' => 'jean.uwimana@example.local',
                'date_of_birth' => '1988-04-12',
                'gender' => 'male',
                'customer_type' => 'patient',
                'insurance_provider' => 'RSSB',
                'insurance_membership_number' => 'RSSB-DEMO-001',
                'status' => 'active',
                'metadata' => [
                    'seeded_for' => 'pharmaco_sales_dispensing_foundation',
                ],
            ]
        );

        $prescription = PharmacoPrescription::firstOrCreate(
            [
                'tenant_id' => $tenant->id,
                'prescription_number' => 'RX-VITA-0001',
            ],
            [
                'uuid' => (string) Str::uuid(),
                'pharmaco_customer_id' => $customer->id,
                'prescriber_name' => 'Dr. Demo Prescriber',
                'prescriber_facility' => 'Vita Demo Clinic',
                'prescriber_phone' => '+250780000002',
                'issued_at' => now()->subDay()->toDateString(),
                'expires_at' => now()->addDays(14)->toDateString(),
                'status' => 'active',
                'notes' => 'Seed prescription for controlled dispensing foundation.',
                'metadata' => [
                    'seeded_for' => 'pharmaco_sales_dispensing_foundation',
                ],
            ]
        );

        $paracetamol = Product::where('tenant_id', $tenant->id)->where('sku', 'PARA-500-TAB')->firstOrFail();
        $amoxicillin = Product::where('tenant_id', $tenant->id)->where('sku', 'AMOX-500-CAP')->firstOrFail();

        $sale = PharmacoSale::firstOrCreate(
            [
                'tenant_id' => $tenant->id,
                'sale_number' => 'SALE-VITA-DRAFT-0001',
            ],
            [
                'uuid' => (string) Str::uuid(),
                'branch_id' => $branch->id,
                'pharmaco_customer_id' => $customer->id,
                'pharmaco_prescription_id' => $prescription->id,
                'sale_type' => 'prescription_sale',
                'status' => 'draft',
                'subtotal_amount' => 2200,
                'discount_amount' => 0,
                'tax_amount' => 0,
                'total_amount' => 2200,
                'paid_amount' => 0,
                'balance_amount' => 2200,
                'payment_status' => 'unpaid',
                'notes' => 'Seed draft sale. No stock deduction is performed in Phase 4.1.',
                'metadata' => [
                    'seeded_for' => 'pharmaco_sales_dispensing_foundation',
                    'stock_deducted' => false,
                ],
            ]
        );

        $this->seedSaleItem(
            sale: $sale,
            product: $paracetamol,
            quantity: 2,
            unitPrice: 500,
            prescriptionVerified: false
        );

        $this->seedSaleItem(
            sale: $sale,
            product: $amoxicillin,
            quantity: 1,
            unitPrice: 1200,
            prescriptionVerified: true
        );
    }

    private function seedSaleItem(
        PharmacoSale $sale,
        Product $product,
        float $quantity,
        float $unitPrice,
        bool $prescriptionVerified
    ): void {
        PharmacoSaleItem::firstOrCreate(
            [
                'tenant_id' => $sale->tenant_id,
                'pharmaco_sale_id' => $sale->id,
                'product_id' => $product->id,
            ],
            [
                'uuid' => (string) Str::uuid(),
                'product_name_snapshot' => $product->name,
                'sku_snapshot' => $product->sku,
                'quantity' => $quantity,
                'unit_price' => $unitPrice,
                'discount_amount' => 0,
                'tax_amount' => 0,
                'line_total' => $quantity * $unitPrice,
                'requires_prescription' => (bool) $product->requires_prescription,
                'prescription_verified' => $prescriptionVerified,
                'status' => 'pending',
                'metadata' => [
                    'stock_deducted' => false,
                    'seeded_for' => 'pharmaco_sales_dispensing_foundation',
                ],
            ]
        );
    }
}
