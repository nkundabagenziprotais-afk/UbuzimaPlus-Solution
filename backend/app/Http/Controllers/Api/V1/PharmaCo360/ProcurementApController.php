<?php

namespace App\Http\Controllers\Api\V1\PharmaCo360;

use App\Http\Controllers\Controller;
use App\Services\Finance\ProcurementApLifecycleService;
use App\Services\Finance\ProcurementApReadModelService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

final class ProcurementApController extends Controller
{
    public const RELEASE =
        'AQUILA_FINANCE_F4_R5_R2_R1_COMMERCIAL_AP_API';

    public function __construct(
        private readonly ProcurementApLifecycleService $lifecycle,
        private readonly ProcurementApReadModelService $readModel,
    ) {
    }

    public function overview(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId($request);
        $branchId = $this->optionalBranchId($request, $tenantId);

        $aging = $this->readModel->aging(
            $tenantId,
            $branchId,
            null,
            $request->query('as_of')
        );

        $overdue = round(
            (float) $aging['buckets']['1_30']
            + (float) $aging['buckets']['31_60']
            + (float) $aging['buckets']['61_90']
            + (float) $aging['buckets']['over_90'],
            2
        );

        $advances = DB::table('pharmaco_supplier_advances')
            ->where('tenant_id', $tenantId)
            ->where('accounting_status', 'posted');

        $credits = DB::table('pharmaco_supplier_credit_notes')
            ->where('tenant_id', $tenantId)
            ->where('accounting_status', 'posted');

        if ($branchId) {
            $advances->where('branch_id', $branchId);
            $credits->where('branch_id', $branchId);
        }

        return response()->json([
            'data' => [
                'as_of' => $aging['as_of'],
                'open_bill_count' => $aging['invoice_count'],
                'open_payable' => $aging['total_outstanding'],
                'overdue_payable' => $overdue,
                'available_advances' => round(
                    (float) $advances->sum('balance_amount'),
                    2
                ),
                'unapplied_credits' => round(
                    (float) $credits->sum('balance_amount'),
                    2
                ),
                'active_supplier_count' => DB::table('pharmaco_suppliers')
                    ->where('tenant_id', $tenantId)
                    ->where('status', 'active')
                    ->count(),
                'aging' => $aging['buckets'],
                'release' => self::RELEASE,
            ],
        ]);
    }

    public function referenceData(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId($request);

        $branches = DB::table('branches')
            ->where('tenant_id', $tenantId)
            ->orderBy('name')
            ->get([
                'id',
                'name',
            ]);

        $suppliers = DB::table('pharmaco_suppliers')
            ->where('tenant_id', $tenantId)
            ->where('status', 'active')
            ->orderBy('name')
            ->get([
                'id',
                'supplier_code',
                'name',
                'payment_terms',
                'status',
            ]);

        $invoices = DB::table('pharmaco_supplier_invoices')
            ->where('tenant_id', $tenantId)
            ->where('accounting_status', 'posted')
            ->where('balance_amount', '>', 0)
            ->orderBy('due_date')
            ->get([
                'id',
                'branch_id',
                'pharmaco_supplier_id',
                'invoice_number',
                'supplier_invoice_number',
                'invoice_date',
                'due_date',
                'total_amount',
                'balance_amount',
                'currency_code',
                'status',
            ]);

        return response()->json([
            'data' => [
                'branches' => $branches,
                'suppliers' => $suppliers,
                'open_supplier_bills' => $invoices,

                'payment_methods' => [
                    'cash',
                    'momo',
                    'card',
                    'bank_transfer',
                    'cheque',
                ],

                'credit_reason_codes' => [
                    'price_adjustment',
                    'tax_adjustment',
                    'rebate',
                    'discount',
                    'short_delivery',
                    'damaged_goods',
                    'stock_return',
                    'other',
                ],
            ],
        ]);
    }

