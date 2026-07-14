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

class PharmacoGeneralItemDuplicateReceivingApiTest
    extends TestCase
{
    use RefreshDatabase;

    private const TENANT_SLUG = 'vitapharma';

    public function test_identical_direct_receipt_replays_without_second_movement(): void
    {
        $context = $this->context();

        $payload = $this->payload(
            $context,
            'general-item-replay-' . Str::uuid(),
            10,
            'DELIVERY-REPLAY'
        );

        $before =
            PharmacoGeneralItemMovement::query()
                ->count();

        $first = $this
            ->withTenant()
            ->postJson(
                '/api/v1/pharmaco/general-item-stock/receive',
                $payload
            );

        $first->assertCreated();

        $afterFirst =
            PharmacoGeneralItemMovement::query()
                ->count();

        $this->assertSame(
            $before + 1,
            $afterFirst
        );

        $second = $this
            ->withTenant()
            ->postJson(
                '/api/v1/pharmaco/general-item-stock/receive',
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

    public function test_reused_key_with_changed_quantity_is_rejected(): void
    {
        $context = $this->context();

        $key =
            'general-item-mismatch-' . Str::uuid();

        $payload = $this->payload(
            $context,
            $key,
            8,
            'DELIVERY-MISMATCH'
        );

        $this
            ->withTenant()
            ->postJson(
                '/api/v1/pharmaco/general-item-stock/receive',
                $payload
            )
            ->assertCreated();

        $changed = $payload;
        $changed['quantity'] = 9;

        $this
            ->withTenant()
            ->postJson(
                '/api/v1/pharmaco/general-item-stock/receive',
                $changed
            )
            ->assertStatus(409)
            ->assertJsonPath(
                'code',
                'IDEMPOTENCY_KEY_REUSED'
            );
    }

    public function test_similar_direct_receipt_returns_existing_user_date_and_token(): void
    {
        $context = $this->context();

        $first = $this->payload(
            $context,
            'general-item-first-' . Str::uuid(),
            12,
            'DELIVERY-A'
        );

        $this
            ->withTenant()
            ->postJson(
                '/api/v1/pharmaco/general-item-stock/receive',
                $first
            )
            ->assertCreated();

        $suspected = $this->payload(
            $context,
            'general-item-suspected-' . Str::uuid(),
            12,
            'DELIVERY-B'
        );

        $response = $this
            ->withTenant()
            ->postJson(
                '/api/v1/pharmaco/general-item-stock/receive',
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

        $this->assertSame(
            $context['user']->id,
            $response->json(
                'duplicate.existing_record.recorded_user.id'
            )
        );

        $this->assertNotEmpty(
            $response->json(
                'duplicate.existing_record.recorded_at'
            )
        );

        $this->assertNotEmpty(
            $response->json(
                'duplicate.duplicate_check_token'
            )
        );
    }

    public function test_authorized_override_creates_one_additional_movement(): void
    {
        $context = $this->context();

        $first = $this->payload(
            $context,
            'general-item-base-' . Str::uuid(),
            6,
            'DELIVERY-BASE'
        );

        $this
            ->withTenant()
            ->postJson(
                '/api/v1/pharmaco/general-item-stock/receive',
                $first
            )
            ->assertCreated();

        $override = $this->payload(
            $context,
            'general-item-override-' . Str::uuid(),
            6,
            'DELIVERY-SECOND'
        );

        $conflict = $this
            ->withTenant()
            ->postJson(
                '/api/v1/pharmaco/general-item-stock/receive',
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
            'A second delivery note was verified '
            . 'against the physical stock received.';

        $this
            ->withTenant()
            ->postJson(
                '/api/v1/pharmaco/general-item-stock/receive',
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
                        'Duplicate Test Category',
                    'code' =>
                        'DUP-CAT-' . $suffix,
                    'status' => 'active',
                    'description' =>
                        'Automated duplicate test category.',
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
                        'Duplicate Test General Item',
                    'code' =>
                        'DUP-ITEM-' . $suffix,
                    'unit_of_measure' => 'box',
                    'reorder_level' => 5,
                    'minimum_stock_level' => 2,
                    'track_stock' => true,
                    'status' => 'active',
                    'description' =>
                        'Automated duplicate receipt item.',
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
                        'Duplicate Test Store',
                    'code' =>
                        'DUP-STORE-' . $suffix,
                    'location_type' => 'store',
                    'status' => 'active',
                    'description' =>
                        'Automated duplicate receipt location.',
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
        string $referenceNumber
    ): array {
        return [
            'branch_id' =>
                $context['branch']->id,
            'pharmaco_general_item_id' =>
                $context['item']->id,
            'pharmaco_general_item_location_id' =>
                $context['location']->id,
            'quantity' => $quantity,
            'unit_cost' => 5000,
            'reference_type' =>
                'supplier_delivery',
            'reference_number' =>
                $referenceNumber,
            'reason' =>
                'Automated duplicate prevention test.',
            'occurred_at' =>
                now()->toIso8601String(),
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
