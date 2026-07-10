<?php

namespace Tests\Feature\Auth;

use App\Models\Branch;
use App\Models\Permission;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\TenantUser;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class TenantUserManagementApiTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;

    private Tenant $otherTenant;

    private Branch $branch;

    private User $administrator;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed();

        $this->tenant = Tenant::query()->where('slug', 'vitapharma')->firstOrFail();

        $otherTenant = Tenant::query()
            ->whereKeyNot($this->tenant->id)
            ->first();

        if (! $otherTenant) {
            $otherTenant = Tenant::query()->create([
                'uuid' => (string) Str::uuid(),
                'name' => 'Independent Test Tenant',
                'slug' => 'independent-test-tenant',
                'status' => 'active',
            ]);
        }

        $this->otherTenant = $otherTenant;

        $this->branch = Branch::query()
            ->where('tenant_id', $this->tenant->id)
            ->firstOrFail();

        $this->administrator = User::query()
            ->whereHas('tenantAssignments', function ($query): void {
                $query
                    ->where('tenant_id', $this->tenant->id)
                    ->where('status', 'active');
            })
            ->firstOrFail();

        $rolesManagePermission = Permission::query()->firstOrCreate(
            ['code' => 'roles.manage'],
            [
                'name' => 'Manage roles',
                'permission_group' => 'security',
                'description' => 'Manage tenant roles and user access.',
                'status' => 'active',
            ],
        );

        if ($rolesManagePermission->status !== 'active') {
            $rolesManagePermission->forceFill(['status' => 'active'])->save();
        }

        $testAdministratorRole = Role::query()->firstOrCreate(
            ['code' => 'test-user-management-administrator'],
            [
                'name' => 'Test User Management Administrator',
                'description' => 'Test-only tenant role for User Management API authorization.',
                'scope_type' => 'tenant',
                'status' => 'active',
            ],
        );

        $testAdministratorRole->permissions()->syncWithoutDetaching([
            $rolesManagePermission->id,
        ]);

        $this->administrator->roles()->syncWithoutDetaching([
            $testAdministratorRole->id => [
                'tenant_id' => $this->tenant->id,
                'branch_id' => $this->branch->id,
                'status' => 'active',
            ],
        ]);

        Sanctum::actingAs($this->administrator);
    }

    public function test_authorized_tenant_user_list_returns_only_requested_tenant_assignments(): void
    {
        $visibleUser = User::factory()->create();
        $hiddenUser = User::factory()->create();

        TenantUser::query()->create([
            'tenant_id' => $this->tenant->id,
            'user_id' => $visibleUser->id,
            'branch_id' => $this->branch->id,
            'status' => 'active',
        ]);

        TenantUser::query()->create([
            'tenant_id' => $this->otherTenant->id,
            'user_id' => $hiddenUser->id,
            'branch_id' => null,
            'status' => 'active',
        ]);

        $response = $this
            ->withHeader('X-Tenant-Slug', $this->tenant->slug)
            ->getJson('/api/v1/access-check/security/users');

        $response
            ->assertOk()
            ->assertJsonStructure([
                'users' => [
                    '*' => [
                        'id',
                        'name',
                        'email',
                        'status',
                        'roles',
                    ],
                ],
            ]);

        $returnedIds = collect($response->json('users'))->pluck('id');

        $this->assertTrue($returnedIds->contains($visibleUser->id));
        $this->assertFalse($returnedIds->contains($hiddenUser->id));
    }

    public function test_authorized_administrator_can_create_tenant_user_with_role_and_permissions(): void
    {
        $email = 'user-management-create@example.test';

        $response = $this
            ->withHeader('X-Tenant-Slug', $this->tenant->slug)
            ->postJson('/api/v1/access-check/security/users', [
                'tenant_slug' => $this->tenant->slug,
                'name' => 'Created Staff User',
                'email' => $email,
                'phone' => '+250700000001',
                'job_title' => 'Cashier',
                'role_code' => 'cashier',
                'permissions' => [
                    'tenant.profile.view',
                    'pos.sales.view',
                    'pos.sales.add',
                ],
                'branch_id' => $this->branch->id,
                'status' => 'active',
            ]);

        $response
            ->assertCreated()
            ->assertJsonPath('user.email', $email)
            ->assertJsonPath('user.status', 'active')
            ->assertJsonStructure([
                'message',
                'temporary_password',
                'user',
            ]);

        $createdUser = User::query()->where('email', $email)->firstOrFail();

        $this->assertDatabaseHas('tenant_users', [
            'tenant_id' => $this->tenant->id,
            'user_id' => $createdUser->id,
            'branch_id' => $this->branch->id,
            'status' => 'active',
        ]);

        $this->assertTrue(
            $createdUser->roles()
                ->wherePivot('tenant_id', $this->tenant->id)
                ->wherePivot('status', 'active')
                ->exists()
        );
    }

    public function test_duplicate_email_is_rejected_without_creating_assignment(): void
    {
        $existing = User::factory()->create([
            'email' => 'duplicate-user@example.test',
        ]);

        $response = $this
            ->withHeader('X-Tenant-Slug', $this->tenant->slug)
            ->postJson('/api/v1/access-check/security/users', [
                'tenant_slug' => $this->tenant->slug,
                'name' => 'Duplicate User',
                'email' => $existing->email,
                'role_code' => 'cashier',
                'status' => 'active',
            ]);

        $response->assertUnprocessable();

        $this->assertDatabaseMissing('tenant_users', [
            'tenant_id' => $this->tenant->id,
            'user_id' => $existing->id,
        ]);
    }

    public function test_administrator_can_update_user_role_permissions_branch_and_status(): void
    {
        $user = User::factory()->create([
            'name' => 'Original Name',
            'email' => 'update-user@example.test',
        ]);

        TenantUser::query()->create([
            'tenant_id' => $this->tenant->id,
            'user_id' => $user->id,
            'branch_id' => null,
            'status' => 'active',
        ]);

        $response = $this
            ->withHeader('X-Tenant-Slug', $this->tenant->slug)
            ->putJson("/api/v1/access-check/security/users/{$user->id}", [
                'tenant_slug' => $this->tenant->slug,
                'name' => 'Updated Staff Name',
                'phone' => '+250700000002',
                'job_title' => 'Branch Manager',
                'role_code' => 'branch_manager',
                'permissions' => [
                    'tenant.profile.view',
                    'pos.sales.view',
                    'inventory.dashboard.view',
                ],
                'branch_id' => $this->branch->id,
                'status' => 'suspended',
            ]);

        $response
            ->assertOk()
            ->assertJsonPath('user.name', 'Updated Staff Name')
            ->assertJsonPath('user.status', 'suspended');

        $this->assertDatabaseHas('users', [
            'id' => $user->id,
            'name' => 'Updated Staff Name',
        ]);

        $this->assertDatabaseHas('tenant_users', [
            'tenant_id' => $this->tenant->id,
            'user_id' => $user->id,
            'branch_id' => $this->branch->id,
            'status' => 'suspended',
        ]);
    }

    public function test_deactivation_preserves_user_and_disables_tenant_assignment(): void
    {
        $user = User::factory()->create([
            'email' => 'deactivate-user@example.test',
        ]);

        TenantUser::query()->create([
            'tenant_id' => $this->tenant->id,
            'user_id' => $user->id,
            'branch_id' => $this->branch->id,
            'status' => 'active',
        ]);

        $response = $this
            ->withHeader('X-Tenant-Slug', $this->tenant->slug)
            ->deleteJson("/api/v1/access-check/security/users/{$user->id}", [
                'tenant_slug' => $this->tenant->slug,
            ]);

        $response->assertOk();

        $this->assertDatabaseHas('users', [
            'id' => $user->id,
            'email' => 'deactivate-user@example.test',
        ]);

        $this->assertDatabaseHas('tenant_users', [
            'tenant_id' => $this->tenant->id,
            'user_id' => $user->id,
            'status' => 'inactive',
        ]);
    }

    public function test_user_from_another_tenant_cannot_be_updated_through_current_tenant(): void
    {
        $otherUser = User::factory()->create([
            'email' => 'cross-tenant-user@example.test',
        ]);

        TenantUser::query()->create([
            'tenant_id' => $this->otherTenant->id,
            'user_id' => $otherUser->id,
            'branch_id' => null,
            'status' => 'active',
        ]);

        $response = $this
            ->withHeader('X-Tenant-Slug', $this->tenant->slug)
            ->putJson("/api/v1/access-check/security/users/{$otherUser->id}", [
                'tenant_slug' => $this->tenant->slug,
                'name' => 'Unauthorized Update',
                'role_code' => 'cashier',
                'status' => 'active',
            ]);

        $response->assertNotFound();

        $this->assertDatabaseHas('users', [
            'id' => $otherUser->id,
            'email' => 'cross-tenant-user@example.test',
        ]);
    }

    public function test_unknown_tenant_slug_is_rejected(): void
    {
        $response = $this
            ->withHeader('X-Tenant-Slug', 'tenant-that-does-not-exist')
            ->getJson('/api/v1/access-check/security/users');

        $response->assertNotFound();
    }
    public function test_user_without_roles_manage_cannot_list_tenant_users(): void
    {
        $unauthorizedUser = User::factory()->create();

        TenantUser::query()->create([
            'tenant_id' => $this->tenant->id,
            'user_id' => $unauthorizedUser->id,
            'branch_id' => $this->branch->id,
            'status' => 'active',
        ]);

        Sanctum::actingAs($unauthorizedUser);

        $response = $this
            ->withHeader('X-Tenant-Slug', $this->tenant->slug)
            ->getJson('/api/v1/access-check/security/users');

        $response
            ->assertForbidden()
            ->assertJsonPath('missing_permissions.0', 'roles.manage');
    }

    public function test_missing_tenant_context_is_rejected(): void
    {
        $response = $this
            ->getJson('/api/v1/access-check/security/users');

        $response
            ->assertUnprocessable()
            ->assertJsonPath('message', 'Tenant context is required.');
    }

    public function test_request_body_cannot_override_tenant_header(): void
    {
        $response = $this
            ->withHeader('X-Tenant-Slug', $this->tenant->slug)
            ->getJson(
                '/api/v1/access-check/security/users?tenant_slug='
                . $this->otherTenant->slug
            );

        $response
            ->assertOk()
            ->assertJsonPath('tenant.slug', $this->tenant->slug);
    }

    public function test_duplicate_email_does_not_reset_existing_password(): void
    {
        $existing = User::factory()->create([
            'email' => 'password-protection@example.test',
            'password' => 'OriginalPassword123!',
        ]);

        $originalPasswordHash = $existing->password;

        $response = $this
            ->withHeader('X-Tenant-Slug', $this->tenant->slug)
            ->postJson('/api/v1/access-check/security/users', [
                'tenant_slug' => $this->tenant->slug,
                'name' => 'Attempted Duplicate',
                'email' => $existing->email,
                'role_code' => 'cashier',
                'status' => 'active',
            ]);

        $response
            ->assertUnprocessable()
            ->assertJsonPath(
                'message',
                'A user with this email address already exists.',
            );

        $this->assertSame(
            $originalPasswordHash,
            $existing->fresh()->password,
        );

        $this->assertDatabaseMissing('tenant_users', [
            'tenant_id' => $this->tenant->id,
            'user_id' => $existing->id,
        ]);
    }

}