    public function aging(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId($request);

        $branchId = $this->optionalBranchId(
            $request,
            $tenantId
        );

        $supplierId = $request->query('supplier_id')
            ? (int) $request->query('supplier_id')
            : null;

        if ($supplierId) {
            $this->assertSupplierTenant(
                $supplierId,
                $tenantId
            );
        }

        return response()->json([
            'data' => $this->readModel->aging(
                $tenantId,
                $branchId,
                $supplierId,
                $request->query('as_of')
            ),
        ]);
    }

    public function supplierStatement(
        Request $request,
        int $supplier,
    ): JsonResponse {
        $tenantId = $this->tenantId($request);

        $this->assertSupplierTenant(
            $supplier,
            $tenantId
        );

        return response()->json([
            'data' => $this->readModel->supplierStatement(
                $tenantId,
                $supplier,
                $this->optionalBranchId(
                    $request,
                    $tenantId
                )
            ),
        ]);
    }

    public function credits(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId($request);

        $query = DB::table('pharmaco_supplier_credit_notes as c')
            ->join(
                'pharmaco_suppliers as s',
                's.id',
                '=',
                'c.pharmaco_supplier_id'
            )
            ->leftJoin(
                'pharmaco_supplier_invoices as i',
                'i.id',
                '=',
                'c.pharmaco_supplier_invoice_id'
            )
            ->where('c.tenant_id', $tenantId);

        if ($request->query('branch_id')) {
            $query->where(
                'c.branch_id',
                $this->branchId(
                    (int) $request->query('branch_id'),
                    $tenantId
                )
            );
        }

        if ($request->query('supplier_id')) {
            $supplierId = (int) $request->query('supplier_id');

            $this->assertSupplierTenant(
                $supplierId,
                $tenantId
            );

            $query->where(
                'c.pharmaco_supplier_id',
                $supplierId
            );
        }

        if ($request->query('status')) {
            $query->where(
                'c.status',
                (string) $request->query('status')
            );
        }

        return response()->json([
            'data' => $query
                ->orderByDesc('c.credit_date')
                ->orderByDesc('c.id')
                ->limit(100)
                ->get([
                    'c.id',
                    'c.uuid',
                    'c.branch_id',
                    'c.pharmaco_supplier_id',
                    's.supplier_code',
                    's.name as supplier_name',
                    'c.pharmaco_supplier_invoice_id',
                    'i.invoice_number',
                    'c.credit_number',
                    'c.supplier_credit_number',
                    'c.status',
                    'c.credit_date',
                    'c.reason_code',
                    'c.subtotal_amount',
                    'c.tax_amount',
                    'c.total_amount',
                    'c.applied_amount',
                    'c.balance_amount',
                    'c.currency_code',
                    'c.accounting_status',
                    'c.finance_journal_entry_id',
                    'c.notes',
                    'c.created_at',
                ]),
        ]);
    }

