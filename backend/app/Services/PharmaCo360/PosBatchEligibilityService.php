<?php

namespace App\Services\PharmaCo360;

use DateTimeImmutable;
use DateTimeInterface;
use InvalidArgumentException;

/**
 * Owns the shared POS expiry-date eligibility rule.
 *
 * A dated batch is eligible when:
 *
 *     expiry_date >= business_date
 *
 * Undated batches may remain eligible where the configured product or
 * dispensing policy permits products without an expiry date.
 */
final class PosBatchEligibilityService
{
    public function isExpiryEligible(
        string|DateTimeInterface|null $expiryDate,
        string|DateTimeInterface $businessDate,
        bool $allowUndated = true
    ): bool {
        if ($expiryDate === null || $expiryDate === '') {
            return $allowUndated;
        }

        return $this->dateOnly($expiryDate)
            >= $this->dateOnly($businessDate);
    }

    /**
     * Apply the shared inclusive expiry rule to an Eloquent or query builder.
     *
     * @template TQuery of object
     *
     * @param TQuery $query
     *
     * @return TQuery
     */
    public function applyExpiryEligibility(
        object $query,
        string|DateTimeInterface $businessDate,
        string $column = 'expiry_date',
        bool $allowUndated = true
    ): object {
        if (! method_exists($query, 'where')) {
            throw new InvalidArgumentException(
                'The supplied query must support where clauses.'
            );
        }

        if (! preg_match(
            '/^[A-Za-z_][A-Za-z0-9_.]*$/',
            $column
        )) {
            throw new InvalidArgumentException(
                'The expiry-date column name is invalid.'
            );
        }

        $date = $this->dateOnly($businessDate);

        return $query->where(
            static function ($nested) use (
                $allowUndated,
                $column,
                $date
            ): void {
                if ($allowUndated) {
                    $nested
                        ->whereNull($column)
                        ->orWhereDate(
                            $column,
                            '>=',
                            $date
                        );

                    return;
                }

                $nested->whereDate(
                    $column,
                    '>=',
                    $date
                );
            }
        );
    }

    private function dateOnly(
        string|DateTimeInterface $value
    ): string {
        if ($value instanceof DateTimeInterface) {
            return $value->format('Y-m-d');
        }

        $value = trim($value);

        $date = DateTimeImmutable::createFromFormat(
            '!Y-m-d',
            $value
        );

        $errors = DateTimeImmutable::getLastErrors();

        $hasParsingErrors = $errors !== false
            && (
                $errors['warning_count'] > 0
                || $errors['error_count'] > 0
            );

        if (
            $date === false
            || $hasParsingErrors
            || $date->format('Y-m-d') !== $value
        ) {
            throw new InvalidArgumentException(
                'Business and expiry dates must use YYYY-MM-DD.'
            );
        }

        return $date->format('Y-m-d');
    }
}
