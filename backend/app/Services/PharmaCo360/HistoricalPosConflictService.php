<?php

namespace App\Services\PharmaCo360;

use App\Models\PharmacoSale;
use Carbon\CarbonImmutable;
use Illuminate\Validation\ValidationException;
use Throwable;

class HistoricalPosConflictService
{
    public function normalizeBusinessDate(
        string $businessDate
    ): string {
        $timezone = (string) config(
            'pharmaco.business_timezone',
            'Africa/Kigali'
        );

        try {
            $date = CarbonImmutable::createFromFormat(
                '!Y-m-d',
                $businessDate,
                $timezone
            );
        } catch (Throwable) {
            $date = null;
        }

        if (
            ! $date
            || $date->format('Y-m-d') !== $businessDate
        ) {
            throw ValidationException::withMessages([
                'business_date' => [
                    'Select a valid historical business date.',
                ],
            ]);
        }

        $today = CarbonImmutable::now($timezone)
            ->startOfDay();

        if ($date->greaterThanOrEqualTo($today)) {
            throw ValidationException::withMessages([
                'business_date' => [
                    'Historical POS accepts only dates '
                    . 'before today.',
                ],
            ]);
        }

        $maximumDays = max(
            1,
            (int) config(
                'pharmaco.historical_pos_max_days',
                90
            )
        );

        if ($date->lessThan($today->subDays($maximumDays))) {
            throw ValidationException::withMessages([
                'business_date' => [
                    'The selected date is older than the '
                    . "allowed {$maximumDays}-day period.",
                ],
            ]);
        }

        return $date->toDateString();
    }

    public function liveActivitySummary(
        int $tenantId,
        int $branchId,
        string $businessDate
    ): array {
        $businessDate = $this->normalizeBusinessDate(
            $businessDate
        );

        $query = PharmacoSale::query()
            ->where('tenant_id', $tenantId)
            ->where('branch_id', $branchId)
            ->where('entry_mode', 'live')
            ->whereNotIn(
                'status',
                [
                    'cancelled',
                    'voided',
                ]
            )
            ->where(
                function ($dateQuery) use (
                    $businessDate
                ) {
                    $dateQuery
                        ->whereDate(
                            'business_date',
                            $businessDate
                        )
                        ->orWhere(
                            function ($legacyQuery) use (
                                $businessDate
                            ) {
                                $legacyQuery
                                    ->whereNull(
                                        'business_date'
                                    )
                                    ->where(
                                        function (
                                            $timestampQuery
                                        ) use (
                                            $businessDate
                                        ) {
                                            $timestampQuery
                                                ->whereDate(
                                                    'sold_at',
                                                    $businessDate
                                                )
                                                ->orWhere(
                                                    function (
                                                        $draftQuery
                                                    ) use (
                                                        $businessDate
                                                    ) {
                                                        $draftQuery
                                                            ->whereNull(
                                                                'sold_at'
                                                            )
                                                            ->whereDate(
                                                                'created_at',
                                                                $businessDate
                                                            );
                                                    }
                                                );
                                        }
                                    );
                            }
                        );
                }
            );

        return [
            'business_date' => $businessDate,
            'live_activity_exists' =>
                (clone $query)->exists(),
            'live_activity_count' =>
                (clone $query)->count(),
            'live_activity_total' => round(
                (float) (clone $query)->sum(
                    'total_amount'
                ),
                2
            ),
        ];
    }
}
