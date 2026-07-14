<?php

namespace App\Http\Controllers\Api\V1\PharmaCo360;

use App\Http\Controllers\Controller;
use App\Models\Branch;
use App\Models\PharmacoGeneralItem;
use App\Models\PharmacoGeneralItemCategory;
use App\Models\PharmacoGeneralItemLocation;
use App\Models\PharmacoGeneralItemMovement;
use App\Models\PharmacoGeneralPurchaseOrderItem;
use App\Models\PharmacoPurchaseOrder;
use App\Models\PharmacoGeneralItemStock;
use App\Models\PharmacoSupplier;
use App\Services\Access\ScopeResolver;
use App\Services\Audit\AuditLogService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use App\Models\Tenant;

class GeneralItemsController extends Controller
{
    private const DEFAULT_CATEGORIES = [
        ['HYG', 'Hygiene and Sanitation'],
        ['PAC', 'Packaging and Consumables'],
        ['OFF', 'Office and Stationery'],
        ['MNT', 'Maintenance and Repairs'],
        ['PPE', 'Safety and PPE'],
        ['ITE', 'IT and Electronics'],
        ['FUR', 'Furniture and Fixtures'],
        ['KIT', 'Kitchen and Staff Welfare'],
        ['MKT', 'Marketing and Branding'],
        ['LOG', 'Transport and Logistics'],
        ['UTL', 'Utilities and Facility Supplies'],
        ['OTH', 'Other Controlled Items'],
    ];

    public function categories(Request $request): JsonResponse
    {
        $tenant = $request->attributes->get('tenant');

        $categories = PharmacoGeneralItemCategory::query()
            ->where('tenant_id', $tenant->id)
            ->withCount('items')
            ->when(
                $request->query('status'),
                fn (Builder $query, string $status) =>
                    $query->where('status', $status)
            )
            ->orderBy('name')
            ->get();

        return response()->json([
            'categories' => $categories
                ->map(fn ($category) =>
                    $this->serializeCategory($category))
                ->values(),
        ]);
    }

    public function seedDefaultCategories(
        Request $request,
        AuditLogService $auditLogService,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        $tenant = $request->attributes->get('tenant');

        $created = collect();

        DB::transaction(function () use (
            $tenant,
            &$created
        ): void {
            foreach (self::DEFAULT_CATEGORIES as [
                $code,
                $name,
            ]) {
                $category =
                    PharmacoGeneralItemCategory::query()
                        ->firstOrCreate(
                            [
                                'tenant_id' => $tenant->id,
                                'code' => $code,
                            ],
                            [
                                'uuid' => (string) Str::uuid(),
                                'name' => $name,
                                'status' => 'active',
                                'description' =>
                                    'Standard General Item category.',
                                'metadata' => [
                                    'source' =>
                                        'general_items_default_categories',
                                ],
                            ]
                        );

                $created->push($category);
            }
        });

        $scope = $scopeResolver->resolveForUser(
            $request->user()
        );

        $auditLogService->record(
            action:
                'pharmaco.general_item_categories.seeded',
            scope: $scope,
            metadata: [
                'tenant_slug' => $tenant->slug,
                'category_count' => $created->count(),
            ],
            dataClassification: 'internal'
        );

        return response()->json([
            'message' =>
                'Default General Item categories are ready.',
            'categories' => $created
                ->sortBy('name')
                ->map(fn ($category) =>
                    $this->serializeCategory($category))
                ->values(),
        ]);
    }

    public function createCategory(
        Request $request,
        AuditLogService $auditLogService,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        $tenant = $request->attributes->get('tenant');

        $validated = $request->validate([
            'name' => [
                'required',
                'string',
                'max:191',
            ],
            'code' => [
                'required',
                'string',
                'max:100',
                Rule::unique(
                    'pharmaco_general_item_categories',
                    'code'
                )->where(
                    fn ($query) =>
                        $query->where(
                            'tenant_id',
                            $tenant->id
                        )
                ),
            ],
            'status' => [
                'nullable',
                Rule::in(['active', 'inactive']),
            ],
            'description' => [
                'nullable',
                'string',
                'max:1000',
            ],
        ]);

        $category =
            PharmacoGeneralItemCategory::query()
                ->create([
                    'uuid' => (string) Str::uuid(),
                    'tenant_id' => $tenant->id,
                    'name' => trim($validated['name']),
                    'code' => Str::upper(
                        trim($validated['code'])
                    ),
                    'status' =>
                        $validated['status'] ?? 'active',
                    'description' =>
                        $validated['description'] ?? null,
                    'metadata' => [
                        'source' =>
                            'general_items_category_admin',
                    ],
                ]);

        $scope = $scopeResolver->resolveForUser(
            $request->user()
        );

        $auditLogService->record(
            action:
                'pharmaco.general_item_category.created',
            scope: $scope,
            metadata: [
                'tenant_slug' => $tenant->slug,
                'category_id' => $category->id,
                'category_code' => $category->code,
            ],
            dataClassification: 'internal',
            auditableType:
                PharmacoGeneralItemCategory::class,
            auditableId: $category->id
        );

        return response()->json([
            'message' =>
                'General Item category created successfully.',
            'category' =>
                $this->serializeCategory($category),
        ], 201);
    }

    public function updateCategory(
        Request $request,
        PharmacoGeneralItemCategory $category,
        AuditLogService $auditLogService,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        $tenant = $request->attributes->get('tenant');

        abort_unless(
            (int) $category->tenant_id ===
                (int) $tenant->id,
            404
        );

        $validated = $request->validate([
            'name' => [
                'sometimes',
                'required',
                'string',
                'max:191',
            ],
            'code' => [
                'sometimes',
                'required',
                'string',
                'max:100',
                Rule::unique(
                    'pharmaco_general_item_categories',
                    'code'
                )
                    ->where(
                        fn ($query) =>
                            $query->where(
                                'tenant_id',
                                $tenant->id
                            )
                    )
                    ->ignore($category->id),
            ],
            'status' => [
                'sometimes',
                Rule::in(['active', 'inactive']),
            ],
            'description' => [
                'nullable',
                'string',
                'max:1000',
            ],
        ]);

        $before = $category->only([
            'name',
            'code',
            'status',
            'description',
        ]);

        if (array_key_exists('code', $validated)) {
            $validated['code'] = Str::upper(
                trim($validated['code'])
            );
        }

        $category->fill($validated);
        $category->save();

        $scope = $scopeResolver->resolveForUser(
            $request->user()
        );

        $auditLogService->record(
            action:
                'pharmaco.general_item_category.updated',
            scope: $scope,
            metadata: [
                'tenant_slug' => $tenant->slug,
                'before' => $before,
                'after' => $category->only([
                    'name',
                    'code',
                    'status',
                    'description',
                ]),
            ],
            dataClassification: 'internal',
            auditableType:
                PharmacoGeneralItemCategory::class,
            auditableId: $category->id
        );

        return response()->json([
            'message' =>
                'General Item category updated successfully.',
            'category' =>
                $this->serializeCategory($category),
        ]);
    }

