<?php

namespace Tests\Feature\PharmaCo360;

use App\Models\PharmacoCustomer;
use App\Models\PharmacoCustomerReceivable;
use App\Models\Solution;
use App\Models\Tenant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class PharmacoCustomerReceivablesApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_tenant_admin_can_update_customer_credit_profile(): void
    {
        $this->seed();

        $token = $this->loginAs('admin@vitapharmaafrica.com');
        $customer = $this->customer();

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->patchJson("/api/v1/pharmaco/customers/{$customer->id}/credit", [
                'credit_limit' => 50000,
                'credit_terms_days' => 30,
                'credit_status' => 'enabled',
            ])
            ->assertOk()
            ->assertJsonPath('message', 'Customer credit profile updated successfully.')
            ->assertJsonPath('customer.credit_limit', 50000)
            ->assertJsonPath('customer.credit_status', 'enabled');

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'pharmaco.customer_credit.updated',
            'auditable_type' => PharmacoCustomer::class,
            'auditable_id' => $customer->id,
        ]);
    }

    public function test_tenant_admin_can_create_customer_receivable_within_credit_limit(): void
    {
        $this->seed();

        $token = $this->loginAs('admin@vitapharmaafrica.com');
        $customer = $this->enableCredit(limit: 50000);

        $response = $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->postJson('/api/v1/pharmaco/receivables', [
                'pharmaco_customer_id' => $customer->id,
                'amount' => 12000,
                'due_date' => now()->addDays(30)->toDateString(),
                'notes' => 'Credit sale for follow-up.',
            ])
            ->assertCreated()
            ->assertJsonPath('message', 'Customer receivable created successfully.')
            ->assertJsonPath('receivable.status', 'open')
            ->assertJsonPath('receivable.original_amount', 12000)
            ->assertJsonPath('receivable.balance_amount', 12000);

        $receivableId = $response->json('receivable.id');

        $customer->refresh();

        $this->assertSame(12000.0, (float) $customer->credit_balance);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'pharmaco.customer_receivable.created',
            'auditable_type' => PharmacoCustomerReceivable::class,
            'auditable_id' => $receivableId,
        ]);
    }

    public function test_receivable_creation_rejects_disabled_credit_customer(): void
    {
        $this->seed();

        $token = $this->loginAs('admin@vitapharmaafrica.com');
        $customer = $this->customer();

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->postJson('/api/v1/pharmaco/receivables', [
                'pharmaco_customer_id' => $customer->id,
                'amount' => 12000,
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('pharmaco_customer_id');
    }

    public function test_receivable_creation_rejects_amount_above_credit_limit(): void
    {
        $this->seed();

        $token = $this->loginAs('admin@vitapharmaafrica.com');
        $customer = $this->enableCredit(limit: 5000);

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->postJson('/api/v1/pharmaco/receivables', [
                'pharmaco_customer_id' => $customer->id,
                'amount' => 12000,
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('amount');
    }

    public function test_tenant_admin_can_record_partial_and_full_receivable_payment(): void
    {
        $this->seed();

        $token = $this->loginAs('admin@vitapharmaafrica.com');
        $customer = $this->enableCredit(limit: 50000);
        $receivable = $this->createReceivable($customer, amount: 20000);

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->postJson("/api/v1/pharmaco/receivables/{$receivable->id}/payments", [
                'amount' => 5000,
                'payment_method' => 'momo',
                'reference_number' => 'MOMO-AR-001',
            ])
            ->assertCreated()
            ->assertJsonPath('message', 'Customer receivable payment recorded successfully.')
            ->assertJsonPath('receivable.status', 'partially_collected')
            ->assertJsonPath('receivable.balance_amount', 15000);

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->postJson("/api/v1/pharmaco/receivables/{$receivable->id}/payments", [
                'amount' => 15000,
                'payment_method' => 'bank_transfer',
                'reference_number' => 'BANK-AR-002',
            ])
            ->assertCreated()
            ->assertJsonPath('receivable.status', 'collected')
            ->assertJsonPath('receivable.balance_amount', 0);

        $customer->refresh();

        $this->assertSame(0.0, (float) $customer->credit_balance);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'pharmaco.customer_receivable.payment_recorded',
        ]);
    }

    public function test_receivable_payment_cannot_exceed_balance(): void
    {
        $this->seed();

        $token = $this->loginAs('admin@vitapharmaafrica.com');
        $customer = $this->enableCredit(limit: 50000);
        $receivable = $this->createReceivable($customer, amount: 10000);

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->postJson("/api/v1/pharmaco/receivables/{$receivable->id}/payments", [
                'amount' => 11000,
                'payment_method' => 'cash',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('amount');

        $receivable->refresh();

        $this->assertSame(10000.0, (float) $receivable->balance_amount);
    }

    public function test_tenant_admin_can_view_receivable_detail(): void
    {
        $this->seed();

        $token = $this->loginAs('admin@vitapharmaafrica.com');
        $customer = $this->enableCredit(limit: 50000);
        $receivable = $this->createReceivable($customer, amount: 10000);

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->getJson("/api/v1/pharmaco/receivables/{$receivable->id}")
            ->assertOk()
            ->assertJsonPath('receivable.id', $receivable->id)
            ->assertJsonStructure([
                'receivable' => [
                    'id',
                    'receivable_number',
                    'status',
                    'customer',
                    'payments',
                ],
            ]);
    }

    public function test_receivables_require_tenant_header(): void
    {
        $this->seed();

        $token = $this->loginAs('admin@vitapharmaafrica.com');

        $this->withToken($token)
            ->getJson('/api/v1/pharmaco/receivables')
            ->assertStatus(422);
    }

    public function test_tenant_admin_cannot_access_receivable_outside_current_tenant(): void
    {
        $this->seed();

        $token = $this->loginAs('admin@vitapharmaafrica.com');
        $otherReceivable = $this->createOtherTenantReceivable();

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->getJson("/api/v1/pharmaco/receivables/{$otherReceivable->id}")
            ->assertNotFound();
    }

    private function tenant(): Tenant
    {
        return Tenant::where('slug', 'vitapharma')->firstOrFail();
    }

    private function customer(): PharmacoCustomer
    {
        return PharmacoCustomer::where('tenant_id', $this->tenant()->id)->firstOrFail();
    }

    private function enableCredit(float $limit): PharmacoCustomer
    {
        $customer = $this->customer();

        $customer->update([
            'credit_limit' => $limit,
            'credit_balance' => 0,
            'credit_terms_days' => 30,
            'credit_status' => 'enabled',
        ]);

        return $customer->fresh();
    }

    private function createReceivable(PharmacoCustomer $customer, float $amount): PharmacoCustomerReceivable
    {
        $receivable = PharmacoCustomerReceivable::query()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $customer->tenant_id,
            'pharmaco_customer_id' => $customer->id,
            'receivable_number' => 'AR-TEST-' . Str::upper(Str::random(6)),
            'status' => 'open',
            'original_amount' => $amount,
            'paid_amount' => 0,
            'balance_amount' => $amount,
            'issued_at' => now()->toDateString(),
            'due_date' => now()->addDays(30)->toDateString(),
        ]);

        $customer->credit_balance = (float) $customer->credit_balance + $amount;
        $customer->save();

        return $receivable;
    }

    private function createOtherTenantReceivable(): PharmacoCustomerReceivable
    {
        $solution = Solution::where('code', 'pharmaco360')->firstOrFail();

        $tenant = Tenant::query()->create([
            'uuid' => (string) Str::uuid(),
            'name' => 'Other Receivables Pharmacy',
            'slug' => 'other-receivables-' . Str::lower(Str::random(6)),
            'legal_name' => 'Other Receivables Pharmacy Ltd',
            'primary_solution_id' => $solution->id,
            'tenant_type' => 'pharmacy',
            'status' => 'active',
        ]);

        $customer = PharmacoCustomer::query()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $tenant->id,
            'customer_code' => 'OTHER-CUST-' . Str::upper(Str::random(6)),
            'first_name' => 'Other',
            'last_name' => 'Customer',
            'phone' => '0788' . random_int(100000, 999999),
            'status' => 'active',
            'credit_limit' => 10000,
            'credit_balance' => 1000,
            'credit_terms_days' => 30,
            'credit_status' => 'enabled',
        ]);

        return PharmacoCustomerReceivable::query()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $tenant->id,
            'pharmaco_customer_id' => $customer->id,
            'receivable_number' => 'OTHER-AR-' . Str::upper(Str::random(6)),
            'status' => 'open',
            'original_amount' => 1000,
            'paid_amount' => 0,
            'balance_amount' => 1000,
            'issued_at' => now()->toDateString(),
            'due_date' => now()->addDays(30)->toDateString(),
        ]);
    }

    private function loginAs(string $email): string
    {
        $response = $this->postJson('/api/v1/auth/login', [
            'email' => $email,
            'password' => 'ChangeThisPassword123!',
            'device_name' => 'PharmaCo360 Receivables Test Client',
        ]);

        $response->assertOk();

        return $response->json('access_token');
    }
}
