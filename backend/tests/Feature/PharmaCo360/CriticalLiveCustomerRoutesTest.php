<?php

declare(strict_types=1);

namespace Tests\Feature\PharmaCo360;

use Illuminate\Http\Request;
use Illuminate\Routing\Route;
use Illuminate\Support\Facades\Route as RouteFacade;
use Tests\TestCase;

class CriticalLiveCustomerRoutesTest extends TestCase
{
    public function test_vitapharma_resolution_route_is_registered(): void
    {
        $route = RouteFacade::getRoutes()->match(
            Request::create(
                '/api/v1/vitapharma',
                'GET'
            )
        );

        $this->assertInstanceOf(Route::class, $route);
        $this->assertSame(
            'tenant-resolution.vitapharma',
            $route->getName()
        );
    }

    public function test_near_expiry_inventory_route_is_registered(): void
    {
        $route = RouteFacade::getRoutes()->match(
            Request::create(
                '/api/v1/pharmaco/inventory/'
                . 'near-expiry-batches',
                'GET'
            )
        );

        $this->assertInstanceOf(Route::class, $route);
        $this->assertSame(
            'inventory.near-expiry-batches',
            $route->getName()
        );
    }
}
