<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('finance_chart_of_accounts', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('tenant_id');
            $table->unsignedBigInteger('parent_id')->nullable();
            $table->string('code', 50);
            $table->string('name', 191);
            $table->string('account_type', 50);
            $table->string('normal_balance', 10);
            $table->string('currency_code', 3)->default('RWF');
            $table->boolean('is_control_account')->default(false);
            $table->boolean('is_cash_or_bank')->default(false);
            $table->boolean('is_active')->default(true);
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->unique(['tenant_id', 'code'], 'finance_coa_tenant_code_unique');
            $table->index(['tenant_id', 'account_type']);
            $table->index(['tenant_id', 'is_active']);
            $table->foreign('parent_id')->references('id')->on('finance_chart_of_accounts')->nullOnDelete();
        });

        Schema::create('finance_accounting_periods', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('tenant_id');
            $table->unsignedBigInteger('branch_id')->nullable();
            $table->string('name', 100);
            $table->date('starts_on');
            $table->date('ends_on');
            $table->string('status', 30)->default('open');
            $table->boolean('is_locked')->default(false);
            $table->unsignedBigInteger('closed_by')->nullable();
            $table->timestamp('closed_at')->nullable();
            $table->text('close_reason')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->unique(['tenant_id', 'branch_id', 'starts_on', 'ends_on'], 'finance_period_unique_scope');
            $table->index(['tenant_id', 'starts_on', 'ends_on']);
            $table->index(['tenant_id', 'status', 'is_locked']);
        });

        Schema::create('finance_journal_entries', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('tenant_id');
            $table->unsignedBigInteger('branch_id')->nullable();
            $table->unsignedBigInteger('accounting_period_id')->nullable();
            $table->string('journal_number', 100);
            $table->date('business_date');
            $table->string('source_module', 50);
            $table->string('source_type', 80);
            $table->string('source_id', 100);
            $table->string('idempotency_key', 100);
            $table->string('status', 30)->default('posted');
            $table->string('currency_code', 3)->default('RWF');
            $table->decimal('exchange_rate', 18, 8)->default(1);
            $table->decimal('total_debit', 18, 4)->default(0);
            $table->decimal('total_credit', 18, 4)->default(0);
            $table->text('memo')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('approved_by')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->unsignedBigInteger('reversed_entry_id')->nullable();
            $table->json('source_snapshot')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->unique(['tenant_id', 'idempotency_key'], 'finance_je_tenant_idempotency_unique');
            $table->unique(['tenant_id', 'journal_number'], 'finance_je_tenant_number_unique');
            $table->index(['tenant_id', 'business_date']);
            $table->index(['tenant_id', 'source_module', 'source_type', 'source_id'], 'finance_je_source_index');
            $table->foreign('accounting_period_id')->references('id')->on('finance_accounting_periods')->nullOnDelete();
            $table->foreign('reversed_entry_id')->references('id')->on('finance_journal_entries')->nullOnDelete();
        });

        Schema::create('finance_journal_lines', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('tenant_id');
            $table->unsignedBigInteger('journal_entry_id');
            $table->unsignedBigInteger('chart_of_account_id');
            $table->unsignedBigInteger('branch_id')->nullable();
            $table->unsignedBigInteger('department_id')->nullable();
            $table->unsignedBigInteger('customer_id')->nullable();
            $table->unsignedBigInteger('supplier_id')->nullable();
            $table->unsignedBigInteger('product_id')->nullable();
            $table->unsignedBigInteger('stock_location_id')->nullable();
            $table->unsignedBigInteger('insurance_partner_id')->nullable();
            $table->string('payment_method', 50)->nullable();
            $table->string('line_type', 80)->nullable();
            $table->decimal('debit', 18, 4)->default(0);
            $table->decimal('credit', 18, 4)->default(0);
            $table->text('description')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'journal_entry_id']);
            $table->index(['tenant_id', 'chart_of_account_id']);
            $table->index(['tenant_id', 'branch_id']);
            $table->foreign('journal_entry_id')->references('id')->on('finance_journal_entries')->cascadeOnDelete();
            $table->foreign('chart_of_account_id')->references('id')->on('finance_chart_of_accounts')->cascadeOnDelete();
        });

        Schema::create('finance_posting_logs', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('tenant_id');
            $table->unsignedBigInteger('branch_id')->nullable();
            $table->unsignedBigInteger('journal_entry_id')->nullable();
            $table->string('source_module', 50);
            $table->string('source_type', 80);
            $table->string('source_id', 100);
            $table->string('idempotency_key', 100);
            $table->date('business_date')->nullable();
            $table->string('status', 30)->default('pending');
            $table->string('mode', 30)->default('live');
            $table->string('failure_code', 100)->nullable();
            $table->text('failure_message')->nullable();
            $table->unsignedInteger('attempt_count')->default(0);
            $table->timestamp('posted_at')->nullable();
            $table->timestamp('quarantined_at')->nullable();
            $table->json('source_snapshot')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->unique(['tenant_id', 'idempotency_key'], 'finance_posting_tenant_idempotency_unique');
            $table->index(['tenant_id', 'status']);
            $table->index(['tenant_id', 'source_module', 'source_type', 'source_id'], 'finance_posting_source_index');
            $table->foreign('journal_entry_id')->references('id')->on('finance_journal_entries')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('finance_posting_logs');
        Schema::dropIfExists('finance_journal_lines');
        Schema::dropIfExists('finance_journal_entries');
        Schema::dropIfExists('finance_accounting_periods');
        Schema::dropIfExists('finance_chart_of_accounts');
    }
};
