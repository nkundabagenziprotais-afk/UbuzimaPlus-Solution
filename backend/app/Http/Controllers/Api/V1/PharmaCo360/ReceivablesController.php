<?php

namespace App\Http\Controllers\Api\V1\PharmaCo360;

use App\Http\Controllers\Controller;
use App\Models\PharmacoCustomer;
use App\Models\PharmacoCustomerReceivable;
use App\Models\PharmacoCustomerReceivablePayment;
use App\Models\PharmacoSale;
use App\Services\Audit\AuditLogService;
use App\Services\Access\ScopeResolver;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class ReceivablesController extends Controller
{
    public function receivables(Request $request): JsonResponse
    {
        $tenant = $request->attributes->get('tenant');

        $receivables = PharmacoCustomerReceivable::query()
            ->with(['customer', 'sale'])
            ->where('tenant_id', $tenant->id)
            ->latest()
            ->limit(100)
            ->get();

        return response()->json([
            'tenant' => $this->tenantPayload($tenant),
            'receivables' => $receivables->map(fn (PharmacoCustomerReceivable $receivable) => $this->serializeReceivable($receivable)),
        ]);
    }

    public function receivable(Request $request, PharmacoCustomerReceivable $receivable): JsonResponse
    {
        $tenant = $request->attributes->get('tenant');

        if ((int) $receivable->tenant_id !== (int) $tenant->id) {
            abort(404);
        }

        $receivable->load(['customer', 'sale', 'payments']);

        return response()->json([
            'tenant' => $this->tenantPayload($tenant),
            'receivable' => $this->serializeReceivable($receivable, includeDetails: true),
        ]);
    }

    public function updateCustomerCredit(
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
            'credit_limit' => ['required', 'numeric', 'min:0'],
            'credit_terms_days' => ['nullable', 'integer', 'min:0', 'max:365'],
            'credit_status' => ['required', 'string', Rule::in(['enabled', 'disabled', 'suspended'])],
        ]);

        $before = [
            'credit_limit' => (float) ($customer->credit_limit ?? 0),
            'credit_balance' => (float) ($customer->credit_balance ?? 0),
            'credit_terms_days' => $customer->credit_terms_days,
            'credit_status' => $customer->credit_status ?? 'disabled',
        ];

        $customer->fill([
            'credit_limit' => $validated['credit_limit'],
            'credit_terms_days' => $validated['credit_terms_days'] ?? null,
            'credit_status' => $validated['credit_status'],
        ]);
        $customer->save();

        $scope = $scopeResolver->resolveForUser($request->user());

        $auditLogService->record(
            action: 'pharmaco.customer_credit.updated',
            scope: $scope,
            metadata: [
                'tenant_slug' => $tenant->slug,
                'customer_id' => $customer->id,
                'customer_code' => $customer->customer_code,
                'before' => $before,
                'after' => [
                    'credit_limit' => (float) $customer->credit_limit,
                    'credit_balance' => (float) $customer->credit_balance,
                    'credit_terms_days' => $customer->credit_terms_days,
                    'credit_status' => $customer->credit_status,
                ],
            ],
            dataClassification: 'internal',
            auditableType: PharmacoCustomer::class,
            auditableId: $customer->id
        );

        return response()->json([
            'message' => 'Customer credit profile updated successfully.',
            'customer' => $this->serializeCustomerCredit($customer->fresh()),
        ]);
    }

    public function createReceivable(
        Request $request,
        AuditLogService $auditLogService,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        $tenant = $request->attributes->get('tenant');

        $validated = $request->validate([
            'pharmaco_customer_id' => [
                'required',
                'integer',
                Rule::exists('pharmaco_customers', 'id')->where(fn ($query) => $query->where('tenant_id', $tenant->id)),
            ],
            'pharmaco_sale_id' => [
                'nullable',
                'integer',
                Rule::exists('pharmaco_sales', 'id')->where(fn ($query) => $query->where('tenant_id', $tenant->id)),
            ],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'issued_at' => ['nullable', 'date'],
            'due_date' => ['nullable', 'date'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);

        $customer = PharmacoCustomer::query()
            ->where('tenant_id', $tenant->id)
            ->findOrFail($validated['pharmaco_customer_id']);

        if (($customer->credit_status ?? 'disabled') !== 'enabled') {
            throw ValidationException::withMessages([
                'pharmaco_customer_id' => ['Customer credit is not enabled.'],
            ]);
        }

        $amount = (float) $validated['amount'];
        $creditLimit = (float) ($customer->credit_limit ?? 0);
        $creditBalance = (float) ($customer->credit_balance ?? 0);

        if (($creditBalance + $amount) > $creditLimit) {
            throw ValidationException::withMessages([
                'amount' => ['Receivable amount exceeds the customer credit limit.'],
            ]);
        }

        $sale = null;

        if (! empty($validated['pharmaco_sale_id'])) {
            $sale = PharmacoSale::query()
                ->where('tenant_id', $tenant->id)
                ->findOrFail($validated['pharmaco_sale_id']);

            if ((int) $sale->pharmaco_customer_id !== (int) $customer->id) {
                throw ValidationException::withMessages([
                    'pharmaco_sale_id' => ['Sale customer must match the selected receivable customer.'],
                ]);
            }
        }

        $receivable = DB::transaction(function () use ($tenant, $request, $validated, $customer, $sale, $amount) {
            $receivable = PharmacoCustomerReceivable::query()->create([
                'uuid' => (string) Str::uuid(),
                'tenant_id' => $tenant->id,
                'pharmaco_customer_id' => $customer->id,
                'pharmaco_sale_id' => $sale?->id,
                'receivable_number' => $this->nextReceivableNumber($tenant->id),
                'status' => 'open',
                'original_amount' => $amount,
                'paid_amount' => 0,
                'balance_amount' => $amount,
                'issued_at' => $validated['issued_at'] ?? now()->toDateString(),
                'due_date' => $validated['due_date'] ?? null,
                'created_by' => $request->user()?->id,
                'notes' => $validated['notes'] ?? null,
                'metadata' => [
                    'source' => $sale ? 'sale_credit' : 'manual_customer_receivable',
                    'sale_number' => $sale?->sale_number,
                ],
            ]);

            $customer->credit_balance = (float) ($customer->credit_balance ?? 0) + $amount;
            $customer->save();

            return $receivable->fresh(['customer', 'sale', 'payments']);
        });

        $scope = $scopeResolver->resolveForUser($request->user());

        $auditLogService->record(
            action: 'pharmaco.customer_receivable.created',
            scope: $scope,
            metadata: [
                'tenant_slug' => $tenant->slug,
                'receivable_id' => $receivable->id,
                'receivable_number' => $receivable->receivable_number,
                'customer_id' => $customer->id,
                'amount' => $amount,
                'credit_balance' => (float) $customer->fresh()->credit_balance,
            ],
            dataClassification: 'internal',
            auditableType: PharmacoCustomerReceivable::class,
            auditableId: $receivable->id
        );

        return response()->json([
            'message' => 'Customer receivable created successfully.',
            'receivable' => $this->serializeReceivable($receivable, includeDetails: true),
        ], 201);
    }

    public function recordPayment(
        Request $request,
        PharmacoCustomerReceivable $receivable,
        AuditLogService $auditLogService,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        $tenant = $request->attributes->get('tenant');

        if ((int) $receivable->tenant_id !== (int) $tenant->id) {
            abort(404);
        }

        if (! in_array($receivable->status, ['open', 'partially_collected'], true)) {
            throw ValidationException::withMessages([
                'status' => ['Payments can only be recorded on open or partially collected receivables.'],
            ]);
        }

        $validated = $request->validate([
            'amount' => ['required', 'numeric', 'min:0.01'],
            'payment_method' => ['required', 'string', Rule::in(['cash', 'momo', 'card', 'bank_transfer', 'cheque'])],
            'reference_number' => ['nullable', 'string', 'max:120'],
            'paid_at' => ['nullable', 'date'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);

        $amount = (float) $validated['amount'];

        if ($amount > (float) $receivable->balance_amount) {
            throw ValidationException::withMessages([
                'amount' => ['Payment amount cannot exceed the receivable balance.'],
            ]);
        }

        [$payment, $receivable] = DB::transaction(function () use ($tenant, $request, $validated, $receivable, $amount) {
            $payment = PharmacoCustomerReceivablePayment::query()->create([
                'uuid' => (string) Str::uuid(),
                'tenant_id' => $tenant->id,
                'pharmaco_customer_receivable_id' => $receivable->id,
                'pharmaco_customer_id' => $receivable->pharmaco_customer_id,
                'payment_number' => $this->nextReceivablePaymentNumber($tenant->id),
                'amount' => $amount,
                'payment_method' => $validated['payment_method'],
                'reference_number' => $validated['reference_number'] ?? null,
                'status' => 'completed',
                'paid_at' => $validated['paid_at'] ?? now(),
                'recorded_by' => $request->user()?->id,
                'notes' => $validated['notes'] ?? null,
                'metadata' => [
                    'source' => 'phase_11_1_customer_receivable_payment_api',
                ],
            ]);

            $paidAmount = (float) $receivable->paid_amount + $amount;
            $balance = max((float) $receivable->original_amount - $paidAmount, 0);

            $receivable->paid_amount = $paidAmount;
            $receivable->balance_amount = $balance;
            $receivable->status = $balance <= 0 ? 'collected' : 'partially_collected';
            $receivable->closed_at = $balance <= 0 ? now() : null;
            $receivable->save();

            $customer = $receivable->customer()->lockForUpdate()->firstOrFail();
            $customer->credit_balance = max((float) ($customer->credit_balance ?? 0) - $amount, 0);
            $customer->save();

            return [
                $payment,
                $receivable->fresh(['customer', 'sale', 'payments']),
            ];
        });

        $scope = $scopeResolver->resolveForUser($request->user());

        $auditLogService->record(
            action: 'pharmaco.customer_receivable.payment_recorded',
            scope: $scope,
            metadata: [
                'tenant_slug' => $tenant->slug,
                'receivable_id' => $receivable->id,
                'payment_id' => $payment->id,
                'payment_number' => $payment->payment_number,
                'amount' => $amount,
                'balance_amount' => (float) $receivable->balance_amount,
            ],
            dataClassification: 'internal',
            auditableType: PharmacoCustomerReceivablePayment::class,
            auditableId: $payment->id
        );

        return response()->json([
            'message' => 'Customer receivable payment recorded successfully.',
            'receivable_payment' => $this->serializeReceivablePayment($payment),
            'receivable' => $this->serializeReceivable($receivable, includeDetails: true),
        ], 201);
    }

    private function serializeReceivable(PharmacoCustomerReceivable $receivable, bool $includeDetails = false): array
    {
        $payload = [
            'id' => $receivable->id,
            'uuid' => $receivable->uuid,
            'receivable_number' => $receivable->receivable_number,
            'status' => $receivable->status,
            'original_amount' => (float) $receivable->original_amount,
            'paid_amount' => (float) $receivable->paid_amount,
            'balance_amount' => (float) $receivable->balance_amount,
            'issued_at' => $receivable->issued_at?->toDateString(),
            'due_date' => $receivable->due_date?->toDateString(),
            'closed_at' => $receivable->closed_at?->toISOString(),
            'notes' => $receivable->notes,
            'metadata' => $receivable->metadata ?? [],
            'customer' => $receivable->customer ? $this->serializeCustomerCredit($receivable->customer) : null,
            'sale' => $receivable->sale ? [
                'id' => $receivable->sale->id,
                'sale_number' => $receivable->sale->sale_number,
                'status' => $receivable->sale->status,
                'total_amount' => (float) $receivable->sale->total_amount,
            ] : null,
            'payments_count' => $receivable->payments_count ?? $receivable->payments?->count(),
            'created_at' => $receivable->created_at?->toISOString(),
        ];

        if ($includeDetails) {
            $payload['payments'] = $receivable->payments
                ->map(fn (PharmacoCustomerReceivablePayment $payment) => $this->serializeReceivablePayment($payment))
                ->values();
        }

        return $payload;
    }

    private function serializeReceivablePayment(PharmacoCustomerReceivablePayment $payment): array
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

    private function serializeCustomerCredit(PharmacoCustomer $customer): array
    {
        return [
            'id' => $customer->id,
            'uuid' => $customer->uuid,
            'customer_code' => $customer->customer_code,
            'name' => trim(($customer->first_name ?? '') . ' ' . ($customer->last_name ?? '')),
            'phone' => $customer->phone,
            'email' => $customer->email,
            'status' => $customer->status,
            'credit_limit' => (float) ($customer->credit_limit ?? 0),
            'credit_balance' => (float) ($customer->credit_balance ?? 0),
            'credit_terms_days' => $customer->credit_terms_days,
            'credit_status' => $customer->credit_status ?? 'disabled',
        ];
    }

    private function nextReceivableNumber(int $tenantId): string
    {
        $date = now()->format('Ymd');
        $count = PharmacoCustomerReceivable::query()
            ->where('tenant_id', $tenantId)
            ->whereDate('created_at', now()->toDateString())
            ->count() + 1;

        return sprintf('AR-%04d-%s-%04d', $tenantId, $date, $count);
    }

    private function nextReceivablePaymentNumber(int $tenantId): string
    {
        $date = now()->format('Ymd');
        $count = PharmacoCustomerReceivablePayment::query()
            ->where('tenant_id', $tenantId)
            ->whereDate('created_at', now()->toDateString())
            ->count() + 1;

        return sprintf('ARPAY-%04d-%s-%04d', $tenantId, $date, $count);
    }

    private function tenantPayload($tenant): array
    {
        return [
            'id' => $tenant->id,
            'name' => $tenant->name,
            'slug' => $tenant->slug,
        ];
    }
}
