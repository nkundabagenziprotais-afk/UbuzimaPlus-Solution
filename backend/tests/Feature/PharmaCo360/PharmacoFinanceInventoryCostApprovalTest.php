<?php

namespace Tests\Feature\PharmaCo360;

use App\Models\FinanceInventoryCostApproval;
use App\Models\StockBatch;
use App\Services\Finance\FinanceAuthoritativePostingReadinessService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use LogicException;
use Tests\TestCase;

class PharmacoFinanceInventoryCostApprovalTest extends TestCase
{
    use RefreshDatabase;

    public function test_template_generation_is_read_only(): void
    {
        $batch = $this->prepareUnresolvedBatch();

        $output = $this->temporaryPath(
            'template.csv'
        );

        $status = Artisan::call(
            'finance:inventory-cost-approvals:template',
            [
                '--tenant_id' => 1,
                '--cutover_date' => '2026-08-01',
                '--output' => $output,
            ]
        );

        $this->assertSame(0, $status);
        $this->assertFileExists($output);

        $content = file_get_contents($output);

        $this->assertStringContainsString(
            'selling_price_used',
            $content
        );

        $this->assertStringContainsString(
            (string) $batch->id,
            $content
        );

        $this->assertDatabaseCount(
            'finance_inventory_cost_approvals',
            0
        );
    }

    public function test_dry_run_validates_without_writing(): void
    {
        $batch = $this->prepareUnresolvedBatch();
        $file = $this->approvalCsv($batch);

        $status = Artisan::call(
            'finance:inventory-cost-approvals:apply',
            [
                'file' => $file,
                '--tenant_id' => 1,
                '--cutover_date' => '2026-08-01',
            ]
        );

        $this->assertSame(0, $status);

        $this->assertDatabaseCount(
            'finance_inventory_cost_approvals',
            0
        );

        $this->assertNull(
            $batch->fresh()->inferred_unit_cost
        );
    }

    public function test_apply_requires_exact_reviewed_file_hash(): void
    {
        $batch = $this->prepareUnresolvedBatch();
        $file = $this->approvalCsv($batch);

        $status = Artisan::call(
            'finance:inventory-cost-approvals:apply',
            [
                'file' => $file,
                '--tenant_id' => 1,
                '--cutover_date' => '2026-08-01',
                '--apply' => true,
            ]
        );

        $this->assertSame(1, $status);

        $this->assertDatabaseCount(
            'finance_inventory_cost_approvals',
            0
        );
    }

    public function test_approved_opening_valuation_updates_batch_and_preserves_audit_record(): void
    {
        $batch = $this->prepareUnresolvedBatch();
        $file = $this->approvalCsv($batch);
        $hash = hash_file('sha256', $file);

        $journalsBefore = DB::table(
            'finance_journal_entries'
        )->count();

        $status = Artisan::call(
            'finance:inventory-cost-approvals:apply',
            [
                'file' => $file,
                '--tenant_id' => 1,
                '--cutover_date' => '2026-08-01',
                '--confirm-sha256' => $hash,
                '--apply' => true,
            ]
        );

        $this->assertSame(0, $status);

        $this->assertDatabaseHas(
            'finance_inventory_cost_approvals',
            [
                'tenant_id' => 1,
                'stock_batch_id' => $batch->id,
                'approved_unit_cost' => 1250,
                'approval_method' =>
                    'opening_valuation',
                'status' => 'approved',
                'source_file_sha256' => $hash,
            ]
        );

        $approval =
            FinanceInventoryCostApproval::query()
                ->firstOrFail();

        $this->assertSame(
            '2026-08-01',
            $approval->effective_date
                ->toDateString()
        );

        $freshBatch = $batch->fresh();

        $this->assertEqualsWithDelta(
            1250.0,
            (float) $freshBatch->inferred_unit_cost,
            0.0001
        );

        $this->assertSame(
            'finance_inventory_cost_approval',
            $freshBatch->cost_source
        );

        $this->assertNull(
            $freshBatch->unit_cost
        );

        $this->assertNull(
            $freshBatch->original_unit_cost
        );

        $this->assertSame(
            $journalsBefore,
            DB::table(
                'finance_journal_entries'
            )->count()
        );
    }

    public function test_reapplying_same_file_is_idempotent(): void
    {
        $batch = $this->prepareUnresolvedBatch();
        $file = $this->approvalCsv($batch);
        $hash = hash_file('sha256', $file);

        $arguments = [
            'file' => $file,
            '--tenant_id' => 1,
            '--cutover_date' => '2026-08-01',
            '--confirm-sha256' => $hash,
            '--apply' => true,
        ];

        $this->assertSame(
            0,
            Artisan::call(
                'finance:inventory-cost-approvals:apply',
                $arguments
            )
        );

        $this->assertSame(
            0,
            Artisan::call(
                'finance:inventory-cost-approvals:apply',
                $arguments
            )
        );

        $this->assertDatabaseCount(
            'finance_inventory_cost_approvals',
            1
        );
    }

