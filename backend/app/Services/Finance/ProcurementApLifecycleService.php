<?php

namespace App\Services\Finance;

use App\Data\Finance\FinanceJournalLinePayload;
use App\Data\Finance\FinancePostingPayload;
use App\Models\FinanceJournalEntry;
use App\Models\FinancePostingLog;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

final class ProcurementApLifecycleService
{
    public const RELEASE =
        'AQUILA_FINANCE_F4_R5_R1_AP_LIFECYCLE';

    public function __construct(
        private readonly FinancePostingService $postingService,
    ) {
    }

    public function approveSupplierAdvance(
        int $advanceId,
        ?int $actorId = null,
    ): FinanceJournalEntry {
        return DB::transaction(
            function () use (
                $advanceId,
                $actorId,
            ): FinanceJournalEntry {
                $advance =
                    DB::table(
                        'pharmaco_supplier_advances'
                    )
                        ->where(
                            'id',
                            $advanceId
                        )
                        ->lockForUpdate()
                        ->first();

                if (! $advance) {
                    throw ValidationException::withMessages([
                        'supplier_advance' => [
                            'Supplier Advance was not found.',
                        ],
                    ]);
                }

                if (
                    strtolower(
                        (string)
                        $advance->accounting_status
                    ) === 'posted'
                    &&
                    $advance->finance_journal_entry_id
                ) {
                    return $this->existingJournal(
                        (int)
                        $advance->finance_journal_entry_id
                    );
                }

                if (
                    ! in_array(
                        strtolower(
                            (string) $advance->status
                        ),
                        [
                            'approved',
                            'recorded',
                        ],
                        true
                    )
                ) {
                    throw ValidationException::withMessages([
                        'status' => [
                            'Supplier Advance must be approved before Finance posting.',
                        ],
                    ]);
                }

                $tenantId =
                    (int) $advance->tenant_id;

                $branchId =
                    (int) $advance->branch_id;

                $supplierId =
                    (int)
                    $advance->pharmaco_supplier_id;

                $amount =
                    round(
                        (float) $advance->amount,
                        2
                    );

                if (
                    $branchId <= 0
                    ||
                    $supplierId <= 0
                    ||
                    $amount <= 0
                ) {
                    throw ValidationException::withMessages([
                        'supplier_advance' => [
                            'Supplier Advance branch, supplier and amount are required.',
                        ],
                    ]);
                }

                $method =
                    strtolower(
                        trim(
                            (string)
                            $advance->payment_method
                        )
                    );

                $settlementMethod =
                    $method === 'cheque'
                        ? 'bank_transfer'
                        : $method;

                $settlementMapping =
                    ProcurementAccountingContract
                        ::settlementMapping(
                            $settlementMethod
                        );

                $idempotencyKey =
                    trim(
                        (string)
                        (
                            $advance->idempotency_key
                            ?: ''
                        )
                    );

                if ($idempotencyKey === '') {
                    $idempotencyKey =
                        'procurement-supplier-advance-'
                        .
                        (string) $advance->uuid;
                }

                $journal =
                    $this->postedOrThrow(
                        $this
                            ->postingService
                            ->post(
                                new FinancePostingPayload(
                                    tenantId:
                                        $tenantId,

                                    branchId:
                                        $branchId,

                                    businessDate:
                                        substr(
                                            (string)
                                            $advance->advance_date,
                                            0,
                                            10
                                        ),

                                    sourceModule:
                                        'procurement',

                                    sourceType:
                                        'supplier_advance',

                                    sourceId:
                                        (string)
                                        $advanceId,

                                    idempotencyKey:
                                        $idempotencyKey,

                                    lines: [
                                        new FinanceJournalLinePayload(
                                            mappingKey:
                                                ProcurementAccountingContract::SUPPLIER_ADVANCE,

                                            debit:
                                                $amount,

                                            description:
                                                'Supplier Advance '
                                                .
                                                $advance->advance_number,

                                            lineType:
                                                'supplier_advance_asset',

                                            branchId:
                                                $branchId,

                                            supplierId:
                                                $supplierId,

                                            paymentMethod:
                                                $method
                                        ),

                                        new FinanceJournalLinePayload(
                                            mappingKey:
                                                $settlementMapping,

                                            credit:
                                                $amount,

                                            description:
                                                'Supplier Advance settlement via '
                                                .
                                                strtoupper(
                                                    $method
                                                ),

                                            lineType:
                                                'supplier_advance_settlement',

                                            branchId:
                                                $branchId,

                                            supplierId:
                                                $supplierId,

                                            paymentMethod:
                                                $method
                                        ),
                                    ],

                                    currencyCode:
                                        strtoupper(
                                            (string)
                                            (
                                                $advance->currency_code
                                                ?: 'RWF'
                                            )
                                        ),

                                    exchangeRate:
                                        (float)
                                        (
                                            $advance->exchange_rate
                                            ?: 1
                                        ),

                                    memo:
                                        'Supplier Advance '
                                        .
                                        $advance->advance_number,

                                    createdBy:
                                        $actorId,

                                    sourceSnapshot: [
                                        'supplier_advance_id' =>
                                            $advanceId,

                                        'supplier_id' =>
                                            $supplierId,

                                        'amount' =>
                                            $amount,

                                        'payment_method' =>
                                            $method,
                                    ],

                                    metadata: [
                                        'release' =>
                                            self::RELEASE,

                                        'accounting_event' =>
                                            'supplier_advance',
                                    ],

                                    mode:
                                        'live'
                                )
                            ),
                        'Supplier Advance'
                    );

                DB::table(
                    'pharmaco_supplier_advances'
                )
                    ->where(
                        'id',
                        $advanceId
                    )
                    ->update([
                        'status' =>
                            'approved',

                        'approved_by' =>
                            $actorId,

                        'approved_at' =>
                            now()->toDateTimeString(),

                        'balance_amount' =>
                            $amount,

                        'accounting_status' =>
                            'posted',

                        'finance_journal_entry_id' =>
                            $journal->id,

                        'finance_posted_at' =>
                            now()->toDateTimeString(),

                        'idempotency_key' =>
                            $idempotencyKey,

                        'updated_at' =>
                            now()->toDateTimeString(),
                    ]);

                return $journal;
            }
        );
    }

