<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('stock_batches')) {
            return;
        }

        Schema::table('stock_batches', function (Blueprint $table): void {
            if (! Schema::hasColumn('stock_batches', 'original_unit_cost')) {
                $table->decimal('original_unit_cost', 18, 4)->nullable()->after('unit_cost');
            }

            if (! Schema::hasColumn('stock_batches', 'inferred_unit_cost')) {
                $table->decimal('inferred_unit_cost', 18, 4)->nullable()->after('original_unit_cost');
            }

            if (! Schema::hasColumn('stock_batches', 'cost_source')) {
                $table->string('cost_source', 80)->nullable()->after('inferred_unit_cost');
            }

            if (! Schema::hasColumn('stock_batches', 'cost_adjustment_method')) {
                $table->string('cost_adjustment_method', 120)->nullable()->after('cost_source');
            }

            if (! Schema::hasColumn('stock_batches', 'cost_resolution_notes')) {
                $table->text('cost_resolution_notes')->nullable()->after('cost_adjustment_method');
            }

            if (! Schema::hasColumn('stock_batches', 'cost_resolved_at')) {
                $table->timestamp('cost_resolved_at')->nullable()->after('cost_resolution_notes');
            }
        });

        $cutoff = env('UBUZIMA_LEGACY_COST_CUTOFF', '2026-07-18');
        $markupFactor = (float) env('UBUZIMA_LEGACY_COST_MARKUP_FACTOR', 1.4);

        if ($markupFactor <= 0) {
            $markupFactor = 1.4;
        }

        /*
         * LEGACY_COST_RESOLUTION_V1
         * Preserve selling price and original onboarding unit_cost.
         * For legacy onboarded stock where cost was wrongly captured equal to
         * selling price, infer cost as selling_price / 1.4.
         */
        DB::table('stock_batches')
            ->whereRaw('COALESCE(selling_price, 0) > 0')
            ->whereRaw('COALESCE(unit_cost, 0) > 0')
            ->whereRaw('ABS(COALESCE(unit_cost, 0) - COALESCE(selling_price, 0)) < 0.0001')
            ->whereDate('created_at', '<=', $cutoff)
            ->where(function ($query): void {
                $query
                    ->whereNull('cost_source')
                    ->orWhere('cost_source', '')
                    ->orWhere('cost_source', 'actual');
            })
            ->update([
                'original_unit_cost' => DB::raw('unit_cost'),
                'inferred_unit_cost' => DB::raw('selling_price / '.$markupFactor),
                'cost_source' => 'legacy_equal_price_cost',
                'cost_adjustment_method' => 'price_divided_by_1_4',
                'cost_resolution_notes' => 'Legacy onboarding correction: unit cost was captured equal to selling price. Reporting cost inferred as selling_price / 1.4; original values retained.',
                'cost_resolved_at' => now(),
                'updated_at' => now(),
            ]);

        DB::table('stock_batches')
            ->whereNull('cost_source')
            ->whereRaw('COALESCE(unit_cost, 0) > 0')
            ->update([
                'cost_source' => 'actual',
                'cost_adjustment_method' => 'none',
                'cost_resolved_at' => now(),
                'updated_at' => now(),
            ]);

        DB::table('stock_batches')
            ->whereNull('cost_source')
            ->whereRaw('COALESCE(unit_cost, 0) <= 0')
            ->update([
                'cost_source' => 'missing',
                'cost_adjustment_method' => 'needs_review',
                'cost_resolution_notes' => 'Missing or zero unit cost; requires cost review before accurate margin reporting.',
                'cost_resolved_at' => now(),
                'updated_at' => now(),
            ]);
    }

    public function down(): void
    {
        /*
         * Do not remove or reverse cost-resolution audit metadata in production.
         * Rollback should be handled through a controlled finance/inventory review.
         */
    }
};
