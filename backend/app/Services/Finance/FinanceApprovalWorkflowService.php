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
