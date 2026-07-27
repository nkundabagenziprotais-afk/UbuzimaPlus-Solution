<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use RuntimeException;
use Throwable;

class FinanceShadowExclusionsApply extends Command
{
    protected $signature =
        'finance:shadow-exclusions:apply
        {csv : Audited legacy shadow-journal CSV}
        {--tenant_id=1 : Tenant ID}
        {--expected_count=57 : Expected cohort row count}
        {--expected_cohort_sha256= : Expected canonical cohort SHA-256}
        {--scope=authoritative_reporting : Reporting exclusion scope}
        {--classification=excluded_from_authoritative_opening : Exclusion classification}
        {--cohort_key=legacy_payment_shadow_57 : Stable cohort key}
        {--effective_from=2026-08-01 : Effective date}
        {--approved_by_user_id=1 : Approver user ID}
        {--approved_by_name=Ubuzima+ Super Admin : Approver name}
        {--approval_statement= : Owner approval statement}
        {--evidence_reference= : Evidence file reference}
        {--evidence_sha256= : Evidence file SHA-256}
        {--apply : Persist exclusions; otherwise dry-run}';

    protected $description =
        'Register immutable reporting exclusions for an approved shadow-journal cohort.';

    public function handle(): int
    {
        try {
            $result =
                $this->validateAndPrepare();

            $this->printValidation(
                $result
            );

            if (! $this->option('apply')) {
                $this->line(
                    'Database writes: NO'
                );

                $this->info(
                    'Shadow exclusion dry-run passed.'
                );

                return self::SUCCESS;
            }

            $created = 0;
            $existing = 0;

            DB::transaction(
                function () use (
                    $result,
                    &$created,
                    &$existing,
                ): void {
                    foreach (
                        $result['rows']
                        as $row
                    ) {
                        $match = DB::table(
                            'finance_reporting_exclusions'
                        )
                            ->where(
                                'tenant_id',
                                $result['tenant_id']
                            )
                            ->where(
                                'finance_journal_entry_id',
                                $row['journal_id']
                            )
                            ->where(
                                'scope',
                                $result['scope']
                            )
                            ->first();

                        if ($match !== null) {
                            $this->assertExistingMatch(
                                $match,
                                $result
                            );

                            $existing++;

                            continue;
                        }

                        $now =
                            now()->toDateTimeString();

                        DB::table(
                            'finance_reporting_exclusions'
                        )->insert([
                            'tenant_id' =>
                                $result['tenant_id'],

                            'finance_journal_entry_id' =>
                                $row['journal_id'],

                            'scope' =>
                                $result['scope'],

                            'classification' =>
                                $result['classification'],

                            'cohort_key' =>
                                $result['cohort_key'],

                            'effective_from' =>
                                $result['effective_from'],

                            'status' =>
                                'active',

                            'approved_by_user_id' =>
                                $result[
                                    'approved_by_user_id'
                                ],

                            'approved_by_name' =>
                                $result[
                                    'approved_by_name'
                                ],

                            'approved_at' =>
                                $now,

                            'evidence_reference' =>
                                $result[
                                    'evidence_reference'
                                ],

                            'evidence_sha256' =>
                                $result[
                                    'evidence_sha256'
                                ],

                            'cohort_sha256' =>
                                $result[
                                    'cohort_sha256'
                                ],

                            'reason' =>
                                $result[
                                    'approval_statement'
                                ],

                            'metadata' =>
                                json_encode(
                                    [
                                        'policy_version' =>
                                            'phase_2q_v1',

                                        'source_cohort' =>
                                            'phase_2p_legacy_57',

                                        'journal_status_preserved' =>
                                            true,

                                        'journal_reversal_created' =>
                                            false,

                                        'later_shadow_policy' =>
                                            'retain_shadow_until_cutover',

                                        'authoritative_reporting_policy' =>
                                            'exclude_approved_legacy_cohort',
                                    ],
                                    JSON_THROW_ON_ERROR
                                    | JSON_UNESCAPED_SLASHES
                                ),

                            'created_at' =>
                                $now,

                            'updated_at' =>
                                $now,
                        ]);

                        $created++;
                    }
                }
            );

            $this->line(
                "Rows created: {$created}"
            );

            $this->line(
                "Rows existing idempotent: {$existing}"
            );

            $this->line(
                'Journal rows modified: 0'
            );

            $this->line(
                'Journal lines modified: 0'
            );

            $this->line(
                'Posting logs modified: 0'
            );

            $this->line(
                'Database writes: REPORTING_EXCLUSIONS_ONLY'
            );

            $this->info(
                'Approved shadow exclusions applied.'
            );

            return self::SUCCESS;
        } catch (Throwable $exception) {
            $this->error(
                $exception->getMessage()
            );

            return self::FAILURE;
        }
    }

