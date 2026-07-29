<?php

namespace App\Services\Finance;

use App\Data\Finance\FinanceJournalLinePayload;
use App\Data\Finance\FinancePostingPayload;
use App\Models\FinanceAccountMapping;
use App\Models\FinanceApprovalRequest;
use App\Models\FinanceChartOfAccount;
use App\Models\FinanceJournalDraft;
use App\Models\FinanceJournalDraftLine;
use App\Models\FinanceJournalEntry;
use App\Models\FinancePostingLog;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class FinanceJournalWorkflowService
{
    public function __construct(
        private readonly FinancePostingService $postingService,
        private readonly FinancePeriodGuard $periodGuard,
        private readonly FinanceAccountResolver $accountResolver,
        private readonly FinanceApprovalWorkflowService $approvalWorkflow,
    ) {
    }

    public function create(
        int $tenantId,
        ?int $branchId,
        array $data,
        int $actorId,
    ): FinanceJournalDraft {
        return DB::transaction(function () use (
            $tenantId,
            $branchId,
            $data,
            $actorId,
        ): FinanceJournalDraft {
            $lines = $this->validatedLines(
                $tenantId,
                $branchId,
                $data['currency_code'] ?? 'RWF',
                $data['lines'] ?? [],
            );

            $attributes = $this->supportedDraftAttributes([
                'uuid' => (string) Str::uuid(),
                'tenant_id' => $tenantId,
                'branch_id' => $branchId,
                'business_date' => $data['business_date'],
                'reference' => trim((string) $data['reference']),
                'description' => trim((string) $data['description']),
                'currency_code' => $data['currency_code'] ?? 'RWF',
                'status' => 'draft',
                'version' => 1,
                'created_by' => $actorId,
                'metadata' => [
                    'workflow' => 'general_journal',
                    'created_by' => $actorId,
                ],
            ]);

            $draft = FinanceJournalDraft::query()->create($attributes);
            $this->replaceLines($draft, $lines);

            return $this->freshDraft($draft);
        });
    }

    public function update(
        FinanceJournalDraft $draft,
        array $data,
        int $actorId,
    ): FinanceJournalDraft {
        return DB::transaction(function () use (
            $draft,
            $data,
            $actorId,
        ): FinanceJournalDraft {
            $locked = FinanceJournalDraft::query()
                ->lockForUpdate()
                ->findOrFail($draft->getKey());

            if (! in_array($locked->status, ['draft', 'rejected'], true)) {
                throw ValidationException::withMessages([
                    'status' => [
                        'Only a draft or rejected journal may be edited.',
                    ],
                ]);
            }

            $currency = $data['currency_code'] ?? 'RWF';

            $lines = $this->validatedLines(
                (int) $locked->tenant_id,
                $this->branchId($locked),
                $currency,
                $data['lines'] ?? [],
            );

            $metadata = $this->metadata($locked);
            $metadata['last_updated_by'] = $actorId;
            $metadata['last_updated_at'] = now()->toIso8601String();

            $locked->forceFill($this->supportedDraftAttributes([
                'business_date' => $data['business_date'],
                'reference' => trim((string) $data['reference']),
                'description' => trim((string) $data['description']),
                'currency_code' => $currency,
                'status' => 'draft',
                'version' => ((int) $locked->version) + 1,
                'metadata' => $metadata,
            ]))->save();

            $this->replaceLines($locked, $lines);

            return $this->freshDraft($locked);
        });
    }

    public function submit(
        FinanceJournalDraft $draft,
        int $actorId,
    ): FinanceJournalDraft {
        return DB::transaction(function () use (
            $draft,
            $actorId,
        ): FinanceJournalDraft {
            $locked = FinanceJournalDraft::query()
                ->lockForUpdate()
                ->findOrFail($draft->getKey());

            if (! in_array($locked->status, ['draft', 'rejected'], true)) {
                throw ValidationException::withMessages([
                    'status' => [
                        'Only a draft or rejected journal may be submitted.',
                    ],
                ]);
            }

            $this->assertStoredDraftIsValid($locked);
            $this->periodGuard->openPeriodFor(
                (int) $locked->tenant_id,
                $this->branchId($locked),
                $this->businessDate($locked),
            );

            $metadata = $this->metadata($locked);
            $metadata['submitted_by'] = $actorId;
            $metadata['submitted_at'] = now()->toIso8601String();

            $locked->forceFill($this->supportedDraftAttributes([
                'status' => 'submitted',
                'submitted_by' => $actorId,
                'submitted_at' => now(),
                'version' => ((int) $locked->version) + 1,
                'metadata' => $metadata,
            ]))->save();

            $this->approvalWorkflow->createRequest(
                $locked,
                (int) $locked->tenant_id,
                $this->branchId($locked),
                'general_journal',
                $actorId,
                [
                    'maker_ids' => array_values(array_filter([
                        (int) ($locked->created_by ?? 0),
                        $actorId,
                    ])),
                    'business_date' => $this->businessDate($locked),
                    'reference' => (string) $locked->reference,
                ],
            );

            return $this->freshDraft($locked);
        });
    }

    public function approve(
        FinanceJournalDraft $draft,
        int $actorId,
        ?string $comment = null,
    ): FinanceJournalDraft {
        return DB::transaction(function () use (
            $draft,
            $actorId,
            $comment,
        ): FinanceJournalDraft {
            $locked = FinanceJournalDraft::query()
                ->lockForUpdate()
                ->findOrFail($draft->getKey());

            if ($locked->status !== 'submitted') {
                throw ValidationException::withMessages([
                    'status' => [
                        'Only a submitted journal may be approved.',
                    ],
                ]);
            }

            $approval = $this->pendingApproval($locked);
            $this->approvalWorkflow->approve(
                $approval,
                $actorId,
                $comment,
            );

            $metadata = $this->metadata($locked);
            $metadata['approved_by'] = $actorId;
            $metadata['approved_at'] = now()->toIso8601String();
            $metadata['approval_comment'] = $comment;

            $locked->forceFill($this->supportedDraftAttributes([
                'status' => 'approved',
                'approved_by' => $actorId,
                'approved_at' => now(),
                'version' => ((int) $locked->version) + 1,
                'metadata' => $metadata,
            ]))->save();

            return $this->freshDraft($locked);
        });
    }

    public function reject(
        FinanceJournalDraft $draft,
        int $actorId,
        string $comment,
    ): FinanceJournalDraft {
        return DB::transaction(function () use (
            $draft,
            $actorId,
            $comment,
        ): FinanceJournalDraft {
            $locked = FinanceJournalDraft::query()
                ->lockForUpdate()
                ->findOrFail($draft->getKey());

            if ($locked->status !== 'submitted') {
                throw ValidationException::withMessages([
                    'status' => [
                        'Only a submitted journal may be rejected.',
                    ],
                ]);
            }

            $approval = $this->pendingApproval($locked);
            $this->approvalWorkflow->reject(
                $approval,
                $actorId,
                $comment,
            );

            $metadata = $this->metadata($locked);
            $metadata['rejected_by'] = $actorId;
            $metadata['rejected_at'] = now()->toIso8601String();
            $metadata['rejection_comment'] = trim($comment);

            $locked->forceFill($this->supportedDraftAttributes([
                'status' => 'rejected',
                'version' => ((int) $locked->version) + 1,
                'metadata' => $metadata,
            ]))->save();

            return $this->freshDraft($locked);
        });
    }

    public function post(
        FinanceJournalDraft $draft,
        int $actorId,
    ): FinanceJournalEntry {
        $draft->refresh();

        if ($draft->posted_journal_entry_id) {
            return FinanceJournalEntry::query()
                ->with('lines')
                ->findOrFail($draft->posted_journal_entry_id);
        }

        if ($draft->status !== 'approved') {
            throw ValidationException::withMessages([
                'status' => [
                    'Only an approved journal may be posted.',
                ],
            ]);
        }

        $this->assertStoredDraftIsValid($draft);

        $lines = $draft->lines()
            ->orderBy('line_number')
            ->get()
            ->map(function (FinanceJournalDraftLine $line) use ($draft): FinanceJournalLinePayload {
                $mappingKey = $this->mappingKeyForAccount(
                    (int) $draft->tenant_id,
                    $this->branchId($draft),
                    (int) $line->finance_chart_of_account_id,
                    (string) $draft->currency_code,
                );

                return new FinanceJournalLinePayload(
                    mappingKey: $mappingKey,
                    debit: (string) $line->debit_amount,
                    credit: (string) $line->credit_amount,
                    description: $line->description,
                    lineType: 'manual_journal',
                    branchId: $this->branchId($draft),
                    metadata: [
                        'journal_draft_uuid' => (string) $draft->uuid,
                        'journal_draft_line_id' => (int) $line->id,
                    ],
                );
            })
            ->all();

        $payload = new FinancePostingPayload(
            tenantId: (int) $draft->tenant_id,
            branchId: $this->branchId($draft),
            businessDate: $this->businessDate($draft),
            sourceModule: 'accounting',
            sourceType: 'manual_journal',
            sourceId: (string) $draft->uuid,
            idempotencyKey: 'accounting:manual-journal:' . $draft->uuid,
            lines: $lines,
            currencyCode: (string) $draft->currency_code,
            memo: (string) $draft->description,
            createdBy: $actorId,
            sourceSnapshot: [
                'draft_uuid' => (string) $draft->uuid,
                'reference' => (string) $draft->reference,
                'business_date' => $this->businessDate($draft),
            ],
            metadata: [
                'workflow' => 'general_journal',
                'approved_by' => (int) ($draft->approved_by ?? 0),
            ],
            mode: 'live',
        );

        $result = $this->postingService->post($payload);

        if ($result instanceof FinancePostingLog) {
            throw ValidationException::withMessages([
                'posting' => [
                    $result->failure_message
                        ?: 'The journal was quarantined instead of posted.',
                ],
            ]);
        }

        return DB::transaction(function () use (
            $draft,
            $actorId,
            $result,
        ): FinanceJournalEntry {
            $locked = FinanceJournalDraft::query()
                ->lockForUpdate()
                ->findOrFail($draft->getKey());

            if ($locked->posted_journal_entry_id) {
                return FinanceJournalEntry::query()
                    ->with('lines')
                    ->findOrFail($locked->posted_journal_entry_id);
            }

            $metadata = $this->metadata($locked);
            $metadata['posted_by'] = $actorId;
            $metadata['posted_at'] = now()->toIso8601String();
            $metadata['posted_journal_entry_id'] = (int) $result->id;

            $locked->forceFill($this->supportedDraftAttributes([
                'status' => 'posted',
                'posted_journal_entry_id' => (int) $result->id,
                'version' => ((int) $locked->version) + 1,
                'metadata' => $metadata,
            ]))->save();

            return $result;
        });
    }

    public function reverse(
        FinanceJournalDraft $draft,
        int $actorId,
        string $businessDate,
        string $reason,
    ): FinanceJournalEntry {
        $draft->refresh();

        if ($draft->reversal_journal_entry_id) {
            return FinanceJournalEntry::query()
                ->with('lines')
                ->findOrFail($draft->reversal_journal_entry_id);
        }

        if ($draft->status !== 'posted' || ! $draft->posted_journal_entry_id) {
            throw ValidationException::withMessages([
                'status' => [
                    'Only a posted journal may be reversed.',
                ],
            ]);
        }

        $this->assertActorIsNotMaker($draft, $actorId);

        $original = FinanceJournalEntry::query()
            ->with('lines')
            ->findOrFail($draft->posted_journal_entry_id);

        $lines = $original->lines
            ->map(function ($line) use ($original,
                $draft): FinanceJournalLinePayload {
                $mappingKey = $this->mappingKeyForAccount(
                    (int) $draft->tenant_id,
                    $this->branchId($draft),
                    (int) $line->chart_of_account_id,
                    (string) $draft->currency_code,
                );

                return new FinanceJournalLinePayload(
                    mappingKey: $mappingKey,
                    debit: (string) $line->credit,
                    credit: (string) $line->debit,
                    description: 'Reversal: ' . ($line->description ?: $draft->reference),
                    lineType: 'manual_journal_reversal',
                    branchId: $line->branch_id === null
                        ? $this->branchId($draft)
                        : (int) $line->branch_id,
                    metadata: [
                        'reverses_journal_entry_id' => (int) $original->id,
                        'original_journal_line_id' => (int) $line->id,
                    ],
                );
            })
            ->all();

        $payload = new FinancePostingPayload(
            tenantId: (int) $draft->tenant_id,
            branchId: $this->branchId($draft),
            businessDate: $businessDate,
            sourceModule: 'accounting',
            sourceType: 'manual_journal_reversal',
            sourceId: (string) $draft->uuid,
            idempotencyKey: 'accounting:manual-journal-reversal:' . $draft->uuid,
            lines: $lines,
            currencyCode: (string) $draft->currency_code,
            memo: 'Reversal of ' . $draft->reference . ': ' . trim($reason),
            createdBy: $actorId,
            sourceSnapshot: [
                'draft_uuid' => (string) $draft->uuid,
                'original_journal_entry_id' => (int) $original->id,
                'reason' => trim($reason),
            ],
            metadata: [
                'workflow' => 'general_journal_reversal',
                'reverses_journal_entry_id' => (int) $original->id,
            ],
            mode: 'live',
        );

        $result = $this->postingService->post($payload);

        if ($result instanceof FinancePostingLog) {
            throw ValidationException::withMessages([
                'reversal' => [
                    $result->failure_message
                        ?: 'The reversal was quarantined instead of posted.',
                ],
            ]);
        }

        return DB::transaction(function () use (
            $draft,
            $actorId,
            $reason,
            $result,
        ): FinanceJournalEntry {
            $locked = FinanceJournalDraft::query()
                ->lockForUpdate()
                ->findOrFail($draft->getKey());

            if ($locked->reversal_journal_entry_id) {
                return FinanceJournalEntry::query()
                    ->with('lines')
                    ->findOrFail($locked->reversal_journal_entry_id);
            }

            $metadata = $this->metadata($locked);
            $metadata['reversed_by'] = $actorId;
            $metadata['reversed_at'] = now()->toIso8601String();
            $metadata['reversal_reason'] = trim($reason);
            $metadata['reversal_journal_entry_id'] = (int) $result->id;

            $locked->forceFill($this->supportedDraftAttributes([
                'status' => 'reversed',
                'reversal_journal_entry_id' => (int) $result->id,
                'version' => ((int) $locked->version) + 1,
                'metadata' => $metadata,
            ]))->save();

            return $result;
        });
    }

    private function validatedLines(
        int $tenantId,
        ?int $branchId,
        string $currency,
        array $lines,
    ): array {
        if (count($lines) < 2) {
            throw ValidationException::withMessages([
                'lines' => ['A journal requires at least two lines.'],
            ]);
        }

        $debits = 0.0;
        $credits = 0.0;
        $validated = [];

        foreach (array_values($lines) as $index => $line) {
            $accountId = (int) ($line['finance_chart_of_account_id'] ?? 0);
            $debit = round((float) ($line['debit_amount'] ?? 0), 4);
            $credit = round((float) ($line['credit_amount'] ?? 0), 4);

            if ($debit < 0 || $credit < 0) {
                throw ValidationException::withMessages([
                    "lines.$index" => ['Journal amounts cannot be negative.'],
                ]);
            }

            if (($debit > 0 && $credit > 0) || ($debit === 0.0 && $credit === 0.0)) {
                throw ValidationException::withMessages([
                    "lines.$index" => [
                        'A journal line must contain debit or credit, but not both.',
                    ],
                ]);
            }

            $account = FinanceChartOfAccount::query()
                ->whereKey($accountId)
                ->where('tenant_id', $tenantId)
                ->where('is_active', true)
                ->first();

            if (! $account) {
                throw ValidationException::withMessages([
                    "lines.$index.finance_chart_of_account_id" => [
                        'The selected account is inactive or outside the verified tenant.',
                    ],
                ]);
            }

            $this->mappingKeyForAccount(
                $tenantId,
                $branchId,
                $accountId,
                $currency,
            );

            $debits += $debit;
            $credits += $credit;

            $validated[] = [
                'finance_chart_of_account_id' => $accountId,
                'description' => isset($line['description'])
                    ? trim((string) $line['description'])
                    : null,
                'debit_amount' => $debit,
                'credit_amount' => $credit,
                'metadata' => [
                    'validated_account_code' => (string) $account->code,
                ],
            ];
        }

        if (round($debits - $credits, 4) !== 0.0 || round($debits, 4) <= 0.0) {
            throw ValidationException::withMessages([
                'lines' => [
                    'Journal debit and credit totals must balance above zero.',
                ],
            ]);
        }

        return $validated;
    }

    private function assertStoredDraftIsValid(FinanceJournalDraft $draft): void
    {
        $data = $draft->lines()
            ->orderBy('line_number')
            ->get()
            ->map(static fn (FinanceJournalDraftLine $line): array => [
                'finance_chart_of_account_id' => (int) $line->finance_chart_of_account_id,
                'description' => $line->description,
                'debit_amount' => (float) $line->debit_amount,
                'credit_amount' => (float) $line->credit_amount,
            ])
            ->all();

        $this->validatedLines(
            (int) $draft->tenant_id,
            $this->branchId($draft),
            (string) $draft->currency_code,
            $data,
        );
    }

    private function replaceLines(
        FinanceJournalDraft $draft,
        array $lines,
    ): void {
        FinanceJournalDraftLine::query()
            ->where('journal_draft_id', $draft->getKey())
            ->delete();

        foreach (array_values($lines) as $index => $line) {
            FinanceJournalDraftLine::query()->create(array_merge(
                $line,
                [
                    'journal_draft_id' => (int) $draft->getKey(),
                    'line_number' => $index + 1,
                ],
            ));
        }
    }

    private function pendingApproval(
        FinanceJournalDraft $draft,
    ): FinanceApprovalRequest {
        $approval = FinanceApprovalRequest::query()
            ->where('tenant_id', $draft->tenant_id)
            ->where('workflow_type', 'general_journal')
            ->where('subject_type', $draft->getMorphClass())
            ->where('subject_id', $draft->getKey())
            ->where('status', 'pending')
            ->latest('id')
            ->first();

        if (! $approval) {
            throw ValidationException::withMessages([
                'approval' => ['A pending approval request was not found.'],
            ]);
        }

        return $approval;
    }

    private function mappingKeyForAccount(
        int $tenantId,
        ?int $branchId,
        int $accountId,
        string $currency,
    ): string {
        $query = FinanceAccountMapping::query()
            ->where('tenant_id', $tenantId)
            ->where('finance_chart_of_account_id', $accountId)
            ->where('currency_code', $currency)
            ->where('is_active', true);

        $query->where(function ($builder) use ($branchId): void {
            $builder->whereNull('branch_id');

            if ($branchId !== null) {
                $builder->orWhere('branch_id', $branchId);
            }
        });

        if ($branchId !== null) {
            $query->orderByRaw(
                'CASE WHEN branch_id = ? THEN 0 WHEN branch_id IS NULL THEN 1 ELSE 2 END',
                [$branchId],
            );
        } else {
            $query->whereNull('branch_id');
        }

        foreach ($query->get() as $mapping) {
            $resolved = $this->accountResolver->resolve(
                $tenantId,
                $branchId,
                (string) $mapping->mapping_key,
                $currency,
            );

            if ($resolved === $accountId) {
                return (string) $mapping->mapping_key;
            }
        }

        throw ValidationException::withMessages([
            'mapping' => [
                'No active Finance mapping resolves to the selected account.',
            ],
        ]);
    }

    private function assertActorIsNotMaker(
        FinanceJournalDraft $draft,
        int $actorId,
    ): void {
        $metadata = $this->metadata($draft);

        $makers = collect([
            $draft->created_by,
            $draft->submitted_by,
            $metadata['created_by'] ?? null,
            $metadata['submitted_by'] ?? null,
        ])
            ->map(static fn ($value): int => (int) $value)
            ->filter(static fn (int $value): bool => $value > 0)
            ->unique();

        if ($makers->contains($actorId)) {
            throw ValidationException::withMessages([
                'reversal' => [
                    'The journal preparer or submitter cannot authorise its reversal.',
                ],
            ]);
        }
    }

    private function supportedDraftAttributes(array $attributes): array
    {
        $columns = array_flip(
            Schema::getColumnListing('finance_journal_drafts'),
        );

        return array_intersect_key($attributes, $columns);
    }

    private function metadata(FinanceJournalDraft $draft): array
    {
        return is_array($draft->metadata)
            ? $draft->metadata
            : [];
    }

    private function branchId(FinanceJournalDraft $draft): ?int
    {
        return $draft->branch_id === null
            ? null
            : (int) $draft->branch_id;
    }

    private function businessDate(FinanceJournalDraft $draft): string
    {
        $value = $draft->business_date;

        if ($value instanceof \DateTimeInterface) {
            return $value->format('Y-m-d');
        }

        return substr((string) $value, 0, 10);
    }

    private function freshDraft(FinanceJournalDraft $draft): FinanceJournalDraft
    {
        return $draft->fresh(['lines.account']);
    }
}
