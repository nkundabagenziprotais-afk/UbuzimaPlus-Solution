<?php

declare(strict_types=1);

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;
use RuntimeException;
use Throwable;

final class FinanceApprovedLiveBusinessDateApply extends Command
{
    protected $signature =
        'finance:business-date:apply-approved-live-timestamps
        {file : Approved remediation candidate CSV}
        {--tenant_id=1 : Tenant identifier}
        {--confirm-sha256= : Required exact SHA-256 when applying}
        {--apply : Apply the approved updates}';

    protected $description =
        'Apply an approved, hash-locked live transaction Business Date remediation';

    private const TABLES = [
        'pharmaco_sales' => [
            'primary' => 'sold_at',
        ],

        'pharmaco_payments' => [
            'primary' => 'received_at',
        ],

        'stock_movements' => [
            'primary' => 'occurred_at',
        ],
    ];

    public function handle(): int
    {
        $file = realpath(
            (string) $this->argument(
                'file'
            )
        );

        if (
            $file === false
            || ! is_file($file)
            || ! is_readable($file)
        ) {
            $this->error(
                'The approved remediation file is unavailable.'
            );

            return self::FAILURE;
        }

        $tenantId = (int) $this->option(
            'tenant_id'
        );

        if ($tenantId <= 0) {
            $this->error(
                'A positive tenant identifier is required.'
            );

            return self::FAILURE;
        }

        $fileHash = hash_file(
            'sha256',
            $file
        );

        if (! is_string($fileHash)) {
            $this->error(
                'Unable to calculate the remediation file SHA-256.'
            );

            return self::FAILURE;
        }

        $apply = (bool) $this->option(
            'apply'
        );

        if ($apply) {
            $confirmedHash = strtolower(
                trim(
                    (string) $this->option(
                        'confirm-sha256'
                    )
                )
            );

            if (
                $confirmedHash === ''
                || ! hash_equals(
                    $fileHash,
                    $confirmedHash
                )
            ) {
                $this->error(
                    'The confirmed SHA-256 does not match the reviewed file.'
                );

                return self::FAILURE;
            }
        }

        try {
            $rows = $this->readRows(
                $file
            );
        } catch (Throwable $exception) {
            $this->error(
                $exception->getMessage()
            );

            return self::FAILURE;
        }

        $reviewed = 0;
        $actionable = [];
        $idempotent = 0;
        $held = 0;
        $errors = [];

        $counts = [];

        foreach (
            array_keys(self::TABLES)
            as $table
        ) {
            $counts[$table] = [
                'reviewed' => 0,
                'actionable' => 0,
                'idempotent' => 0,
                'held' => 0,
            ];
        }

        foreach ($rows as $index => $row) {
            $reviewed++;

            $lineNumber = $index + 2;

            $table = trim(
                (string) (
                    $row['table']
                    ?? ''
                )
            );

            if (
                ! array_key_exists(
                    $table,
                    self::TABLES
                )
            ) {
                $errors[] =
                    "Line {$lineNumber}: unsupported table.";

                continue;
            }

            $counts[$table]['reviewed']++;

            $resolutionStatus = trim(
                (string) (
                    $row[
                        'resolution_status'
                    ] ?? ''
                )
            );

            if (
                $resolutionStatus ===
                'historical_requires_approved_session_business_date'
            ) {
                $held++;
                $counts[$table]['held']++;

                continue;
            }

            if (
                $resolutionStatus !==
                'approved_live_timestamp_rule'
            ) {
                $errors[] =
                    "Line {$lineNumber}: unsupported resolution status.";

                continue;
            }

            $id = (int) (
                $row['row_id']
                ?? 0
            );

            $uuid = trim(
                (string) (
                    $row['uuid']
                    ?? ''
                )
            );

            $sourceField = trim(
                (string) (
                    $row['source_field']
                    ?? ''
                )
            );

            $sourceTimestamp = trim(
                (string) (
                    $row['source_timestamp']
                    ?? ''
                )
            );

            $proposedDate = trim(
                (string) (
                    $row[
                        'proposed_business_date'
                    ] ?? ''
                )
            );

            if ($id <= 0) {
                $errors[] =
                    "Line {$lineNumber}: invalid row identifier.";

                continue;
            }

            $primaryField =
                self::TABLES[$table][
                    'primary'
                ];

            if (
                ! in_array(
                    $sourceField,
                    [
                        $primaryField,
                        'created_at',
                    ],
                    true
                )
            ) {
                $errors[] =
                    "Line {$lineNumber}: invalid timestamp source field.";

                continue;
            }

            $derivedDate =
                $this->calendarDate(
                    $sourceTimestamp
                );

            if (
                $derivedDate === null
                || $derivedDate !==
                    $proposedDate
            ) {
                $errors[] =
                    "Line {$lineNumber}: proposed Business Date does not match the stored timestamp date.";

                continue;
            }

            $query = $this->rowQuery(
                $table,
                $tenantId,
                $id,
                $uuid,
            );

            $record = $query->first();

            if ($record === null) {
                $errors[] =
                    "Line {$lineNumber}: database row was not found.";

                continue;
            }

            $entryMode = strtolower(
                trim(
                    (string) (
                        $record->entry_mode
                        ?? ''
                    )
                )
            );

            if ($entryMode === 'historical') {
                $errors[] =
                    "Line {$lineNumber}: historical row cannot use the live timestamp rule.";

                continue;
            }

            $currentSourceTimestamp = trim(
                (string) (
                    $record->{$sourceField}
                    ?? ''
                )
            );

            if (
                $currentSourceTimestamp !==
                $sourceTimestamp
            ) {
                $errors[] =
                    "Line {$lineNumber}: source timestamp changed after approval.";

                continue;
            }

            if (
                $sourceField === 'created_at'
            ) {
                $currentPrimary = trim(
                    (string) (
                        $record->{$primaryField}
                        ?? ''
                    )
                );

                if ($currentPrimary !== '') {
                    $errors[] =
                        "Line {$lineNumber}: created_at fallback is no longer valid because the primary timestamp now exists.";

                    continue;
                }
            }

            $currentBusinessDate = trim(
                (string) (
                    $record->business_date
                    ?? ''
                )
            );

            if ($currentBusinessDate === '') {
                $actionable[] = [
                    'table' => $table,
                    'id' => $id,
                    'uuid' => $uuid,
                    'source_field' =>
                        $sourceField,
                    'source_timestamp' =>
                        $sourceTimestamp,
                    'business_date' =>
                        $proposedDate,
                ];

                $counts[$table][
                    'actionable'
                ]++;

                continue;
            }

            if (
                substr(
                    $currentBusinessDate,
                    0,
                    10
                ) === $proposedDate
            ) {
                $idempotent++;

                $counts[$table][
                    'idempotent'
                ]++;

                continue;
            }

            $errors[] =
                "Line {$lineNumber}: existing Business Date differs and will not be overwritten.";
        }

        $this->line(
            'Finance Approved Live Business Date Remediation'
        );

        $this->line(
            'Mode: '
            . (
                $apply
                    ? 'apply'
                    : 'dry-run'
            )
        );

        $this->line(
            "File: {$file}"
        );

        $this->line(
            "SHA-256: {$fileHash}"
        );

        $this->line(
            "Rows reviewed: {$reviewed}"
        );

        $this->line(
            'Actionable rows: '
            . count($actionable)
        );

        $this->line(
            "Idempotent rows: {$idempotent}"
        );

        $this->line(
            "Held historical rows: {$held}"
        );

        foreach ($counts as $table => $tableCounts) {
            $this->line(
                "{$table} reviewed: "
                . $tableCounts['reviewed']
            );

            $this->line(
                "{$table} actionable: "
                . $tableCounts['actionable']
            );

            $this->line(
                "{$table} idempotent: "
                . $tableCounts['idempotent']
            );
        }

        $this->line(
            'Validation errors: '
            . count($errors)
        );

        if ($errors !== []) {
            foreach ($errors as $error) {
                $this->error($error);
            }

            $this->line(
                'Database writes: NO'
            );

            return self::FAILURE;
        }

        if (! $apply) {
            $this->line(
                'Database writes: NO'
            );

            return self::SUCCESS;
        }

        if (
            DB::connection()
                ->getDriverName()
            === 'sqlite'
        ) {
            DB::connection()
                ->getPdo()
                ->exec(
                    'PRAGMA busy_timeout = 15000'
                );
        }

        $updated = 0;

        DB::transaction(
            function () use (
                $actionable,
                $tenantId,
                &$updated,
            ): void {
                foreach (
                    $actionable
                    as $candidate
                ) {
                    $query = $this->rowQuery(
                        $candidate['table'],
                        $tenantId,
                        $candidate['id'],
                        $candidate['uuid'],
                    )
                        ->whereNull(
                            'business_date'
                        )
                        ->where(
                            $candidate[
                                'source_field'
                            ],
                            $candidate[
                                'source_timestamp'
                            ]
                        );

                    $count = $query->update([
                        'business_date' =>
                            $candidate[
                                'business_date'
                            ],
                    ]);

                    if ($count !== 1) {
                        throw new RuntimeException(
                            "Concurrent change detected for {$candidate['table']} row {$candidate['id']}."
                        );
                    }

                    $updated++;
                }
            },
            3
        );

        $this->line(
            "Rows updated: {$updated}"
        );

        $this->line(
            'Database writes: '
            . (
                $updated > 0
                    ? 'YES'
                    : 'NO'
            )
        );

        return self::SUCCESS;
    }

