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

public function expectedCash(
        PharmacoPosSession $session
    ): float {
        $cashPayments = PharmacoPayment::query()
            ->where(
                'tenant_id',
                $session->tenant_id
            )
            ->where(
                'pos_session_id',
                $session->id
            )
            ->where(
                'received_by',
                $session->user_id
            )
            ->where(
                'payment_method',
                'cash'
            )
            ->where(
                'status',
                'completed'
            )
            ->whereHas(
                'sale',
                function ($query) use ($session) {
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
                        ->whereNotIn(
                            'status',
                            [
                                'cancelled',
                                'voided',
                            ]
                        );
                }
            )
            ->sum('amount');

        return round(
            (float)
            $session->opening_float_amount
            + (float) $cashPayments
            - (float) $session->cash_drop_amount
            - (float)
            $session->balance_clearance_amount,
            2
        );
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
