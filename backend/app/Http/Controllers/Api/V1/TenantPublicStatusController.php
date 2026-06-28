<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Tenant;
use Illuminate\Http\JsonResponse;

class TenantPublicStatusController extends Controller
{
    public function show(string $slug): JsonResponse
    {
        $tenant = Tenant::query()
            ->with(['primarySolution:id,name,code,status'])
            ->where('slug', $slug)
            ->where('status', 'active')
            ->firstOrFail();

        return response()->json([
            'data' => [
                'name' => $tenant->name,
                'slug' => $tenant->slug,
                'website_url' => $tenant->website_url,
                'tenant_type' => $tenant->tenant_type,
                'status' => $tenant->status,
                'solution' => $tenant->primarySolution ? [
                    'name' => $tenant->primarySolution->name,
                    'code' => $tenant->primarySolution->code,
                    'status' => $tenant->primarySolution->status,
                ] : null,
                'public_note' => 'Public tenant status only. Operational records remain protected.',
            ],
        ]);
    }
}
