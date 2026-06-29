<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pharmaco_supplier_invoices', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignId('pharmaco_supplier_id')->constrained('pharmaco_suppliers')->cascadeOnDelete();
            $table->foreignId('pharmaco_purchase_order_id')->nullable()->constrained('pharmaco_purchase_orders')->nullOnDelete();
            $table->string('invoice_number', 120);
            $table->string('supplier_invoice_number', 120)->nullable();
            $table->string('status', 40)->default('draft');
            $table->date('invoice_date')->nullable();
            $table->date('due_date')->nullable();
            $table->decimal('subtotal_amount', 15, 2)->default(0);
            $table->decimal('discount_amount', 15, 2)->default(0);
            $table->decimal('tax_amount', 15, 2)->default(0);
            $table->decimal('total_amount', 15, 2)->default(0);
            $table->decimal('paid_amount', 15, 2)->default(0);
            $table->decimal('balance_amount', 15, 2)->default(0);
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('approved_at')->nullable();
            $table->text('notes')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->unique(['tenant_id', 'invoice_number'], 'supplier_invoices_tenant_invoice_unique');
            $table->index(['tenant_id', 'status'], 'supplier_invoices_tenant_status_index');
        });

        Schema::create('pharmaco_supplier_invoice_items', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignId('pharmaco_supplier_invoice_id')->constrained('pharmaco_supplier_invoices')->cascadeOnDelete();
            $table->foreignId('pharmaco_purchase_order_item_id')->nullable()->constrained('pharmaco_purchase_order_items')->nullOnDelete();
            $table->foreignId('product_id')->nullable()->constrained('products')->nullOnDelete();
            $table->string('product_name_snapshot', 255);
            $table->string('sku_snapshot', 120)->nullable();
            $table->decimal('quantity', 15, 3)->default(0);
            $table->decimal('unit_cost', 15, 2)->default(0);
            $table->decimal('discount_amount', 15, 2)->default(0);
            $table->decimal('tax_amount', 15, 2)->default(0);
            $table->decimal('line_total', 15, 2)->default(0);
            $table->text('notes')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'pharmaco_supplier_invoice_id'], 'supplier_invoice_items_tenant_invoice_index');
        });

        Schema::create('pharmaco_supplier_payments', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignId('pharmaco_supplier_invoice_id')->constrained('pharmaco_supplier_invoices')->cascadeOnDelete();
            $table->foreignId('pharmaco_supplier_id')->constrained('pharmaco_suppliers')->cascadeOnDelete();
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

            $table->unique(['tenant_id', 'payment_number'], 'supplier_payments_tenant_number_unique');
            $table->index(['tenant_id', 'pharmaco_supplier_id'], 'supplier_payments_tenant_supplier_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pharmaco_supplier_payments');
        Schema::dropIfExists('pharmaco_supplier_invoice_items');
        Schema::dropIfExists('pharmaco_supplier_invoices');
    }
};
