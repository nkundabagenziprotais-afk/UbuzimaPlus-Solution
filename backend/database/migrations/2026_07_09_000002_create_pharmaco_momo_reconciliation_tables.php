<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create(
            'pharmaco_momo_parser_templates',
            function (Blueprint $table): void {
                $table->id();
                $table->uuid('uuid')->unique();

                $table->foreignId('tenant_id')
                    ->constrained()
                    ->cascadeOnDelete();

                $table->string('name', 191);
                $table->string('sender_id', 100);
                $table->unsignedInteger('version')
                    ->default(1);

                $table->string('status', 30)
                    ->default('active');

                $table->text('message_regex');

                $table->string(
                    'timezone',
                    50
                )->default('Africa/Kigali');

                $table->text('sample_message')
                    ->nullable();

                $table->json('metadata')
                    ->nullable();

                $table->foreignId('created_by')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table->foreignId('updated_by')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table->timestamps();

                $table->unique(
                    [
                        'tenant_id',
                        'sender_id',
                        'version',
                    ],
                    'momo_parser_scope_version_unique'
                );

                $table->index(
                    [
                        'tenant_id',
                        'sender_id',
                        'status',
                    ],
                    'momo_parser_scope_status_idx'
                );
            }
        );

        Schema::create(
            'pharmaco_momo_messages',
            function (Blueprint $table): void {
                $table->id();
                $table->uuid('uuid')->unique();

                $table->foreignId('tenant_id')
                    ->constrained()
                    ->cascadeOnDelete();

                $table->foreignId(
                    'parser_template_id'
                )
                    ->nullable()
                    ->constrained(
                        'pharmaco_momo_parser_templates'
                    )
                    ->nullOnDelete();

                $table->string('device_uuid', 100)
                    ->nullable();

                $table->string('sender_id', 100);
                $table->text('raw_message');

                $table->timestamp('received_at');
                $table->timestamp('transaction_at')
                    ->nullable();

                $table->string('customer_name', 191)
                    ->nullable();

                $table->string('phone_masked', 50)
                    ->nullable();

                $table->string('phone_suffix', 20)
                    ->nullable();

                $table->decimal(
                    'amount',
                    18,
                    2
                )->nullable();

                $table->string('currency', 10)
                    ->nullable();

                $table->string(
                    'provider_transaction_id',
                    100
                )->nullable();

                $table->decimal(
                    'balance',
                    18,
                    2
                )->nullable();

                $table->string('et_id', 100)
                    ->nullable();

                $table->string(
                    'parse_status',
                    30
                )->default('pending');

                $table->decimal(
                    'parse_confidence',
                    5,
                    2
                )->default(0);

                $table->string(
                    'duplicate_hash',
                    64
                );

                $table->json('parse_errors')
                    ->nullable();

                $table->json('metadata')
                    ->nullable();

                $table->timestamps();

                $table->unique(
                    [
                        'tenant_id',
                        'duplicate_hash',
                    ],
                    'momo_message_duplicate_unique'
                );

                $table->unique(
                    [
                        'tenant_id',
                        'provider_transaction_id',
                    ],
                    'momo_provider_transaction_unique'
                );

                $table->index(
                    [
                        'tenant_id',
                        'transaction_at',
                    ],
                    'momo_message_transaction_idx'
                );

                $table->index(
                    [
                        'tenant_id',
                        'parse_status',
                    ],
                    'momo_message_parse_status_idx'
                );
            }
        );

        Schema::create(
            'pharmaco_momo_reconciliations',
            function (Blueprint $table): void {
                $table->id();
                $table->uuid('uuid')->unique();

                $table->foreignId('tenant_id')
                    ->constrained()
                    ->cascadeOnDelete();

                $table->foreignId('momo_message_id')
                    ->nullable()
                    ->constrained(
                        'pharmaco_momo_messages'
                    )
                    ->cascadeOnDelete();

                $table->foreignId(
                    'pharmaco_payment_id'
                )
                    ->nullable()
                    ->constrained(
                        'pharmaco_payments'
                    )
                    ->cascadeOnDelete();

                $table->foreignId('pharmaco_sale_id')
                    ->nullable()
                    ->constrained('pharmaco_sales')
                    ->nullOnDelete();

                $table->string('status', 50);
                $table->string('decision', 80);

                $table->decimal(
                    'confidence_score',
                    5,
                    2
                )->default(0);

                $table->decimal(
                    'amount_variance',
                    18,
                    2
                )->nullable();

                $table->json('matching_reasons')
                    ->nullable();

                $table->foreignId('reviewed_by')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table->timestamp('reviewed_at')
                    ->nullable();

                $table->text('review_notes')
                    ->nullable();

                $table->json('metadata')
                    ->nullable();

                $table->timestamps();

                $table->unique(
                    'momo_message_id',
                    'momo_reconciliation_message_unique'
                );

                $table->unique(
                    'pharmaco_payment_id',
                    'momo_reconciliation_payment_unique'
                );

                $table->index(
                    [
                        'tenant_id',
                        'status',
                        'decision',
                    ],
                    'momo_reconciliation_queue_idx'
                );
            }
        );
    }

    public function down(): void
    {
        Schema::dropIfExists(
            'pharmaco_momo_reconciliations'
        );

        Schema::dropIfExists(
            'pharmaco_momo_messages'
        );

        Schema::dropIfExists(
            'pharmaco_momo_parser_templates'
        );
    }
};
