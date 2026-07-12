<?php

namespace Tests\Feature\PharmaCo360;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PharmacoGeneralItemsApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_general_items_operational_flow(): void
    {
        $this->seed();

        $token = $this->loginAs(
            'admin@vitapharmaafrica.com'
        );

        $headers = [
            'Authorization' =>
                'Bearer ' . $token,
        ];

        $category = $this
            ->withHeaders($headers)
            ->postJson(
                '/api/v1/tenants/vitapharma/'
                . 'pharmaco360/general-items/'
                . 'categories',
                [
                    'code' => 'office',
                    'name' =>
                        'Office Supplies',
                    'description' =>
                        'Operational office items',
                ]
            )
            ->assertCreated()
            ->json('category');

        $item = $this
            ->withHeaders($headers)
            ->postJson(
                '/api/v1/tenants/vitapharma/'
                . 'pharmaco360/general-items/items',
                [
                    'category_id' =>
                        $category['id'],
                    'code' => 'paper-a4',
                    'name' => 'A4 Paper',
                    'description' =>
                        'Standard printing paper',
                    'unit_of_measure' =>
                        'ream',
                    'track_stock' => true,
                    'minimum_stock_level' =>
                        5,
                    'reorder_quantity' =>
                        10,
                    'standard_unit_cost' =>
                        6500,
                ]
            )
            ->assertCreated()
            ->json('item');

        $location = $this
            ->withHeaders($headers)
            ->postJson(
                '/api/v1/tenants/vitapharma/'
                . 'pharmaco360/general-items/'
                . 'locations',
                [
                    'code' => 'main-store',
                    'name' => 'Main Store',
                ]
            )
            ->assertCreated()
            ->json('location');

        $this
            ->withHeaders($headers)
            ->postJson(
                '/api/v1/tenants/vitapharma/'
                . 'pharmaco360/general-items/'
                . 'receiving',
                [
                    'item_id' => $item['id'],
                    'location_id' =>
                        $location['id'],
                    'quantity' => 20,
                    'unit_cost' => 6500,
                    'reference' => 'GRN-001',
                ]
            )
            ->assertCreated();

        $this
            ->withHeaders($headers)
            ->postJson(
                '/api/v1/tenants/vitapharma/'
                . 'pharmaco360/general-items/usage',
                [
                    'item_id' => $item['id'],
                    'location_id' =>
                        $location['id'],
                    'quantity' => 3,
                    'department' =>
                        'Administration',
                    'reference' => 'ISS-001',
                ]
            )
            ->assertCreated();

        $this
            ->withHeaders($headers)
            ->getJson(
                '/api/v1/tenants/vitapharma/'
                . 'pharmaco360/general-items/stock'
            )
            ->assertOk()
            ->assertJsonPath(
                'stock.0.quantity_on_hand',
                17
            );

        $this
            ->withHeaders($headers)
            ->getJson(
                '/api/v1/tenants/vitapharma/'
                . 'pharmaco360/general-items/'
                . 'overview'
            )
            ->assertOk()
            ->assertJsonPath(
                'summary.category_count',
                1
            )
            ->assertJsonPath(
                'summary.item_count',
                1
            )
            ->assertJsonPath(
                'summary.location_count',
                1
            )
            ->assertJsonCount(
                2,
                'recent_movements'
            );
    }

private function loginAs(string $email): string
    {
        $response = $this->postJson('/api/v1/auth/login', [
            'email' => $email,
            'password' => 'ChangeThisPassword123!',
            'device_name' => 'PharmaCo360 Reporting Test Client',
        ]);

        $response->assertOk();

        return $response->json('access_token');
    }
}
