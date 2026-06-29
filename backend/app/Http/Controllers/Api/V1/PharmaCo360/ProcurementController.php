<?php

namespace App\Http\Controllers\Api\V1\PharmaCo360;

use App\Http\Controllers\Controller;
use App\Models\Branch;
use App\Models\PharmacoPurchaseOrder;
use App\Models\PharmacoPurchaseOrderItem;
use App\Models\PharmacoSupplier;
use App\Models\PharmacoSupplierInvoice;
use App\Models\PharmacoSupplierInvoiceItem;
use App\Models\PharmacoSupplierPayment;
use App\Models\Product;
use App\Services\Access\ScopeResolver;
use App\Services\Audit\AuditLogService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class ProcurementController extends Controller
{
    public function suppliers(Request $request): JsonResponse
    {
        $tenant = $request->attributes->get('tenant');

        $suppliers = PharmacoSupplier::query()
            ->where('tenant_id', $tenant->id)
            ->when($request->query('status'), fn ($query, $status) => $query->where('status', $status))
            ->when($request->query('supplier_type'), fn ($query, $type) => $query->where('supplier_type', $type))
            ->when($request->query('search'), function ($query, $search) {
                $query->where(function ($inner) use ($search) {
                    $inner->where('supplier_code', 'like', "%{$search}%")
                        ->orWhere('name', 'like', "%{$search}%")
                        ->orWhere('legal_name', 'like', "%{$search}%")
                        ->orWhere('phone', 'like', "%{$search}%")
                        ->orWhere('email', 'like', "%{$search}%");
                });
            })
            ->orderBy('name')
            ->get();

        return response()->json([
            'tenant' => $this->tenantPayload($tenant),
            'suppliers' => $suppliers->map(fn (PharmacoSupplier $supplier) => $this->serializeSupplier($supplier))->values(),
        ]);
    }

    public function createSupplier(
        Request $request,
        AuditLogService $auditLogService,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        $tenant = $request->attributes->get('tenant');

        $validated = $request->validate([
            'supplier_code' => ['nullable', 'string', 'max:80'],
            'name' => ['required', 'string', 'max:255'],
            'legal_name' => ['nullable', 'string', 'max:255'],
            'supplier_type' => ['required', 'string', 'in:wholesaler,manufacturer,distributor,importer,other'],
            'contact_person' => ['nullable', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:80'],
            'email' => ['nullable', 'email', 'max:255'],
            'tax_identification_number' => ['nullable', 'string', 'max:120'],
            'license_number' => ['nullable', 'string', 'max:120'],
            'address' => ['nullable', 'string'],
            'payment_terms' => ['nullable', 'string', 'max:120'],
            'status' => ['nullable', 'string', 'in:active,inactive,suspended'],
            'notes' => ['nullable', 'string', 'max:500'],
        ]);

        $supplierCode = $validated['supplier_code'] ?? $this->nextSupplierCode($tenant->id);

        $exists = PharmacoSupplier::query()
            ->where('tenant_id', $tenant->id)
            ->where('supplier_code', $supplierCode)
            ->exists();

        if ($exists) {
            throw ValidationException::withMessages([
                'supplier_code' => ['This supplier code already exists for the current tenant.'],
            ]);
        }

        $supplier = PharmacoSupplier::query()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $tenant->id,
            'supplier_code' => $supplierCode,
            'name' => $validated['name'],
            'legal_name' => $validated['legal_name'] ?? null,
            'supplier_type' => $validated['supplier_type'],
            'contact_person' => $validated['contact_person'] ?? null,
            'phone' => $validated['phone'] ?? null,
            'email' => $validated['email'] ?? null,
            'tax_identification_number' => $validated['tax_identification_number'] ?? null,
            'license_number' => $validated['license_number'] ?? null,
            'address' => $validated['address'] ?? null,
            'payment_terms' => $validated['payment_terms'] ?? null,
            'status' => $validated['status'] ?? 'active',
            'metadata' => [
                'notes' => $validated['notes'] ?? null,
                'creation_workflow' => 'phase_7_1_create_supplier',
            ],
        ]);

        $scope = $scopeResolver->resolveForUser($request->user());

        $auditLogService->record(
            action: 'pharmaco.supplier.created',
            scope: $scope,
            metadata: [
                'tenant_slug' => $tenant->slug,
                'supplier_id' => $supplier->id,
                'supplier_code' => $supplier->supplier_code,
                'supplier_type' => $supplier->supplier_type,
            ],
            dataClassification: 'internal',
            auditableType: PharmacoSupplier::class,
            auditableId: $supplier->id
        );

        return response()->json([
            'message' => 'Supplier created successfully.',
            'supplier' => $this->serializeSupplier($supplier),
        ], 201);
    }


    public function updateSupplier(
        Request $request,
        PharmacoSupplier $supplier,
        AuditLogService $auditLogService,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        $tenant = $request->attributes->get('tenant');

        if ((int) $supplier->tenant_id !== (int) $tenant->id) {
            abort(404);
        }

        $validated = $request->validate([
            'supplier_code' => ['sometimes', 'string', 'max:80'],
            'name' => ['sometimes', 'string', 'max:255'],
            'legal_name' => ['nullable', 'string', 'max:255'],
            'supplier_type' => ['sometimes', 'string', 'in:wholesaler,manufacturer,distributor,importer,other'],
            'contact_person' => ['nullable', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:80'],
            'email' => ['nullable', 'email', 'max:255'],
            'tax_identification_number' => ['nullable', 'string', 'max:120'],
            'license_number' => ['nullable', 'string', 'max:120'],
            'address' => ['nullable', 'string'],
            'payment_terms' => ['nullable', 'string', 'max:120'],
            'status' => ['sometimes', 'string', 'in:active,inactive,suspended'],
            'notes' => ['nullable', 'string', 'max:500'],
        ]);

        if (array_key_exists('supplier_code', $validated)) {
            $exists = PharmacoSupplier::query()
                ->where('tenant_id', $tenant->id)
                ->where('supplier_code', $validated['supplier_code'])
                ->where('id', '!=', $supplier->id)
                ->exists();

            if ($exists) {
                throw ValidationException::withMessages([
                    'supplier_code' => ['This supplier code already exists for the current tenant.'],
                ]);
            }
        }

        $before = $supplier->only([
            'supplier_code',
            'name',
            'legal_name',
            'supplier_type',
            'contact_person',
            'phone',
            'email',
            'tax_identification_number',
            'license_number',
            'address',
            'payment_terms',
            'status',
        ]);

        $metadata = $supplier->metadata ?? [];

        if (array_key_exists('notes', $validated)) {
            $metadata['notes'] = $validated['notes'];
            unset($validated['notes']);
        }

        $supplier->fill($validated);
        $supplier->metadata = [
            ...$metadata,
            'last_updated_from' => 'phase_8_2_procurement_dashboard',
        ];
        $supplier->save();

        $scope = $scopeResolver->resolveForUser($request->user());

        $auditLogService->record(
            action: 'pharmaco.supplier.updated',
            scope: $scope,
            metadata: [
                'tenant_slug' => $tenant->slug,
                'supplier_id' => $supplier->id,
                'supplier_code' => $supplier->supplier_code,
                'before' => $before,
                'after' => $supplier->only(array_keys($before)),
            ],
            dataClassification: 'internal',
            auditableType: PharmacoSupplier::class,
            auditableId: $supplier->id
        );

        return response()->json([
            'message' => 'Supplier updated successfully.',
            'supplier' => $this->serializeSupplier($supplier->fresh()),
        ]);
    }

    public function purchaseOrders(Request $request): JsonResponse
    {
        $tenant = $request->attributes->get('tenant');

        $purchaseOrders = PharmacoPurchaseOrder::query()
            ->with(['supplier', 'branch'])
            ->withCount('items')
            ->where('tenant_id', $tenant->id)
            ->when($request->query('status'), fn ($query, $status) => $query->where('status', $status))
            ->when($request->query('branch_id'), fn ($query, $branchId) => $query->where('branch_id', $branchId))
            ->when($request->query('supplier_id'), fn ($query, $supplierId) => $query->where('pharmaco_supplier_id', $supplierId))
            ->latest('created_at')
            ->get();

        return response()->json([
            'tenant' => $this->tenantPayload($tenant),
            'purchase_orders' => $purchaseOrders
                ->map(fn (PharmacoPurchaseOrder $purchaseOrder) => $this->serializePurchaseOrder($purchaseOrder))
                ->values(),
        ]);
    }

    public function purchaseOrder(Request $request, PharmacoPurchaseOrder $purchaseOrder): JsonResponse
    {
        $tenant = $request->attributes->get('tenant');

        if ((int) $purchaseOrder->tenant_id !== (int) $tenant->id) {
            abort(404);
        }

        $purchaseOrder->load(['supplier', 'branch', 'items.product.category']);

        return response()->json([
            'tenant' => $this->tenantPayload($tenant),
            'purchase_order' => $this->serializePurchaseOrder($purchaseOrder, includeDetails: true),
        ]);
    }

    public function createPurchaseOrder(
        Request $request,
        AuditLogService $auditLogService,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        $tenant = $request->attributes->get('tenant');

        $validated = $request->validate([
            'branch_id' => ['required', 'integer'],
            'pharmaco_supplier_id' => ['required', 'integer'],
            'po_number' => ['nullable', 'string', 'max:120'],
            'order_date' => ['nullable', 'date'],
            'expected_delivery_date' => ['nullable', 'date', 'after_or_equal:order_date'],
            'discount_amount' => ['nullable', 'numeric', 'gte:0'],
            'tax_amount' => ['nullable', 'numeric', 'gte:0'],
            'shipping_amount' => ['nullable', 'numeric', 'gte:0'],
            'notes' => ['nullable', 'string'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'integer'],
            'items.*.quantity_ordered' => ['required', 'numeric', 'gt:0'],
            'items.*.unit_cost' => ['required', 'numeric', 'gte:0'],
            'items.*.discount_amount' => ['nullable', 'numeric', 'gte:0'],
            'items.*.tax_amount' => ['nullable', 'numeric', 'gte:0'],
            'items.*.notes' => ['nullable', 'string'],
        ]);

        $branch = Branch::query()
            ->where('tenant_id', $tenant->id)
            ->where('status', 'active')
            ->find($validated['branch_id']);

        if (! $branch) {
            throw ValidationException::withMessages([
                'branch_id' => ['Selected branch does not belong to the current tenant or is inactive.'],
            ]);
        }

        $supplier = PharmacoSupplier::query()
            ->where('tenant_id', $tenant->id)
            ->where('status', 'active')
            ->find($validated['pharmaco_supplier_id']);

        if (! $supplier) {
            throw ValidationException::withMessages([
                'pharmaco_supplier_id' => ['Selected supplier does not belong to the current tenant or is inactive.'],
            ]);
        }

        $productIds = collect($validated['items'])->pluck('product_id')->unique()->values();
        $products = Product::query()
            ->where('tenant_id', $tenant->id)
            ->whereIn('id', $productIds)
            ->get()
            ->keyBy('id');

        if ($products->count() !== $productIds->count()) {
            throw ValidationException::withMessages([
                'items' => ['One or more selected products do not belong to the current tenant.'],
            ]);
        }

        if ($products->contains(fn (Product $product) => $product->status !== 'active')) {
            throw ValidationException::withMessages([
                'items' => ['Inactive products cannot be added to a purchase order.'],
            ]);
        }

        $poNumber = $validated['po_number'] ?? $this->nextPurchaseOrderNumber($tenant->id);

        $poExists = PharmacoPurchaseOrder::query()
            ->where('tenant_id', $tenant->id)
            ->where('po_number', $poNumber)
            ->exists();

        if ($poExists) {
            throw ValidationException::withMessages([
                'po_number' => ['This purchase order number already exists for the current tenant.'],
            ]);
        }

        $purchaseOrder = DB::transaction(function () use ($request, $tenant, $validated, $branch, $supplier, $products, $poNumber) {
            $lineItems = collect($validated['items'])->map(function (array $item) use ($tenant, $products) {
                /** @var Product $product */
                $product = $products->get($item['product_id']);

                $quantity = round((float) $item['quantity_ordered'], 3);
                $unitCost = round((float) $item['unit_cost'], 2);
                $discount = round((float) ($item['discount_amount'] ?? 0), 2);
                $tax = round((float) ($item['tax_amount'] ?? 0), 2);
                $lineTotal = round(($quantity * $unitCost) - $discount + $tax, 2);

                if ($lineTotal < 0) {
                    throw ValidationException::withMessages([
                        'items' => ["Line total cannot be negative for product {$product->sku}."],
                    ]);
                }

                return [
                    'uuid' => (string) Str::uuid(),
                    'tenant_id' => $tenant->id,
                    'product_id' => $product->id,
                    'product_name_snapshot' => $product->name,
                    'sku_snapshot' => $product->sku,
                    'quantity_ordered' => $quantity,
                    'quantity_received' => 0,
                    'unit_cost' => $unitCost,
                    'discount_amount' => $discount,
                    'tax_amount' => $tax,
                    'line_total' => $lineTotal,
                    'status' => 'pending',
                    'notes' => $item['notes'] ?? null,
                    'metadata' => [
                        'creation_workflow' => 'phase_7_1_create_purchase_order',
                    ],
                ];
            });

            $subtotal = round($lineItems->sum('line_total'), 2);
            $discount = round((float) ($validated['discount_amount'] ?? 0), 2);
            $tax = round((float) ($validated['tax_amount'] ?? 0), 2);
            $shipping = round((float) ($validated['shipping_amount'] ?? 0), 2);
            $total = round($subtotal - $discount + $tax + $shipping, 2);

            if ($total < 0) {
                throw ValidationException::withMessages([
                    'total_amount' => ['Purchase order total cannot be negative.'],
                ]);
            }

            $purchaseOrder = PharmacoPurchaseOrder::query()->create([
                'uuid' => (string) Str::uuid(),
                'tenant_id' => $tenant->id,
                'branch_id' => $branch->id,
                'pharmaco_supplier_id' => $supplier->id,
                'po_number' => $poNumber,
                'status' => 'draft',
                'order_date' => $validated['order_date'] ?? now()->toDateString(),
                'expected_delivery_date' => $validated['expected_delivery_date'] ?? null,
                'subtotal_amount' => $subtotal,
                'discount_amount' => $discount,
                'tax_amount' => $tax,
                'shipping_amount' => $shipping,
                'total_amount' => $total,
                'created_by' => $request->user()?->id,
                'notes' => $validated['notes'] ?? null,
                'metadata' => [
                    'creation_workflow' => 'phase_7_1_create_purchase_order',
                    'receiving_status' => 'not_received',
                ],
            ]);

            $lineItems->each(function (array $lineItem) use ($purchaseOrder) {
                $purchaseOrder->items()->create($lineItem);
            });

            return $purchaseOrder->fresh(['supplier', 'branch', 'items.product.category']);
        });

        $scope = $scopeResolver->resolveForUser($request->user());

        $auditLogService->record(
            action: 'pharmaco.purchase_order.created',
            scope: $scope,
            metadata: [
                'tenant_slug' => $tenant->slug,
                'purchase_order_id' => $purchaseOrder->id,
                'po_number' => $purchaseOrder->po_number,
                'supplier_id' => $supplier->id,
                'items_count' => $purchaseOrder->items->count(),
                'total_amount' => (float) $purchaseOrder->total_amount,
            ],
            dataClassification: 'internal',
            auditableType: PharmacoPurchaseOrder::class,
            auditableId: $purchaseOrder->id
        );

        return response()->json([
            'message' => 'Purchase order created successfully.',
            'purchase_order' => $this->serializePurchaseOrder($purchaseOrder, includeDetails: true),
        ], 201);
    }


    public function approvePurchaseOrder(
        Request $request,
        PharmacoPurchaseOrder $purchaseOrder,
        AuditLogService $auditLogService,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        $tenant = $request->attributes->get('tenant');

        if ((int) $purchaseOrder->tenant_id !== (int) $tenant->id) {
            abort(404);
        }

        if ($purchaseOrder->status !== 'draft') {
            throw ValidationException::withMessages([
                'status' => ['Only draft purchase orders can be approved.'],
            ]);
        }

        if ($purchaseOrder->items()->count() === 0) {
            throw ValidationException::withMessages([
                'items' => ['A purchase order must have at least one item before approval.'],
            ]);
        }

        $purchaseOrder->status = 'approved';
        $purchaseOrder->approved_by = $request->user()?->id;
        $purchaseOrder->approved_at = now();
        $purchaseOrder->metadata = [
            ...($purchaseOrder->metadata ?? []),
            'approval_workflow' => 'phase_8_2_procurement_approval_controls',
            'approved_from' => 'procurement_dashboard',
        ];
        $purchaseOrder->save();

        $purchaseOrder->load(['supplier', 'branch', 'items.product.category']);

        $scope = $scopeResolver->resolveForUser($request->user());

        $auditLogService->record(
            action: 'pharmaco.purchase_order.approved',
            scope: $scope,
            metadata: [
                'tenant_slug' => $tenant->slug,
                'purchase_order_id' => $purchaseOrder->id,
                'po_number' => $purchaseOrder->po_number,
                'supplier_id' => $purchaseOrder->pharmaco_supplier_id,
                'approved_by' => $request->user()?->id,
                'approved_at' => $purchaseOrder->approved_at?->toISOString(),
            ],
            dataClassification: 'internal',
            auditableType: PharmacoPurchaseOrder::class,
            auditableId: $purchaseOrder->id
        );

        return response()->json([
            'message' => 'Purchase order approved successfully.',
            'purchase_order' => $this->serializePurchaseOrder($purchaseOrder, includeDetails: true),
        ]);
    }

    public function cancelPurchaseOrder(
        Request $request,
        PharmacoPurchaseOrder $purchaseOrder,
        AuditLogService $auditLogService,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        $tenant = $request->attributes->get('tenant');

        if ((int) $purchaseOrder->tenant_id !== (int) $tenant->id) {
            abort(404);
        }

        $validated = $request->validate([
            'reason' => ['nullable', 'string', 'max:1000'],
        ]);

        if (in_array($purchaseOrder->status, ['received', 'cancelled'], true)) {
            throw ValidationException::withMessages([
                'status' => ['Received or already cancelled purchase orders cannot be cancelled.'],
            ]);
        }

        if ($purchaseOrder->items()->where('quantity_received', '>', 0)->exists()) {
            throw ValidationException::withMessages([
                'status' => ['Purchase orders with received stock cannot be cancelled.'],
            ]);
        }

        $purchaseOrder->status = 'cancelled';
        $purchaseOrder->metadata = [
            ...($purchaseOrder->metadata ?? []),
            'cancelled_at' => now()->toISOString(),
            'cancelled_by' => $request->user()?->id,
            'cancellation_reason' => $validated['reason'] ?? null,
            'cancellation_workflow' => 'phase_8_2_procurement_approval_controls',
        ];
        $purchaseOrder->save();

        $purchaseOrder->items()->update([
            'status' => 'cancelled',
            'updated_at' => now(),
        ]);

        $purchaseOrder->load(['supplier', 'branch', 'items.product.category']);

        $scope = $scopeResolver->resolveForUser($request->user());

        $auditLogService->record(
            action: 'pharmaco.purchase_order.cancelled',
            scope: $scope,
            metadata: [
                'tenant_slug' => $tenant->slug,
                'purchase_order_id' => $purchaseOrder->id,
                'po_number' => $purchaseOrder->po_number,
                'supplier_id' => $purchaseOrder->pharmaco_supplier_id,
                'reason' => $validated['reason'] ?? null,
            ],
            dataClassification: 'internal',
            auditableType: PharmacoPurchaseOrder::class,
            auditableId: $purchaseOrder->id
        );

        return response()->json([
            'message' => 'Purchase order cancelled successfully.',
            'purchase_order' => $this->serializePurchaseOrder($purchaseOrder, includeDetails: true),
        ]);
    }


    public function supplierInvoices(Request $request): JsonResponse
    {
        $tenant = $request->attributes->get('tenant');

        $invoices = PharmacoSupplierInvoice::query()
            ->with(['supplier', 'purchaseOrder'])
            ->where('tenant_id', $tenant->id)
            ->latest()
            ->limit(100)
            ->get();

        return response()->json([
            'tenant' => $this->tenantPayload($tenant),
            'supplier_invoices' => $invoices->map(fn (PharmacoSupplierInvoice $invoice) => $this->serializeSupplierInvoice($invoice)),
        ]);
    }

    public function supplierInvoice(Request $request, PharmacoSupplierInvoice $supplierInvoice): JsonResponse
    {
        $tenant = $request->attributes->get('tenant');

        if ((int) $supplierInvoice->tenant_id !== (int) $tenant->id) {
            abort(404);
        }

        $supplierInvoice->load([
            'supplier',
            'purchaseOrder',
            'items.product.category',
            'items.purchaseOrderItem',
            'payments',
        ]);

        return response()->json([
            'tenant' => $this->tenantPayload($tenant),
            'supplier_invoice' => $this->serializeSupplierInvoice($supplierInvoice, includeDetails: true),
        ]);
    }

    public function createSupplierInvoice(
        Request $request,
        AuditLogService $auditLogService,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        $tenant = $request->attributes->get('tenant');

        $validated = $request->validate([
            'pharmaco_supplier_id' => [
                'required',
                'integer',
                Rule::exists('pharmaco_suppliers', 'id')->where(fn ($query) => $query->where('tenant_id', $tenant->id)),
            ],
            'pharmaco_purchase_order_id' => [
                'nullable',
                'integer',
                Rule::exists('pharmaco_purchase_orders', 'id')->where(fn ($query) => $query->where('tenant_id', $tenant->id)),
            ],
            'invoice_number' => ['nullable', 'string', 'max:120'],
            'supplier_invoice_number' => ['nullable', 'string', 'max:120'],
            'invoice_date' => ['nullable', 'date'],
            'due_date' => ['nullable', 'date'],
            'discount_amount' => ['nullable', 'numeric', 'min:0'],
            'tax_amount' => ['nullable', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.pharmaco_purchase_order_item_id' => ['nullable', 'integer'],
            'items.*.product_id' => [
                'nullable',
                'integer',
                Rule::exists('products', 'id')->where(fn ($query) => $query->where('tenant_id', $tenant->id)),
            ],
            'items.*.quantity' => ['required', 'numeric', 'min:0.001'],
            'items.*.unit_cost' => ['required', 'numeric', 'min:0'],
            'items.*.discount_amount' => ['nullable', 'numeric', 'min:0'],
            'items.*.tax_amount' => ['nullable', 'numeric', 'min:0'],
            'items.*.notes' => ['nullable', 'string', 'max:1000'],
        ]);

        $supplier = PharmacoSupplier::query()
            ->where('tenant_id', $tenant->id)
            ->findOrFail($validated['pharmaco_supplier_id']);

        $purchaseOrder = null;

        if (! empty($validated['pharmaco_purchase_order_id'])) {
            $purchaseOrder = PharmacoPurchaseOrder::query()
                ->where('tenant_id', $tenant->id)
                ->findOrFail($validated['pharmaco_purchase_order_id']);

            if ((int) $purchaseOrder->pharmaco_supplier_id !== (int) $supplier->id) {
                throw ValidationException::withMessages([
                    'pharmaco_purchase_order_id' => ['Purchase order supplier must match the supplier invoice supplier.'],
                ]);
            }

            if (! in_array($purchaseOrder->status, ['approved', 'partially_received', 'received'], true)) {
                throw ValidationException::withMessages([
                    'pharmaco_purchase_order_id' => ['Only approved or received purchase orders can be invoiced.'],
                ]);
            }
        }

        $invoiceNumber = $validated['invoice_number'] ?? $this->nextSupplierInvoiceNumber($tenant->id);

        $duplicateInvoice = PharmacoSupplierInvoice::query()
            ->where('tenant_id', $tenant->id)
            ->where('invoice_number', $invoiceNumber)
            ->exists();

        if ($duplicateInvoice) {
            throw ValidationException::withMessages([
                'invoice_number' => ['This supplier invoice number already exists for the current tenant.'],
            ]);
        }

        $invoice = DB::transaction(function () use ($tenant, $validated, $supplier, $purchaseOrder, $invoiceNumber) {
            $subtotal = 0;
            $preparedItems = [];

            foreach ($validated['items'] as $itemPayload) {
                $purchaseOrderItem = null;

                if (! empty($itemPayload['pharmaco_purchase_order_item_id'])) {
                    $purchaseOrderItem = PharmacoPurchaseOrderItem::query()
                        ->where('tenant_id', $tenant->id)
                        ->find($itemPayload['pharmaco_purchase_order_item_id']);

                    if (! $purchaseOrderItem) {
                        throw ValidationException::withMessages([
                            'items' => ['One or more purchase order items do not belong to the current tenant.'],
                        ]);
                    }

                    if ($purchaseOrder && (int) $purchaseOrderItem->pharmaco_purchase_order_id !== (int) $purchaseOrder->id) {
                        throw ValidationException::withMessages([
                            'items' => ['Purchase order item must belong to the selected purchase order.'],
                        ]);
                    }

                    $productId = $purchaseOrderItem->product_id;
                    $productName = $purchaseOrderItem->product_name_snapshot;
                    $sku = $purchaseOrderItem->sku_snapshot;
                } else {
                    $product = Product::query()
                        ->where('tenant_id', $tenant->id)
                        ->find($itemPayload['product_id'] ?? null);

                    if (! $product) {
                        throw ValidationException::withMessages([
                            'items' => ['Product is required when no purchase order item is supplied.'],
                        ]);
                    }

                    $productId = $product->id;
                    $productName = $product->name;
                    $sku = $product->sku;
                }

                $quantity = (float) $itemPayload['quantity'];
                $unitCost = (float) $itemPayload['unit_cost'];
                $discount = (float) ($itemPayload['discount_amount'] ?? 0);
                $tax = (float) ($itemPayload['tax_amount'] ?? 0);
                $lineTotal = max(($quantity * $unitCost) - $discount + $tax, 0);

                $subtotal += $lineTotal;

                $preparedItems[] = [
                    'uuid' => (string) Str::uuid(),
                    'tenant_id' => $tenant->id,
                    'pharmaco_purchase_order_item_id' => $purchaseOrderItem?->id,
                    'product_id' => $productId,
                    'product_name_snapshot' => $productName,
                    'sku_snapshot' => $sku,
                    'quantity' => $quantity,
                    'unit_cost' => $unitCost,
                    'discount_amount' => $discount,
                    'tax_amount' => $tax,
                    'line_total' => $lineTotal,
                    'notes' => $itemPayload['notes'] ?? null,
                    'metadata' => [
                        'source' => $purchaseOrderItem ? 'purchase_order_item' : 'manual_invoice_item',
                    ],
                ];
            }

            $invoiceDiscount = (float) ($validated['discount_amount'] ?? 0);
            $invoiceTax = (float) ($validated['tax_amount'] ?? 0);
            $total = max($subtotal - $invoiceDiscount + $invoiceTax, 0);

            $invoice = PharmacoSupplierInvoice::query()->create([
                'uuid' => (string) Str::uuid(),
                'tenant_id' => $tenant->id,
                'pharmaco_supplier_id' => $supplier->id,
                'pharmaco_purchase_order_id' => $purchaseOrder?->id,
                'invoice_number' => $invoiceNumber,
                'supplier_invoice_number' => $validated['supplier_invoice_number'] ?? null,
                'status' => 'draft',
                'invoice_date' => $validated['invoice_date'] ?? now()->toDateString(),
                'due_date' => $validated['due_date'] ?? null,
                'subtotal_amount' => $subtotal,
                'discount_amount' => $invoiceDiscount,
                'tax_amount' => $invoiceTax,
                'total_amount' => $total,
                'paid_amount' => 0,
                'balance_amount' => $total,
                'notes' => $validated['notes'] ?? null,
                'metadata' => [
                    'created_from' => 'phase_9_1_supplier_invoice_api',
                    'purchase_order_number' => $purchaseOrder?->po_number,
                ],
            ]);

            foreach ($preparedItems as $preparedItem) {
                $invoice->items()->create($preparedItem);
            }

            return $invoice->fresh(['supplier', 'purchaseOrder', 'items.product.category']);
        });

        $scope = $scopeResolver->resolveForUser($request->user());

        $auditLogService->record(
            action: 'pharmaco.supplier_invoice.created',
            scope: $scope,
            metadata: [
                'tenant_slug' => $tenant->slug,
                'supplier_id' => $supplier->id,
                'supplier_invoice_id' => $invoice->id,
                'invoice_number' => $invoice->invoice_number,
                'total_amount' => (float) $invoice->total_amount,
            ],
            dataClassification: 'internal',
            auditableType: PharmacoSupplierInvoice::class,
            auditableId: $invoice->id
        );

        return response()->json([
            'message' => 'Supplier invoice created successfully.',
            'supplier_invoice' => $this->serializeSupplierInvoice($invoice, includeDetails: true),
        ], 201);
    }

    public function approveSupplierInvoice(
        Request $request,
        PharmacoSupplierInvoice $supplierInvoice,
        AuditLogService $auditLogService,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        $tenant = $request->attributes->get('tenant');

        if ((int) $supplierInvoice->tenant_id !== (int) $tenant->id) {
            abort(404);
        }

        if ($supplierInvoice->status !== 'draft') {
            throw ValidationException::withMessages([
                'status' => ['Only draft supplier invoices can be approved.'],
            ]);
        }

        $supplierInvoice->status = 'approved';
        $supplierInvoice->approved_by = $request->user()?->id;
        $supplierInvoice->approved_at = now();
        $supplierInvoice->metadata = [
            ...($supplierInvoice->metadata ?? []),
            'approval_workflow' => 'phase_9_1_supplier_invoice_payables',
        ];
        $supplierInvoice->save();

        $supplierInvoice->load(['supplier', 'purchaseOrder', 'items.product.category', 'payments']);

        $scope = $scopeResolver->resolveForUser($request->user());

        $auditLogService->record(
            action: 'pharmaco.supplier_invoice.approved',
            scope: $scope,
            metadata: [
                'tenant_slug' => $tenant->slug,
                'supplier_invoice_id' => $supplierInvoice->id,
                'invoice_number' => $supplierInvoice->invoice_number,
                'approved_by' => $request->user()?->id,
            ],
            dataClassification: 'internal',
            auditableType: PharmacoSupplierInvoice::class,
            auditableId: $supplierInvoice->id
        );

        return response()->json([
            'message' => 'Supplier invoice approved successfully.',
            'supplier_invoice' => $this->serializeSupplierInvoice($supplierInvoice, includeDetails: true),
        ]);
    }

    public function recordSupplierPayment(
        Request $request,
        PharmacoSupplierInvoice $supplierInvoice,
        AuditLogService $auditLogService,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        $tenant = $request->attributes->get('tenant');

        if ((int) $supplierInvoice->tenant_id !== (int) $tenant->id) {
            abort(404);
        }

        if (! in_array($supplierInvoice->status, ['approved', 'partially_paid'], true)) {
            throw ValidationException::withMessages([
                'status' => ['Supplier payments can only be recorded on approved or partially paid invoices.'],
            ]);
        }

        $validated = $request->validate([
            'amount' => ['required', 'numeric', 'min:0.01'],
            'payment_method' => ['required', 'string', 'in:cash,momo,card,bank_transfer,cheque,credit'],
            'reference_number' => ['nullable', 'string', 'max:120'],
            'paid_at' => ['nullable', 'date'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);

        $amount = (float) $validated['amount'];

        if ($amount > (float) $supplierInvoice->balance_amount) {
            throw ValidationException::withMessages([
                'amount' => ['Payment amount cannot exceed the supplier invoice balance.'],
            ]);
        }

        [$payment, $supplierInvoice] = DB::transaction(function () use ($tenant, $request, $supplierInvoice, $validated, $amount) {
            $payment = PharmacoSupplierPayment::query()->create([
                'uuid' => (string) Str::uuid(),
                'tenant_id' => $tenant->id,
                'pharmaco_supplier_invoice_id' => $supplierInvoice->id,
                'pharmaco_supplier_id' => $supplierInvoice->pharmaco_supplier_id,
                'payment_number' => $this->nextSupplierPaymentNumber($tenant->id),
                'amount' => $amount,
                'payment_method' => $validated['payment_method'],
                'reference_number' => $validated['reference_number'] ?? null,
                'status' => 'completed',
                'paid_at' => $validated['paid_at'] ?? now(),
                'recorded_by' => $request->user()?->id,
                'notes' => $validated['notes'] ?? null,
                'metadata' => [
                    'source' => 'phase_9_1_supplier_payment_api',
                ],
            ]);

            $paidAmount = (float) $supplierInvoice->paid_amount + $amount;
            $balance = max((float) $supplierInvoice->total_amount - $paidAmount, 0);

            $supplierInvoice->paid_amount = $paidAmount;
            $supplierInvoice->balance_amount = $balance;
            $supplierInvoice->status = $balance <= 0 ? 'paid' : 'partially_paid';
            $supplierInvoice->save();

            return [
                $payment,
                $supplierInvoice->fresh(['supplier', 'purchaseOrder', 'items.product.category', 'payments']),
            ];
        });

        $scope = $scopeResolver->resolveForUser($request->user());

        $auditLogService->record(
            action: 'pharmaco.supplier_payment.recorded',
            scope: $scope,
            metadata: [
                'tenant_slug' => $tenant->slug,
                'supplier_invoice_id' => $supplierInvoice->id,
                'payment_id' => $payment->id,
                'payment_number' => $payment->payment_number,
                'amount' => $amount,
                'balance_amount' => (float) $supplierInvoice->balance_amount,
            ],
            dataClassification: 'internal',
            auditableType: PharmacoSupplierPayment::class,
            auditableId: $payment->id
        );

        return response()->json([
            'message' => 'Supplier payment recorded successfully.',
            'supplier_payment' => $this->serializeSupplierPayment($payment),
            'supplier_invoice' => $this->serializeSupplierInvoice($supplierInvoice, includeDetails: true),
        ], 201);
    }


    private function serializeSupplierInvoice(PharmacoSupplierInvoice $invoice, bool $includeDetails = false): array
    {
        $payload = [
            'id' => $invoice->id,
            'uuid' => $invoice->uuid,
            'invoice_number' => $invoice->invoice_number,
            'supplier_invoice_number' => $invoice->supplier_invoice_number,
            'status' => $invoice->status,
            'invoice_date' => $invoice->invoice_date?->toDateString(),
            'due_date' => $invoice->due_date?->toDateString(),
            'subtotal_amount' => (float) $invoice->subtotal_amount,
            'discount_amount' => (float) $invoice->discount_amount,
            'tax_amount' => (float) $invoice->tax_amount,
            'total_amount' => (float) $invoice->total_amount,
            'paid_amount' => (float) $invoice->paid_amount,
            'balance_amount' => (float) $invoice->balance_amount,
            'approved_at' => $invoice->approved_at?->toISOString(),
            'notes' => $invoice->notes,
            'metadata' => $invoice->metadata ?? [],
            'supplier' => $invoice->supplier ? $this->serializeSupplier($invoice->supplier) : null,
            'purchase_order' => $invoice->purchaseOrder ? [
                'id' => $invoice->purchaseOrder->id,
                'po_number' => $invoice->purchaseOrder->po_number,
                'status' => $invoice->purchaseOrder->status,
            ] : null,
            'items_count' => $invoice->items_count ?? $invoice->items?->count(),
            'payments_count' => $invoice->payments_count ?? $invoice->payments?->count(),
            'created_at' => $invoice->created_at?->toISOString(),
        ];

        if ($includeDetails) {
            $payload['items'] = $invoice->items->map(fn (PharmacoSupplierInvoiceItem $item) => [
                'id' => $item->id,
                'uuid' => $item->uuid,
                'purchase_order_item_id' => $item->pharmaco_purchase_order_item_id,
                'product' => $item->product ? [
                    'id' => $item->product->id,
                    'name' => $item->product->name,
                    'sku' => $item->product->sku,
                    'category' => $item->product->category ? [
                        'id' => $item->product->category->id,
                        'name' => $item->product->category->name,
                        'code' => $item->product->category->code,
                    ] : null,
                ] : null,
                'product_name_snapshot' => $item->product_name_snapshot,
                'sku_snapshot' => $item->sku_snapshot,
                'quantity' => (float) $item->quantity,
                'unit_cost' => (float) $item->unit_cost,
                'discount_amount' => (float) $item->discount_amount,
                'tax_amount' => (float) $item->tax_amount,
                'line_total' => (float) $item->line_total,
                'notes' => $item->notes,
                'metadata' => $item->metadata ?? [],
            ])->values();

            $payload['payments'] = $invoice->payments->map(fn (PharmacoSupplierPayment $payment) => $this->serializeSupplierPayment($payment))->values();
        }

        return $payload;
    }

    private function serializeSupplierPayment(PharmacoSupplierPayment $payment): array
    {
        return [
            'id' => $payment->id,
            'uuid' => $payment->uuid,
            'payment_number' => $payment->payment_number,
            'amount' => (float) $payment->amount,
            'payment_method' => $payment->payment_method,
            'reference_number' => $payment->reference_number,
            'status' => $payment->status,
            'paid_at' => $payment->paid_at?->toISOString(),
            'notes' => $payment->notes,
            'metadata' => $payment->metadata ?? [],
        ];
    }

    private function nextSupplierInvoiceNumber(int $tenantId): string
    {
        $date = now()->format('Ymd');
        $count = PharmacoSupplierInvoice::query()
            ->where('tenant_id', $tenantId)
            ->whereDate('created_at', now()->toDateString())
            ->count() + 1;

        return sprintf('SIN-%04d-%s-%04d', $tenantId, $date, $count);
    }

    private function nextSupplierPaymentNumber(int $tenantId): string
    {
        $date = now()->format('Ymd');
        $count = PharmacoSupplierPayment::query()
            ->where('tenant_id', $tenantId)
            ->whereDate('created_at', now()->toDateString())
            ->count() + 1;

        return sprintf('SPAY-%04d-%s-%04d', $tenantId, $date, $count);
    }

    private function tenantPayload($tenant): array
    {
        return [
            'id' => $tenant->id,
            'uuid' => $tenant->uuid,
            'name' => $tenant->name,
            'slug' => $tenant->slug,
        ];
    }

    private function serializeSupplier(PharmacoSupplier $supplier): array
    {
        return [
            'id' => $supplier->id,
            'uuid' => $supplier->uuid,
            'supplier_code' => $supplier->supplier_code,
            'name' => $supplier->name,
            'legal_name' => $supplier->legal_name,
            'supplier_type' => $supplier->supplier_type,
            'contact_person' => $supplier->contact_person,
            'phone' => $supplier->phone,
            'email' => $supplier->email,
            'tax_identification_number' => $supplier->tax_identification_number,
            'license_number' => $supplier->license_number,
            'address' => $supplier->address,
            'payment_terms' => $supplier->payment_terms,
            'status' => $supplier->status,
            'metadata' => $supplier->metadata ?? [],
            'created_at' => $supplier->created_at?->toISOString(),
        ];
    }

    private function serializePurchaseOrder(PharmacoPurchaseOrder $purchaseOrder, bool $includeDetails = false): array
    {
        $payload = [
            'id' => $purchaseOrder->id,
            'uuid' => $purchaseOrder->uuid,
            'po_number' => $purchaseOrder->po_number,
            'status' => $purchaseOrder->status,
            'order_date' => $purchaseOrder->order_date?->toDateString(),
            'expected_delivery_date' => $purchaseOrder->expected_delivery_date?->toDateString(),
            'subtotal_amount' => (float) $purchaseOrder->subtotal_amount,
            'discount_amount' => (float) $purchaseOrder->discount_amount,
            'tax_amount' => (float) $purchaseOrder->tax_amount,
            'shipping_amount' => (float) $purchaseOrder->shipping_amount,
            'total_amount' => (float) $purchaseOrder->total_amount,
            'notes' => $purchaseOrder->notes,
            'supplier' => $purchaseOrder->supplier ? $this->serializeSupplier($purchaseOrder->supplier) : null,
            'branch' => $purchaseOrder->branch ? [
                'id' => $purchaseOrder->branch->id,
                'name' => $purchaseOrder->branch->name,
                'code' => $purchaseOrder->branch->code,
            ] : null,
            'items_count' => $purchaseOrder->items_count ?? ($purchaseOrder->relationLoaded('items') ? $purchaseOrder->items->count() : null),
            'created_at' => $purchaseOrder->created_at?->toISOString(),
        ];

        if ($includeDetails) {
            $payload['items'] = $purchaseOrder->items
                ->map(fn (PharmacoPurchaseOrderItem $item) => $this->serializePurchaseOrderItem($item))
                ->values();
        }

        return $payload;
    }

    private function serializePurchaseOrderItem(PharmacoPurchaseOrderItem $item): array
    {
        return [
            'id' => $item->id,
            'uuid' => $item->uuid,
            'product' => $item->product ? [
                'id' => $item->product->id,
                'name' => $item->product->name,
                'sku' => $item->product->sku,
                'category' => $item->product->category ? [
                    'id' => $item->product->category->id,
                    'name' => $item->product->category->name,
                    'code' => $item->product->category->code,
                ] : null,
            ] : null,
            'product_name_snapshot' => $item->product_name_snapshot,
            'sku_snapshot' => $item->sku_snapshot,
            'quantity_ordered' => (float) $item->quantity_ordered,
            'quantity_received' => (float) $item->quantity_received,
            'unit_cost' => (float) $item->unit_cost,
            'discount_amount' => (float) $item->discount_amount,
            'tax_amount' => (float) $item->tax_amount,
            'line_total' => (float) $item->line_total,
            'status' => $item->status,
            'notes' => $item->notes,
            'metadata' => $item->metadata ?? [],
        ];
    }

    private function nextSupplierCode(int $tenantId): string
    {
        $sequence = PharmacoSupplier::query()
            ->where('tenant_id', $tenantId)
            ->count() + 1;

        return sprintf('SUP-%s-%04d', str_pad((string) $tenantId, 4, '0', STR_PAD_LEFT), $sequence);
    }

    private function nextPurchaseOrderNumber(int $tenantId): string
    {
        $sequence = PharmacoPurchaseOrder::query()
            ->where('tenant_id', $tenantId)
            ->count() + 1;

        return sprintf('PO-%s-%s-%04d', str_pad((string) $tenantId, 4, '0', STR_PAD_LEFT), now()->format('Ymd'), $sequence);
    }
}
