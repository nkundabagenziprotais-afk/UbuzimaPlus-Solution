<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pharmaco_customers', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid');
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('first_name');
            $table->string('last_name')->nullable();
            $table->string('phone', 80)->nullable();
            $table->string('email')->nullable();
            $table->date('date_of_birth')->nullable();
            $table->string('gender', 40)->nullable();
            $table->string('customer_type', 80)->default('patient');
            $table->string('insurance_provider')->nullable();
            $table->string('insurance_membership_number')->nullable();
            $table->string('status', 40)->default('active');
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'status']);
            $table->unique(['tenant_id', 'phone']);
        });

        Schema::create('pharmaco_prescriptions', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid');
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('pharmaco_customer_id')->nullable()->constrained('pharmaco_customers')->nullOnDelete();
            $table->string('prescription_number', 120);
            $table->string('prescriber_name')->nullable();
            $table->string('prescriber_facility')->nullable();
            $table->string('prescriber_phone', 80)->nullable();
            $table->date('issued_at')->nullable();
            $table->date('expires_at')->nullable();
            $table->string('status', 40)->default('active');
            $table->text('notes')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'status']);
            $table->unique(['tenant_id', 'prescription_number']);
        });

        Schema::create('pharmaco_sales', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid');
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('branch_id')->constrained()->cascadeOnDelete();
            $table->foreignId('pharmaco_customer_id')->nullable()->constrained('pharmaco_customers')->nullOnDelete();
            $table->foreignId('pharmaco_prescription_id')->nullable()->constrained('pharmaco_prescriptions')->nullOnDelete();
            $table->string('sale_number', 120);
            $table->string('sale_type', 80)->default('cash_sale');
            $table->string('status', 40)->default('draft');
            $table->decimal('subtotal_amount', 15, 2)->default(0);
            $table->decimal('discount_amount', 15, 2)->default(0);
            $table->decimal('tax_amount', 15, 2)->default(0);
            $table->decimal('total_amount', 15, 2)->default(0);
            $table->decimal('paid_amount', 15, 2)->default(0);
            $table->decimal('balance_amount', 15, 2)->default(0);
            $table->string('payment_status', 40)->default('unpaid');
            $table->foreignId('sold_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('sold_at')->nullable();
            $table->text('notes')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'branch_id', 'status']);
            $table->unique(['tenant_id', 'sale_number']);
        });

        Schema::create('pharmaco_sale_items', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid');
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('pharmaco_sale_id')->constrained('pharmaco_sales')->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->restrictOnDelete();
            $table->foreignId('stock_batch_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('stock_location_id')->nullable()->constrained()->nullOnDelete();
            $table->string('product_name_snapshot');
            $table->string('sku_snapshot', 120);
            $table->decimal('quantity', 15, 3);
            $table->decimal('unit_price', 15, 2);
            $table->decimal('discount_amount', 15, 2)->default(0);
            $table->decimal('tax_amount', 15, 2)->default(0);
            $table->decimal('line_total', 15, 2);
            $table->boolean('requires_prescription')->default(false);
            $table->boolean('prescription_verified')->default(false);
            $table->string('status', 40)->default('pending');
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'pharmaco_sale_id']);
            $table->index(['tenant_id', 'product_id']);
        });

        Schema::create('pharmaco_payments', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid');
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('pharmaco_sale_id')->constrained('pharmaco_sales')->cascadeOnDelete();
            $table->decimal('amount', 15, 2);
            $table->string('payment_method', 80);
            $table->string('status', 40)->default('pending');
            $table->string('reference_number', 120)->nullable();
            $table->foreignId('received_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('received_at')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'pharmaco_sale_id']);
            $table->index(['tenant_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pharmaco_payments');
        Schema::dropIfExists('pharmaco_sale_items');
        Schema::dropIfExists('pharmaco_sales');
        Schema::dropIfExists('pharmaco_prescriptions');
        Schema::dropIfExists('pharmaco_customers');
    }
};
