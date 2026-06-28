<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AiProvider;
use App\Models\Module;
use App\Models\Solution;
use App\Models\Tenant;
use Illuminate\Http\JsonResponse;

class PlatformStatusController extends Controller
{
    public function __invoke(): JsonResponse
    {
        return response()->json([
            'platform' => [
                'name' => 'Ubuzima+',
                'status' => 'foundation',
                'first_solution' => 'PharmaCo360',
                'first_tenant' => 'VitaPharma',
            ],
            'counts' => [
                'solutions' => Solution::query()->count(),
                'tenants' => Tenant::query()->count(),
                'modules' => Module::query()->count(),
                'ai_providers' => AiProvider::query()->count(),
            ],
            'admin_hierarchy' => [
                'ubuzima_plus_admin',
                'solution_admin',
                'tenant_admin',
            ],
            'security_principles' => [
                'tenant_data_separation',
                'role_based_access',
                'module_activation',
                'audit_logs',
                'ai_governance',
            ],
        ]);
    }
}
