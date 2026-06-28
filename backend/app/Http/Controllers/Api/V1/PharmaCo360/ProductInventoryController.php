<?php

namespace App\Http\Controllers\Api\V1\PharmaCo360;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\StockBatch;
use App\Models\StockLocation;
use App\Services\Access\ScopeResolver;
use App\Services\Audit\AuditLogService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class ProductInventoryController extends Controller
{
    public function products(Request $request): JsonResponse
    {
        $tenant = $request->attributes->get('tenant');

        $products = Product::query()
            ->with('category')
            ->where('tenant_id', $tenant->id)
            ->when($request->query('status'), fn ($query, $status) => $query->where('status', $status))
            ->when($request->query('product_type'), fn ($query, $type) => $query->where('product_type', $type))
            ->when($request->query('category_code'), function ($query, $categoryCode) use ($tenant) {
                $query->whereHas('category', fn ($categoryQuery) => $categoryQuery
                    ->where('tenant_id', $tenant->id)
                    ->where('code', $categoryCode)
                );
            })
            ->withSum('stockBatches as total_quantity_on_hand', 'quantity_on_hand')
            ->withSum('stockBatches as total_quantity_reserved', 'quantity_reserved')
            ->orderBy('name')
            ->get()
            ->map(fn (Product $product) => $this->serializeProduct($product, includeStockSummary: true))
            ->values();

        return response()->json([
            'tenant' => $this->tenantPayload($tenant),
            'products' => $products,
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

    public function batches(Request $request): JsonResponse
    {
        $tenant = $request->attributes->get('tenant');

        $batches = StockBatch::query()
            ->with(['product.category', 'stockLocation', 'branch'])
            ->where('tenant_id', $tenant->id)
            ->when($request->query('branch_id'), fn ($query, $branchId) => $query->where('branch_id', $branchId))
            ->when($request->query('product_id'), fn ($query, $productId) => $query->where('product_id', $productId))
            ->when($request->query('status'), fn ($query, $status) => $query->where('status', $status))
            ->when($request->query('expiring_within_days'), function ($query, $days) {
                $query->whereNotNull('expiry_date')
                    ->whereDate('expiry_date', '<=', now()->addDays((int) $days)->toDateString());
            })
            ->orderBy('expiry_date')
            ->get()
            ->map(fn (StockBatch $batch) => $this->serializeBatch($batch))
            ->values();

        return response()->json([
            'tenant' => $this->tenantPayload($tenant),
            'batches' => $batches,
        ]);
    }

    public function summary(Request $request): JsonResponse
    {
        $tenant = $request->attributes->get('tenant');

        $products = Product::query()
            ->where('tenant_id', $tenant->id)
            ->withSum('stockBatches as total_quantity_on_hand', 'quantity_on_hand')
            ->get();

        $lowStockProducts = $products
            ->filter(fn (Product $product) => (float) ($product->total_quantity_on_hand ?? 0) <= (float) $product->reorder_level)
            ->values();

        $stockValue = StockBatch::query()
            ->where('tenant_id', $tenant->id)
            ->selectRaw('COALESCE(SUM(quantity_on_hand * COALESCE(selling_price, 0)), 0) as value')
            ->value('value');

        $summary = [
            'product_categories_count' => ProductCategory::where('tenant_id', $tenant->id)->count(),
            'products_count' => $products->count(),
            'stock_locations_count' => StockLocation::where('tenant_id', $tenant->id)->count(),
            'stock_batches_count' => StockBatch::where('tenant_id', $tenant->id)->count(),
            'total_quantity_on_hand' => (float) StockBatch::where('tenant_id', $tenant->id)->sum('quantity_on_hand'),
            'estimated_stock_value' => (float) $stockValue,
            'low_stock_products_count' => $lowStockProducts->count(),
            'near_expiry_batches_180_days_count' => StockBatch::where('tenant_id', $tenant->id)
                ->whereNotNull('expiry_date')
                ->whereDate('expiry_date', '<=', now()->addDays(180)->toDateString())
                ->count(),
        ];

        return response()->json([
            'tenant' => $this->tenantPayload($tenant),
            'summary' => $summary,
            'low_stock_products' => $lowStockProducts
                ->map(fn (Product $product) => $this->serializeProduct($product, includeStockSummary: true))
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
        ]);

        $product = Product::query()->create([
            ...$validated,
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $tenant->id,
            'requires_prescription' => $validated['requires_prescription'] ?? false,
            'is_controlled' => $validated['is_controlled'] ?? false,
            'reorder_level' => $validated['reorder_level'] ?? 0,
            'minimum_stock_level' => $validated['minimum_stock_level'] ?? 0,
            'maximum_stock_level' => $validated['maximum_stock_level'] ?? null,
            'status' => $validated['status'] ?? 'active',
            'metadata' => [
                'created_from' => 'pharmaco_product_inventory_api',
            ],
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
        ]);

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

    private function serializeBatch(StockBatch $batch): array
    {
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
            'selling_price' => $batch->selling_price === null ? null : (float) $batch->selling_price,
            'supplier_name' => $batch->supplier_name,
            'status' => $batch->status,
            'product' => [
                'id' => $batch->product->id,
                'name' => $batch->product->name,
                'sku' => $batch->product->sku,
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
            'metadata' => $batch->metadata ?? [],
        ];
    }
}
