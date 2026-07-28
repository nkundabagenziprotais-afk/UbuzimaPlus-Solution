<?php

namespace App\Http\Controllers\Api\V1\PharmaCo360;

use App\Http\Controllers\Controller;
use App\Services\Tax\RraExemptionRegistryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class TaxRegistryController extends Controller
{
    public function summary(
        Request $request,
        RraExemptionRegistryService $registry
    ): JsonResponse {
        $validated = $request->validate([
            'as_of' => ['nullable', 'date'],
        ]);

        return response()->json([
            'data' => $registry->summary(
                $validated['as_of'] ?? null
            ),
        ]);
    }

    public function editions(
        Request $request,
        RraExemptionRegistryService $registry
    ): JsonResponse {
        $validated = $request->validate([
            'limit' => [
                'nullable',
                'integer',
                'min:1',
                'max:100',
            ],
        ]);

        return response()->json([
            'data' => $registry->editions(
                (int) ($validated['limit'] ?? 25)
            ),
            'policy' => [
                'read_only' => true,
                'approval_actions_available' => false,
            ],
        ]);
    }

    public function search(
        Request $request,
        RraExemptionRegistryService $registry
    ): JsonResponse {
        $validated = $request->validate([
            'query' => [
                'nullable',
                'required_without_all:registration_number,hs_code',
                'string',
                'max:191',
            ],
            'registration_number' => [
                'nullable',
                'required_without_all:query,hs_code',
                'string',
                'max:100',
            ],
            'hs_code' => [
                'nullable',
                'required_without_all:query,registration_number',
                'string',
                'max:20',
            ],
            'dosage_form' => [
                'nullable',
                'string',
                'max:100',
            ],
            'strength' => [
                'nullable',
                'string',
                'max:100',
            ],
            'as_of' => ['nullable', 'date'],
            'limit' => [
                'nullable',
                'integer',
                'min:1',
                'max:50',
            ],
        ]);

        return response()->json([
            'data' => $registry->search($validated),
        ]);
    }
}
