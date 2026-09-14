<?php

namespace App\Services\Finance;

use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;

final class FinanceFixedAssetScheduleService
{
    public function rebuild(
        object $asset
    ): array {
        return DB::transaction(
            function () use ($asset): array {
                $q = DB::table(
                    'finance_fixed_asset_depreciation_schedules'
                )
                    ->where(
                        'tenant_id',
                        (int) $asset->tenant_id
                    )
                    ->where(
                        'fixed_asset_id',
                        (int) $asset->id
                    );

                $posted = (clone $q)
                    ->where(
                        fn ($x) =>
                            $x->where(
                                'status',
                                'posted'
                            )
                            ->orWhereNotNull(
                                'journal_entry_id'
                            )
                    )
                    ->exists();

                if ($posted) {
                    throw new RuntimeException(
                        'Depreciation basis is locked after Finance posting starts.'
                    );
                }

                $q->delete();

                $cost = round(
                    (float) $asset->acquisition_cost,
                    4
                );

                $salvage = round(
                    (float) $asset->salvage_value,
                    4
                );

                $life =
                    (int) $asset->useful_life_months;

                $method =
                    (string) $asset->depreciation_method;

                $rate =
                    $asset->declining_balance_rate
                        !== null
                    ? (float)
                        $asset->declining_balance_rate
                    : null;

                if (
                    $cost <= 0
                    || $salvage < 0
                    || $salvage >= $cost
                    || $life < 1
                ) {
                    throw new RuntimeException(
                        'Invalid depreciation inputs.'
                    );
                }

                if (
                    $method === 'declining_balance'
                    && (
                        $rate === null
                        || $rate <= 0
                        || $rate > 1
                    )
                ) {
                    throw new RuntimeException(
                        'Declining-balance annual rate must be > 0 and <= 1.'
                    );
                }

                $start =
                    CarbonImmutable::parse(
                        (string)
                            $asset->in_service_date
                    )->startOfMonth();

                $base = round(
                    $cost - $salvage,
                    4
                );

                $acc = 0.0;
                $book = $cost;

                $sl = round(
                    $base / $life,
                    4
                );

                $mr =
                    $method
                        === 'declining_balance'
                    ? 1 - pow(
                        1 - (float) $rate,
                        1 / 12
                    )
                    : null;

                $rows = [];
                $now = now();

                for (
                    $p = 1;
                    $p <= $life;
                    $p++
                ) {
                    $ps =
                        $start
                            ->addMonths(
                                $p - 1
                            )
                            ->startOfMonth();

                    $pe =
                        $ps->endOfMonth();

                    $opening = round(
                        $book,
                        4
                    );

                    $remaining = round(
                        max(
                            0,
                            $opening
                            - $salvage
                        ),
                        4
                    );

                    $dep =
                        $p === $life
                        ? $remaining
                        : (
                            $method
                                === 'straight_line'
                            ? min(
                                $remaining,
                                $sl
                            )
                            : min(
                                $remaining,
                                round(
                                    $opening
                                    * (float) $mr,
                                    4
                                )
                            )
                        );

                    $dep = round(
                        max(
                            0,
                            $dep
                        ),
                        4
                    );

                    $acc = round(
                        $acc + $dep,
                        4
                    );

                    $book = round(
                        max(
                            $salvage,
                            $cost - $acc
                        ),
                        4
                    );

                    $rows[] = [
                        'uuid' =>
                            (string)
                                Str::uuid(),

                        'tenant_id' =>
                            (int)
                                $asset->tenant_id,

                        'fixed_asset_id' =>
                            (int)
                                $asset->id,

                        'period_number' =>
                            $p,

                        'period_start' =>
                            $ps->toDateString(),

                        'period_end' =>
                            $pe->toDateString(),

                        'opening_book_value' =>
                            $opening,

                        'depreciation_amount' =>
                            $dep,

                        'accumulated_depreciation' =>
                            $acc,

                        'closing_book_value' =>
                            $book,

                        'status' =>
                            'planned',

                        'journal_entry_id' =>
                            null,

                        'posted_by' =>
                            null,

                        'posted_at' =>
                            null,

                        'metadata' =>
                            json_encode(
                                [
                                    'package' =>
                                        'F11_FIXED_ASSETS',

                                    'release' =>
                                        'F11A-R1.1',

                                    'posting_state' =>
                                        'planning_only',

                                    'method' =>
                                        $method,

                                    'declining_balance_rate' =>
                                        $rate,
                                ],
                                JSON_UNESCAPED_SLASHES
                            ),

                        'created_at' =>
                            $now,

                        'updated_at' =>
                            $now,
                    ];
                }

                foreach (
                    array_chunk(
                        $rows,
                        150
                    )
                    as $chunk
                ) {
                    DB::table(
                        'finance_fixed_asset_depreciation_schedules'
                    )->insert(
                        $chunk
                    );
                }

                return DB::table(
                    'finance_fixed_asset_depreciation_schedules'
                )
                    ->where(
                        'tenant_id',
                        (int)
                            $asset->tenant_id
                    )
                    ->where(
                        'fixed_asset_id',
                        (int)
                            $asset->id
                    )
                    ->orderBy(
                        'period_number'
                    )
                    ->get()
                    ->map(
                        fn ($r) =>
                            (array) $r
                    )
                    ->all();
            }
        );
    }
}
