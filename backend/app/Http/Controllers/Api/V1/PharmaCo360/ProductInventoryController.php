<?php

namespace App\Http\Controllers\Api\V1\PharmaCo360;

use App\Http\Controllers\Controller;
use App\Models\BulkOperationRun;
use App\Models\PharmacoPurchaseOrderItem;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\StockBatch;
use App\Models\StockLocation;
use App\Models\StockMovement;
use App\Services\Access\ScopeResolver;
use App\Services\Auth\UserAccessProfileService;
use App\Services\Audit\AuditLogService;
use App\Services\PharmaCo360\ProductSellingUnitSuggestionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

use App\Models\Tenant;
class ProductInventoryController extends Controller
{
    public function products(Request $request): JsonResponse
    {
        $tenant = $request->attributes->get('tenant');

        $products = Product::query()
            ->with('category')
            ->where('tenant_id', $tenant->id)
            ->when(
                $request->query('status', 'active'),
                fn ($query, $status) => $status === 'all' ? $query : $query->where('status', $status)
            )
            ->when($request->query('product_type'), fn ($query, $type) => $query->where('product_type', $type))
            ->when($request->query('search'), function ($query, $search) {
                $term = '%' . trim((string) $search) . '%';

                $query->where(function ($searchQuery) use ($term) {
                    $searchQuery
                        ->where('name', 'like', $term)
                        ->orWhere('generic_name', 'like', $term)
                        ->orWhere('brand_name', 'like', $term)
                        ->orWhere('sku', 'like', $term)
                        ->orWhere('barcode', 'like', $term)
                        ->orWhere('registration_number', 'like', $term);
                });
            })
            ->when($request->query('category_code'), function ($query, $categoryCode) use ($tenant) {
                if ($categoryCode === 'all') {
                    return;
                }

                $query->whereHas('category', fn ($categoryQuery) => $categoryQuery
                    ->where('tenant_id', $tenant->id)
                    ->where('code', $categoryCode)
                );
            })
            ->withSum('stockBatches as total_quantity_on_hand', 'quantity_on_hand')
            ->withSum('stockBatches as total_quantity_reserved', 'quantity_reserved')
            ->orderBy('sku')
            ->orderBy('name');

        $totalProducts = (clone $products)->count();
        $perPage = min(max((int) $request->query('per_page', 0), 0), 5000);

        if ($perPage > 0) {
            $products->limit($perPage);
        }

        $products = $products
            ->get()
            ->map(fn (Product $product) => $this->serializeProduct($product, includeStockSummary: true))
            ->values();

        return response()->json([
            'tenant' => $this->tenantPayload($tenant),
            'products' => $products,
            'meta' => [
                'total' => $totalProducts,
                'returned' => $products->count(),
                'per_page' => $perPage > 0 ? $perPage : null,
                'limited' => $perPage > 0 && $products->count() < $totalProducts,
            ],
        ]);
    }

    public function product(Request $request, Product $product): JsonResponse
    {
        $tenant = $request->attributes->get('tenant');

        if ((int) $product->tenant_id !== (int) $tenant->id) {
            abort(404);
        }

        $product->load([
            'category',
            'stockBatches' => fn ($query) => $query->orderBy('expiry_date'),
            'stockBatches.stockLocation',
            'stockBatches.branch',
        ]);

        $batches = $product->stockBatches
            ->map(fn (StockBatch $batch) => $this->serializeBatch($batch))
            ->values();

        return response()->json([
            'tenant' => $this->tenantPayload($tenant),
            'product' => $this->serializeProduct($product, includeStockSummary: true),
            'stock_batches' => $batches,
        ]);
    }

    public function productCategories(Request $request): JsonResponse
    {
        $tenant = $request->attributes->get('tenant');

        $categories = ProductCategory::query()
            ->where('tenant_id', $tenant->id)
            ->withCount('products')
            ->orderBy('name')
            ->get()
            ->map(fn (ProductCategory $category) => $this->serializeCategory($category))
            ->values();

        return response()->json([
            'tenant' => $this->tenantPayload($tenant),
            'categories' => $categories,
        ]);
    }