    public function items(Request $request): JsonResponse
    {
        $tenant = $request->attributes->get('tenant');

        $items = PharmacoGeneralItem::query()
            ->where('tenant_id', $tenant->id)
            ->with([
                'category',
                'preferredSupplier',
            ])
            ->withSum(
                'stocks as total_quantity_on_hand',
                'quantity_on_hand'
            )
            ->when(
                $request->query('status'),
                fn (Builder $query, string $status) =>
                    $query->where('status', $status)
            )
            ->when(
                $request->query('category_id'),
                fn (Builder $query, $categoryId) =>
                    $query->where(
                        'pharmaco_general_item_category_id',
                        $categoryId
                    )
            )
            ->when(
                $request->query('search'),
                function (
                    Builder $query,
                    string $search
                ): void {
                    $term = '%' . trim($search) . '%';

                    $query->where(
                        function (Builder $inner) use (
                            $term
                        ): void {
                            $inner
                                ->where('name', 'like', $term)
                                ->orWhere(
                                    'code',
                                    'like',
                                    $term
                                );
                        }
                    );
                }
            )
            ->orderBy('name')
            ->get();

        return response()->json([
            'items' => $items
                ->map(fn ($item) =>
                    $this->serializeItem($item))
                ->values(),
        ]);
    }

    public function createItem(
        Request $request,
        AuditLogService $auditLogService,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        $tenant = $request->attributes->get('tenant');

        $validated = $request->validate(
            $this->itemRules($tenant->id)
        );

        $category =
            PharmacoGeneralItemCategory::query()
                ->where('tenant_id', $tenant->id)
                ->where('status', 'active')
                ->find(
                    $validated[
                        'pharmaco_general_item_category_id'
                    ]
                );

        if (! $category) {
            throw ValidationException::withMessages([
                'pharmaco_general_item_category_id' => [
                    'Select an active General Item category.',
                ],
            ]);
        }

        $supplier = null;

        if (! empty(
            $validated['preferred_supplier_id'] ?? null
        )) {
            $supplier = PharmacoSupplier::query()
                ->where('tenant_id', $tenant->id)
                ->where('status', 'active')
                ->find(
                    $validated['preferred_supplier_id']
                );

            if (! $supplier) {
                throw ValidationException::withMessages([
                    'preferred_supplier_id' => [
                        'Selected preferred supplier is invalid.',
                    ],
                ]);
            }
        }

        $item = PharmacoGeneralItem::query()
            ->create([
                'uuid' => (string) Str::uuid(),
                'tenant_id' => $tenant->id,
                'pharmaco_general_item_category_id' =>
                    $category->id,
                'preferred_supplier_id' =>
                    $supplier?->id,
                'name' => trim($validated['name']),
                'code' => Str::upper(
                    trim($validated['code'])
                ),
                'unit_of_measure' =>
                    trim(
                        $validated['unit_of_measure']
                    ),
                'reorder_level' =>
                    $validated['reorder_level'] ?? 0,
                'minimum_stock_level' =>
                    $validated[
                        'minimum_stock_level'
                    ] ?? 0,
                'track_stock' =>
                    $validated['track_stock'] ?? true,
                'status' =>
                    $validated['status'] ?? 'active',
                'description' =>
                    $validated['description'] ?? null,
                'metadata' => [
                    'source' =>
                        'general_item_master_admin',
                ],
            ]);

        $item->load([
            'category',
            'preferredSupplier',
        ]);

        $scope = $scopeResolver->resolveForUser(
            $request->user()
        );

        $auditLogService->record(
            action:
                'pharmaco.general_item.created',
            scope: $scope,
            metadata: [
                'tenant_slug' => $tenant->slug,
                'general_item_id' => $item->id,
                'code' => $item->code,
            ],
            dataClassification: 'internal',
            auditableType: PharmacoGeneralItem::class,
            auditableId: $item->id
        );

        return response()->json([
            'message' =>
                'General Item Master record created successfully.',
            'item' => $this->serializeItem($item),
        ], 201);
    }

    public function updateItem(
        Request $request,
        PharmacoGeneralItem $item,
        AuditLogService $auditLogService,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        $tenant = $request->attributes->get('tenant');

        abort_unless(
            (int) $item->tenant_id ===
                (int) $tenant->id,
            404
        );

        $validated = $request->validate(
            $this->itemRules(
                $tenant->id,
                $item->id,
                true
            )
        );

        if (
            array_key_exists(
                'pharmaco_general_item_category_id',
                $validated
            )
        ) {
            $category =
                PharmacoGeneralItemCategory::query()
                    ->where('tenant_id', $tenant->id)
                    ->where('status', 'active')
                    ->find(
                        $validated[
                            'pharmaco_general_item_category_id'
                        ]
                    );

            if (! $category) {
                throw ValidationException::withMessages([
                    'pharmaco_general_item_category_id' => [
                        'Select an active General Item category.',
                    ],
                ]);
            }
        }

        if (
            array_key_exists(
                'preferred_supplier_id',
                $validated
            )
            && $validated['preferred_supplier_id']
        ) {
            $supplier = PharmacoSupplier::query()
                ->where('tenant_id', $tenant->id)
                ->where('status', 'active')
                ->find(
                    $validated['preferred_supplier_id']
                );

            if (! $supplier) {
                throw ValidationException::withMessages([
                    'preferred_supplier_id' => [
                        'Selected preferred supplier is invalid.',
                    ],
                ]);
            }
        }

        $before = $item->toArray();

        if (array_key_exists('code', $validated)) {
            $validated['code'] = Str::upper(
                trim($validated['code'])
            );
        }

        $item->fill($validated);
        $item->save();

        $item->load([
            'category',
            'preferredSupplier',
        ]);

        $scope = $scopeResolver->resolveForUser(
            $request->user()
        );

        $auditLogService->record(
            action:
                'pharmaco.general_item.updated',
            scope: $scope,
            metadata: [
                'tenant_slug' => $tenant->slug,
                'before' => $before,
                'after' => $item->toArray(),
            ],
            dataClassification: 'internal',
            auditableType: PharmacoGeneralItem::class,
            auditableId: $item->id
        );

        return response()->json([
            'message' =>
                'General Item Master record updated successfully.',
            'item' => $this->serializeItem($item),
        ]);
    }

    public function locations(Request $request): JsonResponse
    {
        $tenant = $request->attributes->get('tenant');

        $locations =
            PharmacoGeneralItemLocation::query()
                ->where('tenant_id', $tenant->id)
                ->with('branch')
                ->withCount('stocks')
                ->when(
                    $request->query('branch_id'),
                    fn (
                        Builder $query,
                        $branchId
                    ) =>
                        $query->where(
                            'branch_id',
                            $branchId
                        )
                )
                ->when(
                    $request->query('status'),
                    fn (
                        Builder $query,
                        string $status
                    ) =>
                        $query->where(
                            'status',
                            $status
                        )
                )
                ->orderBy('name')
                ->get();

        return response()->json([
            'locations' => $locations
                ->map(fn ($location) =>
                    $this->serializeLocation($location))
                ->values(),
        ]);
    }

