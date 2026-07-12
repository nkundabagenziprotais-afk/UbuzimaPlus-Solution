<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\TenantUser;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\Rule;

class SecurityOperationsController extends Controller
{
    public function summary(Request $request): JsonResponse
    {
        $tenant = $this->resolveTenant($request);

        $assignments = TenantUser::query()
            ->where('tenant_id', $tenant->id)
            ->with([
                'user.roles.permissions',
                'user.trustedDevices',
                'branch',
            ])
            ->latest()
            ->get();

        $users = $assignments
            ->filter(fn (TenantUser $assignment) =>
                $assignment->user !== null
            )
            ->map(fn (TenantUser $assignment) =>
                $this->userPayload(
                    $assignment,
                    $tenant
                )
            )
            ->values();

        $activeUsers = $users
            ->where('status', 'active');

        $requiredUsers = $activeUsers
            ->where(
                'security.two_factor_required',
                true
            );

        $twoFactorCompliant = $requiredUsers
            ->where(
                'security.two_factor_enabled',
                true
            )
            ->count();

        $complianceScore = $requiredUsers->count() > 0
            ? (
                $twoFactorCompliant
                / $requiredUsers->count()
            ) * 100
            : 100;

        return response()->json([
            'tenant' => [
                'id' => $tenant->id,
                'name' => $tenant->name,
                'slug' => $tenant->slug,
            ],
            'summary' => [
                'total_users' => $users->count(),
                'active_users' =>
                    $users->where(
                        'status',
                        'active'
                    )->count(),
                'invited_users' =>
                    $users->where(
                        'status',
                        'invited'
                    )->count(),
                'suspended_users' =>
                    $users->where(
                        'status',
                        'suspended'
                    )->count(),
                'inactive_users' =>
                    $users->where(
                        'status',
                        'inactive'
                    )->count(),
                'two_factor_required' =>
                    $users->where(
                        'security.two_factor_required',
                        true
                    )->count(),
                'two_factor_enabled' =>
                    $users->where(
                        'security.two_factor_enabled',
                        true
                    )->count(),
                'two_factor_pending' =>
                    $users
                        ->where(
                            'security.two_factor_required',
                            true
                        )
                        ->where(
                            'security.two_factor_enabled',
                            false
                        )
                        ->count(),
                'password_change_required' =>
                    $users->where(
                        'security.must_change_password',
                        true
                    )->count(),
                'active_sessions' =>
                    $users->sum(
                        'security.active_sessions_count'
                    ),
                'trusted_devices' =>
                    $users->sum(
                        'security.trusted_devices_count'
                    ),
                'never_logged_in' =>
                    $users->whereNull(
                        'security.last_login_at'
                    )->count(),
                'high_risk_users' =>
                    $users->where(
                        'security.risk_level',
                        'high'
                    )->count(),
                'two_factor_compliance_percent' =>
                    round($complianceScore, 1),
            ],
            'users' => $users,
            'generated_at' => now()->toISOString(),
        ]);
    }

    public function forcePasswordChange(
        Request $request,
        User $user
    ): JsonResponse {
        [$tenant, $assignment] =
            $this->resolveAssignment(
                $request,
                $user
            );

        DB::transaction(function () use (
            $request,
            $tenant,
            $assignment,
            $user
        ) {
            $user->forceFill([
                'must_change_password' => true,
            ])->save();

            $revokedSessions =
                $this->revokeUserSessions(
                    $request,
                    $user
                );

            $this->recordAudit(
                $request,
                $tenant,
                $user,
                'security.user.force_password_change',
                [
                    'sessions_revoked' =>
                        $revokedSessions,
                    'tenant_assignment_status' =>
                        $assignment->status,
                ]
            );
        });

        return response()->json([
            'message' =>
                'Password change is now mandatory. Existing sessions were revoked safely.',
            'user' => $this->userPayload(
                $assignment->fresh([
                    'user.roles.permissions',
                    'user.trustedDevices',
                    'branch',
                ]),
                $tenant
            ),
        ]);
    }