    public function test_generated_timestamp_file_reapplication_is_idempotent(): void
    {
        $batch = $this->prepareUnresolvedBatch();

        $expectedUpdatedAt =
            $batch->fresh()
                ->updated_at
                ?->toISOString();

        $this->assertNotNull(
            $expectedUpdatedAt
        );

        $file = $this->approvalCsv(
            $batch,
            [
                'expected_batch_updated_at' =>
                    $expectedUpdatedAt,
            ]
        );

        $hash = hash_file(
            'sha256',
            $file
        );

        $arguments = [
            'file' => $file,
            '--tenant_id' => 1,
            '--cutover_date' =>
                '2026-08-01',
            '--confirm-sha256' =>
                $hash,
            '--apply' => true,
        ];

        $this->assertSame(
            0,
            Artisan::call(
                'finance:inventory-cost-approvals:apply',
                $arguments
            )
        );

        $approval =
            FinanceInventoryCostApproval::query()
                ->firstOrFail();

        $approvalId = $approval->id;

        $batchUpdatedAtAfterFirstApply =
            $batch->fresh()
                ->updated_at
                ?->toISOString();

        $this->assertSame(
            0,
            Artisan::call(
                'finance:inventory-cost-approvals:apply',
                $arguments
            )
        );

        $commandOutput =
            Artisan::output();

        $this->assertStringContainsString(
            'Idempotent rows: 1',
            $commandOutput
        );

        $this->assertStringContainsString(
            'New approvals applied: 0',
            $commandOutput
        );

        $this->assertStringContainsString(
            'Database writes: NO',
            $commandOutput
        );

        $this->assertDatabaseCount(
            'finance_inventory_cost_approvals',
            1
        );

        $this->assertSame(
            $approvalId,
            FinanceInventoryCostApproval::query()
                ->firstOrFail()
                ->id
        );

        $this->assertSame(
            $batchUpdatedAtAfterFirstApply,
            $batch->fresh()
                ->updated_at
                ?->toISOString()
        );
    }

    public function test_different_file_does_not_bypass_stale_timestamp_guard(): void
    {
        $batch = $this->prepareUnresolvedBatch();

        $expectedUpdatedAt =
            $batch->fresh()
                ->updated_at
                ?->toISOString();

        $this->assertNotNull(
            $expectedUpdatedAt
        );

        $firstFile = $this->approvalCsv(
            $batch,
            [
                'expected_batch_updated_at' =>
                    $expectedUpdatedAt,

                'source_reference' =>
                    'IDEMPOTENCY-EXACT-FILE-001',
            ]
        );

        $firstHash = hash_file(
            'sha256',
            $firstFile
        );

        $this->assertSame(
            0,
            Artisan::call(
                'finance:inventory-cost-approvals:apply',
                [
                    'file' =>
                        $firstFile,

                    '--tenant_id' =>
                        1,

                    '--cutover_date' =>
                        '2026-08-01',

                    '--confirm-sha256' =>
                        $firstHash,

                    '--apply' =>
                        true,
                ]
            )
        );

        DB::table(
            'stock_batches'
        )
            ->where(
                'id',
                $batch->id
            )
            ->update([
                'updated_at' =>
                    now()->addMinutes(5),
            ]);

        $this->assertNotSame(
            $expectedUpdatedAt,
            $batch->fresh()
                ->updated_at
                ?->toISOString()
        );
        $differentFile = $this->approvalCsv(
            $batch,
            [
                'expected_batch_updated_at' =>
                    $expectedUpdatedAt,

                'source_reference' =>
                    'IDEMPOTENCY-DIFFERENT-FILE-002',

                'approval_notes' =>
                    'A different reviewed file must not bypass stale-state validation.',
            ]
        );

        $this->assertNotSame(
            $firstHash,
            hash_file(
                'sha256',
                $differentFile
            )
        );

        $this->assertSame(
            1,
            Artisan::call(
                'finance:inventory-cost-approvals:apply',
                [
                    'file' =>
                        $differentFile,

                    '--tenant_id' =>
                        1,

                    '--cutover_date' =>
                        '2026-08-01',
                ]
            )
        );

        $commandOutput =
            Artisan::output();

        $this->assertStringContainsString(
            'changed after template generation',
            $commandOutput
        );

        $this->assertStringContainsString(
            'Database writes: NO',
            $commandOutput
        );

        $this->assertDatabaseCount(
            'finance_inventory_cost_approvals',
            1
        );
    }
    public function test_selling_price_cost_basis_is_rejected(): void
    {
        $batch = $this->prepareUnresolvedBatch();

        $file = $this->approvalCsv(
            $batch,
            [
                'selling_price_used' => 'yes',
                'valuation_basis' =>
                    'Calculated directly from selling price',
            ]
        );

        $status = Artisan::call(
            'finance:inventory-cost-approvals:apply',
            [
                'file' => $file,
                '--tenant_id' => 1,
                '--cutover_date' => '2026-08-01',
            ]
        );

        $this->assertSame(1, $status);

        $this->assertDatabaseCount(
            'finance_inventory_cost_approvals',
            0
        );
    }

