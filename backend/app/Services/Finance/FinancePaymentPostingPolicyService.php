<?php

declare(strict_types=1);

namespace App\Services\Finance;

use App\Exceptions\Finance\FinancePaymentPostingBlockedException;
use App\Models\FinancePaymentPostingPolicy;
use App\Models\FinancePaymentPostingPolicyAttempt;
use Illuminate\Support\Str;
use InvalidArgumentException;
use RuntimeException;

final class FinancePaymentPostingPolicyService
{
    public const ACTION_DO_NOT_BACKFILL =
        'do_not_backfill';

    public const ACTION_DEFER_REVIEW =
        'defer_review';

    public const STATUS_ACTIVE =
        'active';

    public const DECISION_ALLOW =
        'ALLOW';

    public const DECISION_BLOCK =
        'BLOCK_DO_NOT_BACKFILL';

    public const DECISION_DEFER =
        'DEFER_REVIEW_REQUIRED';

    /**
     * @return array{
     *     decision:string,
     *     reason:string,
     *     policy:?FinancePaymentPostingPolicy
     * }
     */
    public function decisionFor(
        int $tenantId,
        string $sourceType,
        int $sourceId
    ): array {
        $policy =
            FinancePaymentPostingPolicy::query()
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->where(
                    'source_type',
                    $sourceType
                )
                ->where(
                    'source_id',
                    $sourceId
                )
                ->where(
                    'status',
                    self::STATUS_ACTIVE
                )
                ->first();

        if ($policy === null) {
            return [
                'decision' =>
                    self::DECISION_ALLOW,

                'reason' =>
                    'No active payment-posting policy applies.',

                'policy' =>
                    null,
            ];
        }

        return match (
            $policy->policy_action
        ) {
            self::ACTION_DO_NOT_BACKFILL => [
                'decision' =>
                    self::DECISION_BLOCK,

                'reason' =>
                    'Owner-approved policy prohibits historical Finance backfill.',

                'policy' =>
                    $policy,
            ],

            self::ACTION_DEFER_REVIEW => [
                'decision' =>
                    self::DECISION_DEFER,

                'reason' =>
                    'Payment requires documented human review before Finance posting.',

                'policy' =>
                    $policy,
            ],

            default =>
                throw new RuntimeException(
                    'Unknown active Finance payment-posting policy action.'
                ),
        };
    }


    /**
     * UBUZIMA_FINANCE_POLICY_CLASSIFICATION_V3D2B
     *
     * Classify historical payment candidates without recording an
     * attempted posting. This is suitable for dry-run and reconciliation.
     *
     * @return array{
     *     allowed:array<int,int>,
     *     blocked:array<int,int>,
     *     deferred:array<int,int>
     * }
     */
    public function classifyPayments(
        iterable $payments
    ): array {
        $classified = [
            'allowed' => [],
            'blocked' => [],
            'deferred' => [],
        ];

        foreach ($payments as $payment) {
            $tenantId = (int) data_get(
                $payment,
                'tenant_id'
            );

            $paymentId = (int) data_get(
                $payment,
                'id'
            );

            if (
                $tenantId <= 0
                || $paymentId <= 0
            ) {
                throw new InvalidArgumentException(
                    'Historical payment classification requires positive tenant and payment IDs.'
                );
            }

            $decision = $this->decisionFor(
                $tenantId,
                'payment',
                $paymentId
            );

            match ($decision['decision']) {
                self::DECISION_ALLOW =>
                    $classified['allowed'][] =
                        $paymentId,

                self::DECISION_BLOCK =>
                    $classified['blocked'][] =
                        $paymentId,

                self::DECISION_DEFER =>
                    $classified['deferred'][] =
                        $paymentId,

                default =>
                    throw new RuntimeException(
                        'Unknown Finance payment policy decision.'
                    ),
            };
        }

        return $classified;
    }

    public function assertBackfillAllowed(
        int $tenantId,
        string $sourceType,
        int $sourceId,
        string $attemptedCommand,
        ?int $attemptedByUserId = null,
        ?string $requestCorrelationId = null,
        array $metadata = []
    ): void {
        $result = $this->decisionFor(
            $tenantId,
            $sourceType,
            $sourceId
        );

        if (
            $result['decision']
            === self::DECISION_ALLOW
        ) {
            return;
        }

        $policy = $result['policy'];

        FinancePaymentPostingPolicyAttempt::query()
            ->create([
                'tenant_id' =>
                    $tenantId,

                'policy_id' =>
                    $policy?->id,

                'source_type' =>
                    $sourceType,

                'source_id' =>
                    $sourceId,

                'attempted_command' =>
                    $attemptedCommand,

                'decision' =>
                    $result['decision'],

                'reason' =>
                    $result['reason'],

                'attempted_by_user_id' =>
                    $attemptedByUserId,

                'attempted_at' =>
                    now(),

                'request_correlation_id' =>
                    $requestCorrelationId
                    ?? (string) Str::uuid(),

                'metadata' =>
                    $metadata,
            ]);

        throw new FinancePaymentPostingBlockedException(
            $result['decision'],
            $policy?->id,
            $result['reason']
        );
    }
}