    public function resetTwoFactor(
        Request $request,
        User $user
    ): JsonResponse {
        [$tenant, $assignment] =
            $this->resolveAssignment(
                $request,
                $user
            );

        DB::transaction(function () use (
            $request,
            $tenant,
            $assignment,
            $user
        ) {
            $user->forceFill([
                'two_factor_enabled' => false,
                'two_factor_secret' => null,
                'two_factor_recovery_codes' => null,
                'two_factor_confirmed_at' => null,
                'two_factor_last_verified_at' => null,
            ])->save();

            foreach (
                [
                    'two_factor_challenges',
                    'staff_two_factor_challenges',
                ] as $challengeTable
            ) {
                if (Schema::hasTable($challengeTable)) {
                    DB::table($challengeTable)
                        ->where(
                            'user_id',
                            $user->id
                        )
                        ->delete();
                }
            }

            $trustedDevicesRevoked =
                $user->trustedDevices()
                    ->whereNull('revoked_at')
                    ->update([
                        'revoked_at' => now(),
                    ]);

            $sessionsRevoked =
                $this->revokeUserSessions(
                    $request,
                    $user
                );

            $this->recordAudit(
                $request,
                $tenant,
                $user,
                'security.user.two_factor_reset',
                [
                    'trusted_devices_revoked' =>
                        $trustedDevicesRevoked,
                    'sessions_revoked' =>
                        $sessionsRevoked,
                    'two_factor_required' =>
                        (bool)
                        $user->two_factor_required,
                    'tenant_assignment_status' =>
                        $assignment->status,
                ]
            );
        });

        return response()->json([
            'message' =>
                'Two-factor authentication was reset. The user must enrol again at the next protected login.',
            'user' => $this->userPayload(
                $assignment->fresh([
                    'user.roles.permissions',
                    'user.trustedDevices',
                    'branch',
                ]),
                $tenant
            ),
        ]);
    }

    public function revokeTrustedDevices(
        Request $request,
        User $user
    ): JsonResponse {
        [$tenant, $assignment] =
            $this->resolveAssignment(
                $request,
                $user
            );

        $revokedCount = DB::transaction(
            function () use (
                $request,
                $tenant,
                $assignment,
                $user
            ): int {
                $count = $user->trustedDevices()
                    ->whereNull('revoked_at')
                    ->update([
                        'revoked_at' => now(),
                    ]);

                $this->recordAudit(
                    $request,
                    $tenant,
                    $user,
                    'security.user.trusted_devices_revoked',
                    [
                        'trusted_devices_revoked' =>
                            $count,
                        'tenant_assignment_status' =>
                            $assignment->status,
                    ]
                );

                return $count;
            }
        );

        return response()->json([
            'message' => sprintf(
                '%d trusted device(s) were revoked.',
                $revokedCount
            ),
            'revoked_count' => $revokedCount,
            'user' => $this->userPayload(
                $assignment->fresh([
                    'user.roles.permissions',
                    'user.trustedDevices',
                    'branch',
                ]),
                $tenant
            ),
        ]);
    }

    public function revokeSessions(
        Request $request,
        User $user
    ): JsonResponse {
        [$tenant, $assignment] =
            $this->resolveAssignment(
                $request,
                $user
            );

        $revokedCount = DB::transaction(
            function () use (
                $request,
                $tenant,
                $assignment,
                $user
            ): int {
                $count = $this->revokeUserSessions(
                    $request,
                    $user
                );

                $this->recordAudit(
                    $request,
                    $tenant,
                    $user,
                    'security.user.sessions_revoked',
                    [
                        'sessions_revoked' => $count,
                        'current_admin_session_preserved' =>
                            $request->user()?->id
                            === $user->id,
                        'tenant_assignment_status' =>
                            $assignment->status,
                    ]
                );

                return $count;
            }
        );

        return response()->json([
            'message' => sprintf(
                '%d active session(s) were revoked.',
                $revokedCount
            ),
            'revoked_count' => $revokedCount,
            'user' => $this->userPayload(
                $assignment->fresh([
                    'user.roles.permissions',
                    'user.trustedDevices',
                    'branch',
                ]),
                $tenant
            ),
        ]);
    }

