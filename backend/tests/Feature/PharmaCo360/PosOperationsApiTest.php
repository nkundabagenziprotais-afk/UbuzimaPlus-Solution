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

    public function test_user_can_open_only_one_session_per_business_day(): void
    {
        $this->seed();

        $token = $this->login();
        $tenant = $this->tenant();
        $branch = $this->branch($tenant);

        $this->openSession($token, $branch, 50000)
            ->assertCreated()
            ->assertJsonPath(
                'session.sequence_number',
                1
            );

        $this->openSession($token, $branch, 50000)
            ->assertStatus(422)
            ->assertJsonValidationErrors(
                'business_date'
            );

        $this->assertSame(
            1,
            PharmacoPosSession::query()
                ->where('tenant_id', $tenant->id)
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

    public function test_second_session_requires_admin_reset_after_closure(): void
    {
        $this->seed();

        $token = $this->login();
        $tenant = $this->tenant();
        $branch = $this->branch($tenant);

        $open = $this->openSession(
            $token,
            $branch,
            20000
        )->assertCreated();

        $sessionId = $open->json('session.id');

        $this->tenantRequest($token)
            ->postJson(
                "/api/v1/pharmaco/pos/"
                . "sessions/{$sessionId}/clear-balance",
                [
                    'declared_cash_amount' => 20000,
                ]
            )
            ->assertOk();

        $this->tenantRequest($token)
            ->postJson(
                "/api/v1/pharmaco/pos/"
                . "sessions/{$sessionId}/close",
                [
                    'declared_cash_amount' => 20000,
                    'closing_mode' => 'handover',
                ]
            )
            ->assertOk();

        $this->openSession($token, $branch, 5000)
            ->assertStatus(422)
            ->assertJsonValidationErrors(
                'business_date'
            );

        $this->tenantRequest($token)
            ->postJson(
                "/api/v1/pharmaco/pos/"
                . "sessions/{$sessionId}/admin-reset",
                [
                    'reason' =>
                        'Approved emergency second shift '
                        . 'after completed reconciliation.',
                ]
            )
            ->assertOk()
            ->assertJsonPath(
                'session.reset_authorized',
                true
            );

        $this->openSession($token, $branch, 5000)
            ->assertCreated()
            ->assertJsonPath(
                'session.sequence_number',
                2
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

    private function openSession(
        string $token,
        Branch $branch,
        float $openingFloat
    ) {
        return $this->tenantRequest($token)
            ->postJson(
                '/api/v1/pharmaco/pos/session/open',
                [
                    'branch_id' => $branch->id,
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
        $response = $this->postJson(
            '/api/v1/auth/login',
            [
                'email' =>
                    'admin@vitapharmaafrica.com',
                'password' =>
                    'ChangeThisPassword123!',
                'device_name' =>
                    'POS Operations Test',
            ]
        );

        $response->assertOk();

        return $response->json('access_token');
    }
}
