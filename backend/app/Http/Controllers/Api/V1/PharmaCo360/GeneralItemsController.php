<?php

namespace App\Http\Controllers\Api\V1\PharmaCo360;

use App\Http\Controllers\Controller;
use App\Models\Tenant;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class GeneralItemsController extends Controller
{
    public function overview(
        Request $request,
        string $tenantSlug
    ): JsonResponse {
        $tenant = $this->tenant(
            $request,
            $tenantSlug,
            'view'
        );

        $stocks = DB::table(
            'pharmaco_general_item_stocks as stocks'
        )
            ->join(
                'pharmaco_general_items as items',
                'items.id',
                '=',
                'stocks.pharmaco_general_item_id'
            )
            ->where(
                'stocks.tenant_id',
                $tenant->id
            );

        $totalValue = (clone $stocks)
            ->selectRaw(
                'COALESCE(SUM('
                . 'stocks.quantity_on_hand '
                . '* stocks.average_unit_cost'
                . '), 0) as value'
            )
            ->value('value');

        $belowMinimum = (clone $stocks)
            ->whereColumn(
                'stocks.quantity_on_hand',
                '<',
                'items.minimum_stock_level'
            )
            ->count();

        return response()->json([
            'summary' => [
                'category_count' =>
                    DB::table(
                        'pharmaco_general_item_categories'
                    )
                        ->where(
                            'tenant_id',
                            $tenant->id
                        )
                        ->where(
                            'status',
                            'active'
                        )
                        ->count(),
                'item_count' =>
                    DB::table(
                        'pharmaco_general_items'
                    )
                        ->where(
                            'tenant_id',
                            $tenant->id
                        )
                        ->where(
                            'status',
                            'active'
                        )
                        ->count(),
                'location_count' =>
                    DB::table(
                        'pharmaco_general_item_locations'
                    )
                        ->where(
                            'tenant_id',
                            $tenant->id
                        )
                        ->where(
                            'status',
                            'active'
                        )
                        ->count(),
                'stock_value' =>
                    round(
                        (float) $totalValue,
                        2
                    ),
                'below_minimum_count' =>
                    $belowMinimum,
            ],
            'recent_movements' =>
                $this->movementQuery($tenant)
                    ->limit(12)
                    ->get(),
        ]);
    }

    public function categories(
        Request $request,
        string $tenantSlug
    ): JsonResponse {
        $tenant = $this->tenant(
            $request,
            $tenantSlug,
            'view'
        );

        return response()->json([
            'categories' =>
                DB::table(
                    'pharmaco_general_item_categories'
                )
                    ->where(
                        'tenant_id',
                        $tenant->id
                    )
                    ->orderBy('name')
                    ->get(),
        ]);
    }

    public function storeCategory(
        Request $request,
        string $tenantSlug
    ): JsonResponse {
        $tenant = $this->tenant(
            $request,
            $tenantSlug,
            'manage'
        );

        $validated = $request->validate([
            'code' => [
                'required',
                'string',
                'max:100',
            ],
            'name' => [
                'required',
                'string',
                'max:191',
            ],
            'description' => [
                'nullable',
                'string',
                'max:1000',
            ],
            'status' => [
                'nullable',
                Rule::in([
                    'active',
                    'inactive',
                ]),
            ],
        ]);

        $exists = DB::table(
            'pharmaco_general_item_categories'
        )
            ->where(
                'tenant_id',
                $tenant->id
            )
            ->where(
                'code',
                strtolower(
                    trim($validated['code'])
                )
            )
            ->exists();

        abort_if(
            $exists,
            422,
            'A General Item category with this code already exists.'
        );

        $id = DB::table(
            'pharmaco_general_item_categories'
        )->insertGetId([
            'tenant_id' => $tenant->id,
            'code' =>
                strtolower(
                    trim($validated['code'])
                ),
            'name' =>
                trim($validated['name']),
            'description' =>
                $validated['description']
                ?? null,
            'status' =>
                $validated['status']
                ?? 'active',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json([
            'message' =>
                'General Item category created successfully.',
            'category' =>
                DB::table(
                    'pharmaco_general_item_categories'
                )->find($id),
        ], 201);
    }

    public function updateCategory(
        Request $request,
        string $tenantSlug,
        int $categoryId
    ): JsonResponse {
        $tenant = $this->tenant(
            $request,
            $tenantSlug,
            'manage'
        );

        $category = DB::table(
            'pharmaco_general_item_categories'
        )
            ->where(
                'tenant_id',
                $tenant->id
            )
            ->where('id', $categoryId)
            ->first();

        abort_unless(
            $category,
            404,
            'General Item category not found.'
        );

        $validated = $request->validate([
            'name' => [
                'required',
                'string',
                'max:191',
            ],
            'description' => [
                'nullable',
                'string',
                'max:1000',
            ],
            'status' => [
                'required',
                Rule::in([
                    'active',
                    'inactive',
                ]),
            ],
        ]);

        DB::table(
            'pharmaco_general_item_categories'
        )
            ->where('id', $categoryId)
            ->update([
                'name' =>
                    trim($validated['name']),
                'description' =>
                    $validated['description']
                    ?? null,
                'status' =>
                    $validated['status'],
                'updated_at' => now(),
            ]);

        return response()->json([
            'message' =>
                'General Item category updated successfully.',
        ]);
    }

    public function items(
        Request $request,
        string $tenantSlug
    ): JsonResponse {
        $tenant = $this->tenant(
            $request,
            $tenantSlug,
            'view'
        );

        return response()->json([
            'items' =>
                DB::table(
                    'pharmaco_general_items as items'
                )
                    ->leftJoin(
                        'pharmaco_general_item_categories as categories',
                        'categories.id',
                        '=',
                        'items.category_id'
                    )
                    ->where(
                        'items.tenant_id',
                        $tenant->id
                    )
                    ->select([
                        'items.*',
                        'categories.name as category_name',
                    ])
                    ->orderBy('items.name')
                    ->get(),
        ]);
    }

    public function storeItem(
        Request $request,
        string $tenantSlug
    ): JsonResponse {
        $tenant = $this->tenant(
            $request,
            $tenantSlug,
            'manage'
        );

        $validated = $request->validate([
            'category_id' => [
                'nullable',
                'integer',
            ],
            'code' => [
                'required',
                'string',
                'max:100',
            ],
            'name' => [
                'required',
                'string',
                'max:191',
            ],
            'description' => [
                'nullable',
                'string',
                'max:1000',
            ],
            'unit_of_measure' => [
                'required',
                'string',
                'max:50',
            ],
            'track_stock' => [
                'required',
                'boolean',
            ],
            'minimum_stock_level' => [
                'required',
                'numeric',
                'min:0',
            ],
            'reorder_quantity' => [
                'required',
                'numeric',
                'min:0',
            ],
            'standard_unit_cost' => [
                'required',
                'numeric',
                'min:0',
            ],
        ]);

        if (! empty($validated['category_id'])) {
            $this->assertTenantRecord(
                'pharmaco_general_item_categories',
                (int) $validated['category_id'],
                $tenant
            );
        }

        $code = strtolower(
            trim($validated['code'])
        );

        $exists = DB::table(
            'pharmaco_general_items'
        )
            ->where(
                'tenant_id',
                $tenant->id
            )
            ->where('code', $code)
            ->exists();

        abort_if(
            $exists,
            422,
            'A General Item with this code already exists.'
        );

        $id = DB::table(
            'pharmaco_general_items'
        )->insertGetId([
            'tenant_id' => $tenant->id,
            'category_id' =>
                $validated['category_id']
                ?? null,
            'code' => $code,
            'name' =>
                trim($validated['name']),
            'description' =>
                $validated['description']
                ?? null,
            'unit_of_measure' =>
                trim(
                    $validated['unit_of_measure']
                ),
            'track_stock' =>
                $validated['track_stock'],
            'minimum_stock_level' =>
                $validated[
                    'minimum_stock_level'
                ],
            'reorder_quantity' =>
                $validated[
                    'reorder_quantity'
                ],
            'standard_unit_cost' =>
                $validated[
                    'standard_unit_cost'
                ],
            'status' => 'active',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json([
            'message' =>
                'General Item created successfully.',
            'item' =>
                DB::table(
                    'pharmaco_general_items'
                )->find($id),
        ], 201);
    }

    public function updateItem(
        Request $request,
        string $tenantSlug,
        int $itemId
    ): JsonResponse {
        $tenant = $this->tenant(
            $request,
            $tenantSlug,
            'manage'
        );

        $this->assertTenantRecord(
            'pharmaco_general_items',
            $itemId,
            $tenant
        );

        $validated = $request->validate([
            'category_id' => [
                'nullable',
                'integer',
            ],
            'name' => [
                'required',
                'string',
                'max:191',
            ],
            'description' => [
                'nullable',
                'string',
                'max:1000',
            ],
            'unit_of_measure' => [
                'required',
                'string',
                'max:50',
            ],
            'track_stock' => [
                'required',
                'boolean',
            ],
            'minimum_stock_level' => [
                'required',
                'numeric',
                'min:0',
            ],
            'reorder_quantity' => [
                'required',
                'numeric',
                'min:0',
            ],
            'standard_unit_cost' => [
                'required',
                'numeric',
                'min:0',
            ],
            'status' => [
                'required',
                Rule::in([
                    'active',
                    'inactive',
                ]),
            ],
        ]);

        if (! empty($validated['category_id'])) {
            $this->assertTenantRecord(
                'pharmaco_general_item_categories',
                (int) $validated['category_id'],
                $tenant
            );
        }

        DB::table(
            'pharmaco_general_items'
        )
            ->where('id', $itemId)
            ->update([
                'category_id' =>
                    $validated['category_id']
                    ?? null,
                'name' =>
                    trim($validated['name']),
                'description' =>
                    $validated['description']
                    ?? null,
                'unit_of_measure' =>
                    trim(
                        $validated[
                            'unit_of_measure'
                        ]
                    ),
                'track_stock' =>
                    $validated['track_stock'],
                'minimum_stock_level' =>
                    $validated[
                        'minimum_stock_level'
                    ],
                'reorder_quantity' =>
                    $validated[
                        'reorder_quantity'
                    ],
                'standard_unit_cost' =>
                    $validated[
                        'standard_unit_cost'
                    ],
                'status' =>
                    $validated['status'],
                'updated_at' => now(),
            ]);

        return response()->json([
            'message' =>
                'General Item updated successfully.',
        ]);
    }

    public function locations(
        Request $request,
        string $tenantSlug
    ): JsonResponse {
        $tenant = $this->tenant(
            $request,
            $tenantSlug,
            'view'
        );

        return response()->json([
            'locations' =>
                DB::table(
                    'pharmaco_general_item_locations'
                )
                    ->where(
                        'tenant_id',
                        $tenant->id
                    )
                    ->orderBy('name')
                    ->get(),
        ]);
    }

    public function storeLocation(
        Request $request,
        string $tenantSlug
    ): JsonResponse {
        $tenant = $this->tenant(
            $request,
            $tenantSlug,
            'manage'
        );

        $validated = $request->validate([
            'code' => [
                'required',
                'string',
                'max:100',
            ],
            'name' => [
                'required',
                'string',
                'max:191',
            ],
            'branch_id' => [
                'nullable',
                'integer',
            ],
            'stock_location_id' => [
                'nullable',
                'integer',
            ],
        ]);

        $code = strtolower(
            trim($validated['code'])
        );

        $exists = DB::table(
            'pharmaco_general_item_locations'
        )
            ->where(
                'tenant_id',
                $tenant->id
            )
            ->where('code', $code)
            ->exists();

        abort_if(
            $exists,
            422,
            'A General Item location with this code already exists.'
        );

        $id = DB::table(
            'pharmaco_general_item_locations'
        )->insertGetId([
            'tenant_id' => $tenant->id,
            'branch_id' =>
                $validated['branch_id']
                ?? null,
            'stock_location_id' =>
                $validated[
                    'stock_location_id'
                ]
                ?? null,
            'code' => $code,
            'name' =>
                trim($validated['name']),
            'status' => 'active',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json([
            'message' =>
                'General Item stock location created successfully.',
            'location' =>
                DB::table(
                    'pharmaco_general_item_locations'
                )->find($id),
        ], 201);
    }

    public function stock(
        Request $request,
        string $tenantSlug
    ): JsonResponse {
        $tenant = $this->tenant(
            $request,
            $tenantSlug,
            'view'
        );

        return response()->json([
            'stock' =>
                DB::table(
                    'pharmaco_general_item_stocks as stocks'
                )
                    ->join(
                        'pharmaco_general_items as items',
                        'items.id',
                        '=',
                        'stocks.pharmaco_general_item_id'
                    )
                    ->join(
                        'pharmaco_general_item_locations as locations',
                        'locations.id',
                        '=',
                        'stocks.pharmaco_general_item_location_id'
                    )
                    ->where(
                        'stocks.tenant_id',
                        $tenant->id
                    )
                    ->select([
                        'stocks.*',
                        'items.code as item_code',
                        'items.name as item_name',
                        'items.unit_of_measure',
                        'items.minimum_stock_level',
                        'locations.code as location_code',
                        'locations.name as location_name',
                    ])
                    ->selectRaw(
                        'stocks.quantity_on_hand '
                        . '* stocks.average_unit_cost '
                        . 'as stock_value'
                    )
                    ->orderBy('items.name')
                    ->get(),
        ]);
    }

    public function movements(
        Request $request,
        string $tenantSlug
    ): JsonResponse {
        $tenant = $this->tenant(
            $request,
            $tenantSlug,
            'view'
        );

        return response()->json([
            'movements' =>
                $this->movementQuery($tenant)
                    ->limit(150)
                    ->get(),
        ]);
    }

    public function receive(
        Request $request,
        string $tenantSlug
    ): JsonResponse {
        return $this->applyMovement(
            $request,
            $tenantSlug,
            'receipt'
        );
    }

    public function issue(
        Request $request,
        string $tenantSlug
    ): JsonResponse {
        return $this->applyMovement(
            $request,
            $tenantSlug,
            'issue'
        );
    }

    private function applyMovement(
        Request $request,
        string $tenantSlug,
        string $movementType
    ): JsonResponse {
        $tenant = $this->tenant(
            $request,
            $tenantSlug,
            $movementType === 'receipt'
                ? 'receive'
                : 'issue'
        );

        $validated = $request->validate([
            'item_id' => [
                'required',
                'integer',
            ],
            'location_id' => [
                'required',
                'integer',
            ],
            'quantity' => [
                'required',
                'numeric',
                'gt:0',
            ],
            'unit_cost' => [
                'nullable',
                'numeric',
                'min:0',
            ],
            'purchase_order_item_id' => [
                'nullable',
                'integer',
            ],
            'reference' => [
                'nullable',
                'string',
                'max:100',
            ],
            'department' => [
                'nullable',
                'string',
                'max:191',
            ],
            'notes' => [
                'nullable',
                'string',
                'max:1000',
            ],
        ]);

        $item = $this->assertTenantRecord(
            'pharmaco_general_items',
            (int) $validated['item_id'],
            $tenant
        );

        $location = $this->assertTenantRecord(
            'pharmaco_general_item_locations',
            (int) $validated['location_id'],
            $tenant
        );

        $quantity = (float) $validated[
            'quantity'
        ];

        $unitCost = (float) (
            $validated['unit_cost']
            ?? $item->standard_unit_cost
            ?? 0
        );

        DB::transaction(function () use (
            $request,
            $tenant,
            $item,
            $location,
            $movementType,
            $quantity,
            $unitCost,
            $validated
        ): void {
            $stock = DB::table(
                'pharmaco_general_item_stocks'
            )
                ->where(
                    'pharmaco_general_item_id',
                    $item->id
                )
                ->where(
                    'pharmaco_general_item_location_id',
                    $location->id
                )
                ->lockForUpdate()
                ->first();

            if (! $stock) {
                $stockId = DB::table(
                    'pharmaco_general_item_stocks'
                )->insertGetId([
                    'tenant_id' => $tenant->id,
                    'pharmaco_general_item_id' =>
                        $item->id,
                    'pharmaco_general_item_location_id' =>
                        $location->id,
                    'quantity_on_hand' => 0,
                    'average_unit_cost' =>
                        $unitCost,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);

                $stock = DB::table(
                    'pharmaco_general_item_stocks'
                )
                    ->where('id', $stockId)
                    ->lockForUpdate()
                    ->first();
            }

            $currentQuantity = (float)
                $stock->quantity_on_hand;

            if ($movementType === 'issue') {
                abort_if(
                    $quantity > $currentQuantity,
                    422,
                    'The requested issue quantity exceeds available General Item stock.'
                );

                $newQuantity =
                    $currentQuantity - $quantity;

                $newAverageCost = (float)
                    $stock->average_unit_cost;
            } else {
                $newQuantity =
                    $currentQuantity + $quantity;

                $currentValue =
                    $currentQuantity
                    * (float)
                        $stock->average_unit_cost;

                $receivedValue =
                    $quantity * $unitCost;

                $newAverageCost =
                    $newQuantity > 0
                        ? (
                            $currentValue
                            + $receivedValue
                        ) / $newQuantity
                        : 0;
            }

            DB::table(
                'pharmaco_general_item_stocks'
            )
                ->where('id', $stock->id)
                ->update([
                    'quantity_on_hand' =>
                        $newQuantity,
                    'average_unit_cost' =>
                        round(
                            $newAverageCost,
                            2
                        ),
                    'last_received_at' =>
                        $movementType ===
                        'receipt'
                            ? now()
                            : $stock
                                ->last_received_at,
                    'last_issued_at' =>
                        $movementType ===
                        'issue'
                            ? now()
                            : $stock
                                ->last_issued_at,
                    'updated_at' => now(),
                ]);

            DB::table(
                'pharmaco_general_item_movements'
            )->insert([
                'tenant_id' => $tenant->id,
                'pharmaco_general_item_id' =>
                    $item->id,
                'pharmaco_general_item_location_id' =>
                    $location->id,
                'purchase_order_item_id' =>
                    $validated[
                        'purchase_order_item_id'
                    ]
                    ?? null,
                'movement_type' =>
                    $movementType,
                'quantity' =>
                    $movementType === 'issue'
                        ? -$quantity
                        : $quantity,
                'unit_cost' => $unitCost,
                'reference' =>
                    $validated['reference']
                    ?? null,
                'department' =>
                    $validated['department']
                    ?? null,
                'notes' =>
                    $validated['notes']
                    ?? null,
                'performed_by' =>
                    $request->user()?->id,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        });

        return response()->json([
            'message' =>
                $movementType === 'receipt'
                    ? 'General Item stock received successfully.'
                    : 'General Item stock issued successfully.',
        ], 201);
    }

    private function movementQuery(
        Tenant $tenant
    ): Builder {
        return DB::table(
            'pharmaco_general_item_movements as movements'
        )
            ->join(
                'pharmaco_general_items as items',
                'items.id',
                '=',
                'movements.pharmaco_general_item_id'
            )
            ->join(
                'pharmaco_general_item_locations as locations',
                'locations.id',
                '=',
                'movements.pharmaco_general_item_location_id'
            )
            ->where(
                'movements.tenant_id',
                $tenant->id
            )
            ->select([
                'movements.*',
                'items.code as item_code',
                'items.name as item_name',
                'items.unit_of_measure',
                'locations.code as location_code',
                'locations.name as location_name',
            ])
            ->orderByDesc(
                'movements.created_at'
            );
    }

    private function assertTenantRecord(
        string $table,
        int $id,
        Tenant $tenant
    ): object {
        $record = DB::table($table)
            ->where(
                'tenant_id',
                $tenant->id
            )
            ->where('id', $id)
            ->first();

        abort_unless(
            $record,
            404,
            'The requested General Item record was not found.'
        );

        return $record;
    }

    private function tenant(
        Request $request,
        string $tenantSlug,
        string $action
    ): Tenant {
        $tenant = Tenant::query()
            ->where('slug', $tenantSlug)
            ->firstOrFail();

        $user = $request->user();

        abort_unless(
            $user,
            401,
            'Authentication is required.'
        );

        $roles = $user->roles()
            ->wherePivot(
                'status',
                'active'
            )
            ->with('permissions')
            ->get();

        $isPlatform = $roles->contains(
            fn ($role): bool =>
                $role->scope_type ===
                'platform'
        );

        $tenantRoles = $roles->filter(
            fn ($role): bool =>
                (int) (
                    $role->pivot->tenant_id
                    ?? 0
                ) === (int) $tenant->id
        );

        abort_unless(
            $isPlatform
            || $tenantRoles->isNotEmpty(),
            403,
            'You do not have access to this tenant.'
        );

        if ($isPlatform) {
            return $tenant;
        }

        $roleCodes = $tenantRoles
            ->pluck('code');

        $permissionCodes = $tenantRoles
            ->flatMap(
                fn ($role) =>
                    $role->permissions->pluck(
                        'code'
                    )
            )
            ->unique();

        $allowedByRole = match ($action) {
            'view' =>
                $roleCodes->intersect([
                    'tenant_admin',
                    'tenant_branch_manager',
                    'tenant_security_administrator',
                ])->isNotEmpty(),
            default =>
                $roleCodes->intersect([
                    'tenant_admin',
                    'tenant_branch_manager',
                ])->isNotEmpty(),
        };

        $allowedByPermission =
            $permissionCodes->contains(
                'pharmaco.inventory.manage'
            )
            || (
                $action === 'view'
                && $permissionCodes->contains(
                    'pharmaco.inventory.view'
                )
            );

        abort_unless(
            $allowedByRole
            || $allowedByPermission,
            403,
            'You do not have permission to manage General Items.'
        );

        return $tenant;
    }
}
