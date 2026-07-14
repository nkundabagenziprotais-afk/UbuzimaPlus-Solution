<?php

namespace Tests\Feature\PharmaCo360;

use App\Models\InventoryReceiptGuard;
use App\Services\Inventory\InventoryDuplicateDetectionService;
use App\Support\OperationalPermissionContract;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class InventoryDuplicateDetectionServiceTest
    extends TestCase
{
    use RefreshDatabase;

    public function test_receipt_guard_schema_is_additive_and_indexable(): void
    {
        $this->assertTrue(
            Schema::hasTable(
                'inventory_receipt_guards'
            )
        );

        $this->assertTrue(
            Schema::hasColumns(
                'inventory_receipt_guards',
                [
                    'tenant_id',
                    'operation_type',
                    'subject_type',
                    'subject_id',
                    'location_type',
                    'location_id',
                    'idempotency_key',
                    'request_hash',
                    'duplicate_classification',
                    'matched_transaction_id',
                    'override_user_id',
                    'override_reason',
                    'duplicate_token_hash',
                    'metadata',
                    'completed_at',
                ]
            )
        );
    }

    public function test_request_hash_is_stable_for_reordered_payloads(): void
    {
        $service =
            app(
                InventoryDuplicateDetectionService::class
            );

        $left = $service->requestHash([
            'product_id' => 10,
            'batch_number' => ' AB-123 ',
            'quantity' => 25,
            'nested' => [
                'location_id' => 3,
                'reference' => 'INV-001',
            ],
        ]);

        $right = $service->requestHash([
            'nested' => [
                'reference' => 'INV-001',
                'location_id' => 3,
            ],
            'quantity' => 25,
            'batch_number' => ' AB-123 ',
            'product_id' => 10,
        ]);

        $this->assertSame($left, $right);
    }

    public function test_same_source_line_is_an_exact_duplicate(): void
    {
        $service =
            app(
                InventoryDuplicateDetectionService::class
            );

        $result = $service->evaluateReceipt(
            [
                'subject_id' => 20,
                'location_id' => 4,
                'batch_number' => 'BATCH-001',
                'quantity' => 15,
                'source_line_type' =>
                    'pharmaco_purchase_order_item',
                'source_line_id' => 45,
                'reference_number' => 'PO-100',
            ],
            [
                [
                    'id' => 90,
                    'subject_id' => 20,
                    'location_id' => 4,
                    'batch_number' => 'batch 001',
                    'quantity' => 15,
                    'source_line_type' =>
                        'pharmaco_purchase_order_item',
                    'source_line_id' => 45,
                    'reference_number' => 'PO-100',
                    'occurred_at' => now()->subMinutes(5),
                    'recorded_user' => [
                        'id' => 7,
                        'name' => 'Receiving User',
                    ],
                ],
            ]
        );

        $this->assertSame(
            InventoryDuplicateDetectionService::
                CLASSIFICATION_EXACT,
            $result['classification']
        );

        $this->assertSame(
            90,
            $result['existing_record']['id']
        );

        $this->assertContains(
            'Same purchase-order or source-document line',
            $result['match_reasons']
        );
    }

    public function test_same_medicine_batch_location_is_suspected(): void
    {
        $service =
            app(
                InventoryDuplicateDetectionService::class
            );

        $result = $service->evaluateReceipt(
            [
                'subject_id' => 20,
                'location_id' => 4,
                'batch_number' => 'MED-7788',
                'quantity' => 10,
                'expiry_date' => '2028-12-31',
            ],
            [
                [
                    'id' => 91,
                    'subject_id' => 20,
                    'location_id' => 4,
                    'batch_number' => 'med 7788',
                    'quantity' => 8,
                    'expiry_date' => '2028-12-31',
                    'occurred_at' => now()->subHours(2),
                ],
            ]
        );

        $this->assertSame(
            InventoryDuplicateDetectionService::
                CLASSIFICATION_SUSPECTED,
            $result['classification']
        );

        $this->assertGreaterThanOrEqual(
            70,
            $result['confidence_score']
        );
    }


    public function test_same_source_line_with_different_quantity_is_not_exact(): void
    {
        $service =
            app(
                InventoryDuplicateDetectionService::class
            );

        $result = $service->evaluateReceipt(
            [
                'subject_id' => 20,
                'location_id' => 4,
                'batch_number' => 'PARTIAL-001',
                'quantity' => 7,
                'source_line_type' =>
                    'pharmaco_purchase_order_item',
                'source_line_id' => 45,
            ],
            [
                [
                    'id' => 93,
                    'subject_id' => 20,
                    'location_id' => 4,
                    'batch_number' => 'partial 001',
                    'quantity' => 5,
                    'source_line_type' =>
                        'pharmaco_purchase_order_item',
                    'source_line_id' => 45,
                    'occurred_at' => now()->subMinutes(5),
                ],
            ]
        );

        $this->assertNotSame(
            InventoryDuplicateDetectionService::
                CLASSIFICATION_EXACT,
            $result['classification']
        );
    }

    public function test_quantity_alone_does_not_create_duplicate(): void
    {
        $service =
            app(
                InventoryDuplicateDetectionService::class
            );

        $result = $service->evaluateReceipt(
            [
                'subject_id' => 20,
                'location_id' => 4,
                'quantity' => 10,
            ],
            [
                [
                    'id' => 92,
                    'subject_id' => 99,
                    'location_id' => 4,
                    'quantity' => 10,
                    'occurred_at' => now()->subMinutes(2),
                ],
            ]
        );

        $this->assertSame(
            InventoryDuplicateDetectionService::
                CLASSIFICATION_NONE,
            $result['classification']
        );
    }

    public function test_idempotency_guard_replays_without_second_row(): void
    {
        $service =
            app(
                InventoryDuplicateDetectionService::class
            );

        $context = [
            'tenant_id' => $this->createTenantId(),
            'operation_type' =>
                'medicine_receipt',
            'subject_type' => 'product',
            'subject_id' => 8,
            'location_type' =>
                'stock_location',
            'location_id' => 3,
            'idempotency_key' =>
                'receipt-uat-001',
            'request_hash' => $service->requestHash([
                'product_id' => 8,
                'location_id' => 3,
                'quantity' => 5,
            ]),
        ];

        $first = $service->reserveGuard($context);
        $second = $service->reserveGuard($context);

        $this->assertFalse($first['replayed']);
        $this->assertTrue($second['replayed']);
        $this->assertFalse(
            $second['payload_mismatch']
        );

        $this->assertSame(
            $first['guard']->id,
            $second['guard']->id
        );

        $this->assertSame(
            1,
            InventoryReceiptGuard::query()->count()
        );
    }

    public function test_duplicate_token_is_tenant_and_payload_bound(): void
    {
        config()->set(
            'app.key',
            'base64:'
            . base64_encode(
                str_repeat('k', 32)
            )
        );

        $service =
            app(
                InventoryDuplicateDetectionService::class
            );

        $hash = $service->requestHash([
            'subject_id' => 5,
            'quantity' => 12,
        ]);

        $token = $service->issueDuplicateToken(
            1,
            'medicine_receipt',
            $hash,
            'stock_movement',
            22
        );

        $this->assertTrue(
            $service->verifyDuplicateToken(
                $token,
                1,
                'medicine_receipt',
                $hash
            )
        );

        $this->assertFalse(
            $service->verifyDuplicateToken(
                $token,
                2,
                'medicine_receipt',
                $hash
            )
        );

        $this->assertFalse(
            $service->verifyDuplicateToken(
                $token . 'tampered',
                1,
                'medicine_receipt',
                $hash
            )
        );
    }

    public function test_override_permission_is_in_operational_contract(): void
    {
        $expanded =
            OperationalPermissionContract::expand([
                'pharmaco.inventory.manage',
            ]);

        $this->assertContains(
            'pharmaco.inventory.duplicate_override',
            $expanded
        );

        $this->assertArrayHasKey(
            'pharmaco.inventory.duplicate_override',
            OperationalPermissionContract::definitions()
        );
    }

    private function createTenantId(): int
    {
        $columns = collect(
            DB::select(
                'PRAGMA table_info("tenants")'
            )
        );

        if ($columns->isEmpty()) {
            throw new \RuntimeException(
                'Tenants table schema was not found.'
            );
        }

        $available = $columns
            ->pluck('name')
            ->map(
                fn ($name): string =>
                    (string) $name
            )
            ->all();

        $suffix = Str::lower(Str::random(10));

        $candidateValues = [
            'uuid' => (string) Str::uuid(),
            'name' =>
                'Duplicate Prevention Test Tenant',
            'slug' =>
                'duplicate-prevention-' . $suffix,
            'code' =>
                'DUP-' . Str::upper(
                    Str::random(8)
                ),
            'email' =>
                "duplicate-{$suffix}@example.test",
            'status' => 'active',
            'tenant_type' => 'pharmacy',
            'business_type' => 'pharmacy',
            'country_code' => 'RW',
            'currency' => 'RWF',
            'timezone' => 'Africa/Kigali',
            'locale' => 'en',
            'plan' => 'standard',
            'subscription_status' => 'active',
            'metadata' => json_encode(
                [],
                JSON_THROW_ON_ERROR
            ),
            'created_at' => now(),
            'updated_at' => now(),
        ];

        $row = [];

        foreach ($columns as $column) {
            $name = (string) $column->name;

            if ($name === 'id') {
                continue;
            }

            if (
                array_key_exists(
                    $name,
                    $candidateValues
                )
            ) {
                $row[$name] =
                    $candidateValues[$name];

                continue;
            }

            $required =
                (int) $column->notnull === 1
                && $column->dflt_value === null;

            if (! $required) {
                continue;
            }

            $type = strtolower(
                (string) $column->type
            );

            $row[$name] = match (true) {
                str_contains($type, 'int') => 1,
                str_contains($type, 'real') => 0,
                str_contains($type, 'numeric') => 0,
                str_contains($type, 'decimal') => 0,
                str_contains($type, 'double') => 0,
                str_contains($type, 'float') => 0,
                str_contains($type, 'date') => now(),
                str_contains($type, 'time') => now(),
                str_contains($type, 'json') =>
                    json_encode(
                        [],
                        JSON_THROW_ON_ERROR
                    ),
                default =>
                    'test-' . $suffix,
            };
        }

        foreach (
            $candidateValues
            as $name => $value
        ) {
            if (
                in_array($name, $available, true)
                && ! array_key_exists($name, $row)
            ) {
                $row[$name] = $value;
            }
        }

        return (int) DB::table('tenants')
            ->insertGetId($row);
    }

}
