<?php

declare(strict_types=1);

namespace Tests\Feature\PharmaCo360;

use App\Services\Inventory\ProductMasterCorrectionService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

final class ProductMasterInhalerCorrectionTest extends TestCase
{
    use RefreshDatabase;

    public function test_approved_inhaler_products_receive_specific_generic_descriptions(): void
    {
        $this->seed();

        $tenantId = $this->tenantId();

        $this->createCorrectionProducts($tenantId);

        $result = app(
            ProductMasterCorrectionService::class
        )->applyForTenantSlug('vitapharma');

        $this->assertSame(
            9,
            $result['updated']
        );

        foreach (
            ProductMasterCorrectionService::corrections()
            as $correction
        ) {
            $this->assertDatabaseHas('products', [
                'tenant_id' => $tenantId,
                'sku' => $correction['sku'],
                'name' => $correction['expected_name'],
                'generic_name' =>
                    $correction['corrected_generic'],
            ]);
        }
    }

    public function test_correction_preserves_product_identity_and_inventory_links(): void
    {
        $this->seed();

        $tenantId = $this->tenantId();

        $this->createCorrectionProducts($tenantId);

        $product = DB::table('products')
            ->where('tenant_id', $tenantId)
            ->where('sku', '42271802FDM010')
            ->first();

        $this->assertNotNull($product);

        $batch = DB::table('stock_batches')
            ->where('tenant_id', $tenantId)
            ->first();

        $this->assertNotNull(
            $batch,
            'The inventory seed must provide a stock batch.'
        );

        DB::table('stock_batches')
            ->where('id', $batch->id)
            ->update([
                'product_id' => $product->id,
                'quantity_on_hand' => 1,
            ]);

        $movement = DB::table('stock_movements')
            ->where('tenant_id', $tenantId)
            ->first();

        $this->assertNotNull(
            $movement,
            'The inventory seed must provide a stock movement.'
        );

        DB::table('stock_movements')
            ->where('id', $movement->id)
            ->update([
                'product_id' => $product->id,
                'stock_batch_id' => $batch->id,
                'quantity' => 1,
            ]);

        $productIdBefore = (int) $product->id;

        $batchCountBefore = DB::table('stock_batches')
            ->where('product_id', $productIdBefore)
            ->count();

        $movementCountBefore = DB::table(
            'stock_movements'
        )
            ->where('product_id', $productIdBefore)
            ->count();

        $quantityBefore = (float) DB::table(
            'stock_batches'
        )
            ->where('product_id', $productIdBefore)
            ->sum('quantity_on_hand');

        $result = app(
            ProductMasterCorrectionService::class
        )->applyForTenantSlug('vitapharma');

        $updatedProduct = DB::table('products')
            ->where('tenant_id', $tenantId)
            ->where('sku', '42271802FDM010')
            ->first();

        $this->assertNotNull($updatedProduct);

        $this->assertSame(
            $productIdBefore,
            (int) $updatedProduct->id
        );

        $this->assertSame(
            'Infant inhalation spacer and holding chamber (Babyhaler)',
            $updatedProduct->generic_name
        );

        $this->assertContains(
            $productIdBefore,
            $result['updated_product_ids']
        );

        $this->assertDatabaseHas('stock_batches', [
            'id' => $batch->id,
            'product_id' => $productIdBefore,
            'quantity_on_hand' => 1,
        ]);

        $this->assertDatabaseHas('stock_movements', [
            'id' => $movement->id,
            'product_id' => $productIdBefore,
            'stock_batch_id' => $batch->id,
            'quantity' => 1,
        ]);

        $this->assertSame(
            $batchCountBefore,
            DB::table('stock_batches')
                ->where(
                    'product_id',
                    $productIdBefore
                )
                ->count()
        );

        $this->assertSame(
            $movementCountBefore,
            DB::table('stock_movements')
                ->where(
                    'product_id',
                    $productIdBefore
                )
                ->count()
        );

        $this->assertSame(
            $quantityBefore,
            (float) DB::table('stock_batches')
                ->where(
                    'product_id',
                    $productIdBefore
                )
                ->sum('quantity_on_hand')
        );
    }