    public function updateStatus(
        Request $request,
        User $user
    ): JsonResponse {
        [$tenant, $assignment] =
            $this->resolveAssignment(
                $request,
                $user
            );

        $validated = $request->validate([
            'status' => [
                'required',
                'string',
                Rule::in([
                    'active',
                    'invited',
                    'suspended',
                    'inactive',
                ]),
            ],
            'reason' => [
                'nullable',
                'string',
                'max:500',
            ],
        ]);

        $newStatus = $validated['status'];

        if (
            $request->user()?->id === $user->id
            && in_array(
                $newStatus,
                ['suspended', 'inactive'],
                true
            )
        ) {
            abort(
                422,
                'You cannot suspend or deactivate your own current tenant access.'
            );
        }

        DB::transaction(function () use (
            $request,
            $tenant,
            $assignment,
            $user,
            $validated,
            $newStatus
        ) {
            $previousStatus = $assignment->status;

            $assignment->forceFill([
                'status' => $newStatus,
            ])->save();

            $roleIds = $user->roles()
                ->wherePivot(
                    'tenant_id',
                    $tenant->id
                )
                ->get()
                ->pluck('id');

            $roleStatus = in_array(
                $newStatus,
                ['active', 'invited'],
                true
            )
                ? 'active'
                : 'inactive';

            foreach ($roleIds as $roleId) {
                $user->roles()
                    ->updateExistingPivot(
                        $roleId,
                        [
                            'status' => $roleStatus,
                        ]
                    );
            }

            $sessionsRevoked = 0;
            $devicesRevoked = 0;

            if (
                in_array(
                    $newStatus,
                    ['suspended', 'inactive'],
                    true
                )
            ) {
                $sessionsRevoked =
                    $this->revokeUserSessions(
                        $request,
                        $user
                    );

                $devicesRevoked =
                    $user->trustedDevices()
                        ->whereNull('revoked_at')
                        ->update([
                            'revoked_at' => now(),
                        ]);
            }

            $this->recordAudit(
                $request,
                $tenant,
                $user,
                'security.user.status_changed',
                [
                    'previous_status' =>
                        $previousStatus,
                    'new_status' => $newStatus,
                    'reason' =>
                        $validated['reason']
                        ?? null,
                    'sessions_revoked' =>
                        $sessionsRevoked,
                    'trusted_devices_revoked' =>
                        $devicesRevoked,
                ]
            );
        });

        return response()->json([
            'message' =>
                'Tenant access status updated successfully.',
            'user' => $this->userPayload(
                $assignment->fresh([
                    'user.roles.permissions',
                    'user.trustedDevices',
                    'branch',
                ]),
                $tenant
            ),
        ]);
    }

