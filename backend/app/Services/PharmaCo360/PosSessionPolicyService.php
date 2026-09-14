<?php

namespace App\Services\PharmaCo360;

use App\Models\PharmacoPayment;
use App\Models\PharmacoPosSession;
use Illuminate\Validation\ValidationException;

class PosSessionPolicyService
{
    public function ensureNoActiveLiveTerminalSession(
        int $tenantId,
        int $branchId,
        string $terminalIdentifier
    ): void {
        $activeSession =
            PharmacoPosSession::query()
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->where(
                    'branch_id',
                    $branchId
                )
                ->where(
                    'session_mode',
                    'live'
                )
                ->where(
                    'terminal_identifier',
                    $terminalIdentifier
                )
                ->whereIn(
                    'status',
                    [
                        'open',
                        'zeroized',
                    ]
                )
                ->first();

        if ($activeSession) {
            throw ValidationException::withMessages([
                'terminal_identifier' => [
                    'This POS terminal already has an '
                    . 'active live session. Close it '
                    . 'before opening another.',
                ],
            ]);
        }
    }

    public function ensureNoPriorDailySession(
        int $tenantId,
        ?int $branchId,
        int $userId,
        string $businessDate
    ): void {
        $exists = PharmacoPosSession::query()
            ->where('tenant_id', $tenantId)
            ->where('branch_id', $branchId)
            ->where('user_id', $userId)
            ->whereDate('business_date', $businessDate)
            ->exists();

        if ($exists) {
            throw ValidationException::withMessages([
                'business_date' => [
                    'Only one POS clock-in/till session is permitted per user, branch and business day.',
                ],
            ]);
        }
    }

    public function ensureCanZeroize(PharmacoPosSession $session): void
    {
        if ($session->status !== 'open') {
            throw ValidationException::withMessages([
                'session' => ['Only an open POS session can be zeroized.'],
            ]);
        }
    }

public function ensureCanClose(
        PharmacoPosSession $session,
        float $declaredCash,
        float $expectedCash
    ): void {
        if (
            $session->status !== 'zeroized'
            || $session->zeroized_at === null
        ) {
            throw ValidationException::withMessages([
                'session' => [
                    'The till balance must be cleared before '
                    . 'the POS session can close.',
                ],
            ]);
        }

        if (abs($expectedCash) > 0.00001) {
            throw ValidationException::withMessages([
                'session' => [
                    'The POS session cannot close while an '
                    . 'outstanding till balance remains.',
                ],
            ]);
        }
    }