    public function createCredit(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId($request);

        $validated = $request->validate([
            'branch_id' => [
                'required',
                'integer',
            ],

            'supplier_id' => [
                'required',
                'integer',
            ],

            'supplier_invoice_id' => [
                'nullable',
                'integer',
            ],

            'supplier_credit_number' => [
                'nullable',
                'string',
                'max:100',
            ],

            'credit_date' => [
                'required',
                'date',
            ],

            'reason_code' => [
                'required',
                'string',
                'max:50',
            ],

            'notes' => [
                'nullable',
                'string',
                'max:2000',
            ],

            'items' => [
                'required',
                'array',
                'min:1',
                'max:100',
            ],

            'items.*.description' => [
                'required',
                'string',
                'max:255',
            ],

            'items.*.quantity' => [
                'required',
                'numeric',
                'gt:0',
            ],

            'items.*.unit_cost' => [
                'required',
                'numeric',
                'gte:0',
            ],

            'items.*.tax_amount' => [
                'nullable',
                'numeric',
                'gte:0',
            ],

            'items.*.product_id' => [
                'nullable',
                'integer',
            ],

            'items.*.supplier_invoice_item_id' => [
                'nullable',
                'integer',
            ],

            'items.*.goods_receipt_item_id' => [
                'nullable',
                'integer',
            ],

            'items.*.stock_return_required' => [
                'nullable',
                'boolean',
            ],
        ]);

        $branchId = $this->branchId(
            (int) $validated['branch_id'],
            $tenantId
        );

        $supplierId = (int) $validated['supplier_id'];

        $this->assertSupplierTenant(
            $supplierId,
            $tenantId
        );

        $invoice = null;

        if (! empty($validated['supplier_invoice_id'])) {
            $invoice = DB::table('pharmaco_supplier_invoices')
                ->where(
                    'id',
                    $validated['supplier_invoice_id']
                )
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->first();

            if (! $invoice) {
                throw ValidationException::withMessages([
                    'supplier_invoice_id' => [
                        'Supplier Bill was not found in this tenant.',
                    ],
                ]);
            }

            if (
                (int) $invoice->pharmaco_supplier_id !== $supplierId
                ||
                (int) $invoice->branch_id !== $branchId
            ) {
                throw ValidationException::withMessages([
                    'supplier_invoice_id' => [
                        'Supplier Bill must belong to the selected supplier and branch.',
                    ],
                ]);
            }
        }

        $creditId = DB::transaction(
            function () use (
                $validated,
                $tenantId,
                $branchId,
                $supplierId,
                $invoice,
                $request,
            ): int {
                $subtotal = 0.0;
                $tax = 0.0;

                foreach ($validated['items'] as $item) {
                    $lineSubtotal = round(
                        (float) $item['quantity']
                        *
                        (float) $item['unit_cost'],
                        2
                    );

                    $lineTax = round(
                        (float) ($item['tax_amount'] ?? 0),
                        2
                    );

                    $subtotal += $lineSubtotal;
                    $tax += $lineTax;
                }

                $subtotal = round($subtotal, 2);
                $tax = round($tax, 2);
                $total = round($subtotal + $tax, 2);

                if ($total <= 0) {
                    throw ValidationException::withMessages([
                        'items' => [
                            'Supplier Credit total must be greater than zero.',
                        ],
                    ]);
                }

                $creditNumber =
                    'SCN-'
                    .
                    now()->format('Ymd-His')
                    .
                    '-'
                    .
                    strtoupper(Str::random(6));

                $timestamp = now()->toDateTimeString();

                $creditId = (int)
                    DB::table('pharmaco_supplier_credit_notes')
                        ->insertGetId([
                            'uuid' => (string) Str::uuid(),
                            'tenant_id' => $tenantId,
                            'branch_id' => $branchId,
                            'pharmaco_supplier_id' => $supplierId,

                            'pharmaco_supplier_invoice_id' =>
                                $invoice
                                    ? (int) $invoice->id
                                    : null,

                            'pharmaco_purchase_order_id' =>
                                $invoice
                                    ? $invoice->pharmaco_purchase_order_id
                                    : null,

                            'credit_number' => $creditNumber,

                            'supplier_credit_number' =>
                                $validated['supplier_credit_number']
                                ?? null,

                            'status' => 'draft',

                            'credit_date' =>
                                $validated['credit_date'],

                            'reason_code' =>
                                $validated['reason_code'],

                            'subtotal_amount' => $subtotal,
                            'tax_amount' => $tax,
                            'total_amount' => $total,

                            'applied_amount' => 0,
                            'balance_amount' => $total,

                            'currency_code' =>
                                $invoice
                                    ? (
                                        $invoice->currency_code
                                        ?: 'RWF'
                                    )
                                    : 'RWF',

                            'exchange_rate' =>
                                $invoice
                                    ? (
                                        $invoice->exchange_rate
                                        ?: 1
                                    )
                                    : 1,

                            'accounting_status' => 'unposted',

                            'approved_by' => null,
                            'approved_at' => null,

                            'finance_journal_entry_id' => null,
                            'finance_posted_at' => null,

                            'idempotency_key' => null,

                            'notes' =>
                                $validated['notes']
                                ?? null,

                            'metadata' => json_encode(
                                [
                                    'release' => self::RELEASE,
                                    'created_by' => $request->user()?->id,
                                    'created_via' =>
                                        'commercial_ap_workspace',
                                ],
                                JSON_UNESCAPED_SLASHES
                            ),

                            'created_at' => $timestamp,
                            'updated_at' => $timestamp,
                        ]);

                foreach ($validated['items'] as $item) {
                    $lineSubtotal = round(
                        (float) $item['quantity']
                        *
                        (float) $item['unit_cost'],
                        2
                    );

                    $lineTax = round(
                        (float) ($item['tax_amount'] ?? 0),
                        2
                    );

                    DB::table(
                        'pharmaco_supplier_credit_note_items'
                    )->insert([
                        'uuid' => (string) Str::uuid(),
                        'tenant_id' => $tenantId,
                        'branch_id' => $branchId,

                        'pharmaco_supplier_credit_note_id' =>
                            $creditId,

                        'pharmaco_supplier_invoice_item_id' =>
                            $item['supplier_invoice_item_id']
                            ?? null,

                        'pharmaco_goods_receipt_item_id' =>
                            $item['goods_receipt_item_id']
                            ?? null,

                        'product_id' =>
                            $item['product_id']
                            ?? null,

                        'description' =>
                            $item['description'],

                        'quantity' => round(
                            (float) $item['quantity'],
                            3
                        ),

                        'unit_cost' => round(
                            (float) $item['unit_cost'],
                            4
                        ),

                        'tax_amount' => $lineTax,

                        'line_total' => round(
                            $lineSubtotal + $lineTax,
                            2
                        ),

                        'stock_return_required' =>
                            ! empty(
                                $item['stock_return_required']
                            )
                                ? 1
                                : 0,

                        'metadata' => json_encode(
                            [
                                'release' => self::RELEASE,
                            ],
                            JSON_UNESCAPED_SLASHES
                        ),

                        'created_at' => $timestamp,
                        'updated_at' => $timestamp,
                    ]);
                }

                return $creditId;
            }
        );

        return response()->json([
            'message' =>
                'Supplier Credit draft created.',

            'data' =>
                $this->creditRecord(
                    $creditId,
                    $tenantId
                ),
        ], 201);
    }

