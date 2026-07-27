<?php

namespace App\Console\Commands;

use App\Models\FinanceJournalEntry;
use App\Models\FinancePostingLog;
use App\Exceptions\Finance\FinancePaymentPostingBlockedException;
use App\Models\PharmacoPayment;
use App\Services\Finance\FinancePaymentPostingPolicyService;
use App\Services\Finance\PharmacoPosPaymentShadowPostingService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Throwable;

class FinancePosShadowBackfill extends Command
{
    protected $signature = 'finance:pos-shadow-backfill
        {--tenant_id= : Tenant ID to backfill}
        {--from= : Business date from, YYYY-MM-DD}
        {--to= : Business date to, YYYY-MM-DD}
        {--branch_id= : Optional branch ID}
        {--payment_id=* : Optional specific payment ID(s)}
        {--execute : Actually create shadow postings}
        {--limit=500 : Maximum payments to scan in one run}';

    protected $description = 'Backfill missing Finance shadow postings for completed POS payments. Dry-run by default.';

    public function handle(
        PharmacoPosPaymentShadowPostingService $postingService,
        FinancePaymentPostingPolicyService $policyService
    ): int {
        if (! $this->requiredTablesExist()) {
            $this->error('Required POS or Finance tables do not exist.');

            return self::FAILURE;
        }

        if (
            ! Schema::hasTable(
                'finance_payment_posting_policies'
            )
            || ! Schema::hasTable(
                'finance_payment_posting_policy_attempts'
            )
        ) {
            $this->error(
                'Durable Finance payment-policy tables do not exist.'
            );

            return self::FAILURE;
        }

        /*
         * UBUZIMA_FINANCE_BACKFILL_POLICY_GUARD_V3D2B
         *
         * Dry-run classification is read-only. Execute mode records a
         * durable blocked/deferred attempt before any Finance posting.
         */

        $execute = (bool) $this->option('execute');
        $limit = max(1, min((int) $this->option('limit'), 5000));

        $query = $this->missingPaymentQuery()
            ->with('sale')
            ->orderBy('id')
            ->limit($limit);

        $payments = $query->get();

        $this->line('Finance POS Shadow Backfill');
        $this->line('Mode: ' . ($execute ? 'execute' : 'dry-run'));
        $this->line('Tenant ID: ' . ($this->option('tenant_id') ?: 'all'));
        $this->line('Business Date From: ' . ($this->option('from') ?: 'beginning'));
        $this->line('Business Date To: ' . ($this->option('to') ?: 'end'));
        $this->line('Branch ID: ' . ($this->option('branch_id') ?: 'all'));
        $this->line('Limit: ' . $limit);
        $this->line('Missing payments found: ' . $payments->count());

        $posted = 0;
        $skipped = 0;
        $policyBlocked = 0;
        $policyDeferred = 0;
        $quarantined = 0;
        $failed = 0;

        foreach ($payments as $payment) {
            if (! $payment->sale) {
                $skipped++;
                $this->warn("Skipped payment {$payment->id}: missing sale.");
                continue;
            }

            if (! $execute) {
                $policyDecision =
                    $policyService->decisionFor(
                        (int) $payment->tenant_id,
                        'payment',
                        (int) $payment->id
                    );

                if (
                    $policyDecision['decision']
                    === FinancePaymentPostingPolicyService::DECISION_BLOCK
                ) {
                    $policyBlocked++;

                    $this->warn(
                        "POLICY-BLOCKED payment {$payment->id}: owner-approved no-backfill policy."
                    );

                    continue;
                }

                if (
                    $policyDecision['decision']
                    === FinancePaymentPostingPolicyService::DECISION_DEFER
                ) {
                    $policyDeferred++;

                    $this->warn(
                        "POLICY-DEFERRED payment {$payment->id}: human evidence review required."
                    );

                    continue;
                }

                $this->line(sprintf(
                    'DRY-RUN payment=%s date=%s method=%s amount=%s sale=%s',
                    $payment->id,
                    $this->businessDateForDisplay($payment),
                    $payment->payment_method,
                    $payment->amount,
                    $payment->pharmaco_sale_id
                ));

                $skipped++;
                continue;
            }

            try {
                $policyService->assertBackfillAllowed(
                    (int) $payment->tenant_id,
                    'payment',
                    (int) $payment->id,
                    'finance:pos-shadow-backfill',
                    null,
                    null,
                    [
                        'execute' => true,
                        'tenant_filter' =>
                            $this->option('tenant_id'),
                        'branch_filter' =>
                            $this->option('branch_id'),
                        'from' =>
                            $this->option('from'),
                        'to' =>
                            $this->option('to'),
                    ]
                );

                $result = $postingService->postPayment(
                    $payment,
                    $payment->sale
                );

                if ($result instanceof FinanceJournalEntry) {
                    $posted++;
                    $this->info("Posted payment {$payment->id} as journal {$result->journal_number}.");
                    continue;
                }

                if ($result instanceof FinancePostingLog) {
                    if ($result->status === 'quarantined') {
                        $quarantined++;
                        $this->warn("Quarantined payment {$payment->id}: {$result->failure_message}");
                    } else {
                        $skipped++;
                        $this->line("Skipped payment {$payment->id}: posting log status {$result->status}.");
                    }

                    continue;
                }

                $failed++;
                $this->error("Failed payment {$payment->id}: unknown posting result.");
            } catch (
                FinancePaymentPostingBlockedException $exception
            ) {
                if (
                    $exception->decision
                    === FinancePaymentPostingPolicyService::DECISION_DEFER
                ) {
                    $policyDeferred++;

                    $this->warn(
                        "POLICY-DEFERRED payment {$payment->id}: {$exception->getMessage()}"
                    );
                } else {
                    $policyBlocked++;

                    $this->warn(
                        "POLICY-BLOCKED payment {$payment->id}: {$exception->getMessage()}"
                    );
                }

                continue;
            } catch (Throwable $exception) {
                $failed++;
                report($exception);
                $this->error("Failed payment {$payment->id}: {$exception->getMessage()}");
            }
        }

        $this->line('');
        $this->line('Backfill Summary');
        $this->line('Found: ' . $payments->count());
        $this->line('Posted: ' . $posted);
        $this->line('Skipped: ' . $skipped);
        $this->line(
            'Policy blocked: '
            . $policyBlocked
        );
        $this->line(
            'Policy deferred: '
            . $policyDeferred
        );
        $this->line('Quarantined: ' . $quarantined);
        $this->line('Failed: ' . $failed);

        if ($failed > 0 || $quarantined > 0) {
            return self::FAILURE;
        }

        return self::SUCCESS;
    }

