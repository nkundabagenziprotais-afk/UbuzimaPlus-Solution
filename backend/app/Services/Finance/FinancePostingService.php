<?php

namespace App\Services\Finance;

use App\Data\Finance\FinanceJournalLinePayload;
use App\Data\Finance\FinancePostingPayload;
use App\Models\FinanceJournalEntry;
use App\Models\FinancePostingLog;
use Illuminate\Support\Facades\DB;
use RuntimeException;
use Throwable;

class FinancePostingService
{
    public function __construct(
        private readonly FinanceAccountResolver $accountResolver,
        private readonly FinancePeriodGuard $periodGuard,
    ) {
    }

    public function post(FinancePostingPayload $payload): FinanceJournalEntry|FinancePostingLog
    {
        return DB::transaction(function () use ($payload): FinanceJournalEntry|FinancePostingLog {
            $existing = FinanceJournalEntry::query()
                ->where('tenant_id', $payload->tenantId)
                ->where('idempotency_key', $payload->idempotencyKey)
                ->first();

            if ($existing) {
                return $existing->load('lines');
            }

            if (! $payload->businessDate) {
                return $this->quarantine(
                    $payload,
                    'missing_business_date',
                    'Business Date is required for finance posting.',
                );
            }

            if (count($payload->lines) < 2) {
                return $this->quarantine(
                    $payload,
                    'insufficient_lines',
                    'A journal entry requires at least two lines.',
                );
            }

            try {
                $period = $this->periodGuard->openPeriodFor(
                    $payload->tenantId,
                    $payload->branchId,
                    $payload->businessDate,
                );

                $resolvedLines = [];
                $totalDebit = 0.0;
                $totalCredit = 0.0;

                foreach ($payload->lines as $line) {
                    if (! $line instanceof FinanceJournalLinePayload) {
                        throw new RuntimeException('Invalid journal line payload.');
                    }

                    $accountId = $this->accountResolver->resolve(
                        $payload->tenantId,
                        $line->branchId ?? $payload->branchId,
                        $line->mappingKey,
                        $payload->currencyCode,
                    );

                    $debit = round((float) $line->debit, 4);
                    $credit = round((float) $line->credit, 4);

                    if ($debit < 0 || $credit < 0 || ($debit > 0 && $credit > 0)) {
                        throw new RuntimeException(
                            'Each journal line must have either debit or credit, not both.',
                        );
                    }

                    if ($debit === 0.0 && $credit === 0.0) {
                        throw new RuntimeException(
                            'Journal lines cannot have zero debit and zero credit.',
                        );
                    }

                    $totalDebit += $debit;
                    $totalCredit += $credit;

                    $resolvedLines[] = [$line, $accountId, $debit, $credit];
                }

                if (round($totalDebit - $totalCredit, 4) !== 0.0) {
                    throw new RuntimeException(
                        'Unbalanced finance posting: debits must equal credits.',
                    );
                }

                $entry = FinanceJournalEntry::query()->create([
                    'tenant_id' => $payload->tenantId,
                    'branch_id' => $payload->branchId,
                    'accounting_period_id' => $period?->id,
                    'journal_number' => $this->journalNumber($payload),
                    'business_date' => $payload->businessDate,
                    'source_module' => $payload->sourceModule,
                    'source_type' => $payload->sourceType,
                    'source_id' => $payload->sourceId,
                    'idempotency_key' => $payload->idempotencyKey,
                    'status' => $payload->mode === 'shadow' ? 'shadow_posted' : 'posted',
                    'currency_code' => $payload->currencyCode,
                    'exchange_rate' => $payload->exchangeRate,
                    'total_debit' => $totalDebit,
                    'total_credit' => $totalCredit,
                    'memo' => $payload->memo,
                    'created_by' => $payload->createdBy,
                    'source_snapshot' => $payload->sourceSnapshot,
                    'metadata' => $payload->metadata,
                ]);

                foreach ($resolvedLines as [$line, $accountId, $debit, $credit]) {
                    $entry->lines()->create([
                        'tenant_id' => $payload->tenantId,
                        'chart_of_account_id' => $accountId,
                        'branch_id' => $line->branchId ?? $payload->branchId,
                        'department_id' => $line->departmentId,
                        'customer_id' => $line->customerId,
                        'supplier_id' => $line->supplierId,
                        'product_id' => $line->productId,
                        'stock_location_id' => $line->stockLocationId,
                        'insurance_partner_id' => $line->insurancePartnerId,
                        'payment_method' => $line->paymentMethod,
                        'line_type' => $line->lineType,
                        'debit' => $debit,
                        'credit' => $credit,
                        'description' => $line->description,
                        'metadata' => $line->metadata,
                    ]);
                }

                $this->markPosted($payload, $entry);

                return $entry->load('lines');
            } catch (Throwable $exception) {
                return $this->quarantine(
                    $payload,
                    'posting_validation_failed',
                    $exception->getMessage(),
                );
            }
        });
    }

    private function markPosted(
        FinancePostingPayload $payload,
        FinanceJournalEntry $entry,
    ): FinancePostingLog {
        $log = FinancePostingLog::query()->firstOrNew([
            'tenant_id' => $payload->tenantId,
            'idempotency_key' => $payload->idempotencyKey,
        ]);

        $log->fill([
            'branch_id' => $payload->branchId,
            'journal_entry_id' => $entry->id,
            'source_module' => $payload->sourceModule,
            'source_type' => $payload->sourceType,
            'source_id' => $payload->sourceId,
            'business_date' => $payload->businessDate,
            'status' => 'posted',
            'mode' => $payload->mode,
            'failure_code' => null,
            'failure_message' => null,
            'posted_at' => now(),
            'source_snapshot' => $payload->sourceSnapshot,
            'metadata' => $payload->metadata,
        ]);

        $log->attempt_count = ((int) $log->attempt_count) + 1;
        $log->save();

        return $log;
    }

    private function quarantine(
        FinancePostingPayload $payload,
        string $code,
        string $message,
    ): FinancePostingLog {
        $log = FinancePostingLog::query()->firstOrNew([
            'tenant_id' => $payload->tenantId,
            'idempotency_key' => $payload->idempotencyKey,
        ]);

        $log->fill([
            'branch_id' => $payload->branchId,
            'source_module' => $payload->sourceModule,
            'source_type' => $payload->sourceType,
            'source_id' => $payload->sourceId,
            'business_date' => $payload->businessDate,
            'status' => 'quarantined',
            'mode' => $payload->mode,
            'failure_code' => $code,
            'failure_message' => $message,
            'quarantined_at' => now(),
            'source_snapshot' => $payload->sourceSnapshot,
            'metadata' => $payload->metadata,
        ]);

        $log->attempt_count = ((int) $log->attempt_count) + 1;
        $log->save();

        return $log;
    }

    private function journalNumber(FinancePostingPayload $payload): string
    {
        return 'JE-' . now()->format('YmdHis') . '-' . substr(sha1($payload->idempotencyKey), 0, 8);
    }
}
