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
            'payroll_regulatory_change_requests',
            function (Blueprint $table): void {
                $table->id();
                $table->uuid('uuid')->unique();

                $table->unsignedBigInteger('tenant_id');

                $table->unsignedBigInteger(
                    'branch_id'
                )->nullable();

                $table->unsignedBigInteger(
                    'source_rule_version_id'
                );

                $table->unsignedBigInteger(
                    'created_rule_version_id'
                )->nullable();

                $table->date(
                    'proposed_effective_from'
                );

                $table->date(
                    'proposed_effective_to'
                )->nullable();

                $table->decimal(
                    'proposed_employee_rate',
                    12,
                    6
                )->nullable();

                $table->decimal(
                    'proposed_employer_rate',
                    12,
                    6
                )->nullable();

                $table->string(
                    'proposed_base_code',
                    100
                )->nullable();

                $table->string(
                    'proposed_rounding_rule',
                    50
                )->nullable();

                $table->string(
                    'proposed_condition_code',
                    100
                )->nullable();

                $table->string(
                    'proposed_source_reference',
                    191
                )->nullable();

                $table->text(
                    'proposed_source_url'
                )->nullable();

                $table->text(
                    'proposed_metadata'
                )->nullable();

                $table->text(
                    'change_rationale'
                );

                $table->string(
                    'status',
                    30
                )->default('DRAFT');

                $table->unsignedBigInteger(
                    'created_by'
                );

                $table->unsignedBigInteger(
                    'submitted_by'
                )->nullable();

                $table->unsignedBigInteger(
                    'approved_by'
                )->nullable();

                $table->timestamp(
                    'submitted_at'
                )->nullable();

                $table->timestamp(
                    'approved_at'
                )->nullable();

                $table->timestamps();

                $table->index(
                    [
                        'tenant_id',
                        'status',
                    ],
                    'prcr_tenant_status_ix'
                );

                $table->index(
                    'source_rule_version_id',
                    'prcr_source_rule_ix'
                );
            }
        );

        Schema::create(
            'payroll_regulatory_change_actions',
            function (Blueprint $table): void {
                $table->id();

                $table->unsignedBigInteger(
                    'payroll_regulatory_change_request_id'
                );

                $table->unsignedBigInteger(
                    'tenant_id'
                );

                $table->unsignedBigInteger(
                    'actor_id'
                );

                $table->string(
                    'action',
                    50
                );

                $table->string(
                    'previous_status',
                    30
                )->nullable();

                $table->string(
                    'new_status',
                    30
                )->nullable();

                $table->text(
                    'comment'
                )->nullable();

                $table->text(
                    'snapshot'
                )->nullable();

                $table->timestamp(
                    'acted_at'
                );

                $table->timestamps();

                $table->index(
                    [
                        'payroll_regulatory_change_request_id',
                        'acted_at',
                    ],
                    'prca_request_time_ix'
                );
            }
        );

        Schema::create(
            'payroll_finance_mapping_configs',
            function (Blueprint $table): void {
                $table->id();
                $table->uuid('uuid')->unique();

                $table->unsignedBigInteger(
                    'tenant_id'
                );

                $table->unsignedBigInteger(
                    'branch_id'
                )->nullable();

                $table->date(
                    'effective_from'
                );

                $table->unsignedBigInteger(
                    'salary_expense_account_id'
                );

                $table->unsignedBigInteger(
                    'employer_statutory_account_id'
                );

                $table->string(
                    'payment_source',
                    30
                );

                $table->text(
                    'change_rationale'
                );

                $table->string(
                    'status',
                    30
                )->default('DRAFT');

                $table->unsignedBigInteger(
                    'created_by'
                );

                $table->unsignedBigInteger(
                    'submitted_by'
                )->nullable();

                $table->unsignedBigInteger(
                    'approved_by'
                )->nullable();

                $table->timestamp(
                    'submitted_at'
                )->nullable();

                $table->timestamp(
                    'approved_at'
                )->nullable();

                $table->timestamps();

                $table->index(
                    [
                        'tenant_id',
                        'branch_id',
                        'status',
                        'effective_from',
                    ],
                    'pfmc_scope_status_effective_ix'
                );
            }
        );

        Schema::create(
            'payroll_finance_mapping_actions',
            function (Blueprint $table): void {
                $table->id();

                $table->unsignedBigInteger(
                    'payroll_finance_mapping_config_id'
                );

                $table->unsignedBigInteger(
                    'tenant_id'
                );

                $table->unsignedBigInteger(
                    'actor_id'
                );

                $table->string(
                    'action',
                    50
                );

                $table->string(
                    'previous_status',
                    30
                )->nullable();

                $table->string(
                    'new_status',
                    30
                )->nullable();

                $table->text(
                    'comment'
                )->nullable();

                $table->timestamp(
                    'acted_at'
                );

                $table->timestamps();

                $table->index(
                    [
                        'payroll_finance_mapping_config_id',
                        'acted_at',
                    ],
                    'pfma_mapping_time_ix'
                );
            }
        );
    }

    public function down(): void
    {
        Schema::dropIfExists(
            'payroll_finance_mapping_actions'
        );

        Schema::dropIfExists(
            'payroll_finance_mapping_configs'
        );

        Schema::dropIfExists(
            'payroll_regulatory_change_actions'
        );

        Schema::dropIfExists(
            'payroll_regulatory_change_requests'
        );
    }
};
