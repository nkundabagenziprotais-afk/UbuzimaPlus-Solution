<?php

namespace App\Http\Controllers\Api\V1\PharmaCo360;

use App\Http\Controllers\Controller;
use App\Models\Tenant;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class InventoryIntelligenceController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $tenant = $this->resolveTenant($request);

        $validated = $request->validate([
            'branch_id' => [
                'nullable',
                'integer',
                'min:1',
            ],
        ]);

        $branchId = isset($validated['branch_id'])
            ? (int) $validated['branch_id']
            : null;

        $timezone = (string) config(
            'pharmaco.business_timezone',
            'Africa/Kigali',
        );

        $today = CarbonImmutable::now(
            $timezone,
        )->startOfDay();

        $weekStart = $today->startOfWeek(
            CarbonImmutable::SUNDAY,
        );

        $weekEnd = $weekStart->addDays(6);

        $movementQuery = DB::table('stock_movements')
            ->leftJoin(
                'products',
                'products.id',
                '=',
                'stock_movements.product_id',
            )
            ->leftJoin(
                'branches',
                'branches.id',
                '=',
                'stock_movements.branch_id',
            )
            ->where(
                'stock_movements.tenant_id',
                $tenant->id,
            )
            ->where(
                'stock_movements.occurred_at',
                '>=',
                $weekStart->startOfDay()->utc(),
            )
            ->where(
                'stock_movements.occurred_at',
                '<=',
                $weekEnd->endOfDay()->utc(),
            );

        if ($branchId !== null) {
            $movementQuery->where(
                'stock_movements.branch_id',
                $branchId,
            );
        }

        $movements = $movementQuery
            ->select([
                'stock_movements.id',
                'stock_movements.stock_batch_id',
                'stock_movements.movement_type',
                'stock_movements.quantity',
                'stock_movements.running_balance',
                'stock_movements.reference_type',
                'stock_movements.reference_number',
                'stock_movements.reason',
                'stock_movements.occurred_at',
                'products.name as product_name',
                'products.sku as product_sku',
                'branches.name as branch_name',
                'branches.code as branch_code',
            ])
            ->orderByDesc(
                'stock_movements.occurred_at',
            )
            ->get();

        $movementDays = collect(
            range(0, 6),
        )->map(function (int $offset) use (
            $weekStart,
            $today,
            $movements,
            $timezone,
        ): array {
            $day = $weekStart->addDays($offset);

            $dayMovements = $movements->filter(
                function ($movement) use (
                    $day,
                    $timezone,
                ): bool {
                    return CarbonImmutable::parse(
                        $movement->occurred_at,
                    )
                        ->setTimezone($timezone)
                        ->isSameDay($day);
                },
            );

            $totals = [
                'receipts' => 0.0,
                'issues' => 0.0,
                'adjustments' => 0.0,
                'net' => 0.0,
                'transactions' =>
                    $dayMovements->count(),
            ];

            foreach ($dayMovements as $movement) {
                $quantity = (float) $movement->quantity;

                $type = strtolower(
                    (string) $movement->movement_type,
                );

                $isAdjustment =
                    str_contains($type, 'adjust')
                    || str_contains($type, 'count')
                    || str_contains($type, 'correct')
                    || str_contains($type, 'transfer');

                if ($isAdjustment) {
                    $totals['adjustments'] += abs($quantity);
                } elseif ($quantity >= 0) {
                    $totals['receipts'] += $quantity;
                } else {
                    $totals['issues'] += abs($quantity);
                }

                $totals['net'] += $quantity;
            }

            return [
                'date' => $day->toDateString(),
                'day' => $day->format('D'),
                'short_day' => mb_substr(
                    $day->format('D'),
                    0,
                    1,
                ),
                'is_today' => $day->isSameDay($today),
                'is_future' => $day->greaterThan($today),
                'receipts' => round(
                    $totals['receipts'],
                    2,
                ),
                'issues' => round(
                    $totals['issues'],
                    2,
                ),
                'adjustments' => round(
                    $totals['adjustments'],
                    2,
                ),
                'net' => round(
                    $totals['net'],
                    2,
                ),
                'transactions' =>
                    $totals['transactions'],
            ];
        });

        $nearExpiryPoints = $this->nearExpiryTrend(
            tenantId: $tenant->id,
            branchId: $branchId,
            weekStart: $weekStart,
            today: $today,
            timezone: $timezone,
        );

        $values = $nearExpiryPoints
            ->pluck('value')
            ->filter(
                fn ($value) =>
                    $value !== null,
            )
            ->values();

        $firstValue = $values->first();
        $latestValue = $values->last();

        $delta =
            $firstValue !== null
            && $latestValue !== null
                ? round(
                    (float) $latestValue
                    - (float) $firstValue,
                    2,
                )
                : 0.0;

        $direction =
            abs($delta) < 0.01
                ? 'stable'
                : (
                    $delta > 0
                        ? 'increasing'
                        : 'decreasing'
                );

        return response()->json([
            'period' => [
                'starts_on' =>
                    $weekStart->toDateString(),
                'ends_on' =>
                    $weekEnd->toDateString(),
                'timezone' => $timezone,
                'generated_at' =>
                    now()->toISOString(),
            ],
            'weekly_movements' => [
                'days' => $movementDays,
                'totals' => [
                    'receipts' => round(
                        (float) $movementDays
                            ->sum('receipts'),
                        2,
                    ),
                    'issues' => round(
                        (float) $movementDays
                            ->sum('issues'),
                        2,
                    ),
                    'adjustments' => round(
                        (float) $movementDays
                            ->sum('adjustments'),
                        2,
                    ),
                    'net' => round(
                        (float) $movementDays
                            ->sum('net'),
                        2,
                    ),
                    'transactions' =>
                        (int) $movementDays
                            ->sum('transactions'),
                ],
                'recent' => $movements
                    ->take(12)
                    ->map(
                        fn ($movement) => [
                            'id' => $movement->id,
                            'movement_type' =>
                                $movement->movement_type,
                            'quantity' =>
                                (float) $movement->quantity,
                            'running_balance' =>
                                $movement->running_balance !== null
                                    ? (float) $movement
                                        ->running_balance
                                    : null,
                            'reference_type' =>
                                $movement->reference_type,
                            'reference_number' =>
                                $movement->reference_number,
                            'reason' => $movement->reason,
                            'product_name' =>
                                $movement->product_name
                                ?? 'Unknown product',
                            'product_sku' =>
                                $movement->product_sku,
                            'branch_name' =>
                                $movement->branch_name,
                            'branch_code' =>
                                $movement->branch_code,
                            'occurred_at' =>
                                CarbonImmutable::parse(
                                    $movement->occurred_at,
                                )->toISOString(),
                        ],
                    )
                    ->values(),
            ],
            'near_expiry_value_trend' => [
                'threshold_days' => 180,
                'points' => $nearExpiryPoints,
                'direction' => $direction,
                'delta' => $delta,
                'latest_value' =>
                    $latestValue !== null
                        ? round(
                            (float) $latestValue,
                            2,
                        )
                        : null,
                'data_source' =>
                    'stock_batches_and_signed_stock_movements',
                'is_estimated' => false,
            ],
        ]);
    }

    private function nearExpiryTrend(
        int $tenantId,
        ?int $branchId,
        CarbonImmutable $weekStart,
        CarbonImmutable $today,
        string $timezone,
    ): Collection {
        $maximumExpiry = $weekStart
            ->addDays(6)
            ->addDays(180)
            ->endOfDay();

        $batchQuery = DB::table('stock_batches')
            ->where('tenant_id', $tenantId)
            ->whereNotNull('expiry_date')
            ->whereDate(
                'expiry_date',
                '>=',
                $weekStart->toDateString(),
            )
            ->whereDate(
                'expiry_date',
                '<=',
                $maximumExpiry->toDateString(),
            );

        if ($branchId !== null) {
            $batchQuery->where(
                'branch_id',
                $branchId,
            );
        }

        $batches = $batchQuery
            ->select([
                'id',
                'branch_id',
                'expiry_date',
                'available_quantity',
                'unit_cost',
            ])
            ->limit(5000)
            ->get();

        $batchIds = $batches
            ->pluck('id')
            ->all();

        $futureMovements = $batchIds === []
            ? collect()
            : DB::table('stock_movements')
                ->where('tenant_id', $tenantId)
                ->whereIn(
                    'stock_batch_id',
                    $batchIds,
                )
                ->where(
                    'occurred_at',
                    '>',
                    $weekStart
                        ->startOfDay()
                        ->utc(),
                )
                ->select([
                    'stock_batch_id',
                    'quantity',
                    'occurred_at',
                ])
                ->get()
                ->groupBy('stock_batch_id');

        return collect(range(0, 6))
            ->map(function (int $offset) use (
                $weekStart,
                $today,
                $timezone,
                $batches,
                $futureMovements,
            ): array {
                $day = $weekStart->addDays($offset);

                if ($day->greaterThan($today)) {
                    return [
                        'date' => $day->toDateString(),
                        'day' => $day->format('D'),
                        'short_day' => mb_substr(
                            $day->format('D'),
                            0,
                            1,
                        ),
                        'value' => null,
                        'is_today' => false,
                        'is_future' => true,
                    ];
                }

                $dayEnd = $day
                    ->endOfDay()
                    ->setTimezone($timezone);

                $threshold = $day->addDays(180);

                $value = 0.0;

                foreach ($batches as $batch) {
                    $expiryDate = CarbonImmutable::parse(
                        $batch->expiry_date,
                        $timezone,
                    )->startOfDay();

                    if (
                        $expiryDate->lessThan($day)
                        || $expiryDate->greaterThan($threshold)
                    ) {
                        continue;
                    }

                    $movementsAfterDay = (
                        $futureMovements->get(
                            $batch->id,
                            collect(),
                        )
                    )->sum(function ($movement) use (
                        $dayEnd,
                        $timezone,
                    ): float {
                        $occurredAt =
                            CarbonImmutable::parse(
                                $movement->occurred_at,
                            )->setTimezone($timezone);

                        return $occurredAt
                            ->greaterThan($dayEnd)
                                ? (float) $movement->quantity
                                : 0.0;
                    });

                    $quantityAtDayEnd = max(
                        0,
                        (float) $batch->available_quantity
                        - $movementsAfterDay,
                    );

                    $value +=
                        $quantityAtDayEnd
                        * (float) $batch->unit_cost;
                }

                return [
                    'date' => $day->toDateString(),
                    'day' => $day->format('D'),
                    'short_day' => mb_substr(
                        $day->format('D'),
                        0,
                        1,
                    ),
                    'value' => round($value, 2),
                    'is_today' => $day->isSameDay($today),
                    'is_future' => false,
                ];
            });
    }

    private function resolveTenant(
        Request $request,
    ): Tenant {
        $slug =
            $request->header('X-Tenant-Slug')
            ?: $request->header('X-Tenant')
            ?: $request->input('tenant_slug');

        abort_if(
            ! is_string($slug)
            || trim($slug) === '',
            422,
            'Tenant context is required.',
        );

        return Tenant::query()
            ->where('slug', trim($slug))
            ->where('status', 'active')
            ->firstOrFail();
    }
}
