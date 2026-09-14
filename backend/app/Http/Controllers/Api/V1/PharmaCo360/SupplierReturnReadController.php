<?php

namespace App\Http\Controllers\Api\V1\PharmaCo360;

use App\Http\Controllers\Controller;
use App\Services\Finance\SupplierReturnReadModelService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final class SupplierReturnReadController extends Controller
{
    public function referenceData(
        Request $request,
        SupplierReturnReadModelService $service,
    ): JsonResponse {
        $validated =
            $request->validate([
                'branch_id' => [
                    'nullable',
                    'integer',
                    'min:1',
                ],
            ]);

        return response()->json([
            'data' =>
                $service->referenceData(
                    $this->tenantId($request),
                    isset(
                        $validated['branch_id']
                    )
                        ? (int)
                            $validated['branch_id']
                        : null
                ),
        ]);
    }

    private function tenantId(
        Request $request,
    ): int {
        $slug =
            trim(
                (string)
                $request->header(
                    'X-Tenant-Slug'
                )
            );

        if ($slug === '') {
            throw ValidationException::withMessages([
                'tenant' =>
                    'X-Tenant-Slug is required.',
            ]);
        }

        $tenantId =
            DB::table('tenants')
                ->where(
                    'slug',
                    $slug
                )
                ->value('id');

        if (! $tenantId) {
            throw ValidationException::withMessages([
                'tenant' =>
                    'Tenant scope is invalid.',
            ]);
        }

        return (int) $tenantId;
    }
}
