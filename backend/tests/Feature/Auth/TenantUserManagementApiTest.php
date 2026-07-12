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
    public function test_user_without_role_management_permissions_cannot_list_tenant_users(): void
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
            ->assertJsonPath(
                'message',
                'You do not have permission to perform this action.'
            );
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

    /**
     * AQUILA_USER_ACCESS_ASSIGNMENT_MODE_TESTS_20260712
     */
    public function test_user_can_be_created_with_explicit_predefined_role_mode(): void
    {
        $email =
            'predefined-role-user@example.test';

        $response = $this
            ->withHeader(
                'X-Tenant-Slug',
                $this->tenant->slug,
            )
            ->postJson(
                '/api/v1/access-check/security/users',
                [
                    'tenant_slug' =>
                        $this->tenant->slug,
                    'name' =>
                        'Predefined Role User',
                    'email' => $email,
                    'job_title' => 'Cashier',
                    'access_assignment_mode' =>
                        'predefined_role',
                    'role_code' => 'cashier',
                    'status' => 'active',
                ],
            );

        $response->assertCreated();

        $user = \App\Models\User::query()
            ->where('email', $email)
            ->firstOrFail();

        $activeRole = $user->roles()
            ->wherePivot(
                'tenant_id',
                $this->tenant->id,
            )
            ->wherePivot('status', 'active')
            ->firstOrFail();

        $this->assertSame(
            \Illuminate\Support\Str::slug(
                $this->tenant->slug
                . '-cashier'
            ),
            $activeRole->code,
        );

        $this->assertStringNotContainsString(
            '-user-',
            $activeRole->code,
        );

        $this->assertSame(
            'tenant',
            $activeRole->scope_type,
        );
    }

    public function test_user_can_be_created_with_explicit_granular_permission_mode(): void
    {
        $email =
            'granular-permission-user@example.test';

        $permissions = [
            'tenant.profile.view',
            'pos.sales.view',
            'pos.sales.add',
        ];

        $response = $this
            ->withHeader(
                'X-Tenant-Slug',
                $this->tenant->slug,
            )
            ->postJson(
                '/api/v1/access-check/security/users',
                [
                    'tenant_slug' =>
                        $this->tenant->slug,
                    'name' =>
                        'Granular Permission User',
                    'email' => $email,
                    'job_title' =>
                        'Custom Operations Officer',
                    'access_assignment_mode' =>
                        'granular_permissions',
                    'role_code' => 'custom-access',
                    'permissions' => $permissions,
                    'status' => 'active',
                ],
            );

        $response->assertCreated();

        $user = \App\Models\User::query()
            ->where('email', $email)
            ->firstOrFail();

        $activeRole = $user->roles()
            ->with('permissions')
            ->wherePivot(
                'tenant_id',
                $this->tenant->id,
            )
            ->wherePivot('status', 'active')
            ->firstOrFail();

        $this->assertSame(
            \Illuminate\Support\Str::slug(
                $this->tenant->slug
                . '-custom-access-user-'
                . $user->id
            ),
            $activeRole->code,
        );

        $this->assertEqualsCanonicalizing(
            $permissions,
            $activeRole->permissions
                ->pluck('code')
                ->all(),
        );

        $this->assertSame(
            'tenant',
            $activeRole->scope_type,
        );
    }

    public function test_predefined_role_mode_rejects_direct_permissions(): void
    {
        $response = $this
            ->withHeader(
                'X-Tenant-Slug',
                $this->tenant->slug,
            )
            ->postJson(
                '/api/v1/access-check/security/users',
                [
                    'tenant_slug' =>
                        $this->tenant->slug,
                    'name' => 'Invalid Mixed User',
                    'email' =>
                        'mixed-access-user@example.test',
                    'access_assignment_mode' =>
                        'predefined_role',
                    'role_code' => 'cashier',
                    'permissions' => [
                        'tenant.profile.view',
                    ],
                ],
            );

        $response
            ->assertUnprocessable()
            ->assertJsonPath(
                'message',
                'Pre-defined role mode does not accept direct permissions.',
            );
    }

    public function test_granular_mode_requires_at_least_one_permission(): void
    {
        $response = $this
            ->withHeader(
                'X-Tenant-Slug',
                $this->tenant->slug,
            )
            ->postJson(
                '/api/v1/access-check/security/users',
                [
                    'tenant_slug' =>
                        $this->tenant->slug,
                    'name' => 'Empty Granular User',
                    'email' =>
                        'empty-granular@example.test',
                    'access_assignment_mode' =>
                        'granular_permissions',
                    'role_code' => 'custom-access',
                    'permissions' => [],
                ],
            );

        $response
            ->assertUnprocessable()
            ->assertJsonPath(
                'message',
                'Select at least one permission for the Granular Permission Matrix.',
            );
    }

    public function test_granular_mode_rejects_platform_permissions(): void
    {
        $response = $this
            ->withHeader(
                'X-Tenant-Slug',
                $this->tenant->slug,
            )
            ->postJson(
                '/api/v1/access-check/security/users',
                [
                    'tenant_slug' =>
                        $this->tenant->slug,
                    'name' =>
                        'Platform Permission Attempt',
                    'email' =>
                        'platform-permission-attempt@example.test',
                    'access_assignment_mode' =>
                        'granular_permissions',
                    'role_code' => 'custom-access',
                    'permissions' => [
                        'roles.manage',
                    ],
                ],
            );

        $response
            ->assertUnprocessable()
            ->assertJsonPath(
                'message',
                'Platform or tenant-administration permissions cannot be assigned through the Granular Permission Matrix.',
            );
    }

    public function test_user_can_switch_from_predefined_role_to_granular_permissions(): void
    {
        $email =
            'access-mode-switch@example.test';

        $createResponse = $this
            ->withHeader(
                'X-Tenant-Slug',
                $this->tenant->slug,
            )
            ->postJson(
                '/api/v1/access-check/security/users',
                [
                    'tenant_slug' =>
                        $this->tenant->slug,
                    'name' => 'Mode Switch User',
                    'email' => $email,
                    'access_assignment_mode' =>
                        'predefined_role',
                    'role_code' => 'cashier',
                    'status' => 'active',
                ],
            );

        $createResponse->assertCreated();

        $user = \App\Models\User::query()
            ->where('email', $email)
            ->firstOrFail();

        $updateResponse = $this
            ->withHeader(
                'X-Tenant-Slug',
                $this->tenant->slug,
            )
            ->putJson(
                "/api/v1/access-check/security/users/{$user->id}",
                [
                    'tenant_slug' =>
                        $this->tenant->slug,
                    'name' => 'Mode Switch User',
                    'access_assignment_mode' =>
                        'granular_permissions',
                    'role_code' => 'custom-access',
                    'permissions' => [
                        'tenant.profile.view',
                        'inventory.dashboard.view',
                    ],
                    'status' => 'active',
                ],
            );

        $updateResponse->assertOk();

        $activeRole = $user->fresh()
            ->roles()
            ->with('permissions')
            ->wherePivot(
                'tenant_id',
                $this->tenant->id,
            )
            ->wherePivot('status', 'active')
            ->firstOrFail();

        $this->assertStringContainsString(
            '-custom-access-user-',
            $activeRole->code,
        );

        $this->assertEqualsCanonicalizing(
            [
                'tenant.profile.view',
                'inventory.dashboard.view',
            ],
            $activeRole->permissions
                ->pluck('code')
                ->all(),
        );

        $this->assertFalse(
            $user->fresh()
                ->roles()
                ->wherePivot(
                    'tenant_id',
                    $this->tenant->id,
                )
                ->where(
                    'roles.code',
                    \Illuminate\Support\Str::slug(
                        $this->tenant->slug
                        . '-cashier'
                    ),
                )
                ->wherePivot('status', 'active')
                ->exists(),
        );
    }

}
