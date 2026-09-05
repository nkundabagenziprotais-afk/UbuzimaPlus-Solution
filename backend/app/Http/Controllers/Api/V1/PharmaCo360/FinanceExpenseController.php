<?php

namespace App\Http\Controllers\Api\V1\PharmaCo360;

use App\Http\Controllers\Controller;
use App\Http\Requests\Accounting\FinanceJournalReversalRequest;
use App\Http\Requests\Accounting\FinanceWorkflowDecisionRequest;
use App\Http\Requests\Accounting\StoreFinanceExpenseRequest;
use App\Http\Requests\Accounting\UpdateFinanceExpenseRequest;
use App\Models\FinanceApprovalRequest;
use App\Models\FinanceExpense;
use App\Models\FinanceJournalDraft;
use App\Services\Accounting\AccountingRequestScope;
use App\Services\Finance\FinanceAccountResolver;
use App\Services\Finance\FinanceExpenseWorkflowService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Throwable;

class FinanceExpenseController extends Controller
{
    public function __construct(
        private readonly AccountingRequestScope
            $requestScope,

        private readonly FinanceExpenseWorkflowService
            $workflow,

        private readonly FinanceAccountResolver
            $accountResolver,
    ) {
    }

    public function index(
        Request $request,
    ): JsonResponse {
        $scope =
            $this
                ->requestScope
                ->resolve($request);

        $query =
            $this
                ->scopedQuery($scope)
                ->with([
                    'lines.account',
                    'supplier',
                    'journalDraft',
                ])
                ->latest(
                    'business_date'
                )
                ->latest('id');

        if (
            $request->filled(
                'status'
            )
        ) {
            $query->where(
                'status',
                $request
                    ->string('status')
                    ->toString()
            );
        }

        if (
            $request->filled('from')
        ) {
            $query->whereDate(
                'business_date',
                '>=',
                $request
                    ->string('from')
                    ->toString()
            );
        }

        if (
            $request->filled('to')
        ) {
            $query->whereDate(
                'business_date',
                '<=',
                $request
                    ->string('to')
                    ->toString()
            );
        }

        if (
            $request->filled(
                'supplier_id'
            )
        ) {
            $query->where(
                'supplier_id',
                (int)
                    $request->query(
                        'supplier_id'
                    )
            );
        }

        if (
            $request->filled(
                'payment_source'
            )
        ) {
            $query->where(
                'payment_source',
                $request
                    ->string(
                        'payment_source'
                    )
                    ->toString()
            );
        }

        if (
            $request->filled(
                'search'
            )
        ) {
            $needle =
                '%'
                . trim(
                    $request
                        ->string(
                            'search'
                        )
                        ->toString()
                )
                . '%';

            $query->where(
                function ($builder)
                use ($needle): void {
                    $builder
                        ->where(
                            'expense_number',
                            'like',
                            $needle
                        )
                        ->orWhere(
                            'purpose',
                            'like',
                            $needle
                        )
                        ->orWhere(
                            'payee_name',
                            'like',
                            $needle
                        )
                        ->orWhere(
                            'reference_number',
                            'like',
                            $needle
                        )
                        ->orWhere(
                            'receipt_number',
                            'like',
                            $needle
                        );
                }
            );
        }

        $limit =
            min(
                max(
                    (int)
                        $request->query(
                            'limit',
                            200
                        ),
                    1
                ),
                500
            );

        return response()->json([
            'scope' =>
                $scope,

            'expenses' =>
                $query
                    ->limit($limit)
                    ->get(),
        ]);
    }

    public function show(
        Request $request,
        string $expenseUuid,
    ): JsonResponse {
        $scope =
            $this
                ->requestScope
                ->resolve($request);

        $expense =
            $this->scopedExpense(
                $scope,
                $expenseUuid
            );

        return response()->json([
            'expense' =>
                $expense->load([
                    'lines.account',
                    'actions.actor',
                    'supplier',
                    'journalDraft.lines.account',
                    'postedJournal',
                    'reversalJournal',
                ]),

            'approvals' =>
                $this->approvals(
                    $expense
                ),
        ]);
    }

