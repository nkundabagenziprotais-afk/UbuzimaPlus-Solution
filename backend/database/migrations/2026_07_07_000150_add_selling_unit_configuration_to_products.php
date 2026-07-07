<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->string('selling_unit', 80)->nullable()->after('unit');
            $table->string('base_unit', 80)->nullable()->after('selling_unit');
            $table->decimal('quantity_per_selling_unit', 14, 4)->default(1)->after('base_unit');
            $table->boolean('allow_other_quantity')->default(true)->after('quantity_per_selling_unit');
            $table->string('default_pos_quantity_mode', 40)
                ->default('selling_unit')
                ->after('allow_other_quantity');
            $table->text('selling_unit_notes')->nullable()->after('default_pos_quantity_mode');

            $table->decimal('ai_suggested_quantity_per_unit', 14, 4)
                ->nullable()
                ->after('selling_unit_notes');
            $table->string('ai_suggestion_status', 40)
                ->default('not_requested')
                ->after('ai_suggested_quantity_per_unit');
            $table->decimal('ai_suggestion_confidence', 5, 2)
                ->nullable()
                ->after('ai_suggestion_status');
            $table->text('ai_suggestion_explanation')
                ->nullable()
                ->after('ai_suggestion_confidence');
            $table->text('ai_suggestion_source')
                ->nullable()
                ->after('ai_suggestion_explanation');
            $table->text('ai_suggestion_reference')
                ->nullable()
                ->after('ai_suggestion_source');
            $table->foreignId('ai_suggestion_reviewed_by')
                ->nullable()
                ->after('ai_suggestion_reference')
                ->constrained('users')
                ->nullOnDelete();
            $table->timestamp('ai_suggestion_reviewed_at')
                ->nullable()
                ->after('ai_suggestion_reviewed_by');

            $table->index(
                ['tenant_id', 'ai_suggestion_status'],
                'products_tenant_ai_suggestion_status_index'
            );
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropIndex('products_tenant_ai_suggestion_status_index');
            $table->dropForeign(['ai_suggestion_reviewed_by']);

            $table->dropColumn([
                'selling_unit',
                'base_unit',
                'quantity_per_selling_unit',
                'allow_other_quantity',
                'default_pos_quantity_mode',
                'selling_unit_notes',
                'ai_suggested_quantity_per_unit',
                'ai_suggestion_status',
                'ai_suggestion_confidence',
                'ai_suggestion_explanation',
                'ai_suggestion_source',
                'ai_suggestion_reference',
                'ai_suggestion_reviewed_by',
                'ai_suggestion_reviewed_at',
            ]);
        });
    }
};
