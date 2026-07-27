<?php

declare(strict_types=1);

namespace Tests\Feature\PharmaCo360;

use App\Exceptions\Finance\FinancePaymentPostingBlockedException;
use App\Models\FinancePaymentPostingPolicy;
use App\Models\FinancePaymentPostingPolicyAttempt;
use App\Services\Finance\FinancePaymentPostingPolicyService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use LogicException;
use Tests\TestCase;

final class FinancePaymentPostingPolicyServiceTest extends TestCase
{
    use RefreshDatabase;

    public function test_unlisted_payment_is_allowed(): void
    {
        $decision = app(
            FinancePaymentPostingPolicyService::class
        )->decisionFor(
            1,
            'payment',
            9001
        );

        self::assertSame(
            FinancePaymentPostingPolicyService::DECISION_ALLOW,
            $decision['decision']
        );

        self::assertNull(
            $decision['policy']
        );
    }

    public function test_no_backfill_policy_blocks_and_audits(): void
    {
        $policy = $this->createPolicy(
            1,
            9002,
            FinancePaymentPostingPolicyService::ACTION_DO_NOT_BACKFILL
        );

        try {
            app(
                FinancePaymentPostingPolicyService::class
            )->assertBackfillAllowed(
                1,
                'payment',
                9002,
                'finance:test-backfill',
                1,
                'test-correlation-id'
            );

            self::fail(
                'Expected a blocking exception.'
            );
        } catch (
            FinancePaymentPostingBlockedException $exception
        ) {
            self::assertSame(
                FinancePaymentPostingPolicyService::DECISION_BLOCK,
                $exception->decision
            );

            self::assertSame(
                $policy->id,
                $exception->policyId
            );
        }

        $attempt =
            FinancePaymentPostingPolicyAttempt::query()
                ->firstOrFail();

        self::assertSame(
            9002,
            $attempt->source_id
        );

        self::assertSame(
            FinancePaymentPostingPolicyService::DECISION_BLOCK,
            $attempt->decision
        );

        self::assertSame(
            'test-correlation-id',
            $attempt->request_correlation_id
        );
    }

    public function test_payment_10_can_require_human_review(): void
    {
        $this->createPolicy(
            1,
            10,
            FinancePaymentPostingPolicyService::ACTION_DEFER_REVIEW
        );

        $decision = app(
            FinancePaymentPostingPolicyService::class
        )->decisionFor(
            1,
            'payment',
            10
        );

        self::assertSame(
            FinancePaymentPostingPolicyService::DECISION_DEFER,
            $decision['decision']
        );
    }

    public function test_policy_is_tenant_isolated(): void
    {
        $this->createPolicy(
            2,
            9003,
            FinancePaymentPostingPolicyService::ACTION_DO_NOT_BACKFILL
        );

        $decision = app(
            FinancePaymentPostingPolicyService::class
        )->decisionFor(
            1,
            'payment',
            9003
        );

        self::assertSame(
            FinancePaymentPostingPolicyService::DECISION_ALLOW,
            $decision['decision']
        );
    }

    public function test_active_policy_is_immutable(): void
    {
        $policy = $this->createPolicy(
            1,
            9004,
            FinancePaymentPostingPolicyService::ACTION_DO_NOT_BACKFILL
        );

        try {
            $policy->update([
                'status' => 'inactive',
            ]);

            self::fail(
                'Expected immutable update failure.'
            );
        } catch (LogicException) {
            self::assertTrue(true);
        }

        $policy =
            FinancePaymentPostingPolicy::query()
                ->findOrFail(
                    $policy->id
                );

        try {
            $policy->delete();

            self::fail(
                'Expected immutable delete failure.'
            );
        } catch (LogicException) {
            self::assertTrue(true);
        }
    }


    public function test_classifies_historical_payment_cohort_without_attempt_writes(): void
    {
        $this->createPolicy(
            tenantId: 1,
            paymentId: 11,
            action:
                FinancePaymentPostingPolicyService::ACTION_DO_NOT_BACKFILL
        );

        $this->createPolicy(
            tenantId: 1,
            paymentId: 10,
            action:
                FinancePaymentPostingPolicyService::ACTION_DEFER_REVIEW
        );

        $classified = app(
            FinancePaymentPostingPolicyService::class
        )->classifyPayments([
            (object) [
                'tenant_id' => 1,
                'id' => 11,
            ],
            (object) [
                'tenant_id' => 1,
                'id' => 10,
            ],
            (object) [
                'tenant_id' => 1,
                'id' => 12,
            ],
        ]);

        self::assertSame(
            [12],
            $classified['allowed']
        );

        self::assertSame(
            [11],
            $classified['blocked']
        );

        self::assertSame(
            [10],
            $classified['deferred']
        );

        self::assertSame(
            0,
            FinancePaymentPostingPolicyAttempt::query()
                ->count()
        );
    }

    private function createPolicy(
        int $tenantId,
        int $paymentId,
        string $action
    ): FinancePaymentPostingPolicy {
        return FinancePaymentPostingPolicy::query()
            ->create([
                'tenant_id' =>
                    $tenantId,

                'policy_code' =>
                    'TEST_POLICY',

                'source_type' =>
                    'payment',

                'source_id' =>
                    $paymentId,

                'policy_action' =>
                    $action,

                'status' =>
                    FinancePaymentPostingPolicyService::STATUS_ACTIVE,

                'effective_date' =>
                    '2026-08-01',

                'source_amount' =>
                    '1000.0000',

                'source_business_date' =>
                    '2026-07-01',

                'source_state_hash' =>
                    str_repeat('a', 64),

                'reason' =>
                    'Test owner policy.',

                'evidence_reference' =>
                    'test-evidence',

                'evidence_hash' =>
                    str_repeat('b', 64),

                'approved_by_user_id' =>
                    1,

                'approved_at' =>
                    '2026-07-27 18:00:00',

                'metadata' => [
                    'test' => true,
                ],
            ]);
    }
}