    public function createLocation(
        Request $request,
        AuditLogService $auditLogService,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        $tenant = $request->attributes->get('tenant');

        $validated = $request->validate([
            'branch_id' => [
                'required',
                'integer',
            ],
            'name' => [
                'required',
                'string',
                'max:191',
            ],
            'code' => [
                'required',
                'string',
                'max:100',
            ],
            'location_type' => [
                'required',
                Rule::in([
                    'store',
                    'warehouse',
                    'department',
                    'cupboard',
                    'other',
                ]),
            ],
            'status' => [
                'nullable',
                Rule::in(['active', 'inactive']),
            ],
            'description' => [
                'nullable',
                'string',
                'max:1000',
            ],
        ]);

        $branch = Branch::query()
            ->where('tenant_id', $tenant->id)
            ->where('status', 'active')
            ->find($validated['branch_id']);

        if (! $branch) {
            throw ValidationException::withMessages([
                'branch_id' => [
                    'Select an active branch.',
                ],
            ]);
        }

        $duplicate =
            PharmacoGeneralItemLocation::query()
                ->where('tenant_id', $tenant->id)
                ->where('branch_id', $branch->id)
                ->where(
                    'code',
                    Str::upper(
                        trim($validated['code'])
                    )
                )
                ->exists();

        if ($duplicate) {
            throw ValidationException::withMessages([
                'code' => [
                    'This General Item location code already exists for the selected branch.',
                ],
            ]);
        }

        $location =
            PharmacoGeneralItemLocation::query()
                ->create([
                    'uuid' => (string) Str::uuid(),
                    'tenant_id' => $tenant->id,
                    'branch_id' => $branch->id,
                    'name' => trim($validated['name']),
                    'code' => Str::upper(
                        trim($validated['code'])
                    ),
                    'location_type' =>
                        $validated['location_type'],
                    'status' =>
                        $validated['status']
                        ?? 'active',
                    'description' =>
                        $validated['description']
                        ?? null,
                    'metadata' => [
                        'source' =>
                            'general_item_location_admin',
                    ],
                ]);

        $location->load('branch');

        $scope = $scopeResolver->resolveForUser(
            $request->user()
        );

        $auditLogService->record(
            action:
                'pharmaco.general_item_location.created',
            scope: $scope,
            metadata: [
                'tenant_slug' => $tenant->slug,
                'location_id' => $location->id,
                'branch_id' => $branch->id,
            ],
            dataClassification: 'internal',
            auditableType:
                PharmacoGeneralItemLocation::class,
            auditableId: $location->id
        );

        return response()->json([
            'message' =>
                'General Item stock location created successfully.',
            'location' =>
                $this->serializeLocation($location),
        ], 201);
    }

    public function updateLocation(
        Request $request,
        PharmacoGeneralItemLocation $location,
        AuditLogService $auditLogService,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        $tenant = $request->attributes->get('tenant');

        abort_unless(
            (int) $location->tenant_id ===
                (int) $tenant->id,
            404
        );

        $validated = $request->validate([
            'name' => [
                'sometimes',
                'required',
                'string',
                'max:191',
            ],
            'code' => [
                'sometimes',
                'required',
                'string',
                'max:100',
            ],
            'location_type' => [
                'sometimes',
                Rule::in([
                    'store',
                    'warehouse',
                    'department',
                    'cupboard',
                    'other',
                ]),
            ],
            'status' => [
                'sometimes',
                Rule::in(['active', 'inactive']),
            ],
            'description' => [
                'nullable',
                'string',
                'max:1000',
            ],
        ]);

        if (array_key_exists('code', $validated)) {
            $validated['code'] = Str::upper(
                trim($validated['code'])
            );

            $duplicate =
                PharmacoGeneralItemLocation::query()
                    ->where('tenant_id', $tenant->id)
                    ->where(
                        'branch_id',
                        $location->branch_id
                    )
                    ->where(
                        'code',
                        $validated['code']
                    )
                    ->whereKeyNot($location->id)
                    ->exists();

            if ($duplicate) {
                throw ValidationException::withMessages([
                    'code' => [
                        'This General Item location code already exists for the branch.',
                    ],
                ]);
            }
        }

        $before = $location->toArray();

        $location->fill($validated);
        $location->save();
        $location->load('branch');

        $scope = $scopeResolver->resolveForUser(
            $request->user()
        );

        $auditLogService->record(
            action:
                'pharmaco.general_item_location.updated',
            scope: $scope,
            metadata: [
                'tenant_slug' => $tenant->slug,
                'before' => $before,
                'after' => $location->toArray(),
            ],
            dataClassification: 'internal',
            auditableType:
                PharmacoGeneralItemLocation::class,
            auditableId: $location->id
        );

        return response()->json([
            'message' =>
                'General Item stock location updated successfully.',
            'location' =>
                $this->serializeLocation($location),
        ]);
    }

    public function stock(Request $request): JsonResponse
    {
        $tenant = $request->attributes->get('tenant');

        $stocks = PharmacoGeneralItemStock::query()
            ->where('tenant_id', $tenant->id)
            ->with([
                'item.category',
                'location.branch',
                'branch',
            ])
            ->when(
                $request->query('branch_id'),
                fn (Builder $query, $branchId) =>
                    $query->where(
                        'branch_id',
                        $branchId
                    )
            )
            ->when(
                $request->query('item_id'),
                fn (Builder $query, $itemId) =>
                    $query->where(
                        'pharmaco_general_item_id',
                        $itemId
                    )
            )
            ->orderByDesc('updated_at')
            ->get();

        return response()->json([
            'stocks' => $stocks
                ->map(fn ($stock) =>
                    $this->serializeStock($stock))
                ->values(),
        ]);
    }

    public function summary(Request $request): JsonResponse
    {
        $tenant = $request->attributes->get('tenant');

        $stocks = PharmacoGeneralItemStock::query()
            ->where('tenant_id', $tenant->id)
            ->get();

        $items = PharmacoGeneralItem::query()
            ->where('tenant_id', $tenant->id)
            ->withSum(
                'stocks as total_quantity_on_hand',
                'quantity_on_hand'
            )
            ->get();

        $lowStock = $items->filter(
            fn (PharmacoGeneralItem $item) =>
                (float) (
                    $item->total_quantity_on_hand ?? 0
                )
                <= (float) $item->reorder_level
        );

        return response()->json([
            'summary' => [
                'categories_count' =>
                    PharmacoGeneralItemCategory::query()
                        ->where(
                            'tenant_id',
                            $tenant->id
                        )
                        ->count(),
                'items_count' => $items->count(),
                'locations_count' =>
                    PharmacoGeneralItemLocation::query()
                        ->where(
                            'tenant_id',
                            $tenant->id
                        )
                        ->count(),
                'stock_records_count' =>
                    $stocks->count(),
                'quantity_on_hand' =>
                    (float)
                    $stocks->sum(
                        'quantity_on_hand'
                    ),
                'stock_value' =>
                    round(
                        $stocks->sum(
                            fn (
                                PharmacoGeneralItemStock $stock
                            ) =>
                                (float)
                                $stock->quantity_on_hand
                                * (float)
                                $stock->average_unit_cost
                        ),
                        2
                    ),
                'low_stock_items_count' =>
                    $lowStock->count(),
            ],
        ]);
    }

