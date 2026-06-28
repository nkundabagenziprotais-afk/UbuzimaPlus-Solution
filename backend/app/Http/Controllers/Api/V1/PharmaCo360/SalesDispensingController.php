<?php

namespace App\Http\Controllers\Api\V1\PharmaCo360;

use App\Http\Controllers\Controller;
use App\Models\PharmacoCustomer;
use App\Models\PharmacoPrescription;
use App\Models\PharmacoSale;
use App\Models\PharmacoSaleItem;
use App\Models\PharmacoPayment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

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
