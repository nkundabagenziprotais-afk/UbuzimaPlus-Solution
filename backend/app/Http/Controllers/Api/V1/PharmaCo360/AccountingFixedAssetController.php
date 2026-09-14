<?php

namespace App\Http\Controllers\Api\V1\PharmaCo360;

use App\Http\Controllers\Controller;
use App\Services\Finance\FinanceFixedAssetScheduleService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpException;

final class AccountingFixedAssetController extends Controller
{
    private const MAP = [
        'furniture' =>
            'fixed_asset.furniture',

        'pharmacy_equipment' =>
            'fixed_asset.pharmacy_equipment',

        'computer_pos' =>
            'fixed_asset.computer_pos',

        'vehicle' =>
            'fixed_asset.vehicle',
    ];

    public function __construct(
        private readonly
            FinanceFixedAssetScheduleService $scheduleService
    ) {
    }

    public function index(
        Request $request
    ): JsonResponse {
        [
            $tenantId,
            $branchId,
        ] = $this->scope(
            $request
        );

        $query = DB::table(
            'finance_fixed_assets'
        )
            ->where(
                'tenant_id',
                $tenantId
            )
            ->when(
                $branchId !== null,
                fn ($q) =>
                    $q->where(
                        'branch_id',
                        $branchId
                    )
            )
            ->orderByDesc(
                'id'
            );

        if (
            $request->filled(
                'status'
            )
        ) {
            $query->where(
                'status',
                (string)
                    $request->query(
                        'status'
                    )
            );
        }

        if (
            $branchId === null
            && $request->filled(
                'branch_id'
            )
        ) {
            $query->where(
                'branch_id',
                $this->branch(
                    $tenantId,
                    (int)
                        $request->query(
                            'branch_id'
                        )
                )
            );
        }

        $assets =
            $query
                ->limit(
                    500
                )
                ->get();

        $ids =
            $assets
                ->pluck(
                    'id'
                )
                ->map(
                    fn ($value) =>
                        (int) $value
                )
                ->all();

        $totals =
            collect();

        if ($ids !== []) {
            $totals =
                DB::table(
                    'finance_fixed_asset_depreciation_schedules'
                )
                    ->selectRaw(
                        'fixed_asset_id,'
                        . 'COUNT(*) schedule_count,'
                        . 'COALESCE('
                        . 'SUM(depreciation_amount),'
                        . '0'
                        . ') planned_depreciation'
                    )
                    ->where(
                        'tenant_id',
                        $tenantId
                    )
                    ->whereIn(
                        'fixed_asset_id',
                        $ids
                    )
                    ->groupBy(
                        'fixed_asset_id'
                    )
                    ->get()
                    ->keyBy(
                        'fixed_asset_id'
                    );
        }

        $items =
            $assets
                ->map(
                    function ($asset)
                    use ($totals) {
                        $summary =
                            $totals->get(
                                $asset->id
                            );

                        return $this->payload(
                            $asset,
                            (int) (
                                $summary
                                    ->schedule_count
                                ?? 0
                            ),
                            (float) (
                                $summary
                                    ->planned_depreciation
                                ?? 0
                            )
                        );
                    }
                )
                ->values()
                ->all();

        return response()->json([
            'data' =>
                $items,

            'summary' => [
                'asset_count' =>
                    count(
                        $items
                    ),

                'active_count' =>
                    collect(
                        $items
                    )
                        ->where(
                            'status',
                            'active'
                        )
                        ->count(),

                'acquisition_cost' =>
                    round(
                        (float)
                            collect(
                                $items
                            )
                                ->sum(
                                    'acquisition_cost'
                                ),
                        4
                    ),

                'salvage_value' =>
                    round(
                        (float)
                            collect(
                                $items
                            )
                                ->sum(
                                    'salvage_value'
                                ),
                        4
                    ),

                'planned_depreciation' =>
                    round(
                        (float)
                            collect(
                                $items
                            )
                                ->sum(
                                    'planned_depreciation'
                                ),
                        4
                    ),
            ],

            'meta' => [
                'package' =>
                    'F11_FIXED_ASSETS',

                'release' =>
                    'F11A-R1.1',

                'posting_enabled' =>
                    false,

                'branch_scope' =>
                    $branchId,
            ],
        ]);
    }