    /*
     * AQUILA_POS_EXPECTED_HANDOVER_R578M_R1
     *
     * Physical handover due from the pharmacist:
     *
     * opening float
     * + completed cash payments linked to THIS POS session
     * - cash drops
     * - balance already cleared
     *
     * MoMo/card/insurance/credit do not represent physical
     * till cash and are therefore excluded.
     */
    /*
     * AQUILA_POS_LEGACY_HANDOVER_R578M_R3_R2
     *
     * Expected physical cash handover authority:
     *
     * 1. payment.pos_session_id = current session.
     * 2. payment.pos_session_id NULL while
     *    sale.pos_session_id = current session.
     * 3. Legacy payment and sale both NULL:
     *    same tenant, branch, pharmacist and business date,
     *    but only when attribution is unambiguous.
     *
     * Closed-session rows remain immutable.
     * This method calculates the presentation/reconciliation
     * value from immutable transaction evidence.
     */
    public function expectedCashBreakdown(
        PharmacoPosSession $session,
        $endingAt = null
    ): array {
        $settledStatuses = [
            'completed',
            'paid',
            'settled',
            'success',
            'successful',
        ];

        $businessDate =
            $session->business_date
                ?->toDateString()
            ??
            substr(
                (string)
                $session->business_date,
                0,
                10
            );

        $sessionMode =
            strtolower(
                trim(
                    (string) (
                        $session->session_mode
                        ?? 'live'
                    )
                )
            );

        /*
         * ------------------------------------------------------
         * 1. EXACT PAYMENT POS SESSION ID
         * ------------------------------------------------------
         */
        $directCash = round(
            (float)
            PharmacoPayment::query()
                ->where(
                    'tenant_id',
                    $session->tenant_id
                )
                ->where(
                    'pos_session_id',
                    $session->id
                )
                ->whereRaw(
                    "LOWER(TRIM(COALESCE(payment_method, ''))) = ?",
                    [
                        'cash',
                    ]
                )
                ->whereIn(
                    \Illuminate\Support\Facades\DB::raw(
                        "LOWER(TRIM(COALESCE(status, '')))"
                    ),
                    $settledStatuses
                )
                ->whereHas(
                    'sale',
                    function (
                        $query
                    ) use (
                        $session,
                        $businessDate
                    ): void {
                        $query
                            ->where(
                                'tenant_id',
                                $session->tenant_id
                            )
                            ->where(
                                'branch_id',
                                $session->branch_id
                            )
                            ->where(
                                function (
                                    $linked
                                ) use (
                                    $session
                                ): void {
                                    $linked
                                        ->whereNull(
                                            'pos_session_id'
                                        )
                                        ->orWhere(
                                            'pos_session_id',
                                            $session->id
                                        );
                                }
                            )
                            ->whereRaw(
                                "LOWER(TRIM(COALESCE(status, ''))) NOT LIKE ?",
                                [
                                    '%cancel%',
                                ]
                            )
                            ->whereRaw(
                                "LOWER(TRIM(COALESCE(status, ''))) NOT LIKE ?",
                                [
                                    '%void%',
                                ]
                            )
                            ->whereRaw(
                                "LOWER(TRIM(COALESCE(status, ''))) NOT LIKE ?",
                                [
                                    '%return%',
                                ]
                            );

                        if ($businessDate) {
                            $query->whereDate(
                                'business_date',
                                $businessDate
                            );
                        }
                    }
                )
                ->sum('amount'),
            2
        );

        /*
         * ------------------------------------------------------
         * 2. EXACT SALE SESSION ID; PAYMENT SESSION NULL
         * ------------------------------------------------------
         */
        $saleLinkedCash = round(
            (float)
            PharmacoPayment::query()
                ->where(
                    'tenant_id',
                    $session->tenant_id
                )
                ->whereNull(
                    'pos_session_id'
                )
                ->whereRaw(
                    "LOWER(TRIM(COALESCE(payment_method, ''))) = ?",
                    [
                        'cash',
                    ]
                )
                ->whereIn(
                    \Illuminate\Support\Facades\DB::raw(
                        "LOWER(TRIM(COALESCE(status, '')))"
                    ),
                    $settledStatuses
                )
                ->whereHas(
                    'sale',
                    function (
                        $query
                    ) use (
                        $session,
                        $businessDate
                    ): void {
                        $query
                            ->where(
                                'tenant_id',
                                $session->tenant_id
                            )
                            ->where(
                                'branch_id',
                                $session->branch_id
                            )
                            ->where(
                                'pos_session_id',
                                $session->id
                            )
                            ->whereRaw(
                                "LOWER(TRIM(COALESCE(status, ''))) NOT LIKE ?",
                                [
                                    '%cancel%',
                                ]
                            )
                            ->whereRaw(
                                "LOWER(TRIM(COALESCE(status, ''))) NOT LIKE ?",
                                [
                                    '%void%',
                                ]
                            )
                            ->whereRaw(
                                "LOWER(TRIM(COALESCE(status, ''))) NOT LIKE ?",
                                [
                                    '%return%',
                                ]
                            );

                        if ($businessDate) {
                            $query->whereDate(
                                'business_date',
                                $businessDate
                            );
                        }
                    }
                )
                ->sum('amount'),
            2
        );

        /*
         * ------------------------------------------------------
         * 3. LEGACY BOTH-NULL ATTRIBUTION
         * ------------------------------------------------------
         */
        $legacyCash =
            0.0;

        $legacyMode =
            'not_required';

        $legacySafe =
            true;

        $legacyPeerCount =
            0;

        $legacyWindowStart =
            null;

        $legacyWindowEnd =
            null;

        if (
            $sessionMode !== 'historical'
            &&
            $businessDate
            &&
            $session->user_id
            &&
            $session->branch_id
        ) {
            $legacyPeerCount =
                PharmacoPosSession::query()
                    ->where(
                        'tenant_id',
                        $session->tenant_id
                    )
                    ->where(
                        'branch_id',
                        $session->branch_id
                    )
                    ->where(
                        'user_id',
                        $session->user_id
                    )
                    ->whereDate(
                        'business_date',
                        $businessDate
                    )
                    ->count();

            $legacyQuery =
                PharmacoPayment::query()
                    ->where(
                        'tenant_id',
                        $session->tenant_id
                    )
                    ->whereNull(
                        'pos_session_id'
                    )
                    ->where(
                        'received_by',
                        $session->user_id
                    )
                    ->whereRaw(
                        "LOWER(TRIM(COALESCE(payment_method, ''))) = ?",
                        [
                            'cash',
                        ]
                    )
                    ->whereIn(
                        \Illuminate\Support\Facades\DB::raw(
                            "LOWER(TRIM(COALESCE(status, '')))"
                        ),
                        $settledStatuses
                    )
                    ->whereHas(
                        'sale',
                        function (
                            $query
                        ) use (
                            $session,
                            $businessDate
                        ): void {
                            $query
                                ->where(
                                    'tenant_id',
                                    $session->tenant_id
                                )
                                ->where(
                                    'branch_id',
                                    $session->branch_id
                                )
                                ->whereNull(
                                    'pos_session_id'
                                )
                                ->whereDate(
                                    'business_date',
                                    $businessDate
                                )
                                ->whereRaw(
                                    "LOWER(TRIM(COALESCE(status, ''))) NOT LIKE ?",
                                    [
                                        '%cancel%',
                                    ]
                                )
                                ->whereRaw(
                                    "LOWER(TRIM(COALESCE(status, ''))) NOT LIKE ?",
                                    [
                                        '%void%',
                                    ]
                                )
                                ->whereRaw(
                                    "LOWER(TRIM(COALESCE(status, ''))) NOT LIKE ?",
                                    [
                                        '%return%',
                                    ]
                                );
                        }
                    );

            if (
                $legacyPeerCount === 1
            ) {
                /*
                 * One POS session for pharmacist + branch + day.
                 * Same-day unlinked cash is safely attributable.
                 */
                $legacyMode =
                    'unique_user_branch_business_date';

                $legacyCash = round(
                    (float)
                    $legacyQuery
                        ->sum('amount'),
                    2
                );

            } elseif (
                $legacyPeerCount > 1
                &&
                $session->opened_at !== null
            ) {
                /*
                 * Multiple same-day sessions:
                 * use immutable payment received_at boundaries.
                 */
                $missingTimestampCount =
                    (clone $legacyQuery)
                        ->whereNull(
                            'received_at'
                        )
                        ->count();

                if (
                    $missingTimestampCount > 0
                ) {
                    $legacyMode =
                        'ambiguous_missing_received_at';

                    $legacySafe =
                        false;

                } else {
                    $legacyWindowStart =
                        $session->opened_at;

                    $cutoff =
                        $endingAt
                        ??
                        $session->closed_at
                        ??
                        $session->zeroized_at;

                    $nextOpenedAt =
                        PharmacoPosSession::query()
                            ->where(
                                'tenant_id',
                                $session->tenant_id
                            )
                            ->where(
                                'branch_id',
                                $session->branch_id
                            )
                            ->where(
                                'user_id',
                                $session->user_id
                            )
                            ->whereDate(
                                'business_date',
                                $businessDate
                            )
                            ->where(
                                'id',
                                '<>',
                                $session->id
                            )
                            ->whereNotNull(
                                'opened_at'
                            )
                            ->where(
                                'opened_at',
                                '>',
                                $session->opened_at
                            )
                            ->orderBy(
                                'opened_at'
                            )
                            ->value(
                                'opened_at'
                            );

                    if (
                        $nextOpenedAt !== null
                        &&
                        (
                            $cutoff === null
                            ||
                            \Carbon\Carbon::parse(
                                $nextOpenedAt
                            )
                            ->lt(
                                \Carbon\Carbon::parse(
                                    $cutoff
                                )
                            )
                        )
                    ) {
                        $cutoff =
                            $nextOpenedAt;
                    }

                    if ($cutoff === null) {
                        $cutoff =
                            now(
                                (string)
                                config(
                                    'app.timezone',
                                    'UTC'
                                )
                            );
                    }

                    $legacyWindowEnd =
                        $cutoff;

                    if (
                        \Carbon\Carbon::parse(
                            $cutoff
                        )
                        ->gt(
                            \Carbon\Carbon::parse(
                                $session->opened_at
                            )
                        )
                    ) {
                        $legacyMode =
                            'opened_at_window';

                        $legacyCash = round(
                            (float)
                            $legacyQuery
                                ->where(
                                    'received_at',
                                    '>=',
                                    $session->opened_at
                                )
                                ->where(
                                    'received_at',
                                    '<',
                                    $cutoff
                                )
                                ->sum('amount'),
                            2
                        );

                    } else {
                        $legacyMode =
                            'ambiguous_invalid_time_window';

                        $legacySafe =
                            false;
                    }
                }

            } elseif (
                $legacyPeerCount > 1
            ) {
                $legacyMode =
                    'ambiguous_multiple_sessions';

                $legacySafe =
                    false;

            } else {
                $legacyMode =
                    'no_matching_session_context';
            }
        }

        $cashPayments = round(
            $directCash
            +
            $saleLinkedCash
            +
            $legacyCash,
            2
        );

        $openingFloat = round(
            (float)
            $session->opening_float_amount,
            2
        );

        $cashDrops = round(
            (float)
            $session->cash_drop_amount,
            2
        );

        $balanceClearance = round(
            (float)
            $session->balance_clearance_amount,
            2
        );

        $expected = round(
            max(
                0,
                $openingFloat
                +
                $cashPayments
                -
                $cashDrops
                -
                $balanceClearance
            ),
            2
        );

        return [
            'opening_float_amount' =>
                $openingFloat,

            'direct_payment_session_cash' =>
                $directCash,

            'sale_linked_payment_session_null_cash' =>
                $saleLinkedCash,

            'legacy_unlinked_cash' =>
                $legacyCash,

            'legacy_attribution_mode' =>
                $legacyMode,

            'legacy_attribution_safe' =>
                $legacySafe,

            'legacy_peer_session_count' =>
                $legacyPeerCount,

            'legacy_window_start' =>
                $legacyWindowStart
                    ? (string)
                        $legacyWindowStart
                    : null,

            'legacy_window_end' =>
                $legacyWindowEnd
                    ? (string)
                        $legacyWindowEnd
                    : null,

            'cash_payments_total' =>
                $cashPayments,

            'cash_drop_amount' =>
                $cashDrops,

            'balance_clearance_amount' =>
                $balanceClearance,

            'expected_handover_amount' =>
                $expected,
        ];
    }

