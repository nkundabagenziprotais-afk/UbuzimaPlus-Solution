<?php

namespace App\Services\Tax;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Validation\ValidationException;

final class EffectiveDateOverlapGuard
{
    public function assertNoOverlap(
        Builder $scope,
        string $effectiveFrom,
        ?string $effectiveTo = null,
        ?int $ignoreId = null,
        string $fromColumn = 'effective_from',
        string $toColumn = 'effective_to',
        string $errorField = 'effective_from'
    ): void {
        $from = CarbonImmutable::parse(
            $effectiveFrom
        )->startOfDay();

        $to = $effectiveTo
            ? CarbonImmutable::parse($effectiveTo)->startOfDay()
            : null;

        if ($to && $to->lessThan($from)) {
            throw ValidationException::withMessages([
                'effective_to' => [
                    'The effective-to date cannot be before '
                    .'the effective-from date.',
                ],
            ]);
        }

        $query = clone $scope;

        if ($ignoreId !== null) {
            $query->where(
                $query->getModel()->getQualifiedKeyName(),
                '!=',
                $ignoreId
            );
        }

        $query->where(function (Builder $query) use (
            $toColumn,
            $from
        ): void {
            $query
                ->whereNull($toColumn)
                ->orWhereDate(
                    $toColumn,
                    '>=',
                    $from->toDateString()
                );
        });

        if ($to !== null) {
            $query->whereDate(
                $fromColumn,
                '<=',
                $to->toDateString()
            );
        }

        if ($query->exists()) {
            throw ValidationException::withMessages([
                $errorField => [
                    'The effective period overlaps an existing '
                    .'configuration for the same scope.',
                ],
            ]);
        }
    }
}
