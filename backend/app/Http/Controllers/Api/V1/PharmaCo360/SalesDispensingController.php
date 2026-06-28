<?php

namespace App\Http\Controllers\Api\V1\PharmaCo360;

use App\Http\Controllers\Controller;
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

    private function serializePayment(PharmacoPayment $payment): array
    {
        return [
            'id' => $payment->id,
            'uuid' => $payment->uuid,
            'amount' => (float) $payment->amount,
            'payment_method' => $payment->payment_method,
            'status' => $payment->status,
            'reference_number' => $payment->reference_number,
            'received_at' => $payment->received_at?->toISOString(),
            'metadata' => $payment->metadata ?? [],
        ];
    }
}
