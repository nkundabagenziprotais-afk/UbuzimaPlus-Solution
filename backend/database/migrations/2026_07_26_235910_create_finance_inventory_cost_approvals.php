<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create(
            'finance_inventory_cost_approvals',
            function (Blueprint $table): void {
                $table->id();
                $table->uuid('uuid')->unique();

                $table->foreignId('tenant_id')
                    ->constrained('tenants')
                    ->cascadeOnDelete();

                $table->foreignId('branch_id')
                    ->nullable()
                    ->constrained('branches')
                    ->nullOnDelete();

                $table->foreignId('stock_batch_id')
                    ->constrained('stock_batches')
                    ->restrictOnDelete();

                $table->date('effective_date');

                $table->decimal(
                    'approved_unit_cost',
                    18,
                    4
                );

                $table->string(
                    'currency_code',
                    3
                )->default('RWF');

                $table->string(
                    'approval_method',
                    50
                );

                $table->string(
                    'valuation_basis',
                    191
                );

                $table->string(
                    'source_reference',
                    191
                );

                $table->date(
                    'source_document_date'
                )->nullable();

                $table->text('approval_notes');

                $table->foreignId('approved_by')
                    ->constrained('users')
                    ->restrictOnDelete();

                $table->timestamp('approved_at');

                $table->string(
                    'status',
                    30
                )->default('approved');

                $table->string(
                    'approval_key',
                    191
                )->unique();

                $table->string(
                    'source_file_sha256',
                    64
                );

                $table->json('batch_snapshot');
                $table->json('approval_evidence');

                $table->json('metadata')
                    ->nullable();

                $table->timestamps();

                $table->index(
                    [
                        'tenant_id',
                        'effective_date',
                        'status',
                    ],
                    'finance_cost_approval_period_idx'
                );

                $table->index(
                    [
                        'tenant_id',
                        'stock_batch_id',
                        'status',
                    ],
                    'finance_cost_approval_batch_idx'
                );
            }
        );
    }

    public function down(): void
    {
        Schema::dropIfExists(
            'finance_inventory_cost_approvals'
        );
    }
};
