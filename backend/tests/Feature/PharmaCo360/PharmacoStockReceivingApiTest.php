<?php

namespace Tests\Feature\PharmaCo360;

use App\Models\Branch;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\Solution;
use App\Models\StockBatch;
use App\Models\StockLocation;
use App\Models\StockMovement;
use App\Models\Tenant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class PharmacoStockReceivingApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_tenant_admin_can_receive_new_stock_batch_and_audit_is_recorded(): void
    {
        $this->seed();

        $tenant = Tenant::where('slug', 'vitapharma')->firstOrFail();
        $product = Product::where('tenant_id', $tenant->id)->where('sku', 'GLUCOSE-STRIPS')->firstOrFail();
        $location = StockLocation::where('tenant_id', $tenant->id)->where('code', 'HQ-STORE')->firstOrFail();
        $token = $this->loginAs('admin@vitapharmaafrica.com');

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->postJson('/api/v1/pharmaco/inventory/receive', [
                'product_id' => $product->id,
                'stock_location_id' => $location->id,
                'batch_number' => 'GLU-RECV-001',
                'quantity' => 35,
                'expiry_date' => now()->addYear()->toDateString(),
                'received_at' => now()->toDateString(),
                'unit_cost' => 320,
                'selling_price' => 480,
                'supplier_name' => 'Test Medical Supplier',
                'reference_number' => 'RCV-GLU-001',
                'reason' => 'Initial test receipt.',
            ])
            ->assertCreated()
            ->assertJsonPath('message', 'Stock received successfully.')
            ->assertJsonPath('batch.batch_number', 'GLU-RECV-001')
            ->assertJsonPath('batch.quantity_on_hand', 35)
            ->assertJsonPath('movement.movement_type', 'stock_received')
            ->assertJsonPath('movement.quantity', 35);

        $batch = StockBatch::where('tenant_id', $tenant->id)
            ->where('product_id', $product->id)
            ->where('stock_location_id', $location->id)
            ->where('batch_number', 'GLU-RECV-001')
            ->firstOrFail();

        $this->assertSame(35.0, (float) $batch->quantity_on_hand);

        $this->assertDatabaseHas('stock_movements', [
            'tenant_id' => $tenant->id,
            'product_id' => $product->id,
            'stock_batch_id' => $batch->id,
            'movement_type' => 'stock_received',
            'reference_number' => 'RCV-GLU-001',
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'tenant_id' => $tenant->id,
            'action' => 'pharmaco.stock.received',
            'auditable_type' => StockBatch::class,
            'auditable_id' => $batch->id,
        ]);
    }

    public function test_receiving_existing_batch_increases_quantity_and_records_movement(): void
    {
        $this->seed();

        $tenant = Tenant::where('slug', 'vitapharma')->firstOrFail();
        $batch = StockBatch::where('tenant_id', $tenant->id)->where('batch_number', 'AMOX-B001')->firstOrFail();
        $beforeQuantity = (float) $batch->quantity_on_hand;
        $token = $this->loginAs('admin@vitapharmaafrica.com');

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->postJson('/api/v1/pharmaco/inventory/receive', [
                'product_id' => $batch->product_id,
                'stock_location_id' => $batch->stock_location_id,
                'batch_number' => $batch->batch_number,
                'quantity' => 25,
                'reference_number' => 'RCV-AMOX-002',
                'reason' => 'Additional receipt for existing batch.',
            ])
            ->assertCreated()
            ->assertJsonPath('batch.batch_number', 'AMOX-B001')
            ->assertJsonPath('movement.reference_number', 'RCV-AMOX-002');

        $batch->refresh();

        $this->assertSame($beforeQuantity + 25.0, (float) $batch->quantity_on_hand);

        $movement = StockMovement::where('tenant_id', $tenant->id)
            ->where('reference_number', 'RCV-AMOX-002')
            ->firstOrFail();

        $this->assertSame(25.0, (float) $movement->quantity);
        $this->assertSame((float) $batch->quantity_on_hand, (float) $movement->running_balance);
    }

    public function test_stock_receiving_rejects_product_outside_current_tenant(): void
    {
        $this->seed();

        [$otherProduct] = $this->createOtherTenantInventory();
        $tenant = Tenant::where('slug', 'vitapharma')->firstOrFail();
        $location = StockLocation::where('tenant_id', $tenant->id)->firstOrFail();
        $token = $this->loginAs('admin@vitapharmaafrica.com');

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->postJson('/api/v1/pharmaco/inventory/receive', [
                'product_id' => $otherProduct->id,
                'stock_location_id' => $location->id,
                'batch_number' => 'INVALID-PRODUCT-BATCH',
                'quantity' => 10,
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('product_id');
    }

    public function test_stock_receiving_rejects_location_outside_current_tenant(): void
    {
        $this->seed();

        [, $otherLocation] = $this->createOtherTenantInventory();
        $tenant = Tenant::where('slug', 'vitapharma')->firstOrFail();
        $product = Product::where('tenant_id', $tenant->id)->firstOrFail();
        $token = $this->loginAs('admin@vitapharmaafrica.com');

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->postJson('/api/v1/pharmaco/inventory/receive', [
                'product_id' => $product->id,
                'stock_location_id' => $otherLocation->id,
                'batch_number' => 'INVALID-LOCATION-BATCH',
                'quantity' => 10,
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('stock_location_id');
    }

    public function test_stock_receiving_requires_tenant_header(): void
    {
        $this->seed();

        $tenant = Tenant::where('slug', 'vitapharma')->firstOrFail();
        $product = Product::where('tenant_id', $tenant->id)->firstOrFail();
        $location = StockLocation::where('tenant_id', $tenant->id)->firstOrFail();
        $token = $this->loginAs('admin@vitapharmaafrica.com');

        $this->withToken($token)
            ->postJson('/api/v1/pharmaco/inventory/receive', [
                'product_id' => $product->id,
                'stock_location_id' => $location->id,
                'batch_number' => 'MISSING-TENANT-HEADER',
                'quantity' => 10,
            ])
            ->assertStatus(422)
            ->assertJsonPath('required_header', 'X-Tenant-Slug');
    }

    private function loginAs(string $email): string
    {
        $response = $this->postJson('/api/v1/auth/login', [
            'email' => $email,
            'password' => 'ChangeThisPassword123!',
            'device_name' => 'PharmaCo360 Stock Receiving API Test Client',
        ]);

        $response->assertOk();

        return $response->json('access_token');
    }

    private function createOtherTenantInventory(): array
    {
        $solution = Solution::where('code', 'pharmaco360')->firstOrFail();

        $tenant = Tenant::query()->create([
            'uuid' => (string) Str::uuid(),
            'solution_id' => $solution->id,
            'primary_solution_id' => $solution->id,
            'name' => 'Other Receiving Pharmacy',
            'legal_name' => 'Other Receiving Pharmacy Ltd',
            'slug' => 'other-receiving-pharmacy-' . Str::lower(Str::random(6)),
            'tenant_type' => 'pharmacy',
            'status' => 'active',
        ]);

        $branch = Branch::query()->create([
            'tenant_id' => $tenant->id,
            'name' => 'Other Receiving Pharmacy HQ',
            'code' => 'OTHER-RECEIVING-HQ',
            'branch_type' => 'pharmacy',
            'status' => 'active',
        ]);

        $category = ProductCategory::query()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $tenant->id,
            'name' => 'Other Receiving Category',
            'code' => 'OTHER-RECEIVING-CATEGORY-' . Str::upper(Str::random(4)),
            'category_type' => 'medicine',
            'status' => 'active',
        ]);

        $product = Product::query()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $tenant->id,
            'product_category_id' => $category->id,
            'name' => 'Other Receiving Product',
            'sku' => 'OTHER-RECEIVING-PRODUCT-' . Str::upper(Str::random(4)),
            'unit' => 'unit',
            'product_type' => 'medicine',
            'regulatory_status' => 'approved',
            'requires_prescription' => false,
            'is_controlled' => false,
            'reorder_level' => 10,
            'minimum_stock_level' => 5,
            'status' => 'active',
        ]);

        $location = StockLocation::query()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $tenant->id,
            'branch_id' => $branch->id,
            'name' => 'Other Receiving Store',
            'code' => 'OTHER-RECEIVING-STORE',
            'location_type' => 'store',
            'status' => 'active',
        ]);

        return [$product, $location];
    }
}
