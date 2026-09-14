<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('finance_planning_budgets', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();

            $table->unsignedBigInteger('tenant_id')->index();
            $table->unsignedBigInteger('branch_id')->nullable()->index();

            $table->string('name', 191);
            $table->string('period_type', 30)->default('monthly');

            $table->date('starts_on');
            $table->date('ends_on');

            $table->string('currency_code', 3)->default('RWF');

            $table->unsignedSmallInteger('working_days')->default(26);

            $table->decimal(
                'desired_profit_amount',
                18,
                2
            )->default(0);

            $table->string('status', 30)->default('draft');

            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();

            $table->text('notes')->nullable();
            $table->text('metadata')->nullable();

            $table->timestamps();

            $table->index(
                [
                    'tenant_id',
                    'status',
                    'starts_on',
                    'ends_on',
                ],
                'fp_budget_tenant_period_idx'
            );
        });

        Schema::create('finance_planning_budget_lines', function (Blueprint $table): void {
            $table->id();

            $table->unsignedBigInteger(
                'finance_planning_budget_id'
            )->index();

            $table->unsignedBigInteger('tenant_id')->index();

            $table->string('line_type', 30);
            $table->string('category_key', 100)->nullable();
            $table->string('label', 191);

            $table->decimal('amount', 18, 2)->default(0);

            $table->text('notes')->nullable();
            $table->text('metadata')->nullable();

            $table->timestamps();

            $table->index(
                [
                    'tenant_id',
                    'finance_planning_budget_id',
                    'line_type',
                ],
                'fp_budget_line_scope_idx'
            );
        });

        Schema::create('finance_planning_kpi_targets', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();

            $table->unsignedBigInteger('tenant_id')->index();
            $table->unsignedBigInteger('branch_id')->nullable()->index();

            $table->string('metric_code', 100);
            $table->string('label', 191);

            $table->decimal('target_value', 18, 4);

            $table->string('unit', 30)->default('amount');
            $table->string('direction', 20)->default('at_least');

            $table->date('starts_on');
            $table->date('ends_on');

            $table->decimal('weight', 8, 4)->default(1);

            $table->string('status', 30)->default('active');

            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();

            $table->text('metadata')->nullable();

            $table->timestamps();

            $table->index(
                [
                    'tenant_id',
                    'metric_code',
                    'status',
                ],
                'fp_kpi_metric_status_idx'
            );

            $table->index(
                [
                    'tenant_id',
                    'starts_on',
                    'ends_on',
                ],
                'fp_kpi_period_idx'
            );
        });

        Schema::create('finance_planning_recurring_transactions', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();

            $table->unsignedBigInteger('tenant_id')->index();
            $table->unsignedBigInteger('branch_id')->nullable()->index();

            $table->string('name', 191);
            $table->string('transaction_type', 50);

            $table->decimal('amount', 18, 2);

            $table->string('currency_code', 3)->default('RWF');

            $table->string('category_key', 100)->nullable();
            $table->string('counterparty_name', 191)->nullable();

            $table->string('frequency', 30);

            $table->unsignedSmallInteger(
                'interval_value'
            )->default(1);

            $table->unsignedTinyInteger(
                'day_of_month'
            )->nullable();

            $table->date('starts_on');
            $table->date('ends_on')->nullable();
            $table->date('next_due_on');

            $table->string('status', 30)->default('active');

            $table->string(
                'approval_policy',
                50
            )->default(
                'draft_for_human_approval'
            );

            $table->text('template_payload')->nullable();

            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();

            $table->text('metadata')->nullable();

            $table->timestamps();

            $table->index(
                [
                    'tenant_id',
                    'status',
                    'next_due_on',
                ],
                'fp_recurring_due_idx'
            );
        });

        Schema::create('finance_planning_recurring_occurrences', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();

            $table->unsignedBigInteger('tenant_id')->index();

            $table->unsignedBigInteger(
                'finance_planning_recurring_transaction_id'
            )->index();

            $table->date('due_on');

            $table->decimal('amount', 18, 2);

            $table->string(
                'status',
                30
            )->default(
                'due_for_review'
            );

            $table->string(
                'generated_subject_type',
                100
            )->nullable();

            $table->unsignedBigInteger(
                'generated_subject_id'
            )->nullable();

            $table->unsignedBigInteger(
                'reviewed_by'
            )->nullable();

            $table->timestamp(
                'reviewed_at'
            )->nullable();

            $table->text('metadata')->nullable();

            $table->timestamps();

            $table->unique(
                [
                    'finance_planning_recurring_transaction_id',
                    'due_on',
                ],
                'fp_recurring_occurrence_unique'
            );
        });

        Schema::create('finance_planning_actions', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();

            $table->unsignedBigInteger('tenant_id')->index();
            $table->unsignedBigInteger('actor_id')->nullable()->index();

            $table->string('subject_type', 50);
            $table->unsignedBigInteger('subject_id')->nullable();

            $table->string('action', 50);

            $table->text('before_snapshot')->nullable();
            $table->text('after_snapshot')->nullable();
            $table->text('metadata')->nullable();

            $table->timestamp('acted_at')->nullable();

            $table->timestamps();

            $table->index(
                [
                    'tenant_id',
                    'subject_type',
                    'subject_id',
                ],
                'fp_action_subject_idx'
            );
        });
    }

    public function down(): void
    {
        Schema::dropIfExists(
            'finance_planning_actions'
        );

        Schema::dropIfExists(
            'finance_planning_recurring_occurrences'
        );

        Schema::dropIfExists(
            'finance_planning_recurring_transactions'
        );

        Schema::dropIfExists(
            'finance_planning_kpi_targets'
        );

        Schema::dropIfExists(
            'finance_planning_budget_lines'
        );

        Schema::dropIfExists(
            'finance_planning_budgets'
        );
    }
};
