<?php

namespace App\Http\Controllers\Api\V1\PharmaCo360;

use App\Http\Controllers\Controller;
use App\Models\ProductDuplicateProposal;
use App\Models\ProductPayerPrice;
use App\Models\ProductReconciliationBatch;
use App\Models\ProductReconciliationRow;
use App\Services\Inventory\ProductReconciliationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use RuntimeException;

class ProductReconciliationController extends Controller
{
    public function __construct(
        private readonly ProductReconciliationService $service
    ) {
    }

    public function summary(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId($request);

        return response()->json([
            'data' => [
                'summary' => $this->service->summary($tenantId),
                'sources' => ProductReconciliationBatch::query()
                    ->where('tenant_id', $tenantId)
                    ->orderByDesc('created_at')
                    ->get([
                        'id',
                        'source_key',
                        'source_name',
                        'source_version',
                        'status',
                        'imported_rows',
                        'matched_rows',
                        'review_rows',
                        'approved_rows',
                        'rejected_rows',
                        'completed_at',
                    ]),
            ],
        ]);
    }

    public function rows(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'status' => [
                'nullable',
                Rule::in(ProductReconciliationService::REVIEW_STATUSES),
            ],
            'action' => ['nullable', 'string', 'max:50'],
            'source' => ['nullable', 'string', 'max:50'],
            'search' => ['nullable', 'string', 'max:191'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        return response()->json(
            $this->service->rows(
                $this->tenantId($request),
                $validated
            )
        );
    }

    public function reviewRow(
        Request $request,
        ProductReconciliationRow $row
    ): JsonResponse {
        $validated = $request->validate([
            'status' => [
                'required',
                Rule::in(ProductReconciliationService::REVIEW_STATUSES),
            ],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        try {
            $reviewed = $this->service->reviewRow(
                $row,
                $this->tenantId($request),
                (int) $request->user()->id,
                $validated['status'],
                $validated['notes'] ?? null
            );
        } catch (RuntimeException $exception) {
            abort(404, $exception->getMessage());
        }

        return response()->json([
            'message' => 'The reconciliation decision was recorded.',
            'data' => $reviewed,
        ]);
    }

    public function duplicates(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'status' => [
                'nullable',
                Rule::in(ProductReconciliationService::REVIEW_STATUSES),
            ],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $query = ProductDuplicateProposal::query()
            ->with([
                'recordA:id,sku,name,generic_name,unit,status',
                'recordB:id,sku,name,generic_name,unit,status',
            ])
            ->where('tenant_id', $this->tenantId($request));

        if (! empty($validated['status'])) {
            $query->where('status', $validated['status']);
        }

        return response()->json(
            $query
                ->orderByDesc('match_score')
                ->orderBy('id')
                ->paginate((int) ($validated['per_page'] ?? 50))
        );
    }

    public function reviewDuplicate(
        Request $request,
        ProductDuplicateProposal $proposal
    ): JsonResponse {
        $validated = $request->validate([
            'status' => [
                'required',
                Rule::in(ProductReconciliationService::REVIEW_STATUSES),
            ],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        try {
            $reviewed = $this->service->reviewDuplicate(
                $proposal,
                $this->tenantId($request),
                (int) $request->user()->id,
                $validated['status'],
                $validated['notes'] ?? null
            );
        } catch (RuntimeException $exception) {
            abort(404, $exception->getMessage());
        }

        return response()->json([
            'message' => 'The duplicate proposal decision was recorded.',
            'data' => $reviewed,
        ]);
    }

    public function payerPrices(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'payer' => ['nullable', 'string', 'max:50'],
            'status' => ['nullable', 'string', 'max:30'],
            'search' => ['nullable', 'string', 'max:191'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $query = ProductPayerPrice::query()
            ->with('product:id,sku,name,generic_name,unit,status')
            ->where('tenant_id', $this->tenantId($request));

        if (! empty($validated['payer'])) {
            $query->where('payer_code', $validated['payer']);
        }

        if (! empty($validated['status'])) {
            $query->where('status', $validated['status']);
        }

        if (! empty($validated['search'])) {
            $search = '%'.$validated['search'].'%';

            $query->whereHas('product', static function ($product) use ($search): void {
                $product
                    ->where('name', 'like', $search)
                    ->orWhere('sku', 'like', $search)
                    ->orWhere('generic_name', 'like', $search);
            });
        }

        return response()->json(
            $query
                ->orderBy('payer_name')
                ->orderByDesc('effective_from')
                ->orderBy('id')
                ->paginate((int) ($validated['per_page'] ?? 50))
        );
    }

    private function tenantId(Request $request): int
    {
        $tenant = $request->attributes->get('tenant');

        if (! $tenant || ! isset($tenant->id)) {
            abort(422, 'Tenant context is required.');
        }

        return (int) $tenant->id;
    }
}