    private function validateAndPrepare(): array
    {
        foreach (
            [
                'finance_journal_entries',
                'finance_journal_lines',
                'finance_reporting_exclusions',
            ]
            as $table
        ) {
            if (! Schema::hasTable($table)) {
                throw new RuntimeException(
                    "Required table is missing: {$table}"
                );
            }
        }

        $csvPath =
            (string) $this->argument('csv');

        if (! is_file($csvPath)) {
            throw new RuntimeException(
                'Audited cohort CSV is missing.'
            );
        }

        $tenantId =
            (int) $this->option(
                'tenant_id'
            );

        $expectedCount =
            (int) $this->option(
                'expected_count'
            );

        $expectedCohortHash =
            strtolower(
                trim(
                    (string) $this->option(
                        'expected_cohort_sha256'
                    )
                )
            );

        $evidenceHash =
            strtolower(
                trim(
                    (string) $this->option(
                        'evidence_sha256'
                    )
                )
            );

        $actualEvidenceHash =
            hash_file(
                'sha256',
                $csvPath
            );

        if (
            $expectedCount <= 0
            || $tenantId <= 0
        ) {
            throw new RuntimeException(
                'Tenant and expected count must be positive.'
            );
        }

        if (
            preg_match(
                '/^[a-f0-9]{64}$/',
                $expectedCohortHash
            ) !== 1
        ) {
            throw new RuntimeException(
                'Expected cohort SHA-256 is invalid.'
            );
        }

        if (
            preg_match(
                '/^[a-f0-9]{64}$/',
                $evidenceHash
            ) !== 1
        ) {
            throw new RuntimeException(
                'Evidence SHA-256 is invalid.'
            );
        }

        if (
            ! hash_equals(
                $evidenceHash,
                $actualEvidenceHash
            )
        ) {
            throw new RuntimeException(
                'Evidence file SHA-256 mismatch.'
            );
        }

        $rows =
            $this->readCsv(
                $csvPath
            );

        if (
            count($rows)
            !== $expectedCount
        ) {
            throw new RuntimeException(
                'Cohort row count mismatch. '
                . 'Expected '
                . $expectedCount
                . ', found '
                . count($rows)
                . '.'
            );
        }

        usort(
            $rows,
            static fn (
                array $left,
                array $right,
            ): int =>
                $left['journal_id']
                <=>
                $right['journal_id']
        );

        $journalIds =
            array_column(
                $rows,
                'journal_id'
            );

        if (
            count(
                array_unique(
                    $journalIds
                )
            ) !== count($journalIds)
        ) {
            throw new RuntimeException(
                'Duplicate journal IDs exist in the cohort CSV.'
            );
        }

        $canonical = [];

        foreach ($rows as $row) {
            $canonical[] = [
                'journal_id' =>
                    $row['journal_id'],

                'journal_number' =>
                    $row['journal_number'],

                'business_date' =>
                    $row['business_date'],

                'idempotency_key' =>
                    $row['idempotency_key'],

                'total_debit' =>
                    $row['total_debit'],

                'total_credit' =>
                    $row['total_credit'],

                'line_count' =>
                    $row['line_count'],
            ];
        }

        $cohortHash =
            hash(
                'sha256',
                json_encode(
                    $canonical,
                    JSON_THROW_ON_ERROR
                    | JSON_UNESCAPED_SLASHES
                    | JSON_UNESCAPED_UNICODE
                )
            );

        if (
            ! hash_equals(
                $expectedCohortHash,
                $cohortHash
            )
        ) {
            throw new RuntimeException(
                'Canonical cohort SHA-256 mismatch.'
            );
        }

        $journals = DB::table(
            'finance_journal_entries'
        )
            ->where(
                'tenant_id',
                $tenantId
            )
            ->whereIn(
                'id',
                $journalIds
            )
            ->get()
            ->keyBy('id');

        if (
            $journals->count()
            !== $expectedCount
        ) {
            throw new RuntimeException(
                'One or more approved journals are missing.'
            );
        }

        foreach ($rows as $row) {
            $journal =
                $journals->get(
                    $row['journal_id']
                );

            if (
                $journal === null
                || (string) $journal->journal_number
                    !== $row['journal_number']
                || (string) $journal->status
                    !== 'shadow_posted'
                || (string) $journal->source_module
                    !== 'pos'
                || (string) $journal->source_type
                    !== 'payment'
                || (string) $journal->idempotency_key
                    !== $row['idempotency_key']
                || $journal->reversed_entry_id
                    !== null
                || $this->dateOnly(
                    $journal->business_date
                ) !== $row['business_date']
                || $this->decimal4(
                    $journal->total_debit
                ) !== $row['total_debit']
                || $this->decimal4(
                    $journal->total_credit
                ) !== $row['total_credit']
            ) {
                throw new RuntimeException(
                    'Journal invariant mismatch for journal ID '
                    . $row['journal_id']
                    . '.'
                );
            }

            $lineCount = DB::table(
                'finance_journal_lines'
            )
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->where(
                    'journal_entry_id',
                    $row['journal_id']
                )
                ->count();

            if (
                $lineCount
                !== $row['line_count']
            ) {
                throw new RuntimeException(
                    'Journal-line count mismatch for journal ID '
                    . $row['journal_id']
                    . '.'
                );
            }
        }

        $authoritativeCount = DB::table(
            'finance_journal_entries'
        )
            ->where(
                'tenant_id',
                $tenantId
            )
            ->where(
                function ($query): void {
                    $query
                        ->where(
                            'idempotency_key',
                            'like',
                            'pos-sale-authoritative-%'
                        )
                        ->orWhere(
                            'idempotency_key',
                            'like',
                            'pos-payment-authoritative-%'
                        );
                }
            )
            ->count();

        if ($authoritativeCount !== 0) {
            throw new RuntimeException(
                'Authoritative POS journals already exist. '
                . 'The exclusion policy requires a separate review.'
            );
        }

        $scope =
            trim(
                (string) $this->option(
                    'scope'
                )
            );

        $classification =
            trim(
                (string) $this->option(
                    'classification'
                )
            );

        $cohortKey =
            trim(
                (string) $this->option(
                    'cohort_key'
                )
            );

        $effectiveFrom =
            trim(
                (string) $this->option(
                    'effective_from'
                )
            );

        $approvedByName =
            trim(
                (string) $this->option(
                    'approved_by_name'
                )
            );

        $approvalStatement =
            trim(
                (string) $this->option(
                    'approval_statement'
                )
            );

        $evidenceReference =
            trim(
                (string) $this->option(
                    'evidence_reference'
                )
            );

        if (
            preg_match(
                '/^\d{4}-\d{2}-\d{2}$/',
                $effectiveFrom
            ) !== 1
        ) {
            throw new RuntimeException(
                'Effective date must be YYYY-MM-DD.'
            );
        }

        foreach (
            [
                'scope' =>
                    $scope,

                'classification' =>
                    $classification,

                'cohort key' =>
                    $cohortKey,

                'approved-by name' =>
                    $approvedByName,

                'approval statement' =>
                    $approvalStatement,

                'evidence reference' =>
                    $evidenceReference,
            ]
            as $label => $value
        ) {
            if ($value === '') {
                throw new RuntimeException(
                    ucfirst($label)
                    . ' is required.'
                );
            }
        }

        return [
            'rows' =>
                $rows,

            'tenant_id' =>
                $tenantId,

            'scope' =>
                $scope,

            'classification' =>
                $classification,

            'cohort_key' =>
                $cohortKey,

            'effective_from' =>
                $effectiveFrom,

            'approved_by_user_id' =>
                (int) $this->option(
                    'approved_by_user_id'
                ),

            'approved_by_name' =>
                $approvedByName,

            'approval_statement' =>
                $approvalStatement,

            'evidence_reference' =>
                $evidenceReference,

            'evidence_sha256' =>
                $actualEvidenceHash,

            'cohort_sha256' =>
                $cohortHash,
        ];
    }

