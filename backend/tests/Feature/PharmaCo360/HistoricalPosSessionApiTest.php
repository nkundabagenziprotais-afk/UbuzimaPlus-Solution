<?php

namespace Tests\Feature\PharmaCo360;

use App\Models\Branch;
use App\Models\PharmacoHistoricalPosApproval;
use App\Models\PharmacoPosSession;
use App\Models\PharmacoSale;
use App\Models\Tenant;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class HistoricalPosSessionApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_historical_session_opens_without_code_when_no_live_activity(): void
    {
        $this->seed();

        $token = $this->login();
        $tenant = $this->tenant();
        $branch = $this->branch($tenant);

        $businessDate = CarbonImmutable::now(
            'Africa/Kigali'
        )->subDays(10)->toDateString();

        $response = $this->openHistoricalSession(
            $token,
            $branch,
            $businessDate,
            [
                'opening_float_amount' => 5000,
                'historical_reason' =>
                    'Paper sales from this date require entry.',
                'historical_reference' =>
                    'REGISTER-NO-CONFLICT',
            ]
        )
            ->assertCreated()
            ->assertJsonPath(
                'session.session_mode',
                'historical'
            )
            ->assertJsonPath(
                'session.business_date',
                $businessDate
            )
            ->assertJsonPath(
                'session.status',
                'open'
            )
            ->assertJsonPath(
                'session.historical_approval_id',
                null
            )
            ->assertJsonPath(
                'session.expected_cash_amount',
                5000
            );

        $sessionId = $response->json('session.id');

        $this->assertDatabaseHas(
            'pharmaco_pos_sessions',
            [
                'id' => $sessionId,
                'tenant_id' => $tenant->id,
                'branch_id' => $branch->id,
                'session_mode' => 'historical',
                'status' => 'open',
                'historical_approval_id' => null,
            ]
        );

        /*
         * Database storage differs between SQLite and MySQL.
         * Validate the date through the model's date cast.
         */
        $storedSession =
            PharmacoPosSession::query()
                ->findOrFail($sessionId);

        $this->assertSame(
            $businessDate,
            $storedSession->business_date
                ->toDateString()
        );

        $this->assertDatabaseHas(
            'pharmaco_pos_clock_events',
            [
                'pos_session_id' => $sessionId,
                'event_type' => 'clock_in',
            ]
        );

        $this->tenantRequest($token)
            ->getJson(
                '/api/v1/pharmaco/pos/'
                . 'historical/session/current'
                . '?business_date='
                . $businessDate
            )
            ->assertOk()
            ->assertJsonPath(
                'session.id',
                $sessionId
            )
            ->assertJsonPath(
                'session.session_mode',
                'historical'
            );

        $this->assertDatabaseHas(
            'audit_logs',
            [
                'action' =>
                    'pharmaco.pos.historical.'
                    . 'session.opened',
                'auditable_id' => $sessionId,
            ]
        );
    }

    public function test_approved_code_is_consumed_when_live_activity_exists(): void
    {
        $this->seed();

        $token = $this->login();
        $tenant = $this->tenant();
        $branch = $this->branch($tenant);

        $businessDate = CarbonImmutable::now(
            'Africa/Kigali'
        )->subDays(6)->toDateString();

        $this->createLiveSale(
            $tenant,
            $branch,
            $businessDate,
            7500
        );

        [$approvalId, $approvalCode] =
            $this->requestAndApprove(
                $token,
                $branch,
                $businessDate
            );

        $response = $this->openHistoricalSession(
            $token,
            $branch,
            $businessDate,
            [
                'opening_float_amount' => 2500,
                'historical_reason' =>
                    'Late paper transactions require entry '
                    . 'after the live trading day.',
                'historical_reference' =>
                    'REGISTER-WITH-CONFLICT',
                'approval_id' => $approvalId,
                'approval_code' => $approvalCode,
            ]
        )
            ->assertCreated()
            ->assertJsonPath(
                'session.session_mode',
                'historical'
            )
            ->assertJsonPath(
                'session.historical_approval_id',
                $approvalId
            );

        $sessionId = $response->json('session.id');

        $approval =
            PharmacoHistoricalPosApproval::query()
                ->findOrFail($approvalId);

        $this->assertSame(
            'used',
            $approval->status
        );

        $this->assertNotNull(
            $approval->used_at
        );

        $this->assertNull(
            $approval->approval_code_hash
        );

        $this->assertSame(
            $sessionId,
            $approval->metadata[
                'used_by_session_id'
            ]
        );

        $session =
            PharmacoPosSession::query()
                ->findOrFail($sessionId);

        $this->assertSame(
            $businessDate,
            $session->business_date
                ->toDateString()
        );

        $this->assertSame(
            $approvalId,
            $session->historical_approval_id
        );
    }

    public function test_code_is_locked_after_three_failed_attempts(): void
    {
        $this->seed();

        $token = $this->login();
        $tenant = $this->tenant();
        $branch = $this->branch($tenant);

        $businessDate = CarbonImmutable::now(
            'Africa/Kigali'
        )->subDays(7)->toDateString();

        $this->createLiveSale(
            $tenant,
            $branch,
            $businessDate,
            3000
        );

        [$approvalId] = $this->requestAndApprove(
            $token,
            $branch,
            $businessDate
        );

        for ($attempt = 1; $attempt <= 3; $attempt++) {
            $this->openHistoricalSession(
                $token,
                $branch,
                $businessDate,
                [
                    'opening_float_amount' => 0,
                    'historical_reason' =>
                        'Failed code attempt enforcement test.',
                    'approval_id' => $approvalId,
                    'approval_code' => '000000',
                ]
            )
                ->assertStatus(422)
                ->assertJsonValidationErrors(
                    'approval_code'
                );
        }

        $approval =
            PharmacoHistoricalPosApproval::query()
                ->findOrFail($approvalId);

        $this->assertSame(
            3,
            $approval->failed_attempts
        );

        $this->assertSame(
            'expired',
            $approval->status
        );

        $this->assertNull(
            $approval->approval_code_hash
        );

        $this->assertDatabaseCount(
            'pharmaco_pos_sessions',
            0
        );

        $this->assertDatabaseHas(
            'audit_logs',
            [
                'action' =>
                    'pharmaco.pos.historical.'
                    . 'approval.code_failed',
                'auditable_id' => $approvalId,
            ]
        );
    }

    public function test_historical_session_cannot_open_while_another_session_is_active(): void
    {
        $this->seed();

        $token = $this->login();
        $tenant = $this->tenant();
        $branch = $this->branch($tenant);

        $firstDate = CarbonImmutable::now(
            'Africa/Kigali'
        )->subDays(12)->toDateString();

        $secondDate = CarbonImmutable::now(
            'Africa/Kigali'
        )->subDays(11)->toDateString();

        $this->openHistoricalSession(
            $token,
            $branch,
            $firstDate,
            [
                'opening_float_amount' => 0,
                'historical_reason' =>
                    'First active historical session.',
            ]
        )->assertCreated();

        $this->openHistoricalSession(
            $token,
            $branch,
            $secondDate,
            [
                'opening_float_amount' => 0,
                'historical_reason' =>
                    'Second historical session must be blocked.',
            ]
        )
            ->assertStatus(422)
            ->assertJsonValidationErrors(
                'session'
            );

        $this->assertDatabaseCount(
            'pharmaco_pos_sessions',
            1
        );
    }

    private function createLiveSale(
        Tenant $tenant,
        Branch $branch,
        string $businessDate,
        float $total
    ): PharmacoSale {
        $user = User::query()
            ->where(
                'email',
                'admin@vitapharmaafrica.com'
            )
            ->firstOrFail();

        return PharmacoSale::query()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $tenant->id,
            'branch_id' => $branch->id,
            'sale_number' =>
                'TEST-HIST-'
                . Str::upper(Str::random(10)),
            'sale_type' => 'cash_sale',
            'status' => 'dispensed',
            'subtotal_amount' => $total,
            'discount_amount' => 0,
            'tax_amount' => 0,
            'total_amount' => $total,
            'paid_amount' => $total,
            'balance_amount' => 0,
            'payment_status' => 'paid',
            'sold_by' => $user->id,
            'sold_at' => CarbonImmutable::parse(
                $businessDate,
                'Africa/Kigali'
            )->setTime(10, 30),
            'entry_mode' => 'live',
            'business_date' => $businessDate,
        ]);
    }

    private function requestAndApprove(
        string $token,
        Branch $branch,
        string $businessDate
    ): array {
        $request = $this->tenantRequest($token)
            ->postJson(
                '/api/v1/pharmaco/pos/'
                . 'historical/approvals',
                [
                    'branch_id' => $branch->id,
                    'business_date' =>
                        $businessDate,
                    'request_reason' =>
                        'Paper records require controlled '
                        . 'historical entry.',
                    'historical_reference' =>
                        'SESSION-OPEN-TEST',
                ]
            )
            ->assertCreated();

        $approvalId = $request->json(
            'approval.id'
        );

        $approved = $this->tenantRequest($token)
            ->postJson(
                '/api/v1/pharmaco/pos/'
                . 'historical/approvals/'
                . $approvalId
                . '/approve',
                [
                    'decision_notes' =>
                        'Paper register reviewed and approved.',
                ]
            )
            ->assertOk();

        return [
            $approvalId,
            (string) $approved->json(
                'approval_code'
            ),
        ];
    }

    private function openHistoricalSession(
        string $token,
        Branch $branch,
        string $businessDate,
        array $overrides = []
    ) {
        return $this->tenantRequest($token)
            ->postJson(
                '/api/v1/pharmaco/pos/'
                . 'historical/session/open',
                array_merge(
                    [
                        'branch_id' => $branch->id,
                        'business_date' =>
                            $businessDate,
                        'opening_float_amount' => 0,
                        'opening_mode' =>
                            'fresh-start',
                        'historical_reason' =>
                            'Historical transaction entry.',
                    ],
                    $overrides
                )
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
