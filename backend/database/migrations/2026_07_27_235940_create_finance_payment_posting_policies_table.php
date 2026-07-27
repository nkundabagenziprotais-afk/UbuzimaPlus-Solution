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
            'finance_payment_posting_policies',
            function (Blueprint $table): void {
                $table->id();

                $table->unsignedBigInteger('tenant_id');
                $table->string('policy_code', 100);
                $table->string('source_type', 50);
                $table->unsignedBigInteger('source_id');
                $table->string('policy_action', 50);
                $table->string('status', 30)
                    ->default('active');

                $table->date('effective_date');

                $table->decimal(
                    'source_amount',
                    18,
                    4
                );

                $table->date(
                    'source_business_date'
                );

                $table->char(
                    'source_state_hash',
                    64
                );

                $table->text('reason');
                $table->text('evidence_reference');

                $table->char(
                    'evidence_hash',
                    64
                );

                $table->unsignedBigInteger(
                    'approved_by_user_id'
                );

                $table->timestamp('approved_at');

                $table->json('metadata')
                    ->nullable();

                $table->timestamps();

                $table->unique(
                    [
                        'tenant_id',
                        'source_type',
                        'source_id',
                        'policy_action',
                    ],
                    'fin_pay_pol_source_action_uq'
                );

                $table->index(
                    [
                        'tenant_id',
                        'status',
                        'policy_action',
                    ],
                    'fin_pay_pol_status_idx'
                );

                $table->index(
                    [
                        'tenant_id',
                        'policy_code',
                    ],
                    'fin_pay_pol_code_idx'
                );
            }
        );
    }

    public function down(): void
    {
        Schema::dropIfExists(
            'finance_payment_posting_policies'
        );
    }
};