    private function readCsv(
        string $path
    ): array {
        $handle =
            fopen(
                $path,
                'rb'
            );

        if (! is_resource($handle)) {
            throw new RuntimeException(
                'Unable to open audited cohort CSV.'
            );
        }

        $header =
            fgetcsv(
                $handle,
                null,
                ',',
                '"',
                ''
            );

        if (! is_array($header)) {
            fclose($handle);

            throw new RuntimeException(
                'Audited cohort CSV header is missing.'
            );
        }

        $header[0] =
            preg_replace(
                '/^\xEF\xBB\xBF/',
                '',
                (string) $header[0]
            );

        $required = [
            'cohort',
            'journal_id',
            'journal_number',
            'journal_status',
            'journal_business_date',
            'journal_total_debit',
            'journal_total_credit',
            'idempotency_key',
            'line_count',
        ];

        foreach ($required as $column) {
            if (
                ! in_array(
                    $column,
                    $header,
                    true
                )
            ) {
                fclose($handle);

                throw new RuntimeException(
                    "Required CSV column is missing: {$column}"
                );
            }
        }

        $rows = [];

        while (
            (
                $values =
                    fgetcsv(
                        $handle,
                        null,
                        ',',
                        '"',
                        ''
                    )
            ) !== false
        ) {
            if (
                $values === [null]
                || $values === []
            ) {
                continue;
            }

            $values =
                array_pad(
                    $values,
                    count($header),
                    ''
                );

            $record =
                array_combine(
                    $header,
                    array_slice(
                        $values,
                        0,
                        count($header)
                    )
                );

            if (! is_array($record)) {
                fclose($handle);

                throw new RuntimeException(
                    'Unable to decode a cohort CSV row.'
                );
            }

            if (
                (string) $record['cohort']
                !== 'legacy_reference_57'
            ) {
                fclose($handle);

                throw new RuntimeException(
                    'CSV contains a row outside the approved legacy cohort.'
                );
            }

            if (
                (string) $record['journal_status']
                !== 'shadow_posted'
            ) {
                fclose($handle);

                throw new RuntimeException(
                    'CSV contains a non-shadow journal.'
                );
            }

            $journalId =
                (int) $record['journal_id'];

            if ($journalId <= 0) {
                fclose($handle);

                throw new RuntimeException(
                    'CSV contains an invalid journal ID.'
                );
            }

            $idempotencyKey =
                trim(
                    (string) $record[
                        'idempotency_key'
                    ]
                );

            if (
                ! str_starts_with(
                    $idempotencyKey,
                    'pos-payment-shadow-'
                )
            ) {
                fclose($handle);

                throw new RuntimeException(
                    'CSV contains an invalid shadow idempotency key.'
                );
            }

            $businessDate =
                trim(
                    (string) $record[
                        'journal_business_date'
                    ]
                );

            $rows[] = [
                'journal_id' =>
                    $journalId,

                'journal_number' =>
                    trim(
                        (string) $record[
                            'journal_number'
                        ]
                    ),

                'business_date' =>
                    $businessDate === ''
                        ? null
                        : $businessDate,

                'idempotency_key' =>
                    $idempotencyKey,

                'total_debit' =>
                    $this->decimal4(
                        $record[
                            'journal_total_debit'
                        ]
                    ),

                'total_credit' =>
                    $this->decimal4(
                        $record[
                            'journal_total_credit'
                        ]
                    ),

                'line_count' =>
                    (int) $record[
                        'line_count'
                    ],
            ];
        }

        fclose($handle);

        return $rows;
    }

