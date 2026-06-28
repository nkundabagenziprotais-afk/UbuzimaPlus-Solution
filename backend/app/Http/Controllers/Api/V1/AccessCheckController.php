<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\Auth\UserAccessProfileService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AccessCheckController extends Controller
{
    public function securitySummary(Request $request, UserAccessProfileService $profileService): JsonResponse
    {
        return response()->json([
            'access' => [
                'status' => 'granted',
                'area' => 'security',
                'permission' => 'roles.manage',
            ],
            'profile' => $profileService->build($request->user()),
        ]);
    }

    public function inventoryAccessCheck(Request $request): JsonResponse
    {
        return response()->json([
            'access' => [
                'status' => 'granted',
                'area' => 'pharmaco.inventory',
                'module' => $request->attributes->get('module')?->code,
                'tenant' => $request->attributes->get('tenant')?->slug,
            ],
        ]);
    }

    public function aiAccessCheck(Request $request): JsonResponse
    {
        return response()->json([
            'access' => [
                'status' => 'granted',
                'area' => 'ai',
                'module' => $request->attributes->get('module')?->code,
                'tenant' => $request->attributes->get('tenant')?->slug,
            ],
        ]);
    }
}
