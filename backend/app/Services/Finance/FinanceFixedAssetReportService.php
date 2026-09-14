<?php

namespace App\Services\Finance;

use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class FinanceFixedAssetReportService
{
    private const RELEASE =
        'F11D-A-R1.1';

    public function summary(
        int $tenantId,
        ?int $branchId,
        string $asOf,
    ): array {
        $assets =
            $this->assetQuery(
                $tenantId,
                $branchId
            )
            ->where(
                'acquisition_date',
                '<=',
                $asOf
            )
            ->orderBy(
                'id'
            )
            ->get();

        $assetIds =
            $assets
                ->pluck('id')
                ->map(
                    fn ($id): int =>
                        (int) $id
                )
                ->values()
                ->all();

        $depreciation =
            $this->depreciationMap(
                $tenantId,
                $assetIds,
                $asOf,
            );

        $disposals =
            $this->postedDisposalMap(
                $tenantId,
                $assetIds,
                $asOf,
            );

        $currencySummaries = [];

        $activeCount = 0;
        $disposedCount = 0;

        foreach ($assets as $asset) {
            $assetId =
                (int)
                    $asset->id;

            $currency =
                strtoupper(
                    (string)
                        $asset
                            ->currency_code
                );

            if (! isset(
                $currencySummaries[
                    $currency
                ]
            )) {
                $currencySummaries[
                    $currency
                ] = [
                    'currency_code' =>
                        $currency,

                    'gross_acquisition_cost' =>
                        0.0,

                    'active_acquisition_cost' =>
                        0.0,

                    'disposed_acquisition_cost' =>
                        0.0,

                    'lifetime_posted_depreciation' =>
                        0.0,

                    'active_accumulated_depreciation' =>
                        0.0,

                    'active_net_book_value' =>
                        0.0,

                    'disposal_proceeds' =>
                        0.0,

                    'disposal_gain' =>
                        0.0,

                    'disposal_loss' =>
                        0.0,
                ];
            }

            $cost =
                round(
                    (float)
                        $asset
                            ->acquisition_cost,
                    4
                );

            $postedDepreciation =
                round(
                    (float)
                        (
                            $depreciation[
                                $assetId
                            ][
                                'posted_amount'
                            ]
                            ?? 0
                        ),
                    4
                );

            $disposedAsOf =
                isset(
                    $disposals[
                        $assetId
                    ]
                );

            $currencySummaries[
                $currency
            ][
                'gross_acquisition_cost'
            ] += $cost;

            $currencySummaries[
                $currency
            ][
                'lifetime_posted_depreciation'
            ] += $postedDepreciation;

            if ($disposedAsOf) {
                $disposedCount++;

                $currencySummaries[
                    $currency
                ][
                    'disposed_acquisition_cost'
                ] += $cost;

                $disposal =
                    $disposals[
                        $assetId
                    ];

                $proceeds =
                    round(
                        (float)
                            $disposal
                                ->proceeds_amount,
                        4
                    );

                $gainLoss =
                    round(
                        (float)
                            $disposal
                                ->gain_loss,
                        4
                    );

                $currencySummaries[
                    $currency
                ][
                    'disposal_proceeds'
                ] += $proceeds;

                if ($gainLoss >= 0) {
                    $currencySummaries[
                        $currency
                    ][
                        'disposal_gain'
                    ] += $gainLoss;
                } else {
                    $currencySummaries[
                        $currency
                    ][
                        'disposal_loss'
                    ] += abs(
                        $gainLoss
                    );
                }

            } else {

                $activeCount++;

                $currencySummaries[
                    $currency
                ][
                    'active_acquisition_cost'
                ] += $cost;

                $currencySummaries[
                    $currency
                ][
                    'active_accumulated_depreciation'
                ] += $postedDepreciation;

                $currencySummaries[
                    $currency
                ][
                    'active_net_book_value'
                ] += max(
                    round(
                        $cost
                        -
                        $postedDepreciation,
                        4
                    ),
                    0
                );
            }
        }

        foreach (
            $currencySummaries
            as &$summary
        ) {
            foreach (
                [
                    'gross_acquisition_cost',
                    'active_acquisition_cost',
                    'disposed_acquisition_cost',
                    'lifetime_posted_depreciation',
                    'active_accumulated_depreciation',
                    'active_net_book_value',
                    'disposal_proceeds',
                    'disposal_gain',
                    'disposal_loss',
                ]
                as $key
            ) {
                $summary[
                    $key
                ] =
                    round(
                        (float)
                            $summary[
                                $key
                            ],
                        4
                    );
            }
        }

        unset($summary);

        ksort(
            $currencySummaries
        );

        return [
            'release' =>
                self::RELEASE,

            'as_of' =>
                $asOf,

            'counts' => [
                'registered' =>
                    $assets
                        ->count(),

                'active' =>
                    $activeCount,

                'disposed' =>
                    $disposedCount,
            ],

            /*
             * Never aggregate monetary totals across currencies.
             */
            'currency_summaries' =>
                array_values(
                    $currencySummaries
                ),
        ];
    }

    public function register(
        int $tenantId,
        ?int $branchId,
        array $filters,
    ): array {
        $asOf =
            (string)
                $filters[
                    'as_of'
                ];

        $query =
            $this->assetQuery(
                $tenantId,
                $branchId
            )
            ->where(
                'acquisition_date',
                '<=',
                $asOf
            );

        $search =
            trim(
                (string)
                    (
                        $filters[
                            'search'
                        ]
                        ?? ''
                    )
            );

        if ($search !== '') {
            $needle =
                '%'
                . $search
                . '%';

            $query->where(
                function (
                    Builder $inner
                ) use (
                    $needle
                ): void {
                    $inner
                        ->where(
                            'asset_number',
                            'like',
                            $needle
                        )
                        ->orWhere(
                            'name',
                            'like',
                            $needle
                        )
                        ->orWhere(
                            'serial_number',
                            'like',
                            $needle
                        )
                        ->orWhere(
                            'location_name',
                            'like',
                            $needle
                        )
                        ->orWhere(
                            'custodian_name',
                            'like',
                            $needle
                        );
                }
            );
        }

        $assetClass =
            trim(
                (string)
                    (
                        $filters[
                            'asset_class'
                        ]
                        ?? ''
                    )
            );

        if ($assetClass !== '') {
            $query->where(
                'asset_class',
                $assetClass
            );
        }

        $assets =
            $query
                ->orderBy(
                    'asset_number'
                )
                ->get();

        $ids =
            $assets
                ->pluck('id')
                ->map(
                    fn ($id): int =>
                        (int) $id
                )
                ->values()
                ->all();

        $depreciation =
            $this->depreciationMap(
                $tenantId,
                $ids,
                $asOf,
            );

        $scheduleStates =
            $this->scheduleStateMap(
                $tenantId,
                $ids,
            );

        $disposals =
            $this->postedDisposalMap(
                $tenantId,
                $ids,
                $asOf,
            );

        $requestedStatus =
            (string)
                (
                    $filters[
                        'status'
                    ]
                    ?? 'all'
                );

        $rows = [];

        foreach ($assets as $asset) {
            $id =
                (int)
                    $asset->id;

            $disposal =
                $disposals[
                    $id
                ]
                ?? null;

            $statusAsOf =
                $disposal
                    ? 'disposed'
                    : 'active';

            if (
                $requestedStatus !== 'all'
                &&
                $statusAsOf !== $requestedStatus
            ) {
                continue;
            }

            $postedDepreciation =
                round(
                    (float)
                        (
                            $depreciation[
                                $id
                            ][
                                'posted_amount'
                            ]
                            ?? 0
                        ),
                    4
                );

            $cost =
                round(
                    (float)
                        $asset
                            ->acquisition_cost,
                    4
                );

            $bookValue =
                $disposal
                    ? 0.0
                    : max(
                        round(
                            $cost
                            -
                            $postedDepreciation,
                            4
                        ),
                        0
                    );

            $states =
                $scheduleStates[
                    $id
                ]
                ?? [
                    'total' => 0,
                    'posted' => 0,
                    'planned' => 0,
                    'cancelled' => 0,
                ];

            $rows[] = [
                'uuid' =>
                    (string)
                        $asset->uuid,

                'asset_number' =>
                    (string)
                        $asset
                            ->asset_number,

                'name' =>
                    (string)
                        $asset->name,

                'branch_id' =>
                    $asset->branch_id
                        !== null
                    ? (int)
                        $asset
                            ->branch_id
                    : null,

                'asset_class' =>
                    (string)
                        $asset
                            ->asset_class,

                'acquisition_date' =>
                    (string)
                        $asset
                            ->acquisition_date,

                'in_service_date' =>
                    (string)
                        $asset
                            ->in_service_date,

                'acquisition_cost' =>
                    $cost,

                'salvage_value' =>
                    round(
                        (float)
                            $asset
                                ->salvage_value,
                        4
                    ),

                'posted_accumulated_depreciation' =>
                    $postedDepreciation,

                'net_book_value_as_of' =>
                    $bookValue,

                'currency_code' =>
                    (string)
                        $asset
                            ->currency_code,

                'depreciation_method' =>
                    (string)
                        $asset
                            ->depreciation_method,

                'useful_life_months' =>
                    (int)
                        $asset
                            ->useful_life_months,

                'status_as_of' =>
                    $statusAsOf,

                'current_status' =>
                    (string)
                        $asset
                            ->status,

                'serial_number' =>
                    $asset
                        ->serial_number,

                'location_name' =>
                    $asset
                        ->location_name,

                'custodian_name' =>
                    $asset
                        ->custodian_name,

                'purchase_reference' =>
                    $asset
                        ->purchase_reference,

                'schedule_counts' =>
                    $states,

                'disposal' =>
                    $disposal
                    ? [
                        'uuid' =>
                            (string)
                                $disposal
                                    ->uuid,

                        'disposal_date' =>
                            (string)
                                $disposal
                                    ->disposal_date,

                        'disposal_type' =>
                            (string)
                                $disposal
                                    ->disposal_type,

                        'proceeds_amount' =>
                            round(
                                (float)
                                    $disposal
                                        ->proceeds_amount,
                                4
                            ),

                        'book_value_at_disposal' =>
                            round(
                                (float)
                                    $disposal
                                        ->book_value_at_disposal,
                                4
                            ),

                        'gain_loss' =>
                            round(
                                (float)
                                    $disposal
                                        ->gain_loss,
                                4
                            ),

                        'journal_entry_id' =>
                            $disposal
                                ->journal_entry_id
                                !== null
                            ? (int)
                                $disposal
                                    ->journal_entry_id
                            : null,
                    ]
                    : null,
            ];
        }

        return $this->paginate(
            $rows,
            (int)
                $filters[
                    'page'
                ],
            (int)
                $filters[
                    'per_page'
                ],
            [
                'release' =>
                    self::RELEASE,

                'as_of' =>
                    $asOf,
            ]
        );
    }

    public function depreciation(
        int $tenantId,
        ?int $branchId,
        array $filters,
    ): array {
        $this->validateRange(
            $filters[
                'from'
            ]
            ?? null,
            $filters[
                'to'
            ]
            ?? null,
        );

        $query =
            DB::table(
                'finance_fixed_asset_depreciation_schedules as s'
            )
            ->join(
                'finance_fixed_assets as a',
                'a.id',
                '=',
                's.fixed_asset_id'
            )
            ->leftJoin(
                'finance_journal_entries as j',
                'j.id',
                '=',
                's.journal_entry_id'
            )
            ->where(
                's.tenant_id',
                $tenantId
            )
            ->where(
                'a.tenant_id',
                $tenantId
            );

        if ($branchId !== null) {
            $query->where(
                'a.branch_id',
                $branchId
            );
        }

        if (
            ! empty(
                $filters[
                    'from'
                ]
            )
        ) {
            $query->where(
                's.period_end',
                '>=',
                $filters[
                    'from'
                ]
            );
        }

        if (
            ! empty(
                $filters[
                    'to'
                ]
            )
        ) {
            $query->where(
                's.period_end',
                '<=',
                $filters[
                    'to'
                ]
            );
        }

        $status =
            (string)
                (
                    $filters[
                        'status'
                    ]
                    ?? 'all'
                );

        if ($status !== 'all') {
            $query->where(
                's.status',
                $status
            );
        }

        $search =
            trim(
                (string)
                    (
                        $filters[
                            'search'
                        ]
                        ?? ''
                    )
            );

        if ($search !== '') {
            $needle =
                '%'
                . $search
                . '%';

            $query->where(
                function (
                    Builder $inner
                ) use (
                    $needle
                ): void {
                    $inner
                        ->where(
                            'a.asset_number',
                            'like',
                            $needle
                        )
                        ->orWhere(
                            'a.name',
                            'like',
                            $needle
                        );
                }
            );
        }

        $all =
            (clone $query)
                ->select([
                    's.id',
                    's.uuid',
                    's.fixed_asset_id',
                    's.period_number',
                    's.period_start',
                    's.period_end',
                    's.opening_book_value',
                    's.depreciation_amount',
                    's.accumulated_depreciation',
                    's.closing_book_value',
                    's.status',
                    's.journal_entry_id',
                    's.posted_by',
                    's.posted_at',

                    'a.uuid as asset_uuid',
                    'a.asset_number',
                    'a.name as asset_name',
                    'a.asset_class',
                    'a.currency_code',

                    'j.journal_number',
                ])
                ->orderBy(
                    'a.asset_number'
                )
                ->orderBy(
                    's.period_number'
                )
                ->get();

        $summary = [];

        foreach ($all as $row) {
            $currency =
                strtoupper(
                    (string)
                        $row
                            ->currency_code
                );

            if (! isset(
                $summary[
                    $currency
                ]
            )) {
                $summary[
                    $currency
                ] = [
                    'currency_code' =>
                        $currency,

                    'posted_amount' =>
                        0.0,

                    'planned_amount' =>
                        0.0,

                    'cancelled_amount' =>
                        0.0,
                ];
            }

            $statusKey =
                strtolower(
                    (string)
                        $row
                            ->status
                )
                . '_amount';

            if (array_key_exists(
                $statusKey,
                $summary[
                    $currency
                ]
            )) {
                $summary[
                    $currency
                ][
                    $statusKey
                ] +=
                    (float)
                        $row
                            ->depreciation_amount;
            }
        }

        foreach (
            $summary
            as &$currencyRow
        ) {
            foreach (
                [
                    'posted_amount',
                    'planned_amount',
                    'cancelled_amount',
                ]
                as $key
            ) {
                $currencyRow[
                    $key
                ] =
                    round(
                        (float)
                            $currencyRow[
                                $key
                            ],
                        4
                    );
            }
        }

        unset($currencyRow);

        ksort(
            $summary
        );

        $rows =
            $all
                ->map(
                    fn (object $row): array => [
                        'uuid' =>
                            (string)
                                $row
                                    ->uuid,

                        'asset_uuid' =>
                            (string)
                                $row
                                    ->asset_uuid,

                        'asset_number' =>
                            (string)
                                $row
                                    ->asset_number,

                        'asset_name' =>
                            (string)
                                $row
                                    ->asset_name,

                        'asset_class' =>
                            (string)
                                $row
                                    ->asset_class,

                        'period_number' =>
                            (int)
                                $row
                                    ->period_number,

                        'period_start' =>
                            (string)
                                $row
                                    ->period_start,

                        'period_end' =>
                            (string)
                                $row
                                    ->period_end,

                        'opening_book_value' =>
                            round(
                                (float)
                                    $row
                                        ->opening_book_value,
                                4
                            ),

                        'depreciation_amount' =>
                            round(
                                (float)
                                    $row
                                        ->depreciation_amount,
                                4
                            ),

                        'accumulated_depreciation' =>
                            round(
                                (float)
                                    $row
                                        ->accumulated_depreciation,
                                4
                            ),

                        'closing_book_value' =>
                            round(
                                (float)
                                    $row
                                        ->closing_book_value,
                                4
                            ),

                        'status' =>
                            (string)
                                $row
                                    ->status,

                        'journal_entry_id' =>
                            $row
                                ->journal_entry_id
                                !== null
                            ? (int)
                                $row
                                    ->journal_entry_id
                            : null,

                        'journal_number' =>
                            $row
                                ->journal_number,

                        'posted_by' =>
                            $row
                                ->posted_by
                                !== null
                            ? (int)
                                $row
                                    ->posted_by
                            : null,

                        'posted_at' =>
                            $row
                                ->posted_at,

                        'currency_code' =>
                            (string)
                                $row
                                    ->currency_code,
                    ]
                )
                ->values()
                ->all();

        return $this->paginate(
            $rows,
            (int)
                $filters[
                    'page'
                ],
            (int)
                $filters[
                    'per_page'
                ],
            [
                'release' =>
                    self::RELEASE,

                'from' =>
                    $filters[
                        'from'
                    ]
                    ?? null,

                'to' =>
                    $filters[
                        'to'
                    ]
                    ?? null,

                'currency_summaries' =>
                    array_values(
                        $summary
                    ),
            ]
        );
    }

    public function disposals(
        int $tenantId,
        ?int $branchId,
        array $filters,
    ): array {
        $this->validateRange(
            $filters[
                'from'
            ]
            ?? null,
            $filters[
                'to'
            ]
            ?? null,
        );

        $query =
            DB::table(
                'finance_fixed_asset_disposals as d'
            )
            ->join(
                'finance_fixed_assets as a',
                'a.id',
                '=',
                'd.fixed_asset_id'
            )
            ->leftJoin(
                'finance_journal_entries as j',
                'j.id',
                '=',
                'd.journal_entry_id'
            )
            ->where(
                'd.tenant_id',
                $tenantId
            )
            ->where(
                'a.tenant_id',
                $tenantId
            );

        if ($branchId !== null) {
            $query->where(
                'a.branch_id',
                $branchId
            );
        }

        if (
            ! empty(
                $filters[
                    'from'
                ]
            )
        ) {
            $query->where(
                'd.disposal_date',
                '>=',
                $filters[
                    'from'
                ]
            );
        }

        if (
            ! empty(
                $filters[
                    'to'
                ]
            )
        ) {
            $query->where(
                'd.disposal_date',
                '<=',
                $filters[
                    'to'
                ]
            );
        }

        $status =
            (string)
                (
                    $filters[
                        'status'
                    ]
                    ?? 'all'
                );

        if ($status !== 'all') {
            $query->where(
                'd.status',
                $status
            );
        }

        $type =
            (string)
                (
                    $filters[
                        'disposal_type'
                    ]
                    ?? 'all'
                );

        if ($type !== 'all') {
            $query->where(
                'd.disposal_type',
                $type
            );
        }

        $search =
            trim(
                (string)
                    (
                        $filters[
                            'search'
                        ]
                        ?? ''
                    )
            );

        if ($search !== '') {
            $needle =
                '%'
                . $search
                . '%';

            $query->where(
                function (
                    Builder $inner
                ) use (
                    $needle
                ): void {
                    $inner
                        ->where(
                            'a.asset_number',
                            'like',
                            $needle
                        )
                        ->orWhere(
                            'a.name',
                            'like',
                            $needle
                        );
                }
            );
        }

        $rows =
            $query
                ->select([
                    'd.id',
                    'd.uuid',
                    'd.disposal_date',
                    'd.disposal_type',
                    'd.proceeds_amount',
                    'd.book_value_at_disposal',
                    'd.gain_loss',
                    'd.status',
                    'd.journal_entry_id',
                    'd.created_by',
                    'd.approved_by',
                    'd.created_at',
                    'd.updated_at',

                    'a.uuid as asset_uuid',
                    'a.asset_number',
                    'a.name as asset_name',
                    'a.asset_class',
                    'a.acquisition_cost',
                    'a.currency_code',

                    'j.journal_number',
                    'j.business_date as journal_business_date',
                ])
                ->orderByDesc(
                    'd.disposal_date'
                )
                ->orderByDesc(
                    'd.id'
                )
                ->get()
                ->map(
                    fn (object $row): array => [
                        'uuid' =>
                            (string)
                                $row
                                    ->uuid,

                        'asset_uuid' =>
                            (string)
                                $row
                                    ->asset_uuid,

                        'asset_number' =>
                            (string)
                                $row
                                    ->asset_number,

                        'asset_name' =>
                            (string)
                                $row
                                    ->asset_name,

                        'asset_class' =>
                            (string)
                                $row
                                    ->asset_class,

                        'acquisition_cost' =>
                            round(
                                (float)
                                    $row
                                        ->acquisition_cost,
                                4
                            ),

                        'disposal_date' =>
                            (string)
                                $row
                                    ->disposal_date,

                        'disposal_type' =>
                            (string)
                                $row
                                    ->disposal_type,

                        'proceeds_amount' =>
                            round(
                                (float)
                                    $row
                                        ->proceeds_amount,
                                4
                            ),

                        'book_value_at_disposal' =>
                            round(
                                (float)
                                    $row
                                        ->book_value_at_disposal,
                                4
                            ),

                        'gain_loss' =>
                            round(
                                (float)
                                    $row
                                        ->gain_loss,
                                4
                            ),

                        'status' =>
                            (string)
                                $row
                                    ->status,

                        'journal_entry_id' =>
                            $row
                                ->journal_entry_id
                                !== null
                            ? (int)
                                $row
                                    ->journal_entry_id
                            : null,

                        'journal_number' =>
                            $row
                                ->journal_number,

                        'journal_business_date' =>
                            $row
                                ->journal_business_date,

                        'created_by' =>
                            $row
                                ->created_by
                                !== null
                            ? (int)
                                $row
                                    ->created_by
                            : null,

                        'approved_by' =>
                            $row
                                ->approved_by
                                !== null
                            ? (int)
                                $row
                                    ->approved_by
                            : null,

                        'currency_code' =>
                            (string)
                                $row
                                    ->currency_code,

                        'created_at' =>
                            $row
                                ->created_at,

                        'updated_at' =>
                            $row
                                ->updated_at,
                    ]
                )
                ->values()
                ->all();

        return $this->paginate(
            $rows,
            (int)
                $filters[
                    'page'
                ],
            (int)
                $filters[
                    'per_page'
                ],
            [
                'release' =>
                    self::RELEASE,
            ]
        );
    }

    private function assetQuery(
        int $tenantId,
        ?int $branchId,
    ): Builder {
        $query =
            DB::table(
                'finance_fixed_assets'
            )
            ->where(
                'tenant_id',
                $tenantId
            );

        if ($branchId !== null) {
            $query->where(
                'branch_id',
                $branchId
            );
        }

        return $query;
    }

    private function depreciationMap(
        int $tenantId,
        array $assetIds,
        string $asOf,
    ): array {
        if ($assetIds === []) {
            return [];
        }

        $rows =
            DB::table(
                'finance_fixed_asset_depreciation_schedules'
            )
            ->where(
                'tenant_id',
                $tenantId
            )
            ->whereIn(
                'fixed_asset_id',
                $assetIds
            )
            ->where(
                'period_end',
                '<=',
                $asOf
            )
            ->where(
                'status',
                'posted'
            )
            ->whereNotNull(
                'journal_entry_id'
            )
            ->selectRaw(
                '
                fixed_asset_id,
                COUNT(*) AS posted_count,
                COALESCE(
                    SUM(
                        CAST(
                            depreciation_amount
                            AS REAL
                        )
                    ),
                    0
                ) AS posted_amount
                '
            )
            ->groupBy(
                'fixed_asset_id'
            )
            ->get();

        $result = [];

        foreach ($rows as $row) {
            $result[
                (int)
                    $row
                        ->fixed_asset_id
            ] = [
                'posted_count' =>
                    (int)
                        $row
                            ->posted_count,

                'posted_amount' =>
                    round(
                        (float)
                            $row
                                ->posted_amount,
                        4
                    ),
            ];
        }

        return $result;
    }

    private function scheduleStateMap(
        int $tenantId,
        array $assetIds,
    ): array {
        if ($assetIds === []) {
            return [];
        }

        $rows =
            DB::table(
                'finance_fixed_asset_depreciation_schedules'
            )
            ->where(
                'tenant_id',
                $tenantId
            )
            ->whereIn(
                'fixed_asset_id',
                $assetIds
            )
            ->select([
                'fixed_asset_id',
                'status',
            ])
            ->get();

        $result = [];

        foreach ($assetIds as $id) {
            $result[
                $id
            ] = [
                'total' => 0,
                'posted' => 0,
                'planned' => 0,
                'cancelled' => 0,
            ];
        }

        foreach ($rows as $row) {
            $id =
                (int)
                    $row
                        ->fixed_asset_id;

            $status =
                strtolower(
                    (string)
                        $row
                            ->status
                );

            $result[
                $id
            ][
                'total'
            ]++;

            if (array_key_exists(
                $status,
                $result[
                    $id
                ]
            )) {
                $result[
                    $id
                ][
                    $status
                ]++;
            }
        }

        return $result;
    }

    private function postedDisposalMap(
        int $tenantId,
        array $assetIds,
        string $asOf,
    ): array {
        if ($assetIds === []) {
            return [];
        }

        $rows =
            DB::table(
                'finance_fixed_asset_disposals'
            )
            ->where(
                'tenant_id',
                $tenantId
            )
            ->whereIn(
                'fixed_asset_id',
                $assetIds
            )
            ->where(
                'status',
                'posted'
            )
            ->whereNotNull(
                'journal_entry_id'
            )
            ->where(
                'disposal_date',
                '<=',
                $asOf
            )
            ->orderByDesc(
                'disposal_date'
            )
            ->orderByDesc(
                'id'
            )
            ->get();

        $result = [];

        foreach ($rows as $row) {
            $id =
                (int)
                    $row
                        ->fixed_asset_id;

            if (! isset(
                $result[
                    $id
                ]
            )) {
                $result[
                    $id
                ] = $row;
            }
        }

        return $result;
    }

    private function paginate(
        array $rows,
        int $page,
        int $perPage,
        array $extra = [],
    ): array {
        $total =
            count(
                $rows
            );

        $offset =
            max(
                ($page - 1)
                *
                $perPage,
                0
            );

        return array_merge(
            $extra,
            [
                'data' =>
                    array_values(
                        array_slice(
                            $rows,
                            $offset,
                            $perPage
                        )
                    ),

                'meta' => [
                    'page' =>
                        $page,

                    'per_page' =>
                        $perPage,

                    'total' =>
                        $total,

                    'last_page' =>
                        max(
                            1,
                            (int)
                                ceil(
                                    $total
                                    /
                                    $perPage
                                )
                        ),
                ],
            ]
        );
    }

    private function validateRange(
        ?string $from,
        ?string $to,
    ): void {
        if (
            $from !== null
            &&
            $to !== null
            &&
            $from > $to
        ) {
            throw ValidationException::withMessages([
                'from' => [
                    'The report From date cannot be after the To date.',
                ],
            ]);
        }
    }
}
