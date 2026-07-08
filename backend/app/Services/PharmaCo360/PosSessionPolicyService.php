<?php

namespace App\Services\PharmaCo360;

use App\Models\PharmacoPayment;
use App\Models\PharmacoPosSession;
use Illuminate\Validation\ValidationException;

class PosSessionPolicyService
{
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
        $endingTime = $session->closed_at
            ?? $session->zeroized_at
            ?? now();

        $cashPayments = PharmacoPayment::query()
            ->where(
                'tenant_id',
                $session->tenant_id
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
            ->where(
                'received_at',
                '>=',
                $session->opened_at
            )
            ->where(
                'received_at',
                '<=',
                $endingTime
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

        /*
         * Outstanding till cash:
         *
         * opening float
         * + completed cash sales
         * - ordinary cash drops
         * - final balance clearance
         */
        return round(
            (float) $session->opening_float_amount
            + (float) $cashPayments
            - (float) $session->cash_drop_amount
            - (float) $session->balance_clearance_amount,
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

        if ($latestSession->reset_authorized_at === null) {
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

        if ($session->reset_authorized_at !== null) {
            throw ValidationException::withMessages([
                'session' => [
                    'A reset has already been authorized '
                    . 'for this session.',
                ],
            ]);
        }
    }
}
