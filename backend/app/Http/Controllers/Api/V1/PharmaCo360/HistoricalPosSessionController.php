<?php

/* HISTORICAL_POS_NO_REASON_ADMIN_OWNER_BYPASS_FINAL_V1 */

namespace App\Http\Controllers\Api\V1\PharmaCo360;

use App\Http\Controllers\Controller;
use App\Models\Branch;
use App\Models\PharmacoHistoricalPosApproval;
use App\Models\PharmacoPosSession;
use App\Models\User;
use App\Services\Access\ScopeResolver;
use App\Services\Audit\AuditLogService;
use App\Services\PharmaCo360\HistoricalPosConflictService;
use App\Services\PharmaCo360\PosSessionPolicyService;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class HistoricalPosSessionController extends Controller
{
    private const MAXIMUM_CODE_ATTEMPTS = 3;

    public function current(
        Request $request,
        HistoricalPosConflictService $conflicts,
        PosSessionPolicyService $policy
    ): JsonResponse {
        $tenant = $request->attributes->get('tenant');

        $validated = $request->validate([
            'business_date' => [
                'required',
                'date_format:Y-m-d',
            ],
        ]);

        $businessDate = $conflicts->normalizeBusinessDate(
            $validated['business_date']
        );

        $session = PharmacoPosSession::query()
            ->with([
                'branch',
                'events' => fn ($query) =>
                    $query->latest()->limit(20),
                'historicalApproval',
            ])
            ->where('tenant_id', $tenant->id)
            ->where('user_id', $request->user()->id)
            ->where('session_mode', 'historical')
            ->whereDate('business_date', $businessDate)
            ->orderByDesc('sequence_number')
            ->first();

        if ($session) {
            $session->expected_cash_amount =
                $policy->expectedCash($session);
        }

        return response()->json([
            'business_date' => $businessDate,
            'session_mode' => 'historical',
            'session' => $session
                ? $this->serializeSession($session)
                : null,
        ]);
    }

    public function open(
        Request $request,
        HistoricalPosConflictService $conflicts,
        ScopeResolver $scopeResolver,
        AuditLogService $auditLogService
    ): JsonResponse {
        $tenant = $request->attributes->get('tenant');

        $validated = $request->validate([
            'branch_id' => [
                'required',
                'integer',
            ],
            'business_date' => [
                'required',
                'date_format:Y-m-d',
            ],
            'opening_float_amount' => [
                'required',
                'numeric',
                'gte:0',
            ],
            'opening_mode' => [
                'nullable',
                'in:fresh-start,handover',
            ],
            'historical_reason' => ['nullable', 'string', 'max:500'],
            'historical_reference' => [
                'nullable',
                'string',
                'max:160',
            ],
            'approval_id' => [
                'nullable',
                'integer',
            ],
            'approval_code' => [
                'nullable',
                'digits:6',
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

        $businessDate = $conflicts->normalizeBusinessDate(
            $validated['business_date']
        );

        $summary = $conflicts->liveActivitySummary(
            (int) $tenant->id,
            (int) $branch->id,
            $businessDate
        );

        if (
            $summary['live_activity_exists']
            && empty($validated['approval_id'])
        ) {
            throw ValidationException::withMessages([
                'approval_id' => [
                    'An approved historical POS request is required '
                    . 'because live transactions already exist.',
                ],
            ]);
        }

        if (
            $summary['live_activity_exists']
            && empty($validated['approval_code'])
        ) {
            throw ValidationException::withMessages([
                'approval_code' => [
                    'Enter the six-digit authorization code supplied '
                    . 'by an Admin or Owner.',
                ],
            ]);
        }

        try {
            $result = DB::transaction(
                function () use (
                    $tenant,
                    $request,
                    $branch,
                    $validated,
                    $businessDate,
                    $summary
                ) {
                    /*
                     * Lock the user row so concurrent requests for
                     * different historical dates cannot both open.
                     */
                    User::query()
                        ->whereKey($request->user()->id)
                        ->lockForUpdate()
                        ->firstOrFail();

                    // HISTORICAL_POS_ONLY_BLOCK_LIVE_SESSION_V1
                    // Historical POS must not be blocked by another historical session record.
                    // Only an active live POS session should prevent opening historical POS.
                    $activeSession = PharmacoPosSession::query()
                        ->where('tenant_id', $tenant->id)
                        ->where('user_id', $request->user()->id)
                        ->whereNull('historical_approval_id')
                        ->whereIn('status', [
                            'open',
                            'zeroized',
                        ])
                        ->orderByDesc('id')
                        ->lockForUpdate()
                        ->first();

                    if ($activeSession) {
                        throw ValidationException::withMessages([
                            'session' => [
                                'Close the currently active POS session '
                                . 'before opening a historical session.',
                            ],
                        ]);
                    }

                    $approval = null;

                    /*
                     * When live activity exists and an approval code is supplied,
                     * validate and consume it for every role. Previously users with
                     * bypass rights skipped this block, which allowed invalid codes
                     * and opened sessions without historical_approval_id.
                     */
                    if ($summary['live_activity_exists'] && ! $this->userCanBypassHistoricalPosApproval($request)) {
                        $approval =
                            PharmacoHistoricalPosApproval::query()
                                ->whereKey(
                                    $validated['approval_id']
                                )
                                ->where(
                                    'tenant_id',
                                    $tenant->id
                                )
                                ->where(
                                    'branch_id',
                                    $branch->id
                                )
                                ->where(
                                    'requested_by',
                                    $request->user()->id
                                )
                                ->whereDate(
                                    'business_date',
                                    $businessDate
                                )
                                ->lockForUpdate()
                                ->first();

                        if (! $approval) {
                            throw ValidationException::withMessages([
                                'approval_code' => [
                                    'The historical authorization is '
                                    . 'invalid or does not match this '
                                    . 'request.',
                                ],
                            ]);
                        }

                        $approvalError =
                            $this->validateApprovalCode(
                                $approval,
                                (string)
                                $validated['approval_code']
                            );

                        if ($approvalError !== null) {
                            return [
                                'approval_error' =>
                                    $approvalError,
                                'approval' =>
                                    $approval->fresh(),
                            ];
                        }
                    }

                    $latestSession =
                        PharmacoPosSession::query()
                            ->where(
                                'tenant_id',
                                $tenant->id
                            )
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

                    if (
                        $latestSession
                        && $latestSession->status !== 'closed'
                    ) {
                        throw ValidationException::withMessages([
                            'business_date' => [
                                'A POS session is already active for '
                                . 'this user and business date.',
                            ],
                        ]);
                    }

                    $sequence = $latestSession
                        ? max(
                            1,
                            (int)
                            $latestSession->sequence_number + 1
                        )
                        : 1;

                    $openingFloat = round(
                        (float)
                        $validated['opening_float_amount'],
                        2
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
                            'session_mode' => 'historical',
                            'historical_reason' =>
                                $validated[
                                    'historical_reason'
                                ],
                            'historical_reference' =>
                                $validated[
                                    'historical_reference'
                                ] ?? null,
                            'historical_approval_id' =>
                                $approval?->id,
                            'sequence_number' => $sequence,
                            'session_number' =>
                                'HIST-POS-'
                                . str_replace(
                                    '-',
                                    '',
                                    $businessDate
                                )
                                . '-U'
                                . $request->user()->id
                                . '-S'
                                . $sequence,
                            'status' => 'open',
                            'opening_float_amount' =>
                                $openingFloat,
                            'expected_cash_amount' =>
                                $openingFloat,
                            'opened_at' => now(),
                            'metadata' => [
                                'notes' =>
                                    $validated['notes']
                                    ?? null,
                                'opening_mode' =>
                                    $validated[
                                        'opening_mode'
                                    ] ?? 'fresh-start',
                                'session_mode' =>
                                    'historical',
                                'effective_business_date' =>
                                    $businessDate,
                                'recorded_at' =>
                                    now()->toIso8601String(),
                                'approval_required' =>
                                    $summary[
                                        'live_activity_exists'
                                    ],
                                'live_activity_count' =>
                                    $summary[
                                        'live_activity_count'
                                    ],
                                'live_activity_total' =>
                                    $summary[
                                        'live_activity_total'
                                    ],
                                'previous_session_id' =>
                                    $latestSession?->id,
                            ],
                        ]);

                    DB::table(
                        'pharmaco_pos_clock_events'
                    )->insert([
                        'uuid' => (string) Str::uuid(),
                        'tenant_id' => $tenant->id,
                        'pos_session_id' => $session->id,
                        'user_id' =>
                            $request->user()->id,
                        'event_type' => 'clock_in',
                        'amount' => $openingFloat,
                        'notes' =>
                            $validated['notes'] ?? null,
                        'metadata' => json_encode(
                            [
                                'session_mode' =>
                                    'historical',
                                'business_date' =>
                                    $businessDate,
                                'historical_approval_id' =>
                                    $approval?->id,
                            ],
                            JSON_THROW_ON_ERROR
                        ),
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);

                    if ($approval) {
                        $metadata = is_array(
                            $approval->metadata
                        )
                            ? $approval->metadata
                            : [];

                        $metadata['used_by_session_id'] =
                            $session->id;

                        $metadata['used_by_user_id'] =
                            $request->user()->id;

                        $metadata['used_at'] =
                            now()->toIso8601String();

                        $approval->fill([
                            'status' => 'used',
                            'approval_code_hash' => null,
                            'used_at' => now(),
                            'metadata' => $metadata,
                        ])->save();
                    }

                    return [
                        'session' => $session->fresh([
                            'branch',
                            'events',
                            'historicalApproval',
                        ]),
                    ];
                }
            );
        } catch (QueryException $exception) {
            $message = strtolower(
                $exception->getMessage()
            );

            if (
                str_contains($message, 'unique')
                || in_array(
                    (string) $exception->getCode(),
                    [
                        '19',
                        '23000',
                    ],
                    true
                )
            ) {
                throw ValidationException::withMessages([
                    'business_date' => [
                        'A POS session already exists for this '
                        . 'user and business date.',
                    ],
                ]);
            }

            throw $exception;
        }

        $scope = $scopeResolver->resolveForUser(
            $request->user()
        );

        if (isset($result['approval_error'])) {
            $approval = $result['approval'];

            $auditLogService->record(
                action:
                    'pharmaco.pos.historical.'
                    . 'approval.code_failed',
                scope: $scope,
                metadata: [
                    'approval_id' => $approval->id,
                    'branch_id' => $branch->id,
                    'business_date' => $businessDate,
                    'failed_attempts' =>
                        $approval->failed_attempts,
                    'approval_status' =>
                        $approval->status,
                ],
                dataClassification: 'confidential',
                auditableType:
                    PharmacoHistoricalPosApproval::class,
                auditableId: $approval->id
            );

            throw ValidationException::withMessages([
                'approval_code' => [
                    $result['approval_error'],
                ],
            ]);
        }

        $session = $result['session'];

        $auditLogService->record(
            action:
                'pharmaco.pos.historical.session.opened',
            scope: $scope,
            metadata: [
                'tenant_slug' => $tenant->slug,
                'session_id' => $session->id,
                'session_number' =>
                    $session->session_number,
                'branch_id' => $branch->id,
                'business_date' => $businessDate,
                'historical_approval_id' =>
                    $session->historical_approval_id,
                'approval_required' => $summary['live_activity_exists'] && ! $this->userCanBypassHistoricalPosApproval($request),
                'live_activity_count' =>
                    $summary['live_activity_count'],
                'recorded_at' =>
                    $session->opened_at
                        ?->toIso8601String(),
            ],
            dataClassification: 'confidential',
            auditableType: PharmacoPosSession::class,
            auditableId: $session->id
        );

        return response()->json([
            'message' =>
                'Historical POS till opened. Transactions '
                . 'will be recorded against the selected '
                . 'business date.',
            'historical_entry_warning' =>
                'This is a historical session. The business '
                . 'date differs from the actual recording time.',
            'session' =>
                $this->serializeSession($session),
        ], 201);
    }

    private function validateApprovalCode(
        PharmacoHistoricalPosApproval $approval,
        string $plainCode
    ): ?string {
        if (
            $approval->status !== 'approved'
            || ! $approval->requires_code
            || $approval->used_at !== null
            || empty($approval->approval_code_hash)
        ) {
            return 'The authorization code is invalid or '
                . 'has already been used.';
        }

        if (
            ! $approval->expires_at
            || $approval->expires_at->isPast()
        ) {
            $metadata = is_array($approval->metadata)
                ? $approval->metadata
                : [];

            $metadata['expired_while_opening_at'] =
                now()->toIso8601String();

            $approval->fill([
                'status' => 'expired',
                'approval_code_hash' => null,
                'metadata' => $metadata,
            ])->save();

            return 'The authorization code has expired. '
                . 'Request a new approval.';
        }

        if (
            (int) $approval->failed_attempts
            >= self::MAXIMUM_CODE_ATTEMPTS
        ) {
            $approval->fill([
                'status' => 'expired',
                'approval_code_hash' => null,
            ])->save();

            return 'The authorization code is locked after '
                . 'three unsuccessful attempts.';
        }

        if (
            Hash::check(
                $plainCode,
                $approval->approval_code_hash
            )
        ) {
            return null;
        }

        $failedAttempts =
            (int) $approval->failed_attempts + 1;

        $metadata = is_array($approval->metadata)
            ? $approval->metadata
            : [];

        $metadata['last_failed_attempt_at'] =
            now()->toIso8601String();

        $metadata['last_failed_attempt_number'] =
            $failedAttempts;

        $updates = [
            'failed_attempts' => $failedAttempts,
            'metadata' => $metadata,
        ];

        if (
            $failedAttempts
            >= self::MAXIMUM_CODE_ATTEMPTS
        ) {
            $updates['status'] = 'expired';
            $updates['approval_code_hash'] = null;
            $metadata['locked_at'] =
                now()->toIso8601String();
            $updates['metadata'] = $metadata;
        }

        $approval->fill($updates)->save();

        if (
            $failedAttempts
            >= self::MAXIMUM_CODE_ATTEMPTS
        ) {
            return 'The authorization code is invalid and '
                . 'has now been locked after three attempts.';
        }

        $remaining =
            self::MAXIMUM_CODE_ATTEMPTS
            - $failedAttempts;

        return 'The authorization code is invalid. '
            . "{$remaining} attempt(s) remain.";
    }

    private function serializeSession(
        PharmacoPosSession $session
    ): array {
        return [
            'id' => $session->id,
            'uuid' => $session->uuid,
            'session_number' =>
                $session->session_number,
            'sequence_number' =>
                (int) $session->sequence_number,
            'session_mode' =>
                $session->session_mode,
            'status' => $session->status,
            'business_date' =>
                $session->business_date
                    ?->toDateString(),
            'historical_reason' =>
                $session->historical_reason,
            'historical_reference' =>
                $session->historical_reference,
            'historical_approval_id' =>
                $session->historical_approval_id,
            'opening_float_amount' =>
                (float)
                $session->opening_float_amount,
            'expected_cash_amount' =>
                (float)
                $session->expected_cash_amount,
            'declared_cash_amount' =>
                $session->declared_cash_amount !== null
                    ? (float)
                    $session->declared_cash_amount
                    : null,
            'cash_drop_amount' =>
                (float) $session->cash_drop_amount,
            'balance_clearance_amount' =>
                (float)
                $session->balance_clearance_amount,
            'variance_amount' =>
                $session->variance_amount !== null
                    ? (float)
                    $session->variance_amount
                    : null,
            'opened_at' =>
                $session->opened_at
                    ?->toIso8601String(),
            'zeroized_at' =>
                $session->zeroized_at
                    ?->toIso8601String(),
            'closed_at' =>
                $session->closed_at
                    ?->toIso8601String(),
            'metadata' => $session->metadata,
            'branch' =>
                $session->relationLoaded('branch')
                && $session->branch
                    ? [
                        'id' => $session->branch->id,
                        'name' =>
                            $session->branch->name,
                        'code' =>
                            $session->branch->code,
                    ]
                    : null,
            'events' =>
                $session->relationLoaded('events')
                    ? $session->events
                        ->map(
                            fn ($event) => [
                                'id' => $event->id,
                                'event_type' =>
                                    $event->event_type,
                                'amount' =>
                                    $event->amount !== null
                                        ? (float)
                                        $event->amount
                                        : null,
                                'notes' => $event->notes,
                                'metadata' =>
                                    $event->metadata,
                                'created_at' =>
                                    $event->created_at
                                        ?->toIso8601String(),
                            ]
                        )
                        ->values()
                        ->all()
                    : [],
        ];
    }
    private function userCanBypassHistoricalPosApproval(Request $request): bool
    {
        $user = $request->user();

        if (! $user) {
            return false;
        }

        $terms = [];

        foreach (['role', 'role_name', 'role_code', 'type', 'user_type', 'account_type'] as $field) {
            if (isset($user->{$field}) && is_scalar($user->{$field})) {
                $terms[] = strtolower((string) $user->{$field});
            }
        }

        if (method_exists($user, 'roles')) {
            try {
                $roles = $user->roles()->get();

                foreach ($roles as $role) {
                    foreach (['name', 'code', 'slug', 'title'] as $field) {
                        if (isset($role->{$field}) && is_scalar($role->{$field})) {
                            $terms[] = strtolower((string) $role->{$field});
                        }
                    }
                }
            } catch (\Throwable) {
                // Keep bypass detection resilient across role implementations.
            }
        }

        foreach (['admin', 'administrator', 'super admin', 'super-admin', 'owner', 'business owner', 'tenant owner', 'proprietor'] as $needle) {
            foreach ($terms as $term) {
                if (str_contains($term, $needle)) {
                    return true;
                }
            }
        }

        foreach ([
            'pharmaco.pos.historical.approve',
            'pharmaco.pos.historical.admin',
            'pharmaco.pos.historical.bypass',
            'pharmaco.pos.manage',
            'pharmaco.admin',
        ] as $permission) {
            try {
                if (method_exists($user, 'can') && $user->can($permission)) {
                    return true;
                }
            } catch (\Throwable) {
                // Ignore unsupported permission guards.
            }
        }

        return false;
    }

}