    public function applySupplierAdvance(
        int $advanceId,
        int $supplierInvoiceId,
        float $requestedAmount,
        ?int $actorId = null,
        ?string $idempotencyKey = null,
    ): FinanceJournalEntry {
        return DB::transaction(
            function () use (
                $advanceId,
                $supplierInvoiceId,
                $requestedAmount,
                $actorId,
                $idempotencyKey,
            ): FinanceJournalEntry {
                $advance =
                    DB::table(
                        'pharmaco_supplier_advances'
                    )
                        ->where(
                            'id',
                            $advanceId
                        )
                        ->lockForUpdate()
                        ->first();

                $invoice =
                    DB::table(
                        'pharmaco_supplier_invoices'
                    )
                        ->where(
                            'id',
                            $supplierInvoiceId
                        )
                        ->lockForUpdate()
                        ->first();

                if (! $advance || ! $invoice) {
                    throw ValidationException::withMessages([
                        'advance_application' => [
                            'Supplier Advance or Supplier Bill was not found.',
                        ],
                    ]);
                }

                if (
                    strtolower(
                        (string)
                        $advance->accounting_status
                    ) !== 'posted'
                    ||
                    ! $advance->finance_journal_entry_id
                ) {
                    throw ValidationException::withMessages([
                        'supplier_advance' => [
                            'Supplier Advance must be posted before application.',
                        ],
                    ]);
                }

                if (
                    strtolower(
                        (string)
                        $invoice->accounting_status
                    ) !== 'posted'
                    ||
                    ! $invoice->finance_journal_entry_id
                ) {
                    throw ValidationException::withMessages([
                        'supplier_invoice' => [
                            'Supplier Bill must be posted before applying an advance.',
                        ],
                    ]);
                }

                if (
                    (int)
                    $advance->tenant_id
                    !==
                    (int) $invoice->tenant_id
                    ||
                    (int)
                    $advance->branch_id
                    !==
                    (int) $invoice->branch_id
                    ||
                    (int)
                    $advance->pharmaco_supplier_id
                    !==
                    (int)
                    $invoice->pharmaco_supplier_id
                ) {
                    throw ValidationException::withMessages([
                        'lineage' => [
                            'Advance and Supplier Bill tenant, branch and supplier must match.',
                        ],
                    ]);
                }

                $amount =
                    round(
                        $requestedAmount,
                        2
                    );

                $advanceBalance =
                    round(
                        (float)
                        $advance->balance_amount,
                        2
                    );

                $invoiceBalance =
                    round(
                        (float)
                        $invoice->balance_amount,
                        2
                    );

                if (
                    $amount <= 0
                    ||
                    $amount > $advanceBalance
                    ||
                    $amount > $invoiceBalance
                ) {
                    throw ValidationException::withMessages([
                        'amount' => [
                            'Advance application exceeds the available advance or Supplier Bill balance.',
                        ],
                    ]);
                }

                $idempotencyKey =
                    trim(
                        (string) $idempotencyKey
                    );

                if ($idempotencyKey === '') {
                    $idempotencyKey =
                        'procurement-advance-application-'
                        .
                        $advanceId
                        .
                        '-'
                        .
                        $supplierInvoiceId
                        .
                        '-'
                        .
                        number_format(
                            $amount,
                            2,
                            '.',
                            ''
                        );
                }

                $existing =
                    DB::table(
                        'pharmaco_supplier_advance_applications'
                    )
                        ->where(
                            'idempotency_key',
                            $idempotencyKey
                        )
                        ->first();

                if ($existing) {
                    $journalId =
                        data_get(
                            json_decode(
                                (string)
                                (
                                    $existing->metadata
                                    ?: '{}'
                                ),
                                true
                            ),
                            'finance_journal_entry_id'
                        );

                    if ($journalId) {
                        return $this->existingJournal(
                            (int) $journalId
                        );
                    }

                    throw ValidationException::withMessages([
                        'idempotency_key' => [
                            'Existing advance application cannot be resolved to Finance.',
                        ],
                    ]);
                }

                $journal =
                    $this->postedOrThrow(
                        $this
                            ->postingService
                            ->post(
                                new FinancePostingPayload(
                                    tenantId:
                                        (int)
                                        $advance->tenant_id,

                                    branchId:
                                        (int)
                                        $advance->branch_id,

                                    businessDate:
                                        now()->toDateString(),

                                    sourceModule:
                                        'procurement',

                                    sourceType:
                                        'supplier_advance_application',

                                    sourceId:
                                        $advanceId
                                        .
                                        ':'
                                        .
                                        $supplierInvoiceId,

                                    idempotencyKey:
                                        $idempotencyKey,

                                    lines: [
                                        new FinanceJournalLinePayload(
                                            mappingKey:
                                                ProcurementAccountingContract::ACCOUNTS_PAYABLE,

                                            debit:
                                                $amount,

                                            description:
                                                'Apply Supplier Advance to Bill '
                                                .
                                                $invoice->invoice_number,

                                            lineType:
                                                'supplier_advance_application_ap',

                                            branchId:
                                                (int)
                                                $advance->branch_id,

                                            supplierId:
                                                (int)
                                                $advance->pharmaco_supplier_id
                                        ),

                                        new FinanceJournalLinePayload(
                                            mappingKey:
                                                ProcurementAccountingContract::SUPPLIER_ADVANCE,

                                            credit:
                                                $amount,

                                            description:
                                                'Consume Supplier Advance '
                                                .
                                                $advance->advance_number,

                                            lineType:
                                                'supplier_advance_application_asset',

                                            branchId:
                                                (int)
                                                $advance->branch_id,

                                            supplierId:
                                                (int)
                                                $advance->pharmaco_supplier_id
                                        ),
                                    ],

                                    currencyCode:
                                        strtoupper(
                                            (string)
                                            $advance->currency_code
                                        ),

                                    exchangeRate:
                                        (float)
                                        $advance->exchange_rate,

                                    memo:
                                        'Supplier Advance Application',

                                    createdBy:
                                        $actorId,

                                    sourceSnapshot: [
                                        'supplier_advance_id' =>
                                            $advanceId,

                                        'supplier_invoice_id' =>
                                            $supplierInvoiceId,

                                        'amount' =>
                                            $amount,
                                    ],

                                    metadata: [
                                        'release' =>
                                            self::RELEASE,

                                        'accounting_event' =>
                                            'supplier_advance_application',
                                    ],

                                    mode:
                                        'live'
                                )
                            ),
                        'Supplier Advance Application'
                    );

                DB::table(
                    'pharmaco_supplier_advance_applications'
                )
                    ->insert([
                        'uuid' =>
                            (string) Str::uuid(),

                        'tenant_id' =>
                            (int)
                            $advance->tenant_id,

                        'branch_id' =>
                            (int)
                            $advance->branch_id,

                        'pharmaco_supplier_advance_id' =>
                            $advanceId,

                        'pharmaco_supplier_invoice_id' =>
                            $supplierInvoiceId,

                        'amount' =>
                            $amount,

                        'applied_by' =>
                            $actorId,

                        'applied_at' =>
                            now()->toDateTimeString(),

                        'idempotency_key' =>
                            $idempotencyKey,

                        'metadata' =>
                            json_encode(
                                [
                                    'release' =>
                                        self::RELEASE,

                                    'finance_journal_entry_id' =>
                                        (int) $journal->id,
                                ],
                                JSON_UNESCAPED_SLASHES
                            ),

                        'created_at' =>
                            now()->toDateTimeString(),

                        'updated_at' =>
                            now()->toDateTimeString(),
                    ]);

                $newAdvanceApplied =
                    round(
                        (float)
                        $advance->applied_amount
                        +
                        $amount,
                        2
                    );

                $newAdvanceBalance =
                    round(
                        $advanceBalance
                        -
                        $amount,
                        2
                    );

                $newInvoicePaid =
                    round(
                        (float)
                        $invoice->paid_amount
                        +
                        $amount,
                        2
                    );

                $newInvoiceBalance =
                    round(
                        $invoiceBalance
                        -
                        $amount,
                        2
                    );

                DB::table(
                    'pharmaco_supplier_advances'
                )
                    ->where(
                        'id',
                        $advanceId
                    )
                    ->update([
                        'applied_amount' =>
                            $newAdvanceApplied,

                        'balance_amount' =>
                            $newAdvanceBalance,

                        'status' =>
                            $newAdvanceBalance <= 0.01
                                ? 'applied'
                                : 'partially_applied',

                        'updated_at' =>
                            now()->toDateTimeString(),
                    ]);

                DB::table(
                    'pharmaco_supplier_invoices'
                )
                    ->where(
                        'id',
                        $supplierInvoiceId
                    )
                    ->update([
                        'paid_amount' =>
                            $newInvoicePaid,

                        'balance_amount' =>
                            $newInvoiceBalance,

                        'status' =>
                            $newInvoiceBalance <= 0.01
                                ? 'paid'
                                : 'partially_paid',

                        'updated_at' =>
                            now()->toDateTimeString(),
                    ]);

                return $journal;
            }
        );
    }