    public function approveCredit(
        Request $request,
        int $credit,
    ): JsonResponse {
        $tenantId = $this->tenantId($request);
        $actorId = $request->user()?->id;

        $journal = DB::transaction(
            function () use (
                $credit,
                $tenantId,
                $actorId,
            ) {
                $record =
                    DB::table('pharmaco_supplier_credit_notes')
                        ->where('id', $credit)
                        ->where('tenant_id', $tenantId)
                        ->lockForUpdate()
                        ->first();

                if (! $record) {
                    throw ValidationException::withMessages([
                        'supplier_credit' => [
                            'Supplier Credit was not found.',
                        ],
                    ]);
                }

                $metadata = json_decode(
                    (string) ($record->metadata ?: '{}'),
                    true
                );

                $maker = is_array($metadata)
                    ? ($metadata['created_by'] ?? null)
                    : null;

                if (
                    (
$actorId
                    &&
                    $maker
                    &&
                    (int) $maker === (int) $actorId
                    )
                    && ! \App\Support\MakerCheckerExemptionPolicy::allows(
                                    (int) (auth()->id() ?? 0),
                                    isset($tenantId)
                                        ? (int) $tenantId
                                        : null,
                                    isset($branchId)
                                        ? (int) $branchId
                                        : null
                                )
                ) {
                    throw ValidationException::withMessages([
                        'approval' => [
                            'Maker-checker control: the user who created this Supplier Credit cannot approve it.',
                        ],
                    ]);
                }

                DB::table('pharmaco_supplier_credit_notes')
                    ->where('id', $credit)
                    ->update([
                        'status' => 'approved',
                        'approved_by' => $actorId,
                        'approved_at' => now()->toDateTimeString(),
                        'updated_at' => now()->toDateTimeString(),
                    ]);

                return $this->lifecycle->approveSupplierCredit(
                    $credit,
                    $actorId
                );
            }
        );

        return response()->json([
            'message' =>
                'Supplier Credit approved and posted to Finance.',

            'data' => [
                'credit' =>
                    $this->creditRecord(
                        $credit,
                        $tenantId
                    ),

                'finance_journal_entry_id' =>
                    (int) $journal->id,
            ],
        ]);
    }

