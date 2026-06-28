<?php

namespace Database\Seeders;

use App\Models\Branch;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\StockBatch;
use App\Models\StockLocation;
use App\Models\StockMovement;
use App\Models\Tenant;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class PharmacoProductInventorySeeder extends Seeder
{
    public function run(): void
    {
        $tenant = Tenant::where('slug', 'vitapharma')->firstOrFail();
        $branch = Branch::where('tenant_id', $tenant->id)->where('code', 'HQ')->firstOrFail();

        $categories = [
            ['name' => 'Antibiotics', 'code' => 'ANTIBIOTICS', 'description' => 'Antibacterial medicines.'],
            ['name' => 'Analgesics', 'code' => 'ANALGESICS', 'description' => 'Pain and fever medicines.'],
            ['name' => 'Hypertension', 'code' => 'HYPERTENSION', 'description' => 'Cardiovascular and blood pressure medicines.'],
            ['name' => 'Diabetes', 'code' => 'DIABETES', 'description' => 'Diabetes and metabolic care medicines.'],
            ['name' => 'Consumables', 'code' => 'CONSUMABLES', 'description' => 'Medical consumables and pharmacy supplies.'],
        ];

        foreach ($categories as $category) {
            ProductCategory::updateOrCreate(
                ['tenant_id' => $tenant->id, 'code' => $category['code']],
                [
                    'uuid' => (string) Str::uuid(),
                    'name' => $category['name'],
                    'category_type' => 'medicine',
                    'status' => 'active',
                    'description' => $category['description'],
                    'metadata' => ['seeded_for' => 'phase_3_1'],
                ]
            );
        }

        $categoryByCode = ProductCategory::where('tenant_id', $tenant->id)
            ->get()
            ->keyBy('code');

        $products = [
            [
                'category' => 'ANTIBIOTICS',
                'name' => 'Amoxicillin 500mg Capsules',
                'generic_name' => 'Amoxicillin',
                'sku' => 'AMOX-500-CAP',
                'dosage_form' => 'capsule',
                'strength' => '500mg',
                'unit' => 'capsule',
                'pack_size' => '10 capsules',
                'requires_prescription' => true,
                'reorder_level' => 100,
                'minimum_stock_level' => 50,
            ],
            [
                'category' => 'ANALGESICS',
                'name' => 'Paracetamol 500mg Tablets',
                'generic_name' => 'Paracetamol',
                'sku' => 'PARA-500-TAB',
                'dosage_form' => 'tablet',
                'strength' => '500mg',
                'unit' => 'tablet',
                'pack_size' => '100 tablets',
                'requires_prescription' => false,
                'reorder_level' => 200,
                'minimum_stock_level' => 100,
            ],
            [
                'category' => 'HYPERTENSION',
                'name' => 'Amlodipine 5mg Tablets',
                'generic_name' => 'Amlodipine',
                'sku' => 'AMLO-5-TAB',
                'dosage_form' => 'tablet',
                'strength' => '5mg',
                'unit' => 'tablet',
                'pack_size' => '30 tablets',
                'requires_prescription' => true,
                'reorder_level' => 120,
                'minimum_stock_level' => 60,
            ],
            [
                'category' => 'DIABETES',
                'name' => 'Metformin 500mg Tablets',
                'generic_name' => 'Metformin',
                'sku' => 'MET-500-TAB',
                'dosage_form' => 'tablet',
                'strength' => '500mg',
                'unit' => 'tablet',
                'pack_size' => '30 tablets',
                'requires_prescription' => true,
                'reorder_level' => 120,
                'minimum_stock_level' => 60,
            ],
            [
                'category' => 'CONSUMABLES',
                'name' => 'Blood Glucose Test Strips',
                'generic_name' => 'Glucose test strips',
                'sku' => 'GLUCOSE-STRIPS',
                'dosage_form' => null,
                'strength' => null,
                'unit' => 'strip',
                'pack_size' => '50 strips',
                'requires_prescription' => false,
                'reorder_level' => 50,
                'minimum_stock_level' => 25,
            ],
        ];

        foreach ($products as $item) {
            Product::updateOrCreate(
                ['tenant_id' => $tenant->id, 'sku' => $item['sku']],
                [
                    'uuid' => (string) Str::uuid(),
                    'product_category_id' => $categoryByCode[$item['category']]->id,
                    'name' => $item['name'],
                    'generic_name' => $item['generic_name'],
                    'brand_name' => null,
                    'barcode' => null,
                    'registration_number' => null,
                    'dosage_form' => $item['dosage_form'],
                    'strength' => $item['strength'],
                    'unit' => $item['unit'],
                    'pack_size' => $item['pack_size'],
                    'route_of_administration' => 'oral',
                    'product_type' => $item['category'] === 'CONSUMABLES' ? 'consumable' : 'medicine',
                    'regulatory_status' => 'approved',
                    'requires_prescription' => $item['requires_prescription'],
                    'is_controlled' => false,
                    'reorder_level' => $item['reorder_level'],
                    'minimum_stock_level' => $item['minimum_stock_level'],
                    'maximum_stock_level' => null,
                    'status' => 'active',
                    'metadata' => ['seeded_for' => 'phase_3_1'],
                ]
            );
        }

        $store = StockLocation::updateOrCreate(
            ['branch_id' => $branch->id, 'code' => 'HQ-STORE'],
            [
                'uuid' => (string) Str::uuid(),
                'tenant_id' => $tenant->id,
                'name' => 'HQ Main Store',
                'location_type' => 'main_store',
                'status' => 'active',
                'metadata' => ['seeded_for' => 'phase_3_1'],
            ]
        );

        $dispensary = StockLocation::updateOrCreate(
            ['branch_id' => $branch->id, 'code' => 'HQ-DISPENSARY'],
            [
                'uuid' => (string) Str::uuid(),
                'tenant_id' => $tenant->id,
                'name' => 'HQ Dispensary Shelf',
                'location_type' => 'dispensary',
                'status' => 'active',
                'metadata' => ['seeded_for' => 'phase_3_1'],
            ]
        );

        $batchPlans = [
            ['sku' => 'AMOX-500-CAP', 'location' => $store, 'batch' => 'AMOX-B001', 'quantity' => 250, 'expiry' => '2027-12-31', 'cost' => 80, 'price' => 120],
            ['sku' => 'PARA-500-TAB', 'location' => $dispensary, 'batch' => 'PARA-B001', 'quantity' => 500, 'expiry' => '2028-06-30', 'cost' => 15, 'price' => 25],
            ['sku' => 'AMLO-5-TAB', 'location' => $store, 'batch' => 'AMLO-B001', 'quantity' => 180, 'expiry' => '2027-09-30', 'cost' => 50, 'price' => 90],
            ['sku' => 'MET-500-TAB', 'location' => $store, 'batch' => 'MET-B001', 'quantity' => 220, 'expiry' => '2027-10-31', 'cost' => 45, 'price' => 85],
            ['sku' => 'GLUCOSE-STRIPS', 'location' => $dispensary, 'batch' => 'GLU-B001', 'quantity' => 75, 'expiry' => '2027-08-31', 'cost' => 300, 'price' => 450],
        ];

        foreach ($batchPlans as $plan) {
            $product = Product::where('tenant_id', $tenant->id)->where('sku', $plan['sku'])->firstOrFail();
            $location = $plan['location'];

            $batch = StockBatch::updateOrCreate(
                [
                    'product_id' => $product->id,
                    'stock_location_id' => $location->id,
                    'batch_number' => $plan['batch'],
                ],
                [
                    'uuid' => (string) Str::uuid(),
                    'tenant_id' => $tenant->id,
                    'branch_id' => $branch->id,
                    'expiry_date' => $plan['expiry'],
                    'received_at' => now()->toDateString(),
                    'quantity_on_hand' => $plan['quantity'],
                    'quantity_reserved' => 0,
                    'unit_cost' => $plan['cost'],
                    'selling_price' => $plan['price'],
                    'supplier_name' => 'VitaPharma Opening Stock',
                    'status' => 'active',
                    'metadata' => ['seeded_for' => 'phase_3_1'],
                ]
            );

            StockMovement::updateOrCreate(
                [
                    'product_id' => $product->id,
                    'stock_batch_id' => $batch->id,
                    'movement_type' => 'opening_balance',
                    'reference_number' => 'PHASE-3-OPENING-' . $plan['sku'],
                ],
                [
                    'uuid' => (string) Str::uuid(),
                    'tenant_id' => $tenant->id,
                    'branch_id' => $branch->id,
                    'stock_location_id' => $location->id,
                    'quantity' => $plan['quantity'],
                    'running_balance' => $plan['quantity'],
                    'reference_type' => 'system_seed',
                    'reason' => 'Opening stock balance for Phase 3 product inventory foundation.',
                    'performed_by' => null,
                    'occurred_at' => now(),
                    'metadata' => ['seeded_for' => 'phase_3_1'],
                ]
            );
        }
    }
}