    private function requiredTablesExist(): bool
    {
        foreach ([
            'pharmaco_payments',
            'pharmaco_sales',
            'finance_journal_entries',
            'finance_account_mappings',
        ] as $table) {
            if (! Schema::hasTable($table)) {
                return false;
            }
        }

        return true;
    }

    private function missingPaymentQuery()
    {
        $query = PharmacoPayment::query()
            ->join('pharmaco_sales as sales', 'sales.id', '=', 'pharmaco_payments.pharmaco_sale_id')
            ->select('pharmaco_payments.*')
            ->where('pharmaco_payments.status', 'completed')
            ->whereNotExists(function ($subquery) {
                $subquery->selectRaw('1')
                    ->from('finance_journal_entries as entries')
                    ->whereColumn('entries.tenant_id', 'pharmaco_payments.tenant_id')
                    ->where('entries.source_module', 'pos')
                    ->where('entries.source_type', 'payment')
                    ->where('entries.status', 'shadow_posted')
                    ->whereColumn('entries.source_id', DB::raw('CAST(pharmaco_payments.id AS CHAR)'));
            });

        if ($tenantId = $this->option('tenant_id')) {
            $query->where('pharmaco_payments.tenant_id', (int) $tenantId);
        }

        if ($branchId = $this->option('branch_id')) {
            $query->where('sales.branch_id', (int) $branchId);
        }

        if ($from = $this->option('from')) {
            $query->whereDate(DB::raw('COALESCE(pharmaco_payments.business_date, sales.business_date, DATE(pharmaco_payments.received_at))'), '>=', $from);
        }

        if ($to = $this->option('to')) {
            $query->whereDate(DB::raw('COALESCE(pharmaco_payments.business_date, sales.business_date, DATE(pharmaco_payments.received_at))'), '<=', $to);
        }

        $paymentIds = array_filter((array) $this->option('payment_id'));

        if ($paymentIds) {
            $query->whereIn('pharmaco_payments.id', array_map('intval', $paymentIds));
        }

        return $query;
    }

    private function businessDateForDisplay(PharmacoPayment $payment): string
    {
        return $payment->business_date?->toDateString()
            ?: $payment->sale?->business_date?->toDateString()
            ?: $payment->received_at?->toDateString()
            ?: 'unknown';
    }
}
