<?php

declare(strict_types=1);

namespace Tests\Feature\PharmaCo360;

use App\Models\StockBatch;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PharmacoInventoryBatchTenantResolutionApiTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;

    private User $administrator;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed();

        $this->tenant = Tenant::query()
            ->where('slug', 'vitapharma')
            ->firstOrFail();

        $this->administrator = User::query()
            ->where('email', 'admin@vitapharmaafrica.com')
            ->firstOrFail();

        Sanctum::actingAs($this->administrator);
    }

    public function test_tenant_administrator_can_update_manual_inventory_batch(): void
    {
        $batch = $this->createManualBatch();

        $newBatchNumber = 'MANUAL-UPDATE-'
            . Str::upper(Str::random(10));

        $response = $this
            ->tenantRequest()
            ->putJson(
                '/api/v1/pharmaco/inventory/batches/'
                . $batch->id,
                [
                    'product_id' => $batch->product_id,
                    'stock_location_id' => $batch->stock_location_id,
                    'batch_number' => $newBatchNumber,
                    'quantity' => 3,
                    'expiry_date' => $batch->expiry_date
                        ? date(
                            'Y-m-d',
                            strtotime(
                                (string) $batch->expiry_date
                            )
                        )
                        : null,
                    'unit_cost' => (float) (
                        $batch->unit_cost ?? 0
                    ),
                ],
            );

        $response->assertSuccessful();

        $this->assertDatabaseHas(
            'stock_batches',
            [
                'id' => $batch->id,
                'tenant_id' => $this->tenant->id,
                'batch_number' => $newBatchNumber,
            ],
        );
    }

    public function test_tenant_administrator_can_delete_manual_batch_with_delete_route(): void
    {
        $batch = $this->createManualBatch();

        $response = $this
            ->tenantRequest()
            ->deleteJson(
                '/api/v1/pharmaco/inventory/batches/'
                . $batch->id,
            );

        $response->assertSuccessful();

        $this->assertDatabaseMissing(
            'stock_batches',
            [
                'id' => $batch->id,
            ],
        );
    }

    public function test_tenant_administrator_can_delete_manual_batch_with_compatibility_post_route(): void
    {
        $batch = $this->createManualBatch();

        $response = $this
            ->tenantRequest()
            ->postJson(
                '/api/v1/pharmaco/inventory/batches/'
                . $batch->id
                . '/delete',
            );

        $response->assertSuccessful();

        $this->assertDatabaseMissing(
            'stock_batches',
            [
                'id' => $batch->id,
            ],
        );
    }

    private function tenantRequest(): self
    {
        return $this->withHeaders([
            'Accept' => 'application/json',
            'X-Tenant-Slug' => $this->tenant->slug,
            'X-Tenant' => $this->tenant->slug,
        ]);
    }

    private function createManualBatch(): StockBatch
    {
        $source = DB::table('stock_batches')
            ->where('tenant_id', $this->tenant->id)
            ->first();

        $this->assertNotNull(
            $source,
            'The seeded tenant must have at least one stock batch.',
        );

        $columns = Schema::getColumnListing(
            'stock_batches',
        );

        $payload = array_intersect_key(
            (array) $source,
            array_flip($columns),
        );

        unset($payload['id']);

        $suffix = Str::upper(Str::random(12));

        $this->setWhenColumnExists(
            $payload,
            $columns,
            'batch_number',
            'MANUAL-' . $suffix,
        );

        foreach (
            [
                'uuid',
                'code',
                'reference',
                'source_reference',
                'external_reference',
            ] as $column
        ) {
            if (
                in_array($column, $columns, true)
                && array_key_exists($column, $payload)
                && $payload[$column] !== null
            ) {
                $payload[$column] = $column
                    . '-'
                    . Str::lower($suffix);
            }
        }

        foreach (
            [
                'purchase_order_id',
                'purchase_order_item_id',
                'supplier_invoice_id',
                'supplier_invoice_item_id',
            ] as $column
        ) {
            $this->setWhenColumnExists(
                $payload,
                $columns,
                $column,
                null,
            );
        }

        foreach (
            [
                'quantity',
                'quantity_reserved',
                'reserved_quantity',
                'received_quantity',
                'issued_quantity',
            ] as $column
        ) {
            $this->setWhenColumnExists(
                $payload,
                $columns,
                $column,
                0,
            );
        }

        foreach (
            [
                'source',
                'receipt_source',
                'inventory_source',
                'source_type',
            ] as $column
        ) {
            $this->setWhenColumnExists(
                $payload,
                $columns,
                $column,
                'manual',
            );
        }

        $this->setWhenColumnExists(
            $payload,
            $columns,
            'metadata',
            json_encode(
                [
                    'manual_product_master_entry' => true,
                    'test_fixture' => true,
                ],
                JSON_THROW_ON_ERROR,
            ),
        );

        $this->setWhenColumnExists(
            $payload,
            $columns,
            'deleted_at',
            null,
        );

        $now = now()->format('Y-m-d H:i:s');

        $this->setWhenColumnExists(
            $payload,
            $columns,
            'created_at',
            $now,
        );

        $this->setWhenColumnExists(
            $payload,
            $columns,
            'updated_at',
            $now,
        );

        $id = DB::table('stock_batches')
            ->insertGetId($payload);

        return StockBatch::query()->findOrFail($id);
    }

    /**
     * @param array<string, mixed> $payload
     * @param array<int, string> $columns
     */
    private function setWhenColumnExists(
        array &$payload,
        array $columns,
        string $column,
        mixed $value,
    ): void {
        if (in_array($column, $columns, true)) {
            $payload[$column] = $value;
        }
    }
}
