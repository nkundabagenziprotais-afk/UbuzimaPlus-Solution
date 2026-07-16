<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureAnyPermission
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

        if (! $user || ! method_exists($user, 'hasAnyPermission')) {
            return response()->json([
                'message' => 'You do not have permission to perform this action.',
                'missing_any_permission' => $permissions,
            ], 403);
        }

        if ($permissions === [] || $user->hasAnyPermission($permissions)) {
            return $next($request);
        }

        return response()->json([
            'message' => 'You do not have permission to perform this action.',
            'missing_any_permission' => $permissions,
        ], 403);
    }
}