    public function expectedCash(
        PharmacoPosSession $session
    ): float {
        return (float)
            $this
                ->expectedCashBreakdown(
                    $session
                )[
                    'expected_handover_amount'
                ];
    }


    /*
     * AQUILA_POS_MIDNIGHT_AUTOCLOSE_R578M_R1
     *
     * Live POS sessions must not remain open across a Kigali
     * business-date rollover.
     */
    public function autoCloseExpiredLiveSessions(
        bool $dryRun = false
    ): array {
        $timezone =
            (string)
            config(
                'pharmaco.business_timezone',
                'Africa/Kigali'
            );

        $today =
            now(
                $timezone
            )
            ->toDateString();

        $ids =
            PharmacoPosSession::query()
                ->whereDate(
                    'business_date',
                    '<',
                    $today
                )
                ->whereIn(
                    'status',
                    [
                        'open',
                        'zeroized',
                    ]
                )
                ->where(
                    function ($query) {
                        $query
                            ->whereNull(
                                'session_mode'
                            )
                            ->orWhereRaw(
                                "LOWER(TRIM(COALESCE(session_mode, 'live'))) = ?",
                                [
                                    'live',
                                ]
                            );
                    }
                )
                ->orderBy(
                    'business_date'
                )
                ->orderBy('id')
                ->pluck('id')
                ->all();

        $rows = [];

        foreach ($ids as $id) {

            $runner =
                function () use (
                    $id,
                    $today,
                    $timezone,
                    $dryRun
                ) {
                    $query =
                        PharmacoPosSession
                            ::query();

                    if (! $dryRun) {
                        $query->lockForUpdate();
                    }

                    $session =
                        $query->find(
                            $id
                        );

                    if (! $session) {
                        return null;
                    }

                    $status =
                        strtolower(
                            trim(
                                (string)
                                $session->status
                            )
                        );

                    $mode =
                        strtolower(
                            trim(
                                (string) (
                                    $session
                                        ->session_mode
                                    ??
                                    'live'
                                )
                            )
                        );

                    $date =
                        $session
                            ->business_date
                            ?->toDateString()
                        ??
                        substr(
                            (string)
                            $session
                                ->business_date,
                            0,
                            10
                        );

                    if (
                        ! in_array(
                            $status,
                            [
                                'open',
                                'zeroized',
                            ],
                            true
                        )
                        ||
                        $mode !== 'live'
                        ||
                        ! $date
                        ||
                        $date >= $today
                    ) {
                        return null;
                    }

                    $boundaryKigali =
                        \Carbon\Carbon::createFromFormat(
                            'Y-m-d H:i:s',
                            $date
                            .
                            ' 00:00:00',
                            $timezone
                        )
                        ->addDay()
                        ->startOfDay();

                    $storageBoundary =
                        $boundaryKigali
                            ->copy()
                            ->setTimezone(
                                (string)
                                config(
                                    'app.timezone',
                                    'UTC'
                                )
                            );

                    $breakdown =
                        $this
                            ->expectedCashBreakdown(
                                $session,
                                $storageBoundary
                            );

                    $expected =
                        (float)
                        $breakdown[
                            'expected_handover_amount'
                        ];

                    $result = [
                        'session_id' =>
                            (int)
                            $session->id,

                        'session_number' =>
                            $session
                                ->session_number,

                        'business_date' =>
                            $date,

                        'previous_status' =>
                            $status,

                        'expected_handover_amount' =>
                            $expected,

                        'closed_at_kigali' =>
                            $boundaryKigali
                                ->toIso8601String(),
                    ];

                    if ($dryRun) {
                        return $result;
                    }

                    $metadata =
                        is_array(
                            $session->metadata
                        )
                            ?
                            $session->metadata
                            :
                            [];

                    $metadata[
                        'system_auto_close'
                    ] = [
                        'reason' =>
                            'business_date_rollover',

                        'business_timezone' =>
                            $timezone,

                        'business_date' =>
                            $date,

                        'closed_at_kigali' =>
                            $boundaryKigali
                                ->toIso8601String(),

                        'expected_handover_amount' =>
                            $expected,

                        'expected_handover_breakdown' =>
                            $breakdown,

                        'reconciliation_status' =>
                            'awaiting_owner_handover',
                    ];

                    $session->forceFill([
                        'status' =>
                            'closed',

                        'expected_cash_amount' =>
                            $expected,

                        'closed_at' =>
                            $storageBoundary,

                        'metadata' =>
                            $metadata,
                    ])->save();

                    \App\Models\PharmacoPosClockEvent
                        ::query()
                        ->create([
                            'uuid' =>
                                (string)
                                \Illuminate\Support\Str
                                    ::uuid(),

                            'tenant_id' =>
                                $session->tenant_id,

                            'pos_session_id' =>
                                $session->id,

                            'user_id' =>
                                $session->user_id,

                            'event_type' =>
                                'clock_out',

                            'amount' =>
                                $expected,

                            'notes' =>
                                'System auto-close at Kigali business-date rollover.',

                            'metadata' => [
                                'system_auto_close' =>
                                    true,

                                'reason' =>
                                    'business_date_rollover',

                                'business_date' =>
                                    $date,

                                'business_timezone' =>
                                    $timezone,

                                'expected_handover_amount' =>
                                    $expected,

                                'reconciliation_status' =>
                                    'awaiting_owner_handover',
                            ],
                        ]);

                    return $result;
                };

            $result =
                $dryRun
                    ?
                    $runner()
                    :
                    \Illuminate\Support\Facades\DB
                        ::transaction(
                            $runner
                        );

            if ($result !== null) {
                $rows[] =
                    $result;
            }
        }

        return [
            'dry_run' =>
                $dryRun,

            'business_date' =>
                $today,

            'matched_count' =>
                count(
                    $ids
                ),

            'closed_count' =>
                $dryRun
                    ?
                    0
                    :
                    count(
                        $rows
                    ),

            'sessions' =>
                $rows,
        ];
    }

public function businessDate(): string
    {
        $timezone = (string) config(
            'pharmaco.business_timezone',
            'Africa/Kigali'
        );

        return now($timezone)->toDateString();
    }