    public function show(
        Request $request,
        string $uuid
    ): JsonResponse {
        [
            $tenantId,
            $branchId,
        ] = $this->scope(
            $request
        );

        $asset =
            $this->asset(
                $tenantId,
                $branchId,
                $uuid
            );

        $rows =
            $this->scheduleRows(
                $tenantId,
                (int)
                    $asset->id
            );

        return response()->json([
            'data' =>
                $this->payload(
                    $asset,
                    $rows->count(),
                    (float)
                        $rows->sum(
                            'depreciation_amount'
                        )
                ),

            'schedule' =>
                $rows,
        ]);
    }

    public function schedule(
        Request $request,
        string $uuid
    ): JsonResponse {
        [
            $tenantId,
            $branchId,
        ] = $this->scope(
            $request
        );

        $asset =
            $this->asset(
                $tenantId,
                $branchId,
                $uuid
            );

        $rows =
            $this->scheduleRows(
                $tenantId,
                (int)
                    $asset->id
            );

        return response()->json([
            'asset' =>
                $this->payload(
                    $asset,
                    $rows->count(),
                    (float)
                        $rows->sum(
                            'depreciation_amount'
                        )
                ),

            'data' =>
                $rows,

            'meta' => [
                'posting_enabled' =>
                    false,

                'note' =>
                    'Planned depreciation only; no General Ledger posting occurs in F11A.',
            ],
        ]);
    }

    public function store(
        Request $request
    ): JsonResponse {
        [
            $tenantId,
            $scopeBranchId,
        ] = $this->scope(
            $request
        );

        $validated =
            $this->validateData(
                $request
            );

        $branchId =
            $this->effectiveBranch(
                $tenantId,
                $scopeBranchId,
                $validated[
                    'branch_id'
                ]
                ?? null
            );

        $mappingKey =
            self::MAP[
                $validated[
                    'asset_class'
                ]
            ];

        $this->mapping(
            $tenantId,
            $branchId,
            $mappingKey
        );

        $assetNumber =
            trim(
                (string) (
                    $validated[
                        'asset_number'
                    ]
                    ?? ''
                )
            );

        if ($assetNumber === '') {
            $assetNumber =
                'FA-'
                . strtoupper(
                    substr(
                        str_replace(
                            '-',
                            '',
                            (string)
                                Str::uuid()
                        ),
                        0,
                        10
                    )
                );
        }

        $this->uniqueNumber(
            $tenantId,
            $assetNumber
        );

        $userId =
            $this->userId(
                $request
            );

        [
            $asset,
            $schedule,
        ] = DB::transaction(
            function ()
            use (
                $tenantId,
                $branchId,
                $validated,
                $mappingKey,
                $assetNumber,
                $userId
            ) {
                $now = now();

                $id =
                    DB::table(
                        'finance_fixed_assets'
                    )
                        ->insertGetId(
                            $this->row(
                                $tenantId,
                                $branchId,
                                $validated,
                                $mappingKey,
                                $assetNumber,
                                $userId,
                                $now
                            )
                        );

                $asset =
                    DB::table(
                        'finance_fixed_assets'
                    )
                        ->where(
                            'tenant_id',
                            $tenantId
                        )
                        ->where(
                            'id',
                            $id
                        )
                        ->first();

                if (! $asset) {
                    throw new HttpException(
                        500,
                        'Fixed asset creation could not be verified.'
                    );
                }

                $schedule =
                    $this->scheduleService
                        ->rebuild(
                            $asset
                        );

                $this->audit(
                    $tenantId,
                    (int)
                        $asset->id,
                    $userId,
                    'created',
                    null,
                    $asset
                );

                return [
                    $asset,
                    $schedule,
                ];
            }
        );

        return response()->json(
            [
                'message' =>
                    'Fixed asset created and depreciation schedule planned.',

                'data' =>
                    $this->payload(
                        $asset,
                        count(
                            $schedule
                        ),
                        (float)
                            collect(
                                $schedule
                            )
                                ->sum(
                                    'depreciation_amount'
                                )
                    ),
            ],
            201
        );
    }

