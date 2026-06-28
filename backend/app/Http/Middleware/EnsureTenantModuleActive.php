<?php

namespace App\Http\Middleware;

use App\Models\Module;
use App\Models\Tenant;
use App\Services\Access\ScopeResolver;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

class EnsureTenantModuleActive
{
    public function __construct(
        private readonly ScopeResolver $scopeResolver
    ) {
    }

    public function handle(Request $request, Closure $next, string $moduleCode): Response
    {
        $user = $request->user();

        if (! $user) {
            return response()->json([
                'message' => 'Authentication is required.',
            ], 401);
        }

        $tenantSlug = $request->header('X-Tenant-Slug')
            ?: $request->input('tenant_slug')
            ?: $request->route('tenantSlug');

        if (! $tenantSlug) {
            return response()->json([
                'message' => 'Tenant context is required.',
                'required_header' => 'X-Tenant-Slug',
            ], 422);
        }

        $tenant = Tenant::query()
            ->where('slug', $tenantSlug)
            ->where('status', 'active')
            ->first();

        if (! $tenant) {
            return response()->json([
                'message' => 'Tenant was not found or is not active.',
            ], 404);
        }

        $scope = $this->scopeResolver->resolveForUser($user);

        if ($scope->isTenant() && $scope->tenantId !== $tenant->id) {
            return response()->json([
                'message' => 'Tenant boundary violation.',
            ], 403);
        }

        $module = Module::query()
            ->where('code', $moduleCode)
            ->first();

        if (! $module) {
            return response()->json([
                'message' => 'Requested module is not registered.',
                'module' => $moduleCode,
            ], 404);
        }

        $activation = DB::table('tenant_module_activations')
            ->where('tenant_id', $tenant->id)
            ->where('module_id', $module->id)
            ->first();

        if (! $activation || $activation->status !== 'active') {
            return response()->json([
                'message' => 'This module is not active for the selected tenant.',
                'tenant' => $tenant->slug,
                'module' => $moduleCode,
                'status' => $activation?->status ?? 'not_configured',
            ], 403);
        }

        $request->attributes->set('tenant', $tenant);
        $request->attributes->set('module', $module);

        return $next($request);
    }
}
