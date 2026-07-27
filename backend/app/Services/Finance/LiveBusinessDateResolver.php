<?php

declare(strict_types=1);

namespace App\Services\Finance;

use DateTimeImmutable;
use DateTimeInterface;
use Illuminate\Database\Eloquent\Model;

final class LiveBusinessDateResolver
{
    public function assignPrimaryTimestamp(
        Model $model,
        string $primaryTimestampField,
    ): bool {
        if ($this->mustPreserve($model)) {
            return false;
        }

        $date = $this->calendarDateFromStoredTimestamp(
            $this->rawOrAttribute(
                $model,
                $primaryTimestampField,
            )
        );

        if ($date === null) {
            return false;
        }

        $model->setAttribute(
            'business_date',
            $date
        );

        return true;
    }

    public function assignCreatedAtFallback(
        Model $model,
        string $primaryTimestampField,
    ): bool {
        if ($this->mustPreserve($model)) {
            return false;
        }

        $date = $this->calendarDateFromStoredTimestamp(
            $this->rawOrAttribute(
                $model,
                $primaryTimestampField,
            )
        );

        if ($date === null) {
            $date =
                $this->calendarDateFromStoredTimestamp(
                    $this->rawOrAttribute(
                        $model,
                        $model->getCreatedAtColumn(),
                    )
                );
        }

        if ($date === null) {
            return false;
        }

        $model->setAttribute(
            'business_date',
            $date
        );

        return true;
    }

    public function calendarDateFromStoredTimestamp(
        mixed $timestamp,
    ): ?string {
        if ($timestamp instanceof DateTimeInterface) {
            return $timestamp->format(
                'Y-m-d'
            );
        }

        if (! is_string($timestamp)) {
            return null;
        }

        $timestamp = trim($timestamp);

        if (
            ! preg_match(
                '/^(\d{4}-\d{2}-\d{2})(?:[ T].*)?$/',
                $timestamp,
                $matches
            )
        ) {
            return null;
        }

        $date = $matches[1];

        $parsed =
            DateTimeImmutable::createFromFormat(
                '!Y-m-d',
                $date
            );

        if (
            ! $parsed
            || $parsed->format('Y-m-d')
                !== $date
        ) {
            return null;
        }

        return $date;
    }

    private function mustPreserve(
        Model $model,
    ): bool {
        $businessDate =
            $model->getAttribute(
                'business_date'
            );

        if (
            $businessDate !== null
            && trim(
                (string) $businessDate
            ) !== ''
        ) {
            return true;
        }

        $entryMode = strtolower(
            trim(
                (string) (
                    $this->rawOrAttribute(
                        $model,
                        'entry_mode',
                    )
                    ?? ''
                )
            )
        );

        return $entryMode === 'historical';
    }

    private function rawOrAttribute(
        Model $model,
        string $field,
    ): mixed {
        $raw =
            $model->getRawOriginal(
                $field
            );

        if (
            $raw !== null
            && $raw !== ''
        ) {
            return $raw;
        }

        return $model->getAttribute(
            $field
        );
    }
}
