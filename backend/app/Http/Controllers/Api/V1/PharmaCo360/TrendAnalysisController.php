<?php

namespace App\Http\Controllers\Api\V1\PharmaCo360;

use App\Http\Controllers\Controller;
use App\Models\Tenant;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class TrendAnalysisController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $tenant = $this->resolveTenant($request);

        $validated = $request->validate([
            'area' => ['nullable', 'string', 'in:inventory,pos-sales,general-stock,insurance'],
            'metric' => ['nullable', 'string', 'max:80'],
            'granularity' => ['nullable', 'string', 'in:day,week,month,quarter,year'],
            'current_start' => ['nullable', 'date'],
            'current_end' => ['nullable', 'date'],
            'comparison_start' => ['nullable', 'date'],
            'comparison_end' => ['nullable', 'date'],
            'branch_id' => ['nullable', 'integer'],
        ]);

        $area = $validated['area'] ?? 'inventory';
        $metric = $validated['metric'] ?? 'movement_quantity';
        $granularity = $validated['granularity'] ?? 'day';

        $today = CarbonImmutable::now();
        $currentStart = isset($validated['current_start'])
            ? CarbonImmutable::parse($validated['current_start'])->startOfDay()
            : $today->subDays(6)->startOfDay();

        $currentEnd = isset($validated['current_end'])
            ? CarbonImmutable::parse($validated['current_end'])->endOfDay()
            : $today->endOfDay();

        $periodDays = max(1, $currentStart->diffInDays($currentEnd) + 1);

        $comparisonStart = isset($validated['comparison_start'])
            ? CarbonImmutable::parse($validated['comparison_start'])->startOfDay()
            : $currentStart->subDays($periodDays);

        $comparisonEnd = isset($validated['comparison_end'])
            ? CarbonImmutable::parse($validated['comparison_end'])->endOfDay()
            : $currentStart->subDay()->endOfDay();

        $branchId = isset($validated['branch_id'])
            ? (int) $validated['branch_id']
            : null;

        $currentSeries = $this->series(
            tenantId: (int) $tenant->id,
            area: $area,
            metric: $metric,
            granularity: $granularity,
            start: $currentStart,
            end: $currentEnd,
            branchId: $branchId,
        );

        $comparisonSeries = $this->series(
            tenantId: (int) $tenant->id,
            area: $area,
            metric: $metric,
            granularity: $granularity,
            start: $comparisonStart,
            end: $comparisonEnd,
            branchId: $branchId,
        );

        $points = $this->alignSeries($currentSeries, $comparisonSeries);

        $currentTotal = array_sum(array_column($points, 'current'));
        $comparisonTotal = array_sum(array_column($points, 'comparison'));
        $varianceAmount = $currentTotal - $comparisonTotal;
        $variancePercent = $comparisonTotal == 0.0
            ? 0.0
            : ($varianceAmount / $comparisonTotal) * 100;

        return response()->json([
            'area' => $area,
            'metric' => $metric,
            'granularity' => $granularity,
            'periods' => [
                'current' => [
                    'start' => $currentStart->toDateString(),
                    'end' => $currentEnd->toDateString(),
                ],
                'comparison' => [
                    'start' => $comparisonStart->toDateString(),
                    'end' => $comparisonEnd->toDateString(),
                ],
            ],
            'summary' => [
                'current_total' => round($currentTotal, 2),
                'comparison_total' => round($comparisonTotal, 2),
                'variance_amount' => round($varianceAmount, 2),
                'variance_percent' => round($variancePercent, 2),
            ],
            'points' => $points,
            'insight' => $this->insight($area, $metric, $variancePercent),
        ]);
    }

    private function series(
        int $tenantId,
        string $area,
        string $metric,
        string $granularity,
        CarbonImmutable $start,
        CarbonImmutable $end,
        ?int $branchId,
    ): array {
        return match ($area) {
            'inventory' => $this->inventorySeries($tenantId, $metric, $granularity, $start, $end, $branchId),
            'general-stock' => $this->generalStockSeries($tenantId, $metric, $granularity, $start, $end, $branchId),
            'pos-sales' => $this->posSalesSeries($tenantId, $metric, $granularity, $start, $end, $branchId),
            'insurance' => $this->insuranceSeries($tenantId, $metric, $granularity, $start, $end, $branchId),
            default => [],
        };
    }

    private function inventorySeries(
        int $tenantId,
        string $metric,
        string $granularity,
        CarbonImmutable $start,
        CarbonImmutable $end,
        ?int $branchId,
    ): array {
        if (! Schema::hasTable('stock_movements')) {
            return [];
        }

        $query = DB::table('stock_movements')
            ->where('tenant_id', $tenantId)
            ->whereBetween('occurred_at', [$start->toDateTimeString(), $end->toDateTimeString()]);

        if ($branchId !== null && Schema::hasColumn('stock_movements', 'branch_id')) {
            $query->where('branch_id', $branchId);
        }

        $periodExpression = $this->periodExpression('occurred_at', $granularity);

        $valueExpression = match ($metric) {
            'receipts' => 'SUM(CASE WHEN quantity > 0 THEN quantity ELSE 0 END)',
            'issues' => 'SUM(CASE WHEN quantity < 0 THEN ABS(quantity) ELSE 0 END)',
            'transactions' => 'COUNT(*)',
            'adjustments' => "SUM(CASE WHEN movement_type LIKE '%adjust%' THEN ABS(quantity) ELSE 0 END)",
            default => 'SUM(quantity)',
        };

        return $this->runSeriesQuery($query, $periodExpression, $valueExpression);
    }

    private function generalStockSeries(
        int $tenantId,
        string $metric,
        string $granularity,
        CarbonImmutable $start,
        CarbonImmutable $end,
        ?int $branchId,
    ): array {
        if (! Schema::hasTable('stock_batches')) {
            return [];
        }

        $dateColumn = Schema::hasColumn('stock_batches', 'updated_at')
            ? 'updated_at'
            : 'created_at';

        $query = DB::table('stock_batches')
            ->where('tenant_id', $tenantId)
            ->where('quantity_on_hand', '>', 0)
            ->whereBetween($dateColumn, [$start->toDateTimeString(), $end->toDateTimeString()]);

        if ($branchId !== null && Schema::hasColumn('stock_batches', 'branch_id')) {
            $query->where('branch_id', $branchId);
        }

        $periodExpression = $this->periodExpression($dateColumn, $granularity);

        $valueExpression = match ($metric) {
            'stock_units' => 'SUM(quantity_on_hand)',
            'near_expiry_value' => "SUM(CASE WHEN expiry_date IS NOT NULL THEN quantity_on_hand * COALESCE(selling_price, unit_cost, 0) ELSE 0 END)",
            'low_stock' => 'SUM(CASE WHEN quantity_on_hand <= 10 THEN quantity_on_hand ELSE 0 END)',
            default => 'SUM(quantity_on_hand * COALESCE(selling_price, unit_cost, 0))',
        };

        return $this->runSeriesQuery($query, $periodExpression, $valueExpression);
    }

    private function posSalesSeries(
        int $tenantId,
        string $metric,
        string $granularity,
        CarbonImmutable $start,
        CarbonImmutable $end,
        ?int $branchId,
    ): array {
        $table = $this->firstExistingTable(['pharmaco_sales', 'sales']);

        if ($table === null) {
            return [];
        }

        $dateColumn = Schema::hasColumn($table, 'sale_date') ? 'sale_date' : 'created_at';
        $amountColumn = Schema::hasColumn($table, 'total_amount') ? 'total_amount' : 'gross_amount';

        $query = DB::table($table)
            ->where('tenant_id', $tenantId)
            ->whereBetween($dateColumn, [$start->toDateString(), $end->toDateString()]);

        if ($branchId !== null && Schema::hasColumn($table, 'branch_id')) {
            $query->where('branch_id', $branchId);
        }

        $periodExpression = $this->periodExpression($dateColumn, $granularity);

        $valueExpression = match ($metric) {
            'transactions' => 'COUNT(*)',
            'average_basket' => "AVG($amountColumn)",
            default => "SUM($amountColumn)",
        };

        return $this->runSeriesQuery($query, $periodExpression, $valueExpression);
    }

    private function insuranceSeries(
        int $tenantId,
        string $metric,
        string $granularity,
        CarbonImmutable $start,
        CarbonImmutable $end,
        ?int $branchId,
    ): array {
        if (! Schema::hasTable('insurance_sales_register')) {
            return [];
        }

        $dateColumn = Schema::hasColumn('insurance_sales_register', 'sale_date')
            ? 'sale_date'
            : 'created_at';

        $query = DB::table('insurance_sales_register')
            ->where('tenant_id', $tenantId)
            ->whereBetween($dateColumn, [$start->toDateString(), $end->toDateString()]);

        if ($branchId !== null && Schema::hasColumn('insurance_sales_register', 'branch_id')) {
            $query->where('branch_id', $branchId);
        }

        $periodExpression = $this->periodExpression($dateColumn, $granularity);

        $valueExpression = match ($metric) {
            'claim_count' => Schema::hasColumn('insurance_sales_register', 'insurance_claim_id')
                ? 'COUNT(DISTINCT insurance_claim_id)'
                : 'COUNT(*)',
            'insured_sales' => 'SUM(gross_amount)',
            default => 'SUM(insurer_claim_amount)',
        };

        return $this->runSeriesQuery($query, $periodExpression, $valueExpression);
    }

    private function runSeriesQuery($query, string $periodExpression, string $valueExpression): array
    {
        return $query
            ->selectRaw("$periodExpression AS period")
            ->selectRaw("$valueExpression AS value")
            ->groupBy('period')
            ->orderBy('period')
            ->get()
            ->map(fn ($row) => [
                'period' => (string) $row->period,
                'value' => round((float) $row->value, 2),
            ])
            ->all();
    }

    private function firstExistingTable(array $tables): ?string
    {
        foreach ($tables as $table) {
            if (Schema::hasTable($table)) {
                return $table;
            }
        }

        return null;
    }

    private function periodExpression(string $column, string $granularity): string
    {
        return match ($granularity) {
            'year' => "strftime('%Y', $column)",
            'quarter' => "strftime('%Y', $column) || '-Q' || ((cast(strftime('%m', $column) as integer) + 2) / 3)",
            'month' => "strftime('%Y-%m', $column)",
            'week' => "strftime('%Y-W%W', $column)",
            default => "date($column)",
        };
    }

    private function alignSeries(array $current, array $comparison): array
    {
        $length = max(count($current), count($comparison), 1);
        $points = [];

        for ($i = 0; $i < $length; $i++) {
            $currentPoint = $current[$i] ?? ['period' => 'P' . ($i + 1), 'value' => 0];
            $comparisonPoint = $comparison[$i] ?? ['period' => 'P' . ($i + 1), 'value' => 0];

            $currentValue = (float) $currentPoint['value'];
            $comparisonValue = (float) $comparisonPoint['value'];
            $changePercent = $comparisonValue == 0.0
                ? 0.0
                : (($currentValue - $comparisonValue) / $comparisonValue) * 100;

            $points[] = [
                'label' => (string) ($currentPoint['period'] ?? 'P' . ($i + 1)),
                'current' => round($currentValue, 2),
                'comparison' => round($comparisonValue, 2),
                'change_percent' => round($changePercent, 2),
            ];
        }

        return $points;
    }

    private function insight(string $area, string $metric, float $variancePercent): string
    {
        $subject = match ($area) {
            'inventory' => 'inventory movement',
            'pos-sales' => 'POS sales',
            'general-stock' => 'stock position',
            'insurance' => 'insurance performance',
            default => 'business performance',
        };

        if ($variancePercent >= 20) {
            return "The selected $subject metric is materially higher than the comparison period. Review the operational drivers behind the increase and confirm whether the growth is healthy, seasonal, or creating pressure.";
        }

        if ($variancePercent <= -20) {
            return "The selected $subject metric is materially lower than the comparison period. Investigate availability, demand, pricing, claims flow, customer activity, or procurement delays.";
        }

        return "The selected $subject metric is broadly stable compared with the comparison period. Continue monitoring for early signs of demand shifts, operational drift, stock pressure, or revenue leakage.";
    }

    private function resolveTenant(Request $request): Tenant
    {
        $slug =
            $request->header('X-Tenant-Slug')
            ?: $request->header('X-Tenant')
            ?: $request->input('tenant_slug');

        abort_if(
            ! is_string($slug) || trim($slug) === '',
            422,
            'Tenant context is required.',
        );

        return Tenant::query()
            ->where('slug', trim($slug))
            ->where('status', 'active')
            ->firstOrFail();
    }
}