    public function test_owner_approved_price_divisor_applies_exact_formula(): void
    {
        $batch = $this->prepareUnresolvedBatch();

        $file = $this->approvalCsv(
            $batch,
            [
                'approved_unit_cost' =>
                    3571.4286,
                'approval_method' =>
                    'owner_approved_price_divisor',
                'valuation_basis' =>
                    'Owner-approved opening valuation using selling price divided by 1.4.',
                'source_reference' =>
                    'OWNER-PRICE-DIVISOR-TEST-001',
                'source_document_date' =>
                    '',
                'approval_notes' =>
                    'Owner approved the prospective selling-price divisor valuation method.',
                'selling_price_used' =>
                    'yes',
                'derivation_divisor' =>
                    '1.4',
                'derivation_formula' =>
                    'approved_unit_cost = expected_selling_price / derivation_divisor',
            ]
        );

        $hash = hash_file(
            'sha256',
            $file
        );

        $journalsBefore = DB::table(
            'finance_journal_entries'
        )->count();

        $status = Artisan::call(
            'finance:inventory-cost-approvals:apply',
            [
                'file' => $file,
                '--tenant_id' => 1,
                '--cutover_date' =>
                    '2026-08-01',
                '--confirm-sha256' =>
                    $hash,
                '--apply' => true,
            ]
        );

        $this->assertSame(0, $status);

        $commandOutput = Artisan::output();

        $this->assertStringContainsString(
            'Selling-price-derived approvals: 1',
            $commandOutput
        );

        $this->assertStringContainsString(
            'Selling price used as cost: YES_CONTROLLED_OWNER_APPROVED',
            $commandOutput
        );

        $approval =
            FinanceInventoryCostApproval::query()
                ->firstOrFail();

        $this->assertSame(
            'owner_approved_price_divisor',
            $approval->approval_method
        );

        $this->assertTrue(
            (bool) data_get(
                $approval->approval_evidence,
                'selling_price_used'
            )
        );

        $this->assertEqualsWithDelta(
            5000.0,
            (float) data_get(
                $approval->approval_evidence,
                'selling_price_snapshot'
            ),
            0.0001
        );

        $this->assertEqualsWithDelta(
            1.4,
            (float) data_get(
                $approval->approval_evidence,
                'derivation_divisor'
            ),
            0.0001
        );

        $this->assertEqualsWithDelta(
            3571.4286,
            (float) $batch->fresh()
                ->inferred_unit_cost,
            0.0001
        );

        $this->assertSame(
            $journalsBefore,
            DB::table(
                'finance_journal_entries'
            )->count()
        );
    }

    public function test_owner_approved_price_divisor_rejects_incorrect_calculation(): void
    {
        $batch = $this->prepareUnresolvedBatch();

        $file = $this->approvalCsv(
            $batch,
            [
                'approved_unit_cost' =>
                    3500,
                'approval_method' =>
                    'owner_approved_price_divisor',
                'valuation_basis' =>
                    'Owner-approved opening valuation using selling price divided by 1.4.',
                'source_reference' =>
                    'OWNER-PRICE-DIVISOR-TEST-002',
                'source_document_date' =>
                    '',
                'approval_notes' =>
                    'This intentionally incorrect calculation must be rejected.',
                'selling_price_used' =>
                    'yes',
                'derivation_divisor' =>
                    '1.4',
                'derivation_formula' =>
                    'approved_unit_cost = expected_selling_price / derivation_divisor',
            ]
        );

        $status = Artisan::call(
            'finance:inventory-cost-approvals:apply',
            [
                'file' => $file,
                '--tenant_id' => 1,
                '--cutover_date' =>
                    '2026-08-01',
            ]
        );

        $this->assertSame(1, $status);

        $this->assertDatabaseCount(
            'finance_inventory_cost_approvals',
            0
        );

        $this->assertNull(
            $batch->fresh()
                ->inferred_unit_cost
        );
    }

