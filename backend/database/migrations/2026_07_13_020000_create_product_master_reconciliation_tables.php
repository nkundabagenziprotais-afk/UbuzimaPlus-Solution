<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_reconciliation_batches', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('source_key', 50);
            $table->string('source_name', 191);
            $table->string('source_version', 100)->nullable();
            $table->string('source_file', 191)->nullable();
            $table->string('status', 30)->default('draft');
            $table->unsignedInteger('imported_rows')->default(0);
            $table->unsignedInteger('matched_rows')->default(0);
            $table->unsignedInteger('review_rows')->default(0);
            $table->unsignedInteger('approved_rows')->default(0);
            $table->unsignedInteger('rejected_rows')->default(0);
            $table->json('metadata')->nullable();
            $table->foreignId('imported_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();

            $table->index(
                ['tenant_id', 'source_key', 'status'],
                'pr_batches_tenant_source_status_idx'
            );
        });

        Schema::create('product_reconciliation_rows', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('batch_id')
                ->constrained('product_reconciliation_batches')
                ->cascadeOnDelete();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('source_row');
            $table->string('source_code', 100)->nullable();
            $table->string('product_name', 191);
            $table->string('generic_name', 191)->nullable();
            $table->string('strength', 100)->nullable();
            $table->string('dosage_form', 100)->nullable();
            $table->string('pack', 100)->nullable();
            $table->string('selling_unit', 100)->nullable();
            $table->decimal('source_price', 16, 2)->nullable();
            $table->string('currency', 10)->default('RWF');
            $table->date('effective_from')->nullable();
            $table->date('effective_to')->nullable();
            $table->string('normalized_key', 191);
            $table->foreignId('matched_product_id')
                ->nullable()
                ->constrained('products')
                ->nullOnDelete();
            $table->string('match_method', 50)->nullable();
            $table->decimal('match_score', 5, 2)->nullable();
            $table->string('proposed_action', 50)->default('review');
            $table->string('review_status', 30)->default('pending');
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->text('review_notes')->nullable();
            $table->json('source_payload')->nullable();
            $table->json('dependency_snapshot')->nullable();
            $table->timestamps();

            $table->unique(
                ['batch_id', 'source_row'],
                'pr_rows_batch_source_row_uq'
            );
            $table->index(
                ['tenant_id', 'review_status', 'proposed_action'],
                'pr_rows_tenant_review_action_idx'
            );
            $table->index(
                ['tenant_id', 'normalized_key'],
                'pr_rows_tenant_normalized_idx'
            );
        });

        Schema::create('product_aliases', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->string('alias', 191);
            $table->string('normalized_alias', 191);
            $table->string('source_key', 50)->nullable();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(
                ['tenant_id', 'normalized_alias'],
                'product_aliases_tenant_normalized_uq'
            );
            $table->index(
                ['tenant_id', 'product_id'],
                'product_aliases_tenant_product_idx'
            );
        });

        Schema::create('product_payer_prices', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->string('payer_code', 50);
            $table->string('payer_name', 191);
            $table->decimal('amount', 16, 2);
            $table->string('currency', 10)->default('RWF');
            $table->date('effective_from')->nullable();
            $table->date('effective_to')->nullable();
            $table->string('source_key', 50);
            $table->string('source_reference', 191)->nullable();
            $table->string('status', 30)->default('pending');
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('approved_at')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(
                ['tenant_id', 'payer_code', 'status'],
                'payer_prices_tenant_payer_status_idx'
            );
            $table->index(
                ['tenant_id', 'product_id', 'effective_from'],
                'payer_prices_product_effective_idx'
            );
        });

        Schema::create('product_duplicate_proposals', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('record_a_product_id')
                ->constrained('products')
                ->cascadeOnDelete();
            $table->foreignId('record_b_product_id')
                ->constrained('products')
                ->cascadeOnDelete();
            $table->string('match_basis', 100);
            $table->decimal('match_score', 5, 2)->nullable();
            $table->string('status', 30)->default('pending');
            $table->json('dependency_snapshot')->nullable();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->text('review_notes')->nullable();
            $table->timestamps();

            $table->unique(
                ['tenant_id', 'record_a_product_id', 'record_b_product_id'],
                'duplicate_proposals_product_pair_uq'
            );
            $table->index(
                ['tenant_id', 'status'],
                'duplicate_proposals_tenant_status_idx'
            );
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_duplicate_proposals');
        Schema::dropIfExists('product_payer_prices');
        Schema::dropIfExists('product_aliases');
        Schema::dropIfExists('product_reconciliation_rows');
        Schema::dropIfExists('product_reconciliation_batches');
    }
};