    public function referenceData(
        Request $request,
    ): JsonResponse {
        $scope =
            $this
                ->requestScope
                ->resolve($request);

        $tenantId =
            (int)
                $scope['tenant_id'];

        $branchId =
            $scope['branch_id'];

        $query =
            DB::table(
                'finance_account_mappings as m'
            )
                ->join(
                    'finance_chart_of_accounts as a',
                    'a.id',
                    '=',
                    'm.finance_chart_of_account_id'
                )
                ->where(
                    'm.tenant_id',
                    $tenantId
                )
                ->where(
                    'a.tenant_id',
                    $tenantId
                )
                ->where(
                    'm.currency_code',
                    'RWF'
                )
                ->where(
                    'm.is_active',
                    1
                )
                ->where(
                    'a.is_active',
                    1
                )
                ->where(
                    'a.account_type',
                    'expense'
                )
                ->where(
                    function ($builder)
                    use ($branchId): void {
                        $builder
                            ->whereNull(
                                'm.branch_id'
                            );

                        if (
                            $branchId !== null
                        ) {
                            $builder
                                ->orWhere(
                                    'm.branch_id',
                                    $branchId
                                );
                        }
                    }
                );

        $expenseAccounts =
            $query
                ->orderBy('a.code')
                ->get([
                    'a.id',
                    'a.code',
                    'a.name',
                    'a.account_type',
                    'a.normal_balance',
                    'm.mapping_key',
                    'm.branch_id',
                ])
                ->unique('id')
                ->values();

        $paymentMappings = [
            'cash' => 'pos.cash',
            'bank' => 'pos.bank',
            'card' => 'pos.card',
            'momo' => 'pos.momo',
            'unpaid' => 'supplier.ap',
        ];

        $paymentSources = [];

        foreach (
            $paymentMappings
            as $code => $mapping
        ) {
            try {
                $accountId =
                    $this
                        ->accountResolver
                        ->resolve(
                            $tenantId,
                            $branchId,
                            $mapping,
                            'RWF'
                        );

                $account =
                    DB::table(
                        'finance_chart_of_accounts'
                    )
                        ->where(
                            'tenant_id',
                            $tenantId
                        )
                        ->where(
                            'id',
                            $accountId
                        )
                        ->first([
                            'id',
                            'code',
                            'name',
                            'account_type',
                        ]);

                if ($account) {
                    $paymentSources[] = [
                        'code' =>
                            $code,

                        'mapping_key' =>
                            $mapping,

                        'account' =>
                            $account,
                    ];
                }
            } catch (Throwable) {
                /*
                 * Never expose fabricated or
                 * unavailable payment sources.
                 */
            }
        }

        $suppliers =
            DB::table(
                'pharmaco_suppliers'
            )
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->where(
                    'status',
                    'active'
                )
                ->orderBy('name')
                ->limit(500)
                ->get([
                    'id',
                    'uuid',
                    'supplier_code',
                    'name',
                    'status',
                ]);

        $openPeriods =
            DB::table(
                'finance_accounting_periods'
            )
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->where(
                    'status',
                    'open'
                )
                ->where(
                    'is_locked',
                    0
                )
                ->where(
                    function ($builder)
                    use ($branchId): void {
                        $builder
                            ->whereNull(
                                'branch_id'
                            );

                        if (
                            $branchId !== null
                        ) {
                            $builder
                                ->orWhere(
                                    'branch_id',
                                    $branchId
                                );
                        }
                    }
                )
                ->orderBy(
                    'starts_on'
                )
                ->get([
                    'id',
                    'branch_id',
                    'name',
                    'starts_on',
                    'ends_on',
                    'status',
                    'is_locked',
                ]);

        $today =
            now()
                ->toDateString();

        $todayReady =
            $openPeriods
                ->contains(
                    static function (
                        $period
                    ) use ($today): bool {
                        return
                            (string)
                                $period
                                    ->starts_on
                                <= $today
                            &&
                            (string)
                                $period
                                    ->ends_on
                                >= $today;
                    }
                );

        return response()->json([
            'scope' =>
                $scope,

            'currency_code' =>
                'RWF',

            'expense_items' =>
                DB::table(
                    'finance_expense_items as i'
                )
                    ->join(
                        'finance_chart_of_accounts as a',
                        'a.id',
                        '=',
                        'i.finance_chart_of_account_id'
                    )
                    ->where(
                        'i.tenant_id',
                        $tenantId
                    )
                    ->where(
                        'i.status',
                        'active'
                    )
                    ->where(
                        'a.account_type',
                        'expense'
                    )
                    ->where(
                        'a.is_active',
                        1
                    )
                    ->orderBy(
                        'i.group_name'
                    )
                    ->orderBy(
                        'i.name'
                    )
                    ->get([
                        'i.id',
                        'i.uuid',
                        'i.code',
                        'i.name',
                        'i.group_name',
                        'i.finance_chart_of_account_id',
                        'a.code as account_code',
                        'a.name as account_name',
                    ]),

            'expense_accounts' =>
                $expenseAccounts,

            'payment_sources' =>
                $paymentSources,

            'suppliers' =>
                $suppliers,

            'open_periods' =>
                $openPeriods,

            'current_business_date' =>
                $today,

            'current_date_recording_ready'
                => $todayReady,

            'rules' => [
                'maker_checker' =>
                    true,

                'open_period_required' =>
                    true,

                'missing_period_rejected' =>
                    true,

                'posted_delete_allowed' =>
                    false,

                'correction_method' =>
                    'balanced_reversal',

                'unpaid_requires_supplier' =>
                    true,

                'idempotency_key_required' =>
                    true,

                'optimistic_locking' =>
                    true,

                'tenant_scope_client_controlled'
                    => false,

                'branch_scope_client_controlled'
                    => false,

                'evidence_upload_enabled'
                    => false,

                'evidence_upload_release'
                    => 'R4B',
            ],
        ]);
    }

