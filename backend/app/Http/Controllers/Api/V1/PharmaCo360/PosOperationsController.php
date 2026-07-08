<?php

namespace App\Http\Controllers\Api\V1\PharmaCo360;

use App\Http\Controllers\Controller;
use App\Models\Branch;
use App\Models\PharmacoPosClockEvent;
use App\Models\PharmacoPosSession;
use App\Models\PharmacoSale;
use App\Services\Access\ScopeResolver;
use App\Services\Audit\AuditLogService;
use App\Services\PharmaCo360\PosSessionPolicyService;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class PosOperationsController extends Controller
{
public function current(
        Request $request,
        PosSessionPolicyService $policy
    ): JsonResponse {
        $tenant = $request->attributes->get('tenant');
        $businessDate = $policy->businessDate();

        $session = PharmacoPosSession::query()
            ->with([
                'branch',
                'events' => fn ($query) =>
                    $query->latest()->limit(20),
            ])
            ->where('tenant_id', $tenant->id)
            ->where('user_id', $request->user()->id)
            ->whereDate('business_date', $businessDate)
            ->orderByDesc('sequence_number')
            ->first();

        if ($session) {
            $session->expected_cash_amount =
                $policy->expectedCash($session);
        }

        return response()->json([
            'business_date' => $businessDate,
            'session' => $session
                ? $this->serializeSession($session)
                : null,
        ]);
    }

public function open(
        Request $request,
        PosSessionPolicyService $policy,
        AuditLogService $auditLogService,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        $tenant = $request->attributes->get('tenant');

        $validated = $request->validate([
            'branch_id' => ['required', 'integer'],
            'opening_float_amount' => [
                'required',
                'numeric',
                'gte:0',
            ],
            'opening_mode' => [
                'nullable',
                'in:fresh-start,handover',
            ],
            'notes' => [
                'nullable',
                'string',
                'max:500',
            ],
        ]);

        $branch = Branch::query()
            ->where('tenant_id', $tenant->id)
            ->where('status', 'active')
            ->find($validated['branch_id']);

        if (! $branch) {
            throw ValidationException::withMessages([
                'branch_id' => [
                    'Selected branch is invalid or inactive.',
                ],
            ]);
        }

        $businessDate = $policy->businessDate();

        try {
            $session = DB::transaction(function () use (
                $tenant,
                $request,
                $branch,
                $validated,
                $businessDate,
                $policy
            ) {
                $latestSession = PharmacoPosSession::query()
                    ->where('tenant_id', $tenant->id)
                    ->where(
                        'user_id',
                        $request->user()->id
                    )
                    ->whereDate(
                        'business_date',
                        $businessDate
                    )
                    ->orderByDesc('sequence_number')
                    ->lockForUpdate()
                    ->first();

                $sequence = $policy->nextSequence(
                    $latestSession
                );

                $dateCode = str_replace(
                    '-',
                    '',
                    $businessDate
                );

                $session =
                    PharmacoPosSession::query()->create([
                        'uuid' => (string) Str::uuid(),
                        'tenant_id' => $tenant->id,
                        'branch_id' => $branch->id,
                        'user_id' =>
                            $request->user()->id,
                        'business_date' =>
                            $businessDate,
                        'sequence_number' =>
                            $sequence,
                        'session_number' =>
                            'POS-'
                            . $dateCode
                            . '-U'
                            . $request->user()->id
                            . '-S'
                            . $sequence,
                        'status' => 'open',
                        'opening_float_amount' =>
                            round(
                                (float)
                                $validated[
                                    'opening_float_amount'
                                ],
                                2
                            ),
                        'expected_cash_amount' =>
                            round(
                                (float)
                                $validated[
                                    'opening_float_amount'
                                ],
                                2
                            ),
                        'opened_at' => now(),
                        'metadata' => [
                            'notes' =>
                                $validated['notes']
                                ?? null,
                            'opening_mode' =>
                                $validated[
                                    'opening_mode'
                                ]
                                ?? 'fresh-start',
                            'control_rule' =>
                                'one_session_per_user_per_day',
                            'previous_session_id' =>
                                $latestSession?->id,
                            'opened_after_admin_reset' =>
                                $latestSession !== null,
                        ],
                    ]);

                $this->recordClockEvent(
                    $tenant->id,
                    $session->id,
                    $request->user()->id,
                    'clock_in',
                    (float)
                    $session->opening_float_amount,
                    $validated['notes'] ?? null
                );

                return $session->fresh([
                    'branch',
                    'events',
                ]);
            });
        } catch (QueryException $exception) {
            $message = strtolower(
                $exception->getMessage()
            );

            if (
                str_contains($message, 'unique')
                || in_array(
                    (string) $exception->getCode(),
                    ['19', '23000'],
                    true
                )
            ) {
                throw ValidationException::withMessages([
                    'business_date' => [
                        'A POS session already exists '
                        . 'for this user and business day.',
                    ],
                ]);
            }

            throw $exception;
        }

        $scope = $scopeResolver->resolveForUser(
            $request->user()
        );

        $auditLogService->record(
            action: 'pharmaco.pos.session.opened',
            scope: $scope,
            metadata: [
                'tenant_slug' => $tenant->slug,
                'session_id' => $session->id,
                'session_number' =>
                    $session->session_number,
                'sequence_number' =>
                    $session->sequence_number,
                'branch_id' => $branch->id,
                'business_date' => $businessDate,
            ],
            dataClassification: 'internal',
            auditableType: PharmacoPosSession::class,
            auditableId: $session->id
        );

        return response()->json([
            'message' =>
                'POS till opened and clock-in recorded.',
            'session' =>
                $this->serializeSession($session),
        ], 201);
    }

public function cashDrop(
        Request $request,
        PharmacoPosSession $session,
        PosSessionPolicyService $policy
    ): JsonResponse {
        $tenant = $request->attributes->get('tenant');

        $this->authorizeTenantSession(
            $tenant->id,
            $request->user()->id,
            $session
        );

        $validated = $request->validate([
            'amount' => [
                'required',
                'numeric',
                'gt:0',
            ],
            'notes' => [
                'nullable',
                'string',
                'max:500',
            ],
        ]);

        $session = DB::transaction(function () use (
            $tenant,
            $request,
            $session,
            $validated,
            $policy
        ) {
            $lockedSession =
                PharmacoPosSession::query()
                    ->lockForUpdate()
                    ->findOrFail($session->id);

            $this->authorizeTenantSession(
                $tenant->id,
                $request->user()->id,
                $lockedSession
            );

            if ($lockedSession->status !== 'open') {
                throw ValidationException::withMessages([
                    'session' => [
                        'Cash drops are allowed only '
                        . 'while the session is open.',
                    ],
                ]);
            }

            $currentExpected =
                $policy->expectedCash($lockedSession);

            if (
                (float) $validated['amount']
                > $currentExpected
            ) {
                throw ValidationException::withMessages([
                    'amount' => [
                        'Cash drop cannot exceed '
                        . 'the expected till cash.',
                    ],
                ]);
            }

            $lockedSession->cash_drop_amount =
                round(
                    (float)
                    $lockedSession->cash_drop_amount
                    + (float)
                    $validated['amount'],
                    2
                );

            $lockedSession->save();

            $lockedSession->expected_cash_amount =
                $policy->expectedCash($lockedSession);

            $lockedSession->save();

            $this->recordClockEvent(
                $tenant->id,
                $lockedSession->id,
                $request->user()->id,
                'cash_drop',
                (float) $validated['amount'],
                $validated['notes'] ?? null
            );

            return $lockedSession->fresh([
                'branch',
                'events',
            ]);
        });

        return response()->json([
            'message' => 'Cash drop recorded.',
            'session' =>
                $this->serializeSession($session),
        ]);
    }

public function zeroize(
        Request $request,
        PharmacoPosSession $session,
        PosSessionPolicyService $policy
    ): JsonResponse {
        $tenant = $request->attributes->get('tenant');

        $this->authorizeTenantSession(
            $tenant->id,
            $request->user()->id,
            $session
        );

        $validated = $request->validate([
            'declared_cash_amount' => [
                'required',
                'numeric',
                'gte:0',
            ],
            'notes' => [
                'nullable',
                'string',
                'max:500',
            ],
        ]);

        $session = DB::transaction(function () use (
            $tenant,
            $request,
            $session,
            $validated,
            $policy
        ) {
            $lockedSession =
                PharmacoPosSession::query()
                    ->lockForUpdate()
                    ->findOrFail($session->id);

            $this->authorizeTenantSession(
                $tenant->id,
                $request->user()->id,
                $lockedSession
            );

            $policy->ensureCanClearBalance(
                $lockedSession
            );

            $expected =
                $policy->expectedCash($lockedSession);

            $declared = round(
                (float)
                $validated['declared_cash_amount'],
                2
            );

            $variance = round(
                $declared - $expected,
                2
            );

            if (abs($variance) > 0.00001) {
                throw ValidationException::withMessages([
                    'declared_cash_amount' => [
                        'Balance clearance failed. '
                        . 'Expected cash is '
                        . number_format($expected, 2)
                        . ' and the variance must be zero.',
                    ],
                ]);
            }

            $metadata =
                $lockedSession->metadata ?? [];

            $metadata['balance_clearance'] = [
                'amount' => $expected,
                'cleared_by' =>
                    $request->user()->id,
                'cleared_at' =>
                    now()->toIso8601String(),
                'notes' =>
                    $validated['notes'] ?? null,
            ];

            $lockedSession->fill([
                'status' => 'zeroized',
                'expected_cash_amount' => 0,
                'declared_cash_amount' =>
                    $declared,
                'balance_clearance_amount' =>
                    round(
                        (float)
                        $lockedSession
                            ->balance_clearance_amount
                        + $expected,
                        2
                    ),
                'variance_amount' => 0,
                'zeroized_at' => now(),
                'metadata' => $metadata,
            ])->save();

            $this->recordClockEvent(
                $tenant->id,
                $lockedSession->id,
                $request->user()->id,
                'balance_clear',
                $expected,
                $validated['notes'] ?? null
            );

            return $lockedSession->fresh([
                'branch',
                'events',
            ]);
        });

        return response()->json([
            'message' =>
                'Till balance cleared successfully. '
                . 'The session may now be closed.',
            'session' =>
                $this->serializeSession($session),
        ]);
    }

public function close(
        Request $request,
        PharmacoPosSession $session,
        PosSessionPolicyService $policy,
        AuditLogService $auditLogService,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        $tenant = $request->attributes->get('tenant');

        $this->authorizeTenantSession(
            $tenant->id,
            $request->user()->id,
            $session
        );

        $validated = $request->validate([
            'declared_cash_amount' => [
                'required',
                'numeric',
                'gte:0',
            ],
            'closing_mode' => [
                'nullable',
                'in:handover,final-close',
            ],
            'deposit_proof' => [
                'nullable',
                'string',
                'max:255',
            ],
            'notes' => [
                'nullable',
                'string',
                'max:500',
            ],
        ]);

        if (
            ($validated['closing_mode'] ?? 'handover')
                === 'final-close'
            && blank(
                $validated['deposit_proof'] ?? null
            )
        ) {
            throw ValidationException::withMessages([
                'deposit_proof' => [
                    'Final close requires a '
                    . 'deposit proof reference.',
                ],
            ]);
        }

        $session = DB::transaction(function () use (
            $tenant,
            $request,
            $session,
            $validated,
            $policy
        ) {
            $lockedSession =
                PharmacoPosSession::query()
                    ->lockForUpdate()
                    ->findOrFail($session->id);

            $this->authorizeTenantSession(
                $tenant->id,
                $request->user()->id,
                $lockedSession
            );

            $expected =
                $policy->expectedCash($lockedSession);

            $policy->ensureCanClose(
                $lockedSession,
                (float)
                $validated['declared_cash_amount'],
                $expected
            );

            $metadata =
                $lockedSession->metadata ?? [];

            $metadata['closing_mode'] =
                $validated['closing_mode']
                ?? 'handover';

            $metadata['deposit_proof'] =
                $validated['deposit_proof']
                ?? null;

            $metadata['closing_notes'] =
                $validated['notes']
                ?? null;

            $lockedSession->fill([
                'status' => 'closed',
                'expected_cash_amount' => 0,
                'variance_amount' => 0,
                'closed_at' => now(),
                'metadata' => $metadata,
            ])->save();

            $this->recordClockEvent(
                $tenant->id,
                $lockedSession->id,
                $request->user()->id,
                'clock_out',
                0,
                $validated['notes'] ?? null
            );

            return $lockedSession->fresh([
                'branch',
                'events',
            ]);
        });

        $scope = $scopeResolver->resolveForUser(
            $request->user()
        );

        $auditLogService->record(
            action: 'pharmaco.pos.session.closed',
            scope: $scope,
            metadata: [
                'tenant_slug' => $tenant->slug,
                'session_id' => $session->id,
                'session_number' =>
                    $session->session_number,
                'variance_amount' => 0,
            ],
            dataClassification: 'internal',
            auditableType: PharmacoPosSession::class,
            auditableId: $session->id
        );

        return response()->json([
            'message' =>
                'POS session closed and clock-out recorded.',
            'session' =>
                $this->serializeSession($session),
        ]);
    }

public function adminReset(
        Request $request,
        PharmacoPosSession $session,
        PosSessionPolicyService $policy,
        AuditLogService $auditLogService,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        $tenant = $request->attributes->get('tenant');

        if (
            (int) $session->tenant_id
            !== (int) $tenant->id
        ) {
            abort(404);
        }

        $validated = $request->validate([
            'reason' => [
                'required',
                'string',
                'min:10',
                'max:1000',
            ],
        ]);

        $session = DB::transaction(function () use (
            $tenant,
            $request,
            $session,
            $validated,
            $policy
        ) {
            $lockedSession =
                PharmacoPosSession::query()
                    ->lockForUpdate()
                    ->findOrFail($session->id);

            if (
                (int) $lockedSession->tenant_id
                !== (int) $tenant->id
            ) {
                abort(404);
            }

            $latestSession =
                PharmacoPosSession::query()
                    ->where(
                        'tenant_id',
                        $lockedSession->tenant_id
                    )
                    ->where(
                        'user_id',
                        $lockedSession->user_id
                    )
                    ->whereDate(
                        'business_date',
                        $lockedSession
                            ->business_date
                            ->toDateString()
                    )
                    ->orderByDesc('sequence_number')
                    ->lockForUpdate()
                    ->first();

            if (
                ! $latestSession
                || (int) $latestSession->id
                    !== (int) $lockedSession->id
            ) {
                throw ValidationException::withMessages([
                    'session' => [
                        'Only the latest session for '
                        . 'the user and business day '
                        . 'can be reset.',
                    ],
                ]);
            }

            $policy->ensureCanAuthorizeReset(
                $lockedSession
            );

            $lockedSession->fill([
                'reset_authorized_at' => now(),
                'reset_authorized_by' =>
                    $request->user()->id,
                'reset_reason' =>
                    $validated['reason'],
            ])->save();

            $this->recordClockEvent(
                $tenant->id,
                $lockedSession->id,
                $request->user()->id,
                'admin_reset',
                0,
                $validated['reason']
            );

            return $lockedSession->fresh([
                'branch',
                'events',
            ]);
        });

        $scope = $scopeResolver->resolveForUser(
            $request->user()
        );

        $auditLogService->record(
            action:
                'pharmaco.pos.session.reset_authorized',
            scope: $scope,
            metadata: [
                'tenant_slug' => $tenant->slug,
                'session_id' => $session->id,
                'session_number' =>
                    $session->session_number,
                'session_user_id' =>
                    $session->user_id,
                'business_date' =>
                    $session->business_date
                        ->toDateString(),
                'reason' => $validated['reason'],
            ],
            dataClassification: 'internal',
            auditableType: PharmacoPosSession::class,
            auditableId: $session->id
        );

        return response()->json([
            'message' =>
                'Administrator reset authorized. '
                . 'The user may open one additional '
                . 'session for this business day.',
            'session' =>
                $this->serializeSession($session),
        ]);
    }

    public function recentTransactions(Request $request): JsonResponse
    {
        $tenant = $request->attributes->get('tenant');

        $session = null;

        if ($request->boolean('current_session')) {
            $session = PharmacoPosSession::query()
                ->where('tenant_id', $tenant->id)
                ->where('user_id', $request->user()->id)
                ->whereDate('business_date', now()->toDateString())
                ->latest('opened_at')
                ->first();
        }

        $sales = PharmacoSale::query()
            ->with(['branch', 'customer', 'prescription', 'payments'])
            ->where('tenant_id', $tenant->id)
            ->when(
                $request->query('branch_id'),
                fn ($query, $branchId) => $query->where('branch_id', $branchId)
            )
            ->when(
                $request->query('status'),
                fn ($query, $status) => $query->where('status', $status)
            )
            ->when($session, function ($query) use ($session) {
                $query
                    ->where('branch_id', $session->branch_id)
                    ->where('sold_by', $session->user_id)
                    ->where('created_at', '>=', $session->opened_at)
                    ->when(
                        $session->closed_at,
                        fn ($inner) => $inner->where(
                            'created_at',
                            '<=',
                            $session->closed_at
                        )
                    );
            })
            ->latest('created_at')
            ->limit(min(max((int) $request->query('limit', 25), 1), 100))
            ->get();

        return response()->json([
            'transactions' => $sales->map(function (PharmacoSale $sale) {
                $latestPayment = $sale->payments->sortByDesc('received_at')->first();

                return [
                    'id' => $sale->id,
                    'sale_number' => $sale->sale_number,
                    'customer' => trim(
                        ($sale->customer->first_name ?? 'Walk-in')
                        . ' '
                        . ($sale->customer->last_name ?? '')
                    ),
                    'branch' => $sale->branch->name ?? null,
                    'status' => $sale->status,
                    'payment_status' => $sale->payment_status,
                    'payment_method' => $latestPayment?->payment_method,
                    'receipt_number' => $latestPayment?->receipt_number,
                    'total_amount' => (float) $sale->total_amount,
                    'paid_amount' => (float) $sale->paid_amount,
                    'created_at' => optional($sale->created_at)->toIso8601String(),
                ];
            })->values(),
        ]);
    }

    private function authorizeTenantSession(
        int $tenantId,
        int $userId,
        PharmacoPosSession $session
    ): void {
        if (
            (int) $session->tenant_id !== $tenantId
            || (int) $session->user_id !== $userId
        ) {
            abort(404);
        }
    }

    private function recordClockEvent(
        int $tenantId,
        int $sessionId,
        int $userId,
        string $type,
        ?float $amount,
        ?string $notes
    ): void {
        PharmacoPosClockEvent::query()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $tenantId,
            'pos_session_id' => $sessionId,
            'user_id' => $userId,
            'event_type' => $type,
            'amount' => $amount,
            'notes' => $notes,
        ]);
    }

