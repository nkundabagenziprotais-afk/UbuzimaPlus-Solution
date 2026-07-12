<?php

namespace Tests\Feature\PharmaCo360;

use App\Models\Branch;
use App\Models\PharmacoGeneralItem;
use App\Models\PharmacoGeneralPurchaseOrderItem;
use App\Models\PharmacoPurchaseOrder;
use App\Models\PharmacoSupplier;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PharmacoGeneralItemsManagementApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_manage_general_item_master_and_stock_ledger(): void
    {
        [$user, $tenant, $branch] =
            $this->authenticatedContext();

        $seedResponse = $this
            ->tenantRequest($tenant)
            ->postJson(
                '/api/v1/pharmaco/general-item-categories/seed-defaults'
            )
            ->assertOk();

        $this->assertCount(
            12,
            $seedResponse->json('categories')
        );

        $categoryId = $seedResponse->json(
            'categories.0.id'
        );

        $locationResponse = $this
            ->tenantRequest($tenant)
            ->postJson(
                '/api/v1/pharmaco/general-item-locations',
                [
                    'branch_id' => $branch->id,
                    'name' => 'Main General Store',
                    'code' => 'GEN-STORE',
                    'location_type' => 'store',
                    'status' => 'active',
                ]
            )
            ->assertCreated();

        $locationId = $locationResponse->json(
            'location.id'
        );

        $itemResponse = $this
            ->tenantRequest($tenant)
            ->postJson(
                '/api/v1/pharmaco/general-items',
                [
                    'pharmaco_general_item_category_id' =>
                        $categoryId,
                    'name' => 'A4 Printing Paper',
                    'code' => 'OFF-PAPER-A4',
                    'unit_of_measure' => 'ream',
                    'reorder_level' => 10,
                    'minimum_stock_level' => 5,
                    'track_stock' => true,
                    'status' => 'active',
                ]
            )
            ->assertCreated();

        $itemId = $itemResponse->json('item.id');

        $this
            ->tenantRequest($tenant)
            ->postJson(
                '/api/v1/pharmaco/general-item-stock/receive',
                [
                    'branch_id' => $branch->id,
                    'pharmaco_general_item_id' =>
                        $itemId,
                    'pharmaco_general_item_location_id' =>
                        $locationId,
                    'quantity' => 20,
                    'unit_cost' => 5000,
                    'reference_type' =>
                        'manual_receipt',
                    'reference_number' =>
                        'GRN-GEN-001',
                ]
            )
            ->assertCreated()
            ->assertJsonPath(
                'stock.quantity_on_hand',
                20
            );

        $this
            ->tenantRequest($tenant)
            ->postJson(
                '/api/v1/pharmaco/general-item-stock/issue',
                [
                    'branch_id' => $branch->id,
                    'pharmaco_general_item_id' =>
                        $itemId,
                    'pharmaco_general_item_location_id' =>
                        $locationId,
                    'quantity' => 3,
                    'reference_type' =>
                        'department_usage',
                    'reference_number' =>
                        'ISSUE-001',
                    'reason' =>
                        'Issued to Administration.',
                ]
            )
            ->assertCreated()
            ->assertJsonPath(
                'stock.quantity_on_hand',
                17
            );

        $this
            ->tenantRequest($tenant)
            ->getJson(
                '/api/v1/pharmaco/general-item-stock/summary'
            )
            ->assertOk()
            ->assertJsonPath(
                'summary.items_count',
                1
            )
            ->assertJsonPath(
                'summary.quantity_on_hand',
                17
            )
            ->assertJsonPath(
                'summary.stock_value',
                85000
            );

        $this
            ->tenantRequest($tenant)
            ->getJson(
                '/api/v1/pharmaco/general-item-movements'
            )
            ->assertOk()
            ->assertJsonCount(
                2,
                'movements'
            );
    }

    public function test_general_item_purchase_order_requires_general_item_master(): void
    {
        [$user, $tenant, $branch] =
            $this->authenticatedContext();

        $supplier =
            $this->createSupplierFixture($tenant);

        $categoryId = $this
            ->tenantRequest($tenant)
            ->postJson(
                '/api/v1/pharmaco/general-item-categories/seed-defaults'
            )
            ->assertOk()
            ->json('categories.0.id');

        $itemId = $this
            ->tenantRequest($tenant)
            ->postJson(
                '/api/v1/pharmaco/general-items',
                [
                    'pharmaco_general_item_category_id' =>
                        $categoryId,
                    'name' => 'Cleaning Detergent',
                    'code' => 'HYG-DETERGENT',
                    'unit_of_measure' => 'bottle',
                    'reorder_level' => 4,
                    'minimum_stock_level' => 2,
                    'track_stock' => true,
                    'status' => 'active',
                ]
            )
            ->assertCreated()
            ->json('item.id');

        $this
            ->tenantRequest($tenant)
            ->postJson(
                '/api/v1/pharmaco/purchase-orders',
                [
                    'purchase_type' =>
                        'general_items',
                    'branch_id' => $branch->id,
                    'pharmaco_supplier_id' =>
                        $supplier->id,
                    'general_items' => [
                        [
                            'item_name' =>
                                'Free text should fail',
                            'unit_of_measure' =>
                                'unit',
                            'quantity_ordered' => 1,
                            'unit_cost' => 100,
                        ],
                    ],
                ]
            )
            ->assertUnprocessable()
            ->assertJsonValidationErrors([
                'general_items.0.general_item_id',
                'general_items.0.item_name',
                'general_items.0.unit_of_measure',
            ]);

        $response = $this
            ->tenantRequest($tenant)
            ->postJson(
                '/api/v1/pharmaco/purchase-orders',
                [
                    'purchase_type' =>
                        'general_items',
                    'branch_id' => $branch->id,
                    'pharmaco_supplier_id' =>
                        $supplier->id,
                    'general_items' => [
                        [
                            'general_item_id' =>
                                $itemId,
                            'quantity_ordered' => 6,
                            'unit_cost' => 2500,
                        ],
                    ],
                ]
            )
            ->assertCreated()
            ->assertJsonPath(
                'purchase_order.purchase_type',
                'general_items'
            )
            ->assertJsonPath(
                'purchase_order.items.0.general_item.id',
                $itemId
            )
            ->assertJsonPath(
                'purchase_order.items.0.item_name',
                'Cleaning Detergent'
            );

        $purchaseOrderId = $response->json(
            'purchase_order.id'
        );

        $purchaseOrder =
            PharmacoPurchaseOrder::query()
                ->findOrFail($purchaseOrderId);

        $this->assertSame(
            'general_items',
            $purchaseOrder->purchase_type
        );

        $line =
            PharmacoGeneralPurchaseOrderItem::query()
                ->where(
                    'pharmaco_purchase_order_id',
                    $purchaseOrderId
                )
                ->firstOrFail();

        $this->assertSame(
            $itemId,
            $line->pharmaco_general_item_id
        );

        $this->assertSame(
            'Cleaning Detergent',
            $line->item_name
        );

        $this->assertSame(
            'HYG-DETERGENT',
            $line->item_code
        );

        $this->assertDatabaseCount(
            'pharmaco_purchase_order_items',
            0
        );
    }

    public function test_general_item_issue_cannot_exceed_available_stock(): void
    {
        [$user, $tenant, $branch] =
            $this->authenticatedContext();

        $categoryId = $this
            ->tenantRequest($tenant)
            ->postJson(
                '/api/v1/pharmaco/general-item-categories/seed-defaults'
            )
            ->assertOk()
            ->json('categories.0.id');

        $itemId = $this
            ->tenantRequest($tenant)
            ->postJson(
                '/api/v1/pharmaco/general-items',
                [
                    'pharmaco_general_item_category_id' =>
                        $categoryId,
                    'name' => 'Disposable Gloves',
                    'code' => 'PPE-GLOVES',
                    'unit_of_measure' => 'box',
                    'track_stock' => true,
                    'status' => 'active',
                ]
            )
            ->assertCreated()
            ->json('item.id');

        $locationId = $this
            ->tenantRequest($tenant)
            ->postJson(
                '/api/v1/pharmaco/general-item-locations',
                [
                    'branch_id' => $branch->id,
                    'name' => 'Safety Store',
                    'code' => 'PPE-STORE',
                    'location_type' => 'store',
                ]
            )
            ->assertCreated()
            ->json('location.id');

        $this
            ->tenantRequest($tenant)
            ->postJson(
                '/api/v1/pharmaco/general-item-stock/receive',
                [
                    'branch_id' => $branch->id,
                    'pharmaco_general_item_id' =>
                        $itemId,
                    'pharmaco_general_item_location_id' =>
                        $locationId,
                    'quantity' => 2,
                    'unit_cost' => 8000,
                ]
            )
            ->assertCreated();

        $this
            ->tenantRequest($tenant)
            ->postJson(
                '/api/v1/pharmaco/general-item-stock/issue',
                [
                    'branch_id' => $branch->id,
                    'pharmaco_general_item_id' =>
                        $itemId,
                    'pharmaco_general_item_location_id' =>
                        $locationId,
                    'quantity' => 3,
                ]
            )
            ->assertUnprocessable()
            ->assertJsonValidationErrors([
                'quantity',
            ]);
    }

    private function createSupplierFixture(
        Tenant $tenant
    ): PharmacoSupplier {
        return PharmacoSupplier::query()
            ->create([
                'uuid' => (string) Str::uuid(),
                'tenant_id' => $tenant->id,
                'supplier_code' =>
                    'SUP-GEN-' .
                    Str::upper(
                        Str::random(6)
                    ),
                'name' =>
                    'General Items Test Supplier',
                'supplier_type' =>
                    'wholesaler',
                'status' => 'active',
                'metadata' => [
                    'test_fixture' => true,
                ],
            ]);
    }

    private function authenticatedContext(): array
    {
        $this->seed();

        $user = User::query()
            ->where(
                'email',
                'admin@vitapharmaafrica.com'
            )
            ->where('status', 'active')
            ->firstOrFail();

        Sanctum::actingAs($user, ['*']);

        $tenant = Tenant::query()
            ->where('slug', 'vitapharma')
            ->firstOrFail();

        $branch = Branch::query()
            ->where('tenant_id', $tenant->id)
            ->where('status', 'active')
            ->firstOrFail();

        return [$user, $tenant, $branch];
    }

    private function tenantRequest(Tenant $tenant): self
    {
        return $this->withHeader(
            'X-Tenant-Slug',
            $tenant->slug
        );
    }
}