    public function approvalQueue(
        Request $request,
    ): JsonResponse {
        $scope =
            $this
                ->requestScope
                ->resolve($request);

        $expenses =
            $this
                ->scopedQuery($scope)
                ->where(
                    'status',
                    'submitted'
                )
                ->whereNotNull(
                    'finance_journal_draft_id'
                )
                ->with([
                    'lines.account',
                    'supplier',
                    'actions.actor',
                ])
                ->latest(
                    'submitted_at'
                )
                ->limit(250)
                ->get();

        $draftIds =
            $expenses
                ->pluck(
                    'finance_journal_draft_id'
                )
                ->filter()
                ->map(
                    static fn (
                        $value
                    ): int =>
                        (int) $value
                )
                ->values();

        if ($draftIds->isEmpty()) {
            return response()->json([
                'scope' => $scope,
                'queue' => [],
            ]);
        }

        $subjectType =
            (new FinanceJournalDraft())
                ->getMorphClass();

        $approvals =
            FinanceApprovalRequest::query()
                ->where(
                    'tenant_id',
                    $scope['tenant_id']
                )
                ->where(
                    'subject_type',
                    $subjectType
                )
                ->whereIn(
                    'subject_id',
                    $draftIds
                )
                ->where(
                    'status',
                    'pending'
                )
                ->with([
                    'actions',
                    'requester',
                    'decider',
                ])
                ->get()
                ->keyBy(
                    'subject_id'
                );

        $rows =
            $expenses
                ->map(
                    static function (
                        FinanceExpense $expense
                    ) use ($approvals): array {
                        return [
                            'expense' =>
                                $expense,

                            'approval' =>
                                $approvals->get(
                                    (int)
                                        $expense
                                            ->finance_journal_draft_id
                                ),
                        ];
                    }
                )
                ->filter(
                    static fn (
                        array $row
                    ): bool =>
                        $row[
                            'approval'
                        ] !== null
                )
                ->values();

        return response()->json([
            'scope' => $scope,
            'queue' => $rows,
        ]);
    }

    public function store(
        StoreFinanceExpenseRequest $request,
    ): JsonResponse {
        $scope =
            $this
                ->requestScope
                ->resolve($request);

        $idempotencyKey =
            trim(
                (string)
                    $request->header(
                        'Idempotency-Key',
                        ''
                    )
            );

        if (
            $idempotencyKey === ''
            ||
            strlen($idempotencyKey) > 100
            ||
            ! preg_match(
                '/^[A-Za-z0-9._:-]+$/',
                $idempotencyKey
            )
        ) {
            throw ValidationException::
                withMessages([
                    'idempotency_key' => [
                        'A valid '
                        . 'Idempotency-Key '
                        . 'header is required.',
                    ],
                ]);
        }

        $result =
            $this
                ->workflow
                ->create(
                    (int)
                        $scope['tenant_id'],

                    $scope['branch_id'],

                    $request->validated(),

                    (int)
                        $scope['user_id'],

                    $idempotencyKey
                );

        return response()->json([
            'message' =>
                $result['replayed']
                    ? (
                        'Existing Expense '
                        . 'returned for this '
                        . 'Idempotency-Key.'
                    )
                    : (
                        'Expense draft created.'
                    ),

            'idempotent_replay' =>
                $result['replayed'],

            'expense' =>
                $result['expense'],
        ], $result['replayed'] ? 200 : 201);
    }

    public function update(
        UpdateFinanceExpenseRequest $request,
        string $expenseUuid,
    ): JsonResponse {
        $scope =
            $this
                ->requestScope
                ->resolve($request);

        $expense =
            $this->scopedExpense(
                $scope,
                $expenseUuid
            );

        $updated =
            $this
                ->workflow
                ->update(
                    $expense,
                    $request->validated(),
                    (int)
                        $scope['user_id']
                );

        return response()->json([
            'message' =>
                'Expense draft updated.',

            'expense' =>
                $updated,
        ]);
    }