    public function test_approval_record_is_immutable(): void
    {
        $batch = $this->prepareUnresolvedBatch();
        $file = $this->approvalCsv($batch);
        $hash = hash_file('sha256', $file);

        Artisan::call(
            'finance:inventory-cost-approvals:apply',
            [
                'file' => $file,
                '--tenant_id' => 1,
                '--cutover_date' => '2026-08-01',
                '--confirm-sha256' => $hash,
                '--apply' => true,
            ]
        );

        $approval =
            FinanceInventoryCostApproval::query()
                ->firstOrFail();

        $this->expectException(
            LogicException::class
        );

        $approval->approval_notes =
            'Attempted unauthorised change';

        $approval->save();
    }

    public function test_zero_stock_historical_batch_does_not_block_prospective_cutover(): void
    {
        $batch = $this->prepareUnresolvedBatch();

        $readiness = app(
            FinanceAuthoritativePostingReadinessService::class
        );

        $before = $readiness->report(1);

        $beforeCount = $before[
            'blocking_counts'
        ][
            'active_inventory_batches_missing_approved_cost'
        ];

        $this->assertGreaterThanOrEqual(
            1,
            $beforeCount
        );

        $batch->forceFill([
            'quantity_on_hand' => 0,
        ])->save();

        $after = $readiness->report(1);

        $afterCount = $after[
            'blocking_counts'
        ][
            'active_inventory_batches_missing_approved_cost'
        ];

        $this->assertSame(
            $beforeCount - 1,
            $afterCount
        );

        $this->assertArrayHasKey(
            'historical_exception_counts',
            $after
        );
    }

    private function prepareUnresolvedBatch(): StockBatch
    {
        $this->seed();

        $batch = StockBatch::query()
            ->where('tenant_id', 1)
            ->firstOrFail();

        $batch->forceFill([
            'quantity_on_hand' => 5,
            'quantity_reserved' => 0,
            'unit_cost' => null,
            'original_unit_cost' => null,
            'inferred_unit_cost' => null,
            'cost_source' => null,
            'cost_adjustment_method' => null,
            'cost_resolution_notes' => null,
            'cost_resolved_at' => null,
            'selling_price' => 5000,
        ])->save();

        return $batch->fresh();
    }

    /**
     * @param array<string, mixed> $overrides
     */
    private function approvalCsv(
        StockBatch $batch,
        array $overrides = [],
    ): string {
        $approverId = (int) DB::table(
            'users'
        )->value('id');

        $row = array_merge(
            [
                'tenant_id' => 1,
                'stock_batch_id' => $batch->id,
                'product_id' => $batch->product_id,
                'product_name' => 'Test product',
                'product_sku' => 'TEST-SKU',
                'batch_number' =>
                    $batch->batch_number,
                'expected_quantity_on_hand' => 5,
                'expected_quantity_reserved' => 0,
                'expected_batch_updated_at' => '',
                'expected_selling_price' => 5000,
                'derivation_divisor' => '',
                'derivation_formula' => '',
                'decision' => 'approve',
                'approved_unit_cost' => 1250,
                'currency_code' => 'RWF',
                'approval_method' =>
                    'opening_valuation',
                'effective_date' =>
                    '2026-08-01',
                'valuation_basis' =>
                    'Signed opening inventory valuation register',
                'source_reference' =>
                    'OPENING-VALUATION-TEST-001',
                'source_document_date' =>
                    '2026-08-01',
                'approved_by_user_id' =>
                    $approverId,
                'approval_notes' =>
                    'Approved for prospective Finance cutover testing.',
                'evidence_reviewed' => 'yes',
                'selling_price_used' => 'no',
            ],
            $overrides,
        );

        $path = $this->temporaryPath(
            'approval.csv'
        );

        $handle = fopen(
            $path,
            'wb'
        );

        $headers = array_keys($row);

        fputcsv(
            $handle,
            $headers,
            ',',
            '"',
            ''
        );

        fputcsv(
            $handle,
            array_values($row),
            ',',
            '"',
            ''
        );

        fclose($handle);

        return $path;
    }

    private function temporaryPath(
        string $suffix,
    ): string {
        $directory = storage_path(
            'framework/testing/finance-cost-approvals'
        );

        if (! is_dir($directory)) {
            mkdir(
                $directory,
                0770,
                true
            );
        }

        return $directory
            . '/'
            . Str::uuid()
            . '-'
            . $suffix;
    }
}
