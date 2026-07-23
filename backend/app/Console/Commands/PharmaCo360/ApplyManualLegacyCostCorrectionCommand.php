<?php

namespace App\Console\Commands\PharmaCo360;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class ApplyManualLegacyCostCorrectionCommand extends Command
{
    protected $signature = 'pharmaco:apply-manual-legacy-cost
        {--apply : Apply changes. Without this flag, command runs dry-run only}
        {--batch-ids= : Comma-separated stock batch IDs}
        {--product-ids= : Comma-separated product IDs}
        {--skus= : Comma-separated product SKUs}
        {--names= : Comma-separated product name/generic/brand fragments}
        {--all-current-equal : Include all batches where current unit_cost equals selling_price}
        {--cutoff= : Optional max stock_batches.created_at date}
        {--tenant= : Optional tenant ID}
        {--factor=1.4 : Markup factor. Inferred cost = selling_price / factor}
        {--limit=0 : Optional candidate limit}
        {--reason=Manual legacy onboarding cost correction approved by management. : Audit reason}';

    protected $description = 'Manually apply legacy onboarding cost correction to selected stock batches/products.';

    public function handle(): int
    {
        if (! Schema::hasTable('stock_batches')) {
            $this->error('stock_batches table not found.');

            return self::FAILURE;
        }

        $apply = (bool) $this->option('apply');
        $factor = (float) $this->option('factor');
        $reason = trim((string) $this->option('reason'));
        $tenantId = trim((string) $this->option('tenant'));
        $cutoff = trim((string) $this->option('cutoff'));
        $limit = (int) $this->option('limit');

        if ($factor <= 0) {
            $factor = 1.4;
        }

        $query = DB::table('stock_batches')
            ->select([
                'stock_batches.id',
                'stock_batches.tenant_id',
                'stock_batches.product_id',
                'stock_batches.unit_cost',
                'stock_batches.original_unit_cost',
                'stock_batches.selling_price',
                'stock_batches.inferred_unit_cost',
                'stock_batches.cost_source',
                'stock_batches.cost_adjustment_method',
                'stock_batches.quantity_on_hand',
                'stock_batches.created_at',
                'stock_batches.updated_at',
            ])
            ->whereRaw('COALESCE(stock_batches.selling_price, 0) > 0');

        if (Schema::hasTable('products')) {
            $query
                ->leftJoin('products', 'products.id', '=', 'stock_batches.product_id')
                ->addSelect([
                    'products.name as product_name',
                    'products.generic_name as product_generic_name',
                    'products.brand_name as product_brand_name',
                    'products.sku as product_sku',
                ]);
        }

        $filtersApplied = false;

        $batchIds = $this->idList((string) $this->option('batch-ids'));

        if ($batchIds !== []) {
            $query->whereIn('stock_batches.id', $batchIds);
            $filtersApplied = true;
        }

        $productIds = $this->idList((string) $this->option('product-ids'));

        if ($productIds !== []) {
            $query->whereIn('stock_batches.product_id', $productIds);
            $filtersApplied = true;
        }

        $skus = $this->textList((string) $this->option('skus'));

        if ($skus !== [] && Schema::hasTable('products')) {
            $query->whereIn('products.sku', $skus);
            $filtersApplied = true;
        }

        $names = $this->textList((string) $this->option('names'));

        if ($names !== [] && Schema::hasTable('products')) {
            $query->where(function ($query) use ($names): void {
                foreach ($names as $name) {
                    $query
                        ->orWhere('products.name', 'like', "%{$name}%")
                        ->orWhere('products.generic_name', 'like', "%{$name}%")
                        ->orWhere('products.brand_name', 'like', "%{$name}%")
                        ->orWhere('products.sku', 'like', "%{$name}%");
                }
            });

            $filtersApplied = true;
        }

        if ((bool) $this->option('all-current-equal')) {
            $query->whereRaw('ABS(COALESCE(stock_batches.unit_cost, 0) - COALESCE(stock_batches.selling_price, 0)) < 0.0001')
                ->whereRaw('COALESCE(stock_batches.unit_cost, 0) > 0');

            $filtersApplied = true;
        }

        if ($cutoff !== '') {
            $query->whereDate('stock_batches.created_at', '<=', $cutoff);
        }

        if ($tenantId !== '') {
            $query->where('stock_batches.tenant_id', (int) $tenantId);
        }

        if (! $filtersApplied) {
            $this->warn('No selector was provided. Use --batch-ids, --product-ids, --skus, --names, or --all-current-equal.');

            return self::FAILURE;
        }

        if ($limit > 0) {
            $query->limit($limit);
        }

        $rows = $query
            ->orderBy('stock_batches.id')
            ->get();

        if ($rows->isEmpty()) {
            $this->warn('No stock batches matched the provided selection.');

            return self::SUCCESS;
        }

        $preview = [];
        $totalRetail = 0.0;
        $totalCurrentCost = 0.0;
        $totalResolvedCost = 0.0;
        $totalMargin = 0.0;
        $updated = 0;

        foreach ($rows as $row) {
            $sellingPrice = $this->number($row->selling_price);
            $unitCost = $this->number($row->unit_cost);
            $quantity = $this->number($row->quantity_on_hand);
            $inferredCost = round($sellingPrice / $factor, 4);
            $retailValue = $quantity * $sellingPrice;
            $currentCostValue = $quantity * $unitCost;
            $resolvedCostValue = $quantity * $inferredCost;
            $marginValue = $retailValue - $resolvedCostValue;

            $totalRetail += $retailValue;
            $totalCurrentCost += $currentCostValue;
            $totalResolvedCost += $resolvedCostValue;
            $totalMargin += $marginValue;

            $preview[] = [
                'batch_id' => $row->id,
                'product_id' => $row->product_id,
                'sku' => $row->product_sku ?? '',
                'name' => $row->product_name ?? '',
                'qty' => round($quantity, 2),
                'price' => round($sellingPrice, 4),
                'current_cost' => round($unitCost, 4),
                'inferred_cost' => $inferredCost,
                'margin_unit' => round($sellingPrice - $inferredCost, 4),
                'created_at' => $row->created_at,
            ];

            if ($apply) {
                DB::table('stock_batches')
                    ->where('id', $row->id)
                    ->update([
                        'original_unit_cost' => $this->number($row->original_unit_cost) > 0
                            ? $row->original_unit_cost
                            : $unitCost,
                        'inferred_unit_cost' => $inferredCost,
                        'cost_source' => 'legacy_equal_price_cost',
                        'cost_adjustment_method' => 'price_divided_by_1_4',
                        'cost_resolution_notes' =>
                            $reason.' Original/current unit cost retained for audit; reporting cost inferred as selling_price / '.$factor.'.',
                        'cost_resolved_at' => now(),
                        'updated_at' => now(),
                    ]);

                $updated++;
            }
        }

        $this->info('Manual legacy cost correction '.($apply ? 'APPLY' : 'DRY RUN').' completed.');
        $this->line('Matched batches: '.$rows->count());
        $this->line('Updated batches: '.$updated);
        $this->line('Factor: '.$factor);

        $this->table(
            [
                'batch_id',
                'product_id',
                'sku',
                'name',
                'qty',
                'price',
                'current_cost',
                'inferred_cost',
                'margin_unit',
                'created_at',
            ],
            array_slice($preview, 0, 40),
        );

        $this->table(
            ['metric', 'amount'],
            [
                ['Retail value', round($totalRetail, 2)],
                ['Current cost value', round($totalCurrentCost, 2)],
                ['Resolved inferred cost value', round($totalResolvedCost, 2)],
                ['Gross margin value', round($totalMargin, 2)],
            ],
        );

        $summary = DB::table('stock_batches')
            ->select(
                'cost_source',
                DB::raw('COUNT(*) as count'),
                DB::raw('ROUND(SUM(COALESCE(quantity_on_hand,0) * COALESCE(selling_price,0)), 2) as retail_value'),
                DB::raw(
                    "ROUND(SUM(COALESCE(quantity_on_hand,0) * CASE
                        WHEN cost_source IN ('legacy_equal_price_cost', 'inferred_from_price')
                            AND COALESCE(inferred_unit_cost,0) > 0
                            THEN COALESCE(inferred_unit_cost,0)
                        WHEN COALESCE(unit_cost,0) > 0
                            THEN COALESCE(unit_cost,0)
                        WHEN COALESCE(selling_price,0) > 0
                            THEN COALESCE(selling_price,0) / {$factor}
                        ELSE 0
                    END), 2) as resolved_cost_value"
                ),
            )
            ->groupBy('cost_source')
            ->orderBy('cost_source')
            ->get()
            ->map(fn ($row) => (array) $row)
            ->all();

        $this->table(
            ['cost_source', 'count', 'retail_value', 'resolved_cost_value'],
            $summary,
        );

        return self::SUCCESS;
    }

    private function idList(string $value): array
    {
        return collect(explode(',', $value))
            ->map(fn ($item) => trim($item))
            ->filter(fn ($item) => $item !== '' && ctype_digit($item))
            ->map(fn ($item) => (int) $item)
            ->unique()
            ->values()
            ->all();
    }

    private function textList(string $value): array
    {
        return collect(explode(',', $value))
            ->map(fn ($item) => trim($item))
            ->filter(fn ($item) => $item !== '')
            ->unique()
            ->values()
            ->all();
    }

    private function number(mixed $value): float
    {
        if (is_numeric($value)) {
            return (float) $value;
        }

        $parsed = (float) preg_replace('/[^0-9.\-]/', '', (string) $value);

        return is_finite($parsed) ? $parsed : 0.0;
    }
}
