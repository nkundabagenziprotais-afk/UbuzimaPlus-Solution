<?php

declare(strict_types=1);

namespace App\Database;

use Closure;
use Illuminate\Database\SQLiteConnection;
use Throwable;

final class Php83ImmediateSqliteConnection extends SQLiteConnection
{
    /**
     * PHP < 8.4 PDO SQLite does not track a transaction started by
     * "BEGIN IMMEDIATE" in PDO::inTransaction(). Therefore the entire
     * outer transaction lifecycle must use raw SQLite transaction SQL.
     */
    protected function usesRawImmediateTransactionLifecycle(): bool
    {
        if (version_compare(PHP_VERSION, '8.4.0', '>=')) {
            return false;
        }

        $mode = strtoupper(
            (string) (
                $this->getConfig('transaction_mode')
                ?? 'DEFERRED'
            )
        );

        return $mode === 'IMMEDIATE';
    }

    /**
     * Begin the outermost SQLite transaction.
     */
    protected function executeBeginTransactionStatement()
    {
        if (! $this->usesRawImmediateTransactionLifecycle()) {
            parent::executeBeginTransactionStatement();

            return;
        }

        $this->getPdo()->exec(
            'BEGIN IMMEDIATE TRANSACTION'
        );
    }

    /**
     * Execute a callback inside a transaction while preserving Laravel's
     * counters, nested savepoints, transaction manager and retry semantics.
     */
    public function transaction(Closure $callback, $attempts = 1)
    {
        if (! $this->usesRawImmediateTransactionLifecycle()) {
            return parent::transaction(
                $callback,
                $attempts
            );
        }

        for (
            $currentAttempt = 1;
            $currentAttempt <= $attempts;
            $currentAttempt++
        ) {
            $this->beginTransaction();

            try {
                $callbackResult = $callback($this);
            } catch (Throwable $e) {
                $this->handleTransactionException(
                    $e,
                    $currentAttempt,
                    $attempts
                );

                continue;
            }

            $levelBeingCommitted = $this->transactions;

            try {
                if ($this->transactions == 1) {
                    $this->fireConnectionEvent(
                        'committing'
                    );

                    $this->getPdo()->exec(
                        'COMMIT'
                    );
                }

                $this->transactions = max(
                    0,
                    $this->transactions - 1
                );
            } catch (Throwable $e) {
                $this->handleCommitTransactionException(
                    $e,
                    $currentAttempt,
                    $attempts
                );

                continue;
            }

            $this->transactionsManager?->commit(
                $this->getName(),
                $levelBeingCommitted,
                $this->transactions
            );

            $this->fireConnectionEvent(
                'committed'
            );

            return $callbackResult;
        }
    }

    /**
     * Commit the active transaction.
     *
     * Nested transactions remain Laravel savepoints; only transaction
     * level 1 requires a real SQLite COMMIT.
     */
    public function commit()
    {
        if (! $this->usesRawImmediateTransactionLifecycle()) {
            parent::commit();

            return;
        }

        if ($this->transactionLevel() == 1) {
            $this->fireConnectionEvent('committing');

            $this->getPdo()->exec('COMMIT');
        }

        [
            $levelBeingCommitted,
            $this->transactions,
        ] = [
            $this->transactions,
            max(0, $this->transactions - 1),
        ];

        $this->transactionsManager?->commit(
            $this->getName(),
            $levelBeingCommitted,
            $this->transactions
        );

        $this->fireConnectionEvent('committed');
    }

    /**
     * Preserve Laravel's commit-retry bookkeeping while ensuring a failed
     * raw SQLite outer transaction is actually rolled back before retry.
     */
    protected function handleCommitTransactionException(
        Throwable $e,
        $currentAttempt,
        $maxAttempts
    ) {
        if (! $this->usesRawImmediateTransactionLifecycle()) {
            parent::handleCommitTransactionException(
                $e,
                $currentAttempt,
                $maxAttempts
            );

            return;
        }

        $this->transactions = max(
            0,
            $this->transactions - 1
        );

        if (
            $this->causedByConcurrencyError($e)
            && $currentAttempt < $maxAttempts
        ) {
            $this->getPdo()->exec('ROLLBACK');

            return;
        }

        if ($this->causedByLostConnection($e)) {
            $this->transactions = 0;
        }

        throw $e;
    }

    /**
     * Roll back the actual outer SQLite transaction using raw SQL because
     * PDO::inTransaction() is false for raw BEGIN IMMEDIATE on PHP 8.3.
     */
    protected function performRollBack($toLevel)
    {
        if (
            $this->usesRawImmediateTransactionLifecycle()
            && $toLevel == 0
        ) {
            $this->getPdo()->exec('ROLLBACK');

            return;
        }

        parent::performRollBack($toLevel);
    }
}
