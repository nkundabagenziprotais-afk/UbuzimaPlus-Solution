<?php

namespace Tests\Feature\PharmaCo360;

use App\Models\Branch;
use App\Models\PharmacoPayment;
use App\Models\PharmacoSale;
use App\Models\FinanceJournalEntry;
use App\Models\PharmacoSaleItem;
use App\Models\Solution;
use App\Models\StockBatch;
use App\Models\Tenant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class PharmacoPaymentRecordingApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_tenant_admin_can_record_full_payment_and_generate_receipt(): void
    {
        $this->seed();

        $sale = $this->confirmSeededSale();
        $token = $this->loginAs('admin@vitapharmaafrica.com');

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->postJson("/api/v1/pharmaco/sales/{$sale->id}/payments", [
                'amount' => (float) $sale->fresh()->balance_amount,
                'payment_method' => 'cash',
                'reference_number' => 'CASH-001',
                'notes' => 'Full cash settlement at counter.',
            ])
            ->assertCreated()
            ->assertJsonPath('message', 'Payment recorded successfully.')
            ->assertJsonPath('payment.status', 'completed')
            ->assertJsonPath('payment.payment_method', 'cash')
            ->assertJsonPath('sale.payment_status', 'paid')
            ->assertJsonPath('sale.balance_amount', 0);

        $sale->refresh();

        $this->assertSame('paid', $sale->payment_status);
        $this->assertSame(0.0, (float) $sale->balance_amount);
        $this->assertSame((float) $sale->total_amount, (float) $sale->paid_amount);

        $payment = PharmacoPayment::where('pharmaco_sale_id', $sale->id)->firstOrFail();

        $this->assertNotNull($payment->receipt_number);
        $this->assertStringStartsWith('RCPT-', $payment->receipt_number);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'pharmaco.payment.recorded',
            'auditable_type' => PharmacoPayment::class,
            'auditable_id' => $payment->id,
        ]);
    }

    public function test_successful_payment_creates_shadow_finance_posting(): void
    {
        $this->seed();

        $sale = $this->confirmSeededSale();
        $token = $this->loginAs('admin@vitapharmaafrica.com');

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->postJson("/api/v1/pharmaco/sales/{$sale->id}/payments", [
                'amount' => $sale->total_amount,
                'payment_method' => 'cash',
                'reference_number' => 'SHADOW-FIN-001',
                'generate_receipt' => true,
            ])
            ->assertCreated();

        $payment = $sale->fresh('payments')->payments()->latest('id')->firstOrFail();

        $entry = FinanceJournalEntry::query()
            ->where('tenant_id', $sale->tenant_id)
            ->where('source_module', 'pos')
            ->where('source_type', 'payment')
            ->where('source_id', (string) $payment->id)
            ->where('status', 'shadow_posted')
            ->firstOrFail();

        $expectedBusinessDate = $sale->business_date?->toDateString()
            ?: $payment->received_at?->toDateString()
            ?: now()->toDateString();

        $this->assertSame($expectedBusinessDate, $entry->business_date->toDateString());
        $this->assertSame((float) $payment->amount, (float) $entry->total_debit);
        $this->assertSame((float) $payment->amount, (float) $entry->total_credit);
        $this->assertCount(2, $entry->lines);
    }

    public function test_partial_payment_updates_sale_balance_and_status(): void
    {
        $this->seed();

        $sale = $this->confirmSeededSale();
        $token = $this->loginAs('admin@vitapharmaafrica.com');

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->postJson("/api/v1/pharmaco/sales/{$sale->id}/payments", [
                'amount' => 1000,
                'payment_method' => 'momo',
                'reference_number' => 'MOMO-ABC-001',
            ])
            ->assertCreated()
            ->assertJsonPath('sale.payment_status', 'partially_paid');

        $sale->refresh();

        $this->assertSame('partially_paid', $sale->payment_status);
        $this->assertSame(1000.0, (float) $sale->paid_amount);
        $this->assertSame((float) $sale->total_amount - 1000.0, (float) $sale->balance_amount);
    }

    public function test_payment_amount_cannot_exceed_current_balance(): void
    {
        $this->seed();

        $sale = $this->confirmSeededSale();
        $token = $this->loginAs('admin@vitapharmaafrica.com');

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->postJson("/api/v1/pharmaco/sales/{$sale->id}/payments", [
                'amount' => (float) $sale->fresh()->balance_amount + 1,
                'payment_method' => 'cash',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('amount');

        $this->assertSame('unpaid', $sale->fresh()->payment_status);
        $this->assertSame(0, PharmacoPayment::where('pharmaco_sale_id', $sale->id)->count());
    }

    public function test_payment_cannot_be_recorded_on_draft_sale(): void
    {
        $this->seed();

        $sale = PharmacoSale::where('sale_number', 'SALE-VITA-DRAFT-0001')->firstOrFail();
        $token = $this->loginAs('admin@vitapharmaafrica.com');

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->postJson("/api/v1/pharmaco/sales/{$sale->id}/payments", [
                'amount' => 1000,
                'payment_method' => 'cash',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('sale');

        $this->assertSame('draft', $sale->fresh()->status);
    }

    public function test_payment_recording_requires_tenant_header(): void
    {
        $this->seed();

        $sale = PharmacoSale::where('sale_number', 'SALE-VITA-DRAFT-0001')->firstOrFail();
        $sale->status = 'dispensed';
        $sale->payment_status = 'unpaid';
        $sale->paid_amount = 0;
        $sale->balance_amount = $sale->total_amount;
        $sale->sold_at = now();
        $sale->save();

        $token = $this->loginAs('admin@vitapharmaafrica.com');

        $this->withToken($token)
            ->postJson("/api/v1/pharmaco/sales/{$sale->id}/payments", [
                'amount' => 1000,
                'payment_method' => 'cash',
            ])
            ->assertStatus(422)
            ->assertJsonPath('required_header', 'X-Tenant-Slug');
    }

    public function test_tenant_admin_cannot_record_payment_for_sale_outside_current_tenant(): void
    {
        $this->seed();

        $otherSale = $this->createOtherTenantSale();
        $token = $this->loginAs('admin@vitapharmaafrica.com');

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->postJson("/api/v1/pharmaco/sales/{$otherSale->id}/payments", [
                'amount' => 1000,
                'payment_method' => 'cash',
            ])
            ->assertNotFound();
    }

    private function confirmSeededSale(): PharmacoSale
    {
        $sale = PharmacoSale::with('items')->where('sale_number', 'SALE-VITA-DRAFT-0001')->firstOrFail();
        $token = $this->loginAs('admin@vitapharmaafrica.com');

        $payload = [
            'items' => $sale->items
                ->map(function (PharmacoSaleItem $item): array {
                    $batch = StockBatch::where('tenant_id', $item->tenant_id)
                        ->where('product_id', $item->product_id)
                        ->where('quantity_on_hand', '>', 0)
                        ->orderBy('expiry_date')
                        ->orderBy('id')
                        ->firstOrFail();

                    return [
                        'sale_item_id' => $item->id,
                        'stock_batch_id' => $batch->id,
                        'prescription_verified' => true,
                    ];
                })
                ->values()
                ->all(),
        ];

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->postJson("/api/v1/pharmaco/sales/{$sale->id}/confirm", $payload)
            ->assertOk();

        return $sale->fresh();
    }

    private function loginAs(string $email): string
    {
        $response = $this->postJson('/api/v1/auth/login', [
            'email' => $email,
            'password' => 'ChangeThisPassword123!',
            'device_name' => 'PharmaCo360 Payment API Test Client',
        ]);

        $response->assertOk();

        return $response->json('access_token');
    }

    private function createOtherTenantSale(): PharmacoSale
    {
        $solution = Solution::where('code', 'pharmaco360')->firstOrFail();

        $tenant = Tenant::query()->create([
            'uuid' => (string) Str::uuid(),
            'name' => 'Other Payment Pharmacy',
            'slug' => 'other-payment-pharmacy-' . Str::lower(Str::random(6)),
            'legal_name' => 'Other Payment Pharmacy Ltd',
            'primary_solution_id' => $solution->id,
            'tenant_type' => 'pharmacy',
            'status' => 'active',
        ]);

        $branch = Branch::query()->create([
            'tenant_id' => $tenant->id,
            'name' => 'Other Payment Branch',
            'code' => 'OTHER-PAYMENT-BRANCH',
            'branch_type' => 'pharmacy',
            'status' => 'active',
        ]);

        return PharmacoSale::query()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $tenant->id,
            'branch_id' => $branch->id,
            'sale_number' => 'OTHER-PAYMENT-' . Str::upper(Str::random(6)),
            'sale_type' => 'cash_sale',
            'status' => 'dispensed',
            'subtotal_amount' => 1000,
            'discount_amount' => 0,
            'tax_amount' => 0,
            'total_amount' => 1000,
            'paid_amount' => 0,
            'balance_amount' => 1000,
            'payment_status' => 'unpaid',
        ]);
    }


    public function test_full_payment_can_be_recorded_without_generating_customer_receipt(): void
    {
        $this->seed();

        $sale = $this->confirmSeededSale();
        $token = $this->loginAs('admin@vitapharmaafrica.com');

        $response = $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->postJson("/api/v1/pharmaco/sales/{$sale->id}/payments", [
                'amount' => (float) $sale->fresh()->balance_amount,
                'payment_method' => 'cash',
                'generate_receipt' => false,
                'reference_number' => 'CASH-001',
                'notes' => 'Full cash settlement at counter.',
            ])
            ->assertCreated()
            ->assertJsonPath('message', 'Payment recorded successfully.')
            ->assertJsonPath('payment.status', 'completed')
            ->assertJsonPath('payment.payment_method', 'cash')
            ->assertJsonPath('sale.payment_status', 'paid')
            ->assertJsonPath('sale.balance_amount', 0);

        $sale->refresh();

        $this->assertSame('paid', $sale->payment_status);
        $this->assertSame(0.0, (float) $sale->balance_amount);
        $this->assertSame((float) $sale->total_amount, (float) $sale->paid_amount);

        $payment = PharmacoPayment::where('pharmaco_sale_id', $sale->id)->firstOrFail();

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'pharmaco.payment.recorded',
            'auditable_type' => PharmacoPayment::class,
            'auditable_id' => $payment->id,
        ]);

        $response->assertJsonPath(
            'payment.receipt_number',
            null
        );

        $this->assertDatabaseHas('pharmaco_payments', [
            'id' => $response->json('payment.id'),
            'receipt_number' => null,
        ]);
}
}
