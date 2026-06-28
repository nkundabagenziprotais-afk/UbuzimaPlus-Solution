<?php

namespace Tests\Feature\Api;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ApiFoundationTest extends TestCase
{
    use RefreshDatabase;

    public function test_health_endpoint_returns_ok(): void
    {
        $this->getJson('/api/v1/health')
            ->assertOk()
            ->assertJson([
                'status' => 'ok',
                'platform' => 'Ubuzima+',
                'service' => 'backend-api',
            ]);
    }

    public function test_platform_status_endpoint_returns_foundation_summary(): void
    {
        $this->seed();

        $this->getJson('/api/v1/platform/status')
            ->assertOk()
            ->assertJsonPath('platform.name', 'Ubuzima+')
            ->assertJsonPath('platform.first_solution', 'PharmaCo360')
            ->assertJsonPath('platform.first_tenant', 'VitaPharma')
            ->assertJsonPath('counts.solutions', 3);
    }

    public function test_solutions_endpoint_returns_registered_solutions(): void
    {
        $this->seed();

        $this->getJson('/api/v1/solutions')
            ->assertOk()
            ->assertJsonFragment([
                'code' => 'pharmaco360',
                'name' => 'PharmaCo360',
            ]);
    }

    public function test_tenant_public_status_does_not_expose_sensitive_data(): void
    {
        $this->seed();

        $response = $this->getJson('/api/v1/tenants/vitapharma/public-status')
            ->assertOk()
            ->assertJsonPath('data.name', 'VitaPharma')
            ->assertJsonPath('data.solution.code', 'pharmaco360');

        $response->assertJsonMissingPath('data.settings');
        $response->assertJsonMissingPath('data.branding');
        $response->assertJsonMissingPath('data.id');
        $response->assertJsonMissingPath('data.uuid');
    }
}