    public function auditTimeline(
        Request $request
    ): JsonResponse {
        $tenant = $this->resolveTenant($request);

        $validated = $request->validate([
            'search' => [
                'nullable',
                'string',
                'max:100',
            ],
            'action' => [
                'nullable',
                'string',
                'max:100',
            ],
            'actor_user_id' => [
                'nullable',
                'integer',
                'min:1',
            ],
            'from' => [
                'nullable',
                'date',
            ],
            'to' => [
                'nullable',
                'date',
                'after_or_equal:from',
            ],
            'limit' => [
                'nullable',
                'integer',
                'min:1',
                'max:500',
            ],
        ]);

        $query = AuditLog::query()
            ->where(
                'tenant_id',
                $tenant->id
            )
            ->latest('created_at')
            ->latest('id');

        if (
            isset($validated['action'])
            && trim(
                $validated['action']
            ) !== ''
        ) {
            $query->where(
                'action',
                $validated['action']
            );
        }

        if (
            isset(
                $validated[
                    'actor_user_id'
                ]
            )
        ) {
            $query->where(
                'user_id',
                $validated[
                    'actor_user_id'
                ]
            );
        }

        if (isset($validated['from'])) {
            $query->whereDate(
                'created_at',
                '>=',
                $validated['from']
            );
        }

        if (isset($validated['to'])) {
            $query->whereDate(
                'created_at',
                '<=',
                $validated['to']
            );
        }

        $logs = $query
            ->limit(
                (int) (
                    $validated['limit']
                    ?? 100
                )
            )
            ->get();

        $userIds = $logs
            ->pluck('user_id')
            ->merge(
                $logs->map(
                    fn (AuditLog $log) =>
                        data_get(
                            $log->metadata,
                            'target_user_id'
                        )
                )
            )
            ->filter()
            ->unique()
            ->values();

        $users = User::query()
            ->whereIn('id', $userIds)
            ->get([
                'id',
                'name',
                'email',
            ])
            ->keyBy('id');

        $events = $logs
            ->map(function (
                AuditLog $log
            ) use ($users): array {
                $metadata = is_array(
                    $log->metadata
                )
                    ? $log->metadata
                    : [];

                $actor = $log->user_id
                    ? $users->get(
                        $log->user_id
                    )
                    : null;

                $targetUserId =
                    $metadata[
                        'target_user_id'
                    ] ?? null;

                $target = $targetUserId
                    ? $users->get(
                        $targetUserId
                    )
                    : null;

                return [
                    'id' => $log->id,
                    'action' =>
                        $log->action,
                    'category' =>
                        str_starts_with(
                            $log->action,
                            'security.role.'
                        )
                            ? 'role'
                            : (
                                str_starts_with(
                                    $log->action,
                                    'security.user.'
                                )
                                    ? 'user'
                                    : 'security'
                            ),
                    'actor' => $actor
                        ? [
                            'id' =>
                                $actor->id,
                            'name' =>
                                $actor->name,
                            'email' =>
                                $actor->email,
                        ]
                        : null,
                    'target' => [
                        'type' =>
                            $log->auditable_type,
                        'id' =>
                            $log->auditable_id,
                        'user' => $target
                            ? [
                                'id' =>
                                    $target->id,
                                'name' =>
                                    $target->name,
                                'email' =>
                                    $target->email,
                            ]
                            : null,
                        'role_name' =>
                            $metadata[
                                'role_name'
                            ] ?? null,
                    ],
                    'metadata' =>
                        $metadata,
                    'ip_address' =>
                        $log->ip_address
                        ?? (
                            $metadata[
                                'ip_address'
                            ] ?? null
                        ),
                    'user_agent' =>
                        $log->user_agent
                        ?? (
                            $metadata[
                                'user_agent'
                            ] ?? null
                        ),
                    'created_at' =>
                        optional(
                            $log->created_at
                        )->toISOString(),
                ];
            })
            ->filter(function (
                array $event
            ) use ($validated): bool {
                $search = strtolower(
                    trim(
                        (string) (
                            $validated[
                                'search'
                            ] ?? ''
                        )
                    )
                );

                if ($search === '') {
                    return true;
                }

                $haystack = strtolower(
                    implode(
                        ' ',
                        [
                            $event['action'],
                            $event['actor']
                                ['name'] ?? '',
                            $event['actor']
                                ['email'] ?? '',
                            $event['target']
                                ['user']
                                ['name'] ?? '',
                            $event['target']
                                ['user']
                                ['email'] ?? '',
                            $event['target']
                                ['role_name'] ?? '',
                        ]
                    )
                );

                return str_contains(
                    $haystack,
                    $search
                );
            })
            ->values();

        return response()->json([
            'tenant' => [
                'id' => $tenant->id,
                'name' => $tenant->name,
                'slug' => $tenant->slug,
            ],
            'summary' => [
                'event_count' =>
                    $events->count(),
                'user_events' =>
                    $events->where(
                        'category',
                        'user'
                    )->count(),
                'role_events' =>
                    $events->where(
                        'category',
                        'role'
                    )->count(),
                'security_events' =>
                    $events->where(
                        'category',
                        'security'
                    )->count(),
                'unique_actors' =>
                    $events
                        ->pluck(
                            'actor.id'
                        )
                        ->filter()
                        ->unique()
                        ->count(),
            ],
            'events' => $events,
            'generated_at' =>
                now()->toISOString(),
        ]);
    }

    private function resolveAssignment(
        Request $request,
        User $user
    ): array {
        $tenant = $this->resolveTenant($request);

        $assignment = TenantUser::query()
            ->where('tenant_id', $tenant->id)
            ->where('user_id', $user->id)
            ->with([
                'user.roles.permissions',
                'user.trustedDevices',
                'branch',
            ])
            ->firstOrFail();

        return [$tenant, $assignment];
    }

    private function resolveTenant(
        Request $request
    ): Tenant {
        $slug =
            $request->header('X-Tenant-Slug')
            ?: $request->header('X-Tenant')
            ?: $request->input('tenant_slug');

        abort_if(
            ! is_string($slug)
            || trim($slug) === '',
            422,
            'Tenant context is required.'
        );

        return Tenant::query()
            ->where('slug', trim($slug))
            ->where('status', 'active')
            ->firstOrFail();
    }