    public function nextLiveSequence(
        ?PharmacoPosSession $latestSession
    ): int {
        if (! $latestSession) {
            return 1;
        }

        return max(
            1,
            (int)
            $latestSession->sequence_number + 1
        );
    }

public function nextSequence(
        ?PharmacoPosSession $latestSession
    ): int {
        if (! $latestSession) {
            return 1;
        }

        if (
            $latestSession->status !== 'closed'
            || $latestSession->closed_at === null
        ) {
            throw ValidationException::withMessages([
                'business_date' => [
                    'A POS session already exists for this user today. '
                    . 'The existing session must clear its balance '
                    . 'and close before any further action.',
                ],
            ]);
        }

        if (! $this->hasResetAuthorization(
            $latestSession
        )) {
            throw ValidationException::withMessages([
                'business_date' => [
                    'Only one POS session is permitted per user and '
                    . 'business day. An administrator must authorize '
                    . 'a reset before another session can be opened.',
                ],
            ]);
        }

        return max(
            1,
            (int) $latestSession->sequence_number + 1
        );
    }

public function ensureCanClearBalance(
        PharmacoPosSession $session
    ): void {
        if ($session->status !== 'open') {
            throw ValidationException::withMessages([
                'session' => [
                    'Only an open POS session can clear its balance.',
                ],
            ]);
        }
    }

