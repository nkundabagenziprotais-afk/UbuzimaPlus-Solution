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