    private function userPayload(
        TenantUser $assignment,
        Tenant $tenant
    ): array {
        $user = $assignment->user;

        $trustedDevices = $user
            ->trustedDevices()
            ->whereNull('revoked_at')
            ->where(
                'trusted_until',
                '>',
                now()
            )
            ->orderByDesc('last_used_at')
            ->get();

        $sessions = $user->tokens()
            ->orderByDesc('last_used_at')
            ->orderByDesc('created_at')
            ->get();

        $roles = $user->roles
            ->filter(fn (Role $role) =>
                (int) (
                    $role->pivot->tenant_id ?? 0
                ) === (int) $tenant->id
                && (
                    $role->pivot->status
                    ?? 'active'
                ) === 'active'
            )
            ->map(fn (Role $role) => [
                'id' => $role->id,
                'name' => $role->name,
                'code' => $role->code,
                'permissions_count' =>
                    $role->permissions->count(),
            ])
            ->values();

        $riskLevel = $this->riskLevel(
            $assignment,
            $user
        );

        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'phone' => $user->phone,
            'job_title' => $assignment->job_title,
            'status' => $assignment->status,
            'branch' => $assignment->branch
                ? [
                    'id' =>
                        $assignment->branch->id,
                    'name' =>
                        $assignment->branch->name,
                    'code' =>
                        $assignment->branch->code,
                ]
                : null,
            'roles' => $roles,
            'security' => [
                'risk_level' => $riskLevel,
                'two_factor_required' =>
                    (bool)
                    $user->two_factor_required,
                'two_factor_enabled' =>
                    (bool)
                    $user->two_factor_enabled,
                'two_factor_confirmed_at' =>
                    optional(
                        $user
                            ->two_factor_confirmed_at
                    )->toISOString(),
                'two_factor_last_verified_at' =>
                    optional(
                        $user
                            ->two_factor_last_verified_at
                    )->toISOString(),
                'must_change_password' =>
                    (bool)
                    $user->must_change_password,
                'last_login_at' =>
                    optional(
                        $user->last_login_at
                    )->toISOString(),
                'trusted_devices_count' =>
                    $trustedDevices->count(),
                'active_sessions_count' =>
                    $sessions->count(),
            ],
            'trusted_devices' =>
                $trustedDevices
                    ->map(fn ($device) => [
                        'id' => $device->id,
                        'device_name' =>
                            $device->device_name,
                        'ip_address' =>
                            $device->ip_address,
                        'last_used_at' =>
                            optional(
                                $device->last_used_at
                            )->toISOString(),
                        'trusted_until' =>
                            optional(
                                $device->trusted_until
                            )->toISOString(),
                    ])
                    ->values(),
            'sessions' =>
                $sessions
                    ->map(fn ($token) => [
                        'id' => $token->id,
                        'name' => $token->name,
                        'abilities' =>
                            $token->abilities ?? [],
                        'last_used_at' =>
                            optional(
                                $token->last_used_at
                            )->toISOString(),
                        'created_at' =>
                            optional(
                                $token->created_at
                            )->toISOString(),
                        'expires_at' =>
                            optional(
                                $token->expires_at
                            )->toISOString(),
                    ])
                    ->values(),
        ];
    }

    private function riskLevel(
        TenantUser $assignment,
        User $user
    ): string {
        if (
            in_array(
                $assignment->status,
                ['suspended', 'inactive'],
                true
            )
        ) {
            return 'blocked';
        }

        if (
            (
                (bool)
                $user->two_factor_required
                && ! (bool)
                $user->two_factor_enabled
            )
            || (bool)
                $user->must_change_password
        ) {
            return 'high';
        }

        if ($user->last_login_at === null) {
            return 'medium';
        }

        return 'low';
    }

    private function revokeUserSessions(
        Request $request,
        User $user
    ): int {
        $query = $user->tokens();

        if ($request->user()?->id === $user->id) {
            $currentToken =
                $request->user()
                    ?->currentAccessToken();

            $currentTokenId =
                is_object($currentToken)
                && method_exists(
                    $currentToken,
                    'getKey'
                )
                    ? $currentToken->getKey()
                    : null;

            if ($currentTokenId !== null) {
                $query->where(
                    'id',
                    '!=',
                    $currentTokenId
                );
            }
        }

        $tokenIds = $query
            ->pluck('id');

        if ($tokenIds->isEmpty()) {
            return 0;
        }

        return $user->tokens()
            ->whereIn('id', $tokenIds)
            ->delete();
    }

    private function recordAudit(
        Request $request,
        Tenant $tenant,
        User $targetUser,
        string $action,
        array $metadata = []
    ): void {
        AuditLog::query()->create([
            'user_id' =>
                $request->user()?->id,
            'solution_id' => null,
            'tenant_id' => $tenant->id,
            'branch_id' => null,
            'action' => $action,
            'auditable_type' => User::class,
            'auditable_id' =>
                $targetUser->id,
            'data_classification' =>
                'confidential',
            'metadata' => [
                'target_user_id' =>
                    $targetUser->id,
                'target_user_email' =>
                    $targetUser->email,
                'performed_by_user_id' =>
                    $request->user()?->id,
                'ip_address' =>
                    $request->ip(),
                'user_agent' =>
                    $request->userAgent(),
                ...$metadata,
            ],
            'created_at' => now(),
        ]);
    }
}
