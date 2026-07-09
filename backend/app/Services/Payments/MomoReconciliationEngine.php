<?php

namespace App\Services\Payments;

use App\Models\PharmacoMomoMessage;
use App\Models\PharmacoMomoReconciliation;
use App\Models\PharmacoPayment;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

class MomoReconciliationEngine
{
    public function reconcileMessage(
        PharmacoMomoMessage $message
    ): PharmacoMomoReconciliation {
        $payments = PharmacoPayment::query()
            ->with('sale.customer')
            ->where(
                'tenant_id',
                $message->tenant_id
            )
            ->whereIn(
                'payment_method',
                [
                    'momo',
                    'mobile_money',
                ]
            )
            ->get();

        $candidates = $payments
            ->map(
                fn (PharmacoPayment $payment) =>
                    $this->score(
                        $message,
                        $payment
                    )
            )
            ->sortByDesc('score')
            ->values();

        $best = $candidates->first();

        if (
            ! $best ||
            $best['score'] < 55
        ) {
            return PharmacoMomoReconciliation::query()
                ->updateOrCreate(
                    [
                        'momo_message_id' =>
                            $message->id,
                    ],
                    [
                        'uuid' => (string) Str::uuid(),
                        'tenant_id' =>
                            $message->tenant_id,
                        'pharmaco_payment_id' =>
                            null,
                        'pharmaco_sale_id' =>
                            null,
                        'status' => 'exception',
                        'decision' =>
                            'exists_in_momo_not_found_in_pos',
                        'confidence_score' =>
                            $best['score'] ?? 0,
                        'amount_variance' =>
                            $best['amount_variance']
                                ?? null,
                        'matching_reasons' =>
                            $best['reasons'] ?? [
                                'No eligible POS Mobile Money payment reached the matching threshold.',
                            ],
                    ]
                );
        }

        /** @var PharmacoPayment $payment */
        $payment = $best['payment'];

        $existingPaymentMatch =
            PharmacoMomoReconciliation::query()
                ->where(
                    'pharmaco_payment_id',
                    $payment->id
                )
                ->first();

        if (
            $existingPaymentMatch &&
            $existingPaymentMatch->momo_message_id &&
            $existingPaymentMatch->momo_message_id
                !== $message->id
        ) {
            return PharmacoMomoReconciliation::query()
                ->updateOrCreate(
                    [
                        'momo_message_id' =>
                            $message->id,
                    ],
                    [
                        'uuid' => (string) Str::uuid(),
                        'tenant_id' =>
                            $message->tenant_id,
                        'status' => 'exception',
                        'decision' =>
                            'duplicate_or_conflicting_match',
                        'confidence_score' =>
                            $best['score'],
                        'amount_variance' =>
                            $best['amount_variance'],
                        'matching_reasons' => [
                            ...$best['reasons'],
                            'The strongest POS payment is already linked to another Mobile Money message.',
                        ],
                    ]
                );
        }

        $status =
            $best['score'] >= 80
                ? 'matched'
                : 'review';

        $decision =
            $best['score'] >= 80
                ? 'matched_automatically'
                : 'possible_match_manager_review';

        $reconciliation =
            $existingPaymentMatch
                ?: new PharmacoMomoReconciliation();

        $reconciliation->fill([
            'uuid' =>
                $reconciliation->uuid
                    ?: (string) Str::uuid(),
            'tenant_id' =>
                $message->tenant_id,
            'momo_message_id' =>
                $message->id,
            'pharmaco_payment_id' =>
                $payment->id,
            'pharmaco_sale_id' =>
                $payment->pharmaco_sale_id,
            'status' => $status,
            'decision' => $decision,
            'confidence_score' =>
                $best['score'],
            'amount_variance' =>
                $best['amount_variance'],
            'matching_reasons' =>
                $best['reasons'],
        ]);

        $reconciliation->save();

        return $reconciliation;
    }

