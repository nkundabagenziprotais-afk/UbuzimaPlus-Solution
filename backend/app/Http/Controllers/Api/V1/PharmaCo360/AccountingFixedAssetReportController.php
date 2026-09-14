<?php

namespace App\Http\Controllers\Api\V1\PharmaCo360;

use App\Http\Controllers\Controller;
use App\Services\Finance\FinanceFixedAssetReportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\HttpException;

class AccountingFixedAssetReportController extends Controller
{
    public function summary(
        Request $request,
        FinanceFixedAssetReportService $service,
    ): JsonResponse {
        [
            $tenantId,
            $branchId,
        ] = $this->scope(
            $request
        );

        $validated =
            $request->validate([
                'as_of' => [
                    'nullable',
                    'date_format:Y-m-d',
                ],
            ]);

        return response()->json([
            'data' =>
                $service
                    ->summary(
                        $tenantId,
                        $branchId,
                        $validated[
                            'as_of'
                        ]
                        ?? now()
                            ->toDateString(),
                    ),
        ]);
    }

    public function register(
        Request $request,
        FinanceFixedAssetReportService $service,
    ): JsonResponse {
        [
            $tenantId,
            $branchId,
        ] = $this->scope(
            $request
        );

        $validated =
            $request->validate([
                'as_of' => [
                    'nullable',
                    'date_format:Y-m-d',
                ],

                'search' => [
                    'nullable',
                    'string',
                    'max:191',
                ],

                'asset_class' => [
                    'nullable',
                    'string',
                    'max:100',
                ],

                'status' => [
                    'nullable',
                    'string',
                    'in:all,active,disposed',
                ],

                'page' => [
                    'nullable',
                    'integer',
                    'min:1',
                ],

                'per_page' => [
                    'nullable',
                    'integer',
                    'min:1',
                    'max:200',
                ],
            ]);

        return response()->json([
            'data' =>
                $service
                    ->register(
                        $tenantId,
                        $branchId,
                        [
                            'as_of' =>
                                $validated[
                                    'as_of'
                                ]
                                ?? now()
                                    ->toDateString(),

                            'search' =>
                                $validated[
                                    'search'
                                ]
                                ?? '',

                            'asset_class' =>
                                $validated[
                                    'asset_class'
                                ]
                                ?? '',

                            'status' =>
                                $validated[
                                    'status'
                                ]
                                ?? 'all',

                            'page' =>
                                (int)
                                    (
                                        $validated[
                                            'page'
                                        ]
                                        ?? 1
                                    ),

                            'per_page' =>
                                (int)
                                    (
                                        $validated[
                                            'per_page'
                                        ]
                                        ?? 50
                                    ),
                        ],
                    ),
        ]);
    }

    public function depreciation(
        Request $request,
        FinanceFixedAssetReportService $service,
    ): JsonResponse {
        [
            $tenantId,
            $branchId,
        ] = $this->scope(
            $request
        );

        $validated =
            $request->validate([
                'from' => [
                    'nullable',
                    'date_format:Y-m-d',
                ],

                'to' => [
                    'nullable',
                    'date_format:Y-m-d',
                ],

                'status' => [
                    'nullable',
                    'string',
                    'in:all,planned,posted,cancelled',
                ],

                'search' => [
                    'nullable',
                    'string',
                    'max:191',
                ],

                'page' => [
                    'nullable',
                    'integer',
                    'min:1',
                ],

                'per_page' => [
                    'nullable',
                    'integer',
                    'min:1',
                    'max:200',
                ],
            ]);

        return response()->json([
            'data' =>
                $service
                    ->depreciation(
                        $tenantId,
                        $branchId,
                        [
                            'from' =>
                                $validated[
                                    'from'
                                ]
                                ?? null,

                            'to' =>
                                $validated[
                                    'to'
                                ]
                                ?? null,

                            'status' =>
                                $validated[
                                    'status'
                                ]
                                ?? 'all',

                            'search' =>
                                $validated[
                                    'search'
                                ]
                                ?? '',

                            'page' =>
                                (int)
                                    (
                                        $validated[
                                            'page'
                                        ]
                                        ?? 1
                                    ),

                            'per_page' =>
                                (int)
                                    (
                                        $validated[
                                            'per_page'
                                        ]
                                        ?? 100
                                    ),
                        ],
                    ),
        ]);
    }

    public function disposals(
        Request $request,
        FinanceFixedAssetReportService $service,
    ): JsonResponse {
        [
            $tenantId,
            $branchId,
        ] = $this->scope(
            $request
        );

        $validated =
            $request->validate([
                'from' => [
                    'nullable',
                    'date_format:Y-m-d',
                ],

                'to' => [
                    'nullable',
                    'date_format:Y-m-d',
                ],

                'status' => [
                    'nullable',
                    'string',
                    'in:all,draft,posted',
                ],

                'disposal_type' => [
                    'nullable',
                    'string',
                    'in:all,sale,scrap',
                ],

                'search' => [
                    'nullable',
                    'string',
                    'max:191',
                ],

                'page' => [
                    'nullable',
                    'integer',
                    'min:1',
                ],

                'per_page' => [
                    'nullable',
                    'integer',
                    'min:1',
                    'max:200',
                ],
            ]);

        return response()->json([
            'data' =>
                $service
                    ->disposals(
                        $tenantId,
                        $branchId,
                        [
                            'from' =>
                                $validated[
                                    'from'
                                ]
                                ?? null,

                            'to' =>
                                $validated[
                                    'to'
                                ]
                                ?? null,

                            'status' =>
                                $validated[
                                    'status'
                                ]
                                ?? 'all',

                            'disposal_type' =>
                                $validated[
                                    'disposal_type'
                                ]
                                ?? 'all',

                            'search' =>
                                $validated[
                                    'search'
                                ]
                                ?? '',

                            'page' =>
                                (int)
                                    (
                                        $validated[
                                            'page'
                                        ]
                                        ?? 1
                                    ),

                            'per_page' =>
                                (int)
                                    (
                                        $validated[
                                            'per_page'
                                        ]
                                        ?? 50
                                    ),
                        ],
                    ),
        ]);
    }

    /*
     * Same Accounting request-scope policy as the existing Fixed Asset
     * controller:
     *
     *   - authenticated user
     *   - tenant resolved by tenant middleware
     *   - active tenant assignment
     *   - tenant-wide OR one unambiguous active branch assignment
     *
     * Client-provided tenant_id and branch_id are never authoritative.
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
                ->orderBy(
                    'id'
                )
                ->get();

        if ($assignments->isEmpty()) {
            throw new HttpException(
                403,
                'You are not assigned to this Accounting tenant.'
            );
        }

        $tenantWide =
            $assignments
                ->first(
                    fn ($assignment) =>
                        $assignment
                            ->branch_id
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
                ->pluck(
                    'branch_id'
                )
                ->filter(
                    fn ($value) =>
                        $value !== null
                )
                ->map(
                    fn ($value): int =>
                        (int)
                            $value
                )
                ->unique()
                ->values();

        if (
            $branchIds->count()
            !== 1
        ) {
            throw new HttpException(
                409,
                'A single active Accounting branch assignment is required.'
            );
        }

        $branchId =
            (int)
                $branchIds
                    ->first();

        $branchActive =
            DB::table(
                'branches'
            )
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
