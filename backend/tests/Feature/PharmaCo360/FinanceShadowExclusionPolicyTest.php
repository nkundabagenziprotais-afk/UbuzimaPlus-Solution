<?php

namespace Tests\Feature\PharmaCo360;

use App\Services\Finance\FinanceLedgerReportingScope;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class FinanceShadowExclusionPolicyTest extends TestCase
{
    use RefreshDatabase;

    public function test_authoritative_scope_excludes_an_active_policy_record(): void
    {
        $excludedId =
            $this->createJournal(
                status: 'posted',
                idempotencyKey:
                    'test-authoritative-excluded',
            );

        $includedId =
            $this->createJournal(
                status: 'posted',
                idempotencyKey:
                    'test-authoritative-included',
            );

        DB::table(
            'finance_reporting_exclusions'
        )->insert([
            'tenant_id' =>
                1,

            'finance_journal_entry_id' =>
                $excludedId,

            'scope' =>
                'authoritative_reporting',

            'classification' =>
                'excluded_from_authoritative_opening',

            'cohort_key' =>
                'test_cohort',

            'effective_from' =>
                '2026-08-01',

            'status' =>
                'active',

            'approved_by_user_id' =>
                1,

            'approved_by_name' =>
                'Test Approver',

            'approved_at' =>
                now(),

            'evidence_reference' =>
                'test.csv',

            'evidence_sha256' =>
                str_repeat('a', 64),

            'cohort_sha256' =>
                str_repeat('b', 64),

            'reason' =>
                'Test exclusion policy.',

            'metadata' =>
                json_encode([
                    'test' => true,
                ]),

            'created_at' =>
                now(),

            'updated_at' =>
                now(),
        ]);

        $query =
            DB::table(
                'finance_journal_entries'
            );

        $ids = app(
            FinanceLedgerReportingScope::class
        )
            ->applyAuthoritative(
                query: $query,
                tenantId: 1,
                asOfDate: '2026-08-01',
            )
            ->pluck('id')
            ->all();

        $this->assertNotContains(
            $excludedId,
            $ids
        );

        $this->assertContains(
            $includedId,
            $ids
        );
    }

    public function test_future_exclusion_does_not_apply_before_effective_date(): void
    {
        $journalId =
            $this->createJournal(
                status: 'posted',
                idempotencyKey:
                    'test-future-exclusion',
            );

        DB::table(
            'finance_reporting_exclusions'
        )->insert([
            'tenant_id' =>
                1,

            'finance_journal_entry_id' =>
                $journalId,

            'scope' =>
                'authoritative_reporting',

            'classification' =>
                'excluded_from_authoritative_opening',

            'cohort_key' =>
                'test_future',

            'effective_from' =>
                '2026-08-01',

            'status' =>
                'active',

            'approved_by_user_id' =>
                1,

            'approved_by_name' =>
                'Test Approver',

            'approved_at' =>
                now(),

            'evidence_reference' =>
                'test.csv',

            'evidence_sha256' =>
                str_repeat('a', 64),

            'cohort_sha256' =>
                str_repeat('b', 64),

            'reason' =>
                'Test future exclusion.',

            'metadata' =>
                json_encode([
                    'test' => true,
                ]),

            'created_at' =>
                now(),

            'updated_at' =>
                now(),
        ]);

        $ids = app(
            FinanceLedgerReportingScope::class
        )
            ->applyAuthoritative(
                query: DB::table(
                    'finance_journal_entries'
                ),
                tenantId: 1,
                asOfDate: '2026-07-31',
            )
            ->pluck('id')
            ->all();

        $this->assertContains(
            $journalId,
            $ids
        );
    }

    public function test_shadow_diagnostics_remain_visible(): void
    {
        $journalId =
            $this->createJournal(
                status: 'shadow_posted',
                idempotencyKey:
                    'pos-payment-shadow-test',
            );

        $ids = app(
            FinanceLedgerReportingScope::class
        )
            ->applyShadowDiagnostic(
                query: DB::table(
                    'finance_journal_entries'
                ),
                tenantId: 1,
            )
            ->pluck('id')
            ->all();

        $this->assertContains(
            $journalId,
            $ids
        );
    }

    private function createJournal(
        string $status,
        string $idempotencyKey,
    ): int {
        return (int) DB::table(
            'finance_journal_entries'
        )->insertGetId([
            'tenant_id' =>
                1,

            'branch_id' =>
                null,

            'accounting_period_id' =>
                null,

            'journal_number' =>
                'TEST-'
                . strtoupper(
                    substr(
                        hash(
                            'sha256',
                            $idempotencyKey
                        ),
                        0,
                        12
                    )
                ),

            'business_date' =>
                '2026-08-01',

            'source_module' =>
                'test',

            'source_type' =>
                'policy',

            'source_id' =>
                $idempotencyKey,

            'idempotency_key' =>
                $idempotencyKey,

            'status' =>
                $status,

            'currency_code' =>
                'RWF',

            'exchange_rate' =>
                1,

            'total_debit' =>
                100,

            'total_credit' =>
                100,

            'memo' =>
                'Finance reporting scope test.',

            'created_at' =>
                now(),

            'updated_at' =>
                now(),
        ]);
    }
}