    public function synchronizePosExceptions(
        int $tenantId
    ): void {
        PharmacoPayment::query()
            ->with('sale')
            ->where(
                'tenant_id',
                $tenantId
            )
            ->whereIn(
                'payment_method',
                [
                    'momo',
                    'mobile_money',
                ]
            )
            ->get()
            ->each(
                function (
                    PharmacoPayment $payment
                ) use ($tenantId): void {
                    $exists =
                        PharmacoMomoReconciliation::query()
                            ->where(
                                'pharmaco_payment_id',
                                $payment->id
                            )
                            ->exists();

                    if ($exists) {
                        return;
                    }

                    PharmacoMomoReconciliation::query()
                        ->create([
                            'uuid' =>
                                (string) Str::uuid(),
                            'tenant_id' =>
                                $tenantId,
                            'momo_message_id' =>
                                null,
                            'pharmaco_payment_id' =>
                                $payment->id,
                            'pharmaco_sale_id' =>
                                $payment
                                    ->pharmaco_sale_id,
                            'status' =>
                                'exception',
                            'decision' =>
                                'exists_in_pos_not_found_in_momo',
                            'confidence_score' =>
                                0,
                            'amount_variance' =>
                                null,
                            'matching_reasons' => [
                                'The POS transaction expects a Mobile Money payment but no provider SMS record has been linked.',
                            ],
                        ]);
                }
            );
    }

    private function score(
        PharmacoMomoMessage $message,
        PharmacoPayment $payment
    ): array {
        $score = 0;
        $reasons = [];

        $messageAmount =
            (float) ($message->amount ?? 0);

        $paymentAmount =
            (float) ($payment->amount ?? 0);

        $amountVariance = round(
            $messageAmount - $paymentAmount,
            2
        );

        if (
            $message->provider_transaction_id &&
            $payment->reference_number &&
            $this->normalizeReference(
                $message
                    ->provider_transaction_id
            ) ===
            $this->normalizeReference(
                $payment->reference_number
            )
        ) {
            $score += 100;

            $reasons[] =
                'Exact provider transaction reference match.';
        }

        if (
            $messageAmount > 0 &&
            abs($amountVariance) < 0.01
        ) {
            $score += 45;
            $reasons[] = 'Exact amount match.';
        } elseif (
            $messageAmount > 0 &&
            abs($amountVariance)
                <= max(100, $paymentAmount * 0.01)
        ) {
            $score += 20;

            $reasons[] =
                'Amount is within the configured tolerance.';
        } else {
            $reasons[] =
                'Payment amount differs from the Mobile Money message.';
        }

        $paymentDate =
            $payment->received_at
                ?? $payment->created_at;

        if (
            $message->transaction_at &&
            $paymentDate
        ) {
            $minutes = abs(
                $message->transaction_at
                    ->diffInMinutes(
                        $paymentDate,
                        false
                    )
            );

            if ($minutes <= 5) {
                $score += 30;

                $reasons[] =
                    'Transaction times are within five minutes.';
            } elseif ($minutes <= 15) {
                $score += 20;

                $reasons[] =
                    'Transaction times are within fifteen minutes.';
            } elseif ($minutes <= 60) {
                $score += 8;

                $reasons[] =
                    'Transaction times are within one hour.';
            }
        }

        $sale = $payment->sale;
        $customer = $sale?->customer;

        $customerPhone = preg_replace(
            '/\D+/',
            '',
            (string) ($customer?->phone ?? '')
        ) ?: '';

        if (
            $message->phone_suffix &&
            $customerPhone !== '' &&
            str_ends_with(
                $customerPhone,
                $message->phone_suffix
            )
        ) {
            $score += 15;

            $reasons[] =
                'Customer phone suffix matches.';
        }

        $customerName = trim(
            (string) (
                $customer?->full_name
                ?? (
                    trim(
                        (string) (
                            $customer?->first_name
                            ?? ''
                        )
                        . ' '
                        . (string) (
                            $customer?->last_name
                            ?? ''
                        )
                    )
                )
            )
        );

        if (
            $message->customer_name &&
            $customerName !== ''
        ) {
            similar_text(
                $this->normalizeName(
                    $message->customer_name
                ),
                $this->normalizeName(
                    $customerName
                ),
                $similarity
            );

            if ($similarity >= 80) {
                $score += 10;

                $reasons[] =
                    'Customer names are strongly similar.';
            } elseif ($similarity >= 55) {
                $score += 5;

                $reasons[] =
                    'Customer names are partially similar.';
            }
        }

        return [
            'payment' => $payment,
            'score' => min(100, $score),
            'amount_variance' =>
                $amountVariance,
            'reasons' => $reasons,
        ];
    }

    private function normalizeReference(
        string $value
    ): string {
        return strtolower(
            preg_replace(
                '/[^a-z0-9]+/i',
                '',
                $value
            ) ?? ''
        );
    }

    private function normalizeName(
        string $value
    ): string {
        return strtolower(
            trim(
                preg_replace(
                    '/[^a-z0-9]+/i',
                    ' ',
                    $value
                ) ?? ''
            )
        );
    }
}
