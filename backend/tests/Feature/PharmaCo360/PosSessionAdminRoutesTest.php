<?php

namespace Tests\Feature\PharmaCo360;

use Illuminate\Routing\Route;
use Illuminate\Support\Facades\Route as RouteFacade;
use Tests\TestCase;

class PosSessionAdminRoutesTest extends TestCase
{
    public function test_pos_admin_support_routes_are_registered(): void
    {
        $expected = [
            'v1/pharmaco/pos/sessions/admin',
            'v1/pharmaco/pos/sessions/{session}/force-close',
            'v1/pharmaco/pos/sessions/{session}/reset-limit',
        ];

        $routes = collect(
            RouteFacade::getRoutes()->getRoutes(),
        );

        foreach ($expected as $uri) {
            $route = $routes->first(
                fn (Route $candidate) =>
                    str_ends_with(
                        $candidate->uri(),
                        $uri,
                    ),
            );

            $this->assertNotNull(
                $route,
                "Missing route: {$uri}",
            );

            $this->assertTrue(
                collect($route->gatherMiddleware())
                    ->contains(
                        fn (string $middleware) =>
                            str_contains(
                                $middleware,
                                'pharmaco.pos.session.reset',
                            ),
                    ),
                "Route {$uri} must require the POS session reset permission.",
            );
        }
    }

    public function test_cashier_pos_routes_accept_operational_permissions(): void
    {
        $route = collect(
            RouteFacade::getRoutes()->getRoutes(),
        )->first(
            fn (Route $candidate) =>
                str_ends_with(
                    $candidate->uri(),
                    'v1/pharmaco/pos/session/current',
                ),
        );

        $this->assertNotNull($route);

        $middleware = implode(
            '|',
            $route->gatherMiddleware(),
        );

        $this->assertStringContainsString(
            'pharmaco.pos.use',
            $middleware,
        );

        $this->assertStringContainsString(
            'pharmaco.sales.create',
            $middleware,
        );
    }
}
