<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Models\FinancePaymentPostingPolicy;
use App\Services\Finance\FinancePaymentPostingPolicyCsvValidator;
use App\Services\Finance\FinancePaymentPostingPolicyService;
use Carbon\CarbonImmutable;
use Illuminate\Console\Command;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use RuntimeException;
use Throwable;

final class FinancePaymentPostingPoliciesImportApproved extends Command
{
    protected $signature =
        'finance:payment-posting-policies:import-approved
        {csv : Owner-approved payment CSV}
        {--tenant=1}
        {--policy-code=OWNER_APPROVED_182_PRE_CUTOVER_NO_BACKFILL_2026_08_01}
        {--effective-date=2026-08-01}
        {--approved-by=1}
        {--approved-at=}
        {--evidence-reference=}
        {--evidence-hash=}
        {--expected-csv-sha256=}
        {--expected-count=182}
        {--expected-total=831345.8900}
        {--expected-ids-sha256=b74dbaf828751064c9ab258e21c9fc2d9f3d261377677def17db455d75f9def2}
        {--apply : Persist validated policy rows}';

    protected $description =
        'Validate and optionally import owner-approved payment no-backfill policies.';

    public function __construct(
        private readonly FinancePaymentPostingPolicyCsvValidator $validator
    ) {
        parent::__construct();
    }

    public function handle(): int
    {
        try {
            return $this->executeImport();
        } catch (Throwable $throwable) {
            $this->error(
                $throwable->getMessage()
            );

            return self::FAILURE;
        }
    }

