<?php

namespace App\Http\Controllers\Api\V1\PharmaCo360;

use App\Http\Controllers\Controller;
use App\Models\Branch;
use App\Models\Product;
use App\Models\PharmacoCustomer;
use App\Models\PharmacoPrescription;
use App\Models\PharmacoSale;
use App\Models\PharmacoSaleItem;
use App\Models\PharmacoPayment;
use App\Models\StockBatch;
use App\Models\StockMovement;
use App\Services\Access\ScopeResolver;
use App\Services\Audit\AuditLogService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class SalesDispensingController extends Controller
{
    public function customers(Request $request): JsonResponse
    {
        $tenant = $request->attributes->get('tenant');

        $customers = PharmacoCustomer::query()
            ->where('tenant_id', $tenant->id)
            ->when($request->query('status'), fn ($query, $status) => $query->where('status', $status))
            ->when($request->query('search'), function ($query, $search) {
                $query->where(function ($inner) use ($search) {
                    $inner->where('first_name', 'like', "%{$search}%")
                        ->orWhere('last_name', 'like', "%{$search}%")
                        ->orWhere('phone', 'like', "%{$search}%")
                        ->orWhere('email', 'like', "%{$search}%")
                        ->orWhere('insurance_membership_number', 'like', "%{$search}%");
                });
            })
            ->orderBy('first_name')
            ->get();

        return response()->json([
            'tenant' => $this->tenantPayload($tenant),
            'customers' => $customers->map(fn (PharmacoCustomer $customer) => $this->serializeCustomer($customer))->values(),
        ]);
    }

    public function prescriptions(Request $request): JsonResponse
    {
        $tenant = $request->attributes->get('tenant');

        $prescriptions = PharmacoPrescription::query()
            ->with('customer')
            ->where('tenant_id', $tenant->id)
            ->when($request->query('status'), fn ($query, $status) => $query->where('status', $status))
            ->when($request->query('customer_id'), fn ($query, $customerId) => $query->where('pharmaco_customer_id', $customerId))
            ->when($request->query('search'), function ($query, $search) {
                $query->where(function ($inner) use ($search) {
                    $inner->where('prescription_number', 'like', "%{$search}%")
                        ->orWhere('prescriber_name', 'like', "%{$search}%")
                        ->orWhere('prescriber_facility', 'like', "%{$search}%");
                });
            })
            ->latest('issued_at')
            ->latest('created_at')
            ->get();

        return response()->json([
            'tenant' => $this->tenantPayload($tenant),
            'prescriptions' => $prescriptions
                ->map(fn (PharmacoPrescription $prescription) => $this->serializePrescription($prescription, includeCustomer: true))
                ->values(),
        ]);
    }

    public function sales(Request $request): JsonResponse
    {
        $tenant = $request->attributes->get('tenant');

        $sales = PharmacoSale::query()
            ->with(['branch', 'customer', 'prescription'])
            ->withCount(['items', 'payments'])
            ->where('tenant_id', $tenant->id)
            ->when($request->query('status'), fn ($query, $status) => $query->where('status', $status))
            ->when($request->query('payment_status'), fn ($query, $status) => $query->where('payment_status', $status))
            ->when($request->query('sale_type'), fn ($query, $saleType) => $query->where('sale_type', $saleType))
            ->when($request->query('branch_id'), fn ($query, $branchId) => $query->where('branch_id', $branchId))
            ->latest('created_at')
            ->get();

        return response()->json([
            'tenant' => $this->tenantPayload($tenant),
            'sales' => $sales->map(fn (PharmacoSale $sale) => $this->serializeSale($sale))->values(),
        ]);
    }

    public function sale(Request $request, PharmacoSale $sale): JsonResponse
    {
        $tenant = $request->attributes->get('tenant');

        if ((int) $sale->tenant_id !== (int) $tenant->id) {
            abort(404);
        }

        $sale->load([
            'branch',
            'customer',
            'prescription.customer',
            'items.product.category',
            'items.stockBatch',
            'items.stockLocation',
            'payments',
        ]);

        return response()->json([
            'tenant' => $this->tenantPayload($tenant),
            'sale' => $this->serializeSale($sale, includeDetails: true),
        ]);
    }



    public function createCustomer(
        Request $request,
        AuditLogService $auditLogService,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        $tenant = $request->attributes->get('tenant');

        $validated = $request->validate([
            'first_name' => ['required', 'string', 'max:255'],
            'last_name' => ['nullable', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:80'],
            'email' => ['nullable', 'email', 'max:255'],
            'date_of_birth' => ['nullable', 'date'],
            'gender' => ['nullable', 'string', 'max:40'],
            'customer_type' => ['nullable', 'string', 'max:80'],
            'insurance_provider' => ['nullable', 'string', 'max:255'],
            'insurance_membership_number' => ['nullable', 'string', 'max:255'],
            'status' => ['nullable', 'string', 'in:active,inactive'],
            'notes' => ['nullable', 'string', 'max:500'],
        ]);

        if (! empty($validated['phone'])) {
            $phoneExists = PharmacoCustomer::query()
                ->where('tenant_id', $tenant->id)
                ->where('phone', $validated['phone'])
                ->exists();

            if ($phoneExists) {
                throw ValidationException::withMessages([
                    'phone' => ['A customer with this phone number already exists for this tenant.'],
                ]);
            }
        }

        $customer = PharmacoCustomer::query()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $tenant->id,
            'first_name' => $validated['first_name'],
            'last_name' => $validated['last_name'] ?? null,
            'phone' => $validated['phone'] ?? null,
            'email' => $validated['email'] ?? null,
            'date_of_birth' => $validated['date_of_birth'] ?? null,
            'gender' => $validated['gender'] ?? null,
            'customer_type' => $validated['customer_type'] ?? 'patient',
            'insurance_provider' => $validated['insurance_provider'] ?? null,
            'insurance_membership_number' => $validated['insurance_membership_number'] ?? null,
            'status' => $validated['status'] ?? 'active',
            'metadata' => [
                'notes' => $validated['notes'] ?? null,
                'creation_workflow' => 'phase_6_1_create_customer',
            ],
        ]);

        $scope = $scopeResolver->resolveForUser($request->user());

        $auditLogService->record(
            action: 'pharmaco.customer.created',
            scope: $scope,
            metadata: [
                'tenant_slug' => $tenant->slug,
                'customer_id' => $customer->id,
                'customer_name' => trim($customer->first_name . ' ' . ($customer->last_name ?? '')),
            ],
            dataClassification: 'internal',
            auditableType: PharmacoCustomer::class,
            auditableId: $customer->id
        );

        return response()->json([
            'message' => 'Customer created successfully.',
            'customer' => $this->serializeCustomer($customer),
        ], 201);
    }

    public function createPrescription(
        Request $request,
        AuditLogService $auditLogService,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        $tenant = $request->attributes->get('tenant');

        $validated = $request->validate([
            'pharmaco_customer_id' => ['nullable', 'integer'],
            'prescription_number' => ['nullable', 'string', 'max:120'],
            'prescriber_name' => ['nullable', 'string', 'max:255'],
            'prescriber_facility' => ['nullable', 'string', 'max:255'],
            'prescriber_phone' => ['nullable', 'string', 'max:80'],
            'issued_at' => ['nullable', 'date'],
            'expires_at' => ['nullable', 'date', 'after_or_equal:issued_at'],
            'status' => ['nullable', 'string', 'in:active,used,expired,cancelled'],
            'notes' => ['nullable', 'string'],
        ]);

        $customer = null;

        if (! empty($validated['pharmaco_customer_id'])) {
            $customer = PharmacoCustomer::query()
                ->where('tenant_id', $tenant->id)
                ->find($validated['pharmaco_customer_id']);

            if (! $customer) {
                throw ValidationException::withMessages([
                    'pharmaco_customer_id' => ['Selected customer does not belong to the current tenant.'],
                ]);
            }
        }

        $prescriptionNumber = $validated['prescription_number'] ?? $this->nextPrescriptionNumber($tenant->id);

        $numberExists = PharmacoPrescription::query()
            ->where('tenant_id', $tenant->id)
            ->where('prescription_number', $prescriptionNumber)
            ->exists();

        if ($numberExists) {
            throw ValidationException::withMessages([
                'prescription_number' => ['This prescription number already exists for this tenant.'],
            ]);
        }

        $prescription = PharmacoPrescription::query()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $tenant->id,
            'pharmaco_customer_id' => $customer?->id,
            'prescription_number' => $prescriptionNumber,
            'prescriber_name' => $validated['prescriber_name'] ?? null,
            'prescriber_facility' => $validated['prescriber_facility'] ?? null,
            'prescriber_phone' => $validated['prescriber_phone'] ?? null,
            'issued_at' => $validated['issued_at'] ?? now()->toDateString(),
            'expires_at' => $validated['expires_at'] ?? null,
            'status' => $validated['status'] ?? 'active',
            'notes' => $validated['notes'] ?? null,
            'metadata' => [
                'creation_workflow' => 'phase_6_1_create_prescription',
            ],
        ]);

        $prescription->load('customer');

        $scope = $scopeResolver->resolveForUser($request->user());

        $auditLogService->record(
            action: 'pharmaco.prescription.created',
            scope: $scope,
            metadata: [
                'tenant_slug' => $tenant->slug,
                'prescription_id' => $prescription->id,
                'prescription_number' => $prescription->prescription_number,
                'customer_id' => $customer?->id,
            ],
            dataClassification: 'internal',
            auditableType: PharmacoPrescription::class,
            auditableId: $prescription->id
        );

        return response()->json([
            'message' => 'Prescription created successfully.',
            'prescription' => $this->serializePrescription($prescription, includeCustomer: true),
        ], 201);
    }

    public function createSale(
        Request $request,
        AuditLogService $auditLogService,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        $tenant = $request->attributes->get('tenant');

        $validated = $request->validate([
            'branch_id' => ['required', 'integer'],
            'pharmaco_customer_id' => ['nullable', 'integer'],
            'pharmaco_prescription_id' => ['nullable', 'integer'],
            'sale_type' => ['nullable', 'string', 'in:cash_sale,prescription_sale,insurance_sale,credit_sale'],
            'discount_amount' => ['nullable', 'numeric', 'gte:0'],
            'tax_amount' => ['nullable', 'numeric', 'gte:0'],
            'notes' => ['nullable', 'string'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'integer'],
            'items.*.quantity' => ['required', 'numeric', 'gt:0'],
            'items.*.unit_price' => ['required', 'numeric', 'gte:0'],
            'items.*.discount_amount' => ['nullable', 'numeric', 'gte:0'],
            'items.*.tax_amount' => ['nullable', 'numeric', 'gte:0'],
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

        $customer = null;

        if (! empty($validated['pharmaco_customer_id'])) {
            $customer = PharmacoCustomer::query()
                ->where('tenant_id', $tenant->id)
                ->where('status', 'active')
                ->find($validated['pharmaco_customer_id']);

            if (! $customer) {
                throw ValidationException::withMessages([
                    'pharmaco_customer_id' => ['Selected customer does not belong to the current tenant or is inactive.'],
                ]);
            }
        }

        $prescription = null;

        if (! empty($validated['pharmaco_prescription_id'])) {
            $prescription = PharmacoPrescription::query()
                ->where('tenant_id', $tenant->id)
                ->where('status', 'active')
                ->find($validated['pharmaco_prescription_id']);

            if (! $prescription) {
                throw ValidationException::withMessages([
                    'pharmaco_prescription_id' => ['Selected prescription does not belong to the current tenant or is inactive.'],
                ]);
            }

            if ($customer && $prescription->pharmaco_customer_id && (int) $prescription->pharmaco_customer_id !== (int) $customer->id) {
                throw ValidationException::withMessages([
                    'pharmaco_prescription_id' => ['Selected prescription belongs to a different customer.'],
                ]);
            }
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
                'items' => ['Inactive products cannot be added to a draft sale.'],
            ]);
        }

        $requiresPrescription = $products->contains(fn (Product $product) => (bool) $product->requires_prescription);

        if ($requiresPrescription && ! $prescription) {
            throw ValidationException::withMessages([
                'pharmaco_prescription_id' => ['A prescription is required because one or more selected products require prescription control.'],
            ]);
        }

        $result = DB::transaction(function () use ($request, $tenant, $validated, $branch, $customer, $prescription, $products) {
            $saleNumber = $this->nextSaleNumber($tenant->id);

            $lineItems = collect($validated['items'])->map(function (array $item) use ($tenant, $products) {
                /** @var Product $product */
                $product = $products->get($item['product_id']);

                $quantity = round((float) $item['quantity'], 3);
                $unitPrice = round((float) $item['unit_price'], 2);
                $discount = round((float) ($item['discount_amount'] ?? 0), 2);
                $tax = round((float) ($item['tax_amount'] ?? 0), 2);
                $lineTotal = round(($quantity * $unitPrice) - $discount + $tax, 2);

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
                    'quantity' => $quantity,
                    'unit_price' => $unitPrice,
                    'discount_amount' => $discount,
                    'tax_amount' => $tax,
                    'line_total' => $lineTotal,
                    'requires_prescription' => (bool) $product->requires_prescription,
                    'prescription_verified' => false,
                    'status' => 'pending',
                    'metadata' => [
                        'creation_workflow' => 'phase_6_1_create_sale',
                        'stock_deducted' => false,
                    ],
                ];
            });

            $itemsSubtotal = round($lineItems->sum('line_total'), 2);
            $saleDiscount = round((float) ($validated['discount_amount'] ?? 0), 2);
            $saleTax = round((float) ($validated['tax_amount'] ?? 0), 2);
            $total = round($itemsSubtotal - $saleDiscount + $saleTax, 2);

            if ($total < 0) {
                throw ValidationException::withMessages([
                    'total_amount' => ['Sale total cannot be negative.'],
                ]);
            }

            $sale = PharmacoSale::query()->create([
                'uuid' => (string) Str::uuid(),
                'tenant_id' => $tenant->id,
                'branch_id' => $branch->id,
                'pharmaco_customer_id' => $customer?->id,
                'pharmaco_prescription_id' => $prescription?->id,
                'sale_number' => $saleNumber,
                'sale_type' => $validated['sale_type'] ?? ($prescription ? 'prescription_sale' : 'cash_sale'),
                'status' => 'draft',
                'subtotal_amount' => $itemsSubtotal,
                'discount_amount' => $saleDiscount,
                'tax_amount' => $saleTax,
                'total_amount' => $total,
                'paid_amount' => 0,
                'balance_amount' => $total,
                'payment_status' => 'unpaid',
                'sold_by' => $request->user()?->id,
                'sold_at' => null,
                'notes' => $validated['notes'] ?? null,
                'metadata' => [
                    'creation_workflow' => 'phase_6_1_create_sale',
                    'stock_deducted' => false,
                ],
            ]);

            $lineItems->each(function (array $lineItem) use ($sale) {
                $sale->items()->create($lineItem);
            });

            return $sale->fresh([
                'branch',
                'customer',
                'prescription.customer',
                'items.product.category',
                'items.stockBatch',
                'items.stockLocation',
                'payments',
            ]);
        });

        $scope = $scopeResolver->resolveForUser($request->user());

        $auditLogService->record(
            action: 'pharmaco.sale.created',
            scope: $scope,
            metadata: [
                'tenant_slug' => $tenant->slug,
                'sale_id' => $result->id,
                'sale_number' => $result->sale_number,
                'items_count' => $result->items->count(),
                'total_amount' => (float) $result->total_amount,
            ],
            dataClassification: 'internal',
            auditableType: PharmacoSale::class,
            auditableId: $result->id
        );

        return response()->json([
            'message' => 'Draft sale created successfully.',
            'sale' => $this->serializeSale($result, includeDetails: true),
        ], 201);
    }

    public function confirmSale(
        Request $request,
        PharmacoSale $sale,
        AuditLogService $auditLogService,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        $tenant = $request->attributes->get('tenant');

        if ((int) $sale->tenant_id !== (int) $tenant->id) {
            abort(404);
        }

        if ($sale->status !== 'draft' || (bool) ($sale->metadata['stock_deducted'] ?? false)) {
            abort(409, 'Sale has already been confirmed or dispensed.');
        }

        $validated = $request->validate([
            'items' => ['required', 'array', 'min:1'],
            'items.*.sale_item_id' => ['required', 'integer'],
            'items.*.stock_batch_id' => ['required', 'integer'],
            'items.*.prescription_verified' => ['sometimes', 'boolean'],
        ]);

        $confirmedSale = DB::transaction(function () use ($request, $sale, $tenant, $validated) {
            $lockedSale = PharmacoSale::query()
                ->where('tenant_id', $tenant->id)
                ->lockForUpdate()
                ->findOrFail($sale->id);

            if ($lockedSale->status !== 'draft' || (bool) ($lockedSale->metadata['stock_deducted'] ?? false)) {
                abort(409, 'Sale has already been confirmed or dispensed.');
            }

            $lockedSale->load(['items.product']);

            $payloadByItemId = collect($validated['items'])->keyBy('sale_item_id');
            $saleItemIds = $lockedSale->items->pluck('id')->values();

            if ($payloadByItemId->keys()->diff($saleItemIds)->isNotEmpty()) {
                throw ValidationException::withMessages([
                    'items' => ['One or more submitted sale items do not belong to this sale.'],
                ]);
            }

            if ($saleItemIds->diff($payloadByItemId->keys())->isNotEmpty()) {
                throw ValidationException::withMessages([
                    'items' => ['Every sale item must be assigned to a stock batch before dispensing.'],
                ]);
            }

            foreach ($lockedSale->items as $item) {
                $payload = $payloadByItemId->get($item->id);

                $batch = StockBatch::query()
                    ->where('tenant_id', $tenant->id)
                    ->where('product_id', $item->product_id)
                    ->lockForUpdate()
                    ->find($payload['stock_batch_id']);

                if (! $batch) {
                    throw ValidationException::withMessages([
                        'items' => ["A selected stock batch is invalid for item {$item->id}."],
                    ]);
                }

                if ((int) $batch->branch_id !== (int) $lockedSale->branch_id) {
                    throw ValidationException::withMessages([
                        'items' => ["Stock batch {$batch->batch_number} does not belong to the sale branch."],
                    ]);
                }

                $requiresPrescription = (bool) $item->requires_prescription;
                $prescriptionVerified = (bool) ($payload['prescription_verified'] ?? $item->prescription_verified);

                if ($requiresPrescription && (! $lockedSale->pharmaco_prescription_id || ! $prescriptionVerified)) {
                    throw ValidationException::withMessages([
                        'items' => ["Item {$item->sku_snapshot} requires prescription verification before dispensing."],
                    ]);
                }

                $quantity = (float) $item->quantity;
                $beforeQuantity = (float) $batch->quantity_on_hand;

                if ($beforeQuantity < $quantity) {
                    throw ValidationException::withMessages([
                        'items' => ["Insufficient stock for item {$item->sku_snapshot} in batch {$batch->batch_number}."],
                    ]);
                }

                $afterQuantity = $beforeQuantity - $quantity;

                $batch->quantity_on_hand = $afterQuantity;
                $batch->status = $afterQuantity <= 0 ? 'depleted' : 'active';
                $batch->save();

                $item->stock_batch_id = $batch->id;
                $item->stock_location_id = $batch->stock_location_id;
                $item->prescription_verified = $prescriptionVerified;
                $item->status = 'dispensed';
                $item->metadata = [
                    ...($item->metadata ?? []),
                    'stock_deducted' => true,
                    'stock_deducted_at' => now()->toISOString(),
                    'before_quantity' => $beforeQuantity,
                    'after_quantity' => $afterQuantity,
                ];
                $item->save();

                StockMovement::query()->create([
                    'uuid' => (string) \Illuminate\Support\Str::uuid(),
                    'tenant_id' => $tenant->id,
                    'branch_id' => $lockedSale->branch_id,
                    'stock_location_id' => $batch->stock_location_id,
                    'product_id' => $item->product_id,
                    'stock_batch_id' => $batch->id,
                    'movement_type' => 'sale_dispensed',
                    'quantity' => -1 * $quantity,
                    'running_balance' => $afterQuantity,
                    'reference_type' => 'pharmaco_sale',
                    'reference_number' => $lockedSale->sale_number,
                    'reason' => 'Stock dispensed through confirmed PharmaCo360 sale.',
                    'performed_by' => $request->user()?->id,
                    'occurred_at' => now(),
                    'metadata' => [
                        'sale_id' => $lockedSale->id,
                        'sale_item_id' => $item->id,
                        'batch_number' => $batch->batch_number,
                        'before_quantity' => $beforeQuantity,
                        'after_quantity' => $afterQuantity,
                    ],
                ]);
            }

            $lockedSale->status = 'dispensed';
            $lockedSale->sold_by = $request->user()?->id;
            $lockedSale->sold_at = now();
            $lockedSale->metadata = [
                ...($lockedSale->metadata ?? []),
                'stock_deducted' => true,
                'stock_deducted_at' => now()->toISOString(),
                'dispensing_workflow' => 'phase_4_3_confirm_sale',
            ];
            $lockedSale->save();

            return $lockedSale->fresh([
                'branch',
                'customer',
                'prescription.customer',
                'items.product.category',
                'items.stockBatch',
                'items.stockLocation',
                'payments',
            ]);
        });

        $scope = $scopeResolver->resolveForUser($request->user());

        $auditLogService->record(
            action: 'pharmaco.sale.dispensed',
            scope: $scope,
            metadata: [
                'tenant_slug' => $tenant->slug,
                'sale_number' => $confirmedSale->sale_number,
                'sale_id' => $confirmedSale->id,
                'items_count' => $confirmedSale->items->count(),
                'stock_deducted' => true,
            ],
            dataClassification: 'internal',
            auditableType: PharmacoSale::class,
            auditableId: $confirmedSale->id
        );

        return response()->json([
            'message' => 'Sale confirmed and stock dispensed successfully.',
            'sale' => $this->serializeSale($confirmedSale, includeDetails: true),
        ]);
    }


    public function recordPayment(
        Request $request,
        PharmacoSale $sale,
        AuditLogService $auditLogService,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        $tenant = $request->attributes->get('tenant');

        if ((int) $sale->tenant_id !== (int) $tenant->id) {
            abort(404);
        }

        $validated = $request->validate([
            'amount' => ['required', 'numeric', 'gt:0'],
            'payment_method' => ['required', 'string', 'in:cash,momo,card,insurance,credit,bank_transfer'],
            'reference_number' => ['nullable', 'string', 'max:120'],
            'received_at' => ['nullable', 'date'],
            'notes' => ['nullable', 'string', 'max:500'],
        ]);

        $result = DB::transaction(function () use ($request, $sale, $tenant, $validated) {
            $lockedSale = PharmacoSale::query()
                ->where('tenant_id', $tenant->id)
                ->lockForUpdate()
                ->findOrFail($sale->id);

            if ($lockedSale->status === 'draft') {
                throw ValidationException::withMessages([
                    'sale' => ['Draft sales must be confirmed and dispensed before payment is recorded.'],
                ]);
            }

            if (in_array($lockedSale->status, ['cancelled', 'voided'], true)) {
                throw ValidationException::withMessages([
                    'sale' => ['Payments cannot be recorded against cancelled or voided sales.'],
                ]);
            }

            $amount = round((float) $validated['amount'], 2);
            $currentPaid = round((float) $lockedSale->paid_amount, 2);
            $totalAmount = round((float) $lockedSale->total_amount, 2);
            $currentBalance = max(round($totalAmount - $currentPaid, 2), 0);

            if ($currentBalance <= 0 || $lockedSale->payment_status === 'paid') {
                abort(409, 'Sale is already fully paid.');
            }

            if ($amount > $currentBalance) {
                throw ValidationException::withMessages([
                    'amount' => ["Payment amount cannot exceed the current balance of {$currentBalance}."],
                ]);
            }

            $newPaid = round($currentPaid + $amount, 2);
            $newBalance = max(round($totalAmount - $newPaid, 2), 0);
            $paymentStatus = $newBalance <= 0 ? 'paid' : 'partially_paid';

            $receiptNumber = $this->nextReceiptNumber($tenant->id, $lockedSale->id);

            $payment = PharmacoPayment::query()->create([
                'uuid' => (string) Str::uuid(),
                'tenant_id' => $tenant->id,
                'pharmaco_sale_id' => $lockedSale->id,
                'amount' => $amount,
                'payment_method' => $validated['payment_method'],
                'status' => 'completed',
                'reference_number' => $validated['reference_number'] ?? null,
                'receipt_number' => $receiptNumber,
                'received_by' => $request->user()?->id,
                'received_at' => $validated['received_at'] ?? now(),
                'metadata' => [
                    'notes' => $validated['notes'] ?? null,
                    'previous_paid_amount' => $currentPaid,
                    'previous_balance_amount' => $currentBalance,
                    'new_paid_amount' => $newPaid,
                    'new_balance_amount' => $newBalance,
                    'payment_workflow' => 'phase_5_1_record_payment',
                ],
            ]);

            $lockedSale->paid_amount = $newPaid;
            $lockedSale->balance_amount = $newBalance;
            $lockedSale->payment_status = $paymentStatus;
            $lockedSale->metadata = [
                ...($lockedSale->metadata ?? []),
                'last_payment_id' => $payment->id,
                'last_receipt_number' => $receiptNumber,
                'last_payment_recorded_at' => now()->toISOString(),
            ];
            $lockedSale->save();

            return [
                'sale' => $lockedSale->fresh([
                    'branch',
                    'customer',
                    'prescription.customer',
                    'items.product.category',
                    'items.stockBatch',
                    'items.stockLocation',
                    'payments',
                ]),
                'payment' => $payment->fresh(),
            ];
        });

        $scope = $scopeResolver->resolveForUser($request->user());

        $auditLogService->record(
            action: 'pharmaco.payment.recorded',
            scope: $scope,
            metadata: [
                'tenant_slug' => $tenant->slug,
                'sale_number' => $result['sale']->sale_number,
                'sale_id' => $result['sale']->id,
                'payment_id' => $result['payment']->id,
                'receipt_number' => $result['payment']->receipt_number,
                'payment_method' => $result['payment']->payment_method,
                'amount' => (float) $result['payment']->amount,
                'payment_status' => $result['sale']->payment_status,
            ],
            dataClassification: 'internal',
            auditableType: PharmacoPayment::class,
            auditableId: $result['payment']->id
        );

        return response()->json([
            'message' => 'Payment recorded successfully.',
            'payment' => $this->serializePayment($result['payment']),
            'sale' => $this->serializeSale($result['sale'], includeDetails: true),
        ], 201);
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

    private function serializeCustomer(PharmacoCustomer $customer): array
    {
        return [
            'id' => $customer->id,
            'uuid' => $customer->uuid,
            'first_name' => $customer->first_name,
            'last_name' => $customer->last_name,
            'full_name' => trim($customer->first_name . ' ' . ($customer->last_name ?? '')),
            'phone' => $customer->phone,
            'email' => $customer->email,
            'date_of_birth' => $customer->date_of_birth?->toDateString(),
            'gender' => $customer->gender,
            'customer_type' => $customer->customer_type,
            'insurance_provider' => $customer->insurance_provider,
            'insurance_membership_number' => $customer->insurance_membership_number,
            'status' => $customer->status,
        ];
    }

    private function serializePrescription(PharmacoPrescription $prescription, bool $includeCustomer = false): array
    {
        $payload = [
            'id' => $prescription->id,
            'uuid' => $prescription->uuid,
            'prescription_number' => $prescription->prescription_number,
            'prescriber_name' => $prescription->prescriber_name,
            'prescriber_facility' => $prescription->prescriber_facility,
            'prescriber_phone' => $prescription->prescriber_phone,
            'issued_at' => $prescription->issued_at?->toDateString(),
            'expires_at' => $prescription->expires_at?->toDateString(),
            'status' => $prescription->status,
            'notes' => $prescription->notes,
        ];

        if ($includeCustomer) {
            $payload['customer'] = $prescription->customer
                ? $this->serializeCustomer($prescription->customer)
                : null;
        }

        return $payload;
    }

    private function serializeSale(PharmacoSale $sale, bool $includeDetails = false): array
    {
        $payload = [
            'id' => $sale->id,
            'uuid' => $sale->uuid,
            'sale_number' => $sale->sale_number,
            'sale_type' => $sale->sale_type,
            'status' => $sale->status,
            'subtotal_amount' => (float) $sale->subtotal_amount,
            'discount_amount' => (float) $sale->discount_amount,
            'tax_amount' => (float) $sale->tax_amount,
            'total_amount' => (float) $sale->total_amount,
            'paid_amount' => (float) $sale->paid_amount,
            'balance_amount' => (float) $sale->balance_amount,
            'payment_status' => $sale->payment_status,
            'sold_at' => $sale->sold_at?->toISOString(),
            'notes' => $sale->notes,
            'branch' => $sale->branch ? [
                'id' => $sale->branch->id,
                'name' => $sale->branch->name,
                'code' => $sale->branch->code,
            ] : null,
            'customer' => $sale->customer ? $this->serializeCustomer($sale->customer) : null,
            'prescription' => $sale->prescription ? $this->serializePrescription($sale->prescription) : null,
            'items_count' => $sale->items_count ?? ($sale->relationLoaded('items') ? $sale->items->count() : null),
            'payments_count' => $sale->payments_count ?? ($sale->relationLoaded('payments') ? $sale->payments->count() : null),
            'created_at' => $sale->created_at?->toISOString(),
        ];

        if ($includeDetails) {
            $payload['items'] = $sale->items
                ->map(fn (PharmacoSaleItem $item) => $this->serializeSaleItem($item))
                ->values();

            $payload['payments'] = $sale->payments
                ->map(fn (PharmacoPayment $payment) => $this->serializePayment($payment))
                ->values();
        }

        return $payload;
    }

    private function serializeSaleItem(PharmacoSaleItem $item): array
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
            'stock_batch' => $item->stockBatch ? [
                'id' => $item->stockBatch->id,
                'batch_number' => $item->stockBatch->batch_number,
                'expiry_date' => $item->stockBatch->expiry_date?->toDateString(),
            ] : null,
            'stock_location' => $item->stockLocation ? [
                'id' => $item->stockLocation->id,
                'name' => $item->stockLocation->name,
                'code' => $item->stockLocation->code,
            ] : null,
            'product_name_snapshot' => $item->product_name_snapshot,
            'sku_snapshot' => $item->sku_snapshot,
            'quantity' => (float) $item->quantity,
            'unit_price' => (float) $item->unit_price,
            'discount_amount' => (float) $item->discount_amount,
            'tax_amount' => (float) $item->tax_amount,
            'line_total' => (float) $item->line_total,
            'requires_prescription' => (bool) $item->requires_prescription,
            'prescription_verified' => (bool) $item->prescription_verified,
            'status' => $item->status,
            'metadata' => $item->metadata ?? [],
        ];
    }



    private function nextSaleNumber(int $tenantId): string
    {
        $sequence = PharmacoSale::query()
            ->where('tenant_id', $tenantId)
            ->count() + 1;

        return sprintf('SALE-%s-%s-%04d', str_pad((string) $tenantId, 4, '0', STR_PAD_LEFT), now()->format('Ymd'), $sequence);
    }

    private function nextPrescriptionNumber(int $tenantId): string
    {
        $sequence = PharmacoPrescription::query()
            ->where('tenant_id', $tenantId)
            ->count() + 1;

        return sprintf('RX-%s-%s-%04d', str_pad((string) $tenantId, 4, '0', STR_PAD_LEFT), now()->format('Ymd'), $sequence);
    }

    private function nextReceiptNumber(int $tenantId, int $saleId): string
    {
        $sequence = PharmacoPayment::query()
            ->where('tenant_id', $tenantId)
            ->where('pharmaco_sale_id', $saleId)
            ->count() + 1;

        return sprintf('RCPT-%s-%s-%04d', str_pad((string) $tenantId, 4, '0', STR_PAD_LEFT), str_pad((string) $saleId, 6, '0', STR_PAD_LEFT), $sequence);
    }

    private function serializePayment(PharmacoPayment $payment): array
    {
        return [
            'id' => $payment->id,
            'uuid' => $payment->uuid,
            'amount' => (float) $payment->amount,
            'payment_method' => $payment->payment_method,
            'status' => $payment->status,
            'reference_number' => $payment->reference_number,
            'receipt_number' => $payment->receipt_number,
            'received_at' => $payment->received_at?->toISOString(),
            'metadata' => $payment->metadata ?? [],
        ];
    }
}