    public function update(
        Request $request,
        string $uuid
    ): JsonResponse {
        [
            $tenantId,
            $scopeBranchId,
        ] = $this->scope(
            $request
        );

        $asset =
            $this->asset(
                $tenantId,
                $scopeBranchId,
                $uuid
            );

        if (
            (string)
                $asset->status
            === 'disposed'
        ) {
            throw ValidationException::withMessages([
                'status' => [
                    'Disposed assets cannot be edited here.',
                ],
            ]);
        }

        $posted =
            DB::table(
                'finance_fixed_asset_depreciation_schedules'
            )
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->where(
                    'fixed_asset_id',
                    (int)
                        $asset->id
                )
                ->where(
                    fn ($q) =>
                        $q->where(
                            'status',
                            'posted'
                        )
                        ->orWhereNotNull(
                            'journal_entry_id'
                        )
                )
                ->exists();

        if ($posted) {
            throw ValidationException::withMessages([
                'asset' => [
                    'Depreciation basis is locked after Finance posting starts.',
                ],
            ]);
        }

        $validated =
            $this->validateData(
                $request
            );

        $branchId =
            $this->effectiveBranch(
                $tenantId,
                $scopeBranchId,
                $validated[
                    'branch_id'
                ]
                ?? null
            );

        $mappingKey =
            self::MAP[
                $validated[
                    'asset_class'
                ]
            ];

        $this->mapping(
            $tenantId,
            $branchId,
            $mappingKey
        );

        $assetNumber =
            trim(
                (string) (
                    $validated[
                        'asset_number'
                    ]
                    ?? $asset->asset_number
                )
            );

        if ($assetNumber === '') {
            $assetNumber =
                (string)
                    $asset->asset_number;
        }

        $this->uniqueNumber(
            $tenantId,
            $assetNumber,
            (int)
                $asset->id
        );

        $userId =
            $this->userId(
                $request
            );

        [
            $fresh,
            $schedule,
        ] = DB::transaction(
            function ()
            use (
                $tenantId,
                $asset,
                $branchId,
                $validated,
                $mappingKey,
                $assetNumber,
                $userId
            ) {
                $row =
                    $this->row(
                        $tenantId,
                        $branchId,
                        $validated,
                        $mappingKey,
                        $assetNumber,
                        $userId,
                        now()
                    );

                unset(
                    $row['uuid'],
                    $row['tenant_id'],
                    $row['created_by'],
                    $row['created_at']
                );

                DB::table(
                    'finance_fixed_assets'
                )
                    ->where(
                        'tenant_id',
                        $tenantId
                    )
                    ->where(
                        'id',
                        (int)
                            $asset->id
                    )
                    ->update(
                        $row
                    );

                $fresh =
                    DB::table(
                        'finance_fixed_assets'
                    )
                        ->where(
                            'tenant_id',
                            $tenantId
                        )
                        ->where(
                            'id',
                            (int)
                                $asset->id
                        )
                        ->first();

                if (! $fresh) {
                    throw new HttpException(
                        500,
                        'Updated fixed asset could not be verified.'
                    );
                }

                $schedule =
                    $this->scheduleService
                        ->rebuild(
                            $fresh
                        );

                $this->audit(
                    $tenantId,
                    (int)
                        $fresh->id,
                    $userId,
                    'updated',
                    $asset,
                    $fresh
                );

                return [
                    $fresh,
                    $schedule,
                ];
            }
        );

        return response()->json([
            'message' =>
                'Fixed asset updated and depreciation schedule rebuilt.',

            'data' =>
                $this->payload(
                    $fresh,
                    count(
                        $schedule
                    ),
                    (float)
                        collect(
                            $schedule
                        )
                            ->sum(
                                'depreciation_amount'
                            )
                ),
        ]);
    }


