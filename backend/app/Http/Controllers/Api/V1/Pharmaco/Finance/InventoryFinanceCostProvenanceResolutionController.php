<?php

namespace App\Http\Controllers\Api\V1\Pharmaco\Finance;

use App\Http\Controllers\Controller;
use App\Models\StockBatch;
use App\Services\Access\ScopeResolver;
use App\Services\InventoryFinance\InventoryFinanceCostProvenanceResolutionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class InventoryFinanceCostProvenanceResolutionController extends Controller
{
    public function update(
        Request $request,
        StockBatch $batch,
        InventoryFinanceCostProvenanceResolutionService $service,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        $tenant =
            $request->attributes->get(
                'tenant'
            );


        if (! $tenant) {
            abort(
                403,
                'Tenant context is required.'
            );
        }


        if (
            (int) $batch->tenant_id
            !==
            (int) $tenant->id
        ) {
            abort(404);
        }


        $validated =
            $request->validate([
                'provenance_source' => [
                    'required',

                    Rule::in([
                        'actual',
                        'inferred_from_price',
                        'legacy_equal_price_cost',
                    ]),
                ],

                'evidence_type' => [
                    'required',

                    Rule::in([
                        'supplier_invoice',
                        'purchase_receipt',
                        'supplier_statement',
                        'receiving_record',
                        'acquisition_record',
                        'price_inference_record',
                        'legacy_migration_record',
                    ]),
                ],

                'evidence_reference' => [
                    'required',
                    'string',
                    'min:3',
                    'max:1000',
                ],

                'reviewer_notes' => [
                    'required',
                    'string',
                    'min:10',
                    'max:2000',
                ],

                'expected_unit_cost' => [
                    'required',
                    'numeric',
                    'gt:0',
                ],

                'expected_quantity_on_hand' => [
                    'required',
                    'numeric',
                    'gt:0',
                ],
            ]);


        $scope =
            $scopeResolver->resolveForUser(
                $request->user()
            );


        $result =
            $service->resolve(
                tenantId:
                    (int) $tenant->id,

                tenantSlug:
                    (string) ($tenant->slug ?? ''),

                batchId:
                    (int) $batch->id,

                scope:
                    $scope,

                validated:
                    $validated
            );


        return response()->json([
            'message' =>
                'Cost provenance resolved successfully.',

            'read_only' =>
                false,

            'write_scope' =>
                'cost_provenance_only',

            'result' =>
                $result,
        ]);
    }
}
