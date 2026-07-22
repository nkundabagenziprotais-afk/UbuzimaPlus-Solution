<?php

namespace Tests\Feature\PharmaCo360;

use App\Data\Finance\FinanceJournalLinePayload;
use App\Data\Finance\FinancePostingPayload;
use App\Models\FinanceAccountMapping;
use App\Models\FinanceAccountingPeriod;
use App\Models\FinanceChartOfAccount;
use App\Models\FinanceJournalEntry;
use App\Models\FinancePostingLog;
use App\Services\Finance\FinanceAccountResolver;
use App\Services\Finance\FinancePeriodGuard;
use App\Services\Finance\FinancePostingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PharmacoFinancePostingEngineTest extends TestCase
{
    use RefreshDatabase;

    public function test_balanced_posting_creates_journal_entry_and_lines(): void
    {
        [$cashAccount, $revenueAccount] = $this->seedAccountsAndMappings();

        $service = $this->postingService();

        $result = $service->post(new FinancePostingPayload(
            tenantId: 1,
            branchId: null,
            businessDate: '2026-07-22',
            sourceModule: 'pos',
            sourceType: 'sale',
            sourceId: 'SALE-001',
            idempotencyKey: 'pos-sale-SALE-001',
            lines: [
                new FinanceJournalLinePayload(
                    mappingKey: 'pos.cash',
                    debit: 1000,
                    description: 'Cash received',
                ),
                new FinanceJournalLinePayload(
                    mappingKey: 'sales.revenue',
                    credit: 1000,
                    description: 'Sales revenue',
                ),
            ],
            memo: 'POS sale posting test',
        ));

        $this->assertInstanceOf(FinanceJournalEntry::class, $result);
        $this->assertSame('posted', $result->status);
        $this->assertSame('1000.0000', $result->total_debit);
        $this->assertSame('1000.0000', $result->total_credit);
        $this->assertCount(2, $result->lines);

        $this->assertDatabaseHas('finance_journal_lines', [
            'chart_of_account_id' => $cashAccount->id,
            'debit' => 1000,
            'credit' => 0,
        ]);

        $this->assertDatabaseHas('finance_journal_lines', [
            'chart_of_account_id' => $revenueAccount->id,
            'debit' => 0,
            'credit' => 1000,
        ]);

        $this->assertDatabaseHas('finance_posting_logs', [
            'tenant_id' => 1,
            'idempotency_key' => 'pos-sale-SALE-001',
            'status' => 'posted',
        ]);
    }

    public function test_unbalanced_posting_is_quarantined(): void
    {
        $this->seedAccountsAndMappings();

        $result = $this->postingService()->post(new FinancePostingPayload(
            tenantId: 1,
            branchId: null,
            businessDate: '2026-07-22',
            sourceModule: 'pos',
            sourceType: 'sale',
            sourceId: 'SALE-002',
            idempotencyKey: 'pos-sale-SALE-002',
            lines: [
                new FinanceJournalLinePayload(mappingKey: 'pos.cash', debit: 1000),
                new FinanceJournalLinePayload(mappingKey: 'sales.revenue', credit: 900),
            ],
        ));

        $this->assertInstanceOf(FinancePostingLog::class, $result);
        $this->assertSame('quarantined', $result->status);
        $this->assertSame('posting_validation_failed', $result->failure_code);
        $this->assertDatabaseCount('finance_journal_entries', 0);
    }

    public function test_duplicate_idempotency_key_returns_existing_journal_entry(): void
    {
        $this->seedAccountsAndMappings();

        $payload = new FinancePostingPayload(
            tenantId: 1,
            branchId: null,
            businessDate: '2026-07-22',
            sourceModule: 'pos',
            sourceType: 'sale',
            sourceId: 'SALE-003',
            idempotencyKey: 'pos-sale-SALE-003',
            lines: [
                new FinanceJournalLinePayload(mappingKey: 'pos.cash', debit: 1000),
                new FinanceJournalLinePayload(mappingKey: 'sales.revenue', credit: 1000),
            ],
        );

        $service = $this->postingService();

        $first = $service->post($payload);
        $second = $service->post($payload);

        $this->assertInstanceOf(FinanceJournalEntry::class, $first);
        $this->assertInstanceOf(FinanceJournalEntry::class, $second);
        $this->assertSame($first->id, $second->id);
        $this->assertDatabaseCount('finance_journal_entries', 1);
        $this->assertDatabaseCount('finance_journal_lines', 2);
    }

    public function test_missing_business_date_is_quarantined(): void
    {
        $this->seedAccountsAndMappings();

        $result = $this->postingService()->post(new FinancePostingPayload(
            tenantId: 1,
            branchId: null,
            businessDate: null,
            sourceModule: 'pos',
            sourceType: 'sale',
            sourceId: 'SALE-004',
            idempotencyKey: 'pos-sale-SALE-004',
            lines: [
                new FinanceJournalLinePayload(mappingKey: 'pos.cash', debit: 1000),
                new FinanceJournalLinePayload(mappingKey: 'sales.revenue', credit: 1000),
            ],
        ));

        $this->assertInstanceOf(FinancePostingLog::class, $result);
        $this->assertSame('quarantined', $result->status);
        $this->assertSame('missing_business_date', $result->failure_code);
    }

    public function test_locked_period_blocks_posting(): void
    {
        $this->seedAccountsAndMappings();

        FinanceAccountingPeriod::query()->create([
            'tenant_id' => 1,
            'branch_id' => null,
            'name' => 'July 2026',
            'starts_on' => '2026-07-01',
            'ends_on' => '2026-07-31',
            'status' => 'closed',
            'is_locked' => true,
        ]);

        $result = $this->postingService()->post(new FinancePostingPayload(
            tenantId: 1,
            branchId: null,
            businessDate: '2026-07-22',
            sourceModule: 'pos',
            sourceType: 'sale',
            sourceId: 'SALE-005',
            idempotencyKey: 'pos-sale-SALE-005',
            lines: [
                new FinanceJournalLinePayload(mappingKey: 'pos.cash', debit: 1000),
                new FinanceJournalLinePayload(mappingKey: 'sales.revenue', credit: 1000),
            ],
        ));

        $this->assertInstanceOf(FinancePostingLog::class, $result);
        $this->assertSame('quarantined', $result->status);
        $this->assertSame('posting_validation_failed', $result->failure_code);
        $this->assertStringContainsString('closed or locked', $result->failure_message);
    }

    public function test_missing_account_mapping_is_quarantined(): void
    {
        $this->seedAccountsAndMappings();

        $result = $this->postingService()->post(new FinancePostingPayload(
            tenantId: 1,
            branchId: null,
            businessDate: '2026-07-22',
            sourceModule: 'pos',
            sourceType: 'sale',
            sourceId: 'SALE-006',
            idempotencyKey: 'pos-sale-SALE-006',
            lines: [
                new FinanceJournalLinePayload(mappingKey: 'pos.cash', debit: 1000),
                new FinanceJournalLinePayload(mappingKey: 'sales.tax', credit: 1000),
            ],
        ));

        $this->assertInstanceOf(FinancePostingLog::class, $result);
        $this->assertSame('quarantined', $result->status);
        $this->assertStringContainsString('Missing finance account mapping', $result->failure_message);
    }

    private function postingService(): FinancePostingService
    {
        return new FinancePostingService(
            new FinanceAccountResolver(),
            new FinancePeriodGuard(),
        );
    }

    /**
     * @return array{0: FinanceChartOfAccount, 1: FinanceChartOfAccount}
     */
    private function seedAccountsAndMappings(): array
    {
        $cashAccount = FinanceChartOfAccount::query()->create([
            'tenant_id' => 1,
            'code' => '1000',
            'name' => 'Cash on Hand',
            'account_type' => 'asset',
            'normal_balance' => 'debit',
            'is_cash_or_bank' => true,
            'is_active' => true,
        ]);

        $revenueAccount = FinanceChartOfAccount::query()->create([
            'tenant_id' => 1,
            'code' => '4000',
            'name' => 'Sales Revenue',
            'account_type' => 'income',
            'normal_balance' => 'credit',
            'is_active' => true,
        ]);

        FinanceAccountMapping::query()->create([
            'tenant_id' => 1,
            'mapping_key' => 'pos.cash',
            'finance_chart_of_account_id' => $cashAccount->id,
            'source_module' => 'pos',
            'source_type' => 'payment',
            'payment_method' => 'cash',
            'currency_code' => 'RWF',
            'is_default' => true,
            'is_active' => true,
        ]);

        FinanceAccountMapping::query()->create([
            'tenant_id' => 1,
            'mapping_key' => 'sales.revenue',
            'finance_chart_of_account_id' => $revenueAccount->id,
            'source_module' => 'sales',
            'source_type' => 'revenue',
            'currency_code' => 'RWF',
            'is_default' => true,
            'is_active' => true,
        ]);

        return [$cashAccount, $revenueAccount];
    }
}
