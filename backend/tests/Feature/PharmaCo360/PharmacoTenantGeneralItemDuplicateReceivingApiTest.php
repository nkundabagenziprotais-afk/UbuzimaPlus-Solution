<?php

namespace Tests\Feature\PharmaCo360;

use App\Models\Branch;
use App\Models\InventoryReceiptGuard;
use App\Models\PharmacoGeneralItem;
use App\Models\PharmacoGeneralItemCategory;
use App\Models\PharmacoGeneralItemLocation;
use App\Models\PharmacoGeneralItemMovement;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PharmacoTenantGeneralItemDuplicateReceivingApiTest
    extends TestCase
{
    use RefreshDatabase;

    private const TENANT_SLUG = 'vitapharma';

    public function test_tenant_receipt_idempotent_replay_creates_one_movement(): void
    {
        $context = $this->context();

        $payload = $this->payload(
            $context,
            'tenant-replay-' . Str::uuid(),
            10,
            'TENANT-REPLAY'
        );

        $before =
            PharmacoGeneralItemMovement::query()
                ->count();

        $this
            ->postJson(
                $this->receiveUrl(),
                $payload
            )
            ->assertCreated();

        $afterFirst =
            PharmacoGeneralItemMovement::query()
                ->count();

        $this->assertSame(
            $before + 1,
            $afterFirst
        );

        $this
            ->postJson(
                $this->receiveUrl(),
                $payload
            )
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
            PharmacoGeneralItemMovement::query()
                ->count()
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

    public function test_tenant_receipt_reused_key_with_changed_quantity_is_rejected(): void
    {
        $context = $this->context();

        $key =
            'tenant-mismatch-' . Str::uuid();

        $payload = $this->payload(
            $context,
            $key,
            8,
            'TENANT-MISMATCH'
        );

        $this
            ->postJson(
                $this->receiveUrl(),
                $payload
            )
            ->assertCreated();

        $changed = $payload;
        $changed['quantity'] = 9;

        $this
            ->postJson(
                $this->receiveUrl(),
                $changed
            )
            ->assertStatus(409)
            ->assertJsonPath(
                'code',
                'IDEMPOTENCY_KEY_REUSED'
            );
    }

    public function test_same_tenant_reference_and_quantity_is_exact_duplicate(): void
    {
        $context = $this->context();

        $first = $this->payload(
            $context,
            'tenant-exact-first-' . Str::uuid(),
            7,
            'TENANT-EXACT-REFERENCE'
        );

        $this
            ->postJson(
                $this->receiveUrl(),
                $first
            )
            ->assertCreated();

        $movementCount =
            PharmacoGeneralItemMovement::query()
                ->count();

        $second = [
            ...$first,
            'idempotency_key' =>
                'tenant-exact-second-'
                . Str::uuid(),
        ];

        $response = $this
            ->postJson(
                $this->receiveUrl(),
                $second
            );

        $response
            ->assertStatus(409)
            ->assertJsonPath(
                'code',
                'EXACT_DUPLICATE'
            )
            ->assertJsonPath(
                'duplicate.classification',
                'exact'
            )
            ->assertJsonPath(
                'duplicate.override_allowed',
                false
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

        $this->assertSame(
            $movementCount,
            PharmacoGeneralItemMovement::query()
                ->count()
        );
    }

    public function test_tenant_suspected_duplicate_returns_confirmation_token(): void
    {
        $context = $this->context();

        $first = $this->payload(
            $context,
            'tenant-base-' . Str::uuid(),
            6,
            'TENANT-DELIVERY-A'
        );

        $this
            ->postJson(
                $this->receiveUrl(),
                $first
            )
            ->assertCreated();

        $suspected = $this->payload(
            $context,
            'tenant-suspected-' . Str::uuid(),
            6,
            'TENANT-DELIVERY-B'
        );

        $response = $this
            ->postJson(
                $this->receiveUrl(),
                $suspected
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
                'duplicate.duplicate_check_token'
            )
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
    }

    public function test_authorized_tenant_override_creates_one_additional_movement(): void
    {
        $context = $this->context();

        $first = $this->payload(
            $context,
            'tenant-override-base-' . Str::uuid(),
            5,
            'TENANT-OVERRIDE-A'
        );

        $this
            ->postJson(
                $this->receiveUrl(),
                $first
            )
            ->assertCreated();

        $override = $this->payload(
            $context,
            'tenant-override-second-' . Str::uuid(),
            5,
            'TENANT-OVERRIDE-B'
        );

        $conflict = $this
            ->postJson(
                $this->receiveUrl(),
                $override
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

        $before =
            PharmacoGeneralItemMovement::query()
                ->where(
                    'pharmaco_general_item_id',
                    $context['item']->id
                )
                ->where(
                    'pharmaco_general_item_location_id',
                    $context['location']->id
                )
                ->count();

        $override['duplicate_override'] = true;
        $override['duplicate_check_token'] = $token;
        $override['duplicate_override_reason'] =
            'The second tenant delivery was verified '
            . 'against its separate supplier document.';

        $this
            ->postJson(
                $this->receiveUrl(),
                $override
            )
            ->assertCreated();

        $this->assertSame(
            $before + 1,
            PharmacoGeneralItemMovement::query()
                ->where(
                    'pharmaco_general_item_id',
                    $context['item']->id
                )
                ->where(
                    'pharmaco_general_item_location_id',
                    $context['location']->id
                )
                ->count()
        );

        $guard = InventoryReceiptGuard::query()
            ->where(
                'idempotency_key',
                $override['idempotency_key']
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

        $branch = Branch::query()
            ->where(
                'tenant_id',
                $tenant->id
            )
            ->where('status', 'active')
            ->firstOrFail();

        $suffix = Str::upper(
            Str::random(8)
        );

        $category =
            PharmacoGeneralItemCategory::query()
                ->create([
                    'uuid' => (string) Str::uuid(),
                    'tenant_id' => $tenant->id,
                    'name' =>
                        'Tenant Duplicate Test Category',
                    'code' =>
                        'TD-CAT-' . $suffix,
                    'status' => 'active',
                    'description' =>
                        'Tenant duplicate test category.',
                    'metadata' => [
                        'test_fixture' => true,
                    ],
                ]);

        $item =
            PharmacoGeneralItem::query()
                ->create([
                    'uuid' => (string) Str::uuid(),
                    'tenant_id' => $tenant->id,
                    'pharmaco_general_item_category_id' =>
                        $category->id,
                    'name' =>
                        'Tenant Duplicate Test Item',
                    'code' =>
                        'TD-ITEM-' . $suffix,
                    'unit_of_measure' => 'box',
                    'reorder_level' => 5,
                    'minimum_stock_level' => 2,
                    'track_stock' => true,
                    'status' => 'active',
                    'description' =>
                        'Tenant duplicate receipt item.',
                    'metadata' => [
                        'test_fixture' => true,
                    ],
                ]);

        $location =
            PharmacoGeneralItemLocation::query()
                ->create([
                    'uuid' => (string) Str::uuid(),
                    'tenant_id' => $tenant->id,
                    'branch_id' => $branch->id,
                    'name' =>
                        'Tenant Duplicate Test Store',
                    'code' =>
                        'TD-STORE-' . $suffix,
                    'location_type' => 'store',
                    'status' => 'active',
                    'description' =>
                        'Tenant duplicate receipt store.',
                    'metadata' => [
                        'test_fixture' => true,
                    ],
                ]);

        return compact(
            'user',
            'tenant',
            'branch',
            'item',
            'location'
        );
    }

    private function payload(
        array $context,
        string $idempotencyKey,
        float $quantity,
        string $reference
    ): array {
        return [
            'item_id' =>
                $context['item']->id,
            'location_id' =>
                $context['location']->id,
            'quantity' => $quantity,
            'unit_cost' => 4500,
            'reference' => $reference,
            'department' =>
                'Central Operations',
            'notes' =>
                'Automated tenant duplicate test.',
            'idempotency_key' =>
                $idempotencyKey,
        ];
    }

    private function receiveUrl(): string
    {
        return '/api/v1/tenants/'
            . self::TENANT_SLUG
            . '/pharmaco360/general-items/receiving';
    }
}
