<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pharmaco_suppliers', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('supplier_code', 80);
            $table->string('name');
            $table->string('legal_name')->nullable();
            $table->string('supplier_type', 80)->default('wholesaler');
            $table->string('contact_person')->nullable();
            $table->string('phone', 80)->nullable();
            $table->string('email')->nullable();
            $table->string('tax_identification_number', 120)->nullable();
            $table->string('license_number', 120)->nullable();
            $table->text('address')->nullable();
            $table->string('payment_terms', 120)->nullable();
            $table->string('status', 40)->default('active');
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->unique(['tenant_id', 'supplier_code'], 'pharmaco_suppliers_tenant_code_unique');
            $table->index(['tenant_id', 'supplier_type', 'status'], 'pharmaco_suppliers_tenant_type_status_idx');
        });

        Schema::create('pharmaco_purchase_orders', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('branch_id')->constrained()->cascadeOnDelete();
            $table->foreignId('pharmaco_supplier_id')->constrained('pharmaco_suppliers')->cascadeOnDelete();
            $table->string('po_number', 120);
            $table->string('status', 40)->default('draft');
            $table->date('order_date')->nullable();
            $table->date('expected_delivery_date')->nullable();
            $table->decimal('subtotal_amount', 15, 2)->default(0);
            $table->decimal('discount_amount', 15, 2)->default(0);
            $table->decimal('tax_amount', 15, 2)->default(0);
            $table->decimal('shipping_amount', 15, 2)->default(0);
            $table->decimal('total_amount', 15, 2)->default(0);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('approved_at')->nullable();
            $table->text('notes')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->unique(['tenant_id', 'po_number'], 'pharmaco_purchase_orders_tenant_po_unique');
            $table->index(['tenant_id', 'branch_id', 'status'], 'pharmaco_purchase_orders_tenant_branch_status_idx');
            $table->index(['tenant_id', 'pharmaco_supplier_id'], 'pharmaco_purchase_orders_tenant_supplier_idx');
        });

        Schema::create('pharmaco_purchase_order_items', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('pharmaco_purchase_order_id')->constrained('pharmaco_purchase_orders')->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->string('product_name_snapshot');
            $table->string('sku_snapshot', 120)->nullable();
            $table->decimal('quantity_ordered', 15, 3);
            $table->decimal('quantity_received', 15, 3)->default(0);
            $table->decimal('unit_cost', 15, 2);
            $table->decimal('discount_amount', 15, 2)->default(0);
            $table->decimal('tax_amount', 15, 2)->default(0);
            $table->decimal('line_total', 15, 2);
            $table->string('status', 40)->default('pending');
            $table->text('notes')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'pharmaco_purchase_order_id'], 'pharmaco_po_items_tenant_po_idx');
            $table->index(['tenant_id', 'product_id'], 'pharmaco_po_items_tenant_product_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pharmaco_purchase_order_items');
        Schema::dropIfExists('pharmaco_purchase_orders');
        Schema::dropIfExists('pharmaco_suppliers');
    }
};
