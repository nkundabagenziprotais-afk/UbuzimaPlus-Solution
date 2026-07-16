<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsurePermission
{
    public function handle(Request $request, Closure $next, string ...$permissionGroups): Response
    {
        $user = $request->user();

        $permissions = collect($permissionGroups)
            ->flatMap(fn ($group) => explode(',', (string) $group))
            ->map(fn ($permission) => trim($permission))
            ->filter()
            ->values()
            ->all();

        if (! $user || ! method_exists($user, 'hasPermission')) {
            return response()->json([
                'message' => 'You do not have permission to perform this action.',
                'missing_permissions' => $permissions,
            ], 403);
        }

        foreach ($permissions as $permission) {
            if (! $user->hasPermission($permission)) {
                return response()->json([
                    'message' => 'You do not have permission to perform this action.',
                    'missing_permission' => $permission,
                    'required_permissions' => $permissions,
                ], 403);
            }
        }

        return $next($request);
    }
}
