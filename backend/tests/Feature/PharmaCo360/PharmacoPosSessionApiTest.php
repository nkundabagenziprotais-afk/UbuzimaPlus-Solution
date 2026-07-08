<?php

namespace Tests\Feature\PharmaCo360;

use App\Models\Branch;
use App\Models\PharmacoPosSession;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PharmacoPosSessionApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_open_only_one_pos_session_per_business_day(): void
    {
        $this->seed();
        $user = $this->authenticateAdmin();
        [$tenant, $branch] = $this->tenantAndBranch();

        $payload = [
            'branch_id' => $branch->id,
            'opening_mode' => 'fresh_start',
            'starting_cash' => 25000,
        ];

        $this->withTenant()
            ->postJson('/api/v1/pharmaco/pos-sessions/open', $payload)
            ->assertCreated()
            ->assertJsonPath('session.status', 'open')
            ->assertJsonPath('session.starting_cash', 25000.0)
            ->assertJsonPath('session.branch.id', $branch->id);

        $this->withTenant()
            ->postJson('/api/v1/pharmaco/pos-sessions/open', $payload)
            ->assertUnprocessable()
            ->assertJsonValidationErrors('session');

        $this->assertDatabaseCount('pharmaco_pos_sessions', 1);
        $this->assertDatabaseHas('pharmaco_pos_sessions', [
            'tenant_id' => $tenant->id,
            'branch_id' => $branch->id,
            'user_id' => $user->id,
            'business_date' => now()->toDateString(),
            'status' => 'open',
        ]);
    }

    public function test_till_cannot_close_until_zeroized_with_zero_closing_balance(): void
    {
        $this->seed();
        $this->authenticateAdmin();
        [, $branch] = $this->tenantAndBranch();

        $this->withTenant()
            ->postJson('/api/v1/pharmaco/pos-sessions/open', [
                'branch_id' => $branch->id,
                'opening_mode' => 'fresh_start',
                'starting_cash' => 0,
            ])
            ->assertCreated();

        $this->withTenant()
            ->postJson('/api/v1/pharmaco/pos-sessions/close', [
                'close_mode' => 'handover',
                'till_zeroized' => false,
                'closing_cash_balance' => 0,
                'counted_cash' => 0,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('till_zeroized');

        $this->withTenant()
            ->postJson('/api/v1/pharmaco/pos-sessions/close', [
                'close_mode' => 'handover',
                'till_zeroized' => true,
                'closing_cash_balance' => 100,
                'counted_cash' => 0,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('closing_cash_balance');

        $this->withTenant()
            ->postJson('/api/v1/pharmaco/pos-sessions/close', [
                'close_mode' => 'handover',
                'till_zeroized' => true,
                'closing_cash_balance' => 0,
                'counted_cash' => 0,
            ])
            ->assertOk()
            ->assertJsonPath('session.status', 'closed')
            ->assertJsonPath('session.till_zeroized', true)
            ->assertJsonPath('session.closing_cash_balance', 0.0)
            ->assertJsonPath('session.cash_variance', 0.0);
    }

    public function test_closed_session_cannot_close_twice_or_reopen_same_day(): void
    {
        $this->seed();
        $this->authenticateAdmin();
        [, $branch] = $this->tenantAndBranch();

        $this->withTenant()
            ->postJson('/api/v1/pharmaco/pos-sessions/open', [
                'branch_id' => $branch->id,
                'opening_mode' => 'fresh_start',
                'starting_cash' => 0,
            ])
            ->assertCreated();

        $closePayload = [
            'close_mode' => 'final_close',
            'till_zeroized' => true,
            'closing_cash_balance' => 0,
            'counted_cash' => 0,
            'deposit_reference' => 'DEP-TEST-001',
        ];

        $this->withTenant()
            ->postJson('/api/v1/pharmaco/pos-sessions/close', $closePayload)
            ->assertOk();

        $this->withTenant()
            ->postJson('/api/v1/pharmaco/pos-sessions/close', $closePayload)
            ->assertUnprocessable()
            ->assertJsonValidationErrors('session');

        $this->withTenant()
            ->postJson('/api/v1/pharmaco/pos-sessions/open', [
                'branch_id' => $branch->id,
                'opening_mode' => 'fresh_start',
                'starting_cash' => 0,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('session');

        $session = PharmacoPosSession::query()->firstOrFail();
        $this->assertSame('closed', $session->status);
        $this->assertNotNull($session->closed_at);
        $this->assertTrue($session->till_zeroized);
    }

    public function test_current_and_transactions_endpoints_return_session_state(): void
    {
        $this->seed();
        $this->authenticateAdmin();
        [, $branch] = $this->tenantAndBranch();

        $this->withTenant()
            ->getJson('/api/v1/pharmaco/pos-sessions/current')
            ->assertOk()
            ->assertJsonPath('can_open', true)
            ->assertJsonPath('session', null);

        $this->withTenant()
            ->postJson('/api/v1/pharmaco/pos-sessions/open', [
                'branch_id' => $branch->id,
                'opening_mode' => 'handover',
                'starting_cash' => 5000,
            ])
            ->assertCreated();

        $this->withTenant()
            ->getJson('/api/v1/pharmaco/pos-sessions/current')
            ->assertOk()
            ->assertJsonPath('can_open', false)
            ->assertJsonPath('session.status', 'open');

        $this->withTenant()
            ->getJson('/api/v1/pharmaco/pos-sessions/transactions')
            ->assertOk()
            ->assertJsonPath('session.status', 'open')
            ->assertJsonCount(0, 'transactions');
    }

    private function authenticateAdmin(): User
    {
        $user = User::query()
            ->where('email', 'admin@vitapharmaafrica.com')
            ->firstOrFail();

        Sanctum::actingAs($user);

        return $user;
    }

    private function tenantAndBranch(): array
    {
        $tenant = Tenant::query()->where('slug', 'vitapharma')->firstOrFail();
        $branch = Branch::query()
            ->where('tenant_id', $tenant->id)
            ->where('status', 'active')
            ->firstOrFail();

        return [$tenant, $branch];
    }

    private function withTenant(): static
    {
        return $this->withHeader('X-Tenant-Slug', 'vitapharma');
    }
}
