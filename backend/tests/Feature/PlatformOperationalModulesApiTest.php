<?php

namespace Tests\Feature;

use App\Models\AiRecommendation;
use App\Models\PharmacistChatConversation;
use App\Models\Product;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PlatformOperationalModulesApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_tenant_admin_can_bulk_import_and_bulk_action_products(): void
    {
        $this->seed();

        $token = $this->loginAs('admin@vitapharmaafrica.com');

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->postJson('/api/v1/pharmaco/products/bulk-import', [
                'mode' => 'upsert',
                'rows' => [
                    [
                        'name' => 'Vitamin C 500mg Tablets',
                        'sku' => 'VITC-500-TAB',
                        'unit' => 'tablet',
                        'product_type' => 'medicine',
                        'regulatory_status' => 'pending',
                        'reorder_level' => 10,
                    ],
                ],
            ])
            ->assertOk()
            ->assertJsonPath('bulk_operation.processed_rows', 1);

        $product = Product::where('sku', 'VITC-500-TAB')->firstOrFail();

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->postJson('/api/v1/pharmaco/products/bulk-action', [
                'ids' => [$product->id],
                'action' => 'approve',
            ])
            ->assertOk()
            ->assertJsonPath('bulk_operation.processed_rows', 1);

        $this->assertDatabaseHas('products', [
            'sku' => 'VITC-500-TAB',
            'regulatory_status' => 'approved',
            'status' => 'active',
        ]);
    }

    public function test_corporate_mail_overview_and_send_are_available(): void
    {
        $this->seed();

        $token = $this->loginAs('admin@vitapharmaafrica.com');

        $this->withToken($token)
            ->getJson('/api/v1/corporate-mail/overview')
            ->assertOk()
            ->assertJsonPath('account.status', 'active')
            ->assertJsonFragment(['folder_key' => 'inbox']);

        $this->withToken($token)
            ->postJson('/api/v1/corporate-mail/messages', [
                'to' => ['info@ubuzimaplus.com'],
                'subject' => 'Pilot onboarding',
                'body' => 'Please prepare the first tenant onboarding checklist.',
            ])
            ->assertCreated()
            ->assertJsonPath('mail_message.direction', 'outbound');
    }

    public function test_mobile_chat_can_be_received_and_replied_by_staff(): void
    {
        $this->seed();

        $conversationResponse = $this->postJson('/api/v1/mobile/pharmacist-chat/conversations', [
            'tenant_slug' => 'vitapharma',
            'customer_name' => 'Aline',
            'customer_phone' => '+250788000000',
            'message' => 'Can I take this medicine after food?',
        ])->assertCreated();

        $conversation = PharmacistChatConversation::where('uuid', $conversationResponse->json('conversation.uuid'))->firstOrFail();
        $token = $this->loginAs('admin@vitapharmaafrica.com');

        $this->withToken($token)
            ->getJson('/api/v1/pharmacist-chat/conversations')
            ->assertOk()
            ->assertJsonFragment(['uuid' => $conversation->uuid]);

        $this->withToken($token)
            ->postJson("/api/v1/pharmacist-chat/conversations/{$conversation->uuid}/messages", [
                'body' => 'Please follow the label instructions and contact the pharmacy if symptoms continue.',
            ])
            ->assertCreated()
            ->assertJsonPath('chat_message.sender_type', 'pharmacist');
    }

    public function test_ai_center_defaults_generate_and_update_recommendations(): void
    {
        $this->seed();

        $token = $this->loginAs('admin@vitapharmaafrica.com');

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->postJson('/api/v1/ai-center/activate-defaults')
            ->assertOk()
            ->assertJsonPath('models_count', 10);

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->postJson('/api/v1/ai-center/recommendations/inventory/generate')
            ->assertOk();

        $recommendation = AiRecommendation::whereNotNull('tenant_id')->first();

        if ($recommendation) {
            $this->withHeader('X-Tenant-Slug', 'vitapharma')
                ->withToken($token)
                ->patchJson("/api/v1/ai-center/recommendations/{$recommendation->id}", [
                    'status' => 'approved',
                ])
                ->assertOk()
                ->assertJsonPath('recommendation.status', 'approved');
        }
    }

    public function test_platform_admin_can_view_data_layer_and_run_guarded_sql(): void
    {
        $this->seed();

        $token = $this->loginAs('admin@ubuzimaplus.local');

        $this->withToken($token)
            ->getJson('/api/v1/admin/data-layer/schema')
            ->assertOk()
            ->assertJsonFragment(['name' => 'products']);

        $this->withToken($token)
            ->postJson('/api/v1/admin/data-layer/sql', [
                'sql' => 'select sku, name from products limit 2',
            ])
            ->assertOk()
            ->assertJsonPath('results.0.type', 'select');

        $this->withToken($token)
            ->postJson('/api/v1/admin/data-layer/sql', [
                'sql' => 'drop table products',
            ])
            ->assertStatus(422);
    }

    public function test_market_localization_nearby_and_notifications_are_operational(): void
    {
        $this->seed();

        $this->getJson('/api/v1/localization/context?country_code=RW')
            ->assertOk()
            ->assertJsonPath('selected_language', 'en')
            ->assertJsonPath('market.code', 'RW');

        $this->getJson('/api/v1/nearby/providers?market_code=RW&latitude=-1.9441&longitude=30.0619&provider_type=retail_pharmacy')
            ->assertOk()
            ->assertJsonPath('providers.0.name', 'VitaPharma Main Branch')
            ->assertJsonPath('providers.0.tenant.slug', 'vitapharma');

        $platformToken = $this->loginAs('admin@ubuzimaplus.local');

        $this->withToken($platformToken)
            ->getJson('/api/v1/admin/markets')
            ->assertOk()
            ->assertJsonFragment(['code' => 'RW'])
            ->assertJsonFragment(['slug' => 'vitapharma']);

        $this->withToken($platformToken)
            ->postJson('/api/v1/notifications', [
                'title' => 'Operational notice',
                'body' => 'Confirm first tenant readiness.',
                'tenant_slug' => 'vitapharma',
                'market_code' => 'RW',
                'status' => 'published',
            ])
            ->assertCreated()
            ->assertJsonPath('notification.tenant.slug', 'vitapharma');

        $tenantToken = $this->loginAs('admin@vitapharmaafrica.com');

        $notificationResponse = $this->withToken($tenantToken)
            ->getJson('/api/v1/notifications')
            ->assertOk()
            ->assertJsonFragment(['title' => 'Operational notice']);

        $notificationId = collect($notificationResponse->json('notifications'))
            ->firstWhere('title', 'Operational notice')['id'];

        $this->withToken($tenantToken)
            ->postJson("/api/v1/notifications/{$notificationId}/read")
            ->assertOk();
    }

    private function loginAs(string $email): string
    {
        $response = $this->postJson('/api/v1/auth/login', [
            'email' => $email,
            'password' => 'ChangeThisPassword123!',
            'device_name' => 'Platform Operational Modules Test Client',
        ]);

        $response->assertOk();

        return $response->json('access_token');
    }
}
