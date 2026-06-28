<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_categories', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('parent_id')->nullable()->constrained('product_categories')->nullOnDelete();
            $table->string('name');
            $table->string('code');
            $table->string('category_type')->default('medicine');
            $table->string('status')->default('active');
            $table->text('description')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->unique(['tenant_id', 'code'], 'product_categories_tenant_code_unique');
            $table->index(['tenant_id', 'status'], 'product_categories_tenant_status_index');
        });

        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_category_id')->nullable()->constrained('product_categories')->nullOnDelete();
            $table->string('name');
            $table->string('generic_name')->nullable();
            $table->string('brand_name')->nullable();
            $table->string('sku');
            $table->string('barcode')->nullable();
            $table->string('registration_number')->nullable();
            $table->string('dosage_form')->nullable();
            $table->string('strength')->nullable();
            $table->string('unit')->default('unit');
            $table->string('pack_size')->nullable();
            $table->string('route_of_administration')->nullable();
            $table->string('product_type')->default('medicine');
            $table->string('regulatory_status')->default('approved');
            $table->boolean('requires_prescription')->default(false);
            $table->boolean('is_controlled')->default(false);
            $table->decimal('reorder_level', 14, 2)->default(0);
            $table->decimal('minimum_stock_level', 14, 2)->default(0);
            $table->decimal('maximum_stock_level', 14, 2)->nullable();
            $table->string('status')->default('active');
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->unique(['tenant_id', 'sku'], 'products_tenant_sku_unique');
            $table->index(['tenant_id', 'status'], 'products_tenant_status_index');
            $table->index(['tenant_id', 'product_type'], 'products_tenant_type_index');
        });

        Schema::create('stock_locations', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('branch_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('code');
            $table->string('location_type')->default('store');
            $table->string('status')->default('active');
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->unique(['branch_id', 'code'], 'stock_locations_branch_code_unique');
            $table->index(['tenant_id', 'status'], 'stock_locations_tenant_status_index');
        });

        Schema::create('stock_batches', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('branch_id')->constrained()->cascadeOnDelete();
            $table->foreignId('stock_location_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->string('batch_number');
            $table->date('expiry_date')->nullable();
            $table->date('received_at')->nullable();
            $table->decimal('quantity_on_hand', 14, 2)->default(0);
            $table->decimal('quantity_reserved', 14, 2)->default(0);
            $table->decimal('unit_cost', 14, 2)->nullable();
            $table->decimal('selling_price', 14, 2)->nullable();
            $table->string('supplier_name')->nullable();
            $table->string('status')->default('active');
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->unique(['product_id', 'stock_location_id', 'batch_number'], 'stock_batches_product_location_batch_unique');
            $table->index(['tenant_id', 'branch_id', 'status'], 'stock_batches_tenant_branch_status_index');
            $table->index(['product_id', 'expiry_date'], 'stock_batches_product_expiry_index');
        });

        Schema::create('stock_movements', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('branch_id')->constrained()->cascadeOnDelete();
            $table->foreignId('stock_location_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->foreignId('stock_batch_id')->nullable()->constrained()->nullOnDelete();
            $table->string('movement_type');
            $table->decimal('quantity', 14, 2);
            $table->decimal('running_balance', 14, 2)->nullable();
            $table->string('reference_type')->nullable();
            $table->string('reference_number')->nullable();
            $table->text('reason')->nullable();
            $table->foreignId('performed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('occurred_at');
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'branch_id', 'movement_type'], 'stock_movements_tenant_branch_type_index');
            $table->index(['product_id', 'occurred_at'], 'stock_movements_product_occurred_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_movements');
        Schema::dropIfExists('stock_batches');
        Schema::dropIfExists('stock_locations');
        Schema::dropIfExists('products');
        Schema::dropIfExists('product_categories');
    }
};