    public function advances(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId($request);

        $query = DB::table('pharmaco_supplier_advances as a')
            ->join(
                'pharmaco_suppliers as s',
                's.id',
                '=',
                'a.pharmaco_supplier_id'
            )
            ->where('a.tenant_id', $tenantId);

        if ($request->query('branch_id')) {
            $query->where(
                'a.branch_id',
                $this->branchId(
                    (int) $request->query('branch_id'),
                    $tenantId
                )
            );
        }

        if ($request->query('supplier_id')) {
            $supplierId =
                (int) $request->query('supplier_id');

            $this->assertSupplierTenant(
                $supplierId,
                $tenantId
            );

            $query->where(
                'a.pharmaco_supplier_id',
                $supplierId
            );
        }

        return response()->json([
            'data' => $query
                ->orderByDesc('a.advance_date')
                ->orderByDesc('a.id')
                ->limit(100)
                ->get([
                    'a.id',
                    'a.uuid',
                    'a.branch_id',
                    'a.pharmaco_supplier_id',
                    's.supplier_code',
                    's.name as supplier_name',
                    'a.advance_number',
                    'a.status',
                    'a.advance_date',
                    'a.amount',
                    'a.applied_amount',
                    'a.balance_amount',
                    'a.payment_method',
                    'a.reference_number',
                    'a.currency_code',
                    'a.accounting_status',
                    'a.finance_journal_entry_id',
                    'a.recorded_by',
                    'a.approved_by',
                    'a.approved_at',
                    'a.created_at',
                ]),
        ]);
    }

    public function createAdvance(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId($request);

        $validated = $request->validate([
            'branch_id' => [
                'required',
                'integer',
            ],

            'supplier_id' => [
                'required',
                'integer',
            ],

            'advance_date' => [
                'required',
                'date',
            ],

            'amount' => [
                'required',
                'numeric',
                'gt:0',
            ],

            'payment_method' => [
                'required',
                'in:cash,momo,card,bank_transfer,cheque',
            ],

            'reference_number' => [
                'nullable',
                'string',
                'max:100',
            ],

            'notes' => [
                'nullable',
                'string',
                'max:2000',
            ],
        ]);

        $branchId = $this->branchId(
            (int) $validated['branch_id'],
            $tenantId
        );

        $supplierId =
            (int) $validated['supplier_id'];

        $this->assertSupplierTenant(
            $supplierId,
            $tenantId
        );

        $advanceId =
            (int)
            DB::table('pharmaco_supplier_advances')
                ->insertGetId([
                    'uuid' => (string) Str::uuid(),

                    'tenant_id' => $tenantId,
                    'branch_id' => $branchId,

                    'pharmaco_supplier_id' =>
                        $supplierId,

                    'advance_number' =>
                        'ADV-'
                        .
                        now()->format('Ymd-His')
                        .
                        '-'
                        .
                        strtoupper(Str::random(6)),

                    'status' => 'draft',

                    'advance_date' =>
                        $validated['advance_date'],

                    'amount' => round(
                        (float) $validated['amount'],
                        2
                    ),

                    'applied_amount' => 0,
                    'balance_amount' => 0,

                    'payment_method' =>
                        $validated['payment_method'],

                    'reference_number' =>
                        $validated['reference_number']
                        ?? null,

                    'currency_code' => 'RWF',
                    'exchange_rate' => 1,

                    'accounting_status' => 'unposted',

                    'recorded_by' =>
                        $request->user()?->id,

                    'approved_by' => null,
                    'approved_at' => null,

                    'finance_journal_entry_id' => null,
                    'finance_posted_at' => null,

                    'idempotency_key' => null,

                    'notes' =>
                        $validated['notes']
                        ?? null,

                    'metadata' => json_encode(
                        [
                            'release' => self::RELEASE,
                            'created_via' =>
                                'commercial_ap_workspace',
                        ],
                        JSON_UNESCAPED_SLASHES
                    ),

                    'created_at' =>
                        now()->toDateTimeString(),

                    'updated_at' =>
                        now()->toDateTimeString(),
                ]);

        return response()->json([
            'message' =>
                'Supplier Advance draft created.',

            'data' =>
                $this->advanceRecord(
                    $advanceId,
                    $tenantId
                ),
        ], 201);
    }

