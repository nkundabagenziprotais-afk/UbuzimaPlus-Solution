#!/usr/bin/env bash

set -u
set -o pipefail
export LC_ALL=C
export GIT_PAGER=cat
export PAGER=cat

WORKTREE="/home/inzoeqqx/development_worktrees/accounting-journal-approval-foundation-20260729"
PRODUCTION_REPO="/home/inzoeqqx/ubuzimaplus.com"
PRODUCTION_BACKEND="$PRODUCTION_REPO/backend"
PRODUCTION_DB="$PRODUCTION_BACKEND/database/database.sqlite"
PRODUCTION_AUTOLOAD="$PRODUCTION_BACKEND/vendor/autoload.php"
EXPECTED_HEAD="ff1ea5f4cd66ddc7db37c10485208df817c58e71"

MIGRATION_REL="backend/database/migrations/2026_07_29_120000_create_finance_journal_approval_workflow_tables.php"
ROUTE_REL="backend/routes/accounting.php"
ROUTE_FILE="$WORKTREE/$ROUTE_REL"
EXPECTED_ROUTE_SHA="0be6638fb9db315f9a7345e7c5f49b7f0e53880300efb7d6a6a9e1b442a47499"

APPROVAL_SERVICE_REL="backend/app/Services/Finance/FinanceApprovalWorkflowService.php"
JOURNAL_SERVICE_REL="backend/app/Services/Finance/FinanceJournalWorkflowService.php"
JOURNAL_CONTROLLER_REL="backend/app/Http/Controllers/Api/V1/PharmaCo360/AccountingJournalWorkflowController.php"
APPROVAL_CONTROLLER_REL="backend/app/Http/Controllers/Api/V1/PharmaCo360/AccountingApprovalCentreController.php"

NEW_FILES=(
    "$APPROVAL_SERVICE_REL"
    "$JOURNAL_SERVICE_REL"
    "$JOURNAL_CONTROLLER_REL"
    "$APPROVAL_CONTROLLER_REL"
)

RUN_ID="$(date -u '+%Y%m%dT%H%M%SZ')"
PHASE_DIR="/home/inzoeqqx/deployment_releases/accounting-foundation-live-20260728/phase-4d5d9a5-accounting-backend-$RUN_ID"
TMP_DIR="$PHASE_DIR/runtime"
ROUTE_BACKUP="$PHASE_DIR/accounting.php.before"
TEST_DB="$PHASE_DIR/accounting-workflow-test.sqlite"
RUNTIME_ENV="$TMP_DIR/environment"
RUNTIME_STORAGE="$TMP_DIR/storage"
RUNTIME_CACHE="$TMP_DIR/cache"
TEST_RUNNER="$TMP_DIR/run-workflow-tests.php"
TEST_OUTPUT="$PHASE_DIR/workflow-test-output.txt"
MANIFEST="$PHASE_DIR/source-manifest.sha256"
ARCHIVE="$PHASE_DIR/accounting-backend-source.tar.gz"
REPORT="$PHASE_DIR/phase-4d5d9a5-report.txt"
MARKER="$PHASE_DIR/PHASE-4D5D9A5-ACCOUNTING-BACKEND-VERIFIED"

PHP_BIN="$(command -v php)"
OWNED="NO"
COMPLETE="NO"

abort() {
    echo "reason=$1" >&2
    exit 1
}

cleanup() {
    result=$?
    trap - EXIT

    if [[ "$COMPLETE" != "YES" ]]; then
        if [[ "$OWNED" == "YES" ]]; then
            for relative in "${NEW_FILES[@]}"
            do
                rm -f "$WORKTREE/$relative"
            done

            if [[ -s "$ROUTE_BACKUP" ]]; then
                cp -p "$ROUTE_BACKUP" "$ROUTE_FILE"
            fi

            echo "current_milestone_source_rollback=COMPLETE"
            echo "previous_ten_file_checkpoint_retained=YES"
        fi
    fi

    rm -rf "$TMP_DIR"
    rm -f "$TEST_DB"

    echo "cPanel_session_child_cleanup=COMPLETE"
    exit "$result"
}

trap cleanup EXIT

echo "============================================================"
echo "PHASE 4D5D9A5 GENERAL JOURNALS AND APPROVAL CENTRE BACKEND"
echo "============================================================"

mkdir -p "$PHASE_DIR" || abort "phase_directory_creation_failed"
chmod 700 "$PHASE_DIR"

[[ -e "$WORKTREE/.git" ]] || abort "development_worktree_missing"
[[ -d "$PRODUCTION_REPO/.git" ]] || abort "production_repository_missing"
[[ -s "$PRODUCTION_DB" ]] || abort "production_database_missing"
[[ -s "$PRODUCTION_AUTOLOAD" ]] || abort "production_autoload_missing"
[[ -x "$PHP_BIN" ]] || abort "php_missing"

CURRENT_HEAD="$(git -C "$WORKTREE" rev-parse HEAD 2>/dev/null)"
[[ "$CURRENT_HEAD" == "$EXPECTED_HEAD" ]] || abort "unexpected_development_head:$CURRENT_HEAD"

git -C "$WORKTREE" diff --cached --quiet || abort "staged_changes_present"

CURRENT_ROUTE_SHA="$(sha256sum "$ROUTE_FILE" | awk '{print $1}')"
[[ "$CURRENT_ROUTE_SHA" == "$EXPECTED_ROUTE_SHA" ]] || abort "accounting_route_baseline_changed:$CURRENT_ROUTE_SHA"

for relative in "${NEW_FILES[@]}"
do
    [[ ! -e "$WORKTREE/$relative" ]] || abort "new_target_already_exists:$relative"
done

EXPECTED_EXISTING=(
    "backend/app/Http/Requests/Accounting/FinanceJournalReversalRequest.php"
    "backend/app/Http/Requests/Accounting/FinanceWorkflowDecisionRequest.php"
    "backend/app/Http/Requests/Accounting/StoreFinanceJournalDraftRequest.php"
    "backend/app/Http/Requests/Accounting/UpdateFinanceJournalDraftRequest.php"
    "backend/app/Models/FinanceApprovalAction.php"
    "backend/app/Models/FinanceApprovalRequest.php"
    "backend/app/Models/FinanceJournalDraft.php"
    "backend/app/Models/FinanceJournalDraftLine.php"
    "backend/app/Services/Accounting/AccountingRequestScope.php"
    "$MIGRATION_REL"
)

ACTUAL_UNTRACKED="$PHASE_DIR/untracked-before.txt"
EXPECTED_UNTRACKED="$PHASE_DIR/expected-before.txt"

printf '%s\n' "${EXPECTED_EXISTING[@]}" | sort > "$EXPECTED_UNTRACKED"
git -C "$WORKTREE" ls-files --others --exclude-standard | sort > "$ACTUAL_UNTRACKED"

cmp -s "$EXPECTED_UNTRACKED" "$ACTUAL_UNTRACKED" || {
    echo "--- expected checkpoint ---"
    cat "$EXPECTED_UNTRACKED"
    echo "--- actual checkpoint ---"
    cat "$ACTUAL_UNTRACKED"
    abort "ten_file_checkpoint_changed"
}

