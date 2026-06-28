<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;

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
        ]);
    }
}
