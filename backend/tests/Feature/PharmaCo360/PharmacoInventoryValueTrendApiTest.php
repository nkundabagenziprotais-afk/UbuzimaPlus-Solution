<?php

namespace Tests\Feature\PharmaCo360;

use App\Models\Branch;
use App\Models\Product;
use App\Models\StockBatch;
use App\Models\StockLocation;
use App\Models\StockMovement;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PharmacoInventoryValueTrendApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Carbon::setTestNow(
            Carbon::parse(
                '2026-07-10 12:00:00'
            )
        );
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
    }

    public function test_inventory_summary_returns_real_sunday_to_saturday_value_trend(): void
    {
        $this->seed();

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

        $tenant = Tenant::query()
            ->where('slug', 'vitapharma')
            ->firstOrFail();

        // Isolate this focused trend test from movement fixtures
        // created by the standard application seeders. This only
        // affects the transaction-backed RefreshDatabase test DB.
        StockMovement::query()
            ->where(
                'tenant_id',
                $tenant->id
            )
            ->delete();

        $this->assertSame(
            0,
            StockMovement::query()
                ->where(
                    'tenant_id',
                    $tenant->id
                )
                ->count()
        );

        $branch = Branch::query()
            ->where(
                'tenant_id',
                $tenant->id
            )
            ->where('status', 'active')
            ->firstOrFail();

        $product = Product::query()
            ->where(
                'tenant_id',
                $tenant->id
            )
            ->where('status', 'active')
            ->first();

        if (! $product) {
            $product = Product::query()
                ->create([
                    'uuid' =>
                        (string) Str::uuid(),
                    'tenant_id' =>
                        $tenant->id,
                    'product_category_id' =>
                        null,
                    'name' =>
                        'Inventory Trend Test Product',
                    'generic_name' =>
                        'Trend Fixture',
                    'brand_name' =>
                        'Trend Fixture',
                    'sku' =>
                        'TREND-TEST-001',
                    'dosage_form' =>
                        'tablet',
                    'unit' => 'box',
                    'product_type' =>
                        'medicine',
                    'regulatory_status' =>
                        'approved',
                    'requires_prescription' =>
                        false,
                    'is_controlled' =>
                        false,
                    'reorder_level' => 0,
                    'minimum_stock_level' => 0,
                    'status' => 'active',
                    'metadata' => [
                        'test_fixture' => true,
                    ],
                ]);
        }

        $location =
            StockLocation::query()
                ->firstOrCreate(
                    [
                        'tenant_id' =>
                            $tenant->id,
                        'branch_id' =>
                            $branch->id,
                        'code' =>
                            'TREND-STORE-001',
                    ],
                    [
                        'uuid' =>
                            (string) Str::uuid(),
                        'name' =>
                            'Inventory Trend Test Store',
                        'location_type' =>
                            'store',
                        'status' => 'active',
                        'metadata' => [
                            'test_fixture' => true,
                        ],
                    ]
                );

        $batch = StockBatch::query()
            ->create([
                'uuid' =>
                    (string) Str::uuid(),
                'tenant_id' =>
                    $tenant->id,
                'branch_id' =>
                    $branch->id,
                'stock_location_id' =>
                    $location->id,
                'product_id' =>
                    $product->id,
                'batch_number' =>
                    'TREND-' .
                    Str::upper(
                        Str::random(8)
                    ),
                'expiry_date' =>
                    '2028-12-31',
                'received_at' =>
                    '2026-07-05',
                'quantity_on_hand' => 12,
                'quantity_reserved' => 0,
                'unit_cost' => 60,
                'selling_price' => 100,
                'supplier_name' =>
                    'Trend Test Supplier',
                'status' => 'active',
                'metadata' => [
                    'test_fixture' => true,
                ],
            ]);

        $this->createMovement(
            tenant: $tenant,
            branch: $branch,
            location: $location,
            product: $product,
            batch: $batch,
            type: 'stock_received',
            quantity: 10,
            balance: 10,
            occurredAt:
                '2026-07-05 09:00:00'
        );

        $this->createMovement(
            tenant: $tenant,
            branch: $branch,
            location: $location,
            product: $product,
            batch: $batch,
            type: 'sale_dispensed',
            quantity: -4,
            balance: 6,
            occurredAt:
                '2026-07-08 11:00:00'
        );

        $this->createMovement(
            tenant: $tenant,
            branch: $branch,
            location: $location,
            product: $product,
            batch: $batch,
            type: 'stock_received',
            quantity: 6,
            balance: 12,
            occurredAt:
                '2026-07-10 10:00:00'
        );

        $response = $this
            ->withHeader(
                'X-Tenant-Slug',
                $tenant->slug
            )
            ->getJson(
                '/api/v1/pharmaco/inventory/summary'
            );

        $response->assertOk();

        $trend = $response->json(
            'summary.inventory_value_weekly_trend'
        );

        $this->assertIsArray($trend);

        $this->assertSame(
            ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
            array_column(
                $trend['points'],
                'label'
            )
        );

        $this->assertTrue(
            $trend['history_available']
        );

        $this->assertSame(
            3,
            $trend['recorded_movement_count']
        );

        $this->assertSame(
            'growing',
            $trend['direction']
        );

        $this->assertEqualsWithDelta(
            200,
            (float) $trend['delta_value'],
            0.01
        );

        $currentValue = (float)
            $response->json(
                'summary.estimated_stock_retail_value'
            );

        $this->assertEqualsWithDelta(
            $currentValue - 200,
            (float) $trend['points'][0]['value'],
            0.01
        );

        $this->assertEqualsWithDelta(
            $currentValue - 600,
            (float) $trend['points'][3]['value'],
            0.01
        );

        $this->assertEqualsWithDelta(
            $currentValue,
            (float) $trend['points'][5]['value'],
            0.01
        );

        $this->assertNull(
            $trend['points'][6]['value']
        );

        $this->assertTrue(
            $trend['points'][6]['is_future']
        );
    }

    private function createMovement(
        Tenant $tenant,
        Branch $branch,
        StockLocation $location,
        Product $product,
        StockBatch $batch,
        string $type,
        float $quantity,
        float $balance,
        string $occurredAt
    ): void {
        StockMovement::query()
            ->create([
                'uuid' =>
                    (string) Str::uuid(),
                'tenant_id' =>
                    $tenant->id,
                'branch_id' =>
                    $branch->id,
                'stock_location_id' =>
                    $location->id,
                'product_id' =>
                    $product->id,
                'stock_batch_id' =>
                    $batch->id,
                'movement_type' =>
                    $type,
                'quantity' =>
                    $quantity,
                'running_balance' =>
                    $balance,
                'reference_type' =>
                    'inventory_trend_test',
                'reference_number' =>
                    Str::upper(
                        Str::random(10)
                    ),
                'reason' =>
                    'Focused Inventory value trend test.',
                'performed_by' =>
                    null,
                'occurred_at' =>
                    Carbon::parse(
                        $occurredAt
                    ),
                'metadata' => [
                    'test_fixture' => true,
                ],
            ]);
    }
}
