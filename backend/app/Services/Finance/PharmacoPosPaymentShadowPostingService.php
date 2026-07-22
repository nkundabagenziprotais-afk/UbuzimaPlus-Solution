<?php

namespace App\Services\Finance;

use App\Data\Finance\FinanceJournalLinePayload;
use App\Data\Finance\FinancePostingPayload;
use App\Models\FinanceJournalEntry;
use App\Models\FinancePostingLog;
use App\Models\PharmacoPayment;
use App\Models\PharmacoSale;
use Throwable;

class PharmacoPosPaymentShadowPostingService
{
    public function __construct(
        private readonly FinancePostingService $postingService,
    ) {
    }

    public function postPayment(PharmacoPayment $payment, PharmacoSale $sale): FinanceJournalEntry|FinancePostingLog
    {
        $amount = round((float) $payment->amount, 2);
        $totalAmount = round((float) $sale->total_amount, 2);
        $taxAmount = round((float) $sale->tax_amount, 2);

        $taxCredit = 0.0;

        if ($amount > 0 && $totalAmount > 0 && $taxAmount > 0) {
            $taxCredit = round(min($taxAmount, ($amount / $totalAmount) * $taxAmount), 2);
        }

        $revenueCredit = round($amount - $taxCredit, 2);

        $lines = [
            new FinanceJournalLinePayload(
                mappingKey: $this->paymentMappingKey((string) $payment->payment_method),
                debit: $amount,
                description: "Shadow POS payment {$payment->receipt_number}",
                lineType: 'payment',
                branchId: $sale->branch_id,
                customerId: $sale->pharmaco_customer_id,
                paymentMethod: $payment->payment_method,
                metadata: [
                    'pharmaco_sale_id' => $sale->id,
                    'pharmaco_payment_id' => $payment->id,
                    'receipt_number' => $payment->receipt_number,
                ],
            ),
        ];

        if ($taxCredit > 0) {
            $lines[] = new FinanceJournalLinePayload(
                mappingKey: 'sales.tax',
                credit: $taxCredit,
                description: "Shadow POS tax for payment {$payment->receipt_number}",
                lineType: 'tax',
                branchId: $sale->branch_id,
                customerId: $sale->pharmaco_customer_id,
                paymentMethod: $payment->payment_method,
                metadata: [
                    'pharmaco_sale_id' => $sale->id,
                    'pharmaco_payment_id' => $payment->id,
                    'allocation_method' => 'payment_proportional_to_sale_total',
                ],
            );
        }

        if ($revenueCredit > 0) {
            $lines[] = new FinanceJournalLinePayload(
                mappingKey: 'sales.revenue',
                credit: $revenueCredit,
                description: "Shadow POS revenue for payment {$payment->receipt_number}",
                lineType: 'revenue',
                branchId: $sale->branch_id,
                customerId: $sale->pharmaco_customer_id,
                paymentMethod: $payment->payment_method,
                metadata: [
                    'pharmaco_sale_id' => $sale->id,
                    'pharmaco_payment_id' => $payment->id,
                    'allocation_method' => 'payment_proportional_to_sale_total',
                ],
            );
        }

        return $this->postingService->post(new FinancePostingPayload(
            tenantId: (int) $payment->tenant_id,
            branchId: $sale->branch_id,
            businessDate: $payment->business_date?->toDateString()
                ?: $sale->business_date?->toDateString(),
            sourceModule: 'pos',
            sourceType: 'payment',
            sourceId: (string) $payment->id,
            idempotencyKey: "pos-payment-shadow-{$payment->id}",
            lines: $lines,
            currencyCode: 'RWF',
            memo: "Shadow POS payment {$payment->receipt_number} for sale {$sale->sale_number}",
            createdBy: $payment->received_by,
            sourceSnapshot: [
                'sale' => [
                    'id' => $sale->id,
                    'sale_number' => $sale->sale_number,
                    'business_date' => $sale->business_date?->toDateString(),
                    'subtotal_amount' => (float) $sale->subtotal_amount,
                    'discount_amount' => (float) $sale->discount_amount,
                    'tax_amount' => (float) $sale->tax_amount,
                    'total_amount' => (float) $sale->total_amount,
                    'paid_amount' => (float) $sale->paid_amount,
                    'balance_amount' => (float) $sale->balance_amount,
                    'payment_status' => $sale->payment_status,
                ],
                'payment' => [
                    'id' => $payment->id,
                    'receipt_number' => $payment->receipt_number,
                    'amount' => (float) $payment->amount,
                    'payment_method' => $payment->payment_method,
                    'business_date' => $payment->business_date?->toDateString(),
                    'received_at' => $payment->received_at?->toISOString(),
                ],
            ],
            metadata: [
                'shadow_posting' => true,
                'posting_adapter' => self::class,
                'tax_credit' => $taxCredit,
                'revenue_credit' => $revenueCredit,
            ],
            mode: 'shadow',
        ));
    }

    private function paymentMappingKey(string $paymentMethod): string
    {
        return match ($paymentMethod) {
            'cash' => 'pos.cash',
            'momo' => 'pos.momo',
            'card' => 'pos.card',
            'insurance' => 'pos.insurance',
            'credit' => 'pos.credit',
            'bank_transfer' => 'pos.bank',
            default => 'pos.cash',
        };
    }
}
