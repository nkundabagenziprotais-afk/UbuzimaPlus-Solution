<?php

namespace Tests\Feature\PharmaCo360;

use App\Models\Branch;
use App\Models\PharmacoSale;
use App\Models\PharmacoSaleItem;
use App\Models\Solution;
use App\Models\StockBatch;
use App\Models\StockMovement;
use App\Models\Tenant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class PharmacoSaleConfirmationApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_tenant_admin_can_confirm_sale_and_deduct_stock_once(): void
    {
        $this->seed();

        $sale = PharmacoSale::with('items')->where('sale_number', 'SALE-VITA-DRAFT-0001')->firstOrFail();
        $payload = $this->confirmationPayloadForSale($sale);

        $tracked = $sale->items->mapWithKeys(function (PharmacoSaleItem $item) use ($payload) {
            $payloadItem = collect($payload['items'])->firstWhere('sale_item_id', $item->id);
            $batch = StockBatch::findOrFail($payloadItem['stock_batch_id']);

            return [
                $item->id => [
                    'batch_id' => $batch->id,
                    'before' => (float) $batch->quantity_on_hand,
                    'quantity' => (float) $item->quantity,
                ],
            ];
        });

        $token = $this->loginAs('admin@vitapharmaafrica.com');

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->postJson("/api/v1/pharmaco/sales/{$sale->id}/confirm", $payload)
            ->assertOk()
            ->assertJsonPath('message', 'Sale confirmed and stock dispensed successfully.')
            ->assertJsonPath('sale.sale_number', 'SALE-VITA-DRAFT-0001')
            ->assertJsonPath('sale.status', 'dispensed')
            ->assertJsonCount(2, 'sale.items');

        $sale->refresh();

        $this->assertSame('dispensed', $sale->status);
        $this->assertTrue((bool) ($sale->metadata['stock_deducted'] ?? false));

        foreach ($sale->items as $item) {
            $tracking = $tracked[$item->id];
            $batch = StockBatch::findOrFail($tracking['batch_id']);

            $this->assertSame($tracking['before'] - $tracking['quantity'], (float) $batch->quantity_on_hand);
            $this->assertSame('dispensed', $item->fresh()->status);
        }

        $this->assertSame(2, StockMovement::where('reference_number', 'SALE-VITA-DRAFT-0001')->where('movement_type', 'sale_dispensed')->count());

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'pharmaco.sale.dispensed',
            'auditable_type' => PharmacoSale::class,
            'auditable_id' => $sale->id,
        ]);
    }

    public function test_prescription_required_item_confirms_with_rx_warning_when_not_verified(): void
    {
        $this->seed();

        $sale = PharmacoSale::with('items')->where('sale_number', 'SALE-VITA-DRAFT-0001')->firstOrFail();

        $item = $sale->items->first();
        $item->requires_prescription = true;
        $item->prescription_verified = false;
        $item->save();

        $payload = $this->confirmationPayloadForSale($sale->fresh('items'));
        $payload['items'] = collect($payload['items'])
            ->map(function (array $payloadItem) use ($item) {
                if ((int) $payloadItem['sale_item_id'] === (int) $item->id) {
                    $payloadItem['prescription_verified'] = false;
                }

                return $payloadItem;
            })
            ->values()
            ->all();

        $token = $this->loginAs('admin@vitapharmaafrica.com');

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->postJson("/api/v1/pharmaco/sales/{$sale->id}/confirm", $payload)
            ->assertOk();

        $freshSale = $sale->fresh();

        $this->assertSame('dispensed', $freshSale->status);
        $this->assertTrue((bool) ($freshSale->metadata['rx_prescription_warning_required'] ?? false));
        $this->assertTrue((bool) ($freshSale->metadata['rx_prescription_warning_acknowledged'] ?? false));
    }

    public function test_insufficient_stock_is_rejected_without_deducting_sale(): void
    {
        $this->seed();

        $sale = PharmacoSale::with('items')->where('sale_number', 'SALE-VITA-DRAFT-0001')->firstOrFail();
        $payload = $this->confirmationPayloadForSale($sale);

        $firstPayloadItem = $payload['items'][0];
        $batch = StockBatch::findOrFail($firstPayloadItem['stock_batch_id']);
        $batch->quantity_on_hand = 0;
        $batch->save();

        $token = $this->loginAs('admin@vitapharmaafrica.com');

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->postJson("/api/v1/pharmaco/sales/{$sale->id}/confirm", $payload)
            ->assertStatus(422)
            ->assertJsonValidationErrors('items');

        $this->assertSame('draft', $sale->fresh()->status);
        $this->assertSame(0, StockMovement::where('reference_number', 'SALE-VITA-DRAFT-0001')->where('movement_type', 'sale_dispensed')->count());
    }

    public function test_confirmed_sale_cannot_be_confirmed_twice(): void
    {
        $this->seed();

        $sale = PharmacoSale::where('sale_number', 'SALE-VITA-DRAFT-0001')->firstOrFail();
        $payload = $this->confirmationPayloadForSale($sale);
        $token = $this->loginAs('admin@vitapharmaafrica.com');

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->postJson("/api/v1/pharmaco/sales/{$sale->id}/confirm", $payload)
            ->assertOk();

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->postJson("/api/v1/pharmaco/sales/{$sale->id}/confirm", $payload)
            ->assertStatus(409);

        $this->assertSame(2, StockMovement::where('reference_number', 'SALE-VITA-DRAFT-0001')->where('movement_type', 'sale_dispensed')->count());
    }

    public function test_sale_confirmation_requires_tenant_header(): void
    {
        $this->seed();

        $sale = PharmacoSale::where('sale_number', 'SALE-VITA-DRAFT-0001')->firstOrFail();
        $payload = $this->confirmationPayloadForSale($sale);
        $token = $this->loginAs('admin@vitapharmaafrica.com');

        $this->withToken($token)
            ->postJson("/api/v1/pharmaco/sales/{$sale->id}/confirm", $payload)
            ->assertStatus(422)
            ->assertJsonPath('required_header', 'X-Tenant-Slug');
    }

    public function test_tenant_admin_cannot_confirm_sale_outside_current_tenant(): void
    {
        $this->seed();

        $otherSale = $this->createOtherTenantSale();
        $token = $this->loginAs('admin@vitapharmaafrica.com');

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->postJson("/api/v1/pharmaco/sales/{$otherSale->id}/confirm", [
                'items' => [],
            ])
            ->assertNotFound();
    }

    private function confirmationPayloadForSale(PharmacoSale $sale): array
    {
        $sale->load('items');

        return [
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
                        'prescription_verified' => (bool) $item->prescription_verified,
                    ];
                })
                ->values()
                ->all(),
        ];
    }

    private function loginAs(string $email): string
    {
        $response = $this->postJson('/api/v1/auth/login', [
            'email' => $email,
            'password' => 'ChangeThisPassword123!',
            'device_name' => 'PharmaCo360 Sale Confirmation API Test Client',
        ]);

        $response->assertOk();

        return $response->json('access_token');
    }

    private function createOtherTenantSale(): PharmacoSale
    {
        $solution = Solution::where('code', 'pharmaco360')->firstOrFail();

        $tenant = Tenant::query()->create([
            'uuid' => (string) Str::uuid(),
            'name' => 'Other Confirmation Pharmacy',
            'slug' => 'other-confirmation-pharmacy-' . Str::lower(Str::random(6)),
            'legal_name' => 'Other Confirmation Pharmacy Ltd',
            'primary_solution_id' => $solution->id,
            'tenant_type' => 'pharmacy',
            'status' => 'active',
        ]);

        $branch = Branch::query()->create([
            'tenant_id' => $tenant->id,
            'name' => 'Other Confirmation Branch',
            'code' => 'OTHER-CONFIRMATION-BRANCH',
            'branch_type' => 'pharmacy',
            'status' => 'active',
        ]);

        return PharmacoSale::query()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $tenant->id,
            'branch_id' => $branch->id,
            'sale_number' => 'OTHER-CONFIRM-' . Str::upper(Str::random(6)),
            'sale_type' => 'cash_sale',
            'status' => 'draft',
            'subtotal_amount' => 1000,
            'discount_amount' => 0,
            'tax_amount' => 0,
            'total_amount' => 1000,
            'paid_amount' => 0,
            'balance_amount' => 1000,
            'payment_status' => 'unpaid',
        ]);
    }
}
