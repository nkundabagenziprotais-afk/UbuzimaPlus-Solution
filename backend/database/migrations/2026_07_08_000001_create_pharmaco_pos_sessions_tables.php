<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create(
            'pharmaco_pos_sessions',
            function (Blueprint $table) {
                $table->id();
                $table->uuid()->unique();

                $table->foreignId('tenant_id')
                    ->constrained()
                    ->cascadeOnDelete();

                $table->foreignId('branch_id')
                    ->nullable()
                    ->constrained('branches')
                    ->nullOnDelete();

                $table->foreignId('user_id')
                    ->constrained('users')
                    ->cascadeOnDelete();

                $table->date('business_date');

                $table->unsignedSmallInteger(
                    'sequence_number'
                )->default(1);

                $table->string(
                    'session_number',
                    100
                )->index();

                $table->string(
                    'status',
                    30
                )->default('open')
                    ->index();

                $table->decimal(
                    'opening_float_amount',
                    14,
                    2
                )->default(0);

                $table->decimal(
                    'expected_cash_amount',
                    14,
                    2
                )->default(0);

                $table->decimal(
                    'declared_cash_amount',
                    14,
                    2
                )->nullable();

                $table->decimal(
                    'cash_drop_amount',
                    14,
                    2
                )->default(0);

                $table->decimal(
                    'balance_clearance_amount',
                    14,
                    2
                )->default(0);

                $table->decimal(
                    'variance_amount',
                    14,
                    2
                )->nullable();

                $table->timestamp('opened_at')->nullable();
                $table->timestamp('zeroized_at')->nullable();
                $table->timestamp('closed_at')->nullable();

                $table->timestamp(
                    'reset_authorized_at'
                )->nullable();

                $table->foreignId(
                    'reset_authorized_by'
                )
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table->text('reset_reason')->nullable();
                $table->json('metadata')->nullable();
                $table->timestamps();

                /*
                 * Branch is deliberately excluded. A user cannot
                 * bypass the daily limit by changing branch.
                 */
                $table->unique(
                    [
                        'tenant_id',
                        'user_id',
                        'business_date',
                        'sequence_number',
                    ],
                    'pos_user_day_sequence_unique'
                );

                $table->index(
                    [
                        'tenant_id',
                        'user_id',
                        'business_date',
                        'status',
                    ],
                    'pos_user_day_status_idx'
                );

                $table->index(
                    [
                        'tenant_id',
                        'branch_id',
                        'business_date',
                        'status',
                    ],
                    'pos_branch_day_status_idx'
                );
            }
        );

        Schema::create(
            'pharmaco_pos_clock_events',
            function (Blueprint $table) {
                $table->id();
                $table->uuid()->unique();

                $table->foreignId('tenant_id')
                    ->constrained()
                    ->cascadeOnDelete();

                $table->foreignId('pos_session_id')
                    ->constrained('pharmaco_pos_sessions')
                    ->cascadeOnDelete();

                $table->foreignId('user_id')
                    ->constrained('users')
                    ->cascadeOnDelete();

                $table->string(
                    'event_type',
                    50
                )->index();

                $table->decimal(
                    'amount',
                    14,
                    2
                )->nullable();

                $table->text('notes')->nullable();
                $table->json('metadata')->nullable();
                $table->timestamps();

                $table->index(
                    [
                        'tenant_id',
                        'user_id',
                        'event_type',
                    ],
                    'pos_clock_event_scope_idx'
                );
            }
        );
    }

    public function down(): void
    {
        Schema::dropIfExists(
            'pharmaco_pos_clock_events'
        );

        Schema::dropIfExists(
            'pharmaco_pos_sessions'
        );
    }
};