    /*
     * BEGIN AQUILA_FINANCE_F11C_A_DEPRECIATION_GL
     */
    public function postDepreciation(
        \Illuminate\Http\Request $request,
        string $uuid,
        string $scheduleUuid,
        \App\Services\Finance\FinanceFixedAssetPostingService $postingService,
    ): \Illuminate\Http\JsonResponse {
        [
            $tenantId,
            $branchId,
        ] = $this->scope(
            $request
        );

        $result =
            $postingService
                ->postDepreciation(
                    $tenantId,
                    $branchId,
                    $this->userId(
                        $request
                    ),
                    $uuid,
                    $scheduleUuid,
                );

        return response()->json([
            'message' =>
                'Fixed asset depreciation posted to the General Ledger.',

            'data' =>
                $result,
        ]);
    }
    /* END AQUILA_FINANCE_F11C_A_DEPRECIATION_GL */


    /*
     * BEGIN AQUILA_FINANCE_F11C_B_DISPOSAL_GL
     */

    public function disposals(
        \Illuminate\Http\Request $request,
        string $uuid,
        \App\Services\Finance\FinanceFixedAssetDisposalService $disposalService,
    ): \Illuminate\Http\JsonResponse {
        [
            $tenantId,
            $branchId,
        ] = $this->scope(
            $request
        );

        return response()->json([
            'data' =>
                $disposalService
                    ->list(
                        $tenantId,
                        $branchId,
                        $uuid,
                    ),
        ]);
    }

    public function storeDisposal(
        \Illuminate\Http\Request $request,
        string $uuid,
        \App\Services\Finance\FinanceFixedAssetDisposalService $disposalService,
    ): \Illuminate\Http\JsonResponse {
        [
            $tenantId,
            $branchId,
        ] = $this->scope(
            $request
        );

        $validated =
            $request->validate([
                'disposal_date' => [
                    'required',
                    'date_format:Y-m-d',
                ],

                'disposal_type' => [
                    'required',
                    'string',
                    'in:sale,scrap',
                ],

                'proceeds_amount' => [
                    'nullable',
                    'numeric',
                    'min:0',
                ],

                'proceeds_mapping_key' => [
                    'nullable',
                    'string',
                    'max:100',
                ],

                'notes' => [
                    'nullable',
                    'string',
                    'max:2000',
                ],
            ]);

        $result =
            $disposalService
                ->createDraft(
                    $tenantId,
                    $branchId,
                    $this->userId(
                        $request
                    ),
                    $uuid,
                    $validated,
                );

        return response()->json(
            [
                'message' =>
                    'Fixed Asset disposal draft created.',

                'data' =>
                    $result,
            ],
            201
        );
    }

    public function postDisposal(
        \Illuminate\Http\Request $request,
        string $uuid,
        string $disposalUuid,
        \App\Services\Finance\FinanceFixedAssetDisposalService $disposalService,
    ): \Illuminate\Http\JsonResponse {
        [
            $tenantId,
            $branchId,
        ] = $this->scope(
            $request
        );

        $result =
            $disposalService
                ->post(
                    $tenantId,
                    $branchId,
                    $this->userId(
                        $request
                    ),
                    $uuid,
                    $disposalUuid,
                );

        return response()->json([
            'message' =>
                'Fixed Asset disposal posted to the General Ledger.',

            'data' =>
                $result,
        ]);
    }

    /*
     * END AQUILA_FINANCE_F11C_B_DISPOSAL_GL
     */