    public function submit(
        Request $request,
        string $expenseUuid,
    ): JsonResponse {
        $scope =
            $this
                ->requestScope
                ->resolve($request);

        $expense =
            $this->scopedExpense(
                $scope,
                $expenseUuid
            );

        $submitted =
            $this
                ->workflow
                ->submit(
                    $expense,
                    (int)
                        $scope['user_id']
                );

        return response()->json([
            'message' =>
                'Expense submitted '
                . 'for approval.',

            'expense' =>
                $submitted,

            'approvals' =>
                $this->approvals(
                    $submitted
                ),
        ]);
    }

    public function approve(
        FinanceWorkflowDecisionRequest $request,
        string $expenseUuid,
    ): JsonResponse {
        $scope =
            $this
                ->requestScope
                ->resolve($request);

        $expense =
            $this->scopedExpense(
                $scope,
                $expenseUuid
            );

        $approved =
            $this
                ->workflow
                ->approve(
                    $expense,
                    (int)
                        $scope['user_id'],
                    $request->validated(
                        'comment'
                    )
                );

        return response()->json([
            'message' =>
                'Expense approved.',

            'expense' =>
                $approved,
        ]);
    }

    public function reject(
        FinanceWorkflowDecisionRequest $request,
        string $expenseUuid,
    ): JsonResponse {
        $scope =
            $this
                ->requestScope
                ->resolve($request);

        $expense =
            $this->scopedExpense(
                $scope,
                $expenseUuid
            );

        $comment =
            trim(
                (string)
                    $request->validated(
                        'comment'
                    )
            );

        $rejected =
            $this
                ->workflow
                ->reject(
                    $expense,
                    (int)
                        $scope['user_id'],
                    $comment
                );

        return response()->json([
            'message' =>
                'Expense rejected.',

            'expense' =>
                $rejected,
        ]);
    }

    public function post(
        Request $request,
        string $expenseUuid,
    ): JsonResponse {
        $scope =
            $this
                ->requestScope
                ->resolve($request);

        $expense =
            $this->scopedExpense(
                $scope,
                $expenseUuid
            );

        $posted =
            $this
                ->workflow
                ->post(
                    $expense,
                    (int)
                        $scope['user_id']
                );

        return response()->json([
            'message' =>
                'Approved Expense posted '
                . 'to the Finance ledger.',

            'expense' =>
                $posted,
        ]);
    }

    public function reverse(
        FinanceJournalReversalRequest $request,
        string $expenseUuid,
    ): JsonResponse {
        $scope =
            $this
                ->requestScope
                ->resolve($request);

        $expense =
            $this->scopedExpense(
                $scope,
                $expenseUuid
            );

        $validated =
            $request->validated();

        $reversed =
            $this
                ->workflow
                ->reverse(
                    $expense,
                    (int)
                        $scope['user_id'],

                    $validated[
                        'business_date'
                    ],

                    $validated[
                        'reason'
                    ]
                );

        return response()->json([
            'message' =>
                'Balanced Expense '
                . 'reversal posted.',

            'expense' =>
                $reversed,
        ]);
    }

    private function scopedQuery(
        array $scope,
    ) {
        return FinanceExpense::query()
            ->where(
                'tenant_id',
                $scope['tenant_id']
            )
            ->when(
                $scope['branch_id'] !==
                    null,

                static fn ($query) =>
                    $query->where(
                        'branch_id',
                        $scope['branch_id']
                    )
            );
    }

    private function scopedExpense(
        array $scope,
        string $uuid,
    ): FinanceExpense {
        return $this
            ->scopedQuery($scope)
            ->where(
                'uuid',
                $uuid
            )
            ->firstOrFail();
    }

    private function approvals(
        FinanceExpense $expense,
    ) {
        if (
            ! $expense
                ->finance_journal_draft_id
        ) {
            return collect();
        }

        $draft =
            FinanceJournalDraft::query()
                ->where(
                    'tenant_id',
                    $expense->tenant_id
                )
                ->find(
                    $expense
                        ->finance_journal_draft_id
                );

        if (! $draft) {
            return collect();
        }

        return FinanceApprovalRequest::query()
            ->where(
                'tenant_id',
                $expense->tenant_id
            )
            ->where(
                'subject_type',
                $draft->getMorphClass()
            )
            ->where(
                'subject_id',
                $draft->getKey()
            )
            ->with([
                'actions',
                'requester',
                'decider',
            ])
            ->latest('id')
            ->get();
    }
}
