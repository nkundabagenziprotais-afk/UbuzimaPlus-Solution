<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Tenant;
use Illuminate\Http\JsonResponse;

class TenantResolutionController extends Controller
{
    public function vitapharma(): JsonResponse
    {
        $tenant = Tenant::query()
            ->where('slug', 'vitapharma')
            ->firstOrFail();

        return response()->json([
            'tenant' => [
                'id' => $tenant->id,
                'name' => $tenant->name,
                'slug' => $tenant->slug,
                'status' => $tenant->status,
            ],
        ]);
    }
}