    public function approveAdvance(
        Request $request,
        int $advance,
    ): JsonResponse {
        $tenantId = $this->tenantId($request);
        $actorId = $request->user()?->id;

        $journal = DB::transaction(
            function () use (
                $advance,
                $tenantId,
                $actorId,
            ) {
                $record =
                    DB::table('pharmaco_supplier_advances')
                        ->where('id', $advance)
                        ->where('tenant_id', $tenantId)
                        ->lockForUpdate()
                        ->first();

                if (! $record) {
                    throw ValidationException::withMessages([
                        'supplier_advance' => [
                            'Supplier Advance was not found.',
                        ],
                    ]);
                }

                if (
                    (
$actorId
                    &&
                    $record->recorded_by
                    &&
                    (int) $record->recorded_by
                    ===
                    (int) $actorId
                    )
                    && ! \App\Support\MakerCheckerExemptionPolicy::allows(
                                    (int) (auth()->id() ?? 0),
                                    isset($tenantId)
                                        ? (int) $tenantId
                                        : null,
                                    isset($branchId)
                                        ? (int) $branchId
                                        : null
                                )
                ) {
                    throw ValidationException::withMessages([
                        'approval' => [
                            'Maker-checker control: the user who recorded this Supplier Advance cannot approve it.',
                        ],
                    ]);
                }

                DB::table('pharmaco_supplier_advances')
                    ->where('id', $advance)
                    ->update([
                        'status' => 'approved',
                        'approved_by' => $actorId,
                        'approved_at' => now()->toDateTimeString(),
                        'updated_at' => now()->toDateTimeString(),
                    ]);

                return $this->lifecycle->approveSupplierAdvance(
                    $advance,
                    $actorId
                );
            }
        );

        return response()->json([
            'message' =>
                'Supplier Advance approved and posted to Finance.',

            'data' => [
                'advance' =>
                    $this->advanceRecord(
                        $advance,
                        $tenantId
                    ),

                'finance_journal_entry_id' =>
                    (int) $journal->id,
            ],
        ]);
    }

    public function applyAdvance(
        Request $request,
        int $advance,
    ): JsonResponse {
        $tenantId =
            $this->tenantId(
                $request
            );

        $validated =
            $request->validate([
                'supplier_invoice_id' => [
                    'required',
                    'integer',
                ],

                'amount' => [
                    'required',
                    'numeric',
                    'gt:0',
                ],
            ]);

        $record =
            DB::table('pharmaco_supplier_advances')
                ->where('id', $advance)
                ->where('tenant_id', $tenantId)
                ->first();

        if (! $record) {
            throw ValidationException::withMessages([
                'supplier_advance' => [
                    'Supplier Advance was not found.',
                ],
            ]);
        }

        $invoice =
            DB::table('pharmaco_supplier_invoices')
                ->where(
                    'id',
                    $validated['supplier_invoice_id']
                )
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->first();

        if (! $invoice) {
            throw ValidationException::withMessages([
                'supplier_invoice_id' => [
                    'Supplier Bill was not found.',
                ],
            ]);
        }

        $idempotencyKey = trim(
            (string)
            $request->header(
                'Idempotency-Key',
                ''
            )
        );

        if ($idempotencyKey === '') {
            $idempotencyKey =
                'ap-advance-application-'
                .
                $advance
                .
                '-'
                .
                $invoice->id
                .
                '-'
                .
                number_format(
                    (float) $validated['amount'],
                    2,
                    '.',
                    ''
                );
        }

        $journal =
            $this->lifecycle->applySupplierAdvance(
                $advance,
                (int) $invoice->id,
                (float) $validated['amount'],
                $request->user()?->id,
                $idempotencyKey
            );

        return response()->json([
            'message' =>
                'Supplier Advance applied to Supplier Bill.',

            'data' => [
                'advance' =>
                    $this->advanceRecord(
                        $advance,
                        $tenantId
                    ),

                'supplier_invoice_id' =>
                    (int) $invoice->id,

                'finance_journal_entry_id' =>
                    (int) $journal->id,
            ],
        ]);
    }

