<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pharmaco_customers', function (Blueprint $table) {
            if (! Schema::hasColumn('pharmaco_customers', 'credit_limit')) {
                $table->decimal('credit_limit', 15, 2)->default(0)->after('status');
            }

            if (! Schema::hasColumn('pharmaco_customers', 'credit_balance')) {
                $table->decimal('credit_balance', 15, 2)->default(0)->after('credit_limit');
            }

            if (! Schema::hasColumn('pharmaco_customers', 'credit_terms_days')) {
                $table->unsignedSmallInteger('credit_terms_days')->nullable()->after('credit_balance');
            }

            if (! Schema::hasColumn('pharmaco_customers', 'credit_status')) {
                $table->string('credit_status', 40)->default('disabled')->after('credit_terms_days');
            }
        });

        Schema::create('pharmaco_customer_receivables', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignId('pharmaco_customer_id')->constrained('pharmaco_customers')->cascadeOnDelete();
            $table->foreignId('pharmaco_sale_id')->nullable()->constrained('pharmaco_sales')->nullOnDelete();
            $table->string('receivable_number', 120);
            $table->string('status', 40)->default('open');
            $table->decimal('original_amount', 15, 2);
            $table->decimal('paid_amount', 15, 2)->default(0);
            $table->decimal('balance_amount', 15, 2);
            $table->date('issued_at')->nullable();
            $table->date('due_date')->nullable();
            $table->timestamp('closed_at')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('notes')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->unique(['tenant_id', 'receivable_number'], 'customer_receivables_tenant_number_unique');
            $table->index(['tenant_id', 'status'], 'customer_receivables_tenant_status_index');
            $table->index(['tenant_id', 'pharmaco_customer_id'], 'customer_receivables_tenant_customer_index');
        });

        Schema::create('pharmaco_customer_receivable_payments', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignId('pharmaco_customer_receivable_id')->constrained('pharmaco_customer_receivables')->cascadeOnDelete();
            $table->foreignId('pharmaco_customer_id')->constrained('pharmaco_customers')->cascadeOnDelete();
            $table->string('payment_number', 120);
            $table->decimal('amount', 15, 2);
            $table->string('payment_method', 40);
            $table->string('reference_number', 120)->nullable();
            $table->string('status', 40)->default('completed');
            $table->dateTime('paid_at')->nullable();
            $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('notes')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->unique(['tenant_id', 'payment_number'], 'customer_receivable_payments_tenant_number_unique');
            $table->index(['tenant_id', 'pharmaco_customer_id'], 'customer_receivable_payments_tenant_customer_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pharmaco_customer_receivable_payments');
        Schema::dropIfExists('pharmaco_customer_receivables');

        Schema::table('pharmaco_customers', function (Blueprint $table) {
            foreach (['credit_status', 'credit_terms_days', 'credit_balance', 'credit_limit'] as $column) {
                if (Schema::hasColumn('pharmaco_customers', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
