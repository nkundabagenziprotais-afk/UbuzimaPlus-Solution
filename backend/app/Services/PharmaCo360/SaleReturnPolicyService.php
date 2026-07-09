<?php

namespace App\Services\PharmaCo360;

use Illuminate\Validation\ValidationException;

class SaleReturnPolicyService
{
    public function ensureSaleStatusReturnable(
        string $status
    ): void {
        if ($status !== 'dispensed') {
            throw ValidationException::withMessages([
                'sale' => [
                    'Only a confirmed and dispensed sale '
                    . 'can be returned.',
                ],
            ]);
        }
    }

    public function ensureQuantityAvailable(
        float $soldQuantity,
        float $previouslyReservedQuantity,
        float $requestedQuantity
    ): void {
        if ($requestedQuantity <= 0) {
            throw ValidationException::withMessages([
                'items' => [
                    'Returned quantity must be greater than zero.',
                ],
            ]);
        }

        $remaining = round(
            $soldQuantity - $previouslyReservedQuantity,
            3
        );

        if ($requestedQuantity - $remaining > 0.0005) {
            throw ValidationException::withMessages([
                'items' => [
                    'Returned quantity exceeds the quantity '
                    . 'still available for return.',
                ],
            ]);
        }
    }

    public function calculateLineRefund(
        float $lineTotal,
        float $soldQuantity,
        float $returnQuantity
    ): float {
        if ($soldQuantity <= 0) {
            throw ValidationException::withMessages([
                'items' => [
                    'The original sale quantity is invalid.',
                ],
            ]);
        }

        return round(
            ($lineTotal / $soldQuantity)
            * $returnQuantity,
            2
        );
    }

    public function paymentStatusAfterRefund(
        float $originalPaid,
        float $remainingPaid,
        float $remainingBalance,
        float $cumulativeRefund
    ): string {
        if ($originalPaid <= 0.00001) {
            return 'unpaid';
        }

        if (
            $remainingPaid <= 0.00001
            && $cumulativeRefund > 0.00001
        ) {
            return 'refunded';
        }

        if ($remainingBalance <= 0.00001) {
            return 'paid';
        }

        return 'partial';
    }
}
