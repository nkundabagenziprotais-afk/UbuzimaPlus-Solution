<?php

namespace App\Http\Controllers\Api\V1\PharmaCo360;

use App\Http\Controllers\Controller;
use App\Models\PharmacoPurchaseOrderItem;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\StockBatch;
use App\Models\StockLocation;
use App\Models\StockMovement;
use App\Services\Access\ScopeResolver;
use App\Services\Audit\AuditLogService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

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


    public function receiveStock(
        Request $request,
        AuditLogService $auditLogService,
        ScopeResolver $scopeResolver
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
        ]);

        $product = Product::query()
            ->where('tenant_id', $tenant->id)
            ->findOrFail($validated['product_id']);

        $location = StockLocation::query()
            ->with('branch')
            ->where('tenant_id', $tenant->id)
            ->findOrFail($validated['stock_location_id']);

        $quantityReceived = (float) $validated['quantity'];

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

            if (in_array($purchaseOrder->status, ['cancelled', 'voided', 'closed'], true)) {
                throw ValidationException::withMessages([
                    'pharmaco_purchase_order_item_id' => ['Stock cannot be received against a closed or cancelled purchase order.'],
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
            $purchaseOrderItem
        ) {
            $lockedPurchaseOrderItem = null;
            $purchaseOrderReceipt = null;
            $purchaseOrderSupplierName = null;

            if ($purchaseOrderItem) {
                $lockedPurchaseOrderItem = PharmacoPurchaseOrderItem::query()
                    ->where('tenant_id', $tenant->id)
                    ->lockForUpdate()
                    ->findOrFail($purchaseOrderItem->id);

                $lockedPurchaseOrderItem->load(['purchaseOrder.supplier', 'purchaseOrder.items']);

                $purchaseOrder = $lockedPurchaseOrderItem->purchaseOrder;

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
