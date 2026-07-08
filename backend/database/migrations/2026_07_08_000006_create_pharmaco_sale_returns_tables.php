<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create(
            'pharmaco_sale_returns',
            function (Blueprint $table) {
                $table->id();
                $table->uuid('uuid')->unique();

                $table->foreignId('tenant_id')
                    ->constrained()
                    ->cascadeOnDelete();

                $table->foreignId('branch_id')
                    ->constrained('branches')
                    ->restrictOnDelete();

                $table->foreignId('pharmaco_sale_id')
                    ->constrained('pharmaco_sales')
                    ->restrictOnDelete();

                $table->string('return_number', 100);
                $table->string('status', 30)
                    ->default('pending');

                $table->string('reason', 500);

                $table->decimal(
                    'requested_refund_amount',
                    15,
                    2
                )->default(0);

                $table->decimal(
                    'approved_refund_amount',
                    15,
                    2
                )->nullable();

                $table->string('refund_method', 30)
                    ->nullable();

                $table->string('refund_reference', 191)
                    ->nullable();

                $table->string('credit_note_number', 100)
                    ->nullable();

                $table->foreignId('requested_by')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table->foreignId('approved_by')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table->timestamp('requested_at');
                $table->timestamp('approved_at')->nullable();
                $table->timestamp('refunded_at')->nullable();

                $table->text('notes')->nullable();
                $table->json('metadata')->nullable();
                $table->timestamps();

                $table->unique(
                    ['tenant_id', 'return_number'],
                    'pharmaco_return_number_unique'
                );

                $table->unique(
                    ['tenant_id', 'credit_note_number'],
                    'pharmaco_credit_note_unique'
                );

                $table->index(
                    [
                        'tenant_id',
                        'branch_id',
                        'status',
                    ],
                    'pharmaco_return_scope_status_idx'
                );

                $table->index(
                    [
                        'tenant_id',
                        'pharmaco_sale_id',
                        'status',
                    ],
                    'pharmaco_return_sale_status_idx'
                );
            }
        );

        Schema::create(
            'pharmaco_sale_return_items',
            function (Blueprint $table) {
                $table->id();
                $table->uuid('uuid')->unique();

                $table->foreignId('tenant_id')
                    ->constrained()
                    ->cascadeOnDelete();

                $table->foreignId(
                    'pharmaco_sale_return_id'
                )
                    ->constrained(
                        'pharmaco_sale_returns'
                    )
                    ->cascadeOnDelete();

                $table->foreignId(
                    'pharmaco_sale_item_id'
                )
                    ->constrained(
                        'pharmaco_sale_items'
                    )
                    ->restrictOnDelete();

                $table->foreignId('product_id')
                    ->constrained()
                    ->restrictOnDelete();

                $table->foreignId('stock_batch_id')
                    ->nullable()
                    ->constrained()
                    ->nullOnDelete();

                $table->decimal('quantity', 15, 3);
                $table->decimal('unit_price', 15, 2);
                $table->decimal(
                    'line_refund_amount',
                    15,
                    2
                );

                $table->string('disposition', 30);
                $table->string('reason', 500)
                    ->nullable();

                $table->boolean('stock_restored')
                    ->default(false);

                $table->json('metadata')->nullable();
                $table->timestamps();

                $table->unique(
                    [
                        'pharmaco_sale_return_id',
                        'pharmaco_sale_item_id',
                    ],
                    'pharmaco_return_item_unique'
                );

                $table->index(
                    [
                        'tenant_id',
                        'pharmaco_sale_item_id',
                    ],
                    'pharmaco_return_sale_item_idx'
                );

                $table->index(
                    [
                        'tenant_id',
                        'disposition',
                        'stock_restored',
                    ],
                    'pharmaco_return_disposition_idx'
                );
            }
        );

        Schema::create(
            'pharmaco_payment_reconciliations',
            function (Blueprint $table) {
                $table->id();
                $table->uuid('uuid')->unique();

                $table->foreignId('tenant_id')
                    ->constrained()
                    ->cascadeOnDelete();

                $table->foreignId(
                    'pharmaco_payment_id'
                )
                    ->constrained(
                        'pharmaco_payments'
                    )
                    ->restrictOnDelete();

                $table->string(
                    'reconciliation_status',
                    30
                )->default('pending');

                $table->decimal(
                    'expected_amount',
                    15,
                    2
                );

                $table->decimal(
                    'settled_amount',
                    15,
                    2
                );

                $table->decimal(
                    'variance_amount',
                    15,
                    2
                )->default(0);

                $table->string(
                    'provider_reference',
                    191
                )->nullable();

                $table->foreignId('reconciled_by')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table->timestamp('reconciled_at')
                    ->nullable();

                $table->text('notes')->nullable();
                $table->json('metadata')->nullable();
                $table->timestamps();

                $table->unique(
                    [
                        'tenant_id',
                        'pharmaco_payment_id',
                    ],
                    'pharmaco_payment_reconciliation_unique'
                );

                $table->index(
                    [
                        'tenant_id',
                        'reconciliation_status',
                    ],
                    'pharmaco_payment_reconciliation_status_idx'
                );
            }
        );
    }

    public function down(): void
    {
        Schema::dropIfExists(
            'pharmaco_payment_reconciliations'
        );

        Schema::dropIfExists(
            'pharmaco_sale_return_items'
        );

        Schema::dropIfExists(
            'pharmaco_sale_returns'
        );
    }
};
