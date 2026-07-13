<?php

namespace Tests\Feature\PharmaCo360;

use Illuminate\Routing\Route;
use Illuminate\Support\Facades\Route as RouteFacade;
use Tests\TestCase;

class InventoryIntelligenceRoutesTest extends TestCase
{
    public function test_inventory_intelligence_route_is_registered(): void
    {
        $route = collect(
            RouteFacade::getRoutes()->getRoutes(),
        )->first(
            fn (Route $candidate) =>
                str_ends_with(
                    $candidate->uri(),
                    'v1/pharmaco/inventory/intelligence',
                ),
        );

        $this->assertNotNull($route);

        $middleware = implode(
            '|',
            $route->gatherMiddleware(),
        );

        $this->assertStringContainsString(
            'pharmaco.inventory.view',
            $middleware,
        );

        $this->assertStringContainsString(
            'tenant.module:pharmaco.inventory',
            $middleware,
        );
    }
}