    private function tenantId(Request $request): int
    {
        $attributeTenant = (int) (
            $request->attributes->get('tenant_id')
            ?? 0
        );

        $userTenant = (int) (
            $request->user()?->tenant_id
            ?? 0
        );

        $headerTenant = (int)
            $request->header(
                'X-Tenant-Id',
                0
            );

        if (
            $userTenant > 0
            &&
            $headerTenant > 0
            &&
            $userTenant !== $headerTenant
        ) {
            abort(
                403,
                'Tenant header does not match the authenticated user.'
            );
        }

        $tenantId =
            $attributeTenant > 0
                ? $attributeTenant
                : (
                    $userTenant > 0
                        ? $userTenant
                        : $headerTenant
                );

        if ($tenantId <= 0) {
            abort(
                403,
                'Tenant context is required.'
            );
        }

        return $tenantId;
    }

    private function optionalBranchId(
        Request $request,
        int $tenantId,
    ): ?int {
        $value =
            $request->query('branch_id');

        if (
            $value === null
            ||
            $value === ''
        ) {
            return null;
        }

        return $this->branchId(
            (int) $value,
            $tenantId
        );
    }

    private function branchId(
        int $branchId,
        int $tenantId,
    ): int {
        $exists =
            DB::table('branches')
                ->where('id', $branchId)
                ->where('tenant_id', $tenantId)
                ->exists();

        if (! $exists) {
            throw ValidationException::withMessages([
                'branch_id' => [
                    'Branch was not found in this tenant.',
                ],
            ]);
        }

        return $branchId;
    }

    private function assertSupplierTenant(
        int $supplierId,
        int $tenantId,
    ): void {
        $exists =
            DB::table('pharmaco_suppliers')
                ->where('id', $supplierId)
                ->where('tenant_id', $tenantId)
                ->exists();

        if (! $exists) {
            throw ValidationException::withMessages([
                'supplier_id' => [
                    'Supplier was not found in this tenant.',
                ],
            ]);
        }
    }

    private function creditRecord(
        int $creditId,
        int $tenantId,
    ): ?object {
        return DB::table('pharmaco_supplier_credit_notes as c')
            ->join(
                'pharmaco_suppliers as s',
                's.id',
                '=',
                'c.pharmaco_supplier_id'
            )
            ->leftJoin(
                'pharmaco_supplier_invoices as i',
                'i.id',
                '=',
                'c.pharmaco_supplier_invoice_id'
            )
            ->where('c.id', $creditId)
            ->where('c.tenant_id', $tenantId)
            ->first([
                'c.*',
                's.name as supplier_name',
                's.supplier_code',
                'i.invoice_number',
            ]);
    }

    private function advanceRecord(
        int $advanceId,
        int $tenantId,
    ): ?object {
        return DB::table('pharmaco_supplier_advances as a')
            ->join(
                'pharmaco_suppliers as s',
                's.id',
                '=',
                'a.pharmaco_supplier_id'
            )
            ->where('a.id', $advanceId)
            ->where('a.tenant_id', $tenantId)
            ->first([
                'a.*',
                's.name as supplier_name',
                's.supplier_code',
            ]);
    }
}