    private function validateData(
        Request $request
    ): array {
        $validated =
            $request->validate([
                'branch_id' => [
                    'nullable',
                    'integer',
                    'min:1',
                ],

                'asset_number' => [
                    'nullable',
                    'string',
                    'max:100',
                ],

                'name' => [
                    'required',
                    'string',
                    'max:191',
                ],

                'asset_class' => [
                    'required',
                    'in:furniture,pharmacy_equipment,computer_pos,vehicle',
                ],

                'acquisition_date' => [
                    'required',
                    'date',
                ],

                'in_service_date' => [
                    'required',
                    'date',
                    'after_or_equal:acquisition_date',
                ],

                'acquisition_cost' => [
                    'required',
                    'numeric',
                    'gt:0',
                ],

                'salvage_value' => [
                    'nullable',
                    'numeric',
                    'min:0',
                ],

                'useful_life_months' => [
                    'required',
                    'integer',
                    'min:1',
                    'max:600',
                ],

                'depreciation_method' => [
                    'required',
                    'in:straight_line,declining_balance',
                ],

                'declining_balance_rate' => [
                    'nullable',
                    'numeric',
                    'gt:0',
                    'lte:1',
                ],

                'currency_code' => [
                    'nullable',
                    'string',
                    'size:3',
                ],

                'status' => [
                    'nullable',
                    'in:active,inactive',
                ],

                'serial_number' => [
                    'nullable',
                    'string',
                    'max:100',
                ],

                'location_name' => [
                    'nullable',
                    'string',
                    'max:191',
                ],

                'custodian_name' => [
                    'nullable',
                    'string',
                    'max:191',
                ],

                'purchase_reference' => [
                    'nullable',
                    'string',
                    'max:100',
                ],

                'warranty_expires_on' => [
                    'nullable',
                    'date',
                ],

                'notes' => [
                    'nullable',
                    'string',
                    'max:5000',
                ],
            ]);

        $cost =
            (float)
                $validated[
                    'acquisition_cost'
                ];

        $salvage =
            (float) (
                $validated[
                    'salvage_value'
                ]
                ?? 0
            );

        if (
            $salvage
            >= $cost
        ) {
            throw ValidationException::withMessages([
                'salvage_value' => [
                    'Salvage value must be lower than acquisition cost.',
                ],
            ]);
        }

        if (
            $validated[
                'depreciation_method'
            ]
            === 'declining_balance'
            && empty(
                $validated[
                    'declining_balance_rate'
                ]
            )
        ) {
            throw ValidationException::withMessages([
                'declining_balance_rate' => [
                    'Annual declining-balance rate is required.',
                ],
            ]);
        }

        if (
            $validated[
                'depreciation_method'
            ]
            === 'straight_line'
        ) {
            $validated[
                'declining_balance_rate'
            ] = null;
        }

        return $validated;
    }

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
            (int) (
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

        if (
            $assignments->isEmpty()
        ) {
            throw new HttpException(
                403,
                'You are not assigned to this Accounting tenant.'
            );
        }

        if (
            $assignments->contains(
                fn ($assignment) =>
                    $assignment
                        ->branch_id
                    === null
            )
        ) {
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
                    fn ($value) =>
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
                $branchIds->first();

        if (
            ! DB::table(
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
                ->exists()
        ) {
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

    private function effectiveBranch(
        int $tenantId,
        ?int $scopeBranchId,
        mixed $requested
    ): ?int {
        if (
            $scopeBranchId
            !== null
        ) {
            return $scopeBranchId;
        }

        if (
            $requested === null
            || $requested === ''
        ) {
            return null;
        }

        return $this->branch(
            $tenantId,
            (int)
                $requested
        );
    }

    private function branch(
        int $tenantId,
        int $branchId
    ): int {
        if (
            ! DB::table(
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
                ->exists()
        ) {
            throw ValidationException::withMessages([
                'branch_id' => [
                    'The selected branch is not active for this tenant.',
                ],
            ]);
        }

        return $branchId;
    }

    private function mapping(
        int $tenantId,
        ?int $branchId,
        string $mappingKey
    ): void {
        $query =
            DB::table(
                'finance_account_mappings'
            )
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->where(
                    'mapping_key',
                    $mappingKey
                )
                ->where(
                    'is_active',
                    1
                );

        if ($branchId !== null) {
            $query->where(
                fn ($q) =>
                    $q->whereNull(
                        'branch_id'
                    )
                        ->orWhere(
                            'branch_id',
                            $branchId
                        )
            );
        } else {
            $query->whereNull(
                'branch_id'
            );
        }

        if (! $query->exists()) {
            throw ValidationException::withMessages([
                'asset_class' => [
                    "Finance mapping {$mappingKey} is not active in this Accounting scope.",
                ],
            ]);
        }
    }

    private function uniqueNumber(
        int $tenantId,
        string $assetNumber,
        ?int $ignoreId = null
    ): void {
        $query =
            DB::table(
                'finance_fixed_assets'
            )
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->where(
                    'asset_number',
                    $assetNumber
                );

        if (
            $ignoreId
            !== null
        ) {
            $query->where(
                'id',
                '<>',
                $ignoreId
            );
        }

        if ($query->exists()) {
            throw ValidationException::withMessages([
                'asset_number' => [
                    'Asset number already exists for this tenant.',
                ],
            ]);
        }
    }

    private function asset(
        int $tenantId,
        ?int $branchId,
        string $uuid
    ): object {
        $query =
            DB::table(
                'finance_fixed_assets'
            )
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->where(
                    'uuid',
                    $uuid
                );

        if ($branchId !== null) {
            $query->where(
                'branch_id',
                $branchId
            );
        }

        $asset =
            $query->first();

        if (! $asset) {
            abort(
                404,
                'Fixed asset not found.'
            );
        }

        return $asset;
    }

    private function scheduleRows(
        int $tenantId,
        int $assetId
    ) {
        return DB::table(
            'finance_fixed_asset_depreciation_schedules'
        )
            ->where(
                'tenant_id',
                $tenantId
            )
            ->where(
                'fixed_asset_id',
                $assetId
            )
            ->orderBy(
                'period_number'
            )
            ->get();
    }

    private function userId(
        Request $request
    ): ?int {
        $user =
            $request->user();

        $id =
            $user?->getAuthIdentifier();

        return is_numeric(
            $id
        )
            ? (int)
                $id
            : null;
    }

    private function row(
        int $tenantId,
        ?int $branchId,
        array $validated,
        string $mappingKey,
        string $assetNumber,
        ?int $userId,
        $now
    ): array {
        return [
            'uuid' =>
                (string)
                    Str::uuid(),

            'tenant_id' =>
                $tenantId,

            'branch_id' =>
                $branchId,

            'asset_number' =>
                $assetNumber,

            'name' =>
                trim(
                    (string)
                        $validated[
                            'name'
                        ]
                ),

            'asset_class' =>
                $validated[
                    'asset_class'
                ],

            'asset_mapping_key' =>
                $mappingKey,

            'acquisition_date' =>
                $validated[
                    'acquisition_date'
                ],

            'in_service_date' =>
                $validated[
                    'in_service_date'
                ],

            'acquisition_cost' =>
                round(
                    (float)
                        $validated[
                            'acquisition_cost'
                        ],
                    4
                ),

            'salvage_value' =>
                round(
                    (float) (
                        $validated[
                            'salvage_value'
                        ]
                        ?? 0
                    ),
                    4
                ),

            'useful_life_months' =>
                (int)
                    $validated[
                        'useful_life_months'
                    ],

            'depreciation_method' =>
                $validated[
                    'depreciation_method'
                ],

            'declining_balance_rate' =>
                $validated[
                    'declining_balance_rate'
                ]
                ?? null,

            'currency_code' =>
                strtoupper(
                    (string) (
                        $validated[
                            'currency_code'
                        ]
                        ?? 'RWF'
                    )
                ),

            'status' =>
                $validated[
                    'status'
                ]
                ?? 'active',

            'serial_number' =>
                $validated[
                    'serial_number'
                ]
                ?? null,

            'location_name' =>
                $validated[
                    'location_name'
                ]
                ?? null,

            'custodian_name' =>
                $validated[
                    'custodian_name'
                ]
                ?? null,

            'purchase_reference' =>
                $validated[
                    'purchase_reference'
                ]
                ?? null,

            'warranty_expires_on' =>
                $validated[
                    'warranty_expires_on'
                ]
                ?? null,

            'notes' =>
                $validated[
                    'notes'
                ]
                ?? null,

            'updated_by' =>
                $userId,

            'metadata' =>
                json_encode(
                    [
                        'package' =>
                            'F11_FIXED_ASSETS',

                        'release' =>
                            'F11A-R1.1',

                        'accounting_state' =>
                            'planning_only',
                    ],
                    JSON_UNESCAPED_SLASHES
                ),

            'updated_at' =>
                $now,

            'created_by' =>
                $userId,

            'created_at' =>
                $now,
        ];
    }

    private function audit(
        int $tenantId,
        int $assetId,
        ?int $actorId,
        string $action,
        ?object $before,
        ?object $after
    ): void {
        DB::table(
            'finance_fixed_asset_actions'
        )->insert([
            'uuid' =>
                (string)
                    Str::uuid(),

            'tenant_id' =>
                $tenantId,

            'fixed_asset_id' =>
                $assetId,

            'actor_id' =>
                $actorId,

            'action' =>
                $action,

            'before_snapshot' =>
                $before
                    ? json_encode(
                        (array)
                            $before,
                        JSON_UNESCAPED_SLASHES
                    )
                    : null,

            'after_snapshot' =>
                $after
                    ? json_encode(
                        (array)
                            $after,
                        JSON_UNESCAPED_SLASHES
                    )
                    : null,

            'metadata' =>
                json_encode(
                    [
                        'package' =>
                            'F11_FIXED_ASSETS',

                        'release' =>
                            'F11A-R1.1',
                    ],
                    JSON_UNESCAPED_SLASHES
                ),

            'created_at' =>
                now(),

            'updated_at' =>
                now(),
        ]);
    }

    private function payload(
        object $asset,
        int $scheduleCount,
        float $plannedDepreciation
    ): array {
        return [
            'uuid' =>
                (string)
                    $asset->uuid,

            'asset_number' =>
                (string)
                    $asset->asset_number,

            'name' =>
                (string)
                    $asset->name,

            'branch_id' =>
                $asset->branch_id
                    !== null
                ? (int)
                    $asset->branch_id
                : null,

            'asset_class' =>
                (string)
                    $asset->asset_class,

            'asset_mapping_key' =>
                (string)
                    $asset->asset_mapping_key,

            'acquisition_date' =>
                (string)
                    $asset->acquisition_date,

            'in_service_date' =>
                (string)
                    $asset->in_service_date,

            'acquisition_cost' =>
                (float)
                    $asset->acquisition_cost,

            'salvage_value' =>
                (float)
                    $asset->salvage_value,

            'depreciable_base' =>
                round(
                    (float)
                        $asset->acquisition_cost
                    -
                    (float)
                        $asset->salvage_value,
                    4
                ),

            'useful_life_months' =>
                (int)
                    $asset->useful_life_months,

            'depreciation_method' =>
                (string)
                    $asset->depreciation_method,

            'declining_balance_rate' =>
                $asset->declining_balance_rate
                    !== null
                ? (float)
                    $asset->declining_balance_rate
                : null,

            'currency_code' =>
                (string)
                    $asset->currency_code,

            'status' =>
                (string)
                    $asset->status,

            'serial_number' =>
                $asset->serial_number,

            'location_name' =>
                $asset->location_name,

            'custodian_name' =>
                $asset->custodian_name,

            'purchase_reference' =>
                $asset->purchase_reference,

            'warranty_expires_on' =>
                $asset->warranty_expires_on,

            'notes' =>
                $asset->notes,

            'schedule_count' =>
                $scheduleCount,

            'planned_depreciation' =>
                round(
                    $plannedDepreciation,
                    4
                ),

            'created_at' =>
                $asset->created_at,

            'updated_at' =>
                $asset->updated_at,
        ];
    }
}
