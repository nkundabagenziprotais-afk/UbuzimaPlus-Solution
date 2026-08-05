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
            return $this->runTransactionWithBackoff(function () use (
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
    /**
     * Retry the complete atomic checkout for genuine database
     * concurrency conflicts. Laravel may wrap the original database
     * exception, so the complete Throwable chain is inspected.
     */
    private function runTransactionWithBackoff(
        \Closure $callback
    ): array {
        $maximumAttempts = 8;
        $attempt = 0;

        while (true) {
            $attempt++;

            try {
                return DB::transaction($callback);
            } catch (\Throwable $exception) {
                if (
                    $attempt >= $maximumAttempts
                    || ! $this->isRetryableConcurrencyFailure($exception)
                ) {
                    throw $exception;
                }

                $baseDelayMicroseconds = min(75000 * $attempt, 525000);
                $jitterMicroseconds = random_int(1000, 25000);
                usleep($baseDelayMicroseconds + $jitterMicroseconds);
            }
        }
    }

    private function isRetryableConcurrencyFailure(
        \Throwable $exception
    ): bool {
        for ($current = $exception; $current !== null; $current = $current->getPrevious()) {
            $message = strtolower($current->getMessage());
            $code = strtoupper((string) $current->getCode());
            $errorInfo = [];

            if ($current instanceof \Illuminate\Database\QueryException) {
                $errorInfo = is_array($current->errorInfo) ? $current->errorInfo : [];
            } elseif (property_exists($current, 'errorInfo') && is_array($current->errorInfo)) {
                $errorInfo = $current->errorInfo;
            }

            $sqlState = strtoupper((string) ($errorInfo[0] ?? $code));
            $driverCode = (string) ($errorInfo[1] ?? '');

            if (in_array($driverCode, ['5', '6', '1205', '1213'], true)) {
                return true;
            }

            if (in_array($sqlState, ['40001', '40P01'], true)) {
                return true;
            }

            foreach ([
                'database is locked',
                'database table is locked',
                'database schema is locked',
                'deadlock found',
                'deadlock exception',
                'lock wait timeout exceeded',
                'serialization failure',
                'could not serialize access',
                'could not obtain lock',
                'concurrent update',
            ] as $fragment) {
                if (str_contains($message, $fragment)) {
                    return true;
                }
            }
        }

        return false;
    }
}