private function serializeSession(
        PharmacoPosSession $session
    ): array {
        $expectedCash =
            (float) $session->expected_cash_amount;

        return [
            'id' => $session->id,
            'uuid' => $session->uuid,
            'session_number' =>
                $session->session_number,
            'sequence_number' =>
                (int) $session->sequence_number,
            'business_date' =>
                optional(
                    $session->business_date
                )->toDateString(),
            'status' => $session->status,
            'branch' => $session->branch ? [
                'id' => $session->branch->id,
                'name' => $session->branch->name,
            ] : null,
            'opening_float_amount' =>
                (float)
                $session->opening_float_amount,
            'expected_cash_amount' =>
                $expectedCash,
            'declared_cash_amount' =>
                $session->declared_cash_amount
                !== null
                    ? (float)
                        $session->declared_cash_amount
                    : null,
            'cash_drop_amount' =>
                (float)
                $session->cash_drop_amount,
            'balance_clearance_amount' =>
                (float)
                $session->balance_clearance_amount,
            'variance_amount' =>
                $session->variance_amount !== null
                    ? (float)
                        $session->variance_amount
                    : null,
            'balance_cleared' =>
                in_array(
                    $session->status,
                    ['zeroized', 'closed'],
                    true
                )
                && abs($expectedCash) <= 0.00001,
            'can_close' =>
                $session->status === 'zeroized'
                && abs($expectedCash) <= 0.00001,
            'reset_authorized' =>
                $session->reset_authorized_at
                !== null,
            'can_open_additional_session' =>
                $session->status === 'closed'
                && $session->reset_authorized_at
                    !== null,
            'reset_reason' =>
                $session->reset_reason,
            'reset_authorized_at' =>
                optional(
                    $session->reset_authorized_at
                )->toIso8601String(),
            'reset_authorized_by' =>
                $session->reset_authorized_by,
            'opened_at' =>
                optional(
                    $session->opened_at
                )->toIso8601String(),
            'zeroized_at' =>
                optional(
                    $session->zeroized_at
                )->toIso8601String(),
            'closed_at' =>
                optional(
                    $session->closed_at
                )->toIso8601String(),
            'metadata' =>
                $session->metadata ?? [],
            'events' =>
                $session->relationLoaded('events')
                    ? $session->events
                        ->map(fn ($event) => [
                            'type' =>
                                $event->event_type,
                            'amount' =>
                                $event->amount !== null
                                    ? (float)
                                        $event->amount
                                    : null,
                            'notes' =>
                                $event->notes,
                            'created_at' =>
                                optional(
                                    $event->created_at
                                )->toIso8601String(),
                        ])
                        ->values()
                    : [],
        ];
    }
}
