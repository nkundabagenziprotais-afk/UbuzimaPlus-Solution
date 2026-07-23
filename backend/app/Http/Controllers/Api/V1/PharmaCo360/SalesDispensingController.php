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
use App\Models\PharmacoPosSession;
use App\Models\StockBatch;
use App\Models\StockMovement;
use App\Services\PharmaCo360\InventoryCostResolver;
use App\Services\Access\ScopeResolver;
use App\Services\Audit\AuditLogService;
use App\Services\Finance\PharmacoPosPaymentShadowPostingService;
use Throwable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
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
            ->with(['branch', 'customer', 'prescription', 'payments', 'items.product', 'items.stockBatch'])
            ->withCount(['items', 'payments'])
            ->where('tenant_id', $tenant->id)
            ->when($request->query('status'), fn ($query, $status) => $query->where('status', $status))
            ->when($request->query('payment_status'), fn ($query, $status) => $query->where('payment_status', $status))
            ->when($request->query('sale_type'), fn ($query, $saleType) => $query->where('sale_type', $saleType))
            // POS_SALES_BUSINESS_DATE_FILTERS_V1
            ->when($request->query('business_date_from'), fn ($query, $dateFrom) =>
                $query->whereDate('business_date', '>=', $dateFrom)
            )
            ->when($request->query('business_date_to'), fn ($query, $dateTo) =>
                $query->whereDate('business_date', '<=', $dateTo)
            )
            ->when($request->query('branch_id'), fn ($query, $branchId) => $query->where('branch_id', $branchId))
            ->when($request->query('pos_session_id'), fn ($query, $sessionId) => $query->where('pos_session_id', $sessionId))
            ->latest('created_at')
            ->get();

        return response()->json([
            'tenant' => $this->tenantPayload($tenant),
            'sales' => $sales->map(fn (PharmacoSale $sale) => $this->serializeSale($sale))->values(),
        ]);
    }

    public function voidSaleItem(
        Request $request,
        PharmacoSale $sale,
        int $item
    ): JsonResponse {
        $tenant = $request->attributes->get('tenant');

        if ((int) $sale->tenant_id !== (int) $tenant->id) {
            abort(404);
        }

        $validated = $request->validate([
            'reason' => ['required', 'string', 'min:5', 'max:500'],
        ]);

        $updatedSale = DB::transaction(function () use ($request, $tenant, $sale, $item, $validated) {
            $lockedSale = PharmacoSale::query()
                ->where('tenant_id', $tenant->id)
                ->lockForUpdate()
                ->with(['items', 'payments'])
                ->findOrFail($sale->id);

            $saleItem = \App\Models\PharmacoSaleItem::query()
                ->where('tenant_id', $tenant->id)
                ->where('pharmaco_sale_id', $lockedSale->id)
                ->lockForUpdate()
                ->findOrFail($item);

            if ($saleItem->status === 'voided' || (bool) (($saleItem->metadata ?? [])['voided'] ?? false)) {
                abort(409, 'This transaction item is already voided.');
            }

            $quantity = (float) $saleItem->quantity;
            $lineTotal = (float) $saleItem->line_total;
            $metadata = $saleItem->metadata ?? [];
            $stockDeducted = (bool) ($metadata['stock_deducted'] ?? true);

            if ($stockDeducted && $saleItem->stock_batch_id && $quantity > 0) {
                $batch = StockBatch::query()
                    ->where('tenant_id', $tenant->id)
                    ->lockForUpdate()
                    ->find($saleItem->stock_batch_id);

                if ($batch) {
                    $beforeQuantity = (float) $batch->quantity_on_hand;
                    $afterQuantity = $beforeQuantity + $quantity;

                    $batch->quantity_on_hand = $afterQuantity;
                    $batch->status = $afterQuantity > 0 ? 'active' : $batch->status;
                    $batch->save();

                    StockMovement::query()->create([
                        'uuid' => (string) \Illuminate\Support\Str::uuid(),
                        'tenant_id' => $tenant->id,
                        'branch_id' => $lockedSale->branch_id,
                        'stock_location_id' => $batch->stock_location_id,
                        'product_id' => $saleItem->product_id,
                        'stock_batch_id' => $batch->id,
                        'pos_session_id' => $lockedSale->pos_session_id,
                        'business_date' => $lockedSale->business_date,
                        'entry_mode' => $lockedSale->entry_mode ?? 'live',
                        'historical_approval_id' => $lockedSale->historical_approval_id,
                        'movement_type' => 'sale_item_voided',
                        'quantity' => $quantity,
                        'running_balance' => $afterQuantity,
                        'reference_type' => 'pharmaco_sale',
                        'reference_number' => $lockedSale->sale_number,
                        'reason' => 'Stock restored after admin transaction item deletion.',
                        'performed_by' => $request->user()?->id,
                        'occurred_at' => now(),
                        'metadata' => [
                            'sale_id' => $lockedSale->id,
                            'sale_item_id' => $saleItem->id,
                            'void_reason' => $validated['reason'],
                            'before_quantity' => $beforeQuantity,
                            'after_quantity' => $afterQuantity,
                            'corrected_by' => $request->user()?->id,
                            'corrected_at' => now()->toISOString(),
                        ],
                    ]);
                }
            }

            $saleItem->status = 'voided';
            $saleItem->metadata = [
                ...$metadata,
                'voided' => true,
                'voided_at' => now()->toISOString(),
                'voided_by' => $request->user()?->id,
                'void_reason' => $validated['reason'],
                'original_quantity' => $quantity,
                'original_line_total' => $lineTotal,
            ];
            $saleItem->save();

            $activeItems = \App\Models\PharmacoSaleItem::query()
                ->where('tenant_id', $tenant->id)
                ->where('pharmaco_sale_id', $lockedSale->id)
                ->where('status', '!=', 'voided')
                ->get();

            $subtotal = (float) $activeItems->sum('line_total');
            $discount = (float) $activeItems->sum('discount_amount');
            $tax = (float) $activeItems->sum('tax_amount');
            $total = max($subtotal, 0.0);
            $paid = (float) $lockedSale->payments()->where('status', '!=', 'voided')->sum('amount');

            $lockedSale->subtotal_amount = $subtotal;
            $lockedSale->discount_amount = $discount;
            $lockedSale->tax_amount = $tax;
            $lockedSale->total_amount = $total;
            $lockedSale->paid_amount = $paid;
            $lockedSale->balance_amount = max($total - $paid, 0.0);
            $lockedSale->payment_status = $total <= 0
                ? 'voided'
                : ($paid >= $total ? 'paid' : ($paid > 0 ? 'partial' : 'unpaid'));
            $lockedSale->status = $activeItems->isEmpty() ? 'voided' : $lockedSale->status;
            $lockedSale->metadata = [
                ...($lockedSale->metadata ?? []),
                'last_correction_at' => now()->toISOString(),
                'last_correction_by' => $request->user()?->id,
                'last_correction_reason' => $validated['reason'],
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

        return response()->json([
            'message' => 'Transaction item deleted through a controlled correction.',
            'sale' => $this->serializeSale($updatedSale, includeDetails: true),
        ]);
    }

    public function voidSale(
        Request $request,
        PharmacoSale $sale
    ): JsonResponse {
        $tenant = $request->attributes->get('tenant');

        if ((int) $sale->tenant_id !== (int) $tenant->id) {
            abort(404);
        }

        $validated = $request->validate([
            'reason' => ['required', 'string', 'min:5', 'max:500'],
        ]);

        $updatedSale = DB::transaction(function () use ($request, $tenant, $sale, $validated) {
            $lockedSale = PharmacoSale::query()
                ->where('tenant_id', $tenant->id)
                ->lockForUpdate()
                ->with(['items', 'payments'])
                ->findOrFail($sale->id);

            if ($lockedSale->status === 'voided') {
                abort(409, 'This transaction is already voided.');
            }

            foreach ($lockedSale->items as $saleItem) {
                if ($saleItem->status === 'voided') {
                    continue;
                }

                $quantity = (float) $saleItem->quantity;
                $metadata = $saleItem->metadata ?? [];
                $stockDeducted = (bool) ($metadata['stock_deducted'] ?? true);

                if ($stockDeducted && $saleItem->stock_batch_id && $quantity > 0) {
                    $batch = StockBatch::query()
                        ->where('tenant_id', $tenant->id)
                        ->lockForUpdate()
                        ->find($saleItem->stock_batch_id);

                    if ($batch) {
                        $beforeQuantity = (float) $batch->quantity_on_hand;
                        $afterQuantity = $beforeQuantity + $quantity;

                        $batch->quantity_on_hand = $afterQuantity;
                        $batch->status = $afterQuantity > 0 ? 'active' : $batch->status;
                        $batch->save();

                        StockMovement::query()->create([
                            'uuid' => (string) \Illuminate\Support\Str::uuid(),
                            'tenant_id' => $tenant->id,
                            'branch_id' => $lockedSale->branch_id,
                            'stock_location_id' => $batch->stock_location_id,
                            'product_id' => $saleItem->product_id,
                            'stock_batch_id' => $batch->id,
                            'pos_session_id' => $lockedSale->pos_session_id,
                            'business_date' => $lockedSale->business_date,
                            'entry_mode' => $lockedSale->entry_mode ?? 'live',
                            'historical_approval_id' => $lockedSale->historical_approval_id,
                            'movement_type' => 'sale_voided',
                            'quantity' => $quantity,
                            'running_balance' => $afterQuantity,
                            'reference_type' => 'pharmaco_sale',
                            'reference_number' => $lockedSale->sale_number,
                            'reason' => 'Stock restored after admin transaction deletion.',
                            'performed_by' => $request->user()?->id,
                            'occurred_at' => now(),
                            'metadata' => [
                                'sale_id' => $lockedSale->id,
                                'sale_item_id' => $saleItem->id,
                                'void_reason' => $validated['reason'],
                                'before_quantity' => $beforeQuantity,
                                'after_quantity' => $afterQuantity,
                                'corrected_by' => $request->user()?->id,
                                'corrected_at' => now()->toISOString(),
                            ],
                        ]);
                    }
                }

                $saleItem->status = 'voided';
                $saleItem->metadata = [
                    ...$metadata,
                    'voided' => true,
                    'voided_at' => now()->toISOString(),
                    'voided_by' => $request->user()?->id,
                    'void_reason' => $validated['reason'],
                ];
                $saleItem->save();
            }

            foreach ($lockedSale->payments as $payment) {
                $payment->status = 'voided';
                $payment->metadata = [
                    ...($payment->metadata ?? []),
                    'voided' => true,
                    'voided_at' => now()->toISOString(),
                    'voided_by' => $request->user()?->id,
                    'void_reason' => $validated['reason'],
                ];
                $payment->save();
            }

            $lockedSale->status = 'voided';
            $lockedSale->payment_status = 'voided';
            $lockedSale->subtotal_amount = 0;
            $lockedSale->discount_amount = 0;
            $lockedSale->tax_amount = 0;
            $lockedSale->total_amount = 0;
            $lockedSale->paid_amount = 0;
            $lockedSale->balance_amount = 0;
            $lockedSale->metadata = [
                ...($lockedSale->metadata ?? []),
                'voided' => true,
                'voided_at' => now()->toISOString(),
                'voided_by' => $request->user()?->id,
                'void_reason' => $validated['reason'],
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

        return response()->json([
            'message' => 'Transaction deleted through a controlled correction.',
            'sale' => $this->serializeSale($updatedSale, includeDetails: true),
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

    public function updateCustomer(
        Request $request,
        PharmacoCustomer $customer,
        AuditLogService $auditLogService,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        $tenant = $request->attributes->get('tenant');

        if ((int) $customer->tenant_id !== (int) $tenant->id) {
            abort(404);
        }

        $validated = $request->validate([
            'first_name' => ['sometimes', 'required', 'string', 'max:255'],
            'last_name' => ['sometimes', 'nullable', 'string', 'max:255'],
            'phone' => ['sometimes', 'nullable', 'string', 'max:80'],
            'email' => ['sometimes', 'nullable', 'email', 'max:255'],
            'date_of_birth' => ['sometimes', 'nullable', 'date'],
            'gender' => ['sometimes', 'nullable', 'string', 'max:40'],
            'customer_type' => ['sometimes', 'nullable', 'string', 'max:80'],
            'insurance_provider' => ['sometimes', 'nullable', 'string', 'max:255'],
            'insurance_membership_number' => ['sometimes', 'nullable', 'string', 'max:255'],
            'status' => ['sometimes', 'string', 'in:active,inactive'],
            'notes' => ['sometimes', 'nullable', 'string', 'max:1000'],
        ]);

        if (
            array_key_exists('phone', $validated) &&
            ! empty($validated['phone'])
        ) {
            $phoneExists = PharmacoCustomer::query()
                ->where('tenant_id', $tenant->id)
                ->where('phone', $validated['phone'])
                ->whereKeyNot($customer->id)
                ->exists();

            if ($phoneExists) {
                throw ValidationException::withMessages([
                    'phone' => [
                        'A customer with this phone number already exists for this tenant.',
                    ],
                ]);
            }
        }

        $updates = [];

        foreach ([
            'first_name',
            'last_name',
            'phone',
            'email',
            'date_of_birth',
            'gender',
            'customer_type',
            'insurance_provider',
            'insurance_membership_number',
            'status',
        ] as $field) {
            if (array_key_exists($field, $validated)) {
                $updates[$field] = $validated[$field];
            }
        }

        $metadata = is_array($customer->metadata)
            ? $customer->metadata
            : [];

        if (array_key_exists('notes', $validated)) {
            $metadata['notes'] = $validated['notes'];
        }

        $metadata['last_management_workflow'] =
            'customer_profile_update';

        $updates['metadata'] = $metadata;

        $customer->fill($updates);
        $customer->save();

        $scope = $scopeResolver->resolveForUser(
            $request->user()
        );

        $auditLogService->record(
            action: 'pharmaco.customer.updated',
            scope: $scope,
            metadata: [
                'tenant_slug' => $tenant->slug,
                'customer_id' => $customer->id,
                'changed_fields' => array_keys($updates),
            ],
            dataClassification: 'internal',
            auditableType: PharmacoCustomer::class,
            auditableId: $customer->id
        );

        return response()->json([
            'message' => 'Customer updated successfully.',
            'customer' => $this->serializeCustomer($customer),
        ]);
    }

    public function updatePrescription(
        Request $request,
        PharmacoPrescription $prescription,
        AuditLogService $auditLogService,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        $tenant = $request->attributes->get('tenant');

        if ((int) $prescription->tenant_id !== (int) $tenant->id) {
            abort(404);
        }

        $validated = $request->validate([
            'pharmaco_customer_id' => ['sometimes', 'nullable', 'integer'],
            'prescription_number' => ['sometimes', 'required', 'string', 'max:120'],
            'prescriber_name' => ['sometimes', 'nullable', 'string', 'max:255'],
            'prescriber_facility' => ['sometimes', 'nullable', 'string', 'max:255'],
            'prescriber_phone' => ['sometimes', 'nullable', 'string', 'max:80'],
            'issued_at' => ['sometimes', 'nullable', 'date'],
            'expires_at' => [
                'sometimes',
                'nullable',
                'date',
                'after_or_equal:issued_at',
            ],
            'status' => [
                'sometimes',
                'string',
                'in:active,used,expired,cancelled',
            ],
            'notes' => ['sometimes', 'nullable', 'string'],
        ]);

        if (
            array_key_exists(
                'pharmaco_customer_id',
                $validated
            ) &&
            $validated['pharmaco_customer_id'] !== null
        ) {
            $customerExists = PharmacoCustomer::query()
                ->where('tenant_id', $tenant->id)
                ->whereKey(
                    $validated['pharmaco_customer_id']
                )
                ->exists();

            if (! $customerExists) {
                throw ValidationException::withMessages([
                    'pharmaco_customer_id' => [
                        'Selected customer does not belong to the current tenant.',
                    ],
                ]);
            }
        }

        if (
            array_key_exists(
                'prescription_number',
                $validated
            )
        ) {
            $numberExists = PharmacoPrescription::query()
                ->where('tenant_id', $tenant->id)
                ->where(
                    'prescription_number',
                    $validated['prescription_number']
                )
                ->whereKeyNot($prescription->id)
                ->exists();

            if ($numberExists) {
                throw ValidationException::withMessages([
                    'prescription_number' => [
                        'This prescription number already exists for this tenant.',
                    ],
                ]);
            }
        }

        $updates = [];

        foreach ([
            'pharmaco_customer_id',
            'prescription_number',
            'prescriber_name',
            'prescriber_facility',
            'prescriber_phone',
            'issued_at',
            'expires_at',
            'status',
            'notes',
        ] as $field) {
            if (array_key_exists($field, $validated)) {
                $updates[$field] = $validated[$field];
            }
        }

        $metadata = is_array($prescription->metadata)
            ? $prescription->metadata
            : [];

        $metadata['last_management_workflow'] =
            'prescription_record_update';

        $updates['metadata'] = $metadata;

        $prescription->fill($updates);
        $prescription->save();
        $prescription->load('customer');

        $scope = $scopeResolver->resolveForUser(
            $request->user()
        );

        $auditLogService->record(
            action: 'pharmaco.prescription.updated',
            scope: $scope,
            metadata: [
                'tenant_slug' => $tenant->slug,
                'prescription_id' => $prescription->id,
                'prescription_number' =>
                    $prescription->prescription_number,
                'changed_fields' => array_keys($updates),
            ],
            dataClassification: 'internal',
            auditableType: PharmacoPrescription::class,
            auditableId: $prescription->id
        );

        return response()->json([
            'message' => 'Prescription updated successfully.',
            'prescription' => $this->serializePrescription(
                $prescription,
                includeCustomer: true
            ),
        ]);
    }

    public function uploadPrescriptionAttachment(
        Request $request,
        PharmacoPrescription $prescription,
        AuditLogService $auditLogService,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        $tenant = $request->attributes->get('tenant');

        if ((int) $prescription->tenant_id !== (int) $tenant->id) {
            abort(404);
        }

        $validated = $request->validate([
            'attachment' => [
                'required',
                'file',
                'mimes:pdf,jpg,jpeg,png,webp',
                'max:10240',
            ],
        ]);

        $file = $validated['attachment'];
        $disk = 'local';

        $extension = strtolower(
            $file->getClientOriginalExtension()
                ?: $file->extension()
                ?: 'bin'
        );

        $directory = implode('/', [
            'pharmaco',
            'prescriptions',
            (string) $tenant->id,
            $prescription->uuid,
        ]);

        $filename = (string) Str::uuid()
            . '.'
            . $extension;

        $storedPath = $file->storeAs(
            $directory,
            $filename,
            $disk
        );

        if (! $storedPath) {
            throw ValidationException::withMessages([
                'attachment' => [
                    'The prescription attachment could not be stored.',
                ],
            ]);
        }

        $previousDisk =
            $prescription->attachment_disk;

        $previousPath =
            $prescription->attachment_path;

        $prescription->fill([
            'attachment_disk' => $disk,
            'attachment_path' => $storedPath,
            'attachment_original_name' =>
                mb_substr(
                    $file->getClientOriginalName(),
                    0,
                    191
                ),
            'attachment_mime_type' =>
                mb_substr(
                    (string) $file->getMimeType(),
                    0,
                    100
                ),
            'attachment_size' => $file->getSize(),
            'attachment_uploaded_by' =>
                $request->user()?->id,
            'attachment_uploaded_at' => now(),
        ]);

        $prescription->save();

        if (
            $previousPath &&
            $previousPath !== $storedPath
        ) {
            Storage::disk(
                $previousDisk ?: 'local'
            )->delete($previousPath);
        }

        $prescription->load('customer');

        $scope = $scopeResolver->resolveForUser(
            $request->user()
        );

        $auditLogService->record(
            action: 'pharmaco.prescription.attachment_uploaded',
            scope: $scope,
            metadata: [
                'tenant_slug' => $tenant->slug,
                'prescription_id' => $prescription->id,
                'prescription_number' =>
                    $prescription->prescription_number,
                'mime_type' =>
                    $prescription->attachment_mime_type,
                'size' =>
                    $prescription->attachment_size,
            ],
            dataClassification: 'confidential',
            auditableType: PharmacoPrescription::class,
            auditableId: $prescription->id
        );

        return response()->json([
            'message' =>
                'Prescription attachment uploaded successfully.',
            'prescription' =>
                $this->serializePrescription(
                    $prescription,
                    includeCustomer: true
                ),
        ]);
    }

    public function prescriptionAttachment(
        Request $request,
        PharmacoPrescription $prescription
    ) {
        $tenant = $request->attributes->get('tenant');

        if ((int) $prescription->tenant_id !== (int) $tenant->id) {
            abort(404);
        }

        if (! $prescription->attachment_path) {
            abort(404);
        }

        $disk = $prescription->attachment_disk ?: 'local';

        if (
            ! Storage::disk($disk)->exists(
                $prescription->attachment_path
            )
        ) {
            abort(404);
        }

        return Storage::disk($disk)->download(
            $prescription->attachment_path,
            $prescription->attachment_original_name
                ?: 'prescription-attachment'
        );
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
            'items.*.original_unit_price' => ['nullable', 'numeric', 'gte:0'],
            'items.*.used_unit_price' => ['nullable', 'numeric', 'gte:0'],
            'items.*.unit_price_difference' => ['nullable', 'numeric'],
            'items.*.price_override_applied' => ['sometimes', 'boolean'],
            'items.*.original_selling_unit_price' => ['nullable', 'numeric', 'gte:0'],
            'items.*.used_selling_unit_price' => ['nullable', 'numeric', 'gte:0'],
            'items.*.selling_unit_price_difference' => ['nullable', 'numeric'],
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
        $prescriptionWarningProducts = $products
            ->filter(fn (Product $product) => (bool) $product->requires_prescription)
            ->map(fn (Product $product) => [
                'id' => $product->id,
                'sku' => $product->sku,
                'name' => $product->name,
            ])
            ->values()
            ->all();

        /*
         * RX_WARNING_ALLOW_POS_RECORDING_V2
         * Prescription-controlled products notify the pharmacist but do not
         * block POS sale recording. Warning is retained in metadata/audit.
         */
        $prescriptionWarningRequired = $requiresPrescription && ! $prescription;

        $result = DB::transaction(function () use ($request, $tenant, $validated, $branch, $customer, $prescription, $products, $prescriptionWarningRequired, $prescriptionWarningProducts) {
            $historicalSession = $this->lockActiveHistoricalSessionForBranch(
                $request,
                (int) $tenant->id,
                (int) $branch->id
            );

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
                ...($historicalSession ? [
                    'pos_session_id' => $historicalSession->id,
                    'entry_mode' => 'historical',
                    'business_date' => $historicalSession->business_date
                        ->toDateString(),
                    'historical_reason' => $historicalSession->historical_reason,
                    'historical_reference' => $historicalSession->historical_reference,
                    'historical_approval_id' => $historicalSession->historical_approval_id,
                ] : []),
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
                    'rx_prescription_warning_required' => $prescriptionWarningRequired,
                    'rx_prescription_warning_acknowledged' => $prescriptionWarningRequired,
                    'rx_prescription_warning_products' => $prescriptionWarningProducts,
                    ...($historicalSession ? [
                        'entry_mode' => 'historical',
                        'business_date' => $historicalSession->business_date
                            ->toDateString(),
                        'pos_session_id' => $historicalSession->id,
                        'historical_approval_id' => $historicalSession
                            ->historical_approval_id,
                        'recorded_at' => now()->toISOString(),
                    ] : []),
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
                'rx_prescription_warning_required' => (bool) ($result->metadata['rx_prescription_warning_required'] ?? false),
                'rx_prescription_warning_products' => $result->metadata['rx_prescription_warning_products'] ?? [],
                'entry_mode' => $result->entry_mode ?? 'live',
                'business_date' => $result->business_date?->toDateString(),
                'pos_session_id' => $result->pos_session_id,
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


    /**
     * Complete POS checkout atomically and safely support retries.
     */
    public function checkoutSale(
        Request $request,
        AuditLogService $auditLogService,
        ScopeResolver $scopeResolver,
        \App\Services\PharmaCo360\AtomicPosCheckoutService $checkoutService
    ): JsonResponse {
        $tenant = $request->attributes->get('tenant');

        $validated = $request->validate([
            'idempotency_key' => [
                'required',
                'string',
                'max:100',
                'regex:/^[A-Za-z0-9._:-]+$/',
            ],
            'branch_id' => ['required', 'integer'],
            'pharmaco_customer_id' => ['nullable', 'integer'],
            'pharmaco_prescription_id' => ['nullable', 'integer'],
            'sale_type' => [
                'nullable',
                'string',
                'in:cash_sale,prescription_sale,insurance_sale,credit_sale',
            ],
            'discount_amount' => ['nullable', 'numeric', 'gte:0'],
            'tax_amount' => ['nullable', 'numeric', 'gte:0'],
            'notes' => ['nullable', 'string'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'integer'],
            'items.*.quantity' => ['required', 'numeric', 'gt:0'],
            'items.*.unit_price' => ['required', 'numeric', 'gte:0'],
            'items.*.discount_amount' => ['nullable', 'numeric', 'gte:0'],
            'items.*.tax_amount' => ['nullable', 'numeric', 'gte:0'],
            'items.*.stock_batch_id' => ['required', 'integer'],
            'items.*.prescription_verified' => ['sometimes', 'boolean'],
            'payment' => ['required', 'array'],
            'payment.payment_method' => [
                'required',
                'string',
                'in:cash,momo,card,insurance,credit,bank_transfer',
            ],
            'payment.generate_receipt' => ['sometimes', 'boolean'],
            'payment.reference_number' => [
                'nullable',
                'string',
                'max:120',
            ],
            'payment.received_at' => ['nullable', 'date'],
            'payment.notes' => ['nullable', 'string', 'max:500'],
        ]);

        $idempotencyKey = $validated['idempotency_key'];

        $result = $checkoutService->execute(
            $idempotencyKey,
            function () use (
                $tenant,
                $idempotencyKey
            ): ?array {
                $existingSale = PharmacoSale::query()
                    ->where('tenant_id', $tenant->id)
                    ->where('pos_checkout_key', $idempotencyKey)
                    ->with([
                        'branch',
                        'customer',
                        'prescription.customer',
                        'items.product.category',
                        'items.stockBatch',
                        'items.stockLocation',
                        'payments',
                    ])
                    ->lockForUpdate()
                    ->first();

                if (! $existingSale) {
                    return null;
                }

                $payment = $existingSale->payments()
                    ->latest('id')
                    ->first();

                if (
                    ! $payment
                    || $existingSale->payment_status !== 'paid'
                    || $existingSale->status !== 'dispensed'
                ) {
                    throw ValidationException::withMessages([
                        'idempotency_key' => [
                            'A previous checkout attempt with this key '
                            . 'did not finish. Review the existing sale '
                            . 'before retrying.',
                        ],
                    ]);
                }

                return [
                    'sale' => $existingSale,
                    'payment' => $payment,
                ];
            },
            function () use (
                $request,
                $tenant,
                $validated,
                $idempotencyKey,
                $auditLogService,
                $scopeResolver
            ): PharmacoSale {
                $createPayload = [
                    'branch_id' => $validated['branch_id'],
                    'pharmaco_customer_id' =>
                        $validated['pharmaco_customer_id'] ?? null,
                    'pharmaco_prescription_id' =>
                        $validated['pharmaco_prescription_id'] ?? null,
                    'sale_type' =>
                        $validated['sale_type'] ?? 'cash_sale',
                    'discount_amount' =>
                        $validated['discount_amount'] ?? 0,
                    'tax_amount' =>
                        $validated['tax_amount'] ?? 0,
                    'notes' => $validated['notes'] ?? null,
                    'items' => array_map(
                        static fn (array $item): array => [
                            'product_id' => $item['product_id'],
                            'quantity' => $item['quantity'],
                            'unit_price' => $item['unit_price'],
                            'discount_amount' =>
                                $item['discount_amount'] ?? 0,
                            'tax_amount' =>
                                $item['tax_amount'] ?? 0,
                        ],
                        $validated['items']
                    ),
                ];

                $response = $this->createSale(
                    $this->nestedPosRequest(
                        $request,
                        $createPayload
                    ),
                    $auditLogService,
                    $scopeResolver
                );

                $payload = $response->getData(true);
                $sale = PharmacoSale::query()
                    ->where('tenant_id', $tenant->id)
                    ->findOrFail($payload['sale']['id']);

                $sale->forceFill([
                    'pos_checkout_key' => $idempotencyKey,
                    'metadata' => [
                        ...($sale->metadata ?? []),
                        'pos_checkout_idempotency_key' =>
                            $idempotencyKey,
                        'pos_checkout_started_at' =>
                            now()->toISOString(),
                    ],
                ])->save();

                return $sale->fresh();
            },
            function (PharmacoSale $sale) use (
                $request,
                $validated,
                $auditLogService,
                $scopeResolver
            ): PharmacoSale {
                $sale->load([
                    'items' => fn ($query) =>
                        $query->orderBy('id'),
                ]);

                $submittedItems = array_values(
                    $validated['items']
                );

                if ($sale->items->count() !== count($submittedItems)) {
                    throw ValidationException::withMessages([
                        'items' => [
                            'The created sale items do not match the '
                            . 'submitted checkout items.',
                        ],
                    ]);
                }

                foreach ($sale->items->values() as $index => $saleItem) {
                    $submittedItem = $submittedItems[$index] ?? [];

                    $usedUnitPrice = round(
                        (float) (
                            $submittedItem['used_unit_price']
                            ?? $submittedItem['unit_price']
                            ?? $saleItem->unit_price
                        ),
                        2
                    );

                    $originalUnitPrice = round(
                        (float) (
                            $submittedItem['original_unit_price']
                            ?? $usedUnitPrice
                        ),
                        2
                    );

                    $unitPriceDifference = round(
                        (float) (
                            $submittedItem['unit_price_difference']
                            ?? ($usedUnitPrice - $originalUnitPrice)
                        ),
                        2
                    );

                    $originalSellingUnitPrice = round(
                        (float) (
                            $submittedItem['original_selling_unit_price']
                            ?? $originalUnitPrice
                        ),
                        2
                    );

                    $usedSellingUnitPrice = round(
                        (float) (
                            $submittedItem['used_selling_unit_price']
                            ?? $usedUnitPrice
                        ),
                        2
                    );

                    $sellingUnitPriceDifference = round(
                        (float) (
                            $submittedItem['selling_unit_price_difference']
                            ?? ($usedSellingUnitPrice - $originalSellingUnitPrice)
                        ),
                        2
                    );

                    $saleItem->metadata = [
                        ...($saleItem->metadata ?? []),
                        'original_unit_price' => $originalUnitPrice,
                        'used_unit_price' => $usedUnitPrice,
                        'unit_price_difference' => $unitPriceDifference,
                        'price_override_applied' =>
                            (bool) (
                                $submittedItem['price_override_applied']
                                ?? abs($unitPriceDifference) > 0.0001
                            ),
                        'original_selling_unit_price' => $originalSellingUnitPrice,
                        'used_selling_unit_price' => $usedSellingUnitPrice,
                        'selling_unit_price_difference' =>
                            $sellingUnitPriceDifference,
                    ];

                    $saleItem->save();
                }

                $confirmationItems = $sale->items
                    ->values()
                    ->map(
                        static function (
                            $saleItem,
                            int $index
                        ) use ($submittedItems): array {
                            $submitted = $submittedItems[$index];

                            return [
                                'sale_item_id' => $saleItem->id,
                                'stock_batch_id' =>
                                    $submitted['stock_batch_id'],
                                'prescription_verified' =>
                                    (bool) (
                                        $submitted[
                                            'prescription_verified'
                                        ] ?? false
                                    ),
                            ];
                        }
                    )
                    ->all();

                $response = $this->confirmSale(
                    $this->nestedPosRequest(
                        $request,
                        ['items' => $confirmationItems]
                    ),
                    $sale,
                    $auditLogService,
                    $scopeResolver
                );

                $payload = $response->getData(true);

                return PharmacoSale::query()
                    ->findOrFail($payload['sale']['id']);
            },
            function (PharmacoSale $sale) use (
                $request,
                $validated,
                $auditLogService,
                $scopeResolver
            ): array {
                $sale->refresh();

                $balance = round(
                    (float) $sale->balance_amount,
                    2
                );

                if ($balance <= 0) {
                    throw ValidationException::withMessages([
                        'payment' => [
                            'The confirmed sale has no payable balance.',
                        ],
                    ]);
                }

                $paymentPayload = [
                    'amount' => $balance,
                    'payment_method' =>
                        $validated['payment']['payment_method'],
                    'generate_receipt' => (bool) (
                        $validated['payment'][
                            'generate_receipt'
                        ] ?? true
                    ),
                    'reference_number' =>
                        $validated['payment'][
                            'reference_number'
                        ] ?? null,
                    'received_at' =>
                        $validated['payment']['received_at']
                        ?? null,
                    'notes' =>
                        $validated['payment']['notes']
                        ?? null,
                ];

                $response = $this->recordPayment(
                    $this->nestedPosRequest(
                        $request,
                        $paymentPayload
                    ),
                    $sale,
                    $auditLogService,
                    $scopeResolver
                );

                $payload = $response->getData(true);

                return [
                    'sale' => PharmacoSale::query()
                        ->with([
                            'branch',
                            'customer',
                            'prescription.customer',
                            'items.product.category',
                            'items.stockBatch',
                            'items.stockLocation',
                            'payments',
                        ])
                        ->findOrFail($payload['sale']['id']),
                    'payment' => PharmacoPayment::query()
                        ->findOrFail($payload['payment']['id']),
                ];
            }
        );

        return response()->json([
            'message' => $result['idempotent']
                ? 'Checkout already completed. Existing result returned.'
                : 'POS checkout completed successfully.',
            'idempotent' => $result['idempotent'],
            'sale' => $this->serializeSale(
                $result['sale'],
                includeDetails: true
            ),
            'payment' => $this->serializePayment(
                $result['payment']
            ),
        ], $result['idempotent'] ? 200 : 201);
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
            'items.*.stock_batch_id' => ['nullable', 'integer'],
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

            $historicalSession = $this->lockHistoricalSessionForSale(
                $request,
                $lockedSale
            );

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
                $prescriptionVerified = (bool) $item->prescription_verified;

                if ($requiresPrescription && (! $lockedSale->pharmaco_prescription_id || ! $prescriptionVerified)) {
                    /*
                     * RX_WARNING_ALLOW_POS_CONFIRMATION_V2
                     * Notify pharmacist and keep audit metadata, but do not
                     * block stock dispensing/POS recording.
                     */
                    $lockedSale->metadata = [
                        ...($lockedSale->metadata ?? []),
                        'rx_prescription_warning_required' => true,
                        'rx_prescription_warning_acknowledged' => true,
                        'rx_prescription_warning_message' =>
                            'Prescription-controlled item was dispensed after pharmacist warning.',
                    ];
                    $lockedSale->save();
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
                    ...($historicalSession ? [
                        'pos_session_id' => $historicalSession->id,
                        'business_date' => $historicalSession->business_date
                            ->toDateString(),
                        'entry_mode' => 'historical',
                        'historical_approval_id' => $historicalSession
                            ->historical_approval_id,
                    ] : []),
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
                        ...($historicalSession ? [
                            'entry_mode' => 'historical',
                            'business_date' => $historicalSession->business_date
                                ->toDateString(),
                            'pos_session_id' => $historicalSession->id,
                            'historical_approval_id' => $historicalSession
                                ->historical_approval_id,
                            'recorded_at' => now()->toISOString(),
                        ] : []),
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
                ...($historicalSession ? [
                    'entry_mode' => 'historical',
                    'business_date' => $historicalSession->business_date
                        ->toDateString(),
                    'pos_session_id' => $historicalSession->id,
                    'recorded_at' => now()->toISOString(),
                ] : []),
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
                'entry_mode' => $confirmedSale->entry_mode ?? 'live',
                'business_date' => $confirmedSale->business_date?->toDateString(),
                'pos_session_id' => $confirmedSale->pos_session_id,
            ],
            dataClassification: 'internal',
            auditableType: PharmacoSale::class,
            auditableId: $confirmedSale->id
        );

        return response()->json([
            'message' => 'Sale confirmed and stock dispensed successfully.',
            'warning' => (bool) ($confirmedSale->metadata['rx_prescription_warning_required'] ?? false)
                ? 'Prescription-controlled medicine was dispensed after pharmacist warning.'
                : null,
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
            'generate_receipt' => ['sometimes', 'boolean'],
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

            $historicalSession = $this->lockHistoricalSessionForSale(
                $request,
                $lockedSale
            );

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

            $generateReceipt = (bool) (
                $validated['generate_receipt'] ?? true
            );

            $receiptNumber = $generateReceipt
                ? $this->nextReceiptNumber(
                    $tenant->id,
                    $lockedSale->id
                )
                : null;

            $payment = PharmacoPayment::query()->create([
                'uuid' => (string) Str::uuid(),
                'tenant_id' => $tenant->id,
                'pharmaco_sale_id' => $lockedSale->id,
                ...($historicalSession ? [
                    'pos_session_id' => $historicalSession->id,
                    'business_date' => $historicalSession->business_date
                        ->toDateString(),
                    'entry_mode' => 'historical',
                    'historical_approval_id' => $historicalSession
                        ->historical_approval_id,
                ] : []),
                'amount' => $amount,
                'payment_method' => $validated['payment_method'],
                'status' => 'completed',
                'reference_number' => $validated['reference_number'] ?? null,
                'receipt_number' => $receiptNumber,
                'received_by' => $request->user()?->id,
                'received_at' => $historicalSession
                    ? now()
                    : ($validated['received_at'] ?? now()),
                'metadata' => [
                    'notes' => $validated['notes'] ?? null,
                    'previous_paid_amount' => $currentPaid,
                    'previous_balance_amount' => $currentBalance,
                    'new_paid_amount' => $newPaid,
                    'new_balance_amount' => $newBalance,
                    'payment_workflow' => 'phase_5_1_record_payment',
                    'customer_receipt_requested' => $generateReceipt,
                    ...($historicalSession ? [
                        'entry_mode' => 'historical',
                        'business_date' => $historicalSession->business_date
                            ->toDateString(),
                        'pos_session_id' => $historicalSession->id,
                        'historical_approval_id' => $historicalSession
                            ->historical_approval_id,
                        'requested_received_at' => $validated['received_at'] ?? null,
                        'recorded_at' => now()->toISOString(),
                    ] : []),
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

        $this->shadowPostPaymentToFinance($result['payment'], $result['sale']);

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
                'entry_mode' => $result['payment']->entry_mode ?? 'live',
                'business_date' => $result['payment']->business_date?->toDateString(),
                'pos_session_id' => $result['payment']->pos_session_id,
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


    private function nestedPosRequest(
        Request $parent,
        array $payload
    ): Request {
        $nested = Request::create(
            $parent->getRequestUri(),
            'POST',
            $payload,
            $parent->cookies->all(),
            [],
            $parent->server->all()
        );

        $nested->headers->replace(
            $parent->headers->all()
        );

        $nested->setUserResolver(
            static fn () => $parent->user()
        );

        $nested->setRouteResolver(
            $parent->getRouteResolver()
        );

        foreach ($parent->attributes->all() as $key => $value) {
            $nested->attributes->set($key, $value);
        }

        return $nested;
    }

    private function lockActiveHistoricalSessionForBranch(
        Request $request,
        int $tenantId,
        int $branchId
    ): ?PharmacoPosSession {
        $session = PharmacoPosSession::query()
            ->where('tenant_id', $tenantId)
            ->where('user_id', $request->user()->id)
            ->where('session_mode', 'historical')
            ->where('status', 'open')
            ->latest('id')
            ->lockForUpdate()
            ->first();

        if (! $session) {
            return null;
        }

        if (
            ! $request->user()
            || ! $request->user()->hasPermission(
                'pharmaco.pos.historical.record'
            )
        ) {
            abort(
                403,
                'Historical POS transaction recording permission is required.'
            );
        }

        if ((int) $session->branch_id !== $branchId) {
            throw ValidationException::withMessages([
                'branch_id' => [
                    'The active historical POS session belongs '
                    . 'to a different branch.',
                ],
            ]);
        }

        return $session;
    }

    private function lockHistoricalSessionForSale(
        Request $request,
        PharmacoSale $sale
    ): ?PharmacoPosSession {
        if ($sale->entry_mode !== 'historical') {
            return null;
        }

        if (
            ! $request->user()
            || ! $request->user()->hasPermission(
                'pharmaco.pos.historical.record'
            )
        ) {
            abort(
                403,
                'Historical POS transaction recording permission is required.'
            );
        }

        if (! $sale->pos_session_id) {
            throw ValidationException::withMessages([
                'session' => [
                    'The historical sale is not linked to a '
                    . 'valid POS session.',
                ],
            ]);
        }

        $session = PharmacoPosSession::query()
            ->whereKey($sale->pos_session_id)
            ->where('tenant_id', $sale->tenant_id)
            ->where('branch_id', $sale->branch_id)
            ->where('user_id', $request->user()->id)
            ->where('session_mode', 'historical')
            ->where('status', 'open')
            ->lockForUpdate()
            ->first();

        if (! $session) {
            throw ValidationException::withMessages([
                'session' => [
                    'Reopen the original historical POS session '
                    . 'before changing this sale.',
                ],
            ]);
        }

        if (
            ! $sale->business_date
            || ! $session->business_date
            || ! $sale->business_date->isSameDay(
                $session->business_date
            )
        ) {
            throw ValidationException::withMessages([
                'business_date' => [
                    'The sale business date does not match the '
                    . 'active historical POS session.',
                ],
            ]);
        }

        if (
            (int) $sale->historical_approval_id
            !== (int) $session->historical_approval_id
        ) {
            throw ValidationException::withMessages([
                'session' => [
                    'The historical approval context no longer '
                    . 'matches the active POS session.',
                ],
            ]);
        }

        return $session;
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
            'attachment' => $prescription->attachment_path
                ? [
                    'original_name' =>
                        $prescription->attachment_original_name,
                    'mime_type' =>
                        $prescription->attachment_mime_type,
                    'size' =>
                        $prescription->attachment_size,
                    'uploaded_at' =>
                        $prescription->attachment_uploaded_at
                            ?->toISOString(),
                    'download_path' => sprintf(
                        '/api/v1/pharmaco/prescriptions/%d/attachment',
                        $prescription->id
                    ),
                ]
                : null,
        ];

        if ($includeCustomer) {
            $payload['customer'] = $prescription->customer
                ? $this->serializeCustomer($prescription->customer)
                : null;
        }

        return $payload;
    }

    private function shadowPostPaymentToFinance(PharmacoPayment $payment, PharmacoSale $sale): void
    {
        try {
            app(PharmacoPosPaymentShadowPostingService::class)->postPayment(
                $payment,
                $sale
            );
        } catch (Throwable $exception) {
            report($exception);
        }
    }

    /* LEGACY_COST_MARGIN_COMPUTATION_V1 */
    private function serializeSale(PharmacoSale $sale, bool $includeDetails = false): array
    {
        $payload = [
            'id' => $sale->id,
            'uuid' => $sale->uuid,
            'pos_checkout_key' => $sale->pos_checkout_key,
            'sale_number' => $sale->sale_number,
            'sale_type' => $sale->sale_type,
            'status' => $sale->status,
            'entry_mode' => $sale->entry_mode ?? 'live',
            'business_date' => $sale->business_date?->toDateString(),
            'pos_session_id' => $sale->pos_session_id,
            'historical_reason' => $sale->historical_reason,
            'historical_reference' => $sale->historical_reference,
            'historical_approval_id' => $sale->historical_approval_id,
            'is_historical' => $sale->entry_mode === 'historical',
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

        if ($sale->relationLoaded('payments')) {
            $payload['payments'] = $sale->payments
                ->map(fn (PharmacoPayment $payment) => $this->serializePayment($payment))
                ->values();
        }

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
            'entry_mode' => $payment->entry_mode ?? 'live',
            'business_date' => $payment->business_date?->toDateString(),
            'pos_session_id' => $payment->pos_session_id,
            'historical_approval_id' => $payment->historical_approval_id,
            'is_historical' => $payment->entry_mode === 'historical',
            'reference_number' => $payment->reference_number,
            'receipt_number' => $payment->receipt_number,
            'received_at' => $payment->received_at?->toISOString(),
            'metadata' => $payment->metadata ?? [],
        ];
    }
}
