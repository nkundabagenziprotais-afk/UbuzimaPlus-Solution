<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Route;

class HealthController extends Controller
{
    public function __invoke(): JsonResponse
    {
        return response()->json([
            'status' => 'ok',
            'platform' => 'Ubuzima+',
            'service' => 'backend-api',
            'version' => '0.1.0',
            'environment' => app()->environment(),
            'registered_api_routes' => $this->routeReadiness(),
        ]);
    }

    private function routeReadiness(): array
    {
        $registeredRoutes = collect(Route::getRoutes())
            ->map(fn ($route) => $route->uri())
            ->all();

        $expectedRoutes = [
            'two_factor_status' => 'api/v1/auth/two-factor/status',
            'platform_pages' => 'api/v1/platform-management/pages',
            'corporate_mail_overview' => 'api/v1/corporate-mail/overview',
            'pharmacist_chat_conversations' => 'api/v1/pharmacist-chat/conversations',
            'data_layer_schema' => 'api/v1/admin/data-layer/schema',
            'localization_context' => 'api/v1/localization/context',
            'market_management' => 'api/v1/admin/markets',
            'nearby_providers' => 'api/v1/nearby/providers',
            'notifications' => 'api/v1/notifications',
        ];

        return collect($expectedRoutes)
            ->map(fn (string $uri) => in_array($uri, $registeredRoutes, true))
            ->all();
    }
}
