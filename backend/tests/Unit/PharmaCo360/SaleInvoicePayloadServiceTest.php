<?php

declare(strict_types=1);

namespace Tests\Unit\PharmaCo360;

use App\Models\PharmacoSale;
use App\Services\PharmaCo360\SaleInvoicePayloadService;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Database\Eloquent\Model;
use PHPUnit\Framework\TestCase;

final class SaleInvoicePayloadServiceTest extends TestCase
{
    public function test_invoice_uses_persisted_values(): void
    {
        $sale = new PharmacoSale();

        $sale->forceFill([
            'id' => 44,
            'sale_number' => 'SALE-2026-0044',
            'status' => 'completed',
            'subtotal_amount' => 5000,
            'discount_amount' => 300,
            'tax_amount' => 500,
            'total_amount' => 5200,
            'balance_amount' => 0,
        ]);

        $item = $this->model([
            'id' => 501,
            'product_id' => 100,
            'product_name_snapshot' => 'Moods Banana',
            'sku_snapshot' => 'MOODS-BANANA',
            'quantity' => 2,
            'unit_price' => 2500,
            'discount_amount' => 300,
            'tax_amount' => 500,
            'line_total' => 5200,
        ]);

        $payment = $this->model([
            'id' => 601,
            'payment_method' => 'cash',
            'amount' => 5200,
            'status' => 'completed',
            'receipt_number' => 'RCT-2026-0601',
        ]);

        $sale->setRelation(
            'items',
            new EloquentCollection([$item])
        );

        $sale->setRelation(
            'payments',
            new EloquentCollection([$payment])
        );

        $invoice = (
            new SaleInvoicePayloadService()
        )->build(
            sale: $sale,
            reprint: true
        );

        self::assertTrue(
            $invoice['is_reprint']
        );

        self::assertSame(
            'SALE-2026-0044',
            $invoice['invoice_number']
        );

        self::assertSame(
            5200.0,
            $invoice['totals']['total_amount']
        );

        self::assertSame(
            5200.0,
            $invoice['totals']['paid_amount']
        );

        self::assertSame(
            'Moods Banana',
            $invoice['items'][0]['product_name']
        );

        self::assertSame(
            2.0,
            $invoice['items'][0]['quantity']
        );

        self::assertFalse(
            $invoice['document_integrity']
                ['current_catalogue_prices_used']
        );
    }

    private function model(
        array $attributes
    ): Model {
        $model = new class extends Model {
            public $timestamps = false;

            protected $guarded = [];
        };

        $model->forceFill($attributes);

        return $model;
    }
}
