<?php

namespace Tests\Feature;

use App\Models\AiProvider;
use App\Models\Module;
use App\Models\Solution;
use App\Models\Tenant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PlatformFoundationTest extends TestCase
{
    use RefreshDatabase;

    public function test_platform_foundation_seed_data_is_created(): void
    {
        $this->seed();

        $this->assertDatabaseHas('solutions', [
            'code' => 'pharmaco360',
            'status' => 'active',
        ]);

        $this->assertDatabaseHas('tenants', [
            'slug' => 'vitapharma',
            'status' => 'active',
        ]);

        $this->assertDatabaseHas('modules', [
            'code' => 'pharmaco.inventory',
        ]);

        $this->assertDatabaseHas('tenant_module_activations', [
            'status' => 'active',
        ]);

        $this->assertDatabaseHas('ai_providers', [
            'code' => 'external_ai_provider_placeholder',
            'status' => 'disabled',
        ]);

        $this->assertSame(3, Solution::query()->count());
        $this->assertSame(1, Tenant::query()->where('slug', 'vitapharma')->count());
        $this->assertGreaterThanOrEqual(10, Module::query()->count());
        $this->assertSame(1, AiProvider::query()->where('status', 'disabled')->count());
    }
}
