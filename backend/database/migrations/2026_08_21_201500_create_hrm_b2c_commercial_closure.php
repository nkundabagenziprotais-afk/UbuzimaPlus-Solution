<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payroll_employee_payment_profiles', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignId('employee_id')->constrained('hrm_employees')->cascadeOnDelete();
            $table->string('payment_method', 30)->default('bank_transfer');
            $table->text('encrypted_payload');
            $table->string('status', 30)->default('active');
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(
                ['tenant_id', 'employee_id'],
                'payroll_payment_profile_employee_uq'
            );

            $table->index(
                ['tenant_id', 'status'],
                'payroll_payment_profile_status_ix'
            );
        });

        Schema::create('payroll_exports', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignId('payroll_run_id')->constrained('payroll_runs')->cascadeOnDelete();
            $table->string('export_type', 50);
            $table->string('template_code', 100);
            $table->string('template_version', 50);
            $table->string('file_name', 191);
            $table->string('disk', 30)->default('local');
            $table->string('storage_path', 191);
            $table->string('mime_type', 100);
            $table->string('checksum_sha256', 64);
            $table->unsignedInteger('row_count')->default(0);
            $table->string('status', 30)->default('generated');
            $table->foreignId('generated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->dateTime('generated_at');
            $table->text('metadata')->nullable();
            $table->timestamps();

            $table->index(
                ['tenant_id', 'payroll_run_id', 'export_type'],
                'payroll_export_run_type_ix'
            );

            $table->index(
                ['tenant_id', 'status'],
                'payroll_export_status_ix'
            );
        });

        Schema::create('payroll_declarations', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignId('payroll_run_id')->constrained('payroll_runs')->cascadeOnDelete();
            $table->string('authority', 50)->default('RRA_RSSB');
            $table->string('declaration_type', 50)->default('UNIFIED_PAYE_RSSB');
            $table->string('submission_channel', 30)->default('ISHEMA');
            $table->unsignedSmallInteger('period_year');
            $table->unsignedTinyInteger('period_month');
            $table->date('due_date');
            $table->string('status', 30)->default('submitted');
            $table->string('reference_number', 100)->nullable();
            $table->text('amounts_payload');
            $table->foreignId('submitted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->dateTime('submitted_at')->nullable();
            $table->foreignId('accepted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->dateTime('accepted_at')->nullable();
            $table->text('notes')->nullable();
            $table->text('metadata')->nullable();
            $table->timestamps();

            $table->index(
                ['tenant_id', 'payroll_run_id', 'status'],
                'payroll_declaration_run_status_ix'
            );

            $table->index(
                ['tenant_id', 'period_year', 'period_month'],
                'payroll_declaration_period_ix'
            );
        });

        Schema::create('payroll_payments', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignId('payroll_run_id')->constrained('payroll_runs')->cascadeOnDelete();
            $table->string('payment_type', 50);
            $table->decimal('amount', 18, 2);
            $table->string('payment_method', 30);
            $table->string('reference_number', 100)->nullable();
            $table->dateTime('paid_at')->nullable();
            $table->string('status', 30)->default('confirmed');
            $table->foreignId('reconciled_by')->nullable()->constrained('users')->nullOnDelete();
            $table->dateTime('reconciled_at')->nullable();
            $table->text('notes')->nullable();
            $table->text('metadata')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(
                ['tenant_id', 'payroll_run_id', 'payment_type'],
                'payroll_payment_run_type_ix'
            );

            $table->index(
                ['tenant_id', 'status'],
                'payroll_payment_status_ix'
            );
        });

        Schema::create('payroll_adjustments', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignId('original_payroll_run_id')
                ->constrained('payroll_runs')
                ->cascadeOnDelete();
            $table->foreignId('adjustment_payroll_run_id')
                ->nullable()
                ->constrained('payroll_runs')
                ->nullOnDelete();
            $table->string('adjustment_type', 50);
            $table->text('reason');
            $table->string('status', 30)->default('draft');
            $table->foreignId('requested_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->dateTime('approved_at')->nullable();
            $table->text('metadata')->nullable();
            $table->timestamps();

            $table->index(
                ['tenant_id', 'original_payroll_run_id', 'status'],
                'payroll_adjustment_original_status_ix'
            );
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payroll_adjustments');
        Schema::dropIfExists('payroll_payments');
        Schema::dropIfExists('payroll_declarations');
        Schema::dropIfExists('payroll_exports');
        Schema::dropIfExists('payroll_employee_payment_profiles');
    }
};