    public function receivePurchaseOrder(
        Request $request,
        PharmacoPurchaseOrder $purchaseOrder,
        AuditLogService $auditLogService,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        $tenant = $request->attributes->get('tenant');

        abort_unless(
            (int) $purchaseOrder->tenant_id ===
                (int) $tenant->id,
            404
        );

        $validated = $request->validate([
            'pharmaco_general_purchase_order_item_id' => [
                'required',
                'integer',
            ],
            'pharmaco_general_item_location_id' => [
                'required',
                'integer',
            ],
            'quantity_received' => [
                'required',
                'numeric',
                'gt:0',
            ],
            'unit_cost' => [
                'nullable',
                'numeric',
                'gte:0',
            ],
            'reference_number' => [
                'nullable',
                'string',
                'max:100',
            ],
            'received_at' => [
                'nullable',
                'date',
            ],
            'notes' => [
                'nullable',
                'string',
                'max:1000',
            ],

            /*
             * GENERAL_ITEM_PO_DUPLICATE_GUARD_20260714
             */
            'idempotency_key' => [
                'nullable',
                'string',
                'max:100',
            ],
            'duplicate_override' => [
                'sometimes',
                'boolean',
            ],
            'duplicate_check_token' => [
                'nullable',
                'string',
                'max:1000',
            ],
            'duplicate_override_reason' => [
                'nullable',
                'string',
                'max:1000',
            ],
]);

        $validated['idempotency_key'] = trim(
            (string) (
                $validated['idempotency_key']
                ?? $request->header(
                    'Idempotency-Key',
                    ''
                )
            )
        );

        $inventoryReceiptGuard =
            app(
                \App\Services\Inventory\GeneralItemPurchaseOrderReceiptDuplicateGuardService::class
            )->begin(
                $tenant,
                $purchaseOrder,
                $validated,
                $request->user()
            );

        $validated[
            '_inventory_receipt_guard_id'
        ] = $inventoryReceiptGuard?->id;


        [
            $lockedPurchaseOrder,
            $line,
            $stock,
            $movement,
        ] = DB::transaction(
            function () use (
                $request,
                $tenant,
                $purchaseOrder,
                $validated
            ): array {
                $lockedPurchaseOrder =
                    PharmacoPurchaseOrder::query()
                        ->where(
                            'tenant_id',
                            $tenant->id
                        )
                        ->lockForUpdate()
                        ->findOrFail(
                            $purchaseOrder->id
                        );

                if (
                    $lockedPurchaseOrder->purchase_type
                    !== 'general_items'
                ) {
                    throw ValidationException::withMessages([
                        'purchase_order' => [
                            'Only General Items Purchase Orders can be received into General Item Stock.',
                        ],
                    ]);
                }

                if (
                    ! in_array(
                        $lockedPurchaseOrder->status,
                        [
                            'approved',
                            'partially_received',
                        ],
                        true
                    )
                ) {
                    throw ValidationException::withMessages([
                        'purchase_order' => [
                            'The General Items Purchase Order must be approved before receiving.',
                        ],
                    ]);
                }

                $line =
                    PharmacoGeneralPurchaseOrderItem::query()
                        ->where(
                            'tenant_id',
                            $tenant->id
                        )
                        ->where(
                            'pharmaco_purchase_order_id',
                            $lockedPurchaseOrder->id
                        )
                        ->lockForUpdate()
                        ->find(
                            $validated[
                                'pharmaco_general_purchase_order_item_id'
                            ]
                        );

                if (! $line) {
                    throw ValidationException::withMessages([
                        'pharmaco_general_purchase_order_item_id' => [
                            'The selected General Item Purchase Order line does not belong to this order.',
                        ],
                    ]);
                }

                if (! $line->pharmaco_general_item_id) {
                    throw ValidationException::withMessages([
                        'pharmaco_general_purchase_order_item_id' => [
                            'This order line is not linked to General Item Master.',
                        ],
                    ]);
                }

                $generalItem =
                    PharmacoGeneralItem::query()
                        ->where(
                            'tenant_id',
                            $tenant->id
                        )
                        ->where(
                            'status',
                            'active'
                        )
                        ->find(
                            $line
                                ->pharmaco_general_item_id
                        );

                if (! $generalItem) {
                    throw ValidationException::withMessages([
                        'pharmaco_general_purchase_order_item_id' => [
                            'The linked active General Item Master record is unavailable.',
                        ],
                    ]);
                }

                if (! $generalItem->track_stock) {
                    throw ValidationException::withMessages([
                        'pharmaco_general_purchase_order_item_id' => [
                            'The selected General Item is not configured for stock tracking.',
                        ],
                    ]);
                }

                $location =
                    PharmacoGeneralItemLocation::query()
                        ->where(
                            'tenant_id',
                            $tenant->id
                        )
                        ->where(
                            'branch_id',
                            $lockedPurchaseOrder
                                ->branch_id
                        )
                        ->where(
                            'status',
                            'active'
                        )
                        ->find(
                            $validated[
                                'pharmaco_general_item_location_id'
                            ]
                        );

                if (! $location) {
                    throw ValidationException::withMessages([
                        'pharmaco_general_item_location_id' => [
                            'Select an active General Item stock location for the Purchase Order branch.',
                        ],
                    ]);
                }

                $quantityOrdered = round(
                    (float)
                    $line->quantity_ordered,
                    3
                );

                $alreadyReceived = round(
                    (float)
                    $line->quantity_received,
                    3
                );

                $remainingQuantity = round(
                    $quantityOrdered
                    - $alreadyReceived,
                    3
                );

                $quantityReceived = round(
                    (float)
                    $validated[
                        'quantity_received'
                    ],
                    3
                );

                if ($remainingQuantity <= 0) {
                    throw ValidationException::withMessages([
                        'quantity_received' => [
                            'This General Item Purchase Order line has already been fully received.',
                        ],
                    ]);
                }

                if (
                    $quantityReceived
                    > $remainingQuantity
                ) {
                    throw ValidationException::withMessages([
                        'quantity_received' => [
                            'Received quantity exceeds the remaining Purchase Order quantity.',
                        ],
                    ]);
                }

                $unitCost = round(
                    (float) (
                        $validated['unit_cost']
                        ?? $line->unit_cost
                    ),
                    2
                );

                $stock =
                    PharmacoGeneralItemStock::query()
                        ->where(
                            'tenant_id',
                            $tenant->id
                        )
                        ->where(
                            'pharmaco_general_item_id',
                            $generalItem->id
                        )
                        ->where(
                            'pharmaco_general_item_location_id',
                            $location->id
                        )
                        ->lockForUpdate()
                        ->first();

                if (
                    ! empty(
                        $validated[
                            '_inventory_receipt_guard_id'
                        ]
                    )
                ) {
                    app(
                        \App\Services\Inventory\GeneralItemPurchaseOrderReceiptDuplicateGuardService::class
                    )->revalidateOrFail(
                        \App\Models\InventoryReceiptGuard::
                            query()->findOrFail(
                                $validated[
                                    '_inventory_receipt_guard_id'
                                ]
                            ),
                        $tenant,
                        $purchaseOrder,
                        $line,
                        $location,
                        $validated,
                        $request->user()
                    );
                }


                if (! $stock) {
                    $stock =
                        PharmacoGeneralItemStock::query()
                            ->create([
                                'uuid' =>
                                    (string) Str::uuid(),
                                'tenant_id' =>
                                    $tenant->id,
                                'branch_id' =>
                                    $lockedPurchaseOrder
                                        ->branch_id,
                                'pharmaco_general_item_id' =>
                                    $generalItem->id,
                                'pharmaco_general_item_location_id' =>
                                    $location->id,
                                'quantity_on_hand' => 0,
                                'quantity_reserved' => 0,
                                'average_unit_cost' => 0,
                                'last_unit_cost' => 0,
                                'metadata' => [
                                    'source' =>
                                        'general_item_purchase_order_receiving',
                                ],
                            ]);
                }

                $beforeQuantity = round(
                    (float)
                    $stock->quantity_on_hand,
                    3
                );

                $beforeAverageCost = round(
                    (float)
                    $stock->average_unit_cost,
                    2
                );

                $afterQuantity = round(
                    $beforeQuantity
                    + $quantityReceived,
                    3
                );

                $receivedValue =
                    $quantityReceived
                    * $unitCost;

                $averageUnitCost =
                    $afterQuantity > 0
                        ? round(
                            (
                                (
                                    $beforeQuantity
                                    * $beforeAverageCost
                                )
                                + $receivedValue
                            )
                            / $afterQuantity,
                            2
                        )
                        : 0;

                $receivedAt =
                    $validated['received_at']
                    ?? now();

                $stock->quantity_on_hand =
                    $afterQuantity;

                $stock->average_unit_cost =
                    $averageUnitCost;

                $stock->last_unit_cost =
                    $unitCost;

                $stock->last_received_at =
                    $receivedAt;

                $stock->save();

                $newLineQuantity = round(
                    $alreadyReceived
                    + $quantityReceived,
                    3
                );

                $line->quantity_received =
                    $newLineQuantity;

                $line->status =
                    $newLineQuantity
                    >= $quantityOrdered
                        ? 'received'
                        : 'partially_received';

                $line->save();

                $movement =
                    PharmacoGeneralItemMovement::query()
                        ->create([
                            'uuid' =>
                                (string) Str::uuid(),
                            'tenant_id' =>
                                $tenant->id,
                            'branch_id' =>
                                $lockedPurchaseOrder
                                    ->branch_id,
                            'pharmaco_general_item_id' =>
                                $generalItem->id,
                            'pharmaco_general_item_stock_id' =>
                                $stock->id,
                            'pharmaco_general_item_location_id' =>
                                $location->id,
                            'performed_by' =>
                                $request->user()?->id,
                            'movement_type' =>
                                'received',
                            'quantity' =>
                                $quantityReceived,
                            'unit_cost' =>
                                $unitCost,
                            'total_value' =>
                                round(
                                    $receivedValue,
                                    2
                                ),
                            'running_balance' =>
                                $afterQuantity,
                            'reference_type' =>
                                'purchase_order',
                            'reference_number' =>
                                $validated[
                                    'reference_number'
                                ]
                                ?? $lockedPurchaseOrder
                                    ->po_number,
                            'reason' =>
                                $validated['notes']
                                ?? "Received against General Items Purchase Order {$lockedPurchaseOrder->po_number}.",
                            'occurred_at' =>
                                $receivedAt,
                            'metadata' => [
                                'stock_domain' =>
                                    'general_items',
                                'purchase_order_id' =>
                                    $lockedPurchaseOrder
                                        ->id,
                                'purchase_order_number' =>
                                    $lockedPurchaseOrder
                                        ->po_number,
                                'purchase_order_item_id' =>
                                    $line->id,
                                'supplier_id' =>
                                    $lockedPurchaseOrder
                                        ->pharmaco_supplier_id,
                            ],
                        ]);

                if (
                    ! empty(
                        $validated[
                            '_inventory_receipt_guard_id'
                        ]
                    )
                ) {
                    app(
                        \App\Services\Inventory\GeneralItemPurchaseOrderReceiptDuplicateGuardService::class
                    )->complete(
                        \App\Models\InventoryReceiptGuard::
                            query()->findOrFail(
                                $validated[
                                    '_inventory_receipt_guard_id'
                                ]
                            ),
                        $movement,
                        $purchaseOrder,
                        $line
                    );
                }


                $receivingLines =
                    PharmacoGeneralPurchaseOrderItem::query()
                        ->where(
                            'tenant_id',
                            $tenant->id
                        )
                        ->where(
                            'pharmaco_purchase_order_id',
                            $lockedPurchaseOrder->id
                        )
                        ->get([
                            'quantity_ordered',
                            'quantity_received',
                        ]);

                $allReceived =
                    $receivingLines->isNotEmpty()
                    && $receivingLines->every(
                        fn (
                            PharmacoGeneralPurchaseOrderItem
                            $receivingLine
                        ) =>
                            round(
                                (float)
                                $receivingLine
                                    ->quantity_received,
                                3
                            )
                            >= round(
                                (float)
                                $receivingLine
                                    ->quantity_ordered,
                                3
                            )
                    );

                $lockedPurchaseOrder->status =
                    $allReceived
                        ? 'received'
                        : 'partially_received';

                $metadata = is_array(
                    $lockedPurchaseOrder->metadata
                )
                    ? $lockedPurchaseOrder->metadata
                    : [];

                $metadata['receiving_status'] =
                    $allReceived
                        ? 'fully_received'
                        : 'partially_received';

                $metadata[
                    'last_general_item_receipt_at'
                ] = now()->toISOString();

                $lockedPurchaseOrder->metadata =
                    $metadata;

                $lockedPurchaseOrder->save();

                return [
                    $lockedPurchaseOrder,
                    $line,
                    $stock,
                    $movement,
                ];
            }
        );

        $stock->load([
            'item.category',
            'location.branch',
            'branch',
        ]);

        $movement->load([
            'item.category',
            'location.branch',
            'branch',
            'performedBy:id,name,email',
        ]);

        $scope = $scopeResolver->resolveForUser(
            $request->user()
        );

        $auditLogService->record(
            action:
                'pharmaco.general_item_purchase_order.received',
            scope: $scope,
            metadata: [
                'tenant_slug' => $tenant->slug,
                'purchase_order_id' =>
                    $lockedPurchaseOrder->id,
                'purchase_order_number' =>
                    $lockedPurchaseOrder->po_number,
                'purchase_order_item_id' =>
                    $line->id,
                'general_item_id' =>
                    $line->pharmaco_general_item_id,
                'quantity_received' =>
                    (float) $movement->quantity,
                'purchase_order_status' =>
                    $lockedPurchaseOrder->status,
                'running_balance' =>
                    (float)
                    $stock->quantity_on_hand,
            ],
            dataClassification: 'internal',
            auditableType:
                PharmacoGeneralItemMovement::class,
            auditableId: $movement->id
        );

        return response()->json([
            'message' =>
                'General Item Purchase Order stock received successfully.',
            'purchase_order' => [
                'id' =>
                    $lockedPurchaseOrder->id,
                'uuid' =>
                    $lockedPurchaseOrder->uuid,
                'po_number' =>
                    $lockedPurchaseOrder->po_number,
                'purchase_type' =>
                    $lockedPurchaseOrder
                        ->purchase_type,
                'status' =>
                    $lockedPurchaseOrder->status,
            ],
            'purchase_order_item' => [
                'id' => $line->id,
                'pharmaco_general_item_id' =>
                    $line
                        ->pharmaco_general_item_id,
                'item_name' =>
                    $line->item_name,
                'item_code' =>
                    $line->item_code,
                'quantity_ordered' =>
                    (float)
                    $line->quantity_ordered,
                'quantity_received' =>
                    (float)
                    $line->quantity_received,
                'remaining_quantity' =>
                    max(
                        0,
                        round(
                            (float)
                            $line->quantity_ordered
                            - (float)
                            $line->quantity_received,
                            3
                        )
                    ),
                'status' =>
                    $line->status,
            ],
            'stock' =>
                $this->serializeStock($stock),
            'movement' =>
                $this->serializeMovement(
                    $movement
                ),
        ], 201);
    }

