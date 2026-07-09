<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create(
            'pharmaco_pos_historical_approvals',
            function (Blueprint $table) {
                $table->id();
                $table->uuid('uuid')->unique();

                $table->foreignId('tenant_id')
                    ->constrained('tenants')
                    ->cascadeOnDelete();

                $table->foreignId('branch_id')
                    ->constrained('branches')
                    ->cascadeOnDelete();

                $table->date('business_date');

                $table->foreignId('requested_by')
                    ->constrained('users')
                    ->cascadeOnDelete();

                $table->foreignId('approved_by')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table->string('status', 30)
                    ->default('pending')
                    ->index();

                $table->boolean('requires_code')
                    ->default(false);

                $table->string(
                    'approval_code_hash',
                    255
                )->nullable();

                $table->unsignedSmallInteger(
                    'failed_attempts'
                )->default(0);

                $table->unsignedInteger(
                    'live_activity_count'
                )->default(0);

                $table->decimal(
                    'live_activity_total',
                    15,
                    2
                )->default(0);

                $table->text('request_reason');

                $table->string(
                    'historical_reference',
                    160
                )->nullable();

                $table->text(
                    'decision_notes'
                )->nullable();

                $table->timestamp(
                    'approved_at'
                )->nullable();

                $table->timestamp(
                    'rejected_at'
                )->nullable();

                $table->timestamp(
                    'expires_at'
                )->nullable();

                $table->timestamp(
                    'used_at'
                )->nullable();

                $table->json('metadata')->nullable();
                $table->timestamps();

                $table->index(
                    [
                        'tenant_id',
                        'branch_id',
                        'business_date',
                        'status',
                    ],
                    'historical_pos_approval_scope_idx'
                );

                $table->index(
                    [
                        'tenant_id',
                        'requested_by',
                        'status',
                    ],
                    'historical_pos_requester_idx'
                );
            }
        );

        Schema::table(
            'pharmaco_pos_sessions',
            function (Blueprint $table) {
                $table->string(
                    'session_mode',
                    30
                )->default('live');

                $table->text(
                    'historical_reason'
                )->nullable();

                $table->string(
                    'historical_reference',
                    160
                )->nullable();

                $table->foreignId(
                    'historical_approval_id'
                )
                    ->nullable()
                    ->constrained(
                        'pharmaco_pos_historical_approvals'
                    )
                    ->nullOnDelete();

                $table->index(
                    [
                        'tenant_id',
                        'branch_id',
                        'business_date',
                        'session_mode',
                        'status',
                    ],
                    'pos_session_mode_scope_idx'
                );
            }
        );

        Schema::table(
            'pharmaco_sales',
            function (Blueprint $table) {
                $table->foreignId(
                    'pos_session_id'
                )
                    ->nullable()
                    ->constrained(
                        'pharmaco_pos_sessions'
                    )
                    ->nullOnDelete();

                $table->string(
                    'entry_mode',
                    30
                )->default('live');

                $table->date(
                    'business_date'
                )->nullable();

                $table->text(
                    'historical_reason'
                )->nullable();

                $table->string(
                    'historical_reference',
                    160
                )->nullable();

                $table->foreignId(
                    'historical_approval_id'
                )
                    ->nullable()
                    ->constrained(
                        'pharmaco_pos_historical_approvals'
                    )
                    ->nullOnDelete();

                $table->index(
                    [
                        'tenant_id',
                        'branch_id',
                        'business_date',
                        'entry_mode',
                        'status',
                    ],
                    'pharmaco_sale_business_mode_idx'
                );

                $table->index(
                    [
                        'tenant_id',
                        'pos_session_id',
                    ],
                    'pharmaco_sale_session_idx'
                );
            }
        );

        Schema::table(
            'pharmaco_payments',
            function (Blueprint $table) {
                $table->foreignId(
                    'pos_session_id'
                )
                    ->nullable()
                    ->constrained(
                        'pharmaco_pos_sessions'
                    )
                    ->nullOnDelete();

                $table->date(
                    'business_date'
                )->nullable();

                $table->string(
                    'entry_mode',
                    30
                )->default('live');

                $table->foreignId(
                    'historical_approval_id'
                )
                    ->nullable()
                    ->constrained(
                        'pharmaco_pos_historical_approvals'
                    )
                    ->nullOnDelete();

                $table->index(
                    [
                        'tenant_id',
                        'business_date',
                        'entry_mode',
                        'status',
                    ],
                    'pharmaco_payment_business_mode_idx'
                );

                $table->index(
                    [
                        'tenant_id',
                        'pos_session_id',
                    ],
                    'pharmaco_payment_session_idx'
                );
            }
        );

        Schema::table(
            'stock_movements',
            function (Blueprint $table) {
                $table->foreignId(
                    'pos_session_id'
                )
                    ->nullable()
                    ->constrained(
                        'pharmaco_pos_sessions'
                    )
                    ->nullOnDelete();

                $table->date(
                    'business_date'
                )->nullable();

                $table->string(
                    'entry_mode',
                    30
                )->default('live');

                $table->foreignId(
                    'historical_approval_id'
                )
                    ->nullable()
                    ->constrained(
                        'pharmaco_pos_historical_approvals'
                    )
                    ->nullOnDelete();

                $table->index(
                    [
                        'tenant_id',
                        'business_date',
                        'entry_mode',
                        'movement_type',
                    ],
                    'stock_movement_business_mode_idx'
                );

                $table->index(
                    [
                        'tenant_id',
                        'pos_session_id',
                    ],
                    'stock_movement_session_idx'
                );
            }
        );
    }

    public function down(): void
    {
        Schema::table(
            'stock_movements',
            function (Blueprint $table) {
                $table->dropIndex(
                    'stock_movement_business_mode_idx'
                );

                $table->dropIndex(
                    'stock_movement_session_idx'
                );

                $table->dropConstrainedForeignId(
                    'historical_approval_id'
                );

                $table->dropConstrainedForeignId(
                    'pos_session_id'
                );

                $table->dropColumn([
                    'business_date',
                    'entry_mode',
                ]);
            }
        );

        Schema::table(
            'pharmaco_payments',
            function (Blueprint $table) {
                $table->dropIndex(
                    'pharmaco_payment_business_mode_idx'
                );

                $table->dropIndex(
                    'pharmaco_payment_session_idx'
                );

                $table->dropConstrainedForeignId(
                    'historical_approval_id'
                );

                $table->dropConstrainedForeignId(
                    'pos_session_id'
                );

                $table->dropColumn([
                    'business_date',
                    'entry_mode',
                ]);
            }
        );

        Schema::table(
            'pharmaco_sales',
            function (Blueprint $table) {
                $table->dropIndex(
                    'pharmaco_sale_business_mode_idx'
                );

                $table->dropIndex(
                    'pharmaco_sale_session_idx'
                );

                $table->dropConstrainedForeignId(
                    'historical_approval_id'
                );

                $table->dropConstrainedForeignId(
                    'pos_session_id'
                );

                $table->dropColumn([
                    'entry_mode',
                    'business_date',
                    'historical_reason',
                    'historical_reference',
                ]);
            }
        );

        Schema::table(
            'pharmaco_pos_sessions',
            function (Blueprint $table) {
                $table->dropIndex(
                    'pos_session_mode_scope_idx'
                );

                $table->dropConstrainedForeignId(
                    'historical_approval_id'
                );

                $table->dropColumn([
                    'session_mode',
                    'historical_reason',
                    'historical_reference',
                ]);
            }
        );

        Schema::dropIfExists(
            'pharmaco_pos_historical_approvals'
        );
    }
};
