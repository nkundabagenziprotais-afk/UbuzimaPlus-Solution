<?php

namespace Tests\Feature\PharmaCo360;

use App\Models\Branch;
use App\Models\PharmacoHistoricalPosApproval;
use App\Models\PharmacoSale;
use App\Models\Tenant;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class HistoricalPosApprovalApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_live_activity_requires_approval(): void
    {
        $this->seed();

        $token = $this->login();
        $tenant = $this->tenant();
        $branch = $this->branch($tenant);

        $businessDate = CarbonImmutable::now(
            'Africa/Kigali'
        )->subDay()->toDateString();

        $this->tenantRequest($token)
            ->getJson(
                '/api/v1/pharmaco/pos/'
                . 'historical/availability'
                . '?branch_id='
                . $branch->id
                . '&business_date='
                . $businessDate
            )
            ->assertOk()
            ->assertJsonPath(
                'approval_required',
                false
            )
            ->assertJsonPath(
                'live_activity_exists',
                false
            );

        $user = User::query()
            ->where(
                'email',
                'admin@vitapharmaafrica.com'
            )
            ->firstOrFail();

        PharmacoSale::query()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $tenant->id,
            'branch_id' => $branch->id,
            'sale_number' =>
                'TEST-HISTORICAL-LIVE-001',
            'sale_type' => 'cash_sale',
            'status' => 'dispensed',
            'subtotal_amount' => 5000,
            'discount_amount' => 0,
            'tax_amount' => 0,
            'total_amount' => 5000,
            'paid_amount' => 5000,
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

        $this->tenantRequest($token)
            ->getJson(
                '/api/v1/pharmaco/pos/'
                . 'historical/availability'
                . '?branch_id='
                . $branch->id
                . '&business_date='
                . $businessDate
            )
            ->assertOk()
            ->assertJsonPath(
                'approval_required',
                true
            )
            ->assertJsonPath(
                'live_activity_exists',
                true
            )
            ->assertJsonPath(
                'live_activity_count',
                1
            )
            ->assertJsonPath(
                'live_activity_total',
                5000
            )
            ->assertJsonPath(
                'approval_rule',
                'admin_or_owner_code_required'
            );

        $response = $this->tenantRequest($token)
            ->postJson(
                '/api/v1/pharmaco/pos/'
                . 'historical/approvals',
                [
                    'branch_id' => $branch->id,
                    'business_date' =>
                        $businessDate,
                    'request_reason' =>
                        'Paper transactions were not '
                        . 'entered on the original day.',
                    'historical_reference' =>
                        'PAPER-BOOK-001',
                ]
            )
            ->assertCreated()
            ->assertJsonPath(
                'approval.status',
                'pending'
            )
            ->assertJsonPath(
                'approval.live_activity_count',
                1
            );

        $approvalId = $response->json(
            'approval.id'
        );

        $this->assertDatabaseHas(
            'audit_logs',
            [
                'action' =>
                    'pharmaco.pos.historical.'
                    . 'approval.requested',
                'auditable_type' =>
                    PharmacoHistoricalPosApproval::class,
                'auditable_id' => $approvalId,
            ]
        );

        $approved = $this->tenantRequest($token)
            ->postJson(
                '/api/v1/pharmaco/pos/'
                . 'historical/approvals/'
                . $approvalId
                . '/approve',
                [
                    'decision_notes' =>
                        'The supporting register '
                        . 'was reviewed.',
                ]
            )
            ->assertOk()
            ->assertJsonPath(
                'approval.status',
                'approved'
            );

        $plainCode = (string) $approved->json(
            'approval_code'
        );

        $this->assertMatchesRegularExpression(
            '/^\d{6}$/',
            $plainCode
        );

        $approval =
            PharmacoHistoricalPosApproval::query()
                ->findOrFail($approvalId);

        $this->assertNotSame(
            $plainCode,
            $approval->approval_code_hash
        );

        $this->assertTrue(
            Hash::check(
                $plainCode,
                $approval->approval_code_hash
            )
        );

        $this->assertNotNull(
            $approval->expires_at
        );

        $this->assertTrue(
            $approval->expires_at->isFuture()
        );

        $this->assertDatabaseHas(
            'audit_logs',
            [
                'action' =>
                    'pharmaco.pos.historical.'
                    . 'approval.approved',
                'auditable_type' =>
                    PharmacoHistoricalPosApproval::class,
                'auditable_id' => $approvalId,
            ]
        );
    }

    public function test_today_is_not_historical(): void
    {
        $this->seed();

        $token = $this->login();
        $tenant = $this->tenant();
        $branch = $this->branch($tenant);

        $today = CarbonImmutable::now(
            'Africa/Kigali'
        )->toDateString();

        $this->tenantRequest($token)
            ->getJson(
                '/api/v1/pharmaco/pos/'
                . 'historical/availability'
                . '?branch_id='
                . $branch->id
                . '&business_date='
                . $today
            )
            ->assertStatus(422)
            ->assertJsonValidationErrors(
                'business_date'
            );
    }

    public function test_request_is_rejected_without_conflict(): void
    {
        $this->seed();

        $token = $this->login();
        $tenant = $this->tenant();
        $branch = $this->branch($tenant);

        $businessDate = CarbonImmutable::now(
            'Africa/Kigali'
        )->subDays(2)->toDateString();

        $this->tenantRequest($token)
            ->postJson(
                '/api/v1/pharmaco/pos/'
                . 'historical/approvals',
                [
                    'branch_id' => $branch->id,
                    'business_date' =>
                        $businessDate,
                    'request_reason' =>
                        'Historical record entry test.',
                ]
            )
            ->assertStatus(422)
            ->assertJsonValidationErrors(
                'business_date'
            );

        $this->assertDatabaseCount(
            'pharmaco_pos_historical_approvals',
            0
        );
    }

    public function test_pending_request_can_be_rejected(): void
    {
        $this->seed();

        $token = $this->login();
        $tenant = $this->tenant();
        $branch = $this->branch($tenant);

        $businessDate = CarbonImmutable::now(
            'Africa/Kigali'
        )->subDays(3)->toDateString();

        $user = User::query()
            ->where(
                'email',
                'admin@vitapharmaafrica.com'
            )
            ->firstOrFail();

        PharmacoSale::query()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $tenant->id,
            'branch_id' => $branch->id,
            'sale_number' =>
                'TEST-HISTORICAL-LIVE-REJECT',
            'sale_type' => 'cash_sale',
            'status' => 'dispensed',
            'subtotal_amount' => 2500,
            'discount_amount' => 0,
            'tax_amount' => 0,
            'total_amount' => 2500,
            'paid_amount' => 2500,
            'balance_amount' => 0,
            'payment_status' => 'paid',
            'sold_by' => $user->id,
            'sold_at' => CarbonImmutable::parse(
                $businessDate,
                'Africa/Kigali'
            )->setTime(11, 15),
            'entry_mode' => 'live',
            'business_date' => $businessDate,
        ]);

        $request = $this->tenantRequest($token)
            ->postJson(
                '/api/v1/pharmaco/pos/'
                . 'historical/approvals',
                [
                    'branch_id' => $branch->id,
                    'business_date' =>
                        $businessDate,
                    'request_reason' =>
                        'Historical rejection workflow test.',
                ]
            )
            ->assertCreated();

        $approvalId = $request->json(
            'approval.id'
        );

        $this->tenantRequest($token)
            ->postJson(
                '/api/v1/pharmaco/pos/'
                . 'historical/approvals/'
                . $approvalId
                . '/reject',
                [
                    'decision_notes' =>
                        'Supporting records were incomplete.',
                ]
            )
            ->assertOk()
            ->assertJsonPath(
                'approval.status',
                'rejected'
            );

        $this->assertDatabaseHas(
            'pharmaco_pos_historical_approvals',
            [
                'id' => $approvalId,
                'status' => 'rejected',
                'approval_code_hash' => null,
            ]
        );

        $this->assertDatabaseHas(
            'audit_logs',
            [
                'action' =>
                    'pharmaco.pos.historical.'
                    . 'approval.rejected',
                'auditable_type' =>
                    PharmacoHistoricalPosApproval::class,
                'auditable_id' => $approvalId,
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