    /**
     * @return array<int, array<string, string>>
     */
    private function readRows(
        string $file,
    ): array {
        $handle = fopen(
            $file,
            'rb'
        );

        if (! is_resource($handle)) {
            throw new RuntimeException(
                'Unable to open the remediation file.'
            );
        }

        try {
            $headers = fgetcsv(
                $handle,
                0,
                ',',
                '"',
                ''
            );

            if (! is_array($headers)) {
                throw new RuntimeException(
                    'The remediation file header is missing.'
                );
            }

            $headers[0] = preg_replace(
                '/^\xEF\xBB\xBF/',
                '',
                (string) $headers[0]
            );

            $required = [
                'table',
                'row_id',
                'uuid',
                'entry_mode',
                'source_field',
                'source_timestamp',
                'proposed_business_date',
                'resolution_status',
                'reference',
            ];

            $missing = array_values(
                array_diff(
                    $required,
                    $headers
                )
            );

            if ($missing !== []) {
                throw new RuntimeException(
                    'The remediation file is missing columns: '
                    . implode(
                        ', ',
                        $missing
                    )
                );
            }

            $rows = [];

            while (
                ($values = fgetcsv(
                    $handle,
                    0,
                    ',',
                    '"',
                    ''
                )) !== false
            ) {
                if (
                    count($values)
                    !== count($headers)
                ) {
                    throw new RuntimeException(
                        'A remediation row has an invalid column count.'
                    );
                }

                $row = array_combine(
                    $headers,
                    $values
                );

                if (! is_array($row)) {
                    throw new RuntimeException(
                        'Unable to parse a remediation row.'
                    );
                }

                $rows[] = $row;
            }

            return $rows;
        } finally {
            fclose($handle);
        }
    }

    private function rowQuery(
        string $table,
        int $tenantId,
        int $id,
        string $uuid,
    ): Builder {
        $query = DB::table(
            $table
        )
            ->where(
                'tenant_id',
                $tenantId
            )
            ->where(
                'id',
                $id
            );

        if ($uuid === '') {
            $query->where(
                static function (
                    Builder $identityQuery,
                ): void {
                    $identityQuery
                        ->whereNull('uuid')
                        ->orWhere(
                            'uuid',
                            ''
                        );
                }
            );
        } else {
            $query->where(
                'uuid',
                $uuid
            );
        }

        return $query;
    }

    private function calendarDate(
        string $timestamp,
    ): ?string {
        if (
            ! preg_match(
                '/^(\d{4}-\d{2}-\d{2})(?:[ T].*)?$/',
                trim($timestamp),
                $matches
            )
        ) {
            return null;
        }

        $date = $matches[1];

        $parsed =
            \DateTimeImmutable::createFromFormat(
                '!Y-m-d',
                $date
            );

        if (
            ! $parsed
            || $parsed->format('Y-m-d')
                !== $date
        ) {
            return null;
        }

        return $date;
    }
}
