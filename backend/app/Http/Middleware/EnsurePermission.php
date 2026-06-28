<?php

namespace App\Http\Middleware;

use App\Services\Auth\UserAccessProfileService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsurePermission
{
    public function __construct(
        private readonly UserAccessProfileService $profileService
    ) {
    }

    public function handle(Request $request, Closure $next, string ...$permissions): Response
    {
        $user = $request->user();

        if (! $user) {
            return response()->json([
                'message' => 'Authentication is required.',
            ], 401);
        }

        $activePermissions = $this->profileService->permissionCodes($user);
        $missing = array_values(array_diff($permissions, $activePermissions));

        if ($missing !== []) {
            return response()->json([
                'message' => 'You do not have permission to perform this action.',
                'missing_permissions' => $missing,
            ], 403);
        }

        return $next($request);
    }
}