    public function receive(
        Request $request,
        AuditLogService $auditLogService,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        return $this->applyStockMovement(
            request: $request,
            movementType: 'received',
            signedQuantityMultiplier: 1,
            auditLogService: $auditLogService,
            scopeResolver: $scopeResolver
        );
    }

    public function issue(
        Request $request,
        AuditLogService $auditLogService,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        return $this->applyStockMovement(
            request: $request,
            movementType: 'issued',
            signedQuantityMultiplier: -1,
            auditLogService: $auditLogService,
            scopeResolver: $scopeResolver
        );
    }

    public function movements(Request $request): JsonResponse
    {
        $tenant = $request->attributes->get('tenant');

        $movements =
            PharmacoGeneralItemMovement::query()
                ->where('tenant_id', $tenant->id)
                ->with([
                    'item.category',
                    'location.branch',
                    'branch',
                    'performedBy:id,name,email',
                ])
                ->when(
                    $request->query('item_id'),
                    fn (Builder $query, $itemId) =>
                        $query->where(
                            'pharmaco_general_item_id',
                            $itemId
                        )
                )
                ->when(
                    $request->query('movement_type'),
                    fn (
                        Builder $query,
                        string $movementType
                    ) =>
                        $query->where(
                            'movement_type',
                            $movementType
                        )
                )
                ->latest('occurred_at')
                ->limit(500)
                ->get();

        return response()->json([
            'movements' => $movements
                ->map(fn ($movement) =>
                    $this->serializeMovement(
                        $movement
                    ))
                ->values(),
        ]);
    }

