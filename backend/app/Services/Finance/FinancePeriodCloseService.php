<?php

namespace App\Services\Finance;

use Carbon\CarbonImmutable;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use RuntimeException;

final class FinancePeriodCloseService
{
    public const VERSION = 'F2_R1_2';

    public function readiness(
        int $tenantId,
        ?int $branchId,
        int $periodId
    ): array {
        $period = $this->findPeriod(
            $tenantId,
            $branchId,
            $periodId
        );

        $start = substr(
            (string) $period->starts_on,
            0,
            10
        );

        $end = substr(
            (string) $period->ends_on,
            0,
            10
        );

        $blockers = [];
        $warnings = [];
        $metrics = [];

        if (
            strtolower(
                (string) $period->status
            ) !== 'open'
        ) {
            $blockers[] = [
                'code' => 'PERIOD_NOT_OPEN',
                'message' =>
                    'The accounting period is not open.',
            ];
        }

        if ((bool) $period->is_locked) {
            $blockers[] = [
                'code' => 'PERIOD_ALREADY_LOCKED',
                'message' =>
                    'The accounting period is already locked.',
            ];
        }

        $today = CarbonImmutable::today(
            config('app.timezone','UTC')
        )->format('Y-m-d');

        if ($end >= $today) {
            $blockers[] = [
                'code' => 'PERIOD_NOT_ENDED',
                'message' =>
                    'The accounting period has not ended yet.',
            ];
        }

        $earlierOpen = DB::table(
            'finance_accounting_periods'
        )
            ->where('tenant_id',$tenantId)
            ->where('id','<>',$periodId)
            ->whereRaw(
                'date(ends_on) < ?',
                [$start]
            )
            ->where(function (
                Builder $query
            ) use ($period): void {
                if ($period->branch_id === null) {
                    $query->whereNull('branch_id');
                } else {
                    $query
                        ->whereNull('branch_id')
                        ->orWhere(
                            'branch_id',
                            $period->branch_id
                        );
                }
            })
            ->where(function (
                Builder $query
            ): void {
                $query
                    ->where('status','open')
                    ->orWhere('is_locked',false);
            })
            ->count();

        $metrics[
            'earlier_open_periods'
        ] = $earlierOpen;

        if ($earlierOpen > 0) {
            $blockers[] = [
                'code' => 'EARLIER_PERIOD_OPEN',
                'message' =>
                    'An earlier accounting period is still open.',
            ];
        }

        $overlaps = DB::table(
            'finance_accounting_periods'
        )
            ->where('tenant_id',$tenantId)
            ->where('id','<>',$periodId)
            ->whereRaw(
                'date(starts_on) <= ?',
                [$end]
            )
            ->whereRaw(
                'date(ends_on) >= ?',
                [$start]
            )
            ->where(function (
                Builder $query
            ) use ($period): void {
                if ($period->branch_id === null) {
                    $query->whereNull('branch_id');
                } else {
                    $query
                        ->whereNull('branch_id')
                        ->orWhere(
                            'branch_id',
                            $period->branch_id
                        );
                }
            })
            ->count();

        $metrics[
            'overlapping_periods'
        ] = $overlaps;

        if ($overlaps > 0) {
            $blockers[] = [
                'code' =>
                    'OVERLAPPING_ACCOUNTING_PERIOD',

                'message' =>
                    'Another accounting period overlaps this period.',
            ];
        }

        $shadowTotal = DB::table(
            'finance_journal_entries'
        )
            ->where('tenant_id',$tenantId)
            ->where('status','shadow_posted')
            ->whereRaw(
                'date(business_date) BETWEEN ? AND ?',
                [
                    $start,
                    $end,
                ]
            )
            ->count();

        $metrics[
            'shadow_journals'
        ] = $shadowTotal;

        $unresolvedShadow = 0;

        if ($shadowTotal > 0) {
            if (
                ! Schema::hasTable(
                    'finance_recognition_reviews'
                )
            ) {
                $unresolvedShadow =
                    $shadowTotal;
            } else {
                $unresolvedShadow = DB::table(
                    'finance_journal_entries as e'
                )
                    ->leftJoin(
                        'finance_recognition_reviews as r',
                        function ($join): void {
                            $join
                                ->on(
                                    'r.journal_entry_id',
                                    '=',
                                    'e.id'
                                )
                                ->where(
                                    'r.is_current',
                                    '=',
                                    1
                                )
                                ->where(
                                    'r.resolution_status',
                                    '=',
                                    'resolved'
                                );
                        }
                    )
                    ->where(
                        'e.tenant_id',
                        $tenantId
                    )
                    ->where(
                        'e.status',
                        'shadow_posted'
                    )
                    ->whereRaw(
                        'date(e.business_date) BETWEEN ? AND ?',
                        [
                            $start,
                            $end,
                        ]
                    )
                    ->whereNull('r.id')
                    ->count();
            }
        }

        $metrics[
            'unresolved_shadow_journals'
        ] = $unresolvedShadow;

        if ($unresolvedShadow > 0) {
            $blockers[] = [
                'code' =>
                    'UNRESOLVED_SHADOW_JOURNALS',

                'message' =>
                    'Historical shadow journals remain unresolved.',
            ];
        }

        $unbalanced = DB::table(
            'finance_journal_entries'
        )
            ->where('tenant_id',$tenantId)
            ->whereIn(
                'status',
                [
                    'posted',
                    'shadow_posted',
                ]
            )
            ->whereRaw(
                'date(business_date) BETWEEN ? AND ?',
                [
                    $start,
                    $end,
                ]
            )
            ->whereRaw(
                'ABS(COALESCE(total_debit,0)-COALESCE(total_credit,0)) >= 0.005'
            )
            ->count();

        $metrics[
            'unbalanced_journal_headers'
        ] = $unbalanced;

        if ($unbalanced > 0) {
            $blockers[] = [
                'code' =>
                    'UNBALANCED_JOURNAL_HEADERS',

                'message' =>
                    'One or more journals are not balanced.',
            ];
        }

        $lineMismatches = DB::table(
            'finance_journal_entries as e'
        )
            ->leftJoin(
                'finance_journal_lines as l',
                'l.journal_entry_id',
                '=',
                'e.id'
            )
            ->where(
                'e.tenant_id',
                $tenantId
            )
            ->whereIn(
                'e.status',
                [
                    'posted',
                    'shadow_posted',
                ]
            )
            ->whereRaw(
                'date(e.business_date) BETWEEN ? AND ?',
                [
                    $start,
                    $end,
                ]
            )
            ->groupBy(
                'e.id',
                'e.total_debit',
                'e.total_credit'
            )
            ->havingRaw(
                'ABS(COALESCE(e.total_debit,0)-COALESCE(SUM(l.debit),0)) >= 0.005
                 OR
                 ABS(COALESCE(e.total_credit,0)-COALESCE(SUM(l.credit),0)) >= 0.005'
            )
            ->get([
                'e.id',
            ])
            ->count();

        $metrics[
            'journal_line_mismatches'
        ] = $lineMismatches;

        if ($lineMismatches > 0) {
            $blockers[] = [
                'code' =>
                    'JOURNAL_LINE_TOTAL_MISMATCH',

                'message' =>
                    'One or more journal headers do not match their lines.',
            ];
        }

        $openDrafts = $this->openWorkflowCount(
            'finance_journal_drafts',
            $tenantId,
            $start,
            $end,
            [
                'posted',
                'reversed',
                'rejected',
            ]
        );

        $metrics[
            'unsettled_journal_drafts'
        ] = $openDrafts;

        if ($openDrafts > 0) {
            $blockers[] = [
                'code' =>
                    'UNSETTLED_JOURNAL_DRAFTS',

                'message' =>
                    'Journal drafts remain unsettled.',
            ];
        }

        $openExpenses = $this->openWorkflowCount(
            'finance_expenses',
            $tenantId,
            $start,
            $end,
            [
                'posted',
                'reversed',
                'rejected',
            ]
        );

        $metrics[
            'unsettled_expenses'
        ] = $openExpenses;

        if ($openExpenses > 0) {
            $blockers[] = [
                'code' =>
                    'UNSETTLED_EXPENSES',

                'message' =>
                    'Finance expenses remain unsettled.',
            ];
        }

        $exclusions = DB::table(
            'finance_reporting_exclusions as x'
        )
            ->join(
                'finance_journal_entries as e',
                'e.id',
                '=',
                'x.finance_journal_entry_id'
            )
            ->where(
                'x.tenant_id',
                $tenantId
            )
            ->where(
                'x.status',
                'active'
            )
            ->whereRaw(
                'date(e.business_date) BETWEEN ? AND ?',
                [
                    $start,
                    $end,
                ]
            )
            ->count();

        $metrics[
            'approved_reporting_exclusions'
        ] = $exclusions;

        if ($exclusions > 0) {
            $warnings[] = [
                'code' =>
                    'APPROVED_REPORTING_EXCLUSIONS_PRESENT',

                'message' =>
                    'Approved reporting exclusions are preserved in close evidence.',
            ];
        }

        return [
            'version' =>
                self::VERSION,

            'period' => [
                'id' =>
                    (int) $period->id,

                'name' =>
                    $period->name,

                'starts_on' =>
                    $period->starts_on,

                'ends_on' =>
                    $period->ends_on,

                'status' =>
                    $period->status,

                'is_locked' =>
                    (bool) $period->is_locked,

                'branch_id' =>
                    $period->branch_id,
            ],

            'ready_to_close' =>
                count($blockers) === 0,

            'blockers' =>
                $blockers,

            'warnings' =>
                $warnings,

            'metrics' =>
                $metrics,

            'evaluated_at' =>
                now()->toIso8601String(),
        ];
    }

