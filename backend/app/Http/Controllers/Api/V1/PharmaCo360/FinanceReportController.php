<?php

namespace App\Http\Controllers\Api\V1\PharmaCo360;

use App\Http\Controllers\Controller;
use App\Services\Finance\FinancePosShadowReconciliationReportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FinanceReportController extends Controller
{
    public function posShadowReconciliation(
        Request $request,
        FinancePosShadowReconciliationReportService $reports
    ): JsonResponse {
        $tenant = $request->attributes->get('tenant');

        $validated = $request->validate([
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d'],
            'branch_id' => ['nullable', 'integer'],
            'payment_method' => ['nullable', 'string', 'max:40'],
        ]);

        return response()->json([
            'data' => $reports->report(
                tenantId: (int) $tenant->id,
                from: $validated['from'] ?? null,
                to: $validated['to'] ?? null,
                branchId: isset($validated['branch_id']) ? (int) $validated['branch_id'] : null,
                paymentMethod: $validated['payment_method'] ?? null,
            ),
        ]);
    }
}
