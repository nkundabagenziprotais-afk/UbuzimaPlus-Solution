<?php

namespace Tests\Feature\PharmaCo360;

use App\Models\InventoryReceiptGuard;
use App\Models\Product;
use App\Models\StockBatch;
use App\Models\StockLocation;
use App\Models\StockMovement;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PharmacoMedicineDuplicateReceivingApiTest
    extends TestCase
{
    use RefreshDatabase;

    private const TENANT_SLUG = 'vitapharma';

    public function test_identical_idempotency_key_replays_without_second_movement(): void
    {
        $context = $this->context();

        $batchNumber =
            'IDEMP-' . Str::upper(
                Str::random(8)
            );

        $payload = $this->payload(
            $context,
            $batchNumber,
            'medicine-replay-' . Str::uuid(),
            12
        );

        $before = StockMovement::query()->count();

        $first = $this
            ->withTenant()
            ->postJson(
                '/api/v1/pharmaco/inventory/receive',
                $payload
            );

        $first->assertCreated();

        $afterFirst =
            StockMovement::query()->count();

        $this->assertSame(
            $before + 1,
            $afterFirst
        );

        $second = $this
            ->withTenant()
            ->postJson(
                '/api/v1/pharmaco/inventory/receive',
                $payload
            );

        $second
            ->assertOk()
            ->assertJsonPath(
                'code',
                'IDEMPOTENT_REPLAY'
            )
            ->assertJsonPath(
                'replayed',
                true
            );

        $this->assertSame(
            $afterFirst,
            StockMovement::query()->count()
        );

        $this->assertSame(
            1,
            InventoryReceiptGuard::query()
                ->where(
                    'idempotency_key',
                    $payload['idempotency_key']
                )
                ->count()
        );
    }

    public function test_same_key_with_changed_quantity_is_rejected(): void
    {
        $context = $this->context();

        $batchNumber =
            'MISMATCH-' . Str::upper(
                Str::random(8)
            );

        $key =
            'medicine-mismatch-' . Str::uuid();

        $payload = $this->payload(
            $context,
            $batchNumber,
            $key,
            10
        );

        $this
            ->withTenant()
            ->postJson(
                '/api/v1/pharmaco/inventory/receive',
                $payload
            )
            ->assertCreated();

        $changed = $payload;
        $changed['quantity'] = 11;

        $this
            ->withTenant()
            ->postJson(
                '/api/v1/pharmaco/inventory/receive',
                $changed
            )
            ->assertStatus(409)
            ->assertJsonPath(
                'code',
                'IDEMPOTENCY_KEY_REUSED'
            );
    }

    public function test_suspected_duplicate_returns_existing_date_user_and_token(): void
    {
        $context = $this->context();

        $batchNumber =
            'SUSPECT-' . Str::upper(
                Str::random(8)
            );

        $firstPayload = $this->payload(
            $context,
            $batchNumber,
            'medicine-first-' . Str::uuid(),
            10
        );

        $this
            ->withTenant()
            ->postJson(
                '/api/v1/pharmaco/inventory/receive',
                $firstPayload
            )
            ->assertCreated();

        $suspectedPayload = $this->payload(
            $context,
            $batchNumber,
            'medicine-suspected-' . Str::uuid(),
            6
        );

        $response = $this
            ->withTenant()
            ->postJson(
                '/api/v1/pharmaco/inventory/receive',
                $suspectedPayload
            );

        $response
            ->assertStatus(409)
            ->assertJsonPath(
                'code',
                'SUSPECTED_DUPLICATE'
            )
            ->assertJsonPath(
                'duplicate.classification',
                'suspected'
            )
            ->assertJsonPath(
                'duplicate.override_allowed',
                true
            );

        $this->assertNotEmpty(
            $response->json(
                'duplicate.existing_record.recorded_at'
            )
        );

        $this->assertSame(
            $context['user']->id,
            $response->json(
                'duplicate.existing_record.recorded_user.id'
            )
        );

        $this->assertNotEmpty(
            $response->json(
                'duplicate.duplicate_check_token'
            )
        );
    }

    public function test_authorized_override_preserves_batch_and_adds_one_movement(): void
    {
        $context = $this->context();

        $batchNumber =
            'OVERRIDE-' . Str::upper(
                Str::random(8)
            );

        $firstPayload = $this->payload(
            $context,
            $batchNumber,
            'medicine-base-' . Str::uuid(),
            8
        );

        $this
            ->withTenant()
            ->postJson(
                '/api/v1/pharmaco/inventory/receive',
                $firstPayload
            )
            ->assertCreated();

        $batchBefore = StockBatch::query()
            ->where(
                'product_id',
                $context['product']->id
            )
            ->where(
                'stock_location_id',
                $context['location']->id
            )
            ->where(
                'batch_number',
                $batchNumber
            )
            ->firstOrFail();

        $movementCountBefore =
            StockMovement::query()
                ->where(
                    'stock_batch_id',
                    $batchBefore->id
                )
                ->count();

        $overridePayload = $this->payload(
            $context,
            $batchNumber,
            'medicine-override-' . Str::uuid(),
            4
        );

        $conflict = $this
            ->withTenant()
            ->postJson(
                '/api/v1/pharmaco/inventory/receive',
                $overridePayload
            );

        $conflict
            ->assertStatus(409)
            ->assertJsonPath(
                'code',
                'SUSPECTED_DUPLICATE'
            );

        $token = $conflict->json(
            'duplicate.duplicate_check_token'
        );

        $this->assertNotEmpty($token);

        $overridePayload[
            'duplicate_override'
        ] = true;

        $overridePayload[
            'duplicate_check_token'
        ] = $token;

        $overridePayload[
            'duplicate_override_reason'
        ] =
            'Second verified supplier delivery '
            . 'for the same medicine batch.';

        $this
            ->withTenant()
            ->postJson(
                '/api/v1/pharmaco/inventory/receive',
                $overridePayload
            )
            ->assertCreated();

        $batchAfter = StockBatch::query()
            ->where(
                'product_id',
                $context['product']->id
            )
            ->where(
                'stock_location_id',
                $context['location']->id
            )
            ->where(
                'batch_number',
                $batchNumber
            )
            ->firstOrFail();

        $this->assertSame(
            $batchBefore->id,
            $batchAfter->id
        );

        $this->assertSame(
            1,
            StockBatch::query()
                ->where(
                    'product_id',
                    $context['product']->id
                )
                ->where(
                    'stock_location_id',
                    $context['location']->id
                )
                ->where(
                    'batch_number',
                    $batchNumber
                )
                ->count()
        );

        $this->assertSame(
            $movementCountBefore + 1,
            StockMovement::query()
                ->where(
                    'stock_batch_id',
                    $batchBefore->id
                )
                ->count()
        );

        $guard = InventoryReceiptGuard::query()
            ->where(
                'idempotency_key',
                $overridePayload[
                    'idempotency_key'
                ]
            )
            ->firstOrFail();

        $this->assertSame(
            'completed',
            $guard->status
        );

        $this->assertSame(
            $context['user']->id,
            $guard->override_user_id
        );

        $this->assertNotEmpty(
            $guard->override_reason
        );
    }

    private function context(): array
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
            ->where(
                'slug',
                self::TENANT_SLUG
            )
            ->firstOrFail();

        $product = Product::query()
            ->where(
                'tenant_id',
                $tenant->id
            )
            ->where('status', 'active')
            ->firstOrFail();

        $location = StockLocation::query()
            ->where(
                'tenant_id',
                $tenant->id
            )
            ->where('status', 'active')
            ->firstOrFail();

        return compact(
            'user',
            'tenant',
            'product',
            'location'
        );
    }

    private function payload(
        array $context,
        string $batchNumber,
        string $idempotencyKey,
        float $quantity
    ): array {
        return [
            'product_id' =>
                $context['product']->id,
            'stock_location_id' =>
                $context['location']->id,
            'batch_number' => $batchNumber,
            'quantity' => $quantity,
            'expiry_date' => '2029-12-31',
            'unit_cost' => 1500,
            'selling_price' => 2000,
            'supplier_name' =>
                'Duplicate Prevention Test Supplier',
            'received_at' => now()->toDateString(),
            'reason' =>
                'Automated duplicate prevention test',
            'receive_source' => 'manual',
            'idempotency_key' =>
                $idempotencyKey,
        ];
    }

    private function withTenant(): static
    {
        return $this->withHeader(
            'X-Tenant-Slug',
            self::TENANT_SLUG
        );
    }
}
