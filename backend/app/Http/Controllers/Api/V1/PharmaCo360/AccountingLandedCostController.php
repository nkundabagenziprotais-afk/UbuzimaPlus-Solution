<?php

namespace App\Http\Controllers\Api\V1\PharmaCo360;

use App\Http\Controllers\Controller;
use App\Services\Finance\FinanceLandedCostService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\HttpException;

class AccountingLandedCostController extends Controller
{
    public function index(
        Request $request,
        FinanceLandedCostService $service,
    ): JsonResponse {
        [
            $tenantId,
            $branchScope,
        ] = $this->scope(
            $request
        );

        return response()->json([
            'data' =>
                $service->list(
                    $tenantId,
                    $branchScope
                ),
        ]);
    }

    public function show(
        Request $request,
        FinanceLandedCostService $service,
        string $uuid,
    ): JsonResponse {
        [
            $tenantId,
            $branchScope,
        ] = $this->scope(
            $request
        );

        return response()->json([
            'data' =>
                $service->detail(
                    $tenantId,
                    $branchScope,
                    $uuid,
                ),
        ]);
    }

    public function eligibility(
        Request $request,
        FinanceLandedCostService $service,
        string $receiptUuid,
    ): JsonResponse {
        [
            $tenantId,
            $branchScope,
        ] = $this->scope(
            $request
        );

        return response()->json([
            'data' =>
                $service->eligibility(
                    $tenantId,
                    $branchScope,
                    $receiptUuid,
                ),
        ]);
    }

    public function store(
        Request $request,
        FinanceLandedCostService $service,
    ): JsonResponse {
        [
            $tenantId,
            $branchScope,
        ] = $this->scope(
            $request
        );

        $validated =
            $request->validate([
                'goods_receipt_uuid' => [
                    'required',
                    'uuid',
                ],

                'business_date' => [
                    'required',
                    'date_format:Y-m-d',
                ],

                'allocation_method' => [
                    'required',
                    'string',
                    'in:purchase_value,quantity,manual',
                ],

                'charges' => [
                    'required',
                    'array',
                    'min:1',
                    'max:50',
                ],

                'charges.*.charge_type' => [
                    'required',
                    'string',
                    'in:freight,customs_duty,clearing,import_insurance,handling,other_capitalizable',
                ],

                'charges.*.description' => [
                    'required',
                    'string',
                    'max:191',
                ],

                'charges.*.amount' => [
                    'required',
                    'numeric',
                    'gt:0',
                ],

                'charges.*.source_supplier_id' => [
                    'nullable',
                    'integer',
                    'min:1',
                ],

                'charges.*.source_reference' => [
                    'nullable',
                    'string',
                    'max:100',
                ],

                'manual_allocations' => [
                    'nullable',
                    'array',
                ],

                'manual_allocations.*.receipt_item_uuid' => [
                    'required_with:manual_allocations',
                    'uuid',
                ],

                'manual_allocations.*.amount' => [
                    'required_with:manual_allocations',
                    'numeric',
                    'min:0',
                ],

                'notes' => [
                    'nullable',
                    'string',
                    'max:4000',
                ],
            ]);

        $result =
            $service->createDraft(
                $tenantId,
                $branchScope,
                $this->actorId(
                    $request
                ),
                $validated,
            );

        return response()->json([
            'message' =>
                'Landed Cost draft created.',

            'data' =>
                $result,
        ], 201);
    }

    public function post(
        Request $request,
        FinanceLandedCostService $service,
        string $uuid,
    ): JsonResponse {
        [
            $tenantId,
            $branchScope,
        ] = $this->scope(
            $request
        );

        $result =
            $service->post(
                $tenantId,
                $branchScope,
                $this->actorId(
                    $request
                ),
                $uuid,
            );

        return response()->json([
            'message' =>
                'Landed Cost posted to Inventory and the General Ledger.',

            'data' =>
                $result,
        ]);
    }

    private function actorId(
        Request $request
    ): int {
        $user =
            $request->user();

        if (! $user) {
            throw new HttpException(
                401,
                'Authentication is required.'
            );
        }

        return (int) $user->id;
    }

    /*
     * Accounting scope is server-owned.
     *
     * Client-provided tenant_id / branch_id is never authoritative.
     */
    private function scope(
        Request $request
    ): array {
        $user =
            $request->user();

        if (! $user) {
            throw new HttpException(
                401,
                'Authentication is required.'
            );
        }

        $tenant =
            $request
                ->attributes
                ->get(
                    'tenant'
                );

        $tenantId =
            (int)
                (
                    $tenant?->id
                    ?? 0
                );

        if ($tenantId <= 0) {
            throw new HttpException(
                422,
                'A verified tenant context is required for Accounting.'
            );
        }

        $assignments =
            $user
                ->tenantAssignments()
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->where(
                    'status',
                    'active'
                )
                ->orderBy('id')
                ->get();

        if ($assignments->isEmpty()) {
            throw new HttpException(
                403,
                'You are not assigned to this Accounting tenant.'
            );
        }

        $tenantWide =
            $assignments->first(
                fn ($assignment) =>
                    $assignment->branch_id
                    === null
            );

        if ($tenantWide) {
            return [
                $tenantId,
                null,
            ];
        }

        $branchIds =
            $assignments
                ->pluck('branch_id')
                ->filter(
                    fn ($value) =>
                        $value !== null
                )
                ->map(
                    fn ($value): int =>
                        (int) $value
                )
                ->unique()
                ->values();

        if ($branchIds->count() !== 1) {
            throw new HttpException(
                409,
                'A single active Accounting branch assignment is required.'
            );
        }

        $branchId =
            (int)
                $branchIds->first();

        $branchActive =
            DB::table('branches')
                ->where(
                    'id',
                    $branchId
                )
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->where(
                    'status',
                    'active'
                )
                ->exists();

        if (! $branchActive) {
            throw new HttpException(
                403,
                'Your Accounting branch assignment is not active.'
            );
        }

        return [
            $tenantId,
            $branchId,
        ];
    }
}
