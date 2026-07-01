<?php

namespace Tests\Feature\Auth;

use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class AccessMiddlewareTest extends TestCase
{
    use RefreshDatabase;

    public function test_platform_admin_can_access_security_area_with_permission(): void
    {
        $this->seed();

        $token = $this->loginAs('admin@ubuzimaplus.local');

        $this->withToken($token)
            ->getJson('/api/v1/access-check/security')
            ->assertOk()
            ->assertJsonPath('access.status', 'granted')
            ->assertJsonPath('access.permission', 'roles.manage')
            ->assertJsonPath('profile.scope.type', 'platform');
    }

    public function test_tenant_admin_is_blocked_from_platform_security_area(): void
    {
        $this->seed();

        $token = $this->loginAs('admin@vitapharmaafrica.com');

        $this->withToken($token)
            ->getJson('/api/v1/access-check/security')
            ->assertForbidden()
            ->assertJsonPath('message', 'You do not have permission to perform this action.')
            ->assertJsonPath('missing_permissions.0', 'roles.manage');
    }

    public function test_tenant_admin_can_access_active_inventory_module_for_own_tenant(): void
    {
        $this->seed();

        $token = $this->loginAs('admin@vitapharmaafrica.com');

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->getJson('/api/v1/access-check/inventory')
            ->assertOk()
            ->assertJsonPath('access.status', 'granted')
            ->assertJsonPath('access.module', 'pharmaco.inventory')
            ->assertJsonPath('access.tenant', 'vitapharma');
    }

    public function test_tenant_module_middleware_requires_tenant_context(): void
    {
        $this->seed();

        $token = $this->loginAs('admin@vitapharmaafrica.com');

        $this->withToken($token)
            ->getJson('/api/v1/access-check/inventory')
            ->assertStatus(422)
            ->assertJsonPath('required_header', 'X-Tenant-Slug');
    }

    public function test_governed_ai_module_is_accessible_when_active_for_tenant(): void
    {
        $this->seed();

        $token = $this->loginAs('admin@vitapharmaafrica.com');

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->getJson('/api/v1/access-check/ai')
            ->assertOk()
            ->assertJsonPath('access.status', 'granted')
            ->assertJsonPath('access.module', 'platform.ai_center');
    }

    public function test_tenant_admin_cannot_cross_tenant_boundary(): void
    {
        $this->seed();

        Tenant::query()->create([
            'uuid' => (string) Str::uuid(),
            'solution_id' => DB::table('solutions')->where('code', 'pharmaco360')->value('id'),
            'name' => 'Other Pharmacy',
            'legal_name' => 'Other Pharmacy Ltd',
            'slug' => 'other-pharmacy',
            'tenant_type' => 'pharmacy',
            'status' => 'active',
        ]);

        $token = $this->loginAs('admin@vitapharmaafrica.com');

        $this->withHeader('X-Tenant-Slug', 'other-pharmacy')
            ->withToken($token)
            ->getJson('/api/v1/access-check/inventory')
            ->assertForbidden()
            ->assertJsonPath('message', 'Tenant boundary violation.');
    }

    private function loginAs(string $email): string
    {
        $response = $this->postJson('/api/v1/auth/login', [
            'email' => $email,
            'password' => 'ChangeThisPassword123!',
            'device_name' => 'Middleware Test Client',
        ]);

        $response->assertOk();

        return $response->json('access_token');
    }
}