    public function actions(
        int $tenantId,
        ?int $branchId,
        int $limit = 100
    ): array {
        $query = DB::table(
            'finance_period_close_actions as a'
        )
            ->leftJoin(
                'finance_accounting_periods as p',
                'p.id',
                '=',
                'a.accounting_period_id'
            )
            ->where(
                'a.tenant_id',
                $tenantId
            );

        if ($branchId !== null) {
            $query->where(function (
                Builder $q
            ) use ($branchId): void {
                $q
                    ->whereNull(
                        'a.branch_id'
                    )
                    ->orWhere(
                        'a.branch_id',
                        $branchId
                    );
            });
        }

        return $query
            ->orderByDesc('a.id')
            ->limit(
                max(
                    1,
                    min($limit,250)
                )
            )
            ->get([
                'a.*',
                'p.name as period_name',
                'p.starts_on as period_starts_on',
                'p.ends_on as period_ends_on',
                'p.status as current_period_status',
                'p.is_locked as current_period_locked',
            ])
            ->map(
                static fn ($row): array =>
                    (array) $row
            )
            ->all();
    }

    public function requestClose(
        int $tenantId,
        ?int $branchId,
        int $periodId,
        int $actorId,
        string $actorName,
        string $reason
    ): array {
        $reason =
            $this->normaliseRequiredText(
                $reason
            );

        $readiness = $this->readiness(
            $tenantId,
            $branchId,
            $periodId
        );

        if (
            ! $readiness[
                'ready_to_close'
            ]
        ) {
            throw ValidationException::withMessages([
                'period' => [
                    'The accounting period is not ready to close.',
                ],
            ]);
        }

        return DB::transaction(
            function () use (
                $tenantId,
                $branchId,
                $periodId,
                $actorId,
                $actorName,
                $reason,
                $readiness
            ): array {
                $this->assertNoPendingAction(
                    $tenantId,
                    $periodId
                );

                $period = $this->findPeriod(
                    $tenantId,
                    $branchId,
                    $periodId
                );

                $snapshot =
                    $this->snapshot(
                        $readiness
                    );

                $uuid =
                    (string) Str::uuid();

                DB::table(
                    'finance_period_close_actions'
                )->insert([
                    'uuid' => $uuid,
                    'tenant_id' => $tenantId,
                    'branch_id' => $period->branch_id,
                    'accounting_period_id' => $periodId,
                    'action_type' => 'close',
                    'status' => 'requested',
                    'reason' => $reason,
                    'requested_by' => $actorId,
                    'requested_by_name' => $actorName,
                    'requested_at' => now(),
                    'readiness_snapshot' =>
                        $snapshot['json'],
                    'readiness_sha256' =>
                        $snapshot['sha256'],
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);

                return $this->findAction(
                    $tenantId,
                    $uuid
                );
            }
        );
    }

    public function requestReopen(
        int $tenantId,
        ?int $branchId,
        int $periodId,
        int $actorId,
        string $actorName,
        string $reason
    ): array {
        $reason =
            $this->normaliseRequiredText(
                $reason
            );

        return DB::transaction(
            function () use (
                $tenantId,
                $branchId,
                $periodId,
                $actorId,
                $actorName,
                $reason
            ): array {
                $period = $this->findPeriod(
                    $tenantId,
                    $branchId,
                    $periodId
                );

                if (
                    strtolower(
                        (string) $period->status
                    ) !== 'closed'
                    ||
                    ! (bool) $period->is_locked
                ) {
                    throw ValidationException::withMessages([
                        'period' => [
                            'Only a closed and locked accounting period can be reopened.',
                        ],
                    ]);
                }

                if (
                    $this->laterClosedPeriodCount(
                        $tenantId,
                        $period
                    ) > 0
                ) {
                    throw ValidationException::withMessages([
                        'period' => [
                            'Reopen later closed periods first.',
                        ],
                    ]);
                }

                $this->assertNoPendingAction(
                    $tenantId,
                    $periodId
                );

                $snapshot =
                    $this->snapshot([
                        'version' =>
                            self::VERSION,

                        'action' =>
                            'reopen_request',

                        'period_id' =>
                            (int) $period->id,

                        'status' =>
                            $period->status,

                        'is_locked' =>
                            (bool) $period->is_locked,

                        'closed_by' =>
                            $period->closed_by,

                        'closed_at' =>
                            $period->closed_at,

                        'close_reason' =>
                            $period->close_reason,
                    ]);

                $uuid =
                    (string) Str::uuid();

                DB::table(
                    'finance_period_close_actions'
                )->insert([
                    'uuid' => $uuid,
                    'tenant_id' => $tenantId,
                    'branch_id' => $period->branch_id,
                    'accounting_period_id' => $periodId,
                    'action_type' => 'reopen',
                    'status' => 'requested',
                    'reason' => $reason,
                    'requested_by' => $actorId,
                    'requested_by_name' => $actorName,
                    'requested_at' => now(),
                    'readiness_snapshot' =>
                        $snapshot['json'],
                    'readiness_sha256' =>
                        $snapshot['sha256'],
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);

                return $this->findAction(
                    $tenantId,
                    $uuid
                );
            }
        );
    }

    public function approve(
        int $tenantId,
        ?int $branchId,
        string $uuid,
        int $actorId,
        string $actorName,
        ?string $comment
    ): array {
        return DB::transaction(
            function () use (
                $tenantId,
                $branchId,
                $uuid,
                $actorId,
                $actorName,
                $comment
            ): array {
                $action =
                    $this->actionObject(
                        $tenantId,
                        $uuid
                    );

                if (
                    $action->status
                    !== 'requested'
                ) {
                    throw ValidationException::withMessages([
                        'action' => [
                            'This request has already been decided.',
                        ],
                    ]);
                }

                $this->assertChecker(
                    $action,
                    $actorId
                );

                $period = $this->findPeriod(
                    $tenantId,
                    $branchId,
                    (int)
                    $action->accounting_period_id
                );

                if (
                    $action->action_type
                    === 'close'
                ) {
                    $readiness =
                        $this->readiness(
                            $tenantId,
                            $branchId,
                            (int) $period->id
                        );

                    if (
                        ! $readiness[
                            'ready_to_close'
                        ]
                    ) {
                        throw ValidationException::withMessages([
                            'period' => [
                                'Close readiness no longer passes.',
                            ],
                        ]);
                    }

                    DB::table(
                        'finance_accounting_periods'
                    )
                        ->where(
                            'id',
                            $period->id
                        )
                        ->where(
                            'tenant_id',
                            $tenantId
                        )
                        ->update([
                            'status' =>
                                'closed',

                            'is_locked' =>
                                true,

                            'closed_by' =>
                                $actorId,

                            'closed_at' =>
                                now(),

                            'close_reason' =>
                                $action->reason,

                            'updated_at' =>
                                now(),
                        ]);

                    $execution = [
                        'action' =>
                            'close',

                        'period_id' =>
                            (int) $period->id,

                        'previous_status' =>
                            $period->status,

                        'new_status' =>
                            'closed',

                        'new_locked' =>
                            true,

                        'readiness' =>
                            $readiness,
                    ];
                } elseif (
                    $action->action_type
                    === 'reopen'
                ) {
                    if (
                        $this->laterClosedPeriodCount(
                            $tenantId,
                            $period
                        ) > 0
                    ) {
                        throw ValidationException::withMessages([
                            'period' => [
                                'A later accounting period is still closed.',
                            ],
                        ]);
                    }

                    DB::table(
                        'finance_accounting_periods'
                    )
                        ->where(
                            'id',
                            $period->id
                        )
                        ->where(
                            'tenant_id',
                            $tenantId
                        )
                        ->update([
                            'status' =>
                                'open',

                            'is_locked' =>
                                false,

                            'closed_by' =>
                                null,

                            'closed_at' =>
                                null,

                            'close_reason' =>
                                null,

                            'updated_at' =>
                                now(),
                        ]);

                    $execution = [
                        'action' =>
                            'reopen',

                        'period_id' =>
                            (int) $period->id,

                        'previous_status' =>
                            $period->status,

                        'new_status' =>
                            'open',

                        'new_locked' =>
                            false,
                    ];
                } else {
                    throw new RuntimeException(
                        'Unsupported period action.'
                    );
                }

                $snapshot =
                    $this->snapshot(
                        $execution
                    );

                DB::table(
                    'finance_period_close_actions'
                )
                    ->where(
                        'id',
                        $action->id
                    )
                    ->update([
                        'status' =>
                            'executed',

                        'decided_by' =>
                            $actorId,

                        'decided_by_name' =>
                            $actorName,

                        'decided_at' =>
                            now(),

                        'decision_comment' =>
                            $this->normaliseOptionalText(
                                $comment
                            ),

                        'execution_snapshot' =>
                            $snapshot['json'],

                        'execution_sha256' =>
                            $snapshot['sha256'],

                        'executed_at' =>
                            now(),

                        'updated_at' =>
                            now(),
                    ]);

                return [
                    'action' =>
                        $this->findAction(
                            $tenantId,
                            $uuid
                        ),

                    'period' =>
                        (array)
                        DB::table(
                            'finance_accounting_periods'
                        )
                            ->where(
                                'id',
                                $period->id
                            )
                            ->first(),
                ];
            }
        );
    }

    public function reject(
        int $tenantId,
        string $uuid,
        int $actorId,
        string $actorName,
        string $comment
    ): array {
        $comment =
            $this->normaliseRequiredText(
                $comment
            );

        return DB::transaction(
            function () use (
                $tenantId,
                $uuid,
                $actorId,
                $actorName,
                $comment
            ): array {
                $action =
                    $this->actionObject(
                        $tenantId,
                        $uuid
                    );

                if (
                    $action->status
                    !== 'requested'
                ) {
                    throw ValidationException::withMessages([
                        'action' => [
                            'This request has already been decided.',
                        ],
                    ]);
                }

                $this->assertChecker(
                    $action,
                    $actorId
                );

                DB::table(
                    'finance_period_close_actions'
                )
                    ->where(
                        'id',
                        $action->id
                    )
                    ->update([
                        'status' =>
                            'rejected',

                        'decided_by' =>
                            $actorId,

                        'decided_by_name' =>
                            $actorName,

                        'decided_at' =>
                            now(),

                        'decision_comment' =>
                            $comment,

                        'updated_at' =>
                            now(),
                    ]);

                return $this->findAction(
                    $tenantId,
                    $uuid
                );
            }
        );
    }

    private function openWorkflowCount(
        string $table,
        int $tenantId,
        string $start,
        string $end,
        array $terminalStatuses
    ): int {
        if (
            ! Schema::hasTable($table)
            ||
            ! Schema::hasColumn(
                $table,
                'tenant_id'
            )
            ||
            ! Schema::hasColumn(
                $table,
                'business_date'
            )
            ||
            ! Schema::hasColumn(
                $table,
                'status'
            )
        ) {
            return 0;
        }

        return DB::table($table)
            ->where(
                'tenant_id',
                $tenantId
            )
            ->whereRaw(
                'date(business_date) BETWEEN ? AND ?',
                [
                    $start,
                    $end,
                ]
            )
            ->whereNotIn(
                'status',
                $terminalStatuses
            )
            ->count();
    }

    private function findPeriod(
        int $tenantId,
        ?int $branchId,
        int $periodId
    ): object {
        $period = DB::table(
            'finance_accounting_periods'
        )
            ->where(
                'tenant_id',
                $tenantId
            )
            ->where(
                'id',
                $periodId
            )
            ->first();

        if (! $period) {
            throw ValidationException::withMessages([
                'period' => [
                    'Accounting period not found.',
                ],
            ]);
        }

        if (
            $branchId !== null
            &&
            $period->branch_id !== null
            &&
            (int) $period->branch_id
                !== $branchId
        ) {
            throw ValidationException::withMessages([
                'period' => [
                    'Accounting period is outside the verified branch scope.',
                ],
            ]);
        }

        return $period;
    }

    private function actionObject(
        int $tenantId,
        string $uuid
    ): object {
        $action = DB::table(
            'finance_period_close_actions'
        )
            ->where(
                'tenant_id',
                $tenantId
            )
            ->where(
                'uuid',
                $uuid
            )
            ->first();

        if (! $action) {
            throw ValidationException::withMessages([
                'action' => [
                    'Accounting period action not found.',
                ],
            ]);
        }

        return $action;
    }

    private function findAction(
        int $tenantId,
        string $uuid
    ): array {
        return (array)
            $this->actionObject(
                $tenantId,
                $uuid
            );
    }

    private function assertNoPendingAction(
        int $tenantId,
        int $periodId
    ): void {
        $exists = DB::table(
            'finance_period_close_actions'
        )
            ->where(
                'tenant_id',
                $tenantId
            )
            ->where(
                'accounting_period_id',
                $periodId
            )
            ->where(
                'status',
                'requested'
            )
            ->exists();

        if ($exists) {
            throw ValidationException::withMessages([
                'period' => [
                    'A pending close/reopen request already exists.',
                ],
            ]);
        }
    }

    private function assertChecker(
        object $action,
        int $actorId
    ): void {
        if (
            $actorId <= 0
            ||
            (
                (int) $action->requested_by === $actorId
                && ! \App\Support\MakerCheckerExemptionPolicy::allows(
                    $actorId,
                    isset($action->tenant_id)
                        ? (int) $action->tenant_id
                        : null,
                    isset($action->branch_id)
                        ? (int) $action->branch_id
                        : null
                )
            )
        ) {
            throw ValidationException::withMessages([
                'approval' => [
                    'The requester cannot approve or reject their own accounting period request.',
                ],
            ]);
        }
    }

    private function laterClosedPeriodCount(
        int $tenantId,
        object $period
    ): int {
        return DB::table(
            'finance_accounting_periods'
        )
            ->where(
                'tenant_id',
                $tenantId
            )
            ->whereRaw(
                'date(starts_on) > date(?)',
                [
                    $period->ends_on,
                ]
            )
            ->where(function (
                Builder $q
            ) use ($period): void {
                if ($period->branch_id === null) {
                    $q->whereNull(
                        'branch_id'
                    );
                } else {
                    $q
                        ->whereNull(
                            'branch_id'
                        )
                        ->orWhere(
                            'branch_id',
                            $period->branch_id
                        );
                }
            })
            ->where(function (
                Builder $q
            ): void {
                $q
                    ->where(
                        'status',
                        'closed'
                    )
                    ->orWhere(
                        'is_locked',
                        true
                    );
            })
            ->count();
    }

    private function normaliseRequiredText(
        string $value
    ): string {
        $value = trim($value);

        if (mb_strlen($value) < 10) {
            throw ValidationException::withMessages([
                'reason' => [
                    'At least 10 meaningful characters are required.',
                ],
            ]);
        }

        return mb_substr(
            $value,
            0,
            1000
        );
    }

    private function normaliseOptionalText(
        ?string $value
    ): ?string {
        if ($value === null) {
            return null;
        }

        $value = trim($value);

        if ($value === '') {
            return null;
        }

        return mb_substr(
            $value,
            0,
            1000
        );
    }

    private function snapshot(
        array $payload
    ): array {
        $json = json_encode(
            $payload,
            JSON_UNESCAPED_SLASHES
            |
            JSON_UNESCAPED_UNICODE
        );

        if ($json === false) {
            throw new RuntimeException(
                'Unable to encode period-control evidence.'
            );
        }

        return [
            'json' => $json,
            'sha256' =>
                hash(
                    'sha256',
                    $json
                ),
        ];
    }
}
