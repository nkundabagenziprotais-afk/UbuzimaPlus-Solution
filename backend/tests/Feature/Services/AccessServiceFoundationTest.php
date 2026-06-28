<?php

namespace Tests\Feature\Services;

use App\Models\AdminScope;
use App\Models\Tenant;
use App\Models\User;
use App\Services\AI\AIContextGuard;
use App\Services\Access\ConfigurationService;
use App\Services\Access\ModuleAccessService;
use App\Services\Access\ScopeContext;
use App\Services\Access\ScopeResolver;
use App\Services\Access\TenantResolver;
use App\Services\Audit\AuditLogService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AccessServiceFoundationTest extends TestCase
{
    use RefreshDatabase;

    public function test_tenant_resolver_finds_vitapharma(): void
    {
        $this->seed();

        $tenant = app(TenantResolver::class)->ensureActiveBySlug('vitapharma');

        $this->assertSame('VitaPharma', $tenant->name);
        $this->assertSame('pharmacy', $tenant->tenant_type);
    }

    public function test_module_access_service_detects_active_and_controlled_modules(): void
    {
        $this->seed();

        $tenant = Tenant::query()->where('slug', 'vitapharma')->firstOrFail();
        $service = app(ModuleAccessService::class);

        $this->assertTrue($service->isActiveForTenant($tenant, 'pharmaco.inventory'));
        $this->assertTrue($service->isControlledForTenant($tenant, 'platform.ai_center'));
        $this->assertFalse($service->isActiveForTenant($tenant, 'platform.ai_center'));
    }

    public function test_ai_guard_blocks_ai_until_controlled_activation_becomes_active(): void
    {
        $this->seed();

        $tenant = Tenant::query()->where('slug', 'vitapharma')->firstOrFail();
        $guard = app(AIContextGuard::class);

        $this->assertFalse($guard->canUseAIForTenant($tenant));
        $this->assertTrue($guard->isControlledForTenant($tenant));
        $this->assertTrue($guard->requiresHumanApproval('high'));
        $this->assertFalse($guard->requiresHumanApproval('low'));
    }

    public function test_configuration_service_stores_entity_level_configuration(): void
    {
        $this->seed();

        $tenant = Tenant::query()->where('slug', 'vitapharma')->firstOrFail();
        $service = app(ConfigurationService::class);

        $service->set('tenant', $tenant->id, 'receipt_settings', [
            'show_logo' => true,
            'footer_note' => 'Thank you for choosing VitaPharma.',
        ]);

        $config = $service->get('tenant', $tenant->id, 'receipt_settings');

        $this->assertTrue($config['show_logo']);
        $this->assertSame('Thank you for choosing VitaPharma.', $config['footer_note']);
    }

    public function test_scope_resolver_prioritizes_platform_scope(): void
    {
        $this->seed();

        $user = User::factory()->create();

        AdminScope::query()->create([
            'user_id' => $user->id,
            'scope_type' => 'tenant',
            'status' => 'active',
            'assigned_at' => now(),
        ]);

        AdminScope::query()->create([
            'user_id' => $user->id,
            'scope_type' => 'platform',
            'status' => 'active',
            'assigned_at' => now(),
        ]);

        $context = app(ScopeResolver::class)->resolveForUser($user);

        $this->assertSame('platform', $context->scopeType);
        $this->assertTrue($context->isPlatform());
    }

    public function test_audit_log_service_records_sensitive_action(): void
    {
        $this->seed();

        $tenant = Tenant::query()->where('slug', 'vitapharma')->firstOrFail();
        $context = new ScopeContext(
            userId: null,
            scopeType: 'tenant',
            tenantId: $tenant->id
        );

        app(AuditLogService::class)->record(
            action: 'tenant.module.checked',
            scope: $context,
            metadata: ['module' => 'pharmaco.inventory'],
            dataClassification: 'internal'
        );

        $this->assertDatabaseHas('audit_logs', [
            'tenant_id' => $tenant->id,
            'action' => 'tenant.module.checked',
            'data_classification' => 'internal',
        ]);
    }
}
