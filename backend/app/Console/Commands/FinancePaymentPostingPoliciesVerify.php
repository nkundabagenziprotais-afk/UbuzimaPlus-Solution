<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Models\FinancePaymentPostingPolicy;
use App\Services\Finance\FinancePaymentPostingPolicyService;
use Illuminate\Console\Command;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use RuntimeException;
use Throwable;

final class FinancePaymentPostingPoliciesVerify extends Command
{
    protected $signature =
        'finance:payment-posting-policies:verify
        {--tenant=1}
        {--policy-code=OWNER_APPROVED_182_PRE_CUTOVER_NO_BACKFILL_2026_08_01}
        {--expected-count=182}
        {--expected-total=831345.8900}
        {--expected-ids-sha256=b74dbaf828751064c9ab258e21c9fc2d9f3d261377677def17db455d75f9def2}';

    protected $description =
        'Verify active owner-approved payment no-backfill policies.';

    public function handle(): int
    {
        try {
            return $this->executeVerification();
        } catch (Throwable $throwable) {
            $this->error(
                $throwable->getMessage()
            );

            return self::FAILURE;
        }
    }

    private function executeVerification(): int
    {
        $tenantId = (int) $this->option(
            'tenant'
        );

        $policyCode = trim(
            (string) $this->option(
                'policy-code'
            )
        );

        $expectedCount = (int) $this->option(
            'expected-count'
        );

        $expectedTotal = number_format(
            (float) $this->option(
                'expected-total'
            ),
            4,
            '.',
            ''
        );

        $expectedIdsHash = strtolower(
            trim(
                (string) $this->option(
                    'expected-ids-sha256'
                )
            )
        );

        $policies =
            FinancePaymentPostingPolicy::query()
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->where(
                    'policy_code',
                    $policyCode
                )
                ->where(
                    'policy_action',
                    FinancePaymentPostingPolicyService::ACTION_DO_NOT_BACKFILL
                )
                ->where(
                    'status',
                    FinancePaymentPostingPolicyService::STATUS_ACTIVE
                )
                ->orderBy('source_id')
                ->get();

        $ids = $policies
            ->pluck('source_id')
            ->map(
                static fn (
                    mixed $value
                ): int =>
                    (int) $value
            )
            ->values()
            ->all();

        $idsHash = hash(
            'sha256',
            json_encode(
                $ids,
                JSON_THROW_ON_ERROR
            )
        );

        $total = number_format(
            $policies->sum(
                static fn (
                    FinancePaymentPostingPolicy $policy
                ): float =>
                    (float) $policy->source_amount
            ),
            4,
            '.',
            ''
        );

        $exceptions = [];

        if (
            $policies->count()
            !== $expectedCount
        ) {
            $exceptions[] =
                'policy_count_mismatch';
        }

        if ($total !== $expectedTotal) {
            $exceptions[] =
                'policy_total_mismatch';
        }

        if ($idsHash !== $expectedIdsHash) {
            $exceptions[] =
                'payment_id_hash_mismatch';
        }

        if (in_array(10, $ids, true)) {
            $exceptions[] =
                'payment_10_included';
        }

        foreach ($policies as $policy) {
            $payment = DB::table(
                'pharmaco_payments'
            )
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->where(
                    'id',
                    $policy->source_id
                )
                ->first();

            if ($payment === null) {
                $exceptions[] =
                    'payment_missing:'
                    . $policy->source_id;

                continue;
            }

            $status = strtolower(
                trim(
                    (string) $payment->status
                )
            );

            $businessDate = substr(
                (string) $payment->business_date,
                0,
                10
            );

            $amount = number_format(
                (float) $payment->amount,
                4,
                '.',
                ''
            );

            $stateHash = hash(
                'sha256',
                json_encode(
                    [
                        'tenant_id' =>
                            $tenantId,

                        'payment_id' =>
                            (int) $policy->source_id,

                        'status' =>
                            $status,

                        'business_date' =>
                            $businessDate,

                        'amount' =>
                            $amount,
                    ],
                    JSON_THROW_ON_ERROR
                )
            );

            if ($status !== 'completed') {
                $exceptions[] =
                    'payment_not_completed:'
                    . $policy->source_id;
            }

            if (
                $businessDate
                !== $policy->source_business_date
                    ->format('Y-m-d')
            ) {
                $exceptions[] =
                    'business_date_changed:'
                    . $policy->source_id;
            }

            if (
                $amount
                !== (string) $policy->source_amount
            ) {
                $exceptions[] =
                    'amount_changed:'
                    . $policy->source_id;
            }

            if (
                $stateHash
                !== $policy->source_state_hash
            ) {
                $exceptions[] =
                    'source_state_hash_changed:'
                    . $policy->source_id;
            }

            if (
                $this->paymentHasFinanceLink(
                    $tenantId,
                    (int) $policy->source_id
                )
            ) {
                $exceptions[] =
                    'payment_has_finance_link:'
                    . $policy->source_id;
            }
        }

        $this->line(
            'active_policy_count='
            . $policies->count()
        );

        $this->line(
            'active_policy_total='
            . $total
        );

        $this->line(
            'active_policy_ids_sha256='
            . $idsHash
        );

        $this->line(
            'validation_exception_count='
            . count($exceptions)
        );

        if ($exceptions !== []) {
            foreach ($exceptions as $exception) {
                $this->error($exception);
            }

            throw new RuntimeException(
                'Finance payment-posting policy verification failed.'
            );
        }

        $this->line(
            'finance_payment_policy_verify_status=VALID'
        );

        return self::SUCCESS;
    }

    private function paymentHasFinanceLink(
        int $tenantId,
        int $paymentId
    ): bool {
        return DB::table(
            'finance_journal_entries'
        )
            ->where(
                'tenant_id',
                $tenantId
            )
            ->where(
                function (
                    Builder $query
                ) use (
                    $paymentId
                ): void {
                    $query
                        ->where(
                            'idempotency_key',
                            'pos-payment-shadow-'
                            . $paymentId
                        )
                        ->orWhere(
                            'idempotency_key',
                            'pos-payment-authoritative-'
                            . $paymentId
                        );

                    if (
                        Schema::hasColumn(
                            'finance_journal_entries',
                            'source_type'
                        )
                        && Schema::hasColumn(
                            'finance_journal_entries',
                            'source_id'
                        )
                    ) {
                        $query->orWhere(
                            function (
                                Builder $sourceQuery
                            ) use (
                                $paymentId
                            ): void {
                                $sourceQuery
                                    ->where(
                                        'source_type',
                                        'payment'
                                    )
                                    ->where(
                                        'source_id',
                                        (string) $paymentId
                                    );
                            }
                        );
                    }
                }
            )
            ->exists();
    }
}
