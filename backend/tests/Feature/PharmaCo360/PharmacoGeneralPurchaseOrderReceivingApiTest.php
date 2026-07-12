<?php

namespace Tests\Feature\PharmaCo360;

use App\Models\Branch;
use App\Models\PharmacoGeneralItem;
use App\Models\PharmacoGeneralItemCategory;
use App\Models\PharmacoGeneralItemLocation;
use App\Models\PharmacoGeneralItemMovement;
use App\Models\PharmacoGeneralItemStock;
use App\Models\PharmacoGeneralPurchaseOrderItem;
use App\Models\PharmacoPurchaseOrder;
use App\Models\PharmacoSupplier;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PharmacoGeneralPurchaseOrderReceivingApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_approved_order_supports_partial_and_full_receiving(): void
    {
        $context = $this->context(
            status: 'approved',
            quantityOrdered: 10,
            unitCost: 1000
        );

        $this
            ->tenantRequest($context['tenant'])
            ->postJson(
                $this->receiveUrl($context),
                [
                    'pharmaco_general_purchase_order_item_id' =>
                        $context['line']->id,
                    'pharmaco_general_item_location_id' =>
                        $context['location']->id,
                    'quantity_received' => 4,
                    'reference_number' =>
                        'GRN-GENERAL-PARTIAL',
                ]
            )
            ->assertCreated()
            ->assertJsonPath(
                'purchase_order.status',
                'partially_received'
            )
            ->assertJsonPath(
                'purchase_order_item.status',
                'partially_received'
            )
            ->assertJsonPath(
                'purchase_order_item.quantity_received',
                4
            )
            ->assertJsonPath(
                'purchase_order_item.remaining_quantity',
                6
            )
            ->assertJsonPath(
                'stock.quantity_on_hand',
                4
            );

        $this
            ->tenantRequest($context['tenant'])
            ->postJson(
                $this->receiveUrl($context),
                [
                    'pharmaco_general_purchase_order_item_id' =>
                        $context['line']->id,
                    'pharmaco_general_item_location_id' =>
                        $context['location']->id,
                    'quantity_received' => 6,
                    'reference_number' =>
                        'GRN-GENERAL-FINAL',
                ]
            )
            ->assertCreated()
            ->assertJsonPath(
                'purchase_order.status',
                'received'
            )
            ->assertJsonPath(
                'purchase_order_item.status',
                'received'
            )
            ->assertJsonPath(
                'purchase_order_item.quantity_received',
                10
            )
            ->assertJsonPath(
                'purchase_order_item.remaining_quantity',
                0
            )
            ->assertJsonPath(
                'stock.quantity_on_hand',
                10
            )
            ->assertJsonPath(
                'stock.average_unit_cost',
                1000
            );

        $this->assertDatabaseHas(
            'pharmaco_purchase_orders',
            [
                'id' =>
                    $context['purchase_order']->id,
                'status' => 'received',
            ]
        );

        $this->assertDatabaseHas(
            'pharmaco_general_purchase_order_items',
            [
                'id' => $context['line']->id,
                'quantity_received' => 10,
                'status' => 'received',
            ]
        );

        $this->assertDatabaseHas(
            'pharmaco_general_item_stocks',
            [
                'tenant_id' =>
                    $context['tenant']->id,
                'pharmaco_general_item_id' =>
                    $context['item']->id,
                'pharmaco_general_item_location_id' =>
                    $context['location']->id,
                'quantity_on_hand' => 10,
            ]
        );

        $this->assertSame(
            2,
            PharmacoGeneralItemMovement::query()
                ->where(
                    'reference_type',
                    'purchase_order'
                )
                ->where(
                    'tenant_id',
                    $context['tenant']->id
                )
                ->count()
        );
        $this->assertDatabaseMissing(
            'pharmaco_purchase_order_items',
            [
                'pharmaco_purchase_order_id' =>
                    $context['purchase_order']->id,
            ]
        );
    }

    public function test_receiving_rejects_quantity_above_remaining_balance(): void
    {
        $context = $this->context(
            status: 'approved',
            quantityOrdered: 5,
            unitCost: 2500
        );

        $this
            ->tenantRequest($context['tenant'])
            ->postJson(
                $this->receiveUrl($context),
                [
                    'pharmaco_general_purchase_order_item_id' =>
                        $context['line']->id,
                    'pharmaco_general_item_location_id' =>
                        $context['location']->id,
                    'quantity_received' => 6,
                ]
            )
            ->assertUnprocessable()
            ->assertJsonValidationErrors([
                'quantity_received',
            ]);

        $this->assertSame(
            0,
            PharmacoGeneralItemStock::query()
                ->count()
        );

        $this->assertSame(
            0,
            PharmacoGeneralItemMovement::query()
                ->count()
        );
    }

    public function test_draft_order_cannot_receive_general_item_stock(): void
    {
        $context = $this->context(
            status: 'draft',
            quantityOrdered: 3,
            unitCost: 4000
        );

        $this
            ->tenantRequest($context['tenant'])
            ->postJson(
                $this->receiveUrl($context),
                [
                    'pharmaco_general_purchase_order_item_id' =>
                        $context['line']->id,
                    'pharmaco_general_item_location_id' =>
                        $context['location']->id,
                    'quantity_received' => 1,
                ]
            )
            ->assertUnprocessable()
            ->assertJsonValidationErrors([
                'purchase_order',
            ]);

        $this->assertSame(
            0,
            PharmacoGeneralItemMovement::query()
                ->count()
        );
    }

    private function context(
        string $status,
        float $quantityOrdered,
        float $unitCost
    ): array {
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

        $supplier =
            PharmacoSupplier::query()
                ->create([
                    'uuid' =>
                        (string) Str::uuid(),
                    'tenant_id' =>
                        $tenant->id,
                    'supplier_code' =>
                        'SUP-GEN-' .
                        Str::upper(
                            Str::random(6)
                        ),
                    'name' =>
                        'General Items Receiving Supplier',
                    'supplier_type' =>
                        'wholesaler',
                    'status' => 'active',
                    'metadata' => [
                        'test_fixture' => true,
                    ],
                ]);

        $category =
            PharmacoGeneralItemCategory::query()
                ->create([
                    'uuid' =>
                        (string) Str::uuid(),
                    'tenant_id' =>
                        $tenant->id,
                    'name' =>
                        'Packaging and Consumables',
                    'code' =>
                        'PAC-' .
                        Str::upper(
                            Str::random(6)
                        ),
                    'status' => 'active',
                ]);

        $item =
            PharmacoGeneralItem::query()
                ->create([
                    'uuid' =>
                        (string) Str::uuid(),
                    'tenant_id' =>
                        $tenant->id,
                    'pharmaco_general_item_category_id' =>
                        $category->id,
                    'preferred_supplier_id' =>
                        $supplier->id,
                    'name' =>
                        'Reusable Packaging Box',
                    'code' =>
                        'GEN-BOX-' .
                        Str::upper(
                            Str::random(6)
                        ),
                    'unit_of_measure' => 'box',
                    'reorder_level' => 2,
                    'minimum_stock_level' => 1,
                    'track_stock' => true,
                    'status' => 'active',
                ]);

        $location =
            PharmacoGeneralItemLocation::query()
                ->create([
                    'uuid' =>
                        (string) Str::uuid(),
                    'tenant_id' =>
                        $tenant->id,
                    'branch_id' =>
                        $branch->id,
                    'name' =>
                        'Main General Items Store',
                    'code' =>
                        'GEN-STORE-' .
                        Str::upper(
                            Str::random(5)
                        ),
                    'location_type' => 'store',
                    'status' => 'active',
                ]);

        $lineTotal = round(
            $quantityOrdered * $unitCost,
            2
        );

        $purchaseOrder =
            PharmacoPurchaseOrder::query()
                ->create([
                    'uuid' =>
                        (string) Str::uuid(),
                    'tenant_id' =>
                        $tenant->id,
                    'branch_id' =>
                        $branch->id,
                    'pharmaco_supplier_id' =>
                        $supplier->id,
                    'po_number' =>
                        'PO-GEN-' .
                        Str::upper(
                            Str::random(8)
                        ),
                    'purchase_type' =>
                        'general_items',
                    'status' => $status,
                    'order_date' =>
                        now()->toDateString(),
                    'subtotal_amount' =>
                        $lineTotal,
                    'discount_amount' => 0,
                    'tax_amount' => 0,
                    'shipping_amount' => 0,
                    'total_amount' =>
                        $lineTotal,
                    'created_by' =>
                        $user->id,
                    'approved_by' =>
                        $status === 'draft'
                            ? null
                            : $user->id,
                    'approved_at' =>
                        $status === 'draft'
                            ? null
                            : now(),
                    'metadata' => [
                        'test_fixture' => true,
                        'receiving_status' =>
                            'not_received',
                    ],
                ]);

        $line =
            PharmacoGeneralPurchaseOrderItem::query()
                ->create([
                    'uuid' =>
                        (string) Str::uuid(),
                    'tenant_id' =>
                        $tenant->id,
                    'pharmaco_purchase_order_id' =>
                        $purchaseOrder->id,
                    'pharmaco_general_item_id' =>
                        $item->id,
                    'item_name' =>
                        $item->name,
                    'item_code' =>
                        $item->code,
                    'category' =>
                        $category->name,
                    'unit_of_measure' =>
                        $item->unit_of_measure,
                    'quantity_ordered' =>
                        $quantityOrdered,
                    'quantity_received' => 0,
                    'unit_cost' => $unitCost,
                    'discount_amount' => 0,
                    'tax_amount' => 0,
                    'line_total' =>
                        $lineTotal,
                    'status' => 'pending',
                    'metadata' => [
                        'source' =>
                            'general_item_master',
                    ],
                ]);

        return [
            'tenant' => $tenant,
            'branch' => $branch,
            'item' => $item,
            'location' => $location,
            'purchase_order' =>
                $purchaseOrder,
            'line' => $line,
        ];
    }

    private function receiveUrl(
        array $context
    ): string {
        return sprintf(
            '/api/v1/pharmaco/purchase-orders/%d/general-items/receive',
            $context['purchase_order']->id
        );
    }

    private function tenantRequest(
        Tenant $tenant
    ): self {
        return $this->withHeader(
            'X-Tenant-Slug',
            $tenant->slug
        );
    }
}
