<?php

namespace Tests\Feature\PharmaCo360;

use App\Services\Inventory\ProductReconciliationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class ProductReconciliationFoundationTest extends TestCase
{
    use RefreshDatabase;

    public function test_reconciliation_tables_are_available(): void
    {
        $this->assertTrue(Schema::hasTable('product_reconciliation_batches'));
        $this->assertTrue(Schema::hasTable('product_reconciliation_rows'));
        $this->assertTrue(Schema::hasTable('product_aliases'));
        $this->assertTrue(Schema::hasTable('product_payer_prices'));
        $this->assertTrue(Schema::hasTable('product_duplicate_proposals'));

        $this->assertTrue(
            Schema::hasColumns('product_reconciliation_rows', [
                'batch_id',
                'tenant_id',
                'source_row',
                'source_code',
                'product_name',
                'generic_name',
                'normalized_key',
                'matched_product_id',
                'match_method',
                'match_score',
                'proposed_action',
                'review_status',
                'source_payload',
                'dependency_snapshot',
            ])
        );
    }

    public function test_normalization_is_stable_and_human_readable(): void
    {
        $this->assertSame(
            'aero chamber child 1 5 years',
            ProductReconciliationService::normalizeText(
                ' AERO-CHAMBER Child 1–5 Years '
            )
        );

        $this->assertSame(
            'baby haler|infant|inhalation spacer|1 kit',
            ProductReconciliationService::normalizedKey(
                'BABY HALER',
                'Infant',
                'Inhalation Spacer',
                '1 KIT'
            )
        );
    }

    public function test_reconciliation_routes_are_registered(): void
    {
        $expectedRoutes = [
            'product-reconciliation.summary',
            'product-reconciliation.rows',
            'product-reconciliation.rows.review',
            'product-reconciliation.duplicates',
            'product-reconciliation.duplicates.review',
            'product-reconciliation.payer-prices',
        ];

        foreach ($expectedRoutes as $routeName) {
            $this->assertNotNull(
                Route::getRoutes()->getByName($routeName),
                "Missing route: {$routeName}"
            );
        }
    }
}