    public function hasResetAuthorization(
        PharmacoPosSession $session
    ): bool {
        /*
         * Backward compatibility for production rows created before
         * authorization moved to immutable POS clock events.
         */
        if ($session->reset_authorized_at !== null) {
            return true;
        }

        if (
            $session->relationLoaded('events')
            && $session->events->contains(
                fn ($event): bool =>
                    $event->event_type
                    === 'admin_reset'
            )
        ) {
            return true;
        }

        return $session->events()
            ->where(
                'event_type',
                'admin_reset'
            )
            ->exists();
    }

    public function resetAuthorizationSnapshot(
        PharmacoPosSession $session
    ): ?array {
        $event = null;

        if ($session->relationLoaded('events')) {
            $event = $session->events
                ->where(
                    'event_type',
                    'admin_reset'
                )
                ->sortByDesc('id')
                ->first();
        }

        if (! $event) {
            $event = $session->events()
                ->where(
                    'event_type',
                    'admin_reset'
                )
                ->latest('id')
                ->first();
        }

        if ($event) {
            $authorizer =
                \App\Models\User::query()
                    ->select([
                        'id',
                        'name',
                        'email',
                    ])
                    ->find(
                        $event->user_id
                    );

            return [
                'authorized' => true,
                'reason' =>
                    $event->notes,
                'authorized_at' =>
                    $event->created_at,
                'authorized_by' =>
                    $event->user_id,
                'authorizer' =>
                    $authorizer
                        ? [
                            'id' =>
                                $authorizer->id,
                            'name' =>
                                $authorizer->name,
                            'email' =>
                                $authorizer->email,
                        ]
                        : null,
                'source' =>
                    'clock_event',
                'event_id' =>
                    $event->id,
            ];
        }

        if ($session->reset_authorized_at === null) {
            return null;
        }

        $authorizer =
            $session->relationLoaded(
                'resetAuthorizer'
            )
                ? $session->resetAuthorizer
                : \App\Models\User::query()
                    ->select([
                        'id',
                        'name',
                        'email',
                    ])
                    ->find(
                        $session
                            ->reset_authorized_by
                    );

        return [
            'authorized' => true,
            'reason' =>
                $session->reset_reason,
            'authorized_at' =>
                $session->reset_authorized_at,
            'authorized_by' =>
                $session->reset_authorized_by,
            'authorizer' =>
                $authorizer
                    ? [
                        'id' =>
                            $authorizer->id,
                        'name' =>
                            $authorizer->name,
                        'email' =>
                            $authorizer->email,
                    ]
                    : null,
            'source' =>
                'legacy_columns',
            'event_id' =>
                null,
        ];
    }

public function ensureCanAuthorizeReset(
        PharmacoPosSession $session
    ): void {
        if (
            $session->status !== 'closed'
            || $session->closed_at === null
        ) {
            throw ValidationException::withMessages([
                'session' => [
                    'An administrator can reset only a session '
                    . 'that has cleared its balance and closed.',
                ],
            ]);
        }

        if ($this->hasResetAuthorization(
            $session
        )) {
            throw ValidationException::withMessages([
                'session' => [
                    'A reset has already been authorized '
                    . 'for this session.',
                ],
            ]);
        }
    }
}
