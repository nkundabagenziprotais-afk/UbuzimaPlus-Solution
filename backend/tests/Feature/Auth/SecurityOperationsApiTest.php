<?php

namespace Tests\Feature\Auth;

use App\Models\AuditLog;
use App\Models\Tenant;
use App\Models\TenantUser;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class SecurityOperationsApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_security_operations_summary_returns_tenant_metrics(): void
    {
        $this->seed();

        $token = $this->loginAsSecurityAdministrator();

        $this->withHeader(
            'X-Tenant-Slug',
            'vitapharma'
        )
            ->withToken($token)
            ->getJson(
                '/api/v1/access-check/security/operations'
            )
            ->assertOk()
            ->assertJsonPath(
                'tenant.slug',
                'vitapharma'
            )
            ->assertJsonStructure([
                'summary' => [
                    'total_users',
                    'active_users',
                    'two_factor_required',
                    'two_factor_enabled',
                    'two_factor_pending',
                    'password_change_required',
                    'active_sessions',
                    'trusted_devices',
                    'never_logged_in',
                    'high_risk_users',
                    'two_factor_compliance_percent',
                ],
                'users',
                'generated_at',
            ]);
    }

    public function test_admin_can_force_password_change_and_revoke_sessions(): void
    {
        [$token, $tenant, $target] =
            $this->securityTarget();

        $target->createToken(
            'Security Test Device'
        );

        $this->withHeader(
            'X-Tenant-Slug',
            $tenant->slug
        )
            ->withToken($token)
            ->postJson(
                "/api/v1/access-check/security/users/{$target->id}/force-password-change"
            )
            ->assertOk()
            ->assertJsonPath(
                'user.security.must_change_password',
                true
            );

        $this->assertTrue(
            (bool)
            $target->fresh()
                ->must_change_password
        );

        $this->assertDatabaseMissing(
            'personal_access_tokens',
            [
                'tokenable_id' => $target->id,
            ]
        );

        $this->assertDatabaseHas(
            'audit_logs',
            [
                'auditable_id' => $target->id,
                'action' =>
                    'security.user.force_password_change',
            ]
        );
    }

    public function test_admin_can_reset_two_factor_and_revoke_devices(): void
    {
        [$token, $tenant, $target] =
            $this->securityTarget([
                'two_factor_required' => true,
                'two_factor_enabled' => true,
                'two_factor_secret' =>
                    'TEST-ENCRYPTED-SECRET',
                'two_factor_recovery_codes' =>
                    ['hashed-recovery-code'],
                'two_factor_confirmed_at' =>
                    now()->subDay(),
                'two_factor_last_verified_at' =>
                    now()->subHour(),
            ]);

        $target->trustedDevices()->create([
            'user_id' => $target->id,
            'device_token_hash' =>
                hash(
                    'sha256',
                    Str::random(64)
                ),
            'device_name' => 'Test Browser',
            'ip_address' => '127.0.0.1',
            'user_agent' =>
                'PHPUnit Security Device',
            'trusted_until' =>
                now()->addDays(30),
            'last_used_at' => now(),
        ]);

        $this->withHeader(
            'X-Tenant-Slug',
            $tenant->slug
        )
            ->withToken($token)
            ->postJson(
                "/api/v1/access-check/security/users/{$target->id}/reset-two-factor"
            )
            ->assertOk()
            ->assertJsonPath(
                'user.security.two_factor_enabled',
                false
            )
            ->assertJsonPath(
                'user.security.trusted_devices_count',
                0
            );

        $target->refresh();

        $this->assertFalse(
            (bool)
            $target->two_factor_enabled
        );

        $this->assertNull(
            $target->two_factor_secret
        );

        $this->assertSame(
            0,
            $target->trustedDevices()
                ->whereNull('revoked_at')
                ->count()
        );

        $this->assertDatabaseHas(
            'audit_logs',
            [
                'auditable_id' => $target->id,
                'action' =>
                    'security.user.two_factor_reset',
            ]
        );
    }

    public function test_admin_can_suspend_and_restore_tenant_access(): void
    {
        [$token, $tenant, $target] =
            $this->securityTarget();

        $this->withHeader(
            'X-Tenant-Slug',
            $tenant->slug
        )
            ->withToken($token)
            ->postJson(
                "/api/v1/access-check/security/users/{$target->id}/status",
                [
                    'status' => 'suspended',
                    'reason' =>
                        'Security review required.',
                ]
            )
            ->assertOk()
            ->assertJsonPath(
                'user.status',
                'suspended'
            );

        $this->assertDatabaseHas(
            'tenant_users',
            [
                'tenant_id' => $tenant->id,
                'user_id' => $target->id,
                'status' => 'suspended',
            ]
        );

        $this->withHeader(
            'X-Tenant-Slug',
            $tenant->slug
        )
            ->withToken($token)
            ->postJson(
                "/api/v1/access-check/security/users/{$target->id}/status",
                [
                    'status' => 'active',
                    'reason' =>
                        'Security review completed.',
                ]
            )
            ->assertOk()
            ->assertJsonPath(
                'user.status',
                'active'
            );

        $this->assertDatabaseHas(
            'tenant_users',
            [
                'tenant_id' => $tenant->id,
                'user_id' => $target->id,
                'status' => 'active',
            ]
        );
    }

    public function test_admin_cannot_suspend_own_current_tenant_access(): void
    {
        $this->seed();

        $admin = User::query()
            ->where(
                'email',
                'admin@vitapharmaafrica.com'
            )
            ->firstOrFail();

        $token = $this->loginAsSecurityAdministrator();

        $this->withHeader(
            'X-Tenant-Slug',
            'vitapharma'
        )
            ->withToken($token)
            ->postJson(
                "/api/v1/access-check/security/users/{$admin->id}/status",
                [
                    'status' => 'suspended',
                ]
            )
            ->assertStatus(422);
    }

    private function securityTarget(
        array $overrides = []
    ): array {
        $this->seed();

        $token = $this->loginAsSecurityAdministrator();

        $tenant = Tenant::query()
            ->where('slug', 'vitapharma')
            ->firstOrFail();

        $target = User::factory()->create([
            'name' => 'Security Test User',
            'email' =>
                'security-test-'
                . Str::lower(Str::random(8))
                . '@example.test',
            'password' => Hash::make(
                'SecurePassword123!'
            ),
            'status' => 'active',
            'must_change_password' => false,
            'two_factor_required' => true,
            'two_factor_enabled' => false,
            ...$overrides,
        ]);

        TenantUser::query()->create([
            'tenant_id' => $tenant->id,
            'user_id' => $target->id,
            'branch_id' => null,
            'job_title' =>
                'Security Test Officer',
            'status' => 'active',
            'joined_at' => now(),
        ]);

        return [$token, $tenant, $target];
    }

    private function loginAsSecurityAdministrator(): string
    {
        $tenant = Tenant::query()
            ->where('slug', 'vitapharma')
            ->firstOrFail();

        $administrator = User::query()
            ->where(
                'email',
                'admin@vitapharmaafrica.com'
            )
            ->whereHas(
                'tenantAssignments',
                function ($query) use ($tenant): void {
                    $query
                        ->where(
                            'tenant_id',
                            $tenant->id
                        )
                        ->where(
                            'status',
                            'active'
                        );
                }
            )
            ->firstOrFail();

        $rolesManagePermission =
            Permission::query()->firstOrCreate(
                [
                    'code' => 'roles.manage',
                ],
                [
                    'name' => 'Manage roles',
                    'permission_group' =>
                        'security',
                    'description' =>
                        'Manage tenant roles and user access.',
                    'status' => 'active',
                ]
            );

        if (
            $rolesManagePermission->status
            !== 'active'
        ) {
            $rolesManagePermission
                ->forceFill([
                    'status' => 'active',
                ])
                ->save();
        }

        $securityAdministratorRole =
            Role::query()->firstOrCreate(
                [
                    'code' =>
                        'test-security-operations-administrator',
                ],
                [
                    'name' =>
                        'Test Security Operations Administrator',
                    'description' =>
                        'Test-only tenant role for Security Operations API authorization.',
                    'scope_type' => 'tenant',
                    'status' => 'active',
                ]
            );

        $securityAdministratorRole
            ->permissions()
            ->syncWithoutDetaching([
                $rolesManagePermission->id,
            ]);

        $administrator
            ->roles()
            ->syncWithoutDetaching([
                $securityAdministratorRole->id => [
                    'tenant_id' =>
                        $tenant->id,
                    'solution_id' => null,
                    'branch_id' => null,
                    'status' => 'active',
                ],
            ]);

        return $this->loginAs(
            'admin@vitapharmaafrica.com'
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
