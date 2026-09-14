<?php

namespace App\Services\Finance;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use RuntimeException;

final class FinanceRecognitionClassifier
{
    public const VERSION = 'F1_R1_1';

    public function scan(
        int $tenantId,
        bool $persist = false
    ): array {
        if ($tenantId <= 0) {
            throw new RuntimeException(
                'A valid tenant id is required.'
            );
        }

        foreach ([
            'finance_journal_entries',
            'finance_journal_lines',
            'finance_reporting_exclusions',
            'finance_accounting_periods',
            'pharmaco_payments',
        ] as $table) {
            if (! Schema::hasTable($table)) {
                throw new RuntimeException(
                    "Required Finance table is missing: {$table}"
                );
            }
        }

        if (
            $persist
            &&
            ! Schema::hasTable(
                'finance_recognition_reviews'
            )
        ) {
            throw new RuntimeException(
                'finance_recognition_reviews is not migrated.'
            );
        }

        $shadowJournals = DB::table(
            'finance_journal_entries'
        )
            ->where(
                'tenant_id',
                $tenantId
            )
            ->where(
                'status',
                'shadow_posted'
            )
            ->where(
                'source_module',
                'pos'
            )
            ->where(
                'source_type',
                'payment'
            )
            ->orderBy('id')
            ->get([
                'id',
                'tenant_id',
                'branch_id',
                'journal_number',
                'business_date',
                'source_module',
                'source_type',
                'source_id',
                'idempotency_key',
                'currency_code',
                'exchange_rate',
                'total_debit',
                'total_credit',
            ]);

        $postedJournals = DB::table(
            'finance_journal_entries'
        )
            ->where(
                'tenant_id',
                $tenantId
            )
            ->where(
                'status',
                'posted'
            )
            ->where(
                'source_module',
                'pos'
            )
            ->where(
                'source_type',
                'payment'
            )
            ->get([
                'id',
                'source_id',
                'idempotency_key',
                'journal_number',
                'business_date',
                'total_debit',
                'total_credit',
            ]);

        /*
         * Arrays are deliberately used instead of single-value maps.
         * Multiple formal journals for one source must not be hidden.
         */
        $formalBySource = [];
        $formalByIdempotency = [];

        foreach ($postedJournals as $journal) {
            $sourceId = trim(
                (string) (
                    $journal->source_id
                    ?? ''
                )
            );

            if ($sourceId !== '') {
                $formalBySource[$sourceId][] =
                    $journal;
            }

            $idempotencyKey = trim(
                (string) (
                    $journal->idempotency_key
                    ?? ''
                )
            );

            if ($idempotencyKey !== '') {
                $formalByIdempotency[
                    $idempotencyKey
                ][] = $journal;
            }
        }

        $exclusions = [];

        $exclusionRows = DB::table(
            'finance_reporting_exclusions'
        )
            ->where(
                'tenant_id',
                $tenantId
            )
            ->where(
                'status',
                'active'
            )
            ->whereNotNull(
                'finance_journal_entry_id'
            )
            ->get([
                'id',
                'finance_journal_entry_id',
                'classification',
                'cohort_key',
                'reason',
                'approved_by_name',
                'approved_at',
                'evidence_reference',
                'evidence_sha256',
            ]);

        foreach ($exclusionRows as $exclusion) {
            $exclusions[
                (string)
                $exclusion->finance_journal_entry_id
            ] = $exclusion;
        }

        $lineCounts = [];

        $lineRows = DB::table(
            'finance_journal_lines as lines'
        )
            ->join(
                'finance_journal_entries as entries',
                'entries.id',
                '=',
                'lines.journal_entry_id'
            )
            ->where(
                'entries.tenant_id',
                $tenantId
            )
            ->where(
                'entries.status',
                'shadow_posted'
            )
            ->where(
                'entries.source_module',
                'pos'
            )
            ->where(
                'entries.source_type',
                'payment'
            )
            ->groupBy(
                'lines.journal_entry_id'
            )
            ->selectRaw(
                'lines.journal_entry_id, COUNT(*) AS line_count'
            )
            ->get();

        foreach ($lineRows as $row) {
            $lineCounts[
                (string) $row->journal_entry_id
            ] = (int) $row->line_count;
        }

        $paymentColumns =
            Schema::getColumnListing(
                'pharmaco_payments'
            );

        $amountColumn =
            $this->firstExistingColumn(
                $paymentColumns,
                [
                    'amount',
                    'total_amount',
                    'paid_amount',
                    'amount_paid',
                    'payment_amount',
                    'received_amount',
                    'tendered_amount',
                    'net_amount',
                ]
            );

        $currencyColumn =
            $this->firstExistingColumn(
                $paymentColumns,
                [
                    'currency_code',
                    'currency',
                ]
            );

        $paymentSelect = [
            'id',
        ];

        foreach ([
            'tenant_id',
            'branch_id',
            'status',
            $amountColumn,
            $currencyColumn,
        ] as $column) {
            if (
                $column
                &&
                in_array(
                    $column,
                    $paymentColumns,
                    true
                )
                &&
                ! in_array(
                    $column,
                    $paymentSelect,
                    true
                )
            ) {
                $paymentSelect[] =
                    $column;
            }
        }

        $paymentQuery = DB::table(
            'pharmaco_payments'
        );

        if (
            in_array(
                'tenant_id',
                $paymentColumns,
                true
            )
        ) {
            $paymentQuery->where(
                'tenant_id',
                $tenantId
            );
        }

        $payments = [];

        foreach (
            $paymentQuery
                ->get(
                    $paymentSelect
                )
            as $payment
        ) {
            $payments[
                (string) $payment->id
            ] = $payment;
        }

        $periods = DB::table(
            'finance_accounting_periods'
        )
            ->where(
                'tenant_id',
                $tenantId
            )
            ->orderBy(
                'starts_on'
            )
            ->get();

        $items = [];
        $classificationCounts = [];

        $resolvedCount = 0;
        $pendingCount = 0;

        foreach ($shadowJournals as $journal) {
            $journalId =
                (string) $journal->id;

            $sourceId = trim(
                (string) (
                    $journal->source_id
                    ?? ''
                )
            );

            $idempotencyKey = trim(
                (string) (
                    $journal->idempotency_key
                    ?? ''
                )
            );

            $exclusion =
                $exclusions[$journalId]
                ?? null;

            /*
             * Collect all possible formal counterparts and deduplicate
             * them by journal entry ID.
             */
            $formalCandidates = [];

            if (
                $sourceId !== ''
                &&
                isset(
                    $formalBySource[
                        $sourceId
                    ]
                )
            ) {
                foreach (
                    $formalBySource[
                        $sourceId
                    ]
                    as $candidate
                ) {
                    $formalCandidates[
                        (string) $candidate->id
                    ] = $candidate;
                }
            }

            if (
                $idempotencyKey !== ''
                &&
                isset(
                    $formalByIdempotency[
                        $idempotencyKey
                    ]
                )
            ) {
                foreach (
                    $formalByIdempotency[
                        $idempotencyKey
                    ]
                    as $candidate
                ) {
                    $formalCandidates[
                        (string) $candidate->id
                    ] = $candidate;
                }
            }

            $formalCounterpartCount =
                count(
                    $formalCandidates
                );

            $formalCounterpart =
                $formalCounterpartCount === 1
                    ? array_values(
                        $formalCandidates
                    )[0]
                    : null;

            $payment =
                $sourceId !== ''
                    ? (
                        $payments[
                            $sourceId
                        ]
                        ?? null
                    )
                    : null;

            $lineCount =
                $lineCounts[
                    $journalId
                ]
                ?? 0;

            $journalDebit =
                (float) $journal->total_debit;

            $journalCredit =
                (float) $journal->total_credit;

            $balanced =
                abs(
                    $journalDebit
                    -
                    $journalCredit
                )
                < 0.005;

            $paymentStatus =
                $payment
                    ? strtolower(
                        trim(
                            (string) (
                                $payment->status
                                ?? ''
                            )
                        )
                    )
                    : null;

            $paymentAmount = null;
            $amountMatches = null;

            if (
                $payment
                &&
                $amountColumn
                &&
                isset(
                    $payment->{$amountColumn}
                )
            ) {
                $paymentAmount =
                    (float)
                    $payment->{$amountColumn};

                $amountMatches =
                    abs(
                        $paymentAmount
                        -
                        $journalDebit
                    )
                    < 0.005;
            }

            $currencyMatches = null;

            if (
                $payment
                &&
                $currencyColumn
                &&
                isset(
                    $payment->{$currencyColumn}
                )
            ) {
                $paymentCurrency =
                    strtoupper(
                        trim(
                            (string) (
                                $payment->{$currencyColumn}
                                ?? ''
                            )
                        )
                    );

                $journalCurrency =
                    strtoupper(
                        trim(
                            (string) (
                                $journal->currency_code
                                ?? ''
                            )
                        )
                    );

                if (
                    $paymentCurrency !== ''
                    &&
                    $journalCurrency !== ''
                ) {
                    $currencyMatches =
                        $paymentCurrency
                        ===
                        $journalCurrency;
                }
            }

            $branchMatches = null;

            if (
                $payment
                &&
                property_exists(
                    $payment,
                    'branch_id'
                )
                &&
                $payment->branch_id !== null
                &&
                $journal->branch_id !== null
            ) {
                $branchMatches =
                    (string) $payment->branch_id
                    ===
                    (string) $journal->branch_id;
            }

            $period = $this->periodFor(
                $periods,
                (string) $journal->business_date,
                $journal->branch_id
            );

            $periodStatus =
                $period
                    ? strtolower(
                        trim(
                            (string) (
                                $period->status
                                ?? ''
                            )
                        )
                    )
                    : null;

            $periodLocked =
                $period
                    ? (bool) (
                        $period->is_locked
                        ?? false
                    )
                    : null;

            $classification = null;
            $recommendedAction = null;
            $resolutionStatus = null;

            /*
             * Existing owner-approved exclusion remains authoritative.
             */
            if ($exclusion) {
                $classification =
                    'KEEP_EXCLUDED';

                $recommendedAction =
                    'KEEP_NONAUTHORITATIVE';

                $resolutionStatus =
                    'resolved';
            }

            /*
             * Multiple possible posted counterparts are never silently
             * treated as resolved.
             */
            elseif (
                $formalCounterpartCount > 1
            ) {
                $classification =
                    'REVIEW_MULTIPLE_FORMAL_COUNTERPARTS';

                $recommendedAction =
                    'REVIEW_REQUIRED';

                $resolutionStatus =
                    'pending';
            }

            /*
             * Exactly one formal journal already represents this payment.
             */
            elseif ($formalCounterpart) {
                $classification =
                    'ALREADY_REPRESENTED_FORMALLY';

                $recommendedAction =
                    'KEEP_NONAUTHORITATIVE';

                $resolutionStatus =
                    'resolved';
            }

            elseif ($sourceId === '') {
                $classification =
                    'REVIEW_MISSING_SOURCE_ID';

                $recommendedAction =
                    'REVIEW_REQUIRED';

                $resolutionStatus =
                    'pending';
            }

            elseif (! $payment) {
                $classification =
                    'REVIEW_SOURCE_PAYMENT_MISSING';

                $recommendedAction =
                    'REVIEW_REQUIRED';

                $resolutionStatus =
                    'pending';
            }

            elseif (
                in_array(
                    $paymentStatus,
                    [
                        'voided',
                        'void',
                        'cancelled',
                        'canceled',
                        'reversed',
                    ],
                    true
                )
            ) {
                $classification =
                    'REVIEW_SOURCE_PAYMENT_VOIDED';

                $recommendedAction =
                    'KEEP_OR_REVERSE_AFTER_REVIEW';

                $resolutionStatus =
                    'pending';
            }

            elseif (
                ! $balanced
                ||
                $lineCount < 2
            ) {
                $classification =
                    'REVIEW_JOURNAL_INTEGRITY';

                $recommendedAction =
                    'REVIEW_REQUIRED';

                $resolutionStatus =
                    'pending';
            }

            elseif (
                $amountColumn
                &&
                $amountMatches === false
            ) {
                $classification =
                    'REVIEW_AMOUNT_MISMATCH';

                $recommendedAction =
                    'REVIEW_REQUIRED';

                $resolutionStatus =
                    'pending';
            }

            elseif (
                $branchMatches === false
            ) {
                $classification =
                    'REVIEW_BRANCH_MISMATCH';

                $recommendedAction =
                    'REVIEW_REQUIRED';

                $resolutionStatus =
                    'pending';
            }

            elseif (
                $currencyMatches === false
            ) {
                $classification =
                    'REVIEW_CURRENCY_MISMATCH';

                $recommendedAction =
                    'REVIEW_REQUIRED';

                $resolutionStatus =
                    'pending';
            }

            elseif (! $period) {
                $classification =
                    'REVIEW_ACCOUNTING_PERIOD_MISSING';

                $recommendedAction =
                    'REVIEW_REQUIRED';

                $resolutionStatus =
                    'pending';
            }

            elseif (
                $periodStatus !== 'open'
                ||
                $periodLocked
            ) {
                $classification =
                    'REVIEW_ACCOUNTING_PERIOD_CLOSED';

                $recommendedAction =
                    'REVIEW_REQUIRED';

                $resolutionStatus =
                    'pending';
            }

            elseif (
                ! in_array(
                    $paymentStatus,
                    [
                        'completed',
                        'paid',
                        'settled',
                        'posted',
                    ],
                    true
                )
            ) {
                $classification =
                    'REVIEW_PAYMENT_STATUS';

                $recommendedAction =
                    'REVIEW_REQUIRED';

                $resolutionStatus =
                    'pending';
            }

            elseif (! $amountColumn) {
                $classification =
                    'REVIEW_PAYMENT_SCHEMA';

                $recommendedAction =
                    'REVIEW_REQUIRED';

                $resolutionStatus =
                    'pending';
            }

            else {
                $classification =
                    'CANDIDATE_FORMALIZE';

                $recommendedAction =
                    'FORMALIZE_AFTER_APPROVAL';

                $resolutionStatus =
                    'pending';
            }

            $formalIds = array_map(
                static function ($item): int {
                    return (int) $item->id;
                },
                array_values(
                    $formalCandidates
                )
            );

            sort($formalIds);

            $evidence = [
                'scan_version' =>
                    self::VERSION,

                'journal_entry_id' =>
                    (int) $journal->id,

                'journal_number' =>
                    $journal->journal_number,

                'business_date' =>
                    $journal->business_date,

                'branch_id' =>
                    $journal->branch_id,

                'source_id' =>
                    $sourceId,

                'idempotency_key' =>
                    $idempotencyKey,

                'journal_debit' =>
                    $journalDebit,

                'journal_credit' =>
                    $journalCredit,

                'balanced' =>
                    $balanced,

                'line_count' =>
                    $lineCount,

                'active_exclusion_id' =>
                    $exclusion
                        ? (int) $exclusion->id
                        : null,

                'exclusion_reason' =>
                    $exclusion
                        ? $exclusion->reason
                        : null,

                'formal_counterpart_count' =>
                    $formalCounterpartCount,

                'formal_counterpart_ids' =>
                    $formalIds,

                'formal_counterpart_id' =>
                    $formalCounterpart
                        ? (int) $formalCounterpart->id
                        : null,

                'formal_counterpart_journal' =>
                    $formalCounterpart
                        ? $formalCounterpart->journal_number
                        : null,

                'payment_found' =>
                    (bool) $payment,

                'payment_id' =>
                    $payment
                        ? (int) $payment->id
                        : null,

                'payment_status' =>
                    $paymentStatus,

                'payment_amount_column' =>
                    $amountColumn,

                'payment_amount' =>
                    $paymentAmount,

                'amount_matches' =>
                    $amountMatches,

                'currency_matches' =>
                    $currencyMatches,

                'branch_matches' =>
                    $branchMatches,

                'period_id' =>
                    $period
                        ? (int) $period->id
                        : null,

                'period_name' =>
                    $period
                        ? $period->name
                        : null,

                'period_status' =>
                    $periodStatus,

                'period_locked' =>
                    $periodLocked,

                'classification' =>
                    $classification,

                'recommended_action' =>
                    $recommendedAction,

                'resolution_status' =>
                    $resolutionStatus,
            ];

            $encodedEvidence = json_encode(
                $evidence,
                JSON_UNESCAPED_SLASHES
                |
                JSON_UNESCAPED_UNICODE
            );

            if (
                $encodedEvidence === false
            ) {
                throw new RuntimeException(
                    'Unable to encode recognition evidence.'
                );
            }

            $evidenceSha256 =
                hash(
                    'sha256',
                    $encodedEvidence
                );

            $item = [
                'tenant_id' =>
                    $tenantId,

                'branch_id' =>
                    $journal->branch_id,

                'journal_entry_id' =>
                    (int) $journal->id,

                'source_id' =>
                    $sourceId !== ''
                        ? $sourceId
                        : null,

                'classification' =>
                    $classification,

                'recommended_action' =>
                    $recommendedAction,

                'resolution_status' =>
                    $resolutionStatus,

                'formal_counterpart_id' =>
                    $formalCounterpart
                        ? (int) $formalCounterpart->id
                        : null,

                'exclusion_id' =>
                    $exclusion
                        ? (int) $exclusion->id
                        : null,

                'payment_id' =>
                    $payment
                        ? (int) $payment->id
                        : null,

                'evidence_sha256' =>
                    $evidenceSha256,

                'evidence' =>
                    $encodedEvidence,

                'scan_version' =>
                    self::VERSION,
            ];

            $items[] = $item;

            $classificationCounts[
                $classification
            ] =
                (
                    $classificationCounts[
                        $classification
                    ]
                    ?? 0
                )
                + 1;

            if (
                $resolutionStatus
                ===
                'resolved'
            ) {
                $resolvedCount++;
            } else {
                $pendingCount++;
            }
        }

        ksort(
            $classificationCounts
        );

        if ($persist) {
            DB::transaction(
                function () use (
                    $tenantId,
                    $items
                ): void {
                    DB::table(
                        'finance_recognition_reviews'
                    )
                        ->where(
                            'tenant_id',
                            $tenantId
                        )
                        ->update([
                            'is_current' =>
                                false,

                            'updated_at' =>
                                now(),
                        ]);

                    foreach ($items as $item) {
                        $journalEntryId =
                            $item[
                                'journal_entry_id'
                            ];

                        $payload = [
                            'tenant_id' =>
                                $item[
                                    'tenant_id'
                                ],

                            'branch_id' =>
                                $item[
                                    'branch_id'
                                ],

                            'source_id' =>
                                $item[
                                    'source_id'
                                ],

                            'classification' =>
                                $item[
                                    'classification'
                                ],

                            'recommended_action' =>
                                $item[
                                    'recommended_action'
                                ],

                            'resolution_status' =>
                                $item[
                                    'resolution_status'
                                ],

                            'formal_counterpart_id' =>
                                $item[
                                    'formal_counterpart_id'
                                ],

                            'exclusion_id' =>
                                $item[
                                    'exclusion_id'
                                ],

                            'payment_id' =>
                                $item[
                                    'payment_id'
                                ],

                            'evidence_sha256' =>
                                $item[
                                    'evidence_sha256'
                                ],

                            'evidence' =>
                                $item[
                                    'evidence'
                                ],

                            'scan_version' =>
                                $item[
                                    'scan_version'
                                ],

                            'is_current' =>
                                true,

                            'last_scanned_at' =>
                                now(),

                            'updated_at' =>
                                now(),
                        ];

                        $existing = DB::table(
                            'finance_recognition_reviews'
                        )
                            ->where(
                                'journal_entry_id',
                                $journalEntryId
                            )
                            ->exists();

                        if ($existing) {
                            DB::table(
                                'finance_recognition_reviews'
                            )
                                ->where(
                                    'journal_entry_id',
                                    $journalEntryId
                                )
                                ->update(
                                    $payload
                                );
                        } else {
                            DB::table(
                                'finance_recognition_reviews'
                            )
                                ->insert(
                                    array_merge(
                                        [
                                            'journal_entry_id' =>
                                                $journalEntryId,

                                            'created_at' =>
                                                now(),
                                        ],
                                        $payload
                                    )
                                );
                        }
                    }
                }
            );
        }

        return [
            'version' =>
                self::VERSION,

            'tenant_id' =>
                $tenantId,

            'shadow_total' =>
                count($items),

            'resolved_count' =>
                $resolvedCount,

            'pending_count' =>
                $pendingCount,

            'classification_counts' =>
                $classificationCounts,

            'payment_amount_column' =>
                $amountColumn,

            'payment_currency_column' =>
                $currencyColumn,

            'persisted' =>
                $persist,

            'items' =>
                $items,
        ];
    }

    private function firstExistingColumn(
        array $columns,
        array $candidates
    ): ?string {
        foreach ($candidates as $candidate) {
            if (
                in_array(
                    $candidate,
                    $columns,
                    true
                )
            ) {
                return $candidate;
            }
        }

        return null;
    }

    private function periodFor(
        $periods,
        string $businessDate,
        $branchId
    ) {
        $date = substr(
            $businessDate,
            0,
            10
        );

        $branchMatch = null;
        $globalMatch = null;

        foreach ($periods as $period) {
            $starts = substr(
                (string) $period->starts_on,
                0,
                10
            );

            $ends = substr(
                (string) $period->ends_on,
                0,
                10
            );

            if (
                $date < $starts
                ||
                $date > $ends
            ) {
                continue;
            }

            if (
                $branchId !== null
                &&
                $period->branch_id !== null
                &&
                (string) $period->branch_id
                    ===
                    (string) $branchId
            ) {
                $branchMatch = $period;

                break;
            }

            if (
                $period->branch_id === null
            ) {
                $globalMatch = $period;
            }
        }

        return
            $branchMatch
            ??
            $globalMatch;
    }
}
