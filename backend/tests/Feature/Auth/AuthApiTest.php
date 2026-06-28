<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_tenant_admin_can_login_and_receive_access_profile(): void
    {
        $this->seed();

        $response = $this->postJson('/api/v1/auth/login', [
            'email' => 'admin@vitapharmaafrica.com',
            'password' => 'ChangeThisPassword123!',
            'device_name' => 'Local Admin Dashboard',
        ]);

        $response->assertOk()
            ->assertJsonPath('token_type', 'Bearer')
            ->assertJsonPath('profile.user.email', 'admin@vitapharmaafrica.com')
            ->assertJsonPath('profile.scope.type', 'tenant')
            ->assertJsonPath('profile.user.must_change_password', true)
            ->assertJsonStructure([
                'access_token',
                'profile' => [
                    'user',
                    'scope',
                    'roles',
                    'permissions',
                    'tenant_assignments',
                    'admin_scopes',
                ],
            ]);

        $permissions = $response->json('profile.permissions');

        $this->assertContains('pharmaco.inventory.manage', $permissions);
        $this->assertContains('pharmaco.pos.use', $permissions);
    }

    public function test_invalid_login_is_rejected(): void
    {
        $this->seed();

        $this->postJson('/api/v1/auth/login', [
            'email' => 'admin@vitapharmaafrica.com',
            'password' => 'wrong-password',
        ])->assertStatus(422)
            ->assertJsonMissing(['access_token']);
    }

    public function test_inactive_user_cannot_login(): void
    {
        $this->seed();

        User::query()
            ->where('email', 'admin@vitapharmaafrica.com')
            ->update(['status' => 'suspended']);

        $this->postJson('/api/v1/auth/login', [
            'email' => 'admin@vitapharmaafrica.com',
            'password' => 'ChangeThisPassword123!',
        ])->assertStatus(422)
            ->assertJsonMissing(['access_token']);
    }

    public function test_me_endpoint_requires_authentication(): void
    {
        $this->seed();

        $this->getJson('/api/v1/auth/me')
            ->assertUnauthorized();
    }

    public function test_authenticated_user_can_view_profile_and_logout(): void
    {
        $this->seed();

        $login = $this->postJson('/api/v1/auth/login', [
            'email' => 'admin@ubuzimaplus.local',
            'password' => 'ChangeThisPassword123!',
            'device_name' => 'Local Test Client',
        ]);

        $token = $login->json('access_token');

        $this->withToken($token)
            ->getJson('/api/v1/auth/me')
            ->assertOk()
            ->assertJsonPath('profile.user.email', 'admin@ubuzimaplus.local')
            ->assertJsonPath('profile.scope.type', 'platform');

        $this->assertDatabaseCount('personal_access_tokens', 1);

        $this->withToken($token)
            ->postJson('/api/v1/auth/logout')
            ->assertOk()
            ->assertJsonPath('status', 'ok');

        $this->assertDatabaseCount('personal_access_tokens', 0);
    }
}
