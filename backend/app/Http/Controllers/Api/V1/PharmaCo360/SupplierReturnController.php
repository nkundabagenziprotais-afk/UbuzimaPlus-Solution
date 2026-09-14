<?php

namespace App\Http\Controllers\Api\V1\PharmaCo360;

use App\Http\Controllers\Controller;
use App\Services\Finance\SupplierReturnLifecycleService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final class SupplierReturnController extends Controller
{
    public function index(
        Request $request,
        SupplierReturnLifecycleService $service,
    ): JsonResponse {
        $validated =
            $request->validate([
                'branch_id' =>
                    ['required', 'integer', 'min:1'],

                'supplier_id' =>
                    ['nullable', 'integer', 'min:1'],
            ]);

        $tenantId =
            $this->tenantId($request);

        return response()->json([
            'data' =>
                $service->index(
                    $tenantId,
                    (int)
                    $validated['branch_id'],
                    isset(
                        $validated['supplier_id']
                    )
                        ? (int)
                            $validated['supplier_id']
                        : null
                ),
        ]);
    }

    public function show(
        Request $request,
        int $supplierReturn,
        SupplierReturnLifecycleService $service,
    ): JsonResponse {
        $validated =
            $request->validate([
                'branch_id' =>
                    ['required', 'integer', 'min:1'],
            ]);

        return response()->json([
            'data' =>
                $service->show(
                    $this->tenantId($request),
                    (int)
                    $validated['branch_id'],
                    $supplierReturn
                ),
        ]);
    }

    public function create(
        Request $request,
        SupplierReturnLifecycleService $service,
    ): JsonResponse {
        $validated =
            $request->validate([
                'branch_id' =>
                    ['required', 'integer', 'min:1'],

                'supplier_id' =>
                    ['required', 'integer', 'min:1'],

                'purchase_order_id' =>
                    ['required', 'integer', 'min:1'],

                'goods_receipt_id' =>
                    ['required', 'integer', 'min:1'],

                'supplier_invoice_id' =>
                    ['required', 'integer', 'min:1'],

                'business_date' =>
                    ['required', 'date'],

                'reason_code' =>
                    ['nullable', 'string', 'max:80'],

                'notes' =>
                    ['nullable', 'string', 'max:4000'],

                'idempotency_key' =>
                    [
                        'required',
                        'string',
                        'min:8',
                        'max:180',
                    ],

                'items' =>
                    ['required', 'array', 'min:1'],

                'items.*.goods_receipt_item_id' =>
                    ['required', 'integer', 'min:1'],

                'items.*.supplier_invoice_item_id' =>
                    ['required', 'integer', 'min:1'],

                'items.*.product_id' =>
                    ['required', 'integer', 'min:1'],

                'items.*.stock_batch_id' =>
                    ['required', 'integer', 'min:1'],

                'items.*.quantity' =>
                    [
                        'required',
                        'numeric',
                        'gt:0',
                    ],

                'items.*.reason_code' =>
                    ['nullable', 'string', 'max:80'],
            ]);

        $validated['tenant_id'] =
            $this->tenantId($request);

        $actorId =
            $this->actorId($request);

        return response()->json(
            [
                'data' =>
                    $service->create(
                        $validated,
                        $actorId
                    ),
            ],
            201
        );
    }

    public function submit(
        Request $request,
        int $supplierReturn,
        SupplierReturnLifecycleService $service,
    ): JsonResponse {
        $validated =
            $request->validate([
                'branch_id' =>
                    ['required', 'integer', 'min:1'],
            ]);

        return response()->json([
            'data' =>
                $service->submit(
                    $this->tenantId($request),
                    (int)
                    $validated['branch_id'],
                    $supplierReturn,
                    $this->actorId($request)
                ),
        ]);
    }

    public function approve(
        Request $request,
        int $supplierReturn,
        SupplierReturnLifecycleService $service,
    ): JsonResponse {
        $validated =
            $request->validate([
                'branch_id' =>
                    ['required', 'integer', 'min:1'],
            ]);

        return response()->json([
            'data' =>
                $service->approve(
                    $this->tenantId($request),
                    (int)
                    $validated['branch_id'],
                    $supplierReturn,
                    $this->actorId($request)
                ),
        ]);
    }

    public function reject(
        Request $request,
        int $supplierReturn,
        SupplierReturnLifecycleService $service,
    ): JsonResponse {
        $validated =
            $request->validate([
                'branch_id' =>
                    ['required', 'integer', 'min:1'],

                'reason' =>
                    [
                        'required',
                        'string',
                        'min:3',
                        'max:2000',
                    ],
            ]);

        return response()->json([
            'data' =>
                $service->reject(
                    $this->tenantId($request),
                    (int)
                    $validated['branch_id'],
                    $supplierReturn,
                    $this->actorId($request),
                    $validated['reason']
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

        return (int)
            $tenantId;
    }

    private function actorId(
        Request $request,
    ): int {
        $actor =
            $request->user();

        if (! $actor) {
            abort(401);
        }

        return (int)
            $actor->id;
    }
}
