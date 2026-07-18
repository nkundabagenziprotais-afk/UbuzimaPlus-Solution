<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('insurance_sales_register')) {
            return;
        }

        Schema::create('insurance_sales_register', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->unsignedBigInteger('tenant_id');
            $table->unsignedBigInteger('branch_id')->nullable();

            $table->unsignedBigInteger('insurance_partner_id');
            $table->unsignedBigInteger('insurance_institution_id')->nullable();
            $table->unsignedBigInteger('insurance_scheme_id')->nullable();
            $table->unsignedBigInteger('customer_insurance_membership_id')->nullable();

            $table->unsignedBigInteger('customer_id')->nullable();
            $table->string('customer_name_snapshot', 191)->nullable();
            $table->string('member_number_snapshot', 191)->nullable();

            $table->unsignedBigInteger('sale_id')->nullable();
            $table->unsignedBigInteger('sale_item_id')->nullable();
            $table->string('sale_number', 100)->nullable();
            $table->date('sale_date');
            $table->date('claim_period')->nullable();

            $table->unsignedBigInteger('product_id')->nullable();
            $table->string('product_name_snapshot', 191);
            $table->string('sku_snapshot', 100)->nullable();
            $table->string('batch_number_snapshot', 100)->nullable();

            $table->decimal('quantity', 15, 4)->default(1);
            $table->decimal('standard_unit_price', 15, 4)->default(0);
            $table->decimal('insurance_unit_price', 15, 4)->default(0);
            $table->decimal('gross_amount', 15, 2)->default(0);
            $table->decimal('customer_contribution_amount', 15, 2)->default(0);
            $table->decimal('insurer_claim_amount', 15, 2)->default(0);

            $table->string('coverage_status', 60)->default('covered');
            $table->string('pre_authorization_number', 191)->nullable();

            $table->unsignedBigInteger('insurance_claim_id')->nullable();
            $table->string('claim_number', 100)->nullable();
            $table->string('claim_status', 60)->default('pending');

            $table->unsignedBigInteger('insurance_reconciliation_batch_id')->nullable();
            $table->string('invoice_number', 100)->nullable();
            $table->string('receipt_number', 100)->nullable();

            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'insurance_partner_id']);
            $table->index(['tenant_id', 'insurance_institution_id']);
            $table->index(['tenant_id', 'insurance_scheme_id']);
            $table->index(['tenant_id', 'sale_date']);
            $table->index(['tenant_id', 'claim_period']);
            $table->index(['tenant_id', 'insurance_claim_id']);
            $table->index(['tenant_id', 'claim_status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('insurance_sales_register');
    }
};