verify_hash() {
    relative="$1"
    expected="$2"
    actual="$(sha256sum "$WORKTREE/$relative" | awk '{print $1}')"
    [[ "$actual" == "$expected" ]] || abort "checkpoint_hash_changed:$relative:$actual"
}

verify_hash "backend/app/Models/FinanceApprovalAction.php" "ffb0096d33b8d685d1c8684f4ca772655758630fed9cca768f3cb0cd947dd064"
verify_hash "backend/app/Models/FinanceApprovalRequest.php" "1a48ca036b80bbf2860c300297024e0bbfb84f9f082dee843616d6755d1165b5"
verify_hash "backend/app/Models/FinanceJournalDraftLine.php" "212fdea050698e6dc03845179dc2039b5ae37fb7f726825b62bf8b17551d72a8"
verify_hash "backend/app/Models/FinanceJournalDraft.php" "76a75debfc140b3b23e402c4d7dfae7fe4ecdbed598e46b00a24072ea8610f16"
verify_hash "$MIGRATION_REL" "f956790339c83b5a9d83e27799c41c0b75fefa608b13b225bf5b7f8b9c86429b"
verify_hash "backend/app/Services/Accounting/AccountingRequestScope.php" "c082c42de1dfbdaf2d7efc079ce4874adddc5253b88e0ac4f149c6d0271be2d0"
verify_hash "backend/app/Http/Requests/Accounting/UpdateFinanceJournalDraftRequest.php" "1c5d5f34c284461c51a59c6f970f7e2fb71ec3a79c2403a75baad4e78cf14ad7"
verify_hash "backend/app/Http/Requests/Accounting/FinanceWorkflowDecisionRequest.php" "e888b5779db6d14baae91db687c9b73de7e54d6ac0546fefb1ea2ce3d3127edb"
verify_hash "backend/app/Http/Requests/Accounting/FinanceJournalReversalRequest.php" "4944c6d4b8c3800d6feb92c8e5985065ddf8529cdd605194265b25a862c6539d"
verify_hash "backend/app/Http/Requests/Accounting/StoreFinanceJournalDraftRequest.php" "2d08a56a926578700fd4c96bf019676d507a907cd884d850ca9cb7382146686e"

PRODUCTION_HEAD_BEFORE="$(git -C "$PRODUCTION_REPO" rev-parse HEAD)"
PRODUCTION_STATUS_BEFORE="$(git -C "$PRODUCTION_REPO" status --porcelain=v1 --untracked-files=all)"
PRODUCTION_SCHEMA_BEFORE="$(
    SOURCE_DB="$PRODUCTION_DB" "$PHP_BIN" -r '
        $db = new SQLite3(getenv("SOURCE_DB"), SQLITE3_OPEN_READONLY);
        $rows = [];
        $result = $db->query(
            "SELECT type, name, tbl_name, sql
             FROM sqlite_master
             WHERE name NOT LIKE '\''sqlite_%'\''
             ORDER BY type, name"
        );
        while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
            $rows[] = $row;
        }
        echo hash("sha256", json_encode($rows, JSON_UNESCAPED_SLASHES));
    '
)"

cp -p "$ROUTE_FILE" "$ROUTE_BACKUP" || abort "route_backup_failed"
OWNED="YES"

mkdir -p \
    "$WORKTREE/backend/app/Services/Finance" \
    "$WORKTREE/backend/app/Http/Controllers/Api/V1/PharmaCo360" || abort "source_directory_creation_failed"

echo "checkpoint=VERIFIED"
echo "implementation=STARTED"

cat > "$WORKTREE/$APPROVAL_SERVICE_REL" <<'PHP'
<?php

namespace App\Services\Finance;

use App\Models\FinanceApprovalAction;
use App\Models\FinanceApprovalRequest;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class FinanceApprovalWorkflowService
{
    public function createRequest(
        Model $subject,
        int $tenantId,
        ?int $branchId,
        string $workflowType,
        int $requestedBy,
        array $metadata = [],
    ): FinanceApprovalRequest {
        return DB::transaction(function () use (
            $subject,
            $tenantId,
            $branchId,
            $workflowType,
            $requestedBy,
            $metadata,
        ): FinanceApprovalRequest {
            $this->assertSubjectScope(
                $subject,
                $tenantId,
                $branchId,
            );

            $subjectId = (int) $subject->getKey();

            if ($subjectId <= 0) {
                throw ValidationException::withMessages([
                    'subject' => [
                        'The approval subject must be saved before submission.',
                    ],
                ]);
            }

            $subjectType = $subject->getMorphClass();

            $existing = FinanceApprovalRequest::query()
                ->where('tenant_id', $tenantId)
                ->where('workflow_type', $workflowType)
                ->where('subject_type', $subjectType)
                ->where('subject_id', $subjectId)
                ->where('status', 'pending')
                ->lockForUpdate()
                ->first();

            if ($existing) {
                return $existing->load('actions');
            }

            $makerIds = collect([
                $requestedBy,
                $subject->getAttribute('created_by'),
                $subject->getAttribute('submitted_by'),
            ])
                ->merge(
                    is_array($metadata['maker_ids'] ?? null)
                        ? $metadata['maker_ids']
                        : []
                )
                ->map(static fn ($value): int => (int) $value)
                ->filter(static fn (int $value): bool => $value > 0)
                ->unique()
                ->values()
                ->all();

            $request = FinanceApprovalRequest::query()->create([
                'uuid' => (string) Str::uuid(),
                'tenant_id' => $tenantId,
                'branch_id' => $branchId,
                'workflow_type' => $workflowType,
                'subject_type' => $subjectType,
                'subject_id' => $subjectId,
                'subject_uuid' => $this->subjectUuid($subject),
                'status' => 'pending',
                'requested_by' => $requestedBy,
                'requested_at' => now(),
                'version' => 1,
                'metadata' => array_merge(
                    $metadata,
                    ['maker_ids' => $makerIds],
                ),
            ]);

            $this->appendAction(
                $request,
                'submitted',
                $requestedBy,
                null,
                'pending',
                null,
                ['workflow_type' => $workflowType],
            );

            return $request->fresh(['actions']);
        });
    }

    public function approve(
        FinanceApprovalRequest $approval,
        int $actorId,
        ?string $comment = null,
    ): FinanceApprovalRequest {
        return $this->decide(
            $approval,
            $actorId,
            'approved',
            $comment,
        );
    }

    public function reject(
        FinanceApprovalRequest $approval,
        int $actorId,
        string $comment,
    ): FinanceApprovalRequest {
        $comment = trim($comment);

        if ($comment === '') {
            throw ValidationException::withMessages([
                'comment' => ['A rejection comment is required.'],
            ]);
        }

        return $this->decide(
            $approval,
            $actorId,
            'rejected',
            $comment,
        );
    }

    private function decide(
        FinanceApprovalRequest $approval,
        int $actorId,
        string $decision,
        ?string $comment,
    ): FinanceApprovalRequest {
        return DB::transaction(function () use (
            $approval,
            $actorId,
            $decision,
            $comment,
        ): FinanceApprovalRequest {
            $locked = FinanceApprovalRequest::query()
                ->lockForUpdate()
                ->findOrFail($approval->getKey());

            if ($locked->status !== 'pending') {
                throw ValidationException::withMessages([
                    'status' => [
                        'Only a pending approval request may be decided.',
                    ],
                ]);
            }

            $this->assertChecker($locked, $actorId);

            $previousStatus = (string) $locked->status;

            $locked->forceFill([
                'status' => $decision,
                'decided_by' => $actorId,
                'decided_at' => now(),
                'decision_comment' => $this->normaliseComment($comment),
                'version' => ((int) $locked->version) + 1,
            ])->save();

            $this->appendAction(
                $locked,
                $decision,
                $actorId,
                $previousStatus,
                $decision,
                $comment,
            );

            return $locked->fresh(['actions']);
        });
    }

    private function appendAction(
        FinanceApprovalRequest $approval,
        string $action,
        ?int $actorId,
        ?string $previousStatus,
        string $newStatus,
        ?string $comment = null,
        array $metadata = [],
    ): FinanceApprovalAction {
        return FinanceApprovalAction::query()->create([
            'uuid' => (string) Str::uuid(),
            'approval_request_id' => (int) $approval->getKey(),
            'tenant_id' => (int) $approval->tenant_id,
            'actor_id' => $actorId,
            'action' => $action,
            'previous_status' => $previousStatus,
            'new_status' => $newStatus,
            'comment' => $this->normaliseComment($comment),
            'metadata' => $metadata,
            'acted_at' => now(),
        ]);
    }

    private function assertSubjectScope(
        Model $subject,
        int $tenantId,
        ?int $branchId,
    ): void {
        if ((int) $subject->getAttribute('tenant_id') !== $tenantId) {
            throw ValidationException::withMessages([
                'tenant' => [
                    'The approval subject is outside the verified tenant.',
                ],
            ]);
        }

        $subjectBranch = $subject->getAttribute('branch_id');
        $subjectBranchId = $subjectBranch === null
            ? null
            : (int) $subjectBranch;

        if ($subjectBranchId !== $branchId) {
            throw ValidationException::withMessages([
                'branch' => [
                    'The approval subject is outside the verified branch scope.',
                ],
            ]);
        }
    }

    private function assertChecker(
        FinanceApprovalRequest $approval,
        int $actorId,
    ): void {
        if ($actorId <= 0) {
            throw ValidationException::withMessages([
                'actor' => ['A valid decision-maker is required.'],
            ]);
        }

        $metadata = is_array($approval->metadata)
            ? $approval->metadata
            : [];

        $makerIds = collect($metadata['maker_ids'] ?? [])
            ->push((int) $approval->requested_by)
            ->map(static fn ($value): int => (int) $value)
            ->filter(static fn (int $value): bool => $value > 0)
            ->unique();

        if ($makerIds->contains($actorId)) {
            throw ValidationException::withMessages([
                'approval' => [
                    'The preparer or submitter cannot decide this request.',
                ],
            ]);
        }
    }

    private function subjectUuid(Model $subject): ?string
    {
        $uuid = $subject->getAttribute('uuid');

        if (! is_string($uuid)) {
            return null;
        }

        $uuid = trim($uuid);

        return $uuid === '' ? null : $uuid;
    }

    private function normaliseComment(?string $comment): ?string
    {
        if ($comment === null) {
            return null;
        }

        $comment = trim($comment);

        return $comment === '' ? null : $comment;
    }
}
PHP

