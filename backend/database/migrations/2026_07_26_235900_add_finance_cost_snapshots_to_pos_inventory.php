<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pharmaco_sale_items', function (Blueprint $table): void {
            $table->decimal('cost_unit_snapshot', 18, 4)->nullable();
            $table->decimal('cost_total_snapshot', 18, 4)->nullable();
            $table->string('cost_source_snapshot', 120)->nullable();
            $table->timestamp('cost_snapshot_at')->nullable();
            $table->json('cost_snapshot_metadata')->nullable();

            $table->index(
                ['tenant_id', 'cost_snapshot_at'],
                'pharmaco_sale_items_cost_snapshot_index'
            );
        });

        Schema::table('stock_movements', function (Blueprint $table): void {
            $table->decimal('unit_cost_snapshot', 18, 4)->nullable();
            $table->decimal('total_cost_snapshot', 18, 4)->nullable();
            $table->string('cost_source_snapshot', 120)->nullable();
            $table->timestamp('cost_snapshot_at')->nullable();
            $table->json('cost_snapshot_metadata')->nullable();

            $table->index(
                ['tenant_id', 'cost_snapshot_at'],
                'stock_movements_cost_snapshot_index'
            );
        });
    }

    public function down(): void
    {
        Schema::table('stock_movements', function (Blueprint $table): void {
            $table->dropIndex('stock_movements_cost_snapshot_index');

            $table->dropColumn([
                'unit_cost_snapshot',
                'total_cost_snapshot',
                'cost_source_snapshot',
                'cost_snapshot_at',
                'cost_snapshot_metadata',
            ]);
        });

        Schema::table('pharmaco_sale_items', function (Blueprint $table): void {
            $table->dropIndex('pharmaco_sale_items_cost_snapshot_index');

            $table->dropColumn([
                'cost_unit_snapshot',
                'cost_total_snapshot',
                'cost_source_snapshot',
                'cost_snapshot_at',
                'cost_snapshot_metadata',
            ]);
        });
    }
};
