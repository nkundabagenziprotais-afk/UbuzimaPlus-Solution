<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create(
            'inventory_receipt_guards',
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

                $table->string('operation_type', 50);
                $table->string('subject_type', 50);
                $table->unsignedBigInteger('subject_id');
                $table->string('location_type', 50);
                $table->unsignedBigInteger('location_id');

                $table->string('source_line_type', 50)
                    ->nullable();

                $table->unsignedBigInteger('source_line_id')
                    ->nullable();

                $table->string('idempotency_key', 100);
                $table->char('request_hash', 64);

                $table->string(
                    'duplicate_classification',
                    30
                )->default('none');

                $table->string('status', 30)
                    ->default('reserved');

                $table->string(
                    'matched_transaction_type',
                    50
                )->nullable();

                $table->unsignedBigInteger(
                    'matched_transaction_id'
                )->nullable();

                $table->string(
                    'result_transaction_type',
                    50
                )->nullable();

                $table->unsignedBigInteger(
                    'result_transaction_id'
                )->nullable();

                $table->decimal(
                    'confidence_score',
                    5,
                    2
                )->nullable();

                $table->json('match_reasons')->nullable();

                $table->foreignId('override_user_id')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table->text('override_reason')->nullable();
                $table->char(
                    'duplicate_token_hash',
                    64
                )->nullable();

                $table->json('metadata')->nullable();
                $table->timestamp('completed_at')->nullable();
                $table->timestamps();

                $table->unique(
                    [
                        'tenant_id',
                        'operation_type',
                        'idempotency_key',
                    ],
                    'inv_receipt_guard_idempotency_uq'
                );

                $table->index(
                    [
                        'tenant_id',
                        'subject_type',
                        'subject_id',
                        'location_id',
                    ],
                    'inv_receipt_guard_subject_idx'
                );

                $table->index(
                    [
                        'tenant_id',
                        'source_line_type',
                        'source_line_id',
                    ],
                    'inv_receipt_guard_source_idx'
                );

                $table->index(
                    [
                        'tenant_id',
                        'status',
                        'created_at',
                    ],
                    'inv_receipt_guard_status_idx'
                );
            }
        );
    }

    public function down(): void
    {
        /*
         * Intentionally non-destructive.
         *
         * Receipt guards are security and audit evidence. A rollback
         * must not silently remove duplicate decisions or overrides.
         */
    }
};
