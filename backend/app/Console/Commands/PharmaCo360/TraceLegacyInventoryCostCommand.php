<?php

namespace App\Console\Commands\PharmaCo360;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class TraceLegacyInventoryCostCommand extends Command
{
    protected $signature = 'pharmaco:trace-legacy-inventory-cost
        {--apply : Apply inferred legacy cost corrections}
        {--cutoff=2026-07-18 : Onboarding cutoff date using stock batch created_at}
        {--factor=1.4 : Markup factor. Inferred cost = selling_price / factor}
        {--tenant= : Optional tenant id}
        {--limit=0 : Optional limit for diagnostics}';

    protected $description = 'Trace legacy inventory cost from original batch creation/receiving evidence and optionally apply inferred cost.';

    public function handle(): int
    {
        if (! Schema::hasTable('stock_batches')) {
            $this->error('stock_batches table not found.');

            return self::FAILURE;
        }

        $cutoff = (string) $this->option('cutoff');
        $factor = (float) $this->option('factor');

        if ($factor <= 0) {
            $factor = 1.4;
        }

        $apply = (bool) $this->option('apply');
        $tenantId = $this->option('tenant');
        $limit = (int) $this->option('limit');

        $batchColumns = Schema::getColumnListing('stock_batches');

        $query = DB::table('stock_batches')
            ->whereRaw('COALESCE(selling_price, 0) > 0')
            ->whereDate('created_at', '<=', $cutoff)
            ->where(function ($query): void {
                $query
                    ->whereNull('cost_source')
                    ->orWhere('cost_source', '')
                    ->orWhere('cost_source', 'actual')
                    ->orWhere('cost_source', 'missing');
            });

        if ($tenantId !== null && $tenantId !== '') {
            $query->where('tenant_id', (int) $tenantId);
        }

        if ($limit > 0) {
            $query->limit($limit);
        }

        $candidates = $query
            ->orderBy('id')
            ->get();

        $matched = 0;
        $review = 0;
        $actual = 0;

        $examples = [];

        foreach ($candidates as $batch) {
            $trace = $this->traceOriginalCostEvidence($batch);
            $sellingPrice = $this->number($batch->selling_price ?? 0);
            $currentUnitCost = $this->number($batch->unit_cost ?? 0);
            $originalCost = $trace['original_unit_cost'];
            $originalSellingPrice = $trace['original_selling_price'] > 0
                ? $trace['original_selling_price']
                : $sellingPrice;

            $isLegacyEqualPriceCost =
                $originalCost > 0
                && $originalSellingPrice > 0
                && abs($originalCost - $originalSellingPrice) < 0.0001;

            $isCurrentEqualPriceCost =
                $currentUnitCost > 0
                && $sellingPrice > 0
                && abs($currentUnitCost - $sellingPrice) < 0.0001;

            /*
             * LEGACY_COST_TRACE_FROM_CREATION_V1
             * Main rule:
             * - use original creation/receiving evidence first;
             * - fallback to current equality only when batch was created during onboarding.
             */
            if ($isLegacyEqualPriceCost || $isCurrentEqualPriceCost) {
                $matched++;
                $inferredCost = round($sellingPrice / $factor, 4);

                if ($apply) {
                    DB::table('stock_batches')
                        ->where('id', $batch->id)
                        ->update([
                            'original_unit_cost' => $originalCost > 0 ? $originalCost : $currentUnitCost,
                            'inferred_unit_cost' => $inferredCost,
                            'cost_source' => 'legacy_equal_price_cost',
                            'cost_adjustment_method' => 'price_divided_by_1_4',
                            'cost_resolution_notes' =>
                                'Legacy onboarding correction traced from original inventory creation/receiving evidence. Original cost was equal to selling price; reporting cost inferred as selling_price / 1.4. Current updated values retained for audit.',
                            'cost_resolved_at' => now(),
                            'updated_at' => now(),
                        ]);
                }

                $examples[] = [
                    'id' => $batch->id,
                    'product_id' => $batch->product_id ?? null,
                    'current_unit_cost' => $currentUnitCost,
                    'current_selling_price' => $sellingPrice,
                    'traced_original_cost' => $originalCost,
                    'traced_original_selling_price' => $originalSellingPrice,
                    'inferred_unit_cost' => $inferredCost,
                    'trace_source' => $trace['source'],
                    'created_at' => $batch->created_at,
                ];

                continue;
            }

            if ($currentUnitCost <= 0) {
                $review++;

                if ($apply) {
                    DB::table('stock_batches')
                        ->where('id', $batch->id)
                        ->update([
                            'cost_source' => 'missing',
                            'cost_adjustment_method' => 'needs_review',
                            'cost_resolution_notes' =>
                                'Missing or zero unit cost. Could not trace original onboarding cost evidence; requires review.',
                            'cost_resolved_at' => now(),
                            'updated_at' => now(),
                        ]);
                }

                continue;
            }

            $actual++;

            if ($apply) {
                DB::table('stock_batches')
                    ->where('id', $batch->id)
                    ->where(function ($query): void {
                        $query
                            ->whereNull('cost_source')
                            ->orWhere('cost_source', '')
                            ->orWhere('cost_source', 'missing');
                    })
                    ->update([
                        'cost_source' => 'actual',
                        'cost_adjustment_method' => 'none',
                        'cost_resolved_at' => now(),
                        'updated_at' => now(),
                    ]);
            }
        }

        $this->info('Legacy inventory cost tracing completed.');
        $this->line('Mode: '.($apply ? 'APPLY' : 'DRY RUN'));
        $this->line('Cutoff: '.$cutoff);
        $this->line('Factor: '.$factor);
        $this->line('Candidates: '.$candidates->count());
        $this->line('Legacy matched: '.$matched);
        $this->line('Actual retained: '.$actual);
        $this->line('Needs review: '.$review);

        $this->table(
            [
                'id',
                'product_id',
                'current_unit_cost',
                'current_selling_price',
                'traced_original_cost',
                'traced_original_selling_price',
                'inferred_unit_cost',
                'trace_source',
                'created_at',
            ],
            array_slice($examples, 0, 30),
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

    private function traceOriginalCostEvidence(object $batch): array
    {
        $batchCost = $this->number($batch->original_unit_cost ?? 0);
        $batchSelling = $this->number($batch->selling_price ?? 0);

        if ($batchCost > 0) {
            return [
                'original_unit_cost' => $batchCost,
                'original_selling_price' => $batchSelling,
                'source' => 'stock_batches.original_unit_cost',
            ];
        }

        $movementTrace = $this->traceFromStockMovements($batch);

        if ($movementTrace['original_unit_cost'] > 0) {
            return $movementTrace;
        }

        $auditTrace = $this->traceFromAuditLogs($batch);

        if ($auditTrace['original_unit_cost'] > 0) {
            return $auditTrace;
        }

        return [
            'original_unit_cost' => $this->number($batch->unit_cost ?? 0),
            'original_selling_price' => $batchSelling,
            'source' => 'stock_batches.current_values_created_at_cutoff',
        ];
    }

    private function traceFromStockMovements(object $batch): array
    {
        if (! Schema::hasTable('stock_movements')) {
            return $this->emptyTrace('stock_movements_missing');
        }

        $columns = Schema::getColumnListing('stock_movements');

        if (! in_array('stock_batch_id', $columns, true)) {
            return $this->emptyTrace('stock_movements_no_batch_column');
        }

        $movement = DB::table('stock_movements')
            ->where('stock_batch_id', $batch->id)
            ->orderBy('created_at')
            ->first();

        if (! $movement) {
            return $this->emptyTrace('stock_movements_no_rows');
        }

        $candidateFields = [
            'unit_cost',
            'cost',
            'unit_purchase_price',
            'purchase_price',
            'received_unit_cost',
            'before_unit_cost',
            'after_unit_cost',
        ];

        foreach ($candidateFields as $field) {
            if (in_array($field, $columns, true)) {
                $value = $this->number($movement->{$field} ?? 0);

                if ($value > 0) {
                    return [
                        'original_unit_cost' => $value,
                        'original_selling_price' => $this->number($batch->selling_price ?? 0),
                        'source' => "stock_movements.{$field}",
                    ];
                }
            }
        }

        foreach (['metadata', 'context', 'payload', 'details'] as $jsonField) {
            if (! in_array($jsonField, $columns, true)) {
                continue;
            }

            $trace = $this->traceFromJson($movement->{$jsonField} ?? null, "stock_movements.{$jsonField}");

            if ($trace['original_unit_cost'] > 0) {
                return $trace;
            }
        }

        return $this->emptyTrace('stock_movements_no_cost_evidence');
    }

    private function traceFromAuditLogs(object $batch): array
    {
        $auditTables = [
            'audit_logs',
            'activity_log',
            'activity_logs',
            'audits',
        ];

        foreach ($auditTables as $table) {
            if (! Schema::hasTable($table)) {
                continue;
            }

            $columns = Schema::getColumnListing($table);
            $query = DB::table($table);

            if (in_array('auditable_type', $columns, true)) {
                $query->where(function ($query): void {
                    $query
                        ->where('auditable_type', 'like', '%StockBatch%')
                        ->orWhere('auditable_type', 'like', '%stock_batch%');
                });
            }

            if (in_array('auditable_id', $columns, true)) {
                $query->where('auditable_id', $batch->id);
            } elseif (in_array('subject_id', $columns, true)) {
                $query->where('subject_id', $batch->id);
            } else {
                continue;
            }

            $row = $query
                ->orderBy(in_array('created_at', $columns, true) ? 'created_at' : $columns[0])
                ->first();

            if (! $row) {
                continue;
            }

            foreach (['metadata', 'properties', 'old_values', 'new_values', 'changes', 'payload'] as $jsonField) {
                if (! in_array($jsonField, $columns, true)) {
                    continue;
                }

                $trace = $this->traceFromJson($row->{$jsonField} ?? null, "{$table}.{$jsonField}");

                if ($trace['original_unit_cost'] > 0) {
                    return $trace;
                }
            }
        }

        return $this->emptyTrace('audit_no_cost_evidence');
    }

    private function traceFromJson(mixed $value, string $source): array
    {
        if (! $value) {
            return $this->emptyTrace($source);
        }

        if (is_string($value)) {
            $decoded = json_decode($value, true);
        } elseif (is_array($value)) {
            $decoded = $value;
        } else {
            $decoded = json_decode(json_encode($value), true);
        }

        if (! is_array($decoded)) {
            return $this->emptyTrace($source);
        }

        $cost = $this->firstNumber($decoded, [
            'unit_cost',
            'cost',
            'original_unit_cost',
            'before.unit_cost',
            'after.unit_cost',
            'attributes.unit_cost',
            'old.unit_cost',
            'new.unit_cost',
            'changes.unit_cost',
            'stock_batch.unit_cost',
        ]);

        $price = $this->firstNumber($decoded, [
            'selling_price',
            'price',
            'original_selling_price',
            'before.selling_price',
            'after.selling_price',
            'attributes.selling_price',
            'old.selling_price',
            'new.selling_price',
            'changes.selling_price',
            'stock_batch.selling_price',
        ]);

        return [
            'original_unit_cost' => $cost,
            'original_selling_price' => $price,
            'source' => $source,
        ];
    }

    private function firstNumber(array $source, array $paths): float
    {
        foreach ($paths as $path) {
            $value = $source;

            foreach (explode('.', $path) as $segment) {
                if (! is_array($value) || ! array_key_exists($segment, $value)) {
                    $value = null;

                    break;
                }

                $value = $value[$segment];
            }

            $number = $this->number($value);

            if ($number > 0) {
                return $number;
            }
        }

        return 0.0;
    }

    private function emptyTrace(string $source): array
    {
        return [
            'original_unit_cost' => 0.0,
            'original_selling_price' => 0.0,
            'source' => $source,
        ];
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
