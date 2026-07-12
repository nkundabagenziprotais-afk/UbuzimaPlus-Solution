<?php

namespace App\Services\PharmaCo360;

use Closure;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;

class AtomicPosCheckoutService
{
    /**
     * Execute checkout as one outer database transaction.
     *
     * Existing sale creation, confirmation and payment handlers may use
     * nested transactions. Laravel keeps those operations inside this
     * outer transaction, so a later failure rolls every stage back.
     */
    public function execute(
        string $idempotencyKey,
        Closure $findExisting,
        Closure $createSale,
        Closure $confirmSale,
        Closure $recordPayment
    ): array {
        try {
            return DB::transaction(function () use (
                $idempotencyKey,
                $findExisting,
                $createSale,
                $confirmSale,
                $recordPayment
            ): array {
                $existing = $findExisting($idempotencyKey);

                if ($existing !== null) {
                    return [
                        ...$existing,
                        'idempotent' => true,
                    ];
                }

                $sale = $createSale($idempotencyKey);
                $confirmedSale = $confirmSale($sale);
                $completed = $recordPayment($confirmedSale);

                return [
                    ...$completed,
                    'idempotent' => false,
                ];
            });
        } catch (QueryException $exception) {
            /*
             * A concurrent request may reach the unique checkout-key
             * constraint after the original request commits. Re-read the
             * completed checkout and return it instead of creating a
             * duplicate sale.
             */
            $existing = $findExisting($idempotencyKey);

            if ($existing === null) {
                throw $exception;
            }

            return [
                ...$existing,
                'idempotent' => true,
            ];
        }
    }
}
