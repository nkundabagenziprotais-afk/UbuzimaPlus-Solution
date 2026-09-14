<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('finance_period_close_actions')) {
            return;
        }

        Schema::create(
            'finance_period_close_actions',
            function (Blueprint $table): void {
                $table->id();

                $table->uuid('uuid')->unique();

                $table
                    ->unsignedBigInteger('tenant_id')
                    ->index();

                $table
                    ->unsignedBigInteger('branch_id')
                    ->nullable()
                    ->index();

                $table
                    ->unsignedBigInteger('accounting_period_id')
                    ->index();

                $table
                    ->string('action_type',20)
                    ->index();

                $table
                    ->string('status',30)
                    ->default('requested')
                    ->index();

                $table->text('reason');

                $table
                    ->unsignedBigInteger('requested_by')
                    ->nullable()
                    ->index();

                $table
                    ->string('requested_by_name',191)
                    ->nullable();

                $table
                    ->timestamp('requested_at')
                    ->nullable();

                $table
                    ->unsignedBigInteger('decided_by')
                    ->nullable()
                    ->index();

                $table
                    ->string('decided_by_name',191)
                    ->nullable();

                $table
                    ->timestamp('decided_at')
                    ->nullable();

                $table
                    ->text('decision_comment')
                    ->nullable();

                $table
                    ->longText('readiness_snapshot')
                    ->nullable();

                $table
                    ->char('readiness_sha256',64)
                    ->nullable();

                $table
                    ->longText('execution_snapshot')
                    ->nullable();

                $table
                    ->char('execution_sha256',64)
                    ->nullable();

                $table
                    ->timestamp('executed_at')
                    ->nullable();

                $table
                    ->longText('metadata')
                    ->nullable();

                $table->timestamps();

                $table->index(
                    [
                        'tenant_id',
                        'accounting_period_id',
                        'status',
                    ],
                    'fin_period_action_tenant_period_status_idx'
                );

                $table->index(
                    [
                        'tenant_id',
                        'action_type',
                        'status',
                    ],
                    'fin_period_action_tenant_type_status_idx'
                );
            }
        );
    }

    public function down(): void
    {
        Schema::dropIfExists(
            'finance_period_close_actions'
        );
    }
};
