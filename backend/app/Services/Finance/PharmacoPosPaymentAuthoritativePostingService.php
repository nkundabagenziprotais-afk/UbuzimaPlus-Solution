<?php

namespace App\Services\Finance;

use App\Data\Finance\FinanceJournalLinePayload;
use App\Data\Finance\FinancePostingPayload;
use App\Models\FinanceJournalEntry;
use App\Models\FinancePostingLog;
use App\Models\PharmacoPayment;
use App\Models\PharmacoSale;
use InvalidArgumentException;

class PharmacoPosPaymentAuthoritativePostingService
{
    public function __construct(
        private readonly FinancePostingService $postingService,
    ) {
    }

    public function postPayment(
        PharmacoPayment $payment,
        PharmacoSale $sale,
        string $mode = 'authoritative',
    ): FinanceJournalEntry|FinancePostingLog {
        if (! in_array($mode, ['dual', 'authoritative'], true)) {
            throw new InvalidArgumentException(
                'Authoritative payment posting mode must be dual or authoritative.'
            );
        }

        $businessDate =
            $payment->business_date?->toDateString()
            ?: $sale->business_date?->toDateString();

        $paymentMethod = trim(
            (string) $payment->payment_method
        );

        $idempotencyKey =
            "pos-payment-authoritative-{$payment->id}";

        $basePayload = fn (
            array $lines = [],
            array $metadata = [],
        ): FinancePostingPayload => new FinancePostingPayload(
            tenantId: (int) $payment->tenant_id,
            branchId: $sale->branch_id,
            businessDate: $businessDate,
            sourceModule: 'pos',
            sourceType: 'payment',
            sourceId: (string) $payment->id,
            idempotencyKey: $idempotencyKey,
            lines: $lines,
            currencyCode: 'RWF',
            memo:
                "Authoritative payment {$payment->receipt_number} for sale {$sale->sale_number}",
            createdBy: $payment->received_by,
            sourceSnapshot: [
                'sale' => [
                    'id' => $sale->id,
                    'sale_number' => $sale->sale_number,
                    'business_date' =>
                        $sale->business_date?->toDateString(),
                    'total_amount' =>
                        (float) $sale->total_amount,
                    'paid_amount' =>
                        (float) $sale->paid_amount,
                    'balance_amount' =>
                        (float) $sale->balance_amount,
                    'payment_status' =>
                        $sale->payment_status,
                ],
                'payment' => [
                    'id' => $payment->id,
                    'receipt_number' =>
                        $payment->receipt_number,
                    'amount' =>
                        (float) $payment->amount,
                    'payment_method' =>
                        $paymentMethod,
                    'business_date' =>
                        $payment->business_date?->toDateString(),
                    'received_at' =>
                        $payment->received_at?->toISOString(),
                    'reference_number' =>
                        $payment->reference_number,
                ],
            ],
            metadata: array_merge(
                [
                    'authoritative_posting' => true,
                    'posting_adapter' => self::class,
                    'posting_mode' => $mode,
                ],
                $metadata,
            ),
            mode: $mode,
        );

        if ($payment->status !== 'completed') {
            return $this->postingService->quarantineExternal(
                $basePayload(),
                'payment_not_completed',
                "Payment {$payment->id} is not completed."
            );
        }

        $amount = round(
            (float) $payment->amount,
            4
        );

        if ($amount <= 0) {
            return $this->postingService->quarantineExternal(
                $basePayload(),
                'invalid_payment_amount',
                "Payment {$payment->id} has no positive amount."
            );
        }

        $mapping = (array) config(
            'finance.authoritative_payment_mappings',
            []
        );

        $debitMapping = $mapping[$paymentMethod] ?? null;

        if (! $debitMapping) {
            return $this->postingService->quarantineExternal(
                $basePayload(
                    metadata: [
                        'unknown_payment_method' =>
                            $paymentMethod,
                    ],
                ),
                'unknown_payment_method',
                "Unknown authoritative payment method: {$paymentMethod}."
            );
        }

        $lines = [
            new FinanceJournalLinePayload(
                mappingKey: $debitMapping,
                debit: $amount,
                description:
                    "Payment received through {$paymentMethod}",
                lineType: 'payment_receipt',
                branchId: $sale->branch_id,
                customerId:
                    $sale->pharmaco_customer_id,
                paymentMethod: $paymentMethod,
                metadata: [
                    'pharmaco_sale_id' => $sale->id,
                    'pharmaco_payment_id' => $payment->id,
                    'receipt_number' =>
                        $payment->receipt_number,
                ],
            ),
            new FinanceJournalLinePayload(
                mappingKey: 'pos.credit',
                credit: $amount,
                description:
                    "Receivable cleared by payment {$payment->receipt_number}",
                lineType: 'accounts_receivable_clearance',
                branchId: $sale->branch_id,
                customerId:
                    $sale->pharmaco_customer_id,
                paymentMethod: $paymentMethod,
                metadata: [
                    'pharmaco_sale_id' => $sale->id,
                    'pharmaco_payment_id' => $payment->id,
                    'control_account_role' =>
                        'trade_receivable',
                ],
            ),
        ];

        return $this->postingService->post(
            $basePayload(
                lines: $lines,
                metadata: [
                    'payment_mapping_key' =>
                        $debitMapping,
                ],
            )
        );
    }
}
