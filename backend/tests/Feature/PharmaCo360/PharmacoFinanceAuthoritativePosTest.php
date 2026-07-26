<?php

namespace Tests\Feature\PharmaCo360;

use App\Models\FinanceAccountingPeriod;
use App\Models\FinanceJournalEntry;
use App\Models\FinancePostingLog;
use App\Models\PharmacoPayment;
use App\Models\PharmacoSale;
use App\Models\PharmacoSaleItem;
use App\Models\StockBatch;
use App\Services\Finance\PharmacoPosPaymentAuthoritativePostingService;
use App\Services\Finance\PharmacoPosSaleAuthoritativePostingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use LogicException;
use Tests\TestCase;

class PharmacoFinanceAuthoritativePosTest extends TestCase
{
    use RefreshDatabase;

    public function test_authoritative_sale_posts_revenue_cogs_and_inventory(): void
    {
        $sale = $this->prepareSale(
            createPeriod: true
        );

        $result = app(
            PharmacoPosSaleAuthoritativePostingService::class
        )->postSale($sale);

        $this->assertInstanceOf(
            FinanceJournalEntry::class,
            $result
        );

        $this->assertSame(
            'posted',
            $result->status
        );

        $this->assertSame(
            'sale',
            $result->source_type
        );

        $this->assertSame(
            '1400.0000',
            $result->total_debit
        );

        $this->assertSame(
            '1400.0000',
            $result->total_credit
        );

        $this->assertCount(
            4,
            $result->lines
        );

        $item = $sale
            ->fresh('items')
            ->items
            ->firstOrFail();

        $this->assertSame(
            '100.0000',
            $item->cost_unit_snapshot
        );

        $this->assertSame(
            '200.0000',
            $item->cost_total_snapshot
        );

        $this->assertDatabaseHas(
            'finance_journal_lines',
            [
                'journal_entry_id' => $result->id,
                'line_type' => 'cogs',
                'debit' => 200,
            ]
        );

        $this->assertDatabaseHas(
            'finance_journal_lines',
            [
                'journal_entry_id' => $result->id,
                'line_type' => 'inventory_asset',
                'credit' => 200,
            ]
        );
    }

    public function test_authoritative_sale_without_period_is_quarantined(): void
    {
        $sale = $this->prepareSale(
            createPeriod: false
        );

        $result = app(
            PharmacoPosSaleAuthoritativePostingService::class
        )->postSale($sale);

        $this->assertInstanceOf(
            FinancePostingLog::class,
            $result
        );

        $this->assertSame(
            'quarantined',
            $result->status
        );

        $this->assertSame(
            'posting_validation_failed',
            $result->failure_code
        );

        $this->assertStringContainsString(
            'No open accounting period',
            $result->failure_message
        );

        $this->assertDatabaseCount(
            'finance_journal_entries',
            0
        );
    }

    public function test_authoritative_payment_clears_receivable(): void
    {
        $sale = $this->prepareSale(
            createPeriod: true
        );

        $payment = $this->createPayment(
            $sale,
            'cash'
        );

        $result = app(
            PharmacoPosPaymentAuthoritativePostingService::class
        )->postPayment(
            $payment,
            $sale,
        );

        $this->assertInstanceOf(
            FinanceJournalEntry::class,
            $result
        );

        $this->assertSame(
            'posted',
            $result->status
        );

        $this->assertCount(
            2,
            $result->lines
        );

        $this->assertDatabaseHas(
            'finance_journal_lines',
            [
                'journal_entry_id' => $result->id,
                'line_type' => 'payment_receipt',
                'debit' => 500,
                'payment_method' => 'cash',
            ]
        );

        $this->assertDatabaseHas(
            'finance_journal_lines',
            [
                'journal_entry_id' => $result->id,
                'line_type' =>
                    'accounts_receivable_clearance',
                'credit' => 500,
            ]
        );
    }

    public function test_unknown_payment_method_is_not_treated_as_cash(): void
    {
        $sale = $this->prepareSale(
            createPeriod: true
        );

        $payment = $this->createPayment(
            $sale,
            'cheque'
        );

        $result = app(
            PharmacoPosPaymentAuthoritativePostingService::class
        )->postPayment(
            $payment,
            $sale,
        );

        $this->assertInstanceOf(
            FinancePostingLog::class,
            $result
        );

        $this->assertSame(
            'quarantined',
            $result->status
        );

        $this->assertSame(
            'unknown_payment_method',
            $result->failure_code
        );

        $this->assertDatabaseCount(
            'finance_journal_entries',
            0
        );
    }

    public function test_cost_snapshot_is_immutable_after_posting(): void
    {
        $sale = $this->prepareSale(
            createPeriod: true
        );

        app(
            PharmacoPosSaleAuthoritativePostingService::class
        )->postSale($sale);

        $item = $sale
            ->fresh('items')
            ->items
            ->firstOrFail();

        $this->expectException(
            LogicException::class
        );

        $item->cost_unit_snapshot = 999;
        $item->save();
    }

    private function prepareSale(
        bool $createPeriod,
    ): PharmacoSale {
        $this->seed();

        $sale = PharmacoSale::query()
            ->with('items')
            ->where(
                'sale_number',
                'SALE-VITA-DRAFT-0001'
            )
            ->firstOrFail();

        $item = $sale->items->firstOrFail();

        $sale->items()
            ->where('id', '<>', $item->id)
            ->delete();

        $batch = StockBatch::query()
            ->where(
                'tenant_id',
                $sale->tenant_id
            )
            ->firstOrFail();

        $batch->forceFill([
            'unit_cost' => 100,
            'original_unit_cost' => 100,
            'cost_source' => 'verified_test_cost',
            'cost_adjustment_method' => 'direct',
            'cost_resolved_at' => now(),
        ])->save();

        $item->forceFill([
            'product_id' => $batch->product_id,
            'stock_batch_id' => $batch->id,
            'stock_location_id' =>
                $batch->stock_location_id,
            'quantity' => 2,
            'unit_price' => 600,
            'discount_amount' => 0,
            'tax_amount' => 0,
            'line_total' => 1200,
            'status' => 'dispensed',
        ])->save();

        $sale->forceFill([
            'status' => 'dispensed',
            'subtotal_amount' => 1200,
            'discount_amount' => 0,
            'tax_amount' => 0,
            'total_amount' => 1200,
            'paid_amount' => 0,
            'balance_amount' => 1200,
            'payment_status' => 'unpaid',
            'business_date' => '2026-07-26',
            'sold_at' => '2026-07-26 10:00:00',
        ])->save();

        if ($createPeriod) {
            FinanceAccountingPeriod::query()->create([
                'tenant_id' => $sale->tenant_id,
                'branch_id' => null,
                'name' => 'July 2026',
                'starts_on' => '2026-07-01',
                'ends_on' => '2026-07-31',
                'status' => 'open',
                'is_locked' => false,
            ]);
        }

        return $sale->fresh([
            'items.stockBatch',
        ]);
    }

    private function createPayment(
        PharmacoSale $sale,
        string $method,
    ): PharmacoPayment {
        return PharmacoPayment::query()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $sale->tenant_id,
            'pharmaco_sale_id' => $sale->id,
            'business_date' => '2026-07-26',
            'amount' => 500,
            'payment_method' => $method,
            'status' => 'completed',
            'receipt_number' =>
                'TEST-RCPT-' . Str::upper(
                    Str::random(8)
                ),
            'received_at' =>
                '2026-07-26 10:05:00',
            'metadata' => [],
        ]);
    }
}
