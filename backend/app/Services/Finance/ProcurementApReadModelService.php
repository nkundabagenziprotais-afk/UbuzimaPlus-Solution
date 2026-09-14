<?php

namespace App\Services\Finance;

use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class ProcurementApReadModelService
{
    public const RELEASE =
        'AQUILA_FINANCE_F4_R5_R1_AP_READ_MODEL';

    public function aging(
        int $tenantId,
        ?int $branchId = null,
        ?int $supplierId = null,
        ?string $asOf = null,
    ): array {
        $asOf =
            $asOf
            ?: now()->toDateString();

        $query =
            DB::table(
                'pharmaco_supplier_invoices as i'
            )
                ->join(
                    'pharmaco_suppliers as s',
                    's.id',
                    '=',
                    'i.pharmaco_supplier_id'
                )
                ->where(
                    'i.tenant_id',
                    $tenantId
                )
                ->where(
                    'i.balance_amount',
                    '>',
                    0
                );

        if ($branchId) {
            $query->where(
                'i.branch_id',
                $branchId
            );
        }

        if ($supplierId) {
            $query->where(
                'i.pharmaco_supplier_id',
                $supplierId
            );
        }

        $rows =
            $query
                ->orderBy(
                    'i.due_date'
                )
                ->orderBy(
                    'i.id'
                )
                ->get([
                    'i.id',
                    'i.branch_id',
                    'i.pharmaco_supplier_id',
                    's.supplier_code',
                    's.name as supplier_name',
                    'i.invoice_number',
                    'i.supplier_invoice_number',
                    'i.invoice_date',
                    'i.due_date',
                    'i.total_amount',
                    'i.paid_amount',
                    'i.balance_amount',
                    'i.currency_code',
                    'i.accounting_status',
                ]);

        $buckets = [
            'current' => 0.0,
            '1_30' => 0.0,
            '31_60' => 0.0,
            '61_90' => 0.0,
            'over_90' => 0.0,
        ];

        $detail = [];

        foreach ($rows as $row) {
            $days =
                (int)
                now()
                    ->parse(
                        $row->due_date
                    )
                    ->startOfDay()
                    ->diffInDays(
                        now()
                            ->parse(
                                $asOf
                            )
                            ->startOfDay(),
                        false
                    );

            if ($days <= 0) {
                $bucket = 'current';
            } elseif ($days <= 30) {
                $bucket = '1_30';
            } elseif ($days <= 60) {
                $bucket = '31_60';
            } elseif ($days <= 90) {
                $bucket = '61_90';
            } else {
                $bucket = 'over_90';
            }

            $balance =
                round(
                    (float)
                    $row->balance_amount,
                    2
                );

            $buckets[$bucket] +=
                $balance;

            $detail[] = [
                'invoice_id' =>
                    (int) $row->id,

                'branch_id' =>
                    (int) $row->branch_id,

                'supplier_id' =>
                    (int)
                    $row->pharmaco_supplier_id,

                'supplier_code' =>
                    $row->supplier_code,

                'supplier_name' =>
                    $row->supplier_name,

                'invoice_number' =>
                    $row->invoice_number,

                'supplier_invoice_number' =>
                    $row->supplier_invoice_number,

                'invoice_date' =>
                    $row->invoice_date,

                'due_date' =>
                    $row->due_date,

                'days_overdue' =>
                    max(
                        0,
                        $days
                    ),

                'aging_bucket' =>
                    $bucket,

                'total_amount' =>
                    round(
                        (float)
                        $row->total_amount,
                        2
                    ),

                'paid_amount' =>
                    round(
                        (float)
                        $row->paid_amount,
                        2
                    ),

                'balance_amount' =>
                    $balance,

                'currency_code' =>
                    $row->currency_code,

                'accounting_status' =>
                    $row->accounting_status,
            ];
        }

        foreach ($buckets as $key => $value) {
            $buckets[$key] =
                round(
                    $value,
                    2
                );
        }

        return [
            'as_of' =>
                $asOf,

            'invoice_count' =>
                count(
                    $detail
                ),

            'total_outstanding' =>
                round(
                    array_sum(
                        $buckets
                    ),
                    2
                ),

            'buckets' =>
                $buckets,

            'rows' =>
                $detail,
        ];
    }

    public function supplierStatement(
        int $tenantId,
        int $supplierId,
        ?int $branchId = null,
    ): array {
        $supplier =
            DB::table(
                'pharmaco_suppliers'
            )
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->where(
                    'id',
                    $supplierId
                )
                ->first();

        if (! $supplier) {
            return [
                'supplier' => null,
                'transactions' => [],
                'summary' => [
                    'bills' => 0,
                    'payments' => 0,
                    'credits' => 0,
                    'advances' => 0,
                    'advance_applications' => 0,
                    'open_payable' => 0,
                    'unapplied_advance' => 0,
                    'unapplied_credit' => 0,
                ],
            ];
        }

        $invoiceQuery =
            DB::table(
                'pharmaco_supplier_invoices'
            )
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->where(
                    'pharmaco_supplier_id',
                    $supplierId
                );

        $paymentQuery =
            DB::table(
                'pharmaco_supplier_payments'
            )
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->where(
                    'pharmaco_supplier_id',
                    $supplierId
                );

        $creditQuery =
            DB::table(
                'pharmaco_supplier_credit_notes'
            )
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->where(
                    'pharmaco_supplier_id',
                    $supplierId
                );

        $advanceQuery =
            DB::table(
                'pharmaco_supplier_advances'
            )
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->where(
                    'pharmaco_supplier_id',
                    $supplierId
                );

        if ($branchId) {
            $invoiceQuery->where(
                'branch_id',
                $branchId
            );

            $paymentQuery->where(
                'branch_id',
                $branchId
            );

            $creditQuery->where(
                'branch_id',
                $branchId
            );

            $advanceQuery->where(
                'branch_id',
                $branchId
            );
        }

        $transactions = [];

        foreach (
            (clone $invoiceQuery)->get()
            as $row
        ) {
            $transactions[] = [
                'type' =>
                    'supplier_bill',

                'date' =>
                    $row->invoice_date,

                'reference' =>
                    $row->invoice_number,

                'debit' =>
                    0,

                'credit' =>
                    round(
                        (float)
                        $row->total_amount,
                        2
                    ),

                'balance_amount' =>
                    round(
                        (float)
                        $row->balance_amount,
                        2
                    ),

                'status' =>
                    $row->status,

                'currency_code' =>
                    $row->currency_code,
            ];
        }

        foreach (
            (clone $paymentQuery)->get()
            as $row
        ) {
            $transactions[] = [
                'type' =>
                    'supplier_payment',

                'date' =>
                    $row->paid_at,

                'reference' =>
                    $row->payment_number,

                'debit' =>
                    round(
                        (float)
                        $row->amount,
                        2
                    ),

                'credit' =>
                    0,

                'balance_amount' =>
                    null,

                'status' =>
                    $row->status,

                'currency_code' =>
                    $row->currency_code,
            ];
        }

        foreach (
            (clone $creditQuery)->get()
            as $row
        ) {
            $transactions[] = [
                'type' =>
                    'supplier_credit',

                'date' =>
                    $row->credit_date,

                'reference' =>
                    $row->credit_number,

                'debit' =>
                    round(
                        (float)
                        $row->total_amount,
                        2
                    ),

                'credit' =>
                    0,

                'balance_amount' =>
                    round(
                        (float)
                        $row->balance_amount,
                        2
                    ),

                'status' =>
                    $row->status,

                'currency_code' =>
                    $row->currency_code,
            ];
        }

        foreach (
            (clone $advanceQuery)->get()
            as $row
        ) {
            $transactions[] = [
                'type' =>
                    'supplier_advance',

                'date' =>
                    $row->advance_date,

                'reference' =>
                    $row->advance_number,

                'debit' =>
                    round(
                        (float)
                        $row->amount,
                        2
                    ),

                'credit' =>
                    0,

                'balance_amount' =>
                    round(
                        (float)
                        $row->balance_amount,
                        2
                    ),

                'status' =>
                    $row->status,

                'currency_code' =>
                    $row->currency_code,
            ];
        }

        usort(
            $transactions,
            static function (
                array $left,
                array $right,
            ): int {
                return strcmp(
                    (string)
                    $left['date'],
                    (string)
                    $right['date']
                );
            }
        );

        $applicationQuery =
            DB::table(
                'pharmaco_supplier_advance_applications as a'
            )
                ->join(
                    'pharmaco_supplier_advances as adv',
                    'adv.id',
                    '=',
                    'a.pharmaco_supplier_advance_id'
                )
                ->where(
                    'a.tenant_id',
                    $tenantId
                )
                ->where(
                    'adv.pharmaco_supplier_id',
                    $supplierId
                );

        if ($branchId) {
            $applicationQuery->where(
                'a.branch_id',
                $branchId
            );
        }

        return [
            'supplier' => [
                'id' =>
                    (int) $supplier->id,

                'supplier_code' =>
                    $supplier->supplier_code,

                'name' =>
                    $supplier->name,

                'payment_terms' =>
                    $supplier->payment_terms,
            ],

            'transactions' =>
                $transactions,

            'summary' => [
                'bills' =>
                    round(
                        (float)
                        (clone $invoiceQuery)
                            ->sum(
                                'total_amount'
                            ),
                        2
                    ),

                'payments' =>
                    round(
                        (float)
                        (clone $paymentQuery)
                            ->sum(
                                'amount'
                            ),
                        2
                    ),

                'credits' =>
                    round(
                        (float)
                        (clone $creditQuery)
                            ->sum(
                                'total_amount'
                            ),
                        2
                    ),

                'advances' =>
                    round(
                        (float)
                        (clone $advanceQuery)
                            ->sum(
                                'amount'
                            ),
                        2
                    ),

                'advance_applications' =>
                    round(
                        (float)
                        $applicationQuery
                            ->sum(
                                'a.amount'
                            ),
                        2
                    ),

                'open_payable' =>
                    round(
                        (float)
                        (clone $invoiceQuery)
                            ->sum(
                                'balance_amount'
                            ),
                        2
                    ),

                'unapplied_advance' =>
                    round(
                        (float)
                        (clone $advanceQuery)
                            ->sum(
                                'balance_amount'
                            ),
                        2
                    ),

                'unapplied_credit' =>
                    round(
                        (float)
                        (clone $creditQuery)
                            ->sum(
                                'balance_amount'
                            ),
                        2
                    ),
            ],
        ];
    }
}