    public function test_human_reviewed_generic_description_is_not_overwritten(): void
    {
        $this->seed();

        $tenantId = $this->tenantId();

        $this->createCorrectionProducts($tenantId);

        $product = DB::table('products')
            ->where('tenant_id', $tenantId)
            ->where('sku', '42271802FDM010')
            ->first();

        $this->assertNotNull($product);

        DB::table('products')
            ->where('id', $product->id)
            ->update([
                'generic_name' =>
                    'Human-reviewed custom device description',
            ]);

        $result = app(
            ProductMasterCorrectionService::class
        )->applyForTenantSlug('vitapharma');

        $this->assertDatabaseHas('products', [
            'id' => $product->id,
            'generic_name' =>
                'Human-reviewed custom device description',
        ]);

        $this->assertGreaterThanOrEqual(
            1,
            $result['skipped_conflict']
        );
    }

    public function test_import_normalizer_uses_approved_description_only_for_the_original_generic(): void
    {
        $this->assertSame(
            'Valved holding chamber with adult mouthpiece',
            ProductMasterCorrectionService::correctedGenericName(
                '42271802FDM008',
                ProductMasterCorrectionService::ORIGINAL_GENERIC
            )
        );

        $this->assertSame(
            'Human-reviewed description',
            ProductMasterCorrectionService::correctedGenericName(
                '42271802FDM008',
                'Human-reviewed description'
            )
        );
    }

    private function tenantId(): int
    {
        $tenantId = DB::table('tenants')
            ->where('slug', 'vitapharma')
            ->value('id');

        $this->assertNotNull($tenantId);

        return (int) $tenantId;
    }

    private function createCorrectionProducts(
        int $tenantId
    ): void {
        $baseProduct = DB::table('products')
            ->where('tenant_id', $tenantId)
            ->first();

        $this->assertNotNull(
            $baseProduct,
            'The default seed must provide a base product.'
        );

        $baseRow = (array) $baseProduct;

        unset($baseRow['id']);

        foreach (
            ProductMasterCorrectionService::corrections()
            as $index => $correction
        ) {
            $row = $baseRow;

            $row['tenant_id'] = $tenantId;
            $row['sku'] = $correction['sku'];
            $row['name'] = $correction['expected_name'];
            $row['generic_name'] =
                ProductMasterCorrectionService::ORIGINAL_GENERIC;

            $uniqueSuffix = Str::lower(
                Str::random(12)
            );

            foreach (
                [
                    'uuid',
                    'code',
                    'product_code',
                    'drug_code',
                    'barcode',
                    'gtin',
                    'ean',
                    'upc',
                    'external_id',
                ]
                as $uniqueColumn
            ) {
                if (
                    ! array_key_exists(
                        $uniqueColumn,
                        $row
                    )
                ) {
                    continue;
                }

                if ($uniqueColumn === 'uuid') {
                    $row[$uniqueColumn] =
                        (string) Str::uuid();

                    continue;
                }

                $row[$uniqueColumn] =
                    $correction['sku']
                    . '-'
                    . $uniqueSuffix;
            }

            if (array_key_exists('code', $row)) {
                $row['code'] =
                    $correction['sku'];
            }

            if (
                array_key_exists(
                    'product_code',
                    $row
                )
            ) {
                $row['product_code'] =
                    $correction['sku'];
            }

            if (
                array_key_exists(
                    'drug_code',
                    $row
                )
            ) {
                $row['drug_code'] =
                    $correction['sku'];
            }

            if (array_key_exists('slug', $row)) {
                $row['slug'] =
                    Str::slug(
                        $correction['expected_name']
                    )
                    . '-'
                    . $uniqueSuffix;
            }

            if (array_key_exists('metadata', $row)) {
                $row['metadata'] = json_encode([
                    'source' =>
                        'ProductMasterInhalerCorrectionTest',
                    'fixture_index' => $index,
                ]);
            }

            if (array_key_exists('created_at', $row)) {
                $row['created_at'] = now();
            }

            if (array_key_exists('updated_at', $row)) {
                $row['updated_at'] = now();
            }

            DB::table('products')->insert($row);
        }
    }
}
