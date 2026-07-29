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