    private function applyStockMovement(
        Request $request,
        string $movementType,
        int $signedQuantityMultiplier,
        AuditLogService $auditLogService,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        $tenant = $request->attributes->get('tenant');

        $validated = $request->validate([
            'branch_id' => [
                'required',
                'integer',
            ],
            'pharmaco_general_item_id' => [
                'required',
                'integer',
            ],
            'pharmaco_general_item_location_id' => [
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
                'gte:0',
            ],
            'reference_type' => [
                'nullable',
                'string',
                'max:50',
            ],
            'reference_number' => [
                'nullable',
                'string',
                'max:100',
            ],
            'reason' => [
                'nullable',
                'string',
                'max:1000',
            ],
            'occurred_at' => [
                'nullable',
                'date',
            ],

            /*
             * GENERAL_ITEM_RECEIPT_DUPLICATE_GUARD_20260714
             */
            'idempotency_key' => [
                'nullable',
                'string',
                'max:100',
            ],
            'duplicate_override' => [
                'sometimes',
                'boolean',
            ],
            'duplicate_check_token' => [
                'nullable',
                'string',
                'max:1000',
            ],
            'duplicate_override_reason' => [
                'nullable',
                'string',
                'max:1000',
            ],
]);

        $branch = Branch::query()
            ->where('tenant_id', $tenant->id)
            ->where('status', 'active')
            ->find($validated['branch_id']);

        $item = PharmacoGeneralItem::query()
            ->where('tenant_id', $tenant->id)
            ->where('status', 'active')
            ->find(
                $validated[
                    'pharmaco_general_item_id'
                ]
            );

        $location =
            PharmacoGeneralItemLocation::query()
                ->where('tenant_id', $tenant->id)
                ->where('status', 'active')
                ->find(
                    $validated[
                        'pharmaco_general_item_location_id'
                    ]
                );

        if (! $branch) {
            throw ValidationException::withMessages([
                'branch_id' => [
                    'Select an active branch.',
                ],
            ]);
        }

        if (! $item) {
            throw ValidationException::withMessages([
                'pharmaco_general_item_id' => [
                    'Select an active General Item Master record.',
                ],
            ]);
        }

        if (
            ! $location
            || (int) $location->branch_id !==
                (int) $branch->id
        ) {
            throw ValidationException::withMessages([
                'pharmaco_general_item_location_id' => [
                    'Select an active General Item location for the branch.',
                ],
            ]);
        }

        if (! $item->track_stock) {
            throw ValidationException::withMessages([
                'pharmaco_general_item_id' => [
                    'This General Item is not configured for stock tracking.',
                ],
            ]);
        }

        $requestedQuantity =
            round(
                (float) $validated['quantity'],
                3
            );

        $signedQuantity =
            $requestedQuantity
            * $signedQuantityMultiplier;

        $unitCost = round(
            (float) (
                $validated['unit_cost'] ?? 0
            ),
            2
        );

        $validated['idempotency_key'] = trim(
            (string) (
                $validated['idempotency_key']
                ?? $request->header(
                    'Idempotency-Key',
                    ''
                )
            )
        );

        $inventoryReceiptGuard = null;

        if ($movementType === 'received') {
            $inventoryReceiptGuard =
                app(
                    \App\Services\Inventory\GeneralItemReceiptDuplicateGuardService::class
                )->begin(
                    $tenant,
                    $item,
                    $location,
                    $validated,
                    $request->user()
                );
        }

        $validated[
            '_inventory_receipt_guard_id'
        ] = $inventoryReceiptGuard?->id;


        [$stock, $movement] =
            DB::transaction(function () use (
                $request,
                $tenant,
                $branch,
                $item,
                $location,
                $validated,
                $movementType,
                $signedQuantityMultiplier,
                $requestedQuantity,
                $signedQuantity,
                $unitCost
            ): array {
                $stock =
                    PharmacoGeneralItemStock::query()
                        ->where(
                            'tenant_id',
                            $tenant->id
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

                if (
                    $movementType === 'received'
                    && ! empty(
                        $validated[
                            '_inventory_receipt_guard_id'
                        ]
                    )
                ) {
                    app(
                        \App\Services\Inventory\GeneralItemReceiptDuplicateGuardService::class
                    )->revalidateOrFail(
                        \App\Models\InventoryReceiptGuard::
                            query()->findOrFail(
                                $validated[
                                    '_inventory_receipt_guard_id'
                                ]
                            ),
                        $tenant,
                        $item,
                        $location,
                        $validated,
                        $request->user()
                    );
                }


                if (! $stock) {
                    $stock =
                        PharmacoGeneralItemStock::query()
                            ->create([
                                'uuid' =>
                                    (string) Str::uuid(),
                                'tenant_id' =>
                                    $tenant->id,
                                'branch_id' =>
                                    $branch->id,
                                'pharmaco_general_item_id' =>
                                    $item->id,
                                'pharmaco_general_item_location_id' =>
                                    $location->id,
                                'quantity_on_hand' => 0,
                                'quantity_reserved' => 0,
                                'average_unit_cost' => 0,
                                'last_unit_cost' => 0,
                                'metadata' => [
                                    'source' =>
                                        'general_item_stock_ledger',
                                ],
                            ]);
                }

                $beforeQuantity =
                    (float) $stock->quantity_on_hand;

                if (
                    $signedQuantityMultiplier < 0
                    && $beforeQuantity
                        < $requestedQuantity
                ) {
                    throw ValidationException::withMessages([
                        'quantity' => [
                            'General Item issue quantity exceeds available stock.',
                        ],
                    ]);
                }

                $afterQuantity =
                    round(
                        $beforeQuantity
                        + $signedQuantity,
                        3
                    );

                $averageUnitCost =
                    (float) $stock->average_unit_cost;

                if (
                    $signedQuantityMultiplier > 0
                    && $afterQuantity > 0
                ) {
                    $existingValue =
                        $beforeQuantity
                        * $averageUnitCost;

                    $receivedValue =
                        $requestedQuantity
                        * $unitCost;

                    $averageUnitCost = round(
                        (
                            $existingValue
                            + $receivedValue
                        )
                        / $afterQuantity,
                        2
                    );
                }

                $stock->quantity_on_hand =
                    $afterQuantity;

                $stock->average_unit_cost =
                    $averageUnitCost;

                if ($signedQuantityMultiplier > 0) {
                    $stock->last_unit_cost =
                        $unitCost;

                    $stock->last_received_at =
                        $validated['occurred_at']
                        ?? now();
                } else {
                    $stock->last_issued_at =
                        $validated['occurred_at']
                        ?? now();
                }

                $stock->save();

                $movementCost =
                    $unitCost > 0
                        ? $unitCost
                        : $averageUnitCost;

                $movement =
                    PharmacoGeneralItemMovement::query()
                        ->create([
                            'uuid' =>
                                (string) Str::uuid(),
                            'tenant_id' =>
                                $tenant->id,
                            'branch_id' =>
                                $branch->id,
                            'pharmaco_general_item_id' =>
                                $item->id,
                            'pharmaco_general_item_stock_id' =>
                                $stock->id,
                            'pharmaco_general_item_location_id' =>
                                $location->id,
                            'performed_by' =>
                                $request->user()?->id,
                            'movement_type' =>
                                $movementType,
                            'quantity' =>
                                $signedQuantity,
                            'unit_cost' =>
                                $movementCost,
                            'total_value' =>
                                round(
                                    abs($signedQuantity)
                                    * $movementCost,
                                    2
                                ),
                            'running_balance' =>
                                $afterQuantity,
                            'reference_type' =>
                                $validated[
                                    'reference_type'
                                ] ?? 'manual',
                            'reference_number' =>
                                $validated[
                                    'reference_number'
                                ] ?? null,
                            'reason' =>
                                $validated['reason']
                                ?? null,
                            'occurred_at' =>
                                $validated[
                                    'occurred_at'
                                ] ?? now(),
                            'metadata' => [
                                'stock_domain' =>
                                    'general_items',
                            ],
                        ]);

                if (
                    $movementType === 'received'
                    && ! empty(
                        $validated[
                            '_inventory_receipt_guard_id'
                        ]
                    )
                ) {
                    app(
                        \App\Services\Inventory\GeneralItemReceiptDuplicateGuardService::class
                    )->complete(
                        \App\Models\InventoryReceiptGuard::
                            query()->findOrFail(
                                $validated[
                                    '_inventory_receipt_guard_id'
                                ]
                            ),
                        $movement
                    );
                }


                return [$stock, $movement];
            });

        $stock->load([
            'item.category',
            'location.branch',
            'branch',
        ]);

        $movement->load([
            'item.category',
            'location.branch',
            'branch',
            'performedBy:id,name,email',
        ]);

        $scope = $scopeResolver->resolveForUser(
            $request->user()
        );

        $auditLogService->record(
            action:
                "pharmaco.general_item_stock.{$movementType}",
            scope: $scope,
            metadata: [
                'tenant_slug' => $tenant->slug,
                'general_item_id' => $item->id,
                'location_id' => $location->id,
                'quantity' => $signedQuantity,
                'running_balance' =>
                    (float) $stock->quantity_on_hand,
            ],
            dataClassification: 'internal',
            auditableType:
                PharmacoGeneralItemMovement::class,
            auditableId: $movement->id
        );

        return response()->json([
            'message' =>
                $movementType === 'received'
                    ? 'General Item stock received successfully.'
                    : 'General Item stock issued successfully.',
            'stock' => $this->serializeStock($stock),
            'movement' =>
                $this->serializeMovement($movement),
        ], 201);
    }

    private function itemRules(
        int $tenantId,
        ?int $ignoreItemId = null,
        bool $updating = false
    ): array {
        $required = $updating
            ? ['sometimes', 'required']
            : ['required'];

        return [
            'pharmaco_general_item_category_id' => [
                ...$required,
                'integer',
            ],
            'preferred_supplier_id' => [
                'nullable',
                'integer',
            ],
            'name' => [
                ...$required,
                'string',
                'max:191',
            ],
            'code' => [
                ...$required,
                'string',
                'max:100',
                Rule::unique(
                    'pharmaco_general_items',
                    'code'
                )
                    ->where(
                        fn ($query) =>
                            $query->where(
                                'tenant_id',
                                $tenantId
                            )
                    )
                    ->ignore($ignoreItemId),
            ],
            'unit_of_measure' => [
                ...$required,
                'string',
                'max:50',
            ],
            'reorder_level' => [
                'nullable',
                'numeric',
                'gte:0',
            ],
            'minimum_stock_level' => [
                'nullable',
                'numeric',
                'gte:0',
            ],
            'track_stock' => [
                'nullable',
                'boolean',
            ],
            'status' => [
                'nullable',
                Rule::in([
                    'active',
                    'inactive',
                    'discontinued',
                ]),
            ],
            'description' => [
                'nullable',
                'string',
                'max:1000',
            ],
        ];
    }

    private function serializeCategory(
        PharmacoGeneralItemCategory $category
    ): array {
        return [
            'id' => $category->id,
            'uuid' => $category->uuid,
            'name' => $category->name,
            'code' => $category->code,
            'status' => $category->status,
            'description' => $category->description,
            'items_count' =>
                $category->items_count ?? null,
            'metadata' => $category->metadata ?? [],
        ];
    }

    private function serializeItem(
        PharmacoGeneralItem $item
    ): array {
        return [
            'id' => $item->id,
            'uuid' => $item->uuid,
            'name' => $item->name,
            'code' => $item->code,
            'unit_of_measure' =>
                $item->unit_of_measure,
            'reorder_level' =>
                (float) $item->reorder_level,
            'minimum_stock_level' =>
                (float) $item->minimum_stock_level,
            'track_stock' =>
                (bool) $item->track_stock,
            'status' => $item->status,
            'description' => $item->description,
            'total_quantity_on_hand' =>
                isset($item->total_quantity_on_hand)
                    ? (float)
                        $item->total_quantity_on_hand
                    : null,
            'category' => $item->category
                ? $this->serializeCategory(
                    $item->category
                )
                : null,
            'preferred_supplier' =>
                $item->preferredSupplier
                    ? [
                        'id' =>
                            $item
                                ->preferredSupplier
                                ->id,
                        'name' =>
                            $item
                                ->preferredSupplier
                                ->name,
                        'supplier_code' =>
                            $item
                                ->preferredSupplier
                                ->supplier_code,
                    ]
                    : null,
            'metadata' => $item->metadata ?? [],
        ];
    }

    private function serializeLocation(
        PharmacoGeneralItemLocation $location
    ): array {
        return [
            'id' => $location->id,
            'uuid' => $location->uuid,
            'name' => $location->name,
            'code' => $location->code,
            'location_type' =>
                $location->location_type,
            'status' => $location->status,
            'description' => $location->description,
            'stocks_count' =>
                $location->stocks_count ?? null,
            'branch' => $location->branch
                ? [
                    'id' => $location->branch->id,
                    'name' => $location->branch->name,
                    'code' => $location->branch->code,
                ]
                : null,
            'metadata' => $location->metadata ?? [],
        ];
    }

    private function serializeStock(
        PharmacoGeneralItemStock $stock
    ): array {
        return [
            'id' => $stock->id,
            'uuid' => $stock->uuid,
            'quantity_on_hand' =>
                (float) $stock->quantity_on_hand,
            'quantity_reserved' =>
                (float) $stock->quantity_reserved,
            'available_quantity' =>
                max(
                    0,
                    (float) $stock->quantity_on_hand
                    - (float) $stock->quantity_reserved
                ),
            'average_unit_cost' =>
                (float) $stock->average_unit_cost,
            'last_unit_cost' =>
                (float) $stock->last_unit_cost,
            'stock_value' =>
                round(
                    (float) $stock->quantity_on_hand
                    * (float)
                        $stock->average_unit_cost,
                    2
                ),
            'last_received_at' =>
                $stock->last_received_at
                    ?->toISOString(),
            'last_issued_at' =>
                $stock->last_issued_at
                    ?->toISOString(),
            'item' => $stock->item
                ? $this->serializeItem($stock->item)
                : null,
            'location' => $stock->location
                ? $this->serializeLocation(
                    $stock->location
                )
                : null,
            'metadata' => $stock->metadata ?? [],
        ];
    }

    private function serializeMovement(
        PharmacoGeneralItemMovement $movement
    ): array {
        return [
            'id' => $movement->id,
            'uuid' => $movement->uuid,
            'movement_type' =>
                $movement->movement_type,
            'quantity' =>
                (float) $movement->quantity,
            'unit_cost' =>
                (float) $movement->unit_cost,
            'total_value' =>
                (float) $movement->total_value,
            'running_balance' =>
                (float) $movement->running_balance,
            'reference_type' =>
                $movement->reference_type,
            'reference_number' =>
                $movement->reference_number,
            'reason' => $movement->reason,
            'occurred_at' =>
                $movement->occurred_at
                    ?->toISOString(),
            'item' => $movement->item
                ? $this->serializeItem(
                    $movement->item
                )
                : null,
            'location' => $movement->location
                ? $this->serializeLocation(
                    $movement->location
                )
                : null,
            'performed_by' =>
                $movement->performedBy
                    ? [
                        'id' =>
                            $movement
                                ->performedBy
                                ->id,
                        'name' =>
                            $movement
                                ->performedBy
                                ->name,
                        'email' =>
                            $movement
                                ->performedBy
                                ->email,
                    ]
                    : null,
            'metadata' => $movement->metadata ?? [],
        ];
    }

    public function tenantCategories(
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

    public function tenantUpdateCategory(
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

    public function tenantItems(
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

    public function tenantUpdateItem(
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

    public function tenantLocations(
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

    public function tenantStock(
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

    public function tenantMovements(
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

    public function tenantReceive(
        Request $request,
        string $tenantSlug
    ): JsonResponse {
        return $this->applyMovement(
            $request,
            $tenantSlug,
            'receipt'
        );
    }

    public function tenantIssue(
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

            /*
             * TENANT_GENERAL_ITEM_DUPLICATE_GUARD_20260714
             */
            'idempotency_key' => [
                'nullable',
                'string',
                'max:100',
            ],
            'duplicate_override' => [
                'sometimes',
                'boolean',
            ],
            'duplicate_check_token' => [
                'nullable',
                'string',
                'max:1000',
            ],
            'duplicate_override_reason' => [
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


        $validated['idempotency_key'] = trim(
            (string) (
                $validated['idempotency_key']
                ?? $request->header(
                    'Idempotency-Key',
                    ''
                )
            )
        );

        $validated['reference_type'] =
            $validated['reference_type']
            ?? 'tenant_operational';

        $validated['reference_number'] =
            $validated['reference_number']
            ?? $validated['reference']
            ?? null;


        /*
         * TENANT_DUPLICATE_GUARD_MODEL_HYDRATION_20260714
         *
         * assertTenantRecord() intentionally returns stdClass records
         * for the legacy query-builder workflow. The duplicate guard
         * requires tenant-scoped Eloquent models so its typed contract,
         * relationships and serialization remain safe.
         */
        $duplicateGuardItem =
            \App\Models\PharmacoGeneralItem::query()
                ->where(
                    'tenant_id',
                    $tenant->id
                )
                ->findOrFail(
                    (int) $item->id
                );

        $duplicateGuardLocation =
            \App\Models\PharmacoGeneralItemLocation::
                query()
                ->where(
                    'tenant_id',
                    $tenant->id
                )
                ->findOrFail(
                    (int) $location->id
                );

        $inventoryReceiptGuard = null;

        if ($movementType === 'receipt') {
            $inventoryReceiptGuard =
                app(
                    \App\Services\Inventory\GeneralItemReceiptDuplicateGuardService::class
                )->begin(
                    $tenant,
                    $duplicateGuardItem,
                    $duplicateGuardLocation,
                    $validated,
                    $request->user()
                );
        }

        $validated[
            '_inventory_receipt_guard_id'
        ] = $inventoryReceiptGuard?->id;

        DB::transaction(function () use (
            $request,
            $tenant,
            $item,
            $location,
            $duplicateGuardItem,
            $duplicateGuardLocation,
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

            if (
                $movementType === 'receipt'
                && ! empty(
                    $validated[
                        '_inventory_receipt_guard_id'
                    ]
                )
            ) {
                app(
                    \App\Services\Inventory\GeneralItemReceiptDuplicateGuardService::class
                )->revalidateOrFail(
                    \App\Models\InventoryReceiptGuard::
                        query()->findOrFail(
                            $validated[
                                '_inventory_receipt_guard_id'
                            ]
                        ),
                    $tenant,
                    $duplicateGuardItem,
                    $duplicateGuardLocation,
                    $validated,
                    $request->user()
                );
            }


            if (! $stock) {
                $stockId = DB::table(
                    'pharmaco_general_item_stocks'
                )->insertGetId([
                    'uuid' => (string) Str::uuid(),
                    'tenant_id' => $tenant->id,
                    'branch_id' =>
                        (int) $location->branch_id,
                    'pharmaco_general_item_id' =>
                        $item->id,
                    'pharmaco_general_item_location_id' =>
                        $location->id,
                    'quantity_on_hand' => 0,
                    'quantity_reserved' => 0,
                    'average_unit_cost' =>
                        $unitCost,
                    'last_unit_cost' =>
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

            $movementId = DB::table(
                'pharmaco_general_item_movements'
            )->insertGetId([
                'uuid' => (string) Str::uuid(),
                'tenant_id' => $tenant->id,
                'branch_id' =>
                    (int) $location->branch_id,
                'pharmaco_general_item_id' =>
                    $item->id,
                'pharmaco_general_item_stock_id' =>
                    $stock->id,
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
                'total_value' =>
                    round(
                        abs($quantity)
                        * $unitCost,
                        2
                    ),
                'running_balance' =>
                    $newQuantity,
                'reference_type' =>
                    'tenant_api',
                'reference_number' =>
                    $validated['reference']
                    ?? null,
                'reference' =>
                    $validated['reference']
                    ?? null,
                'department' =>
                    $validated['department']
                    ?? null,
                'reason' =>
                    $validated['notes']
                    ?? null,
                'notes' =>
                    $validated['notes']
                    ?? null,
                'occurred_at' => now(),
                'performed_by' =>
                    $request->user()?->id,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            $movement =
                \App\Models\PharmacoGeneralItemMovement::
                    query()
                    ->where(
                        'tenant_id',
                        $tenant->id
                    )
                    ->findOrFail($movementId);

            if (
                $movementType === 'receipt'
                && ! empty(
                    $validated[
                        '_inventory_receipt_guard_id'
                    ]
                )
            ) {
                app(
                    \App\Services\Inventory\GeneralItemReceiptDuplicateGuardService::class
                )->complete(
                    \App\Models\InventoryReceiptGuard::
                        query()->findOrFail(
                            $validated[
                                '_inventory_receipt_guard_id'
                            ]
                        ),
                    $movement
                );
            }

        });

        return response()->json([
            'message' =>
                $movementType === 'receipt'
                    ? 'General Item stock received successfully.'
                    : 'General Item stock issued successfully.',
        ], 201);
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

    private function movementQuery(
        Tenant $tenant
    ): \Illuminate\Database\Query\Builder {
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
            'uuid' => (string) Str::uuid(),
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

        abort_if(
            empty($validated['category_id']),
            422,
            'A General Item category is required.'
        );

        $categoryId = (int)
            $validated['category_id'];

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
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $tenant->id,
            'category_id' => $categoryId,
            'pharmaco_general_item_category_id' =>
                $categoryId,
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
            'reorder_level' =>
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

        $branchId =
            $validated['branch_id']
            ?? DB::table('branches')
                ->where(
                    'tenant_id',
                    $tenant->id
                )
                ->where(
                    'status',
                    'active'
                )
                ->orderBy('id')
                ->value('id');

        abort_if(
            ! $branchId,
            422,
            'An active branch is required for this General Item location.'
        );

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
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $tenant->id,
            'branch_id' => (int) $branchId,
            'stock_location_id' =>
                $validated[
                    'stock_location_id'
                ]
                ?? null,
            'code' => $code,
            'name' =>
                trim($validated['name']),
            'location_type' => 'store',
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
