<?php

namespace App\Http\Controllers\Api\V1\PharmaCo360;

use App\Http\Controllers\Controller;
use App\Models\PharmacoPosClockEvent;
use App\Models\PharmacoPosSession;
use App\Models\Tenant;
use App\Services\PharmaCo360\PosSessionPolicyService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class PosSessionAdminController extends Controller
{
    public function index(
        Request $request,
        PosSessionPolicyService $policy,
    ): JsonResponse {
        $tenant = $this->resolveTenant($request);

        $validated = $request->validate([
            'branch_id' => ['nullable', 'integer', 'min:1'],
            'user_id' => ['nullable', 'integer', 'min:1'],
            'status' => [
                'nullable',
                Rule::in([
                    'all',
                    'open',
                    'zeroized',
                    'closed',
                ]),
            ],
            'business_date' => ['nullable', 'date_format:Y-m-d'],
            'search' => ['nullable', 'string', 'max:120'],
            'limit' => ['nullable', 'integer', 'min:10', 'max:500'],
        ]);

        $query = PharmacoPosSession::query()
            ->where('tenant_id', $tenant->id)
            ->with([
                'branch:id,name,code',
                'user:id,name,email',
                'resetAuthorizer:id,name,email',
                'events' => fn ($events) =>
                    $events
                        ->latest('created_at')
                        ->limit(8),
            ]);

        if (! empty($validated['branch_id'])) {
            $query->where(
                'branch_id',
                $validated['branch_id'],
            );
        }

        if (! empty($validated['user_id'])) {
            $query->where(
                'user_id',
                $validated['user_id'],
            );
        }

        if (
            ! empty($validated['status'])
            && $validated['status'] !== 'all'
        ) {
            $query->where(
                'status',
                $validated['status'],
            );
        }

        // POS_ADMIN_LIST_ALL_SESSION_TYPES_V1
        // When no business date is selected, show both live and historical
        // sessions ordered by recency instead of hiding older historical dates.
        if (! empty($validated['business_date'])) {
            $query->whereDate(
                'business_date',
                $validated['business_date'],
            );
        }

        if (! empty($validated['search'])) {
            $search = trim($validated['search']);

            $query->where(function (Builder $builder) use ($search): void {
                $builder
                    ->where(
                        'session_number',
                        'like',
                        '%' . $search . '%',
                    )
                    ->orWhereHas(
                        'user',
                        fn (Builder $userQuery) =>
                            $userQuery
                                ->where(
                                    'name',
                                    'like',
                                    '%' . $search . '%',
                                )
                                ->orWhere(
                                    'email',
                                    'like',
                                    '%' . $search . '%',
                                ),
                    );
            });
        }

        $sessions = $query
            ->latest('business_date')
            ->latest('sequence_number')
            ->limit((int) ($validated['limit'] ?? 250))
            ->get();

        $serialized = $sessions
            ->map(
                fn (PharmacoPosSession $session) =>
                    $this->serializeSession(
                        $session,
                        $policy,
                    ),
            )
            ->values();

        return response()->json([
            'summary' => [
                'total' => $serialized->count(),
                'open' => $serialized
                    ->where('status', 'open')
                    ->count(),
                'zeroized' => $serialized
                    ->where('status', 'zeroized')
                    ->count(),
                'closed' => $serialized
                    ->where('status', 'closed')
                    ->count(),
                'stuck' => $serialized
                    ->where('support_status', 'stuck')
                    ->count(),
                'reset_authorized' => $serialized
                    ->where('reset_authorized', true)
                    ->count(),
            ],
            'sessions' => $serialized,
            'support_policy' => [
                'history_is_never_renumbered' => true,
                'reset_limit_authorizes_next_session' => true,
                'force_close_requires_reason' => true,
                'all_admin_actions_create_clock_events' => true,
            ],
        ]);
    }

    public function forceClose(
        Request $request,
        PharmacoPosSession $session,
        PosSessionPolicyService $policy,
    ): JsonResponse {
        $tenant = $this->resolveTenant($request);

        abort_unless(
            (int) $session->tenant_id
            === (int) $tenant->id,
            404,
        );

        $validated = $request->validate([
            'declared_cash_amount' => [
                'nullable',
                'numeric',
                'min:0',
                'max:999999999999.99',
            ],
            'reason' => [
                'required',
                'string',
                'min:10',
                'max:1000',
            ],
            'authorize_next_session' => [
                'nullable',
                'boolean',
            ],
        ]);

        $session = DB::transaction(
            function () use (
                $tenant,
                $request,
                $session,
                $policy,
                $validated,
            ): PharmacoPosSession {
                $locked = PharmacoPosSession::query()
                    ->with([
                        'branch:id,name,code',
                        'user:id,name,email',
                    ])
                    ->lockForUpdate()
                    ->findOrFail($session->id);

                abort_unless(
                    (int) $locked->tenant_id
                    === (int) $tenant->id,
                    404,
                );

                // POS_ADMIN_CAN_FORCE_CLOSE_HISTORICAL_V4
                // Admin support can force-close abandoned live and historical
                // POS sessions from POS Session Management.

                if (! in_array(
                    $locked->status,
                    ['open', 'zeroized'],
                    true,
                )) {
                    throw ValidationException::withMessages([
                        'session' => [
                            'Only an open or zeroized session can be force-closed.',
                        ],
                    ]);
                }

                $expectedCash = $policy->expectedCash($locked);

                $declaredCash = array_key_exists(
                    'declared_cash_amount',
                    $validated,
                )
                    && $validated['declared_cash_amount'] !== null
                        ? round(
                            (float) $validated['declared_cash_amount'],
                            2,
                        )
                        : $expectedCash;

                $variance = round(
                    $declaredCash - $expectedCash,
                    2,
                );

                $metadata = is_array($locked->metadata)
                    ? $locked->metadata
                    : [];

                $metadata['admin_support'] = [
                    'force_closed' => true,
                    'force_closed_by' => $request->user()->id,
                    'force_closed_at' => now()->toISOString(),
                    'reason' => $validated['reason'],
                    'expected_cash_amount' => $expectedCash,
                    'declared_cash_amount' => $declaredCash,
                    'variance_amount' => $variance,
                    'authorize_next_session' =>
                        (bool) (
                            $validated[
                                'authorize_next_session'
                            ] ?? false
                        ),
                ];

                $updates = [
                    'status' => 'closed',
                    'expected_cash_amount' => $expectedCash,
                    'declared_cash_amount' => $declaredCash,
                    'variance_amount' => $variance,
                    'zeroized_at' =>
                        $locked->zeroized_at ?? now(),
                    'closed_at' => now(),
                    'metadata' => $metadata,
                ];


                $locked->fill($updates)->save();

                $authorizeNextSession =
                    (bool) (
                        $validated[
                            'authorize_next_session'
                        ] ?? false
                    );

                if ($authorizeNextSession) {
                    $policy->ensureCanAuthorizeReset(
                        $locked
                    );
                }

                PharmacoPosClockEvent::query()->create([
                    'uuid' => (string) Str::uuid(),
                    'tenant_id' => $tenant->id,
                    'pos_session_id' => $locked->id,
                    'user_id' => $request->user()->id,
                    'event_type' => 'admin_force_close',
                    'amount' => $declaredCash,
                    'notes' => $validated['reason'],
                    'metadata' => [
                        'expected_cash_amount' =>
                            $expectedCash,
                        'declared_cash_amount' =>
                            $declaredCash,
                        'variance_amount' =>
                            $variance,
                        'previous_status' =>
                            $session->status,
                        'next_session_authorized' =>
                            $authorizeNextSession,
                    ],
                ]);

                if ($authorizeNextSession) {
                    PharmacoPosClockEvent::query()
                        ->create([
                            'uuid' =>
                                (string) Str::uuid(),
                            'tenant_id' =>
                                $tenant->id,
                            'pos_session_id' =>
                                $locked->id,
                            'user_id' =>
                                $request->user()->id,
                            'event_type' =>
                                'admin_reset',
                            'amount' =>
                                null,
                            'notes' =>
                                'Force-close support '
                                . 'authorization: '
                                . $validated['reason'],
                            'metadata' => [
                                'support_action' =>
                                    'authorize_additional_daily_session',
                                'authorization_source' =>
                                    'admin_force_close',
                                'force_close_event_recorded' =>
                                    true,
                                'session_number_preserved' =>
                                    true,
                            ],
                        ]);
                }

                return $locked->fresh([
                    'branch:id,name,code',
                    'user:id,name,email',
                    'resetAuthorizer:id,name,email',
                    'events',
                ]);
            },
        );

        return response()->json([
            'message' =>
                'The POS session was force-closed with an administrator support record.',
            'session' =>
                $this->serializeSession(
                    $session,
                    $policy,
                ),
        ]);
    }

    public function resetLimit(
        Request $request,
        PharmacoPosSession $session,
        PosSessionPolicyService $policy,
    ): JsonResponse {
        $tenant = $this->resolveTenant($request);

        abort_unless(
            (int) $session->tenant_id
            === (int) $tenant->id,
            404,
        );

        $validated = $request->validate([
            'reason' => [
                'required',
                'string',
                'min:10',
                'max:1000',
            ],
        ]);

        $session = DB::transaction(
            function () use (
                $tenant,
                $request,
                $session,
                $policy,
                $validated,
            ): PharmacoPosSession {
                $locked = PharmacoPosSession::query()
                    ->lockForUpdate()
                    ->findOrFail($session->id);

                abort_unless(
                    (int) $locked->tenant_id
                    === (int) $tenant->id,
                    404,
                );

                // POS_ADMIN_HISTORICAL_RESET_ACCESS_V4
                // Historical access reset must work from POS Session Management.
                // Keep the latest-session rule for live sessions only.
                if ($locked->session_mode !== 'historical') {
                    $latest = PharmacoPosSession::query()
                        ->where('tenant_id', $locked->tenant_id)
                        ->where('branch_id', $locked->branch_id)
                        ->where('user_id', $locked->user_id)
                        ->whereDate(
                            'business_date',
                            $locked->business_date
                                ->toDateString(),
                        )
                        ->latest('sequence_number')
                        ->lockForUpdate()
                        ->first();

                    if (
                        ! $latest
                        || (int) $latest->id
                            !== (int) $locked->id
                    ) {
                        throw ValidationException::withMessages([
                            'session' => [
                                'Only the latest session for this cashier, branch and business date can receive a session-limit reset.',
                            ],
                        ]);
                    }
                }

                $policy->ensureCanAuthorizeReset($locked);


                PharmacoPosClockEvent::query()->create([
                    'uuid' => (string) Str::uuid(),
                    'tenant_id' => $tenant->id,
                    'pos_session_id' => $locked->id,
                    'user_id' => $request->user()->id,
                    'event_type' => 'admin_reset',
                    'amount' => null,
                    'notes' => $validated['reason'],
                    'metadata' => [
                        'support_action' =>
                            'authorize_additional_daily_session',
                        'historical_session_number_preserved' =>
                            true,
                    ],
                ]);

                return $locked->fresh([
                    'branch:id,name,code',
                    'user:id,name,email',
                    'resetAuthorizer:id,name,email',
                    'events',
                ]);
            },
        );

        return response()->json([
            'message' =>
                'The daily POS session limit was reset. Existing session numbers and audit history were preserved.',
            'session' =>
                $this->serializeSession(
                    $session,
                    $policy,
                ),
        ]);
    }

    private function resolveTenant(
        Request $request,
    ): Tenant {
        $slug =
            $request->header('X-Tenant-Slug')
            ?: $request->header('X-Tenant')
            ?: $request->input('tenant_slug');

        abort_if(
            ! is_string($slug)
            || trim($slug) === '',
            422,
            'Tenant context is required.',
        );

        return Tenant::query()
            ->where('slug', trim($slug))
            ->where('status', 'active')
            ->firstOrFail();
    }

    private function serializeSession(
        PharmacoPosSession $session,
        PosSessionPolicyService $policy,
    ): array {
        $expectedCash = $policy->expectedCash($session);

        $resetAuthorization =
            $policy->resetAuthorizationSnapshot(
                $session
            );

        $openedAt = $session->opened_at;

        $stuck =
            in_array(
                $session->status,
                ['open', 'zeroized'],
                true,
            )
            && $openedAt
            && $openedAt->lt(now()->subHours(12));

        return [
            'id' => $session->id,
            'uuid' => $session->uuid,
            'session_number' => $session->session_number,
            'sequence_number' =>
                (int) $session->sequence_number,
            'business_date' =>
                $session->business_date?->toDateString(),
            'session_mode' =>
                $session->session_mode ?? 'live',
            'status' => $session->status,
            'support_status' =>
                $stuck ? 'stuck' : 'normal',
            'branch' =>
                $session->relationLoaded('branch')
                && $session->branch
                    ? [
                        'id' => $session->branch->id,
                        'name' => $session->branch->name,
                        'code' => $session->branch->code,
                    ]
                    : null,
            'cashier' =>
                $session->relationLoaded('user')
                && $session->user
                    ? [
                        'id' => $session->user->id,
                        'name' => $session->user->name,
                        'email' => $session->user->email,
                    ]
                    : null,
            'opening_float_amount' =>
                (float) $session->opening_float_amount,
            'expected_cash_amount' =>
                $expectedCash,
            'declared_cash_amount' =>
                $session->declared_cash_amount !== null
                    ? (float) $session->declared_cash_amount
                    : null,
            'variance_amount' =>
                $session->variance_amount !== null
                    ? (float) $session->variance_amount
                    : null,
            'cash_drop_amount' =>
                (float) $session->cash_drop_amount,
            'balance_clearance_amount' =>
                (float) $session->balance_clearance_amount,
            'reset_authorized' =>
                $resetAuthorization !== null,
            'reset_reason' =>
                $resetAuthorization['reason']
                    ?? null,
            'reset_authorized_at' =>
                optional(
                    $resetAuthorization[
                        'authorized_at'
                    ] ?? null
                )->toISOString(),
            'reset_authorizer' =>
                $resetAuthorization[
                    'authorizer'
                ] ?? null,
            'reset_authorization_source' =>
                $resetAuthorization[
                    'source'
                ] ?? null,
            'opened_at' =>
                $session->opened_at?->toISOString(),
            'zeroized_at' =>
                $session->zeroized_at?->toISOString(),
            'closed_at' =>
                $session->closed_at?->toISOString(),
            // POS_ADMIN_HISTORICAL_BUTTON_FLAGS_V4
            'can_force_close' =>
                in_array(
                    $session->status,
                    ['open', 'zeroized'],
                    true,
                ),
            'can_reset_limit' =>
                $session->status === 'closed'
                && $session->closed_at !== null
                && $resetAuthorization === null,

            'metadata' => $session->metadata ?? [],
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
                                        ? (float) $event->amount
                                        : null,
                                'notes' => $event->notes,
                                'created_at' =>
                                    $event->created_at
                                        ?->toISOString(),
                            ],
                        )
                        ->values()
                    : [],
        ];
    }
}
