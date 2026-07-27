<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create(
            'finance_payment_posting_policy_attempts',
            function (Blueprint $table): void {
                $table->id();

                $table->unsignedBigInteger('tenant_id');

                $table->unsignedBigInteger('policy_id')
                    ->nullable();

                $table->string('source_type', 50);
                $table->unsignedBigInteger('source_id');

                $table->string(
                    'attempted_command',
                    191
                );

                $table->string('decision', 50);
                $table->text('reason');

                $table->unsignedBigInteger(
                    'attempted_by_user_id'
                )->nullable();

                $table->timestamp('attempted_at');

                $table->string(
                    'request_correlation_id',
                    100
                )->nullable();

                $table->json('metadata')
                    ->nullable();

                $table->timestamp('created_at')
                    ->nullable();

                $table->index(
                    [
                        'tenant_id',
                        'source_type',
                        'source_id',
                    ],
                    'fin_pay_pol_attempt_source_idx'
                );

                $table->index(
                    [
                        'tenant_id',
                        'decision',
                        'attempted_at',
                    ],
                    'fin_pay_pol_attempt_decision_idx'
                );

                $table->index(
                    [
                        'policy_id',
                        'attempted_at',
                    ],
                    'fin_pay_pol_attempt_policy_idx'
                );
            }
        );
    }

    public function down(): void
    {
        Schema::dropIfExists(
            'finance_payment_posting_policy_attempts'
        );
    }
};