    private function assertExistingMatch(
        object $existing,
        array $result,
    ): void {
        $checks = [
            'classification' =>
                $result['classification'],

            'cohort_key' =>
                $result['cohort_key'],

            'status' =>
                'active',

            'effective_from' =>
                $result['effective_from'],

            'evidence_sha256' =>
                $result['evidence_sha256'],

            'cohort_sha256' =>
                $result['cohort_sha256'],
        ];

        foreach (
            $checks
            as $column => $expected
        ) {
            if (
                (string) $existing->{$column}
                !== (string) $expected
            ) {
                throw new RuntimeException(
                    'Existing exclusion conflicts with '
                    . "the approved policy: {$column}."
                );
            }
        }
    }

    private function printValidation(
        array $result
    ): void {
        $existing = DB::table(
            'finance_reporting_exclusions'
        )
            ->where(
                'tenant_id',
                $result['tenant_id']
            )
            ->where(
                'scope',
                $result['scope']
            )
            ->whereIn(
                'finance_journal_entry_id',
                array_column(
                    $result['rows'],
                    'journal_id'
                )
            )
            ->count();

        $this->line(
            'Finance Shadow Exclusion Policy'
        );

        $this->line(
            'Tenant ID: '
            . $result['tenant_id']
        );

        $this->line(
            'Cohort rows validated: '
            . count($result['rows'])
        );

        $this->line(
            'Cohort SHA-256: '
            . $result['cohort_sha256']
        );

        $this->line(
            'Evidence SHA-256: '
            . $result['evidence_sha256']
        );

        $this->line(
            'Classification: '
            . $result['classification']
        );

        $this->line(
            'Reporting scope: '
            . $result['scope']
        );

        $this->line(
            'Effective from: '
            . $result['effective_from']
        );

        $this->line(
            'Rows existing idempotent: '
            . $existing
        );

        $this->line(
            'Rows eligible for creation: '
            . (
                count($result['rows'])
                - $existing
            )
        );

        $this->line(
            'Journal status changes: 0'
        );

        $this->line(
            'Journal reversals: 0'
        );
    }

    private function decimal4(
        mixed $value
    ): string {
        return number_format(
            (float) $value,
            4,
            '.',
            ''
        );
    }

    private function dateOnly(
        mixed $value
    ): ?string {
        if (! is_string($value)) {
            return null;
        }

        if (
            preg_match(
                '/^(\d{4}-\d{2}-\d{2})/',
                trim($value),
                $matches
            ) !== 1
        ) {
            return null;
        }

        return $matches[1];
    }
}