    private function executeImport(): int
    {
        $csvPath = (string) $this->argument(
            'csv'
        );

        $tenantId = (int) $this->option(
            'tenant'
        );

        $policyCode = trim(
            (string) $this->option(
                'policy-code'
            )
        );

        $effectiveDate = trim(
            (string) $this->option(
                'effective-date'
            )
        );

        $approvedBy = (int) $this->option(
            'approved-by'
        );

        $approvedAtInput = trim(
            (string) $this->option(
                'approved-at'
            )
        );

        $evidenceReference = trim(
            (string) $this->option(
                'evidence-reference'
            )
        );

        $evidenceHash = strtolower(
            trim(
                (string) $this->option(
                    'evidence-hash'
                )
            )
        );

        $expectedCsvHash = strtolower(
            trim(
                (string) $this->option(
                    'expected-csv-sha256'
                )
            )
        );

        $expectedCount = (int) $this->option(
            'expected-count'
        );

        $expectedTotal = trim(
            (string) $this->option(
                'expected-total'
            )
        );

        $expectedIdsHash = strtolower(
            trim(
                (string) $this->option(
                    'expected-ids-sha256'
                )
            )
        );

        $apply = (bool) $this->option(
            'apply'
        );

        if (
            $tenantId <= 0
            || $approvedBy <= 0
        ) {
            throw new RuntimeException(
                'Tenant and approver IDs must be positive.'
            );
        }

        if (
            $policyCode === ''
            || $approvedAtInput === ''
            || $evidenceReference === ''
        ) {
            throw new RuntimeException(
                'Policy code, approved-at and evidence reference are required.'
            );
        }

        if (
            preg_match(
                '/^\d{4}-\d{2}-\d{2}$/',
                $effectiveDate
            ) !== 1
        ) {
            throw new RuntimeException(
                'Effective date must use YYYY-MM-DD.'
            );
        }

        foreach (
            [
                $evidenceHash,
                $expectedIdsHash,
            ]
            as $hash
        ) {
            if (
                preg_match(
                    '/^[a-f0-9]{64}$/',
                    $hash
                ) !== 1
            ) {
                throw new RuntimeException(
                    'Evidence and payment-ID hashes must be SHA-256 values.'
                );
            }
        }

        if (
            $expectedCsvHash !== ''
            && preg_match(
                '/^[a-f0-9]{64}$/',
                $expectedCsvHash
            ) !== 1
        ) {
            throw new RuntimeException(
                'Expected CSV hash must be a SHA-256 value.'
            );
        }

        foreach (
            [
                'finance_payment_posting_policies',
                'pharmaco_payments',
                'finance_journal_entries',
            ]
            as $table
        ) {
            if (! Schema::hasTable($table)) {
                throw new RuntimeException(
                    "Required table {$table} is missing."
                );
            }
        }

        $validated = $this->validator->validate(
            $csvPath,
            $expectedCount,
            $expectedTotal,
            $expectedIdsHash,
            $effectiveDate,
            [10]
        );

        if (
            $expectedCsvHash !== ''
            && $validated['csv_sha256']
                !== $expectedCsvHash
        ) {
            throw new RuntimeException(
                'Approved CSV SHA-256 differs.'
            );
        }

        $approvedAt = CarbonImmutable::parse(
            $approvedAtInput
        );

        $paymentIds = array_column(
            $validated['rows'],
            'payment_id'
        );

        $payments = DB::table(
            'pharmaco_payments'
        )
            ->where(
                'tenant_id',
                $tenantId
            )
            ->whereIn(
                'id',
                $paymentIds
            )
            ->get()
            ->keyBy('id');

        $existingPolicies =
            FinancePaymentPostingPolicy::query()
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->where(
                    'source_type',
                    'payment'
                )
                ->whereIn(
                    'source_id',
                    $paymentIds
                )
                ->get()
                ->keyBy('source_id');

        $wouldCreate = [];
        $existing = 0;
        $conflicts = [];

        foreach (
            $validated['rows']
            as $row
        ) {
            $paymentId = $row['payment_id'];

            $payment = $payments->get(
                $paymentId
            );

            if ($payment === null) {
                throw new RuntimeException(
                    "Payment {$paymentId} is missing."
                );
            }

            $status = strtolower(
                trim(
                    (string) $payment->status
                )
            );

            if ($status !== 'completed') {
                throw new RuntimeException(
                    "Payment {$paymentId} is not completed."
                );
            }

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

            if (
                $businessDate
                !== $row['business_date']
            ) {
                throw new RuntimeException(
                    "Payment {$paymentId} Business Date changed."
                );
            }

            if (
                $amount
                !== $row['payment_amount']
            ) {
                throw new RuntimeException(
                    "Payment {$paymentId} amount changed."
                );
            }

            if (
                $this->paymentHasFinanceLink(
                    $tenantId,
                    $paymentId
                )
            ) {
                throw new RuntimeException(
                    "Payment {$paymentId} now has a Finance journal."
                );
            }

            $sourceStateHash = hash(
                'sha256',
                json_encode(
                    [
                        'tenant_id' =>
                            $tenantId,

                        'payment_id' =>
                            $paymentId,

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

            $attributes = [
                'tenant_id' =>
                    $tenantId,

                'policy_code' =>
                    $policyCode,

                'source_type' =>
                    'payment',

                'source_id' =>
                    $paymentId,

                'policy_action' =>
                    FinancePaymentPostingPolicyService::ACTION_DO_NOT_BACKFILL,

                'status' =>
                    FinancePaymentPostingPolicyService::STATUS_ACTIVE,

                'effective_date' =>
                    $effectiveDate,

                'source_amount' =>
                    $amount,

                'source_business_date' =>
                    $businessDate,

                'source_state_hash' =>
                    $sourceStateHash,

                'reason' =>
                    'Owner-approved pre-cutover payment no-backfill policy.',

                'evidence_reference' =>
                    $evidenceReference,

                'evidence_hash' =>
                    $evidenceHash,

                'approved_by_user_id' =>
                    $approvedBy,

                'approved_at' =>
                    $approvedAt,

                'metadata' => [
                    'approved_csv_sha256' =>
                        $validated['csv_sha256'],

                    'approved_payment_ids_sha256' =>
                        $validated['ids_sha256'],

                    'approved_payment_count' =>
                        $validated['count'],

                    'approved_payment_total' =>
                        $validated['total'],

                    'payment_10_policy' =>
                        'DEFER_PENDING_EVIDENCE',
                ],
            ];

            $existingPolicy =
                $existingPolicies->get(
                    $paymentId
                );

            if ($existingPolicy === null) {
                $wouldCreate[] = $attributes;

                continue;
            }

            $matches =
                $existingPolicy->policy_code
                    === $policyCode
                && $existingPolicy->policy_action
                    === FinancePaymentPostingPolicyService::ACTION_DO_NOT_BACKFILL
                && $existingPolicy->status
                    === FinancePaymentPostingPolicyService::STATUS_ACTIVE
                && $existingPolicy->effective_date
                    ->format('Y-m-d')
                    === $effectiveDate
                && (string) $existingPolicy->source_amount
                    === $amount
                && $existingPolicy->source_business_date
                    ->format('Y-m-d')
                    === $businessDate
                && $existingPolicy->source_state_hash
                    === $sourceStateHash
                && $existingPolicy->evidence_hash
                    === $evidenceHash;

            if ($matches) {
                $existing++;

                continue;
            }

            $conflicts[] = $paymentId;
        }

        $this->line(
            'mode='
            . (
                $apply
                    ? 'APPLY'
                    : 'DRY_RUN'
            )
        );

        $this->line(
            'validated_count='
            . $validated['count']
        );

        $this->line(
            'validated_total='
            . $validated['total']
        );

        $this->line(
            'validated_ids_sha256='
            . $validated['ids_sha256']
        );

        $this->line(
            'validated_csv_sha256='
            . $validated['csv_sha256']
        );

        $this->line(
            'would_create='
            . count($wouldCreate)
        );

        $this->line(
            'existing='
            . $existing
        );

        $this->line(
            'conflicts='
            . count($conflicts)
        );

        if ($conflicts !== []) {
            throw new RuntimeException(
                'Policy conflicts exist for payment IDs: '
                . implode(',', $conflicts)
            );
        }

        if (! $apply) {
            $this->line(
                'finance_payment_policy_import_status=DRY_RUN_COMPLETE_NO_WRITES'
            );

            return self::SUCCESS;
        }

        DB::transaction(
            static function () use (
                $wouldCreate
            ): void {
                foreach (
                    $wouldCreate
                    as $attributes
                ) {
                    FinancePaymentPostingPolicy::query()
                        ->create($attributes);
                }
            }
        );

        $finalCount =
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
                ->count();

        if ($finalCount !== $expectedCount) {
            throw new RuntimeException(
                "Final policy count is {$finalCount}; expected {$expectedCount}."
            );
        }

        $this->line(
            'created='
            . count($wouldCreate)
        );

        $this->line(
            'final_active_policy_count='
            . $finalCount
        );

        $this->line(
            'finance_payment_policy_import_status=APPLY_COMPLETE_IDEMPOTENT'
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
