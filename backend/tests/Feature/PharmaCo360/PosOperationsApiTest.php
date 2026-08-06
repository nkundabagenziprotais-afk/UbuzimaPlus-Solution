<?php

namespace Tests\Feature\PharmaCo360;

use App\Models\Branch;
use App\Models\PharmacoPosSession;
use App\Models\Tenant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PosOperationsApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $providerClass =
            \Laravel\Sanctum\SanctumServiceProvider::class;

        if (
            ! $this->app->providerIsLoaded(
                $providerClass
            )
        ) {
            $provider = $this->app->register(
                $providerClass
            );

            if (
                $provider
                && method_exists(
                    $provider,
                    'boot'
                )
            ) {
                $this->app->call([
                    $provider,
                    'boot',
                ]);
            }
        }

        $this->assertSame(
            'sanctum',
            config(
                'auth.guards.sanctum.driver'
            )
        );

        $guard = $this->app
            ->make('auth')
            ->guard('sanctum');

        $this->assertInstanceOf(
            \Illuminate\Auth\RequestGuard::class,
            $guard
        );
    }

    public function test_terminal_can_have_only_one_active_live_session(): void
    {
        $this->seed();

        $token = $this->login();
        $tenant = $this->tenant();
        $branch = $this->branch($tenant);

        $this->openSession(
            $token,
            $branch,
            50000,
            'pos-operations-terminal-main'
        )
            ->assertCreated()
            ->assertJsonPath(
                'session.session_mode',
                'live'
            )
            ->assertJsonPath(
                'session.terminal_identifier',
                'pos-operations-terminal-main'
            )
            ->assertJsonPath(
                'session.sequence_number',
                1
            );

        $this->openSession(
            $token,
            $branch,
            50000,
            'pos-operations-terminal-main'
        )
            ->assertStatus(422)
            ->assertJsonValidationErrors(
                'terminal_identifier'
            );

        $this->assertSame(
            1,
            PharmacoPosSession::query()
                ->where(
                    'tenant_id',
                    $tenant->id
                )
                ->where(
                    'branch_id',
                    $branch->id
                )
                ->where(
                    'session_mode',
                    'live'
                )
                ->where(
                    'terminal_identifier',
                    'pos-operations-terminal-main'
                )
                ->count()
        );
    }

    public function test_session_cannot_close_before_balance_clearance(): void
    {
        $this->seed();

        $token = $this->login();
        $tenant = $this->tenant();
        $branch = $this->branch($tenant);

        $open = $this->openSession(
            $token,
            $branch,
            10000
        )->assertCreated();

        $sessionId = $open->json('session.id');

        $this->tenantRequest($token)
            ->postJson(
                "/api/v1/pharmaco/pos/"
                . "sessions/{$sessionId}/close",
                [
                    'declared_cash_amount' => 10000,
                    'closing_mode' => 'handover',
                ]
            )
            ->assertStatus(422)
            ->assertJsonValidationErrors('session');
    }

    public function test_balance_clearance_rejects_a_variance(): void
    {
        $this->seed();

        $token = $this->login();
        $tenant = $this->tenant();
        $branch = $this->branch($tenant);

        $open = $this->openSession(
            $token,
            $branch,
            15000
        )->assertCreated();

        $sessionId = $open->json('session.id');

        $this->tenantRequest($token)
            ->postJson(
                "/api/v1/pharmaco/pos/"
                . "sessions/{$sessionId}/clear-balance",
                [
                    'declared_cash_amount' => 14000,
                ]
            )
            ->assertStatus(422)
            ->assertJsonValidationErrors(
                'declared_cash_amount'
            );
    }

    public function test_cleared_balance_becomes_zero_and_session_closes(): void
    {
        $this->seed();

        $token = $this->login();
        $tenant = $this->tenant();
        $branch = $this->branch($tenant);

        $open = $this->openSession(
            $token,
            $branch,
            15000
        )->assertCreated();

        $sessionId = $open->json('session.id');

        $this->tenantRequest($token)
            ->postJson(
                "/api/v1/pharmaco/pos/"
                . "sessions/{$sessionId}/clear-balance",
                [
                    'declared_cash_amount' => 15000,
                ]
            )
            ->assertOk()
            ->assertJsonPath(
                'session.status',
                'zeroized'
            )
            ->assertJsonPath(
                'session.expected_cash_amount',
                0
            )
            ->assertJsonPath(
                'session.balance_cleared',
                true
            );

        $this->tenantRequest($token)
            ->postJson(
                "/api/v1/pharmaco/pos/"
                . "sessions/{$sessionId}/close",
                [
                    /*
                     * Existing frontend compatibility:
                     * close may still submit the reconciled amount.
                     * Backend closure depends on actual balance = zero.
                     */
                    'declared_cash_amount' => 15000,
                    'closing_mode' => 'handover',
                ]
            )
            ->assertOk()
            ->assertJsonPath(
                'session.status',
                'closed'
            );

        $this->assertDatabaseHas(
            'pharmaco_pos_sessions',
            [
                'id' => $sessionId,
                'status' => 'closed',
                'expected_cash_amount' => 0,
                'variance_amount' => 0,
            ]
        );
    }

    public function test_closed_live_terminal_can_reopen_without_admin_reset(): void
    {
        $this->seed();

        $token = $this->login();
        $tenant = $this->tenant();
        $branch = $this->branch($tenant);

        $terminalIdentifier =
            'pos-operations-terminal-reopen';

        $open = $this->openSession(
            $token,
            $branch,
            20000,
            $terminalIdentifier
        )->assertCreated();

        $sessionId = $open->json(
            'session.id'
        );

        $this->tenantRequest($token)
            ->postJson(
                "/api/v1/pharmaco/pos/"
                . "sessions/{$sessionId}/clear-balance",
                [
                    'declared_cash_amount' =>
                        20000,
                ]
            )
            ->assertOk();

        $this->tenantRequest($token)
            ->postJson(
                "/api/v1/pharmaco/pos/"
                . "sessions/{$sessionId}/close",
                [
                    'declared_cash_amount' =>
                        20000,
                    'closing_mode' =>
                        'handover',
                ]
            )
            ->assertOk()
            ->assertJsonPath(
                'session.status',
                'closed'
            )
            ->assertJsonPath(
                'session.can_open_additional_session',
                true
            );

        $this->openSession(
            $token,
            $branch,
            5000,
            $terminalIdentifier
        )
            ->assertCreated()
            ->assertJsonPath(
                'session.sequence_number',
                2
            )
            ->assertJsonPath(
                'session.terminal_identifier',
                $terminalIdentifier
            );

        $this->assertSame(
            2,
            PharmacoPosSession::query()
                ->where(
                    'tenant_id',
                    $tenant->id
                )
                ->where(
                    'branch_id',
                    $branch->id
                )
                ->where(
                    'terminal_identifier',
                    $terminalIdentifier
                )
                ->count()
        );
    }

    public function test_admin_cannot_reset_an_open_session(): void
    {
        $this->seed();

        $token = $this->login();
        $tenant = $this->tenant();
        $branch = $this->branch($tenant);

        $open = $this->openSession(
            $token,
            $branch,
            10000
        )->assertCreated();

        $sessionId = $open->json('session.id');

        $this->tenantRequest($token)
            ->postJson(
                "/api/v1/pharmaco/pos/"
                . "sessions/{$sessionId}/admin-reset",
                [
                    'reason' =>
                        'Attempted reset before completed '
                        . 'balance clearance and closure.',
                ]
            )
            ->assertStatus(422)
            ->assertJsonValidationErrors('session');
    }

    public function test_admin_reset_requires_a_meaningful_reason(): void
    {
        $this->seed();

        $token = $this->login();
        $tenant = $this->tenant();
        $branch = $this->branch($tenant);

        $open = $this->openSession(
            $token,
            $branch,
            10000
        )->assertCreated();

        $sessionId = $open->json('session.id');

        $this->tenantRequest($token)
            ->postJson(
                "/api/v1/pharmaco/pos/"
                . "sessions/{$sessionId}/clear-balance",
                [
                    'declared_cash_amount' => 10000,
                ]
            )
            ->assertOk();

        $this->tenantRequest($token)
            ->postJson(
                "/api/v1/pharmaco/pos/"
                . "sessions/{$sessionId}/close",
                [
                    'declared_cash_amount' => 10000,
                    'closing_mode' => 'handover',
                ]
            )
            ->assertOk();

        $this->tenantRequest($token)
            ->postJson(
                "/api/v1/pharmaco/pos/"
                . "sessions/{$sessionId}/admin-reset",
                [
                    'reason' => 'short',
                ]
            )
            ->assertStatus(422)
            ->assertJsonValidationErrors('reason');
    }

    public function test_parallel_live_terminals_ignore_open_historical_session(): void
    {
        $this->seed();

        $token = $this->login();
        $tenant = $this->tenant();
        $branch = $this->branch($tenant);

        $user = \App\Models\User::query()
            ->where(
                'email',
                'admin@vitapharmaafrica.com'
            )
            ->firstOrFail();

        $businessDate = now(
            'Africa/Kigali'
        )->toDateString();

        $historicalSession =
            PharmacoPosSession::query()->create([
                'uuid' =>
                    '00000000-0000-4000-8000-000000000041',
                'tenant_id' =>
                    $tenant->id,
                'branch_id' =>
                    $branch->id,
                'user_id' =>
                    $user->id,
                'business_date' =>
                    $businessDate,
                'session_mode' =>
                    'historical',
                'sequence_number' =>
                    1,
                'session_number' =>
                    'HIST-WPA-TERMINAL-INDEPENDENCE',
                'status' =>
                    'open',
                'opening_float_amount' =>
                    0,
                'expected_cash_amount' =>
                    0,
                'opened_at' =>
                    now(),
                'metadata' => [
                    'test' =>
                        'terminal_context_independence',
                ],
            ]);

        $terminalA = $this->openSession(
            $token,
            $branch,
            10000,
            'pos-parallel-terminal-a'
        )
            ->assertCreated()
            ->assertJsonPath(
                'session.sequence_number',
                2
            )
            ->assertJsonPath(
                'session.terminal_identifier',
                'pos-parallel-terminal-a'
            )
            ->json(
                'session.id'
            );

        $terminalB = $this->openSession(
            $token,
            $branch,
            15000,
            'pos-parallel-terminal-b'
        )
            ->assertCreated()
            ->assertJsonPath(
                'session.sequence_number',
                3
            )
            ->assertJsonPath(
                'session.terminal_identifier',
                'pos-parallel-terminal-b'
            )
            ->json(
                'session.id'
            );

        $this->assertNotSame(
            $terminalA,
            $terminalB
        );

        $queryA = http_build_query([
            'branch_id' =>
                $branch->id,
            'terminal_identifier' =>
                'pos-parallel-terminal-a',
        ]);

        $this->tenantRequest($token)
            ->getJson(
                '/api/v1/pharmaco/pos/'
                . 'session/current?'
                . $queryA
            )
            ->assertOk()
            ->assertJsonPath(
                'session.id',
                $terminalA
            )
            ->assertJsonPath(
                'session.session_mode',
                'live'
            );

        $queryB = http_build_query([
            'branch_id' =>
                $branch->id,
            'terminal_identifier' =>
                'pos-parallel-terminal-b',
        ]);

        $this->tenantRequest($token)
            ->getJson(
                '/api/v1/pharmaco/pos/'
                . 'session/current?'
                . $queryB
            )
            ->assertOk()
            ->assertJsonPath(
                'session.id',
                $terminalB
            );

        $historicalSession->refresh();

        $this->assertSame(
            'open',
            $historicalSession->status
        );

        $this->assertSame(
            'historical',
            $historicalSession->session_mode
        );
    }

    public function test_admin_reset_is_event_backed_without_mutating_closed_session(): void
    {
        $this->seed();

        $token = $this->login();
        $tenant = $this->tenant();
        $branch = $this->branch($tenant);

        $sessionId =
            $this->closeSessionForImmutability(
                $token,
                $branch,
                10000,
                'immutability-admin-reset'
            );

        $closed =
            \App\Models\PharmacoPosSession::query()
                ->findOrFail($sessionId);

        $updatedAt =
            $closed->getRawOriginal(
                'updated_at'
            );

        $this->tenantRequest($token)
            ->postJson(
                "/api/v1/pharmaco/pos/"
                . "sessions/{$sessionId}/admin-reset",
                [
                    'reason' =>
                        'Authorize an additional session '
                        . 'through an immutable event.',
                ]
            )
            ->assertOk()
            ->assertJsonPath(
                'session.reset_authorized',
                true
            )
            ->assertJsonPath(
                'session.reset_authorization_source',
                'clock_event'
            );

        $fresh =
            \App\Models\PharmacoPosSession::query()
                ->findOrFail($sessionId);

        $this->assertSame(
            $updatedAt,
            $fresh->getRawOriginal(
                'updated_at'
            )
        );

        $this->assertNull(
            $fresh->reset_authorized_at
        );

        $this->assertNull(
            $fresh->reset_authorized_by
        );

        $this->assertNull(
            $fresh->reset_reason
        );

        $this->assertDatabaseHas(
            'pharmaco_pos_clock_events',
            [
                'pos_session_id' =>
                    $sessionId,
                'event_type' =>
                    'admin_reset',
            ]
        );

        $this->tenantRequest($token)
            ->postJson(
                "/api/v1/pharmaco/pos/"
                . "sessions/{$sessionId}/admin-reset",
                [
                    'reason' =>
                        'Attempt to authorize the same '
                        . 'closed session for a second time.',
                ]
            )
            ->assertStatus(422)
            ->assertJsonValidationErrors(
                'session'
            );

        $this->assertSame(
            1,
            \App\Models\PharmacoPosClockEvent::query()
                ->where(
                    'pos_session_id',
                    $sessionId
                )
                ->where(
                    'event_type',
                    'admin_reset'
                )
                ->count()
        );
    }

    public function test_reset_limit_is_event_backed_without_mutating_closed_session(): void
    {
        $this->seed();

        $token = $this->login();
        $tenant = $this->tenant();
        $branch = $this->branch($tenant);

        $sessionId =
            $this->closeSessionForImmutability(
                $token,
                $branch,
                12000,
                'immutability-reset-limit'
            );

        $closed =
            \App\Models\PharmacoPosSession::query()
                ->findOrFail($sessionId);

        $updatedAt =
            $closed->getRawOriginal(
                'updated_at'
            );

        $this->tenantRequest($token)
            ->postJson(
                "/api/v1/pharmaco/pos/"
                . "sessions/{$sessionId}/reset-limit",
                [
                    'reason' =>
                        'Support authorization recorded '
                        . 'without editing the closed session.',
                ]
            )
            ->assertOk()
            ->assertJsonPath(
                'session.reset_authorized',
                true
            )
            ->assertJsonPath(
                'session.can_reset_limit',
                false
            );

        $fresh =
            \App\Models\PharmacoPosSession::query()
                ->findOrFail($sessionId);

        $this->assertSame(
            $updatedAt,
            $fresh->getRawOriginal(
                'updated_at'
            )
        );

        $this->assertNull(
            $fresh->reset_authorized_at
        );

        $this->assertDatabaseHas(
            'pharmaco_pos_clock_events',
            [
                'pos_session_id' =>
                    $sessionId,
                'event_type' =>
                    'admin_reset',
            ]
        );
    }

    public function test_force_close_authorization_is_a_separate_immutable_event(): void
    {
        $this->seed();

        $token = $this->login();
        $tenant = $this->tenant();
        $branch = $this->branch($tenant);

        $open = $this->openSession(
            $token,
            $branch,
            10000,
            'immutability-force-close'
        )->assertCreated();

        $sessionId =
            (int) $open->json(
                'session.id'
            );

        $this->tenantRequest($token)
            ->postJson(
                "/api/v1/pharmaco/pos/"
                . "sessions/{$sessionId}/force-close",
                [
                    'declared_cash_amount' =>
                        10000,
                    'reason' =>
                        'Abandoned terminal force-closed '
                        . 'with a separate authorization event.',
                    'authorize_next_session' =>
                        true,
                ]
            )
            ->assertOk()
            ->assertJsonPath(
                'session.status',
                'closed'
            )
            ->assertJsonPath(
                'session.reset_authorized',
                true
            )
            ->assertJsonPath(
                'session.reset_authorization_source',
                'clock_event'
            );

        $session =
            \App\Models\PharmacoPosSession::query()
                ->findOrFail($sessionId);

        $this->assertNull(
            $session->reset_authorized_at
        );

        $this->assertNull(
            $session->reset_authorized_by
        );

        $this->assertNull(
            $session->reset_reason
        );

        $this->assertDatabaseHas(
            'pharmaco_pos_clock_events',
            [
                'pos_session_id' =>
                    $sessionId,
                'event_type' =>
                    'admin_force_close',
            ]
        );

        $this->assertDatabaseHas(
            'pharmaco_pos_clock_events',
            [
                'pos_session_id' =>
                    $sessionId,
                'event_type' =>
                    'admin_reset',
            ]
        );
    }

    public function test_closed_sessions_and_clock_events_are_immutable(): void
    {
        $this->seed();

        $token = $this->login();
        $tenant = $this->tenant();
        $branch = $this->branch($tenant);

        $sessionId =
            $this->closeSessionForImmutability(
                $token,
                $branch,
                9000,
                'immutability-model-guard'
            );

        $session =
            \App\Models\PharmacoPosSession::query()
                ->findOrFail($sessionId);

        $originalMetadata =
            $session->metadata;

        $sessionUpdateBlocked = false;

        try {
            $session->metadata = [
                'tampered' => true,
            ];

            $session->save();
        } catch (\LogicException $exception) {
            $sessionUpdateBlocked = true;

            $this->assertSame(
                'Closed POS sessions are immutable.',
                $exception->getMessage()
            );
        }

        $this->assertTrue(
            $sessionUpdateBlocked
        );

        $session->refresh();

        $this->assertSame(
            $originalMetadata,
            $session->metadata
        );

        $sessionDeleteBlocked = false;

        try {
            $session->delete();
        } catch (\LogicException $exception) {
            $sessionDeleteBlocked = true;

            $this->assertSame(
                'Closed POS sessions cannot be deleted.',
                $exception->getMessage()
            );
        }

        $this->assertTrue(
            $sessionDeleteBlocked
        );

        $this->assertDatabaseHas(
            'pharmaco_pos_sessions',
            [
                'id' =>
                    $sessionId,
                'status' =>
                    'closed',
            ]
        );

        $event =
            \App\Models\PharmacoPosClockEvent::query()
                ->where(
                    'pos_session_id',
                    $sessionId
                )
                ->orderBy('id')
                ->firstOrFail();

        $originalNotes =
            $event->notes;

        $eventUpdateBlocked = false;

        try {
            $event->notes =
                'Tampered event notes';

            $event->save();
        } catch (\LogicException $exception) {
            $eventUpdateBlocked = true;

            $this->assertSame(
                'POS clock events are immutable.',
                $exception->getMessage()
            );
        }

        $this->assertTrue(
            $eventUpdateBlocked
        );

        $event->refresh();

        $this->assertSame(
            $originalNotes,
            $event->notes
        );

        $eventDeleteBlocked = false;

        try {
            $event->delete();
        } catch (\LogicException $exception) {
            $eventDeleteBlocked = true;

            $this->assertSame(
                'POS clock events cannot be deleted.',
                $exception->getMessage()
            );
        }

        $this->assertTrue(
            $eventDeleteBlocked
        );

        $this->assertDatabaseHas(
            'pharmaco_pos_clock_events',
            [
                'id' =>
                    $event->id,
                'pos_session_id' =>
                    $sessionId,
            ]
        );
    }

    private function closeSessionForImmutability(
        string $token,
        Branch $branch,
        float $openingFloat,
        string $terminalIdentifier
    ): int {
        $open = $this->openSession(
            $token,
            $branch,
            $openingFloat,
            $terminalIdentifier
        )->assertCreated();

        $sessionId =
            (int) $open->json(
                'session.id'
            );

        $this->tenantRequest($token)
            ->postJson(
                "/api/v1/pharmaco/pos/"
                . "sessions/{$sessionId}/clear-balance",
                [
                    'declared_cash_amount' =>
                        $openingFloat,
                ]
            )
            ->assertOk()
            ->assertJsonPath(
                'session.status',
                'zeroized'
            );

        $this->tenantRequest($token)
            ->postJson(
                "/api/v1/pharmaco/pos/"
                . "sessions/{$sessionId}/close",
                [
                    'declared_cash_amount' =>
                        $openingFloat,
                    'closing_mode' =>
                        'handover',
                ]
            )
            ->assertOk()
            ->assertJsonPath(
                'session.status',
                'closed'
            );

        return $sessionId;
    }

    private function openSession(
        string $token,
        Branch $branch,
        float $openingFloat,
        string $terminalIdentifier =
            'pos-operations-primary-terminal'
    ) {
        return $this->tenantRequest($token)
            ->postJson(
                '/api/v1/pharmaco/pos/session/open',
                [
                    'branch_id' =>
                        $branch->id,
                    'terminal_identifier' =>
                        $terminalIdentifier,
                    'terminal_label' =>
                        'POS Operations Test Terminal',
                    'opening_float_amount' =>
                        $openingFloat,
                    'opening_mode' =>
                        'fresh-start',
                ]
            );
    }

    private function tenant(): Tenant
    {
        return Tenant::query()
            ->where('slug', 'vitapharma')
            ->firstOrFail();
    }

    private function branch(Tenant $tenant): Branch
    {
        return Branch::query()
            ->where('tenant_id', $tenant->id)
            ->firstOrFail();
    }

    private function tenantRequest(string $token)
    {
        return $this
            ->withHeader(
                'X-Tenant-Slug',
                'vitapharma'
            )
            ->withToken($token);
    }

    private function login(): string
    {
        $login = $this->postJson(
            '/api/v1/auth/login',
            [
                'email' =>
                    'admin@vitapharmaafrica.com',
                'password' =>
                    'ChangeThisPassword123!',
                'device_name' =>
                    'POS Terminal Foundation Test',
            ]
        );

        if ($login->getStatusCode() === 200) {
            $login->assertJsonStructure([
                'access_token',
            ]);

            return (string)
                $login->json('access_token');
        }

        $login
            ->assertAccepted()
            ->assertJsonStructure([
                'status',
                'challenge_token',
            ]);

        $this->assertContains(
            $login->json('status'),
            [
                'two_factor_setup_required',
                'two_factor_challenge_required',
            ]
        );

        $challenge =
            \App\Models\TwoFactorChallenge::query()
                ->latest('id')
                ->firstOrFail();

        $secret = $challenge->setup_secret;

        if (! $secret) {
            $challengeUser =
                \App\Models\User::query()
                    ->findOrFail(
                        $challenge->user_id
                    );

            $secret =
                $challengeUser->two_factor_secret;
        }

        $this->assertNotEmpty(
            $secret
        );

        $code = app(
            \App\Services\Auth\TwoFactorAuthenticationService::class
        )->currentCode(
            (string) $secret
        );

        $verified = $this->postJson(
            '/api/v1/auth/two-factor/verify',
            [
                'challenge_token' =>
                    $login->json(
                        'challenge_token'
                    ),
                'code' =>
                    $code,
                'trust_device' =>
                    false,
                'device_name' =>
                    'POS Terminal Foundation Test',
            ]
        );

        $verified
            ->assertOk()
            ->assertJsonPath(
                'status',
                'two_factor_verified'
            )
            ->assertJsonStructure([
                'access_token',
            ]);

        return (string)
            $verified->json('access_token');
    }
}
