<?php

namespace Tests\Feature\PharmaCo360;

use App\Models\Branch;
use App\Models\PharmacoPurchaseOrder;
use App\Models\PharmacoPurchaseOrderItem;
use App\Models\PharmacoSupplier;
use App\Models\Product;
use App\Models\StockLocation;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PharmacoPurchaseTypeApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_existing_purchase_payload_defaults_to_core_products(): void
    {
        $this->seed();

        $this->authenticateTenantAdministrator();

        [
            $tenant,
            $branch,
            $supplier,
            $product,
        ] = $this->procurementContext();

        $response = $this
            ->withHeader(
                'X-Tenant-Slug',
                $tenant->slug
            )
            ->postJson(
                '/api/v1/pharmaco/purchase-orders',
                [
                    'branch_id' => $branch->id,
                    'pharmaco_supplier_id' =>
                        $supplier->id,
                    'items' => [
                        [
                            'product_id' =>
                                $product->id,
                            'quantity_ordered' => 3,
                            'unit_cost' => 1200,
                        ],
                    ],
                ]
            );

        $response
            ->assertCreated()
            ->assertJsonPath(
                'message',
                'Purchase order created successfully.'
            )
            ->assertJsonPath(
                'purchase_order.purchase_type',
                'core_products'
            )
            ->assertJsonPath(
                'purchase_order.items.0.item_type',
                'core_product'
            )
            ->assertJsonPath(
                'purchase_order.items.0.product.id',
                $product->id
            );

        $this->assertDatabaseHas(
            'pharmaco_purchase_orders',
            [
                'id' => $response->json(
                    'purchase_order.id'
                ),
                'purchase_type' =>
                    'core_products',
            ]
        );
    }

    public function test_general_items_purchase_uses_separate_line_table(): void
    {
        $this->seed();

        $this->authenticateTenantAdministrator();

        [
            $tenant,
            $branch,
            $supplier,
            $product,
        ] = $this->procurementContext();

        $category =
            \App\Models\PharmacoGeneralItemCategory::query()
                ->create([
                    'uuid' =>
                        (string)
                        \Illuminate\Support\Str::uuid(),
                    'tenant_id' => $tenant->id,
                    'name' =>
                        'Hygiene and Sanitation',
                    'code' =>
                        'HYG-' .
                        \Illuminate\Support\Str::upper(
                            \Illuminate\Support\Str::random(6)
                        ),
                    'status' => 'active',
                    'description' =>
                        'General Items Purchase Type test category.',
                    'metadata' => [
                        'test_fixture' => true,
                        'fixture_scope' =>
                            'pharmaco_purchase_type',
                    ],
                ]);

        $generalItem =
            \App\Models\PharmacoGeneralItem::query()
                ->create([
                    'uuid' =>
                        (string)
                        \Illuminate\Support\Str::uuid(),
                    'tenant_id' => $tenant->id,
                    'pharmaco_general_item_category_id' =>
                        $category->id,
                    'preferred_supplier_id' =>
                        $supplier->id,
                    'name' =>
                        'Hand-Washing Detergent',
                    'code' =>
                        'GEN-DET-' .
                        \Illuminate\Support\Str::upper(
                            \Illuminate\Support\Str::random(6)
                        ),
                    'unit_of_measure' =>
                        'bottle',
                    'reorder_level' => 4,
                    'minimum_stock_level' => 2,
                    'track_stock' => true,
                    'status' => 'active',
                    'description' =>
                        'Master-backed General Item Purchase Type fixture.',
                    'metadata' => [
                        'test_fixture' => true,
                        'fixture_scope' =>
                            'pharmaco_purchase_type',
                    ],
                ]);

        $response = $this
            ->withHeader(
                'X-Tenant-Slug',
                $tenant->slug
            )
            ->postJson(
                '/api/v1/pharmaco/purchase-orders',
                [
                    'purchase_type' =>
                        'general_items',
                    'branch_id' =>
                        $branch->id,
                    'pharmaco_supplier_id' =>
                        $supplier->id,
                    'general_items' => [
                        [
                            'general_item_id' =>
                                $generalItem->id,
                            'quantity_ordered' => 12,
                            'unit_cost' => 2500,
                            'discount_amount' => 500,
                            'tax_amount' => 0,
                            'notes' =>
                                'General Item Master-backed test line.',
                        ],
                    ],
                ]
            );

        $response
            ->assertCreated()
            ->assertJsonPath(
                'message',
                'General Items purchase order created successfully.'
            )
            ->assertJsonPath(
                'purchase_order.purchase_type',
                'general_items'
            )
            ->assertJsonPath(
                'purchase_order.items.0.item_type',
                'general_item'
            )
            ->assertJsonPath(
                'purchase_order.items.0.general_item.id',
                $generalItem->id
            )
            ->assertJsonPath(
                'purchase_order.items.0.item_name',
                $generalItem->name
            )
            ->assertJsonPath(
                'purchase_order.items.0.item_code',
                $generalItem->code
            )
            ->assertJsonPath(
                'purchase_order.items.0.category',
                $category->name
            )
            ->assertJsonPath(
                'purchase_order.items.0.unit_of_measure',
                $generalItem->unit_of_measure
            );

        $purchaseOrderId = $response->json(
            'purchase_order.id'
        );

        $this->assertDatabaseHas(
            'pharmaco_purchase_orders',
            [
                'id' => $purchaseOrderId,
                'tenant_id' => $tenant->id,
                'purchase_type' =>
                    'general_items',
            ]
        );

        $this->assertDatabaseHas(
            'pharmaco_general_purchase_order_items',
            [
                'pharmaco_purchase_order_id' =>
                    $purchaseOrderId,
                'tenant_id' => $tenant->id,
                'pharmaco_general_item_id' =>
                    $generalItem->id,
                'item_name' =>
                    $generalItem->name,
                'item_code' =>
                    $generalItem->code,
                'category' =>
                    $category->name,
                'unit_of_measure' =>
                    $generalItem->unit_of_measure,
                'quantity_ordered' => 12,
                'unit_cost' => 2500,
            ]
        );

        $this->assertDatabaseMissing(
            'pharmaco_purchase_order_items',
            [
                'pharmaco_purchase_order_id' =>
                    $purchaseOrderId,
            ]
        );
    }

    public function test_core_purchase_rejects_missing_product_master_item(): void
    {
        $this->seed();

        $this->authenticateTenantAdministrator();

        [
            $tenant,
            $branch,
            $supplier,
        ] = $this->procurementContext();

        $this
            ->withHeader(
                'X-Tenant-Slug',
                $tenant->slug
            )
            ->postJson(
                '/api/v1/pharmaco/purchase-orders',
                [
                    'purchase_type' =>
                        'core_products',
                    'branch_id' => $branch->id,
                    'pharmaco_supplier_id' =>
                        $supplier->id,
                    'items' => [
                        [
                            'product_id' =>
                                999999999,
                            'quantity_ordered' => 1,
                            'unit_cost' => 1000,
                        ],
                    ],
                ]
            )
            ->assertStatus(422)
            ->assertJsonValidationErrors('items');
    }

    public function test_general_items_order_cannot_enter_product_inventory(): void
    {
        $this->seed();

        $this->authenticateTenantAdministrator();

        [
            $tenant,
            $branch,
            $supplier,
            $product,
        ] = $this->procurementContext();

        $purchaseOrder =
            PharmacoPurchaseOrder::query()
                ->create([
                    'uuid' =>
                        (string) Str::uuid(),
                    'tenant_id' => $tenant->id,
                    'branch_id' => $branch->id,
                    'pharmaco_supplier_id' =>
                        $supplier->id,
                    'po_number' =>
                        'GEN-BLOCK-' .
                        Str::upper(
                            Str::random(6)
                        ),
                    'purchase_type' =>
                        'general_items',
                    'status' => 'approved',
                    'order_date' =>
                        now()->toDateString(),
                    'subtotal_amount' => 1000,
                    'discount_amount' => 0,
                    'tax_amount' => 0,
                    'shipping_amount' => 0,
                    'total_amount' => 1000,
                ]);

        $purchaseOrderItem =
            PharmacoPurchaseOrderItem::query()
                ->create([
                    'uuid' =>
                        (string) Str::uuid(),
                    'tenant_id' => $tenant->id,
                    'pharmaco_purchase_order_id' =>
                        $purchaseOrder->id,
                    'product_id' => $product->id,
                    'product_name_snapshot' =>
                        $product->name,
                    'sku_snapshot' =>
                        $product->sku,
                    'quantity_ordered' => 1,
                    'quantity_received' => 0,
                    'unit_cost' => 1000,
                    'discount_amount' => 0,
                    'tax_amount' => 0,
                    'line_total' => 1000,
                    'status' => 'pending',
                ]);

        $location = StockLocation::query()
            ->where('tenant_id', $tenant->id)
            ->where('branch_id', $branch->id)
            ->where('status', 'active')
            ->firstOrFail();

        $batchNumber =
            'GENERAL-BLOCK-' .
            Str::upper(Str::random(6));

        $this
            ->withHeader(
                'X-Tenant-Slug',
                $tenant->slug
            )
            ->postJson(
                '/api/v1/pharmaco/inventory/receive',
                [
                    'product_id' => $product->id,
                    'stock_location_id' =>
                        $location->id,
                    'pharmaco_purchase_order_item_id' =>
                        $purchaseOrderItem->id,
                    'batch_number' =>
                        $batchNumber,
                    'quantity' => 1,
                    'unit_cost' => 1000,
                ]
            )
            ->assertStatus(422)
            ->assertJsonValidationErrors(
                'pharmaco_purchase_order_item_id'
            );

        $this->assertDatabaseMissing(
            'stock_batches',
            [
                'tenant_id' => $tenant->id,
                'batch_number' => $batchNumber,
            ]
        );
    }

    private function authenticateTenantAdministrator(): User
    {
        $user = User::query()
            ->where(
                'email',
                'admin@vitapharmaafrica.com'
            )
            ->where('status', 'active')
            ->firstOrFail();

        Sanctum::actingAs(
            $user,
            ['*']
        );

        return $user;
    }

    private function procurementContext(): array
    {
        $tenant = Tenant::query()
            ->where('slug', 'vitapharma')
            ->firstOrFail();

        $branch = Branch::query()
            ->where('tenant_id', $tenant->id)
            ->where('status', 'active')
            ->firstOrFail();

        $supplier = PharmacoSupplier::query()
            ->firstOrCreate(
                [
                    'tenant_id' => $tenant->id,
                    'supplier_code' =>
                        'TEST-SUPPLIER-001',
                ],
                [
                    'uuid' => (string) Str::uuid(),
                    'name' =>
                        'Purchase Type Test Supplier',
                    'legal_name' =>
                        'Purchase Type Test Supplier Ltd',
                    'supplier_type' =>
                        'distributor',
                    'contact_person' =>
                        'Test Procurement Officer',
                    'phone' => '+250780000099',
                    'email' =>
                        'procurement-test@example.test',
                    'payment_terms' =>
                        'Net 30 days',
                    'status' => 'active',
                    'notes' =>
                        'Created only inside the isolated Purchase Type feature test database.',
                    'metadata' => [
                        'test_fixture' => true,
                        'fixture_scope' =>
                            'pharmaco_purchase_type',
                    ],
                ]
            );

        $product = Product::query()
            ->where('tenant_id', $tenant->id)
            ->where('status', 'active')
            ->first();

        if (! $product) {
            $product = Product::query()->create([
                'uuid' => (string) Str::uuid(),
                'tenant_id' => $tenant->id,
                'product_category_id' => null,
                'name' =>
                    'Purchase Type Test Product',
                'generic_name' =>
                    'Fixture Medicine',
                'brand_name' =>
                    'Fixture Brand',
                'sku' => 'TEST-CORE-PRODUCT-001',
                'barcode' => null,
                'registration_number' => null,
                'dosage_form' => 'tablet',
                'strength' => '10 mg',
                'unit' => 'box',
                'pack_size' => '10 tablets',
                'route_of_administration' =>
                    'oral',
                'product_type' => 'medicine',
                'regulatory_status' =>
                    'approved',
                'requires_prescription' => false,
                'is_controlled' => false,
                'reorder_level' => 0,
                'minimum_stock_level' => 0,
                'maximum_stock_level' => null,
                'status' => 'active',
                'metadata' => [
                    'test_fixture' => true,
                    'fixture_scope' =>
                        'pharmaco_purchase_type',
                ],
            ]);
        }

        StockLocation::query()->firstOrCreate(
            [
                'tenant_id' => $tenant->id,
                'branch_id' => $branch->id,
                'code' => 'TEST-PO-STORE',
            ],
            [
                'uuid' => (string) Str::uuid(),
                'name' =>
                    'Purchase Type Test Store',
                'location_type' => 'store',
                'status' => 'active',
                'metadata' => [
                    'test_fixture' => true,
                    'fixture_scope' =>
                        'pharmaco_purchase_type',
                ],
            ]
        );

        return [
            $tenant,
            $branch,
            $supplier,
            $product,
        ];
    }
}
