<?php

namespace App\Http\Controllers\Api\V1\PharmaCo360;

use App\Http\Controllers\Controller;
use App\Models\PharmacoPayment;
use App\Models\PharmacoPaymentReconciliation;
use App\Models\PharmacoSale;
use App\Models\PharmacoSaleItem;
use App\Models\PharmacoSaleReturn;
use App\Models\PharmacoSaleReturnItem;
use App\Models\StockBatch;
use App\Models\StockMovement;
use App\Services\Access\ScopeResolver;
use App\Services\Audit\AuditLogService;
use App\Services\PharmaCo360\SaleReturnPolicyService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class SaleReturnsController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $tenant = $request->attributes->get('tenant');

        $limit = min(
            max((int) $request->query('per_page', 50), 1),
            100
        );

        $returns = PharmacoSaleReturn::query()
            ->with([
                'branch',
                'sale.customer',
                'items.saleItem',
                'items.stockBatch',
            ])
            ->where('tenant_id', $tenant->id)
            ->when(
                $request->filled('status'),
                fn ($query) => $query->where(
                    'status',
                    $request->query('status')
                )
            )
            ->when(
                $request->filled('sale_id'),
                fn ($query) => $query->where(
                    'pharmaco_sale_id',
                    $request->integer('sale_id')
                )
            )
            ->latest('requested_at')
            ->limit($limit)
            ->get();

        return response()->json([
            'tenant' => $this->tenantPayload($tenant),
            'returns' => $returns
                ->map(
                    fn (PharmacoSaleReturn $saleReturn) =>
                        $this->serializeReturn(
                            $saleReturn,
                            true
                        )
                )
                ->values(),
        ]);
    }

    public function show(
        Request $request,
        PharmacoSaleReturn $saleReturn
    ): JsonResponse {
        $tenant = $request->attributes->get('tenant');

        $this->authorizeTenant(
            (int) $tenant->id,
            (int) $saleReturn->tenant_id
        );

        $saleReturn->load([
            'branch',
            'sale.customer',
            'sale.payments',
            'items.saleItem',
            'items.product',
            'items.stockBatch',
        ]);

        return response()->json([
            'tenant' => $this->tenantPayload($tenant),
            'return' => $this->serializeReturn(
                $saleReturn,
                true
            ),
        ]);
    }

    public function store(
        Request $request,
        PharmacoSale $sale,
        SaleReturnPolicyService $policy,
        AuditLogService $auditLogService,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        $tenant = $request->attributes->get('tenant');

        $this->authorizeTenant(
            (int) $tenant->id,
            (int) $sale->tenant_id
        );

        $validated = $request->validate([
            'reason' => [
                'required',
                'string',
                'min:10',
                'max:500',
            ],
            'refund_method' => [
                'nullable',
                'in:original_method,cash,momo,card,bank_transfer,credit_note',
            ],
            'notes' => [
                'nullable',
                'string',
                'max:1000',
            ],
            'items' => [
                'required',
                'array',
                'min:1',
            ],
            'items.*.sale_item_id' => [
                'required',
                'integer',
                'distinct',
            ],
            'items.*.quantity' => [
                'required',
                'numeric',
                'gt:0',
            ],
            'items.*.disposition' => [
                'required',
                'in:restock,quarantine,destroy,no_restock',
            ],
            'items.*.reason' => [
                'nullable',
                'string',
                'max:500',
            ],
        ]);

        $saleReturn = DB::transaction(
            function () use (
                $tenant,
                $request,
                $sale,
                $validated,
                $policy
            ) {
                $lockedSale = PharmacoSale::query()
                    ->lockForUpdate()
                    ->findOrFail($sale->id);

                $this->authorizeTenant(
                    (int) $tenant->id,
                    (int) $lockedSale->tenant_id
                );

                $policy->ensureSaleStatusReturnable(
                    $lockedSale->status
                );

                $saleReturn =
                    PharmacoSaleReturn::query()->create([
                        'uuid' => (string) Str::uuid(),
                        'tenant_id' => $tenant->id,
                        'branch_id' => $lockedSale->branch_id,
                        'pharmaco_sale_id' =>
                            $lockedSale->id,
                        'return_number' =>
                            $this->nextReturnNumber(
                                (int) $tenant->id
                            ),
                        'status' => 'pending',
                        'reason' => $validated['reason'],
                        'requested_refund_amount' => 0,
                        'refund_method' =>
                            $validated['refund_method']
                            ?? 'original_method',
                        'requested_by' =>
                            $request->user()->id,
                        'requested_at' => now(),
                        'notes' =>
                            $validated['notes'] ?? null,
                        'metadata' => [
                            'workflow' =>
                                'controlled_sale_return_v1',
                            'original_sale_status' =>
                                $lockedSale->status,
                            'original_payment_status' =>
                                $lockedSale->payment_status,
                        ],
                    ]);

                $requestedRefund = 0.0;

                foreach ($validated['items'] as $payload) {
                    $saleItem = PharmacoSaleItem::query()
                        ->where(
                            'tenant_id',
                            $tenant->id
                        )
                        ->where(
                            'pharmaco_sale_id',
                            $lockedSale->id
                        )
                        ->lockForUpdate()
                        ->find($payload['sale_item_id']);

                    if (! $saleItem) {
                        throw ValidationException::withMessages([
                            'items' => [
                                'One or more return items do not '
                                . 'belong to the selected sale.',
                            ],
                        ]);
                    }

                    if ($saleItem->status !== 'dispensed') {
                        throw ValidationException::withMessages([
                            'items' => [
                                'Only dispensed sale items '
                                . 'can be returned.',
                            ],
                        ]);
                    }

                    $previouslyReserved =
                        (float)
                        PharmacoSaleReturnItem::query()
                            ->where(
                                'pharmaco_sale_item_id',
                                $saleItem->id
                            )
                            ->whereHas(
                                'saleReturn',
                                fn ($query) =>
                                    $query->whereIn(
                                        'status',
                                        ['pending', 'refunded']
                                    )
                            )
                            ->sum('quantity');

                    $returnQuantity =
                        round(
                            (float) $payload['quantity'],
                            3
                        );

                    $policy->ensureQuantityAvailable(
                        (float) $saleItem->quantity,
                        $previouslyReserved,
                        $returnQuantity
                    );

                    $lineRefund =
                        $policy->calculateLineRefund(
                            (float) $saleItem->line_total,
                            (float) $saleItem->quantity,
                            $returnQuantity
                        );

                    PharmacoSaleReturnItem::query()
                        ->create([
                            'uuid' => (string) Str::uuid(),
                            'tenant_id' => $tenant->id,
                            'pharmaco_sale_return_id' =>
                                $saleReturn->id,
                            'pharmaco_sale_item_id' =>
                                $saleItem->id,
                            'product_id' =>
                                $saleItem->product_id,
                            'stock_batch_id' =>
                                $saleItem->stock_batch_id,
                            'quantity' => $returnQuantity,
                            'unit_price' =>
                                $saleItem->unit_price,
                            'line_refund_amount' =>
                                $lineRefund,
                            'disposition' =>
                                $payload['disposition'],
                            'reason' =>
                                $payload['reason'] ?? null,
                            'stock_restored' => false,
                            'metadata' => [
                                'original_line_total' =>
                                    (float)
                                    $saleItem->line_total,
                                'original_quantity' =>
                                    (float)
                                    $saleItem->quantity,
                                'original_batch_id' =>
                                    $saleItem->stock_batch_id,
                            ],
                        ]);

                    $requestedRefund += $lineRefund;
                }

                $saleReturn->requested_refund_amount =
                    round($requestedRefund, 2);

                $saleReturn->save();

                return $saleReturn->fresh([
                    'branch',
                    'sale.customer',
                    'items.saleItem',
                    'items.stockBatch',
                ]);
            }
        );

        $scope = $scopeResolver->resolveForUser(
            $request->user()
        );

        $auditLogService->record(
            action: 'pharmaco.sale.return.requested',
            scope: $scope,
            metadata: [
                'tenant_slug' => $tenant->slug,
                'return_id' => $saleReturn->id,
                'return_number' =>
                    $saleReturn->return_number,
                'sale_id' => $sale->id,
                'sale_number' => $sale->sale_number,
                'requested_refund_amount' =>
                    (float)
                    $saleReturn
                        ->requested_refund_amount,
            ],
            dataClassification: 'internal',
            auditableType: PharmacoSaleReturn::class,
            auditableId: $saleReturn->id
        );

        return response()->json([
            'message' =>
                'Sale return submitted for approval.',
            'return' => $this->serializeReturn(
                $saleReturn,
                true
            ),
        ], 201);
    }

    public function approve(
        Request $request,
        PharmacoSaleReturn $saleReturn,
        SaleReturnPolicyService $policy,
        AuditLogService $auditLogService,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        $tenant = $request->attributes->get('tenant');

        $this->authorizeTenant(
            (int) $tenant->id,
            (int) $saleReturn->tenant_id
        );

        $validated = $request->validate([
            'refund_method' => [
                'nullable',
                'in:original_method,cash,momo,card,bank_transfer,credit_note',
            ],
            'refund_reference' => [
                'nullable',
                'string',
                'max:191',
            ],
            'notes' => [
                'nullable',
                'string',
                'max:1000',
            ],
        ]);

        $saleReturn = DB::transaction(
            function () use (
                $tenant,
                $request,
                $saleReturn,
                $validated,
                $policy
            ) {
                $lockedReturn =
                    PharmacoSaleReturn::query()
                        ->with([
                            'items.saleItem',
                            'items.stockBatch',
                        ])
                        ->lockForUpdate()
                        ->findOrFail($saleReturn->id);

                $this->authorizeTenant(
                    (int) $tenant->id,
                    (int) $lockedReturn->tenant_id
                );

                if ($lockedReturn->status !== 'pending') {
                    throw ValidationException::withMessages([
                        'return' => [
                            'Only a pending return can be approved.',
                        ],
                    ]);
                }

                $lockedSale = PharmacoSale::query()
                    ->with('items')
                    ->lockForUpdate()
                    ->findOrFail(
                        $lockedReturn->pharmaco_sale_id
                    );

                $policy->ensureSaleStatusReturnable(
                    $lockedSale->status
                );

                $refundMethod =
                    $validated['refund_method']
                    ?? $lockedReturn->refund_method
                    ?? 'original_method';

                $refundAmount =
                    (float)
                    $lockedReturn->requested_refund_amount;

                if (
                    $refundMethod !== 'credit_note'
                    && $refundAmount
                        - (float) $lockedSale->paid_amount
                        > 0.005
                ) {
                    throw ValidationException::withMessages([
                        'refund_method' => [
                            'A direct refund cannot exceed '
                            . 'the amount already paid. Use a '
                            . 'credit note for unpaid value.',
                        ],
                    ]);
                }

                foreach ($lockedReturn->items as $returnItem) {
                    $saleItem = $returnItem->saleItem;

                    if (! $saleItem) {
                        throw ValidationException::withMessages([
                            'items' => [
                                'The original sale item '
                                . 'could not be resolved.',
                            ],
                        ]);
                    }

                    $otherReturned =
                        (float)
                        PharmacoSaleReturnItem::query()
                            ->where(
                                'pharmaco_sale_item_id',
                                $saleItem->id
                            )
                            ->where(
                                'id',
                                '!=',
                                $returnItem->id
                            )
                            ->whereHas(
                                'saleReturn',
                                fn ($query) =>
                                    $query->where(
                                        'status',
                                        'refunded'
                                    )
                            )
                            ->sum('quantity');

                    $policy->ensureQuantityAvailable(
                        (float) $saleItem->quantity,
                        $otherReturned,
                        (float) $returnItem->quantity
                    );

                    if (
                        $returnItem->disposition
                        !== 'restock'
                    ) {
                        continue;
                    }

                    if (! $returnItem->stock_batch_id) {
                        throw ValidationException::withMessages([
                            'items' => [
                                'Restocking requires the '
                                . 'original stock batch.',
                            ],
                        ]);
                    }

                    $batch = StockBatch::query()
                        ->where(
                            'tenant_id',
                            $tenant->id
                        )
                        ->lockForUpdate()
                        ->find(
                            $returnItem->stock_batch_id
                        );

                    if (! $batch) {
                        throw ValidationException::withMessages([
                            'items' => [
                                'The original stock batch '
                                . 'is unavailable.',
                            ],
                        ]);
                    }

                    $beforeQuantity =
                        (float) $batch->quantity_on_hand;

                    $afterQuantity = round(
                        $beforeQuantity
                        + (float) $returnItem->quantity,
                        3
                    );

                    $batch->quantity_on_hand =
                        $afterQuantity;

                    $batch->save();

                    $movement = new StockMovement();

                    $movement->fill([
                        'uuid' => (string) Str::uuid(),
                        'tenant_id' => $tenant->id,
                        'branch_id' =>
                            $lockedSale->branch_id,
                        'product_id' =>
                            $returnItem->product_id,
                        'stock_location_id' =>
                            $saleItem->stock_location_id,
                        'stock_batch_id' =>
                            $batch->id,
                        'movement_type' =>
                            'sale_return_restock',
                        'quantity' =>
                            (float)
                            $returnItem->quantity,
                        'running_balance' =>
                            $afterQuantity,
                        'reference_type' =>
                            PharmacoSaleReturn::class,
                        'reference_number' =>
                            $lockedReturn->return_number,
                        'reason' =>
                            'Stock restored from an '
                            . 'approved customer return.',
                        'performed_by' =>
                            $request->user()->id,
                        'occurred_at' => now(),
                        'metadata' => [
                            'sale_id' =>
                                $lockedSale->id,
                            'sale_number' =>
                                $lockedSale->sale_number,
                            'sale_item_id' =>
                                $saleItem->id,
                            'return_item_id' =>
                                $returnItem->id,
                            'disposition' =>
                                $returnItem->disposition,
                        ],
                    ]);

                    $movement->save();

                    $itemMetadata =
                        $returnItem->metadata ?? [];

                    $itemMetadata['stock_restoration'] = [
                        'stock_movement_id' =>
                            $movement->id,
                        'quantity_before' =>
                            $beforeQuantity,
                        'quantity_after' =>
                            $afterQuantity,
                        'restored_at' =>
                            now()->toIso8601String(),
                        'restored_by' =>
                            $request->user()->id,
                    ];

                    $returnItem->stock_restored = true;
                    $returnItem->metadata = $itemMetadata;
                    $returnItem->save();
                }

                $creditNoteNumber =
                    $this->nextCreditNoteNumber(
                        (int) $tenant->id
                    );

                $lockedReturn->fill([
                    'status' => 'refunded',
                    'approved_refund_amount' =>
                        $refundAmount,
                    'refund_method' => $refundMethod,
                    'refund_reference' =>
                        $validated['refund_reference']
                        ?? null,
                    'credit_note_number' =>
                        $creditNoteNumber,
                    'approved_by' =>
                        $request->user()->id,
                    'approved_at' => now(),
                    'refunded_at' => now(),
                    'notes' =>
                        $validated['notes']
                        ?? $lockedReturn->notes,
                ])->save();

                $cumulativeRefund =
                    (float)
                    PharmacoSaleReturn::query()
                        ->where(
                            'tenant_id',
                            $tenant->id
                        )
                        ->where(
                            'pharmaco_sale_id',
                            $lockedSale->id
                        )
                        ->where('status', 'refunded')
                        ->sum(
                            'approved_refund_amount'
                        );

                $totalSoldQuantity =
                    (float)
                    $lockedSale->items->sum('quantity');

                $totalReturnedQuantity =
                    (float)
                    PharmacoSaleReturnItem::query()
                        ->whereHas(
                            'saleReturn',
                            fn ($query) =>
                                $query
                                    ->where(
                                        'tenant_id',
                                        $tenant->id
                                    )
                                    ->where(
                                        'pharmaco_sale_id',
                                        $lockedSale->id
                                    )
                                    ->where(
                                        'status',
                                        'refunded'
                                    )
                        )
                        ->sum('quantity');

                $paidBefore =
                    (float) $lockedSale->paid_amount;

                $remainingPaid = max(
                    0,
                    round(
                        $paidBefore - $refundAmount,
                        2
                    )
                );

                $remainingNetTotal = max(
                    0,
                    round(
                        (float) $lockedSale->total_amount
                        - $cumulativeRefund,
                        2
                    )
                );

                $remainingBalance = max(
                    0,
                    round(
                        $remainingNetTotal
                        - $remainingPaid,
                        2
                    )
                );

                $saleMetadata =
                    $lockedSale->metadata ?? [];

                $saleMetadata['return_summary'] = [
                    'cumulative_refund_amount' =>
                        round($cumulativeRefund, 2),
                    'returned_quantity' =>
                        round(
                            $totalReturnedQuantity,
                            3
                        ),
                    'last_return_id' =>
                        $lockedReturn->id,
                    'last_return_number' =>
                        $lockedReturn->return_number,
                    'last_credit_note_number' =>
                        $creditNoteNumber,
                    'updated_at' =>
                        now()->toIso8601String(),
                ];

                $fullyReturned =
                    $totalSoldQuantity > 0
                    && abs(
                        $totalSoldQuantity
                        - $totalReturnedQuantity
                    ) <= 0.0005;

                $lockedSale->fill([
                    'status' =>
                        $fullyReturned
                            ? 'returned'
                            : 'dispensed',
                    'paid_amount' =>
                        $remainingPaid,
                    'balance_amount' =>
                        $remainingBalance,
                    'payment_status' =>
                        $policy
                            ->paymentStatusAfterRefund(
                                $paidBefore,
                                $remainingPaid,
                                $remainingBalance,
                                $cumulativeRefund
                            ),
                    'metadata' => $saleMetadata,
                ])->save();

                return $lockedReturn->fresh([
                    'branch',
                    'sale.customer',
                    'sale.payments',
                    'items.saleItem',
                    'items.product',
                    'items.stockBatch',
                ]);
            }
        );

        $scope = $scopeResolver->resolveForUser(
            $request->user()
        );

        $auditLogService->record(
            action: 'pharmaco.sale.return.refunded',
            scope: $scope,
            metadata: [
                'tenant_slug' => $tenant->slug,
                'return_id' => $saleReturn->id,
                'return_number' =>
                    $saleReturn->return_number,
                'sale_id' =>
                    $saleReturn->pharmaco_sale_id,
                'credit_note_number' =>
                    $saleReturn->credit_note_number,
                'refund_method' =>
                    $saleReturn->refund_method,
                'approved_refund_amount' =>
                    (float)
                    $saleReturn
                        ->approved_refund_amount,
            ],
            dataClassification: 'restricted',
            auditableType: PharmacoSaleReturn::class,
            auditableId: $saleReturn->id
        );

        return response()->json([
            'message' =>
                'Return approved, credit note issued, '
                . 'and refund recorded.',
            'return' => $this->serializeReturn(
                $saleReturn,
                true
            ),
        ]);
    }

    public function reject(
        Request $request,
        PharmacoSaleReturn $saleReturn,
        AuditLogService $auditLogService,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        $tenant = $request->attributes->get('tenant');

        $this->authorizeTenant(
            (int) $tenant->id,
            (int) $saleReturn->tenant_id
        );

        $validated = $request->validate([
            'reason' => [
                'required',
                'string',
                'min:10',
                'max:1000',
            ],
        ]);

        $saleReturn = DB::transaction(
            function () use (
                $tenant,
                $request,
                $saleReturn,
                $validated
            ) {
                $lockedReturn =
                    PharmacoSaleReturn::query()
                        ->lockForUpdate()
                        ->findOrFail($saleReturn->id);

                $this->authorizeTenant(
                    (int) $tenant->id,
                    (int) $lockedReturn->tenant_id
                );

                if ($lockedReturn->status !== 'pending') {
                    throw ValidationException::withMessages([
                        'return' => [
                            'Only a pending return '
                            . 'can be rejected.',
                        ],
                    ]);
                }

                $metadata =
                    $lockedReturn->metadata ?? [];

                $metadata['rejection'] = [
                    'reason' => $validated['reason'],
                    'rejected_by' =>
                        $request->user()->id,
                    'rejected_at' =>
                        now()->toIso8601String(),
                ];

                $lockedReturn->fill([
                    'status' => 'rejected',
                    'approved_by' =>
                        $request->user()->id,
                    'approved_at' => now(),
                    'metadata' => $metadata,
                ])->save();

                return $lockedReturn->fresh([
                    'branch',
                    'sale.customer',
                    'items.saleItem',
                    'items.stockBatch',
                ]);
            }
        );

        $scope = $scopeResolver->resolveForUser(
            $request->user()
        );

        $auditLogService->record(
            action: 'pharmaco.sale.return.rejected',
            scope: $scope,
            metadata: [
                'tenant_slug' => $tenant->slug,
                'return_id' => $saleReturn->id,
                'return_number' =>
                    $saleReturn->return_number,
                'sale_id' =>
                    $saleReturn->pharmaco_sale_id,
                'reason' => $validated['reason'],
            ],
            dataClassification: 'internal',
            auditableType: PharmacoSaleReturn::class,
            auditableId: $saleReturn->id
        );

        return response()->json([
            'message' => 'Sale return rejected.',
            'return' => $this->serializeReturn(
                $saleReturn,
                true
            ),
        ]);
    }

    public function reconcilePayment(
        Request $request,
        PharmacoPayment $payment,
        AuditLogService $auditLogService,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        $tenant = $request->attributes->get('tenant');

        $this->authorizeTenant(
            (int) $tenant->id,
            (int) $payment->tenant_id
        );

        $validated = $request->validate([
            'reconciliation_status' => [
                'required',
                'in:pending,matched,exception,reversed',
            ],
            'settled_amount' => [
                'required',
                'numeric',
                'gte:0',
            ],
            'provider_reference' => [
                'nullable',
                'string',
                'max:191',
            ],
            'notes' => [
                'nullable',
                'string',
                'max:1000',
            ],
        ]);

        $expectedAmount = round(
            (float) $payment->amount,
            2
        );

        $settledAmount = round(
            (float) $validated['settled_amount'],
            2
        );

        $varianceAmount = round(
            $settledAmount - $expectedAmount,
            2
        );

        if (
            $validated['reconciliation_status']
                === 'matched'
            && abs($varianceAmount) > 0.005
        ) {
            throw ValidationException::withMessages([
                'settled_amount' => [
                    'A matched payment must have '
                    . 'zero settlement variance.',
                ],
            ]);
        }

        $reconciliation = DB::transaction(
            function () use (
                $tenant,
                $request,
                $payment,
                $validated,
                $expectedAmount,
                $settledAmount,
                $varianceAmount
            ) {
                $lockedPayment =
                    PharmacoPayment::query()
                        ->lockForUpdate()
                        ->findOrFail($payment->id);

                $this->authorizeTenant(
                    (int) $tenant->id,
                    (int) $lockedPayment->tenant_id
                );

                $reconciliation =
                    PharmacoPaymentReconciliation::query()
                        ->where(
                            'tenant_id',
                            $tenant->id
                        )
                        ->where(
                            'pharmaco_payment_id',
                            $lockedPayment->id
                        )
                        ->lockForUpdate()
                        ->first();

                if (! $reconciliation) {
                    $reconciliation =
                        new PharmacoPaymentReconciliation([
                            'uuid' =>
                                (string) Str::uuid(),
                            'tenant_id' =>
                                $tenant->id,
                            'pharmaco_payment_id' =>
                                $lockedPayment->id,
                        ]);
                }

                $reconciliation->fill([
                    'reconciliation_status' =>
                        $validated[
                            'reconciliation_status'
                        ],
                    'expected_amount' =>
                        $expectedAmount,
                    'settled_amount' =>
                        $settledAmount,
                    'variance_amount' =>
                        $varianceAmount,
                    'provider_reference' =>
                        $validated[
                            'provider_reference'
                        ] ?? null,
                    'reconciled_by' =>
                        $request->user()->id,
                    'reconciled_at' => now(),
                    'notes' =>
                        $validated['notes'] ?? null,
                    'metadata' => [
                        'payment_method' =>
                            $lockedPayment
                                ->payment_method,
                        'payment_reference' =>
                            $lockedPayment
                                ->reference_number,
                        'receipt_number' =>
                            $lockedPayment
                                ->receipt_number,
                    ],
                ]);

                $reconciliation->save();

                return $reconciliation->fresh([
                    'payment.sale',
                ]);
            }
        );

        $scope = $scopeResolver->resolveForUser(
            $request->user()
        );

        $auditLogService->record(
            action:
                'pharmaco.payment.reconciled',
            scope: $scope,
            metadata: [
                'tenant_slug' => $tenant->slug,
                'payment_id' => $payment->id,
                'reconciliation_id' =>
                    $reconciliation->id,
                'status' =>
                    $reconciliation
                        ->reconciliation_status,
                'variance_amount' =>
                    (float)
                    $reconciliation
                        ->variance_amount,
            ],
            dataClassification: 'restricted',
            auditableType:
                PharmacoPaymentReconciliation::class,
            auditableId: $reconciliation->id
        );

        return response()->json([
            'message' =>
                'Payment reconciliation saved.',
            'reconciliation' =>
                $this->serializeReconciliation(
                    $reconciliation
                ),
        ]);
    }

    private function serializeReturn(
        PharmacoSaleReturn $saleReturn,
        bool $includeDetails = false
    ): array {
        $payload = [
            'id' => $saleReturn->id,
            'uuid' => $saleReturn->uuid,
            'return_number' =>
                $saleReturn->return_number,
            'status' => $saleReturn->status,
            'reason' => $saleReturn->reason,
            'requested_refund_amount' =>
                (float)
                $saleReturn
                    ->requested_refund_amount,
            'approved_refund_amount' =>
                $saleReturn
                    ->approved_refund_amount !== null
                    ? (float)
                        $saleReturn
                            ->approved_refund_amount
                    : null,
            'refund_method' =>
                $saleReturn->refund_method,
            'refund_reference' =>
                $saleReturn->refund_reference,
            'credit_note_number' =>
                $saleReturn->credit_note_number,
            'requested_at' =>
                optional(
                    $saleReturn->requested_at
                )->toIso8601String(),
            'approved_at' =>
                optional(
                    $saleReturn->approved_at
                )->toIso8601String(),
            'refunded_at' =>
                optional(
                    $saleReturn->refunded_at
                )->toIso8601String(),
            'notes' => $saleReturn->notes,
            'metadata' =>
                $saleReturn->metadata ?? [],
            'branch' =>
                $saleReturn->relationLoaded('branch')
                && $saleReturn->branch
                    ? [
                        'id' =>
                            $saleReturn->branch->id,
                        'name' =>
                            $saleReturn->branch->name,
                    ]
                    : null,
            'sale' =>
                $saleReturn->relationLoaded('sale')
                && $saleReturn->sale
                    ? [
                        'id' =>
                            $saleReturn->sale->id,
                        'sale_number' =>
                            $saleReturn
                                ->sale
                                ->sale_number,
                        'status' =>
                            $saleReturn->sale->status,
                        'payment_status' =>
                            $saleReturn
                                ->sale
                                ->payment_status,
                        'total_amount' =>
                            (float)
                            $saleReturn
                                ->sale
                                ->total_amount,
                        'paid_amount' =>
                            (float)
                            $saleReturn
                                ->sale
                                ->paid_amount,
                    ]
                    : null,
        ];

        if ($includeDetails) {
            $payload['items'] =
                $saleReturn->relationLoaded('items')
                    ? $saleReturn->items
                        ->map(
                            fn (
                                PharmacoSaleReturnItem
                                $item
                            ) => [
                                'id' => $item->id,
                                'sale_item_id' =>
                                    $item
                                        ->pharmaco_sale_item_id,
                                'product_id' =>
                                    $item->product_id,
                                'stock_batch_id' =>
                                    $item->stock_batch_id,
                                'quantity' =>
                                    (float)
                                    $item->quantity,
                                'unit_price' =>
                                    (float)
                                    $item->unit_price,
                                'line_refund_amount' =>
                                    (float)
                                    $item
                                        ->line_refund_amount,
                                'disposition' =>
                                    $item->disposition,
                                'reason' =>
                                    $item->reason,
                                'stock_restored' =>
                                    (bool)
                                    $item->stock_restored,
                                'product_name' =>
                                    $item->saleItem
                                        ?->product_name_snapshot,
                                'sku' =>
                                    $item->saleItem
                                        ?->sku_snapshot,
                                'batch_number' =>
                                    $item->stockBatch
                                        ?->batch_number,
                                'metadata' =>
                                    $item->metadata ?? [],
                            ]
                        )
                        ->values()
                    : [];
        }

        return $payload;
    }

    private function serializeReconciliation(
        PharmacoPaymentReconciliation
        $reconciliation
    ): array {
        return [
            'id' => $reconciliation->id,
            'uuid' => $reconciliation->uuid,
            'payment_id' =>
                $reconciliation
                    ->pharmaco_payment_id,
            'reconciliation_status' =>
                $reconciliation
                    ->reconciliation_status,
            'expected_amount' =>
                (float)
                $reconciliation->expected_amount,
            'settled_amount' =>
                (float)
                $reconciliation->settled_amount,
            'variance_amount' =>
                (float)
                $reconciliation->variance_amount,
            'provider_reference' =>
                $reconciliation
                    ->provider_reference,
            'reconciled_at' =>
                optional(
                    $reconciliation->reconciled_at
                )->toIso8601String(),
            'notes' => $reconciliation->notes,
            'metadata' =>
                $reconciliation->metadata ?? [],
        ];
    }

    private function nextReturnNumber(
        int $tenantId
    ): string {
        return sprintf(
            'RET-%s-T%d-%s',
            now()->format('Ymd'),
            $tenantId,
            Str::upper(Str::random(8))
        );
    }

    private function nextCreditNoteNumber(
        int $tenantId
    ): string {
        return sprintf(
            'CRN-%s-T%d-%s',
            now()->format('Ymd'),
            $tenantId,
            Str::upper(Str::random(8))
        );
    }

    private function authorizeTenant(
        int $expectedTenantId,
        int $actualTenantId
    ): void {
        if ($expectedTenantId !== $actualTenantId) {
            abort(404);
        }
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