    public function createProductCategory(
        Request $request,
        AuditLogService $auditLogService,
        ScopeResolver $scopeResolver
    ): JsonResponse
    {
        $tenant = $request->attributes->get('tenant');

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:191'],
            'code' => [
                'required',
                'string',
                'max:100',
                Rule::unique('product_categories', 'code')->where('tenant_id', $tenant->id),
            ],
            'category_type' => ['nullable', 'string', 'max:50'],
            'status' => ['nullable', 'string', 'max:30'],
            'description' => ['nullable', 'string', 'max:1000'],
        ]);

        $category = ProductCategory::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $tenant->id,
            'name' => $validated['name'],
            'code' => strtoupper($validated['code']),
            'category_type' => $validated['category_type'] ?? 'medicine',
            'status' => $validated['status'] ?? 'active',
            'description' => $validated['description'] ?? null,
            'metadata' => [
                'created_from' => 'pharmaco_inventory_setup_api',
            ],
        ]);

        $scope = $scopeResolver->resolveForUser($request->user());

        $auditLogService->record(
            action: 'pharmaco.product_category.created',
            scope: $scope,
            metadata: [
                'tenant_slug' => $tenant->slug,
                'category_code' => $category->code,
                'category_name' => $category->name,
            ],
            dataClassification: 'internal',
            auditableType: ProductCategory::class,
            auditableId: $category->id
        );

        return response()->json([
            'message' => 'Product category created successfully.',
            'tenant' => $this->tenantPayload($tenant),
            'category' => $this->serializeCategory($category),
        ], 201);
    }

    public function updateProductCategory(
        Request $request,
        ProductCategory $productCategory,
        AuditLogService $auditLogService,
        ScopeResolver $scopeResolver
    ): JsonResponse
    {
        $tenant = $request->attributes->get('tenant');

        abort_unless((int) $productCategory->tenant_id === (int) $tenant->id, 404);

        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:191'],
            'code' => [
                'sometimes',
                'string',
                'max:100',
                Rule::unique('product_categories', 'code')
                    ->where('tenant_id', $tenant->id)
                    ->ignore($productCategory->id),
            ],
            'category_type' => ['sometimes', 'string', 'max:50'],
            'status' => ['sometimes', 'string', 'max:30'],
            'description' => ['nullable', 'string', 'max:1000'],
        ]);

        if (array_key_exists('code', $validated)) {
            $validated['code'] = strtoupper($validated['code']);
        }

        $before = $productCategory->only(['name', 'code', 'category_type', 'status', 'description']);

        $productCategory->fill($validated);
        $productCategory->save();

        $scope = $scopeResolver->resolveForUser($request->user());

        $auditLogService->record(
            action: 'pharmaco.product_category.updated',
            scope: $scope,
            metadata: [
                'tenant_slug' => $tenant->slug,
                'category_code' => $productCategory->code,
                'before' => $before,
                'after' => $productCategory->only(['name', 'code', 'category_type', 'status', 'description']),
            ],
            dataClassification: 'internal',
            auditableType: ProductCategory::class,
            auditableId: $productCategory->id
        );

        return response()->json([
            'message' => 'Product category updated successfully.',
            'tenant' => $this->tenantPayload($tenant),
            'category' => $this->serializeCategory($productCategory),
        ]);
    }

    public function locations(Request $request): JsonResponse
    {
        $tenant = $request->attributes->get('tenant');

        $locations = StockLocation::query()
            ->with('branch')
            ->where('tenant_id', $tenant->id)
            ->when($request->query('branch_id'), fn ($query, $branchId) => $query->where('branch_id', $branchId))
            ->when($request->query('status'), fn ($query, $status) => $query->where('status', $status))
            ->withCount('stockBatches')
            ->orderBy('name')
            ->get()
            ->map(fn (StockLocation $location) => [
                'id' => $location->id,
                'uuid' => $location->uuid,
                'name' => $location->name,
                'code' => $location->code,
                'location_type' => $location->location_type,
                'status' => $location->status,
                'branch' => [
                    'id' => $location->branch->id,
                    'name' => $location->branch->name,
                    'code' => $location->branch->code,
                ],
                'stock_batches_count' => $location->stock_batches_count,
                'metadata' => $location->metadata ?? [],
            ])
            ->values();

        return response()->json([
            'tenant' => $this->tenantPayload($tenant),
            'locations' => $locations,
        ]);
    }

    public function createStockLocation(
        Request $request,
        AuditLogService $auditLogService,
        ScopeResolver $scopeResolver
    ): JsonResponse
    {
        $tenant = $request->attributes->get('tenant');

        $validated = $request->validate([
            'branch_id' => [
                'required',
                'integer',
                Rule::exists('branches', 'id')->where(fn ($query) => $query->where('tenant_id', $tenant->id)),
            ],
            'name' => ['required', 'string', 'max:191'],
            'code' => [
                'required',
                'string',
                'max:100',
                Rule::unique('stock_locations', 'code')->where('branch_id', $request->input('branch_id')),
            ],
            'location_type' => ['nullable', 'string', 'max:50'],
            'status' => ['nullable', 'string', 'max:30'],
        ]);

        $location = StockLocation::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $tenant->id,
            'branch_id' => $validated['branch_id'],
            'name' => $validated['name'],
            'code' => strtoupper($validated['code']),
            'location_type' => $validated['location_type'] ?? 'store',
            'status' => $validated['status'] ?? 'active',
            'metadata' => [
                'created_from' => 'pharmaco_inventory_setup_api',
            ],
        ]);

        $scope = $scopeResolver->resolveForUser($request->user());

        $auditLogService->record(
            action: 'pharmaco.stock_location.created',
            scope: $scope,
            metadata: [
                'tenant_slug' => $tenant->slug,
                'location_code' => $location->code,
                'location_name' => $location->name,
                'branch_id' => $location->branch_id,
            ],
            dataClassification: 'internal',
            auditableType: StockLocation::class,
            auditableId: $location->id
        );

        return response()->json([
            'message' => 'Stock location created successfully.',
            'tenant' => $this->tenantPayload($tenant),
            'location' => $this->serializeLocation($location->load('branch')),
        ], 201);
    }

    public function updateStockLocation(
        Request $request,
        StockLocation $stockLocation,
        AuditLogService $auditLogService,
        ScopeResolver $scopeResolver
    ): JsonResponse
    {
        $tenant = $request->attributes->get('tenant');

        abort_unless((int) $stockLocation->tenant_id === (int) $tenant->id, 404);

        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:191'],
            'code' => [
                'sometimes',
                'string',
                'max:100',
                Rule::unique('stock_locations', 'code')
                    ->where('branch_id', $stockLocation->branch_id)
                    ->ignore($stockLocation->id),
            ],
            'location_type' => ['sometimes', 'string', 'max:50'],
            'status' => ['sometimes', 'string', 'max:30'],
        ]);

        if (array_key_exists('code', $validated)) {
            $validated['code'] = strtoupper($validated['code']);
        }

        $before = $stockLocation->only(['name', 'code', 'location_type', 'status']);

        $stockLocation->fill($validated);
        $stockLocation->save();

        $scope = $scopeResolver->resolveForUser($request->user());

        $auditLogService->record(
            action: 'pharmaco.stock_location.updated',
            scope: $scope,
            metadata: [
                'tenant_slug' => $tenant->slug,
                'location_code' => $stockLocation->code,
                'before' => $before,
                'after' => $stockLocation->only(['name', 'code', 'location_type', 'status']),
            ],
            dataClassification: 'internal',
            auditableType: StockLocation::class,
            auditableId: $stockLocation->id
        );

        return response()->json([
            'message' => 'Stock location updated successfully.',
            'tenant' => $this->tenantPayload($tenant),
            'location' => $this->serializeLocation($stockLocation->load('branch')),
        ]);
    }

    public function deleteStockLocation(
        Request $request,
        StockLocation $stockLocation,
        AuditLogService $auditLogService,
        ScopeResolver $scopeResolver
    ): JsonResponse
    {
        $tenant = $request->attributes->get('tenant');

        abort_unless((int) $stockLocation->tenant_id === (int) $tenant->id, 404);

        $stockLocation->loadCount('stockBatches');

        if ((int) $stockLocation->stock_batches_count > 0) {
            throw ValidationException::withMessages([
                'stock_location' => 'This stock location is linked to stock batches. Move or replace the batches before deleting it.',
            ]);
        }

        $before = $stockLocation->only(['name', 'code', 'location_type', 'status', 'branch_id']);

        $scope = $scopeResolver->resolveForUser($request->user());

        $stockLocation->delete();

        $auditLogService->record(
            action: 'pharmaco.stock_location.deleted',
            scope: $scope,
            metadata: [
                'tenant_slug' => $tenant->slug,
                'before' => $before,
            ],
            dataClassification: 'internal',
            auditableType: StockLocation::class,
            auditableId: $stockLocation->id
        );

        return response()->json([
            'message' => 'Stock location deleted successfully.',
        ]);
    }

    public function nearExpiryBatches(
        Request $request
    ): JsonResponse {
        $days = min(
            max(
                (int) $request->query('days', 180),
                1
            ),
            730
        );

        $request->merge([
            'expiring_within_days' => $days,
            'sellable_only' => true,
        ]);

        return $this->batches($request);
    }

    public function batches(Request $request): JsonResponse
    {
        $tenant = $request->attributes->get('tenant');

        $batches = StockBatch::query()
            ->with(['product.category', 'stockLocation', 'branch'])
            ->where('tenant_id', $tenant->id)
            ->when($request->query('branch_id'), fn ($query, $branchId) => $query->where('branch_id', $branchId))
            ->when($request->query('product_id'), fn ($query, $productId) => $query->where('product_id', $productId))
            ->when($request->query('status'), fn ($query, $status) => $query->where('status', $status))
            ->when($request->boolean('sellable_only'), function ($query) {
                $query
                    ->where('status', 'active')
                    ->whereRaw('(quantity_on_hand - quantity_reserved) > 0')
                    ->where(function ($expiryQuery) {
                        $expiryQuery
                            ->whereNull('expiry_date')
                            ->orWhereDate('expiry_date', '>=', now()->toDateString());
                    });
            })
            ->when($request->query('search'), function ($query, $search) {
                $term = '%' . trim((string) $search) . '%';

                $query->where(function ($searchQuery) use ($term) {
                    $searchQuery
                        ->where('batch_number', 'like', $term)
                        ->orWhereHas('product', function ($productQuery) use ($term) {
                            $productQuery
                                ->where('name', 'like', $term)
                                ->orWhere('generic_name', 'like', $term)
                                ->orWhere('brand_name', 'like', $term)
                                ->orWhere('sku', 'like', $term)
                                ->orWhere('barcode', 'like', $term);
                        });
                });
            })
            ->when($request->query('expiring_within_days'), function ($query, $days) {
                $query
                    ->whereNotNull('expiry_date')
                    ->whereDate(
                        'expiry_date',
                        '>=',
                        now()->toDateString()
                    )
                    ->whereDate(
                        'expiry_date',
                        '<=',
                        now()
                            ->addDays((int) $days)
                            ->toDateString()
                    );
            })
            ->orderBy('expiry_date')
            ->orderBy('id');

        $totalBatches = (clone $batches)->count();
        $perPage = min(max((int) $request->query('per_page', 0), 0), 500);

        $offset = min(
            max(
                (int) $request->query('offset', 0),
                0
            ),
            1000000
        );


        if ($offset > 0) {
            $batches->offset($offset);
        }

        if ($perPage > 0) {
            $batches->limit($perPage);
        }

        $batches = $batches
            ->get()
            ->map(fn (StockBatch $batch) => $this->serializeBatch($batch))
            ->values();

        return response()->json([
            'tenant' => $this->tenantPayload($tenant),
            'batches' => $batches,
            'meta' => [
                'total' => $totalBatches,
                'returned' => $batches->count(),
                'per_page' => $perPage > 0 ? $perPage : null,
                'offset' => $offset,
                'next_offset' => (
                    $perPage > 0
                    && ($offset + $batches->count()) < $totalBatches
                )
                    ? $offset + $batches->count()
                    : null,
                'limited' => (
                    $perPage > 0
                    && ($offset + $batches->count()) < $totalBatches
                ),
            ],
        ]);
    }

    public function summary(Request $request): JsonResponse
    {
        // AQUILA_REAL_INVENTORY_VALUE_TREND_20260710
        // Reconstruct the current Sunday-to-Saturday retail-value
        // history from signed, dated stock movements. No artificial
        // values are generated when movement history is unavailable.

        $tenant = $request->attributes->get('tenant');

        $products = Product::query()
            ->where('tenant_id', $tenant->id)
            ->withSum(
                'stockBatches as total_quantity_on_hand',
                'quantity_on_hand'
            )
            ->get();

        $lowStockProducts = $products
            ->filter(
                fn (Product $product) =>
                    (float) (
                        $product->total_quantity_on_hand
                        ?? 0
                    )
                    <= (float) $product->reorder_level
            )
            ->values();

        $stockCostValue = (float)
            StockBatch::query()
                ->where(
                    'tenant_id',
                    $tenant->id
                )
                ->selectRaw(
                    'COALESCE(SUM('
                    . 'quantity_on_hand '
                    . '* COALESCE(unit_cost, 0)'
                    . '), 0) as value'
                )
                ->value('value');

        $stockRetailValue = (float)
            StockBatch::query()
                ->where(
                    'tenant_id',
                    $tenant->id
                )
                ->selectRaw(
                    'COALESCE(SUM('
                    . 'quantity_on_hand '
                    . '* COALESCE(selling_price, 0)'
                    . '), 0) as value'
                )
                ->value('value');

        $potentialMarginValue = max(
            $stockRetailValue - $stockCostValue,
            0
        );

        $expiredBatchesCount =
            StockBatch::query()
                ->where(
                    'tenant_id',
                    $tenant->id
                )
                ->whereNotNull('expiry_date')
                ->whereDate(
                    'expiry_date',
                    '<',
                    now()->toDateString()
                )
                ->count();

        $now = now();
        $today = $now->copy()->startOfDay();

        $weekStart = $today
            ->copy()
            ->subDays($today->dayOfWeek);

        $weekEnd = $weekStart
            ->copy()
            ->addDays(6)
            ->endOfDay();

        $weeklyMovements =
            StockMovement::query()
                ->where(
                    'tenant_id',
                    $tenant->id
                )
                ->where(
                    function ($query) use (
                        $weekStart,
                        $now
                    ) {
                        $query
                            ->whereBetween(
                                'occurred_at',
                                [
                                    $weekStart,
                                    $now,
                                ]
                            )
                            ->orWhereBetween(
                                'business_date',
                                [
                                    $weekStart
                                        ->toDateString(),
                                    $now
                                        ->toDateString(),
                                ]
                            );
                    }
                )
                ->with([
                    'stockBatch:id,selling_price,unit_cost',
                ])
                ->orderBy('occurred_at')
                ->get()
                ->map(
                    function (
                        StockMovement $movement
                    ) {
                        $movementDate =
                            $movement->business_date
                                ?? $movement
                                    ->occurred_at;

                        $sellingPrice = (float) (
                            $movement
                                ->stockBatch
                                ?->selling_price
                            ?? 0
                        );

                        $unitCost = (float) (
                            $movement
                                ->stockBatch
                                ?->unit_cost
                            ?? 0
                        );

                        $valuationPrice =
                            $sellingPrice > 0
                                ? $sellingPrice
                                : $unitCost;

                        return [
                            'date' =>
                                $movementDate
                                    ?->copy()
                                    ->startOfDay(),
                            'quantity' =>
                                (float)
                                $movement->quantity,
                            'valuation_price' =>
                                $valuationPrice,
                            'has_valuation_price' =>
                                $valuationPrice > 0,
                        ];
                    }
                )
                ->filter(
                    fn (array $movement) =>
                        $movement['date'] !== null
                )
                ->values();

        $weeklyPoints = collect(
            range(0, 6)
        )->map(
            function (
                int $offset
            ) use (
                $weekStart,
                $today,
                $stockRetailValue,
                $weeklyMovements
            ) {
                $day = $weekStart
                    ->copy()
                    ->addDays($offset);

                $label = substr(
                    $day->format('D'),
                    0,
                    1
                );

                if ($day->greaterThan($today)) {
                    return [
                        'date' =>
                            $day->toDateString(),
                        'label' => $label,
                        'value' => null,
                        'is_future' => true,
                    ];
                }

                $dayEnd = $day
                    ->copy()
                    ->endOfDay();

                $subsequentMovementValue =
                    $weeklyMovements
                        ->filter(
                            fn (array $movement) =>
                                $movement['date']
                                    ->greaterThan(
                                        $dayEnd
                                    )
                        )
                        ->sum(
                            fn (array $movement) =>
                                $movement['quantity']
                                * $movement[
                                    'valuation_price'
                                ]
                        );

                return [
                    'date' =>
                        $day->toDateString(),
                    'label' => $label,
                    'value' => round(
                        max(
                            0,
                            $stockRetailValue
                            - $subsequentMovementValue
                        ),
                        2
                    ),
                    'is_future' => false,
                ];
            }
        )->values();

        $availableWeeklyValues =
            $weeklyPoints
                ->whereNotNull('value')
                ->values();

        $firstWeeklyValue =
            $availableWeeklyValues
                ->first()['value']
                ?? $stockRetailValue;

        $latestWeeklyValue =
            $availableWeeklyValues
                ->last()['value']
                ?? $stockRetailValue;

        $weeklyDelta = round(
            $latestWeeklyValue
            - $firstWeeklyValue,
            2
        );

        $weeklyDirection =
            abs($weeklyDelta) < 0.01
                ? 'stable'
                : (
                    $weeklyDelta > 0
                        ? 'growing'
                        : 'reducing'
                );

        $historyAvailable =
            $weeklyMovements->isNotEmpty();

        $unmappedMovementCount =
            $weeklyMovements
                ->where(
                    'has_valuation_price',
                    false
                )
                ->count();

        /*
         * AQUILA_INVENTORY_VALUE_BY_CATEGORY_20260711
         *
         * Uses the same retail selling-price basis as the existing
         * Inventory value analytics. Missing selling prices remain
         * disclosed rather than being silently estimated.
         */
        $inventoryValueByCategory =
            StockBatch::query()
                ->join(
                    'products',
                    'products.id',
                    '=',
                    'stock_batches.product_id'
                )
                ->leftJoin(
                    'product_categories',
                    function ($join) use ($tenant): void {
                        $join
                            ->on(
                                'product_categories.id',
                                '=',
                                'products.product_category_id'
                            )
                            ->where(
                                'product_categories.tenant_id',
                                '=',
                                $tenant->id
                            );
                    }
                )
                ->where(
                    'stock_batches.tenant_id',
                    $tenant->id
                )
                ->selectRaw(
                    "COALESCE(product_categories.name, 'Uncategorized') as category_name"
                )
                ->selectRaw(
                    'COALESCE(SUM(stock_batches.quantity_on_hand), 0) as quantity_on_hand'
                )
                ->selectRaw(
                    'COALESCE(SUM(stock_batches.quantity_on_hand * COALESCE(stock_batches.selling_price, 0)), 0) as inventory_value'
                )
                ->selectRaw(
                    'COUNT(stock_batches.id) as stock_batches_count'
                )
                ->selectRaw(
                    'SUM(CASE WHEN COALESCE(stock_batches.selling_price, 0) > 0 THEN 1 ELSE 0 END) as priced_batches_count'
                )
                ->selectRaw(
                    'SUM(CASE WHEN COALESCE(stock_batches.selling_price, 0) <= 0 THEN 1 ELSE 0 END) as missing_price_batches_count'
                )
                ->groupBy(
                    'product_categories.name'
                )
                ->get()
                ->map(
                    fn ($category): array => [
                        'category_name' =>
                            (string)
                            $category->category_name,
                        'inventory_value' =>
                            round(
                                (float)
                                $category->inventory_value,
                                2
                            ),
                        'quantity_on_hand' =>
                            round(
                                (float)
                                $category->quantity_on_hand,
                                3
                            ),
                        'stock_batches_count' =>
                            (int)
                            $category->stock_batches_count,
                        'priced_batches_count' =>
                            (int)
                            $category->priced_batches_count,
                        'missing_price_batches_count' =>
                            (int)
                            $category
                                ->missing_price_batches_count,
                        'currency' => 'RWF',
                        'valuation_basis' =>
                            'retail_selling_price',
                    ]
                )
                ->sortByDesc(
                    'inventory_value'
                )
                ->values();

        $summary = [
            'product_categories_count' =>
                ProductCategory::where(
                    'tenant_id',
                    $tenant->id
                )->count(),

            'products_count' =>
                $products->count(),

            'stock_locations_count' =>
                StockLocation::where(
                    'tenant_id',
                    $tenant->id
                )->count(),

            'stock_batches_count' =>
                StockBatch::where(
                    'tenant_id',
                    $tenant->id
                )->count(),

            'total_quantity_on_hand' =>
                (float)
                StockBatch::where(
                    'tenant_id',
                    $tenant->id
                )->sum('quantity_on_hand'),

            'estimated_stock_value' =>
                $stockRetailValue,

            'estimated_stock_cost_value' =>
                $stockCostValue,

            'estimated_stock_retail_value' =>
                $stockRetailValue,

            'estimated_potential_margin_value' =>
                $potentialMarginValue,

            'expired_batches_count' =>
                $expiredBatchesCount,

            'low_stock_products_count' =>
                $lowStockProducts->count(),

            'near_expiry_batches_180_days_count' =>
                StockBatch::where(
                    'tenant_id',
                    $tenant->id
                )
                    ->whereNotNull('expiry_date')
                    ->whereDate(
                        'expiry_date',
                        '<=',
                        now()
                            ->addDays(180)
                            ->toDateString()
                    )
                    ->count(),

            'inventory_value_by_category' => $inventoryValueByCategory,
            'inventory_value_weekly_trend' => [
                'basis' => 'retail_value',
                'currency' => 'RWF',
                'week_start' =>
                    $weekStart->toDateString(),
                'week_end' =>
                    $weekEnd->toDateString(),
                'as_of' =>
                    $now->toISOString(),
                'labels' =>
                    $weeklyPoints
                        ->pluck('label')
                        ->values(),
                'points' =>
                    $weeklyPoints,
                'history_available' =>
                    $historyAvailable,
                'recorded_movement_count' =>
                    $weeklyMovements->count(),
                'unmapped_movement_count' =>
                    $unmappedMovementCount,
                'direction' =>
                    $weeklyDirection,
                'delta_value' =>
                    $weeklyDelta,
                'method' =>
                    'current_retail_value_reversed_by_signed_stock_movements',
                'method_note' =>
                    'Historical values use recorded movement dates and the current batch retail price, with unit cost used only when retail price is unavailable.',
            ],
        ];



        return response()->json([
            'tenant' =>
                $this->tenantPayload($tenant),

            'summary' => $summary,

            'low_stock_products' =>
                $lowStockProducts
                    ->map(
                        fn (Product $product) =>
                            $this->serializeProduct(
                                $product,
                                includeStockSummary: true
                            )
                    )
                    ->values(),
        ]);
    }


    public function createProduct(
        Request $request,
        AuditLogService $auditLogService,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        $tenant = $request->attributes->get('tenant');

        $validated = $request->validate([
            'product_category_id' => [
                'nullable',
                'integer',
                Rule::exists('product_categories', 'id')->where(fn ($query) => $query->where('tenant_id', $tenant->id)),
            ],
            'name' => ['required', 'string', 'max:255'],
            'generic_name' => ['nullable', 'string', 'max:255'],
            'brand_name' => ['nullable', 'string', 'max:255'],
            'sku' => [
                'required',
                'string',
                'max:120',
                Rule::unique('products', 'sku')->where('tenant_id', $tenant->id),
            ],
            'barcode' => ['nullable', 'string', 'max:120'],
            'registration_number' => ['nullable', 'string', 'max:120'],
            'dosage_form' => ['nullable', 'string', 'max:120'],
            'strength' => ['nullable', 'string', 'max:120'],
            'unit' => ['required', 'string', 'max:80'],
            'selling_unit' => ['nullable', 'string', 'max:80'],
            'base_unit' => ['nullable', 'string', 'max:80'],
            'quantity_per_selling_unit' => ['sometimes', 'numeric', 'min:0.0001'],
            'allow_other_quantity' => ['sometimes', 'boolean'],
            'default_pos_quantity_mode' => [
                'sometimes',
                Rule::in(['selling_unit', 'other_quantity', 'combined']),
            ],
            'selling_unit_notes' => ['nullable', 'string', 'max:2000'],
            'pack_size' => ['nullable', 'string', 'max:120'],
            'route_of_administration' => ['nullable', 'string', 'max:120'],
            'product_type' => ['required', Rule::in(['medicine', 'consumable', 'device', 'service'])],
            'regulatory_status' => ['required', Rule::in(['approved', 'pending', 'suspended', 'unregistered'])],
            'requires_prescription' => ['sometimes', 'boolean'],
            'is_controlled' => ['sometimes', 'boolean'],
            'reorder_level' => ['sometimes', 'numeric', 'min:0'],
            'minimum_stock_level' => ['sometimes', 'numeric', 'min:0'],
            'maximum_stock_level' => ['nullable', 'numeric', 'min:0'],
            'status' => ['sometimes', Rule::in(['active', 'inactive', 'discontinued'])],
            'metadata' => ['sometimes', 'array'],
        ]);

        $product = Product::query()->create([
            ...$validated,
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $tenant->id,
            'selling_unit' => $validated['selling_unit'] ?? $validated['unit'],
            'base_unit' => $validated['base_unit'] ?? $validated['unit'],
            'quantity_per_selling_unit' => $validated['quantity_per_selling_unit'] ?? 1,
            'allow_other_quantity' => $validated['allow_other_quantity'] ?? true,
            'default_pos_quantity_mode' => $validated['default_pos_quantity_mode'] ?? 'selling_unit',
            'requires_prescription' => $validated['requires_prescription'] ?? false,
            'is_controlled' => $validated['is_controlled'] ?? false,
            'reorder_level' => $validated['reorder_level'] ?? 0,
            'minimum_stock_level' => $validated['minimum_stock_level'] ?? 0,
            'maximum_stock_level' => $validated['maximum_stock_level'] ?? null,
            'status' => $validated['status'] ?? 'active',
            'metadata' => array_merge(
                [
                    'created_from' => 'pharmaco_product_inventory_api',
                    'manual_product_master_entry' => true,
                ],
                $validated['metadata'] ?? []
            ),
        ]);

        $scope = $scopeResolver->resolveForUser($request->user());

        $auditLogService->record(
            action: 'pharmaco.product.created',
            scope: $scope,
            metadata: [
                'tenant_slug' => $tenant->slug,
                'product_sku' => $product->sku,
                'product_name' => $product->name,
            ],
            dataClassification: 'internal',
            auditableType: Product::class,
            auditableId: $product->id
        );

        return response()->json([
            'message' => 'Product created successfully.',
            'product' => $this->serializeProduct($product->fresh('category'), includeStockSummary: true),
        ], 201);
    }

    public function updateProduct(
        Request $request,
        Product $product,
        AuditLogService $auditLogService,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        $tenant = $request->attributes->get('tenant');

        if ((int) $product->tenant_id !== (int) $tenant->id) {
            abort(404);
        }

        $validated = $request->validate([
            'product_category_id' => [
                'sometimes',
                'nullable',
                'integer',
                Rule::exists('product_categories', 'id')->where(fn ($query) => $query->where('tenant_id', $tenant->id)),
            ],
            'name' => ['sometimes', 'string', 'max:255'],
            'generic_name' => ['nullable', 'string', 'max:255'],
            'brand_name' => ['nullable', 'string', 'max:255'],
            'sku' => [
                'sometimes',
                'string',
                'max:120',
                Rule::unique('products', 'sku')->where('tenant_id', $tenant->id)->ignore($product->id),
            ],
            'barcode' => ['nullable', 'string', 'max:120'],
            'registration_number' => ['nullable', 'string', 'max:120'],
            'dosage_form' => ['nullable', 'string', 'max:120'],
            'strength' => ['nullable', 'string', 'max:120'],
            'unit' => ['sometimes', 'string', 'max:80'],
            'selling_unit' => ['sometimes', 'nullable', 'string', 'max:80'],
            'base_unit' => ['sometimes', 'nullable', 'string', 'max:80'],
            'quantity_per_selling_unit' => ['sometimes', 'numeric', 'min:0.0001'],
            'allow_other_quantity' => ['sometimes', 'boolean'],
            'default_pos_quantity_mode' => [
                'sometimes',
                Rule::in(['selling_unit', 'other_quantity', 'combined']),
            ],
            'selling_unit_notes' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'pack_size' => ['nullable', 'string', 'max:120'],
            'route_of_administration' => ['nullable', 'string', 'max:120'],
            'product_type' => ['sometimes', Rule::in(['medicine', 'consumable', 'device', 'service'])],
            'regulatory_status' => ['sometimes', Rule::in(['approved', 'pending', 'suspended', 'unregistered'])],
            'requires_prescription' => ['sometimes', 'boolean'],
            'is_controlled' => ['sometimes', 'boolean'],
            'reorder_level' => ['sometimes', 'numeric', 'min:0'],
            'minimum_stock_level' => ['sometimes', 'numeric', 'min:0'],
            'maximum_stock_level' => ['nullable', 'numeric', 'min:0'],
            'status' => ['sometimes', Rule::in(['active', 'inactive', 'discontinued'])],
            'metadata' => ['sometimes', 'array'],
        ]);

        if (array_key_exists('metadata', $validated)) {
            $validated['metadata'] = array_merge($product->metadata ?? [], $validated['metadata']);
        }

        $before = $product->only(array_keys($validated));

        $product->fill($validated);
        $product->save();

        $scope = $scopeResolver->resolveForUser($request->user());

        $auditLogService->record(
            action: 'pharmaco.product.updated',
            scope: $scope,
            metadata: [
                'tenant_slug' => $tenant->slug,
                'product_sku' => $product->sku,
                'before' => $before,
                'after' => $product->only(array_keys($validated)),
            ],
            dataClassification: 'internal',
            auditableType: Product::class,
            auditableId: $product->id
        );

        return response()->json([
            'message' => 'Product updated successfully.',
            'product' => $this->serializeProduct($product->fresh('category'), includeStockSummary: true),
        ]);
    }

    public function generateSellingUnitSuggestion(
        Request $request,
        Product $product,
        ProductSellingUnitSuggestionService $suggestionService,
        AuditLogService $auditLogService,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        $tenant = $request->attributes->get('tenant');

        if ((int) $product->tenant_id !== (int) $tenant->id) {
            abort(404);
        }

        $validated = $request->validate([
            'trusted_source' => ['nullable', 'string', 'max:1000'],
            'trusted_reference' => ['nullable', 'string', 'max:2000'],
        ]);

        $suggestion = $suggestionService->suggest($product);

        if (! empty($validated['trusted_source'])) {
            $suggestion['source'] = trim($validated['trusted_source']);
        }

        if (! empty($validated['trusted_reference'])) {
            $suggestion['reference'] = trim($validated['trusted_reference']);
        }

        $before = [
            'quantity_per_selling_unit' => (float) $product->quantity_per_selling_unit,
            'ai_suggested_quantity_per_unit' => $product->ai_suggested_quantity_per_unit,
            'ai_suggestion_status' => $product->ai_suggestion_status,
        ];

        $product->forceFill([
            'ai_suggested_quantity_per_unit' => $suggestion['proposed_value'],
            'ai_suggestion_status' => 'pending_review',
            'ai_suggestion_confidence' => $suggestion['confidence'],
            'ai_suggestion_explanation' => $suggestion['explanation'],
            'ai_suggestion_source' => $suggestion['source'],
            'ai_suggestion_reference' => $suggestion['reference'],
            'ai_suggestion_reviewed_by' => null,
            'ai_suggestion_reviewed_at' => null,
        ])->save();

        $auditLogService->record(
            action: 'pharmaco.product.selling_unit_ai_suggested',
            scope: $scopeResolver->resolveForUser($request->user()),
            metadata: [
                'tenant_slug' => $tenant->slug,
                'product_sku' => $product->sku,
                'before' => $before,
                'proposal' => [
                    'proposed_value' => $suggestion['proposed_value'],
                    'confidence' => $suggestion['confidence'],
                    'explanation' => $suggestion['explanation'],
                    'source' => $suggestion['source'],
                    'reference' => $suggestion['reference'],
                ],
                'auto_applied' => false,
            ],
            dataClassification: 'internal',
            auditableType: Product::class,
            auditableId: $product->id
        );

        return response()->json([
            'message' => 'Selling-unit AI suggestion generated for human review.',
            'auto_applied' => false,
            'product' => $this->serializeProduct(
                $product->fresh('category'),
                includeStockSummary: true
            ),
        ]);
    }

    public function reviewSellingUnitSuggestion(
        Request $request,
        Product $product,
        AuditLogService $auditLogService,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        $tenant = $request->attributes->get('tenant');

        if ((int) $product->tenant_id !== (int) $tenant->id) {
            abort(404);
        }

        if ($product->ai_suggestion_status !== 'pending_review') {
            throw ValidationException::withMessages([
                'ai_suggestion_status' => [
                    'This product does not have a pending selling-unit AI suggestion.',
                ],
            ]);
        }

        $validated = $request->validate([
            'action' => [
                'required',
                Rule::in(['approve', 'reject', 'edit_and_approve']),
            ],
            'approved_value' => [
                'required_if:action,edit_and_approve',
                'nullable',
                'numeric',
                'min:0.0001',
            ],
            'review_notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $action = $validated['action'];
        $suggestedValue = (float) $product->ai_suggested_quantity_per_unit;
        $approvedValue = $action === 'edit_and_approve'
            ? (float) $validated['approved_value']
            : $suggestedValue;

        if (
            in_array($action, ['approve', 'edit_and_approve'], true)
            && $suggestedValue <= 0
        ) {
            throw ValidationException::withMessages([
                'ai_suggested_quantity_per_unit' => [
                    'The pending suggestion does not contain a valid quantity.',
                ],
            ]);
        }

        $before = [
            'quantity_per_selling_unit' => (float) $product->quantity_per_selling_unit,
            'ai_suggested_quantity_per_unit' => $suggestedValue,
            'ai_suggestion_status' => $product->ai_suggestion_status,
        ];

        $updates = [
            'ai_suggestion_status' => $action === 'reject'
                ? 'rejected'
                : 'approved',
            'ai_suggestion_reviewed_by' => $request->user()->id,
            'ai_suggestion_reviewed_at' => now(),
        ];

        if ($action !== 'reject') {
            $updates['quantity_per_selling_unit'] = $approvedValue;
        }

        $metadata = is_array($product->metadata)
            ? $product->metadata
            : [];

        $metadata['selling_unit_ai_review'] = [
            'action' => $action,
            'review_notes' => $validated['review_notes'] ?? null,
            'proposed_value' => $suggestedValue,
            'approved_value' => $action === 'reject'
                ? null
                : $approvedValue,
            'reviewed_by' => $request->user()->id,
            'reviewed_at' => now()->toISOString(),
        ];

        $updates['metadata'] = $metadata;

        $product->forceFill($updates)->save();

        $auditLogService->record(
            action: match ($action) {
                'reject' => 'pharmaco.product.selling_unit_ai_rejected',
                'edit_and_approve' => 'pharmaco.product.selling_unit_ai_edited_and_approved',
                default => 'pharmaco.product.selling_unit_ai_approved',
            },
            scope: $scopeResolver->resolveForUser($request->user()),
            metadata: [
                'tenant_slug' => $tenant->slug,
                'product_sku' => $product->sku,
                'review_action' => $action,
                'review_notes' => $validated['review_notes'] ?? null,
                'before' => $before,
                'after' => [
                    'quantity_per_selling_unit' => (float) $product->quantity_per_selling_unit,
                    'ai_suggestion_status' => $product->ai_suggestion_status,
                    'ai_suggestion_reviewed_by' => $product->ai_suggestion_reviewed_by,
                    'ai_suggestion_reviewed_at' => optional(
                        $product->ai_suggestion_reviewed_at
                    )?->toISOString(),
                ],
            ],
            dataClassification: 'internal',
            auditableType: Product::class,
            auditableId: $product->id
        );

        return response()->json([
            'message' => match ($action) {
                'reject' => 'Selling-unit AI suggestion rejected.',
                'edit_and_approve' => 'Selling-unit AI suggestion edited and approved.',
                default => 'Selling-unit AI suggestion approved.',
            },
            'product' => $this->serializeProduct(
                $product->fresh('category'),
                includeStockSummary: true
            ),
        ]);
    }

    public function deleteProduct(
        Request $request,
        Product $product,
        AuditLogService $auditLogService,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        $tenant = $request->attributes->get('tenant');

        if ((int) $product->tenant_id !== (int) $tenant->id) {
            abort(404);
        }

        $stockBatchCount = StockBatch::query()
            ->where('tenant_id', $tenant->id)
            ->where('product_id', $product->id)
            ->count();

        $purchaseOrderItemCount = PharmacoPurchaseOrderItem::query()
            ->where('product_id', $product->id)
            ->count();

        if ($stockBatchCount > 0 || $purchaseOrderItemCount > 0) {
            throw ValidationException::withMessages([
                'product' => [
                    'This product has stock or purchase order history. Deactivate/discontinue it instead of deleting it.',
                ],
            ]);
        }

        $snapshot = [
            'id' => $product->id,
            'sku' => $product->sku,
            'name' => $product->name,
            'generic_name' => $product->generic_name,
            'metadata' => $product->metadata ?? [],
        ];

        $product->delete();

        $auditLogService->record(
            action: 'pharmaco.product.deleted',
            scope: $scopeResolver->resolveForUser($request->user()),
            metadata: [
                'tenant_slug' => $tenant->slug,
                'deleted_product' => $snapshot,
            ],
            dataClassification: 'internal',
            auditableType: Product::class,
            auditableId: $snapshot['id']
        );

        return response()->json([
            'message' => 'Product deleted successfully.',
        ]);
    }

    public function bulkImportProducts(
        Request $request,
        AuditLogService $auditLogService,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        $tenant = $request->attributes->get('tenant');

        $validated = $request->validate([
            'rows' => ['sometimes', 'array', 'max:500'],
            'rows.*' => ['array'],
            'file' => ['sometimes', 'file', 'max:4096'],
            'mode' => ['sometimes', Rule::in(['create_only', 'upsert'])],
        ]);

        $rows = $validated['rows'] ?? [];

        if ($request->hasFile('file')) {
            $rows = $this->parseProductCsv($request->file('file')->getRealPath());
        }

        if ($rows === []) {
            throw ValidationException::withMessages([
                'rows' => ['Provide CSV rows or upload a CSV file.'],
            ]);
        }

        $mode = $validated['mode'] ?? 'upsert';
        $created = 0;
        $updated = 0;
        $failed = [];

        foreach (array_values($rows) as $index => $row) {
            $rowNumber = $index + 1;
            $normalized = $this->normalizeProductImportRow($row);

            $validator = Validator::make($normalized, [
                'name' => ['required', 'string', 'max:255'],
                'sku' => ['required', 'string', 'max:120'],
                'category_code' => ['nullable', 'string', 'max:120'],
                'generic_name' => ['nullable', 'string', 'max:255'],
                'brand_name' => ['nullable', 'string', 'max:255'],
                'barcode' => ['nullable', 'string', 'max:120'],
                'registration_number' => ['nullable', 'string', 'max:120'],
                'dosage_form' => ['nullable', 'string', 'max:120'],
                'strength' => ['nullable', 'string', 'max:120'],
                'unit' => ['nullable', 'string', 'max:80'],
                'pack_size' => ['nullable', 'string', 'max:120'],
                'route_of_administration' => ['nullable', 'string', 'max:120'],
                'product_type' => ['nullable', Rule::in(['medicine', 'consumable', 'device', 'service'])],
                'regulatory_status' => ['nullable', Rule::in(['approved', 'pending', 'suspended', 'unregistered'])],
                'requires_prescription' => ['nullable', 'boolean'],
                'is_controlled' => ['nullable', 'boolean'],
                'reorder_level' => ['nullable', 'numeric', 'min:0'],
                'minimum_stock_level' => ['nullable', 'numeric', 'min:0'],
                'maximum_stock_level' => ['nullable', 'numeric', 'min:0'],
                'status' => ['nullable', Rule::in(['active', 'inactive', 'discontinued'])],
            ]);

            if ($validator->fails()) {
                $failed[] = [
                    'row' => $rowNumber,
                    'sku' => $normalized['sku'] ?? null,
                    'errors' => $validator->errors()->all(),
                ];

                continue;
            }

            $data = $validator->validated();
            $existing = Product::query()
                ->where('tenant_id', $tenant->id)
                ->where('sku', $data['sku'])
                ->first();

            if ($existing && $mode === 'create_only') {
                $failed[] = [
                    'row' => $rowNumber,
                    'sku' => $data['sku'],
                    'errors' => ['Product already exists.'],
                ];

                continue;
            }

            $categoryId = null;

            if (! empty($data['category_code'])) {
                $categoryId = ProductCategory::query()
                    ->where('tenant_id', $tenant->id)
                    ->where('code', $data['category_code'])
                    ->value('id');
            }

            $payload = [
                'product_category_id' => $categoryId,
                'name' => $data['name'],
                'generic_name' => $data['generic_name'] ?? null,
                'brand_name' => $data['brand_name'] ?? null,
                'barcode' => $data['barcode'] ?? null,
                'registration_number' => $data['registration_number'] ?? null,
                'dosage_form' => $data['dosage_form'] ?? null,
                'strength' => $data['strength'] ?? null,
                'unit' => $data['unit'] ?? 'unit',
                'pack_size' => $data['pack_size'] ?? null,
                'route_of_administration' => $data['route_of_administration'] ?? null,
                'product_type' => $data['product_type'] ?? 'medicine',
                'regulatory_status' => $data['regulatory_status'] ?? 'approved',
                'requires_prescription' => (bool) ($data['requires_prescription'] ?? false),
                'is_controlled' => (bool) ($data['is_controlled'] ?? false),
                'reorder_level' => $data['reorder_level'] ?? 0,
                'minimum_stock_level' => $data['minimum_stock_level'] ?? 0,
                'maximum_stock_level' => $data['maximum_stock_level'] ?? null,
                'status' => $data['status'] ?? 'active',
                'metadata' => [
                    'imported_from' => 'pharmaco_product_bulk_import',
                    'imported_at' => now()->toISOString(),
                ],
            ];

            if ($existing) {
                $existing->fill($payload);
                $existing->save();
                $updated++;
            } else {
                Product::query()->create([
                    ...$payload,
                    'uuid' => (string) Str::uuid(),
                    'tenant_id' => $tenant->id,
                    'sku' => $data['sku'],
                ]);
                $created++;
            }
        }

        $run = BulkOperationRun::query()->create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $request->user()?->id,
            'tenant_id' => $tenant->id,
            'operation_type' => 'product_bulk_import',
            'target_table' => 'products',
            'status' => count($failed) > 0 ? 'completed_with_errors' : 'completed',
            'total_rows' => count($rows),
            'processed_rows' => $created + $updated,
            'failed_rows' => count($failed),
            'summary' => [
                'created' => $created,
                'updated' => $updated,
                'failed' => $failed,
            ],
        ]);

        $auditLogService->record(
            action: 'pharmaco.products.bulk_imported',
            scope: $scopeResolver->resolveForUser($request->user()),
            metadata: [
                'tenant_slug' => $tenant->slug,
                'bulk_operation_run_id' => $run->id,
                'created' => $created,
                'updated' => $updated,
                'failed' => count($failed),
            ],
            dataClassification: 'internal',
            auditableType: BulkOperationRun::class,
            auditableId: $run->id
        );

        return response()->json([
            'message' => 'Product bulk import completed.',
            'bulk_operation' => [
                'id' => $run->id,
                'uuid' => $run->uuid,
                'status' => $run->status,
                'total_rows' => $run->total_rows,
                'processed_rows' => $run->processed_rows,
                'failed_rows' => $run->failed_rows,
                'summary' => $run->summary,
            ],
        ]);
    }

    public function bulkProductAction(
        Request $request,
        AuditLogService $auditLogService,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        $tenant = $request->attributes->get('tenant');

        $validated = $request->validate([
            'ids' => ['required', 'array', 'min:1', 'max:500'],
            'ids.*' => ['integer'],
            'action' => ['required', Rule::in(['approve', 'activate', 'deactivate', 'discontinue', 'update', 'delete'])],
            'values' => ['sometimes', 'array'],
        ]);

        $products = Product::query()
            ->where('tenant_id', $tenant->id)
            ->whereIn('id', $validated['ids'])
            ->get();

        $processed = 0;
        $failed = [];

        foreach ($products as $product) {
            try {
                match ($validated['action']) {
                    'approve' => $product->forceFill(['regulatory_status' => 'approved', 'status' => 'active'])->save(),
                    'activate' => $product->forceFill(['status' => 'active'])->save(),
                    'deactivate' => $product->forceFill(['status' => 'inactive'])->save(),
                    'discontinue' => $product->forceFill(['status' => 'discontinued'])->save(),
                    'update' => $this->applyBulkProductUpdate($product, $validated['values'] ?? []),
                    'delete' => $this->deleteProductIfSafe($product),
                };

                $processed++;
            } catch (\Throwable $exception) {
                $failed[] = [
                    'id' => $product->id,
                    'sku' => $product->sku,
                    'message' => $exception->getMessage(),
                ];
            }
        }

        $missingIds = array_values(array_diff($validated['ids'], $products->pluck('id')->all()));

        foreach ($missingIds as $missingId) {
            $failed[] = [
                'id' => $missingId,
                'sku' => null,
                'message' => 'Product was not found in this tenant.',
            ];
        }

        $run = BulkOperationRun::query()->create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $request->user()?->id,
            'tenant_id' => $tenant->id,
            'operation_type' => 'product_bulk_' . $validated['action'],
            'target_table' => 'products',
            'status' => count($failed) > 0 ? 'completed_with_errors' : 'completed',
            'total_rows' => count($validated['ids']),
            'processed_rows' => $processed,
            'failed_rows' => count($failed),
            'summary' => [
                'action' => $validated['action'],
                'failed' => $failed,
            ],
        ]);

        $auditLogService->record(
            action: 'pharmaco.products.bulk_action',
            scope: $scopeResolver->resolveForUser($request->user()),
            metadata: [
                'tenant_slug' => $tenant->slug,
                'bulk_operation_run_id' => $run->id,
                'action' => $validated['action'],
                'processed' => $processed,
                'failed' => count($failed),
            ],
            dataClassification: 'internal',
            auditableType: BulkOperationRun::class,
            auditableId: $run->id
        );

        return response()->json([
            'message' => 'Product bulk action completed.',
            'bulk_operation' => [
                'id' => $run->id,
                'uuid' => $run->uuid,
                'status' => $run->status,
                'total_rows' => $run->total_rows,
                'processed_rows' => $run->processed_rows,
                'failed_rows' => $run->failed_rows,
                'summary' => $run->summary,
            ],
        ]);
    }


    public function receiveStock(
        Request $request,
        AuditLogService $auditLogService,
        ScopeResolver $scopeResolver,
        UserAccessProfileService $userAccessProfileService
    ): JsonResponse {
        $tenant = $request->attributes->get('tenant');

        $validated = $request->validate([
            'product_id' => [
                'required',
                'integer',
                Rule::exists('products', 'id')->where(fn ($query) => $query->where('tenant_id', $tenant->id)),
            ],
            'stock_location_id' => [
                'required',
                'integer',
                Rule::exists('stock_locations', 'id')->where(fn ($query) => $query->where('tenant_id', $tenant->id)),
            ],
            'pharmaco_purchase_order_item_id' => ['nullable', 'integer'],
            'batch_number' => ['required', 'string', 'max:120'],
            'quantity' => ['required', 'numeric', 'min:0.01'],
            'expiry_date' => ['nullable', 'date'],
            'received_at' => ['nullable', 'date'],
            'unit_cost' => ['nullable', 'numeric', 'min:0'],
            'selling_price' => ['nullable', 'numeric', 'min:0'],
            'supplier_name' => ['nullable', 'string', 'max:255'],
            'reference_number' => ['nullable', 'string', 'max:120'],
            'reason' => ['nullable', 'string', 'max:1000'],

            'receive_source' => ['nullable', Rule::in(['manual', 'purchase-code'])],

            /*
             * MEDICINE_RECEIPT_DUPLICATE_GUARD_20260714
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

        if (! empty($validated['pharmaco_purchase_order_item_id'])) {
            $user = $request->user();
            $activePermissions = $user
                ? $userAccessProfileService->permissionCodes($user)
                : [];

            if (! in_array(
                'pharmaco.procurement.purchase_order.receive',
                $activePermissions,
                true
            )) {
                return response()->json([
                    'message' => 'You do not have permission to receive stock against a purchase order.',
                    'missing_permissions' => [
                        'pharmaco.procurement.purchase_order.receive',
                    ],
                ], 403);
            }
        }

        $receiveSource = $validated['receive_source']
            ?? (! empty($validated['reference_number'] ?? null) ? 'purchase-code' : 'manual');

        $product = Product::query()
            ->where('tenant_id', $tenant->id)
            ->findOrFail($validated['product_id']);

        $location = StockLocation::query()
            ->with('branch')
            ->where('tenant_id', $tenant->id)
            ->findOrFail($validated['stock_location_id']);

        $quantityReceived = (float) $validated['quantity'];

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
                \App\Services\Inventory\MedicineReceiptDuplicateGuardService::class
            )->begin(
                $tenant,
                $product,
                $location,
                $validated,
                $request->user()
            );

        $validated[
            '_inventory_receipt_guard_id'
        ] = $inventoryReceiptGuard?->id;


        $purchaseOrderItem = null;

        if (! empty($validated['pharmaco_purchase_order_item_id'])) {
            $purchaseOrderItem = PharmacoPurchaseOrderItem::query()
                ->with(['purchaseOrder.supplier', 'product'])
                ->where('tenant_id', $tenant->id)
                ->find($validated['pharmaco_purchase_order_item_id']);

            if (! $purchaseOrderItem) {
                throw ValidationException::withMessages([
                    'pharmaco_purchase_order_item_id' => ['Selected purchase order item does not belong to the current tenant.'],
                ]);
            }

            $purchaseOrder = $purchaseOrderItem->purchaseOrder;

            if (! $purchaseOrder || (int) $purchaseOrder->tenant_id !== (int) $tenant->id) {
                throw ValidationException::withMessages([
                    'pharmaco_purchase_order_item_id' => ['Selected purchase order item is invalid for the current tenant.'],
                ]);
            }

            if (
                $purchaseOrder->purchase_type ===
                'general_items'
            ) {
                throw ValidationException::withMessages([
                    'pharmaco_purchase_order_item_id' => [
                        'General Items purchases cannot be received into pharmaceutical Product Inventory.',
                    ],
                ]);
            }

            if ((int) $purchaseOrderItem->product_id !== (int) $product->id) {
                throw ValidationException::withMessages([
                    'product_id' => ['Received product must match the selected purchase order item.'],
                ]);
            }

            if ((int) $purchaseOrder->branch_id !== (int) $location->branch_id) {
                throw ValidationException::withMessages([
                    'stock_location_id' => ['Stock must be received into a location belonging to the purchase order branch.'],
                ]);
            }

            if (! in_array($purchaseOrder->status, ['approved', 'partially_received'], true)) {
                throw ValidationException::withMessages([
                    'pharmaco_purchase_order_item_id' => [
                        'Stock can only be received against an approved or partially received purchase order.',
                    ],
                ]);
            }

            $remainingQuantity = (float) $purchaseOrderItem->quantity_ordered - (float) $purchaseOrderItem->quantity_received;

            if ($quantityReceived > $remainingQuantity) {
                throw ValidationException::withMessages([
                    'quantity' => ['Received quantity cannot exceed the remaining purchase order item quantity.'],
                ]);
            }
        }

        [$batch, $movement, $beforeQuantity, $afterQuantity, $purchaseOrderReceipt] = DB::transaction(function () use (
            $tenant,
            $request,
            $validated,
            $product,
            $location,
            $quantityReceived,
            $purchaseOrderItem,
            $receiveSource) {
            $lockedPurchaseOrderItem = null;
            $purchaseOrderReceipt = null;
            $purchaseOrderSupplierName = null;

            if ($purchaseOrderItem) {
                $lockedPurchaseOrderItem = PharmacoPurchaseOrderItem::query()
                    ->where('tenant_id', $tenant->id)
                    ->lockForUpdate()
                    ->findOrFail($purchaseOrderItem->id);

                $purchaseOrder = $lockedPurchaseOrderItem->purchaseOrder()
                    ->where('tenant_id', $tenant->id)
                    ->lockForUpdate()
                    ->firstOrFail();

                $purchaseOrder->load(['supplier', 'items']);

                if (
                    $purchaseOrder->purchase_type ===
                    'general_items'
                ) {
                    throw ValidationException::withMessages([
                        'pharmaco_purchase_order_item_id' => [
                            'General Items purchases cannot be received into pharmaceutical Product Inventory.',
                        ],
                    ]);
                }

                if (! in_array($purchaseOrder->status, ['approved', 'partially_received'], true)) {
                    throw ValidationException::withMessages([
                        'pharmaco_purchase_order_item_id' => [
                            'Stock can only be received against an approved or partially received purchase order.',
                        ],
                    ]);
                }

                if ((int) $lockedPurchaseOrderItem->product_id !== (int) $product->id) {
                    throw ValidationException::withMessages([
                        'product_id' => ['Received product must match the selected purchase order item.'],
                    ]);
                }

                if ((int) $purchaseOrder->branch_id !== (int) $location->branch_id) {
                    throw ValidationException::withMessages([
                        'stock_location_id' => ['Stock must be received into a location belonging to the purchase order branch.'],
                    ]);
                }

                $receivedBefore = (float) $lockedPurchaseOrderItem->quantity_received;
                $orderedQuantity = (float) $lockedPurchaseOrderItem->quantity_ordered;
                $remainingQuantity = $orderedQuantity - $receivedBefore;

                if ($quantityReceived > $remainingQuantity) {
                    throw ValidationException::withMessages([
                        'quantity' => ['Received quantity cannot exceed the remaining purchase order item quantity.'],
                    ]);
                }

                $receivedAfter = $receivedBefore + $quantityReceived;
                $remainingAfter = $orderedQuantity - $receivedAfter;

                $lockedPurchaseOrderItem->quantity_received = $receivedAfter;
                $lockedPurchaseOrderItem->status = $remainingAfter <= 0 ? 'received' : 'partially_received';
                $lockedPurchaseOrderItem->metadata = [
                    ...($lockedPurchaseOrderItem->metadata ?? []),
                    'last_received_at' => now()->toISOString(),
                    'last_received_quantity' => $quantityReceived,
                    'receiving_workflow' => 'phase_7_2_po_linked_receiving',
                ];
                $lockedPurchaseOrderItem->save();

                $totalOrdered = (float) $purchaseOrder->items()->sum('quantity_ordered');
                $totalReceived = (float) $purchaseOrder->items()->sum('quantity_received');

                $receivingStatus = match (true) {
                    $totalReceived <= 0 => 'not_received',
                    $totalReceived >= $totalOrdered => 'received',
                    default => 'partially_received',
                };

                $purchaseOrder->status = $receivingStatus === 'received' ? 'received' : 'partially_received';
                $purchaseOrder->metadata = [
                    ...($purchaseOrder->metadata ?? []),
                    'receiving_status' => $receivingStatus,
                    'total_quantity_ordered' => $totalOrdered,
                    'total_quantity_received' => $totalReceived,
                    'last_received_at' => now()->toISOString(),
                ];
                $purchaseOrder->save();

                $purchaseOrderSupplierName = $purchaseOrder->supplier?->name;

                $purchaseOrderReceipt = [
                    'purchase_order_id' => $purchaseOrder->id,
                    'purchase_order_item_id' => $lockedPurchaseOrderItem->id,
                    'po_number' => $purchaseOrder->po_number,
                    'purchase_order_status' => $purchaseOrder->status,
                    'purchase_order_receiving_status' => $receivingStatus,
                    'item_status' => $lockedPurchaseOrderItem->status,
                    'quantity_ordered' => $orderedQuantity,
                    'quantity_received_before' => $receivedBefore,
                    'quantity_received_after' => $receivedAfter,
                    'remaining_quantity_after' => $remainingAfter,
                    'supplier_name' => $purchaseOrderSupplierName,
                ];
            }

            $batch = StockBatch::query()
                ->where('tenant_id', $tenant->id)
                ->where('product_id', $product->id)
                ->where('stock_location_id', $location->id)
                ->where('batch_number', $validated['batch_number'])
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
                    \App\Services\Inventory\MedicineReceiptDuplicateGuardService::class
                )->revalidateOrFail(
                    \App\Models\InventoryReceiptGuard::
                        query()->findOrFail(
                            $validated[
                                '_inventory_receipt_guard_id'
                            ]
                        ),
                    $tenant,
                    $product,
                    $location,
                    $validated,
                    $request->user()
                );
            }


            $beforeQuantity = $batch ? (float) $batch->quantity_on_hand : 0.0;
            $afterQuantity = $beforeQuantity + $quantityReceived;
            $supplierName = $validated['supplier_name'] ?? $purchaseOrderSupplierName;

            if (! $batch) {
                $batch = StockBatch::query()->create([
                    'uuid' => (string) Str::uuid(),
                    'tenant_id' => $tenant->id,
                    'branch_id' => $location->branch_id,
                    'stock_location_id' => $location->id,
                    'product_id' => $product->id,
                    'batch_number' => $validated['batch_number'],
                    'expiry_date' => $validated['expiry_date'] ?? null,
                    'received_at' => $validated['received_at'] ?? now()->toDateString(),
                    'quantity_on_hand' => $afterQuantity,
                    'quantity_reserved' => 0,
                    'unit_cost' => $validated['unit_cost'] ?? null,
                    'selling_price' => $validated['selling_price'] ?? null,
                    'supplier_name' => $supplierName,
                    'status' => 'active',
                    'metadata' => [
                        'receive_source' => $receiveSource,
                        'manual_product_master_entry' => $receiveSource === 'manual',
                        'purchase_code_entry' => $receiveSource === 'purchase-code',
                        'reference_number' => $validated['reference_number'] ?? null,
                        'created_from' => 'pharmaco_stock_receive_api',
                        'receiving_workflow' => $purchaseOrderReceipt ? 'phase_7_2_po_linked_receiving' : 'manual_receiving',
                        'purchase_order_id' => $purchaseOrderReceipt['purchase_order_id'] ?? null,
                        'purchase_order_item_id' => $purchaseOrderReceipt['purchase_order_item_id'] ?? null,
                    ],
                ]);
            } else {
                $batch->quantity_on_hand = $afterQuantity;

                foreach (['expiry_date', 'received_at', 'unit_cost', 'selling_price'] as $field) {
                    if (array_key_exists($field, $validated)) {
                        $batch->{$field} = $validated[$field];
                    }
                }

                if (array_key_exists('supplier_name', $validated) || $supplierName) {
                    $batch->supplier_name = $supplierName;
                }

                $batch->metadata = [
                    ...($batch->metadata ?? []),
                    'receiving_workflow' => $purchaseOrderReceipt ? 'phase_7_2_po_linked_receiving' : 'manual_receiving',
                    'purchase_order_id' => $purchaseOrderReceipt['purchase_order_id'] ?? (($batch->metadata ?? [])['purchase_order_id'] ?? null),
                    'purchase_order_item_id' => $purchaseOrderReceipt['purchase_order_item_id'] ?? (($batch->metadata ?? [])['purchase_order_item_id'] ?? null),
                ];
                $batch->status = 'active';
                $batch->save();
            }

            $movementMetadata = [
                'source' => 'pharmaco_stock_receive_api',
                'receiving_workflow' => $purchaseOrderReceipt ? 'phase_7_2_po_linked_receiving' : 'manual_receiving',
                'before_quantity' => $beforeQuantity,
                'after_quantity' => $afterQuantity,
            ];

            if ($purchaseOrderReceipt) {
                $movementMetadata = [
                    ...$movementMetadata,
                    'purchase_order_id' => $purchaseOrderReceipt['purchase_order_id'],
                    'purchase_order_item_id' => $purchaseOrderReceipt['purchase_order_item_id'],
                    'purchase_order_status' => $purchaseOrderReceipt['purchase_order_status'],
                    'purchase_order_receiving_status' => $purchaseOrderReceipt['purchase_order_receiving_status'],
                    'quantity_received_before' => $purchaseOrderReceipt['quantity_received_before'],
                    'quantity_received_after' => $purchaseOrderReceipt['quantity_received_after'],
                    'remaining_quantity_after' => $purchaseOrderReceipt['remaining_quantity_after'],
                ];
            }

            $movement = StockMovement::query()->create([
                'uuid' => (string) Str::uuid(),
                'tenant_id' => $tenant->id,
                'branch_id' => $location->branch_id,
                'stock_location_id' => $location->id,
                'product_id' => $product->id,
                'stock_batch_id' => $batch->id,
                'movement_type' => 'stock_received',
                'quantity' => $quantityReceived,
                'running_balance' => $afterQuantity,
                'reference_type' => $purchaseOrderReceipt ? 'pharmaco_purchase_order' : 'stock_receipt',
                'reference_number' => $purchaseOrderReceipt['po_number'] ?? ($validated['reference_number'] ?? ('RCV-' . now()->format('YmdHis'))),
                'reason' => $validated['reason'] ?? (
                    $purchaseOrderReceipt
                        ? 'Stock received against PharmaCo360 purchase order.'
                        : 'Stock received through PharmaCo360 inventory API.'
                ),
                'performed_by' => $request->user()?->id,
                'occurred_at' => now(),
                'metadata' => $movementMetadata,
            ]);

            if (
                ! empty(
                    $validated[
                        '_inventory_receipt_guard_id'
                    ]
                )
            ) {
                app(
                    \App\Services\Inventory\MedicineReceiptDuplicateGuardService::class
                )->complete(
                    \App\Models\InventoryReceiptGuard::
                        query()->findOrFail(
                            $validated[
                                '_inventory_receipt_guard_id'
                            ]
                        ),
                    $movement,
                    $batch
                );
            }


            return [
                $batch->fresh(['product.category', 'stockLocation', 'branch']),
                $movement,
                $beforeQuantity,
                $afterQuantity,
                $purchaseOrderReceipt,
            ];
        });

        $scope = $scopeResolver->resolveForUser($request->user());

        $auditMetadata = [
            'tenant_slug' => $tenant->slug,
            'product_sku' => $product->sku,
            'stock_location_code' => $location->code,
            'batch_number' => $batch->batch_number,
            'quantity_received' => $quantityReceived,
            'before_quantity' => $beforeQuantity,
            'after_quantity' => $afterQuantity,
            'movement_id' => $movement->id,
        ];

        if ($purchaseOrderReceipt) {
            $auditMetadata = [
                ...$auditMetadata,
                'purchase_order_id' => $purchaseOrderReceipt['purchase_order_id'],
                'purchase_order_item_id' => $purchaseOrderReceipt['purchase_order_item_id'],
                'po_number' => $purchaseOrderReceipt['po_number'],
                'purchase_order_status' => $purchaseOrderReceipt['purchase_order_status'],
                'purchase_order_receiving_status' => $purchaseOrderReceipt['purchase_order_receiving_status'],
            ];
        }

        $auditLogService->record(
            action: $purchaseOrderReceipt ? 'pharmaco.purchase_order.stock_received' : 'pharmaco.stock.received',
            scope: $scope,
            metadata: $auditMetadata,
            dataClassification: 'internal',
            auditableType: StockBatch::class,
            auditableId: $batch->id
        );

        return response()->json([
            'message' => $purchaseOrderReceipt
                ? 'Stock received against purchase order successfully.'
                : 'Stock received successfully.',
            'batch' => $this->serializeBatch($batch),
            'movement' => $this->serializeMovement($movement),
            'purchase_order_receipt' => $purchaseOrderReceipt,
        ], 201);
    }

    private function serializeCategory(ProductCategory $category): array
    {
        return [
            'id' => $category->id,
            'uuid' => $category->uuid,
            'name' => $category->name,
            'code' => $category->code,
            'category_type' => $category->category_type,
            'status' => $category->status,
            'description' => $category->description,
            'products_count' => $category->products_count ?? $category->products()->count(),
        ];
    }

    private function serializeLocation(StockLocation $location): array
    {
        return [
            'id' => $location->id,
            'uuid' => $location->uuid,
            'branch_id' => $location->branch_id,
            'branch_name' => $location->branch?->name,
            'branch' => $location->branch ? [
                'id' => $location->branch->id,
                'name' => $location->branch->name,
                'code' => $location->branch->code,
            ] : null,
            'name' => $location->name,
            'code' => $location->code,
            'location_type' => $location->location_type,
            'status' => $location->status,
            'stock_batches_count' => $location->stock_batches_count ?? $location->stockBatches()->count(),
            'metadata' => $location->metadata ?? [],
        ];
    }

    private function resolveTenant(
        Request $request,
    ): Tenant {
        $slug =
            $request->header('X-Tenant-Slug')
            ?: $request->header('X-Tenant')
            ?: $request->input('tenant_slug');

        abort_if(
            ! is_string($slug)
            || trim($slug) === '',
            422,
            'Tenant context is required.',
        );

        return Tenant::query()
            ->where('slug', trim($slug))
            ->where('status', 'active')
            ->firstOrFail();
    }

    private function tenantPayload($tenant): array
    {
        return [
            'id' => $tenant->id,
            'name' => $tenant->name,
            'slug' => $tenant->slug,
        ];
    }

    private function serializeProduct(Product $product, bool $includeStockSummary = false): array
    {
        $payload = [
            'id' => $product->id,
            'uuid' => $product->uuid,
            'name' => $product->name,
            'generic_name' => $product->generic_name,
            'brand_name' => $product->brand_name,
            'sku' => $product->sku,
            'barcode' => $product->barcode,
            'registration_number' => $product->registration_number,
            'dosage_form' => $product->dosage_form,
            'strength' => $product->strength,
            'unit' => $product->unit,
            'selling_unit' => $product->selling_unit ?? $product->unit,
            'base_unit' => $product->base_unit ?? $product->unit,
            'quantity_per_selling_unit' => (float) ($product->quantity_per_selling_unit ?? 1),
            'allow_other_quantity' => (bool) $product->allow_other_quantity,
            'default_pos_quantity_mode' => $product->default_pos_quantity_mode ?? 'selling_unit',
            'selling_unit_notes' => $product->selling_unit_notes,
            'ai_suggested_quantity_per_unit' => $product->ai_suggested_quantity_per_unit === null
                ? null
                : (float) $product->ai_suggested_quantity_per_unit,
            'ai_suggestion_status' => $product->ai_suggestion_status ?? 'not_requested',
            'ai_suggestion_confidence' => $product->ai_suggestion_confidence === null
                ? null
                : (float) $product->ai_suggestion_confidence,
            'ai_suggestion_explanation' => $product->ai_suggestion_explanation,
            'ai_suggestion_source' => $product->ai_suggestion_source,
            'ai_suggestion_reference' => $product->ai_suggestion_reference,
            'ai_suggestion_reviewed_by' => $product->ai_suggestion_reviewed_by,
            'ai_suggestion_reviewed_at' => optional($product->ai_suggestion_reviewed_at)?->toISOString(),
            'pack_size' => $product->pack_size,
            'route_of_administration' => $product->route_of_administration,
            'product_type' => $product->product_type,
            'regulatory_status' => $product->regulatory_status,
            'requires_prescription' => $product->requires_prescription,
            'is_controlled' => $product->is_controlled,
            'reorder_level' => (float) $product->reorder_level,
            'minimum_stock_level' => (float) $product->minimum_stock_level,
            'maximum_stock_level' => $product->maximum_stock_level === null ? null : (float) $product->maximum_stock_level,
            'status' => $product->status,
            'category' => $product->category ? [
                'id' => $product->category->id,
                'name' => $product->category->name,
                'code' => $product->category->code,
                'category_type' => $product->category->category_type,
            ] : null,
            'metadata' => $product->metadata ?? [],
        ];

        if ($includeStockSummary) {
            $quantityOnHand = (float) ($product->total_quantity_on_hand ?? $product->stockBatches->sum('quantity_on_hand') ?? 0);
            $quantityReserved = (float) ($product->total_quantity_reserved ?? $product->stockBatches->sum('quantity_reserved') ?? 0);

            $payload['stock_summary'] = [
                'quantity_on_hand' => $quantityOnHand,
                'quantity_reserved' => $quantityReserved,
                'available_quantity' => $quantityOnHand - $quantityReserved,
                'is_below_reorder_level' => $quantityOnHand <= (float) $product->reorder_level,
            ];
        }

        return $payload;
    }


    private function serializeMovement(StockMovement $movement): array
    {
        return [
            'id' => $movement->id,
            'uuid' => $movement->uuid,
            'movement_type' => $movement->movement_type,
            'quantity' => (float) $movement->quantity,
            'running_balance' => $movement->running_balance === null ? null : (float) $movement->running_balance,
            'reference_type' => $movement->reference_type,
            'reference_number' => $movement->reference_number,
            'reason' => $movement->reason,
            'occurred_at' => $movement->occurred_at?->toISOString(),
            'metadata' => $movement->metadata ?? [],
        ];
    }


    public function updateBatch(Request $request, StockBatch $batch)
    {
        $metadata = is_array($batch->metadata) ? $batch->metadata : [];
        $source = strtolower((string) (
            $metadata['receive_source']
            ?? $metadata['inventory_receive_source']
            ?? $metadata['source']
            ?? $metadata['created_from']
            ?? ''
        ));
        $isManualInventoryEntry = ($metadata['manual_product_master_entry'] ?? false) === true
            || str_contains($source, 'manual');

        if (! $isManualInventoryEntry) {
            throw ValidationException::withMessages([
                'inventory_record' => [
                    'This inventory record is purchase-linked and cannot be directly edited. Use the purchase correction workflow instead.',
                ],
            ]);
        }


        $tenant = $this->resolveTenant($request);

        if ((int) $batch->tenant_id !== (int) $tenant->id) {
            abort(404, 'Inventory batch not found.');
        }

        $validated = $request->validate([
            'product_id' => ['required', 'integer', 'exists:products,id'],
            'stock_location_id' => ['required', 'integer', 'exists:stock_locations,id'],
            'batch_number' => ['required', 'string', 'max:100'],
            'quantity' => ['required', 'numeric', 'min:0'],
            'expiry_date' => ['nullable', 'date'],
            'unit_cost' => ['nullable', 'numeric', 'min:0'],
            'selling_price' => ['nullable', 'numeric', 'min:0'],
            'supplier_name' => ['nullable', 'string', 'max:191'],
            'reference_number' => ['nullable', 'string', 'max:100'],
        ]);

        $product = Product::query()
            ->where('tenant_id', $tenant->id)
            ->where('id', $validated['product_id'])
            ->firstOrFail();

        $location = StockLocation::query()
            ->where('tenant_id', $tenant->id)
            ->where('id', $validated['stock_location_id'])
            ->firstOrFail();

        $batch->product_id = $product->id;
        $batch->stock_location_id = $location->id;
        $batch->batch_number = $validated['batch_number'];
        $batch->quantity_on_hand = (float) $validated['quantity'];
        $batch->expiry_date = $validated['expiry_date'] ?? null;
        $batch->unit_cost = $validated['unit_cost'] ?? null;
        $batch->selling_price = $validated['selling_price'] ?? null;
        $batch->supplier_name = $validated['supplier_name'] ?? null;
        $batch->status = ((float) $validated['quantity'] > 0) ? 'available' : 'depleted';
        $batch->save();

        $batch->load(['product', 'stockLocation', 'branch']);

        return response()->json([
            'message' => 'Inventory batch updated.',
            'batch' => $this->serializeBatch($batch),
        ]);
    }

    public function deleteBatch(Request $request, StockBatch $batch)
    {
        $tenant = $this->resolveTenant($request);

        if ((int) $batch->tenant_id !== (int) $tenant->id) {
            abort(404, 'Inventory batch not found.');
        }

        if ((float) ($batch->quantity_reserved ?? 0) > 0) {
            abort(422, 'This batch has reserved quantity and cannot be deleted.');
        }

        \Illuminate\Support\Facades\DB::table('stock_movements')
            ->where('stock_batch_id', $batch->id)
            ->delete();

        $batchNumber = $batch->batch_number;
        $batch->delete();

        return response()->json([
            'message' => "Inventory batch {$batchNumber} deleted.",
        ]);
    }

    private function serializeBatch(StockBatch $batch): array
    {
        $metadata = is_array($batch->metadata) ? $batch->metadata : [];
        $source = strtolower((string) (
            $metadata['receive_source']
            ?? $metadata['inventory_receive_source']
            ?? $metadata['source']
            ?? $metadata['created_from']
            ?? ''
        ));
        $isManualInventoryEntry = ($metadata['manual_product_master_entry'] ?? false) === true
            || str_contains($source, 'manual');
        $receiveSource = $isManualInventoryEntry
            ? 'manual'
            : (str_contains($source, 'purchase') || str_contains($source, 'procurement')
                ? 'purchase-code'
                : 'unknown');

        $productMetadata = is_array($batch->product->metadata)
            ? $batch->product->metadata
            : [];
        $masterSellingUnit = trim((string) (
            $productMetadata['rhia_selling_unit']
            ?? $batch->product->selling_unit
            ?? $batch->product->unit
            ?? 'unit'
        ));

        if ($masterSellingUnit === '') {
            $masterSellingUnit = 'unit';
        }

        return [
            'id' => $batch->id,
            'uuid' => $batch->uuid,
            'batch_number' => $batch->batch_number,
            'expiry_date' => $batch->expiry_date?->toDateString(),
            'received_at' => $batch->received_at?->toDateString(),
            'quantity_on_hand' => (float) $batch->quantity_on_hand,
            'quantity_reserved' => (float) $batch->quantity_reserved,
            'available_quantity' => (float) $batch->quantity_on_hand - (float) $batch->quantity_reserved,
            'unit_cost' => $batch->unit_cost === null ? null : (float) $batch->unit_cost,
            'amount' => round(
                (float) $batch->quantity_on_hand
                * (float) ($batch->unit_cost ?? 0),
                2
            ),
            'selling_price' => $batch->selling_price === null ? null : (float) $batch->selling_price,
            'supplier_name' => $batch->supplier_name,
            'status' => $batch->status,
            'product' => [
                'id' => $batch->product->id,
                'name' => $batch->product->name,
                'sku' => $batch->product->sku,
                'unit' => $batch->product->unit,
                'selling_unit' => $masterSellingUnit,
                'selling_unit_source' => array_key_exists('rhia_selling_unit', $productMetadata)
                    ? 'product_master.rhia_selling_unit'
                    : 'product_master.selling_unit',
                'base_unit' => $batch->product->base_unit ?? $batch->product->unit,
                'quantity_per_selling_unit' => (float) ($batch->product->quantity_per_selling_unit ?? 1),
                'allow_other_quantity' => (bool) $batch->product->allow_other_quantity,
                'default_pos_quantity_mode' => $batch->product->default_pos_quantity_mode ?? 'selling_unit',
                'metadata' => $productMetadata,
                'category' => $batch->product->category ? [
                    'name' => $batch->product->category->name,
                    'code' => $batch->product->category->code,
                ] : null,
            ],
            'branch' => [
                'id' => $batch->branch->id,
                'name' => $batch->branch->name,
                'code' => $batch->branch->code,
            ],
            'stock_location' => [
                'id' => $batch->stockLocation->id,
                'name' => $batch->stockLocation->name,
                'code' => $batch->stockLocation->code,
                'location_type' => $batch->stockLocation->location_type,
            ],
            'reference_number' => $metadata['reference_number'] ?? null,

            'receive_source' => $receiveSource,

            'is_manual_inventory_entry' => $isManualInventoryEntry,

            'can_edit_inventory_record' => $isManualInventoryEntry,

            'metadata' => $metadata,
        ];
    }

    private function parseProductCsv(string $path): array
    {
        $handle = fopen($path, 'r');

        if (! $handle) {
            return [];
        }

        $headers = null;
        $rows = [];

        while (($line = fgetcsv($handle)) !== false) {
            if ($headers === null) {
                $headers = array_map(fn ($value) => Str::snake(trim((string) $value)), $line);
                continue;
            }

            $row = [];

            foreach ($headers as $index => $header) {
                $row[$header] = $line[$index] ?? null;
            }

            if (array_filter($row, fn ($value) => $value !== null && $value !== '') !== []) {
                $rows[] = $row;
            }
        }

        fclose($handle);

        return $rows;
    }

    private function normalizeProductImportRow(array $row): array
    {
        $normalized = [];

        foreach ($row as $key => $value) {
            $normalized[Str::snake((string) $key)] = is_string($value) ? trim($value) : $value;
        }

        foreach (['requires_prescription', 'is_controlled'] as $booleanField) {
            if (array_key_exists($booleanField, $normalized)) {
                $normalized[$booleanField] = filter_var($normalized[$booleanField], FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE) ?? false;
            }
        }

        return $normalized;
    }

    private function applyBulkProductUpdate(Product $product, array $values): void
    {
        $allowed = collect($values)->only([
            'product_category_id',
            'regulatory_status',
            'requires_prescription',
            'is_controlled',
            'reorder_level',
            'minimum_stock_level',
            'maximum_stock_level',
            'status',
        ])->all();

        if ($allowed === []) {
            throw ValidationException::withMessages([
                'values' => ['Provide at least one editable bulk field.'],
            ]);
        }

        $product->fill($allowed);
        $product->save();
    }

    private function deleteProductIfSafe(Product $product): void
    {
        if ($product->stockBatches()->exists() || $product->stockMovements()->exists()) {
            throw ValidationException::withMessages([
                'product' => ["{$product->sku} has stock history. Discontinue it instead of deleting."],
            ]);
        }

        $product->delete();
    }
}