    public function approveSupplierCredit(
        int $creditId,
        ?int $actorId = null,
    ): FinanceJournalEntry {
        return DB::transaction(
            function () use (
                $creditId,
                $actorId,
            ): FinanceJournalEntry {
                $credit =
                    DB::table(
                        'pharmaco_supplier_credit_notes'
                    )
                        ->where(
                            'id',
                            $creditId
                        )
                        ->lockForUpdate()
                        ->first();

                if (! $credit) {
                    throw ValidationException::withMessages([
                        'supplier_credit' => [
                            'Supplier Credit was not found.',
                        ],
                    ]);
                }

                if (
                    strtolower(
                        (string)
                        $credit->accounting_status
                    ) === 'posted'
                    &&
                    $credit->finance_journal_entry_id
                ) {
                    return $this->existingJournal(
                        (int)
                        $credit->finance_journal_entry_id
                    );
                }

                if (
                    ! in_array(
                        strtolower(
                            (string)
                            $credit->status
                        ),
                        [
                            'approved',
                            'recorded',
                        ],
                        true
                    )
                ) {
                    throw ValidationException::withMessages([
                        'status' => [
                            'Supplier Credit must be approved before Finance posting.',
                        ],
                    ]);
                }

                $items =
                    DB::table(
                        'pharmaco_supplier_credit_note_items'
                    )
                        ->where(
                            'pharmaco_supplier_credit_note_id',
                            $creditId
                        )
                        ->orderBy('id')
                        ->get();

                if ($items->isEmpty()) {
                    throw ValidationException::withMessages([
                        'items' => [
                            'Supplier Credit requires at least one item.',
                        ],
                    ]);
                }

                foreach ($items as $item) {
                    if (
                        (int)
                        $item->stock_return_required
                        === 1
                    ) {
                        throw ValidationException::withMessages([
                            'stock_return_required' => [
                                'Physical Supplier Return accounting is not yet closed. Complete the Supplier Return workflow before approving this stock-return credit.',
                            ],
                        ]);
                    }
                }

                $invoice = null;

                if (
                    $credit->pharmaco_supplier_invoice_id
                ) {
                    $invoice =
                        DB::table(
                            'pharmaco_supplier_invoices'
                        )
                            ->where(
                                'id',
                                $credit
                                    ->pharmaco_supplier_invoice_id
                            )
                            ->lockForUpdate()
                            ->first();

                    if (! $invoice) {
                        throw ValidationException::withMessages([
                            'supplier_invoice' => [
                                'Linked Supplier Bill was not found.',
                            ],
                        ]);
                    }

                    if (
                        strtolower(
                            (string)
                            $invoice->accounting_status
                        ) !== 'posted'
                    ) {
                        throw ValidationException::withMessages([
                            'supplier_invoice' => [
                                'Linked Supplier Bill must be posted before Supplier Credit approval.',
                            ],
                        ]);
                    }
                }

                $total =
                    round(
                        (float)
                        $credit->total_amount,
                        2
                    );

                $tax =
                    round(
                        max(
                            0,
                            (float)
                            $credit->tax_amount
                        ),
                        2
                    );

                $net =
                    round(
                        $total
                        -
                        $tax,
                        2
                    );

                if (
                    $total <= 0
                    ||
                    $net < 0
                ) {
                    throw ValidationException::withMessages([
                        'amount' => [
                            'Supplier Credit amounts are invalid.',
                        ],
                    ]);
                }

                $lines = [
                    new FinanceJournalLinePayload(
                        mappingKey:
                            ProcurementAccountingContract::ACCOUNTS_PAYABLE,

                        debit:
                            $total,

                        description:
                            'Supplier Credit '
                            .
                            $credit->credit_number,

                        lineType:
                            'supplier_credit_ap',

                        branchId:
                            (int) $credit->branch_id,

                        supplierId:
                            (int)
                            $credit->pharmaco_supplier_id
                    ),
                ];

                if ($tax > 0) {
                    $lines[] =
                        new FinanceJournalLinePayload(
                            mappingKey:
                                ProcurementAccountingContract::VAT_INPUT,

                            credit:
                                $tax,

                            description:
                                'Reverse VAT Input for Supplier Credit '
                                .
                                $credit->credit_number,

                            lineType:
                                'supplier_credit_vat_reversal',

                            branchId:
                                (int) $credit->branch_id,

                            supplierId:
                                (int)
                                $credit->pharmaco_supplier_id
                        );
                }

                if ($net > 0) {
                    $lines[] =
                        new FinanceJournalLinePayload(
                            mappingKey:
                                ProcurementAccountingContract::PURCHASE_PRICE_VARIANCE,

                            credit:
                                $net,

                            description:
                                'Supplier purchasing adjustment '
                                .
                                $credit->credit_number,

                            lineType:
                                'supplier_credit_purchase_variance',

                            branchId:
                                (int) $credit->branch_id,

                            supplierId:
                                (int)
                                $credit->pharmaco_supplier_id
                        );
                }

                $idempotencyKey =
                    trim(
                        (string)
                        (
                            $credit->idempotency_key
                            ?: ''
                        )
                    );

                if ($idempotencyKey === '') {
                    $idempotencyKey =
                        'procurement-supplier-credit-'
                        .
                        (string) $credit->uuid;
                }

                $journal =
                    $this->postedOrThrow(
                        $this
                            ->postingService
                            ->post(
                                new FinancePostingPayload(
                                    tenantId:
                                        (int)
                                        $credit->tenant_id,

                                    branchId:
                                        (int)
                                        $credit->branch_id,

                                    businessDate:
                                        substr(
                                            (string)
                                            $credit->credit_date,
                                            0,
                                            10
                                        ),

                                    sourceModule:
                                        'procurement',

                                    sourceType:
                                        'supplier_credit',

                                    sourceId:
                                        (string)
                                        $creditId,

                                    idempotencyKey:
                                        $idempotencyKey,

                                    lines:
                                        $lines,

                                    currencyCode:
                                        strtoupper(
                                            (string)
                                            $credit->currency_code
                                        ),

                                    exchangeRate:
                                        (float)
                                        $credit->exchange_rate,

                                    memo:
                                        'Supplier Credit '
                                        .
                                        $credit->credit_number,

                                    createdBy:
                                        $actorId,

                                    sourceSnapshot: [
                                        'supplier_credit_id' =>
                                            $creditId,

                                        'supplier_invoice_id' =>
                                            $credit
                                                ->pharmaco_supplier_invoice_id,

                                        'supplier_id' =>
                                            (int)
                                            $credit
                                                ->pharmaco_supplier_id,

                                        'total' =>
                                            $total,

                                        'tax' =>
                                            $tax,

                                        'net' =>
                                            $net,

                                        'stock_return_required' =>
                                            false,
                                    ],

                                    metadata: [
                                        'release' =>
                                            self::RELEASE,

                                        'accounting_event' =>
                                            'supplier_credit',

                                        'stock_return_accounting' =>
                                            false,
                                    ],

                                    mode:
                                        'live'
                                )
                            ),
                        'Supplier Credit'
                    );

                DB::table(
                    'pharmaco_supplier_credit_notes'
                )
                    ->where(
                        'id',
                        $creditId
                    )
                    ->update([
                        'status' =>
                            'approved',

                        'approved_by' =>
                            $actorId,

                        'approved_at' =>
                            now()->toDateTimeString(),

                        'applied_amount' =>
                            $invoice
                                ? $total
                                : 0,

                        'balance_amount' =>
                            $invoice
                                ? 0
                                : $total,

                        'accounting_status' =>
                            'posted',

                        'finance_journal_entry_id' =>
                            $journal->id,

                        'finance_posted_at' =>
                            now()->toDateTimeString(),

                        'idempotency_key' =>
                            $idempotencyKey,

                        'updated_at' =>
                            now()->toDateTimeString(),
                    ]);

                if ($invoice) {
                    $invoiceBalance =
                        round(
                            (float)
                            $invoice->balance_amount,
                            2
                        );

                    if (
                        $total
                        >
                        $invoiceBalance + 0.01
                    ) {
                        throw ValidationException::withMessages([
                            'supplier_credit' => [
                                'Supplier Credit exceeds the outstanding Supplier Bill balance.',
                            ],
                        ]);
                    }

                    $newBalance =
                        round(
                            max(
                                0,
                                $invoiceBalance
                                -
                                $total
                            ),
                            2
                        );

                    DB::table(
                        'pharmaco_supplier_invoices'
                    )
                        ->where(
                            'id',
                            $invoice->id
                        )
                        ->update([
                            'balance_amount' =>
                                $newBalance,

                            'status' =>
                                $newBalance <= 0.01
                                    ? 'paid'
                                    : 'partially_paid',

                            'updated_at' =>
                                now()->toDateTimeString(),
                        ]);
                }

                return $journal;
            }
        );
    }

    private function existingJournal(
        int $journalId,
    ): FinanceJournalEntry {
        $journal =
            FinanceJournalEntry::query()
                ->find(
                    $journalId
                );

        if (
            ! $journal
            ||
            strtolower(
                (string)
                $journal->status
            ) !== 'posted'
        ) {
            throw ValidationException::withMessages([
                'accounting' => [
                    'Existing Finance journal is not available.',
                ],
            ]);
        }

        return $journal->load(
            'lines'
        );
    }

    private function postedOrThrow(
        FinanceJournalEntry|FinancePostingLog $result,
        string $context,
    ): FinanceJournalEntry {
        if (
            $result instanceof FinanceJournalEntry
            &&
            strtolower(
                (string)
                $result->status
            ) === 'posted'
        ) {
            return $result->load(
                'lines'
            );
        }

        $message =
            $result instanceof FinancePostingLog
                ? (
                    $result->failure_message
                    ?: 'Finance posting was quarantined.'
                )
                : 'Finance posting did not return a posted journal.';

        throw ValidationException::withMessages([
            'accounting' => [
                $context
                .
                ' accounting posting failed: '
                .
                $message,
            ],
        ]);
    }
}