cat > "$WORKTREE/$JOURNAL_SERVICE_REL" <<'PHP'
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
            ->map(function ($line) use ($draft): FinanceJournalLinePayload {
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
PHP

cat > "$WORKTREE/$JOURNAL_CONTROLLER_REL" <<'PHP'
<?php

namespace App\Http\Controllers\Api\V1\PharmaCo360;

use App\Http\Controllers\Controller;
use App\Http\Requests\Accounting\FinanceJournalReversalRequest;
use App\Http\Requests\Accounting\FinanceWorkflowDecisionRequest;
use App\Http\Requests\Accounting\StoreFinanceJournalDraftRequest;
use App\Http\Requests\Accounting\UpdateFinanceJournalDraftRequest;
use App\Models\FinanceApprovalRequest;
use App\Models\FinanceJournalDraft;
use App\Services\Accounting\AccountingRequestScope;
use App\Services\Finance\FinanceJournalWorkflowService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AccountingJournalWorkflowController extends Controller
{
    public function __construct(
        private readonly AccountingRequestScope $requestScope,
        private readonly FinanceJournalWorkflowService $workflow,
    ) {
    }

    public function index(Request $request): JsonResponse
    {
        $scope = $this->requestScope->resolve($request);

        $drafts = FinanceJournalDraft::query()
            ->where('tenant_id', $scope['tenant_id'])
            ->when(
                $scope['branch_id'] !== null,
                static fn ($query) => $query->where(
                    'branch_id',
                    $scope['branch_id'],
                ),
            )
            ->with(['lines.account'])
            ->latest('id')
            ->limit(200)
            ->get();

        return response()->json([
            'scope' => $scope,
            'drafts' => $drafts,
        ]);
    }

    public function show(
        Request $request,
        string $draftUuid,
    ): JsonResponse {
        $scope = $this->requestScope->resolve($request);
        $draft = $this->scopedDraft($scope, $draftUuid);

        return response()->json([
            'draft' => $draft->load(['lines.account']),
            'approvals' => $this->approvals($draft),
        ]);
    }

    public function store(
        StoreFinanceJournalDraftRequest $request,
    ): JsonResponse {
        $scope = $this->requestScope->resolve($request);

        $draft = $this->workflow->create(
            $scope['tenant_id'],
            $scope['branch_id'],
            $request->validated(),
            $scope['user_id'],
        );

        return response()->json([
            'message' => 'Journal draft created.',
            'draft' => $draft,
        ], 201);
    }

    public function update(
        UpdateFinanceJournalDraftRequest $request,
        string $draftUuid,
    ): JsonResponse {
        $scope = $this->requestScope->resolve($request);
        $draft = $this->scopedDraft($scope, $draftUuid);

        $updated = $this->workflow->update(
            $draft,
            $request->validated(),
            $scope['user_id'],
        );

        return response()->json([
            'message' => 'Journal draft updated.',
            'draft' => $updated,
        ]);
    }

    public function submit(
        Request $request,
        string $draftUuid,
    ): JsonResponse {
        $scope = $this->requestScope->resolve($request);
        $draft = $this->scopedDraft($scope, $draftUuid);

        $submitted = $this->workflow->submit(
            $draft,
            $scope['user_id'],
        );

        return response()->json([
            'message' => 'Journal submitted for approval.',
            'draft' => $submitted,
            'approvals' => $this->approvals($submitted),
        ]);
    }

    public function approve(
        FinanceWorkflowDecisionRequest $request,
        string $draftUuid,
    ): JsonResponse {
        $scope = $this->requestScope->resolve($request);
        $draft = $this->scopedDraft($scope, $draftUuid);

        $approved = $this->workflow->approve(
            $draft,
            $scope['user_id'],
            $request->validated('comment'),
        );

        return response()->json([
            'message' => 'Journal approved.',
            'draft' => $approved,
            'approvals' => $this->approvals($approved),
        ]);
    }

    public function reject(
        FinanceWorkflowDecisionRequest $request,
        string $draftUuid,
    ): JsonResponse {
        $scope = $this->requestScope->resolve($request);
        $draft = $this->scopedDraft($scope, $draftUuid);
        $comment = trim((string) $request->validated('comment'));

        $rejected = $this->workflow->reject(
            $draft,
            $scope['user_id'],
            $comment,
        );

        return response()->json([
            'message' => 'Journal rejected.',
            'draft' => $rejected,
            'approvals' => $this->approvals($rejected),
        ]);
    }

    public function post(
        Request $request,
        string $draftUuid,
    ): JsonResponse {
        $scope = $this->requestScope->resolve($request);
        $draft = $this->scopedDraft($scope, $draftUuid);

        $entry = $this->workflow->post(
            $draft,
            $scope['user_id'],
        );

        return response()->json([
            'message' => 'Journal posted.',
            'journal_entry' => $entry,
            'draft' => $draft->fresh(['lines.account']),
        ]);
    }

    public function reverse(
        FinanceJournalReversalRequest $request,
        string $draftUuid,
    ): JsonResponse {
        $scope = $this->requestScope->resolve($request);
        $draft = $this->scopedDraft($scope, $draftUuid);
        $validated = $request->validated();

        $entry = $this->workflow->reverse(
            $draft,
            $scope['user_id'],
            $validated['business_date'],
            $validated['reason'],
        );

        return response()->json([
            'message' => 'Balanced reversal journal posted.',
            'reversal_journal_entry' => $entry,
            'draft' => $draft->fresh(['lines.account']),
        ]);
    }

    private function scopedDraft(
        array $scope,
        string $uuid,
    ): FinanceJournalDraft {
        return FinanceJournalDraft::query()
            ->where('tenant_id', $scope['tenant_id'])
            ->when(
                $scope['branch_id'] !== null,
                static fn ($query) => $query->where(
                    'branch_id',
                    $scope['branch_id'],
                ),
            )
            ->where('uuid', $uuid)
            ->firstOrFail();
    }

    private function approvals(
        FinanceJournalDraft $draft,
    ) {
        return FinanceApprovalRequest::query()
            ->where('tenant_id', $draft->tenant_id)
            ->where('subject_type', $draft->getMorphClass())
            ->where('subject_id', $draft->getKey())
            ->with(['actions', 'requester', 'decider'])
            ->latest('id')
            ->get();
    }
}
PHP

cat > "$WORKTREE/$APPROVAL_CONTROLLER_REL" <<'PHP'
<?php

namespace App\Http\Controllers\Api\V1\PharmaCo360;

use App\Http\Controllers\Controller;
use App\Http\Requests\Accounting\FinanceWorkflowDecisionRequest;
use App\Models\FinanceApprovalRequest;
use App\Models\FinanceJournalDraft;
use App\Services\Accounting\AccountingRequestScope;
use App\Services\Finance\FinanceJournalWorkflowService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AccountingApprovalCentreController extends Controller
{
    public function __construct(
        private readonly AccountingRequestScope $requestScope,
        private readonly FinanceJournalWorkflowService $journalWorkflow,
    ) {
    }

    public function index(Request $request): JsonResponse
    {
        $scope = $this->requestScope->resolve($request);

        $query = FinanceApprovalRequest::query()
            ->where('tenant_id', $scope['tenant_id'])
            ->when(
                $scope['branch_id'] !== null,
                static fn ($builder) => $builder->where(
                    'branch_id',
                    $scope['branch_id'],
                ),
            )
            ->with(['actions', 'requester', 'decider'])
            ->latest('id');

        if ($request->filled('status')) {
            $query->where('status', $request->string('status')->toString());
        }

        return response()->json([
            'scope' => $scope,
            'approvals' => $query->limit(250)->get(),
        ]);
    }

    public function show(
        Request $request,
        string $approvalUuid,
    ): JsonResponse {
        $scope = $this->requestScope->resolve($request);
        $approval = $this->scopedApproval($scope, $approvalUuid);

        return response()->json([
            'approval' => $approval->load([
                'actions',
                'requester',
                'decider',
                'subject',
            ]),
        ]);
    }

    public function approve(
        FinanceWorkflowDecisionRequest $request,
        string $approvalUuid,
    ): JsonResponse {
        $scope = $this->requestScope->resolve($request);
        $approval = $this->scopedApproval($scope, $approvalUuid);
        $draft = $this->journalSubject($approval);

        $result = $this->journalWorkflow->approve(
            $draft,
            $scope['user_id'],
            $request->validated('comment'),
        );

        return response()->json([
            'message' => 'Approval request approved.',
            'draft' => $result,
            'approval' => $approval->fresh(['actions']),
        ]);
    }

    public function reject(
        FinanceWorkflowDecisionRequest $request,
        string $approvalUuid,
    ): JsonResponse {
        $scope = $this->requestScope->resolve($request);
        $approval = $this->scopedApproval($scope, $approvalUuid);
        $draft = $this->journalSubject($approval);
        $comment = trim((string) $request->validated('comment'));

        $result = $this->journalWorkflow->reject(
            $draft,
            $scope['user_id'],
            $comment,
        );

        return response()->json([
            'message' => 'Approval request rejected.',
            'draft' => $result,
            'approval' => $approval->fresh(['actions']),
        ]);
    }

    private function scopedApproval(
        array $scope,
        string $uuid,
    ): FinanceApprovalRequest {
        return FinanceApprovalRequest::query()
            ->where('tenant_id', $scope['tenant_id'])
            ->when(
                $scope['branch_id'] !== null,
                static fn ($query) => $query->where(
                    'branch_id',
                    $scope['branch_id'],
                ),
            )
            ->where('uuid', $uuid)
            ->firstOrFail();
    }

    private function journalSubject(
        FinanceApprovalRequest $approval,
    ): FinanceJournalDraft {
        $subject = $approval->subject()->first();

        if (! $subject instanceof FinanceJournalDraft) {
            abort(422, 'This Approval Centre item is not a General Journal.');
        }

        return $subject;
    }
}
PHP

cat > "$ROUTE_FILE" <<'PHP'
<?php

use App\Http\Controllers\Api\V1\PharmaCo360\AccountingApprovalCentreController;
use App\Http\Controllers\Api\V1\PharmaCo360\AccountingJournalWorkflowController;
use App\Http\Controllers\Api\V1\PharmaCo360\AccountingReadModelController;
use Illuminate\Support\Facades\Route;

require_once app_path('Http/Controllers/Api/V1/PharmaCo360/AccountingReadModelController.php');
require_once app_path('Http/Controllers/Api/V1/PharmaCo360/AccountingJournalWorkflowController.php');
require_once app_path('Http/Controllers/Api/V1/PharmaCo360/AccountingApprovalCentreController.php');

Route::middleware([
    'auth:sanctum',
    'tenant.module:pharmaco.sales',
    'App\\Http\\Middleware\\EnsureAnyPermission:finance.dashboard.view,finance.journal.view,finance.reports.view,reports.finance.view',
])
    ->prefix('v1/pharmaco/accounting')
    ->group(function (): void {
        Route::get('/overview', [AccountingReadModelController::class, 'overview']);
        Route::get('/journal-register', [AccountingReadModelController::class, 'journalRegister']);
        Route::get('/general-ledger', [AccountingReadModelController::class, 'ledger']);
        Route::get('/trial-balance', [AccountingReadModelController::class, 'trialBalance']);
        Route::get('/chart-of-accounts', [AccountingReadModelController::class, 'chartOfAccounts']);
        Route::get('/account-mappings', [AccountingReadModelController::class, 'mappings']);
        Route::get('/business-dates', [AccountingReadModelController::class, 'businessDates']);
        Route::get('/periods', [AccountingReadModelController::class, 'periods']);
        Route::get('/readiness', [AccountingReadModelController::class, 'readiness']);
    });

Route::middleware([
    'auth:sanctum',
    'tenant.module:pharmaco.sales',
])
    ->prefix('v1/pharmaco/accounting')
    ->group(function (): void {
        Route::middleware(
            'App\\Http\\Middleware\\EnsureAnyPermission:finance.journal.view,finance.journal.approve'
        )->group(function (): void {
            Route::get('/journal-drafts', [AccountingJournalWorkflowController::class, 'index']);
            Route::get('/journal-drafts/{draftUuid}', [AccountingJournalWorkflowController::class, 'show']);
            Route::get('/approvals', [AccountingApprovalCentreController::class, 'index']);
            Route::get('/approvals/{approvalUuid}', [AccountingApprovalCentreController::class, 'show']);
        });

        Route::middleware(
            'App\\Http\\Middleware\\EnsureAnyPermission:finance.journal.create'
        )->group(function (): void {
            Route::post('/journal-drafts', [AccountingJournalWorkflowController::class, 'store']);
            Route::put('/journal-drafts/{draftUuid}', [AccountingJournalWorkflowController::class, 'update']);
            Route::post('/journal-drafts/{draftUuid}/submit', [AccountingJournalWorkflowController::class, 'submit']);
        });

        Route::middleware(
            'App\\Http\\Middleware\\EnsureAnyPermission:finance.journal.approve'
        )->group(function (): void {
            Route::post('/journal-drafts/{draftUuid}/approve', [AccountingJournalWorkflowController::class, 'approve']);
            Route::post('/journal-drafts/{draftUuid}/reject', [AccountingJournalWorkflowController::class, 'reject']);
            Route::post('/journal-drafts/{draftUuid}/post', [AccountingJournalWorkflowController::class, 'post']);
            Route::post('/journal-drafts/{draftUuid}/reverse', [AccountingJournalWorkflowController::class, 'reverse']);
            Route::post('/approvals/{approvalUuid}/approve', [AccountingApprovalCentreController::class, 'approve']);
            Route::post('/approvals/{approvalUuid}/reject', [AccountingApprovalCentreController::class, 'reject']);
        });
    });
PHP

for relative in "${NEW_FILES[@]}" "$ROUTE_REL"
do
    "$PHP_BIN" -l "$WORKTREE/$relative" || abort "php_syntax_failed:$relative"

    if grep -nE '[[:blank:]]+$' "$WORKTREE/$relative"
    then
        abort "trailing_whitespace:$relative"
    fi
done

git -C "$WORKTREE" diff --check || abort "source_diff_check_failed"

if grep -RInE \
    'FinanceJournalEntry::(create|insert)|FinanceJournalLine::(create|insert)|FinancePostingLog::(create|insert)|DB::table\(.finance_journal_(entries|lines).' \
    "$WORKTREE/$JOURNAL_SERVICE_REL"
then
    abort "direct_posted_ledger_write_detected"
fi

grep -qF "FinancePostingService" "$WORKTREE/$JOURNAL_SERVICE_REL" || abort "posting_service_usage_missing"
grep -qF "FinancePeriodGuard" "$WORKTREE/$JOURNAL_SERVICE_REL" || abort "period_guard_usage_missing"
grep -qF "FinanceApprovalWorkflowService" "$WORKTREE/$JOURNAL_SERVICE_REL" || abort "approval_workflow_usage_missing"

SOURCE_PATHS=(
    "${EXPECTED_EXISTING[@]}"
    "${NEW_FILES[@]}"
    "$ROUTE_REL"
)

{
    for relative in "${SOURCE_PATHS[@]}"
    do
        sha256sum "$WORKTREE/$relative"
    done
} > "$MANIFEST"

SOURCE_CONTRACT_SHA="$(sha256sum "$MANIFEST" | awk '{print $1}')"

tar -C "$WORKTREE" -czf "$ARCHIVE" "${SOURCE_PATHS[@]}" || abort "source_archive_failed"
chmod 600 "$MANIFEST" "$ARCHIVE"

echo "source_generation=PASSED"
echo "direct_posted_ledger_write=NONE"
echo "source_contract_sha256=$SOURCE_CONTRACT_SHA"

SOURCE_DB="$PRODUCTION_DB" TARGET_DB="$TEST_DB" "$PHP_BIN" <<'PHP'
<?php

$sourcePath = getenv('SOURCE_DB');
$targetPath = getenv('TARGET_DB');

@unlink($targetPath);

$source = new SQLite3($sourcePath, SQLITE3_OPEN_READONLY);
$source->exec('PRAGMA query_only = ON');

if ((int) $source->querySingle('PRAGMA query_only') !== 1) {
    throw new RuntimeException('Production database source is not query-only.');
}

$destination = new SQLite3(
    $targetPath,
    SQLITE3_OPEN_READWRITE | SQLITE3_OPEN_CREATE,
);

if (! $source->backup($destination)) {
    throw new RuntimeException('SQLite backup failed.');
}

$destination->close();
$source->close();

$copy = new SQLite3($targetPath, SQLITE3_OPEN_READONLY);
$integrity = $copy->querySingle('PRAGMA integrity_check');
$copy->close();

if ($integrity !== 'ok') {
    throw new RuntimeException('Copied database integrity failed.');
}

echo "sqlite_copy_method=PHP_SQLITE3_BACKUP\n";
echo "copied_database_integrity=OK\n";
PHP

[[ "$?" == "0" ]] || abort "copied_database_creation_failed"
chmod 600 "$TEST_DB"

mkdir -p \
    "$RUNTIME_ENV" \
    "$RUNTIME_STORAGE/app" \
    "$RUNTIME_STORAGE/framework/cache" \
    "$RUNTIME_STORAGE/framework/sessions" \
    "$RUNTIME_STORAGE/framework/testing" \
    "$RUNTIME_STORAGE/framework/views" \
    "$RUNTIME_STORAGE/logs" \
    "$RUNTIME_CACHE" || abort "runtime_directory_creation_failed"

APP_KEY_VALUE="$(grep -m1 '^APP_KEY=' "$PRODUCTION_BACKEND/.env" | cut -d= -f2-)"
[[ -n "$APP_KEY_VALUE" ]] || abort "application_key_unavailable"

cat > "$RUNTIME_ENV/.env" <<EOF
APP_NAME=UbuzimaPlus
APP_ENV=testing
APP_KEY=$APP_KEY_VALUE
APP_DEBUG=false
APP_URL=http://localhost
LOG_CHANNEL=single
LOG_LEVEL=warning
DB_CONNECTION=sqlite
DB_DATABASE=$TEST_DB
DB_FOREIGN_KEYS=true
CACHE_STORE=array
CACHE_DRIVER=array
SESSION_DRIVER=array
QUEUE_CONNECTION=sync
MAIL_MAILER=array
EOF

cat > "$TEST_RUNNER" <<'PHP'
<?php

declare(strict_types=1);

use App\Models\FinanceAccountMapping;
use App\Models\FinanceApprovalAction;
use App\Models\FinanceApprovalRequest;
use App\Models\FinanceJournalDraft;
use App\Models\FinanceJournalEntry;
use App\Models\FinancePostingLog;
use App\Services\Finance\FinanceJournalWorkflowService;
use Composer\Autoload\ClassLoader;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;

$backend = getenv('WORKTREE_BACKEND');
$autoload = getenv('PRODUCTION_AUTOLOAD');
$environment = getenv('RUNTIME_ENVIRONMENT');
$storage = getenv('RUNTIME_STORAGE');
$migration = getenv('WORKFLOW_MIGRATION');
$expectedDatabase = getenv('EXPECTED_DATABASE');

require $autoload;

$loader = new ClassLoader();
$loader->addPsr4('App\\', [rtrim($backend, '/') . '/app']);
$loader->register(true);

$app = require rtrim($backend, '/') . '/bootstrap/app.php';
$app->useEnvironmentPath($environment);
$app->useStoragePath($storage);

$kernel = $app->make(Kernel::class);
$kernel->bootstrap();

$connection = DB::connection();

if ($connection->getDriverName() !== 'sqlite') {
    throw new RuntimeException('Isolated runtime is not using SQLite.');
}

if (realpath((string) $connection->getDatabaseName()) !== realpath($expectedDatabase)) {
    throw new RuntimeException('Isolated runtime database mismatch.');
}

echo "isolated_database_path=VERIFIED\n";

$beforeLedger = [
    'entries' => (int) DB::table('finance_journal_entries')->count(),
    'lines' => (int) DB::table('finance_journal_lines')->count(),
    'logs' => (int) DB::table('finance_posting_logs')->count(),
];

$migrateCode = $kernel->call('migrate', [
    '--path' => $migration,
    '--realpath' => true,
    '--force' => true,
    '--no-interaction' => true,
]);

echo $kernel->output();

if ($migrateCode !== 0) {
    throw new RuntimeException('Workflow migration failed.');
}

foreach ([
    'finance_journal_drafts',
    'finance_journal_draft_lines',
    'finance_approval_requests',
    'finance_approval_actions',
] as $table) {
    if (! Schema::hasTable($table)) {
        throw new RuntimeException('Workflow table missing: ' . $table);
    }
}

echo "copied_database_migration=PASSED\n";

$accountingRoutes = collect(Route::getRoutes()->getRoutes())
    ->filter(static fn ($route): bool => str_starts_with(
        (string) $route->uri(),
        'api/v1/pharmaco/accounting',
    ))
    ->values();

if ($accountingRoutes->count() !== 22) {
    throw new RuntimeException(
        'Expected 22 Accounting routes, found ' . $accountingRoutes->count()
    );
}

$writeRoutes = $accountingRoutes->filter(static function ($route): bool {
    return collect($route->methods())->intersect([
        'POST',
        'PUT',
        'PATCH',
        'DELETE',
    ])->isNotEmpty();
});

if ($writeRoutes->count() !== 9) {
    throw new RuntimeException(
        'Expected nine Accounting write routes, found ' . $writeRoutes->count()
    );
}

foreach ($accountingRoutes as $route) {
    $middleware = implode('|', $route->gatherMiddleware());

    foreach ([
        'auth:sanctum',
        'tenant.module:pharmaco.sales',
        'EnsureAnyPermission',
    ] as $required) {
        if (! str_contains($middleware, $required)) {
            throw new RuntimeException(
                'Accounting middleware missing: '
                . $required
                . ' on '
                . $route->uri()
            );
        }
    }
}

echo "registered_accounting_routes=22\n";
echo "registered_accounting_write_routes=9\n";
echo "registered_accounting_middleware=VERIFIED\n";

$mappingRows = FinanceAccountMapping::query()
    ->where('is_active', true)
    ->where('currency_code', 'RWF')
    ->whereHas(
        'account',
        static fn ($query) => $query->where('is_active', true),
    )
    ->orderBy('tenant_id')
    ->orderByRaw('CASE WHEN branch_id IS NULL THEN 0 ELSE 1 END')
    ->orderBy('branch_id')
    ->get();

$selection = null;

foreach ($mappingRows->groupBy('tenant_id') as $tenantId => $tenantMappings) {
    $candidateBranches = collect([null])
        ->merge($tenantMappings->pluck('branch_id')->filter()->unique()->values());

    foreach ($candidateBranches as $candidateBranch) {
        $available = $tenantMappings
            ->filter(static function ($mapping) use ($candidateBranch): bool {
                if ($candidateBranch === null) {
                    return $mapping->branch_id === null;
                }

                return $mapping->branch_id === null
                    || (int) $mapping->branch_id === (int) $candidateBranch;
            })
            ->unique('finance_chart_of_account_id')
            ->values();

        if ($available->count() >= 2) {
            $selection = [
                'tenant_id' => (int) $tenantId,
                'branch_id' => $candidateBranch === null
                    ? null
                    : (int) $candidateBranch,
                'mappings' => $available->take(2)->values(),
            ];
            break 2;
        }
    }
}

if (! is_array($selection)) {
    throw new RuntimeException(
        'Two active mapped accounts were not available for isolated testing.'
    );
}

$userIds = DB::table('users')
    ->orderBy('id')
    ->pluck('id')
    ->map(static fn ($id): int => (int) $id)
    ->unique()
    ->values();

if ($userIds->count() < 2) {
    throw new RuntimeException('Two users are required for maker-checker testing.');
}

$makerId = (int) $userIds[0];
$checkerId = (int) $userIds[1];
$tenantId = $selection['tenant_id'];
$branchId = $selection['branch_id'];
$accountA = (int) $selection['mappings'][0]->finance_chart_of_account_id;
$accountB = (int) $selection['mappings'][1]->finance_chart_of_account_id;

$workflow = $app->make(FinanceJournalWorkflowService::class);

$validData = [
    'business_date' => '2026-07-29',
    'reference' => 'ISOLATED-GJ-' . bin2hex(random_bytes(4)),
    'description' => 'Isolated General Journal workflow verification.',
    'currency_code' => 'RWF',
    'lines' => [
        [
            'finance_chart_of_account_id' => $accountA,
            'description' => 'Isolated debit',
            'debit_amount' => 1000,
            'credit_amount' => 0,
        ],
        [
            'finance_chart_of_account_id' => $accountB,
            'description' => 'Isolated credit',
            'debit_amount' => 0,
            'credit_amount' => 1000,
        ],
    ],
];

$unbalanced = $validData;
$unbalanced['lines'][1]['credit_amount'] = 900;

try {
    $workflow->create(
        $tenantId,
        $branchId,
        $unbalanced,
        $makerId,
    );

    throw new RuntimeException('Unbalanced journal was accepted.');
} catch (ValidationException) {
    echo "unbalanced_journal_rejection=PASSED\n";
}

$draft = $workflow->create(
    $tenantId,
    $branchId,
    $validData,
    $makerId,
);

if ($draft->status !== 'draft' || $draft->lines->count() !== 2) {
    throw new RuntimeException('Draft creation contract failed.');
}

echo "journal_draft_creation=PASSED\n";

$submitted = $workflow->submit($draft, $makerId);

if ($submitted->status !== 'submitted') {
    throw new RuntimeException('Journal submission failed.');
}

$approval = FinanceApprovalRequest::query()
    ->where('subject_id', $draft->id)
    ->where('status', 'pending')
    ->firstOrFail();

echo "journal_submission=PASSED\n";
echo "approval_request_creation=PASSED\n";

try {
    $workflow->approve(
        $submitted,
        $makerId,
        'Maker self-approval attempt.',
    );

    throw new RuntimeException('Maker approved their own journal.');
} catch (ValidationException) {
    echo "maker_self_approval_rejection=PASSED\n";
}

$approved = $workflow->approve(
    $submitted,
    $checkerId,
    'Checked and approved.',
);

if ($approved->status !== 'approved') {
    throw new RuntimeException('Checker approval failed.');
}

echo "checker_approval=PASSED\n";

$entryCountBeforePost = (int) DB::table('finance_journal_entries')->count();
$lineCountBeforePost = (int) DB::table('finance_journal_lines')->count();
$logCountBeforePost = (int) DB::table('finance_posting_logs')->count();

$posted = $workflow->post($approved, $checkerId);

if (
    (int) DB::table('finance_journal_entries')->count() !== $entryCountBeforePost + 1
    || (int) DB::table('finance_journal_lines')->count() !== $lineCountBeforePost + 2
    || (int) DB::table('finance_posting_logs')->count() !== $logCountBeforePost + 1
) {
    throw new RuntimeException('Balanced posting count contract failed.');
}

if (round((float) $posted->total_debit, 4) !== round((float) $posted->total_credit, 4)) {
    throw new RuntimeException('Posted journal is not balanced.');
}

echo "finance_posting_service=PASSED\n";
echo "balanced_posting=PASSED\n";

$duplicate = $workflow->post($approved->fresh(), $checkerId);

if (
    (int) $duplicate->id !== (int) $posted->id
    || (int) DB::table('finance_journal_entries')->count() !== $entryCountBeforePost + 1
) {
    throw new RuntimeException('Deterministic posting idempotency failed.');
}

echo "deterministic_idempotency=PASSED\n";
echo "duplicate_posting_prevention=PASSED\n";

$originalSnapshot = [
    'id' => (int) $posted->id,
    'total_debit' => (string) $posted->total_debit,
    'total_credit' => (string) $posted->total_credit,
    'status' => (string) $posted->status,
    'updated_at' => (string) $posted->updated_at,
];

$reversed = $workflow->reverse(
    $approved->fresh(),
    $checkerId,
    '2026-07-29',
    'Isolated approved reversal verification.',
);

if (
    (int) DB::table('finance_journal_entries')->count() !== $entryCountBeforePost + 2
    || (int) DB::table('finance_journal_lines')->count() !== $lineCountBeforePost + 4
    || (int) DB::table('finance_posting_logs')->count() !== $logCountBeforePost + 2
) {
    throw new RuntimeException('Reversal posting count contract failed.');
}

if (round((float) $reversed->total_debit, 4) !== round((float) $reversed->total_credit, 4)) {
    throw new RuntimeException('Reversal journal is not balanced.');
}

$originalAfter = FinanceJournalEntry::query()->findOrFail($posted->id);

$afterSnapshot = [
    'id' => (int) $originalAfter->id,
    'total_debit' => (string) $originalAfter->total_debit,
    'total_credit' => (string) $originalAfter->total_credit,
    'status' => (string) $originalAfter->status,
    'updated_at' => (string) $originalAfter->updated_at,
];

if ($originalSnapshot !== $afterSnapshot) {
    throw new RuntimeException('Original posted journal was mutated by reversal.');
}

echo "balanced_reversal=PASSED\n";
echo "posted_journal_immutability=PASSED\n";

$duplicateReversal = $workflow->reverse(
    $approved->fresh(),
    $checkerId,
    '2026-07-29',
    'Duplicate reversal attempt.',
);

if (
    (int) $duplicateReversal->id !== (int) $reversed->id
    || (int) DB::table('finance_journal_entries')->count() !== $entryCountBeforePost + 2
) {
    throw new RuntimeException('Duplicate reversal prevention failed.');
}

echo "duplicate_reversal_prevention=PASSED\n";

$actionCount = FinanceApprovalAction::query()
    ->where('approval_request_id', $approval->id)
    ->count();

if ($actionCount < 2) {
    throw new RuntimeException('Approval action history is incomplete.');
}

echo "approval_action_history=PASSED\n";

DB::transaction(function () use ($draft, $posted, $reversed): void {
    DB::table('finance_approval_actions')
        ->whereIn(
            'approval_request_id',
            DB::table('finance_approval_requests')
                ->where('subject_type', FinanceJournalDraft::class)
                ->where('subject_id', $draft->id)
                ->pluck('id'),
        )
        ->delete();

    DB::table('finance_approval_requests')
        ->where('subject_type', FinanceJournalDraft::class)
        ->where('subject_id', $draft->id)
        ->delete();

    DB::table('finance_journal_draft_lines')
        ->where('journal_draft_id', $draft->id)
        ->delete();

    DB::table('finance_journal_drafts')
        ->where('id', $draft->id)
        ->delete();

    $entryIds = [(int) $posted->id, (int) $reversed->id];

    DB::table('finance_posting_logs')
        ->whereIn('journal_entry_id', $entryIds)
        ->delete();

    DB::table('finance_journal_lines')
        ->whereIn('journal_entry_id', $entryIds)
        ->delete();

    DB::table('finance_journal_entries')
        ->whereIn('id', $entryIds)
        ->delete();
});

$afterCleanup = [
    'entries' => (int) DB::table('finance_journal_entries')->count(),
    'lines' => (int) DB::table('finance_journal_lines')->count(),
    'logs' => (int) DB::table('finance_posting_logs')->count(),
];

if ($afterCleanup !== $beforeLedger) {
    throw new RuntimeException('Copied ledger counts were not restored after tests.');
}

$rollbackCode = $kernel->call('migrate:rollback', [
    '--path' => $migration,
    '--realpath' => true,
    '--force' => true,
    '--no-interaction' => true,
]);

echo $kernel->output();

if ($rollbackCode !== 0) {
    throw new RuntimeException('Workflow migration rollback failed.');
}

foreach ([
    'finance_journal_drafts',
    'finance_journal_draft_lines',
    'finance_approval_requests',
    'finance_approval_actions',
] as $table) {
    if (Schema::hasTable($table)) {
        throw new RuntimeException('Workflow table remained after rollback: ' . $table);
    }
}

echo "copied_database_rollback=PASSED\n";
echo "existing_ledger_rows_restored=YES\n";
echo "production_database_used=NO\n";
PHP

WORKTREE_BACKEND="$WORKTREE/backend" \
PRODUCTION_AUTOLOAD="$PRODUCTION_AUTOLOAD" \
RUNTIME_ENVIRONMENT="$RUNTIME_ENV" \
RUNTIME_STORAGE="$RUNTIME_STORAGE" \
WORKFLOW_MIGRATION="$WORKTREE/$MIGRATION_REL" \
EXPECTED_DATABASE="$TEST_DB" \
APP_CONFIG_CACHE="$RUNTIME_CACHE/config.php" \
APP_ROUTES_CACHE="$RUNTIME_CACHE/routes.php" \
APP_EVENTS_CACHE="$RUNTIME_CACHE/events.php" \
APP_PACKAGES_CACHE="$PRODUCTION_BACKEND/bootstrap/cache/packages.php" \
APP_SERVICES_CACHE="$PRODUCTION_BACKEND/bootstrap/cache/services.php" \
"$PHP_BIN" "$TEST_RUNNER" | tee "$TEST_OUTPUT"

TEST_STATUS="${PIPESTATUS[0]}"
[[ "$TEST_STATUS" == "0" ]] || abort "copied_database_workflow_tests_failed:$TEST_STATUS"

REQUIRED_MARKERS=(
    "isolated_database_path=VERIFIED"
    "copied_database_migration=PASSED"
    "registered_accounting_routes=22"
    "registered_accounting_write_routes=9"
    "registered_accounting_middleware=VERIFIED"
    "unbalanced_journal_rejection=PASSED"
    "journal_draft_creation=PASSED"
    "approval_request_creation=PASSED"
    "maker_self_approval_rejection=PASSED"
    "checker_approval=PASSED"
    "finance_posting_service=PASSED"
    "deterministic_idempotency=PASSED"
    "balanced_reversal=PASSED"
    "posted_journal_immutability=PASSED"
    "duplicate_reversal_prevention=PASSED"
    "approval_action_history=PASSED"
    "copied_database_rollback=PASSED"
    "existing_ledger_rows_restored=YES"
    "production_database_used=NO"
)

for marker in "${REQUIRED_MARKERS[@]}"
do
    grep -qFx "$marker" "$TEST_OUTPUT" || abort "required_test_marker_missing:$marker"
done

CHANGED_FILES="$PHASE_DIR/changed-files.txt"
{
    git -C "$WORKTREE" diff --name-only "$EXPECTED_HEAD"
    git -C "$WORKTREE" ls-files --others --exclude-standard
} | sed '/^$/d' | sort -u > "$CHANGED_FILES"

EXPECTED_CHANGED="$PHASE_DIR/expected-changed-files.txt"
printf '%s\n' "${SOURCE_PATHS[@]}" | sort -u > "$EXPECTED_CHANGED"

cmp -s "$EXPECTED_CHANGED" "$CHANGED_FILES" || {
    echo "--- expected source changes ---"
    cat "$EXPECTED_CHANGED"
    echo "--- actual source changes ---"
    cat "$CHANGED_FILES"
    abort "final_source_changeset_mismatch"
}

[[ "$(wc -l < "$CHANGED_FILES" | tr -d ' ')" == "15" ]] || abort "unexpected_changed_file_count"

FINAL_ROUTE_GETS="$(grep -c 'Route::get(' "$ROUTE_FILE")"
FINAL_ROUTE_WRITES="$(grep -Ec 'Route::(post|put|patch|delete)\(' "$ROUTE_FILE")"

[[ "$FINAL_ROUTE_GETS" == "13" ]] || abort "unexpected_get_route_count:$FINAL_ROUTE_GETS"
[[ "$FINAL_ROUTE_WRITES" == "9" ]] || abort "unexpected_write_route_count:$FINAL_ROUTE_WRITES"

PRODUCTION_HEAD_AFTER="$(git -C "$PRODUCTION_REPO" rev-parse HEAD)"
PRODUCTION_STATUS_AFTER="$(git -C "$PRODUCTION_REPO" status --porcelain=v1 --untracked-files=all)"
PRODUCTION_SCHEMA_AFTER="$(
    SOURCE_DB="$PRODUCTION_DB" "$PHP_BIN" -r '
        $db = new SQLite3(getenv("SOURCE_DB"), SQLITE3_OPEN_READONLY);
        $rows = [];
        $result = $db->query(
            "SELECT type, name, tbl_name, sql
             FROM sqlite_master
             WHERE name NOT LIKE '\''sqlite_%'\''
             ORDER BY type, name"
        );
        while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
            $rows[] = $row;
        }
        echo hash("sha256", json_encode($rows, JSON_UNESCAPED_SLASHES));
    '
)"

[[ "$PRODUCTION_HEAD_AFTER" == "$PRODUCTION_HEAD_BEFORE" ]] || abort "production_head_changed"
[[ "$PRODUCTION_STATUS_AFTER" == "$PRODUCTION_STATUS_BEFORE" ]] || abort "production_source_status_changed"
[[ "$PRODUCTION_SCHEMA_AFTER" == "$PRODUCTION_SCHEMA_BEFORE" ]] || abort "production_database_schema_changed"

{
    echo "phase_4d5d9a5_accounting_backend=VERIFIED_UNCOMMITTED"
    echo "development_branch=feature/accounting-journal-approval-foundation-20260729"
    echo "development_parent=$EXPECTED_HEAD"
    echo "development_changed_files=15"
    echo "previous_checkpoint_files_retained=10"
    echo "new_workflow_services=2"
    echo "new_workflow_controllers=2"
    echo "existing_accounting_get_routes=9_PRESERVED"
    echo "new_accounting_read_routes=4"
    echo "new_accounting_write_routes=9"
    echo "total_accounting_routes=22"
    echo "general_journal_workflow=IMPLEMENTED"
    echo "approval_centre_workflow=IMPLEMENTED"
    echo "maker_checker=PASSED"
    echo "period_guard=FinancePeriodGuard"
    echo "posting_service=FinancePostingService"
    echo "direct_posted_ledger_write=NONE"
    echo "deterministic_idempotency=PASSED"
    echo "duplicate_posting_prevention=PASSED"
    echo "balanced_reversal=PASSED"
    echo "posted_journal_immutability=PASSED"
    echo "approval_action_history=PASSED"
    echo "copied_database_migration=PASSED"
    echo "copied_database_rollback=PASSED"
    echo "existing_ledger_rows_restored=YES"
    echo "source_contract_sha256=$SOURCE_CONTRACT_SHA"
    echo "source_archive=$ARCHIVE"
    echo "frontend_source_changed=NO"
    echo "production_source_changed=NO"
    echo "production_database_schema_changed=NO"
    echo "production_database_written_by_gate=NO"
    echo "production_migration_executed=NO"
    echo "git_commit_created=NO"
    echo "feature_branch_pushed=NO"
    echo "main_pushed=NO"
    echo "deployment_executed=NO"
    echo "next_gate=REVIEW_COMMIT_AND_PUSH_ACCOUNTING_BACKEND_FEATURE_BRANCH"
} > "$REPORT"

cp -p "$REPORT" "$MARKER"
chmod 600 "$TEST_OUTPUT" "$CHANGED_FILES" "$REPORT" "$MARKER"

COMPLETE="YES"

echo
echo "============================================================"
cat "$REPORT"
echo "marker=$MARKER"
echo "child_result=0"
echo "============================================================"

exit 0
