<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create(
            'pharmaco_general_item_categories',
            function (Blueprint $table): void {
                $table->id();
                $table->foreignId('tenant_id')
                    ->constrained('tenants')
                    ->cascadeOnDelete();
                $table->string('code', 100);
                $table->string('name', 191);
                $table->text('description')->nullable();
                $table->string('status', 30)
                    ->default('active');
                $table->timestamps();

                $table->unique(
                    ['tenant_id', 'code'],
                    'general_item_categories_tenant_code_unique'
                );
            }
        );

        Schema::create(
            'pharmaco_general_items',
            function (Blueprint $table): void {
                $table->id();
                $table->foreignId('tenant_id')
                    ->constrained('tenants')
                    ->cascadeOnDelete();
                $table->foreignId('category_id')
                    ->nullable()
                    ->constrained(
                        'pharmaco_general_item_categories'
                    )
                    ->nullOnDelete();
                $table->string('code', 100);
                $table->string('name', 191);
                $table->text('description')->nullable();
                $table->string('unit_of_measure', 50)
                    ->default('unit');
                $table->boolean('track_stock')
                    ->default(true);
                $table->decimal(
                    'minimum_stock_level',
                    15,
                    3
                )->default(0);
                $table->decimal(
                    'reorder_quantity',
                    15,
                    3
                )->default(0);
                $table->decimal(
                    'standard_unit_cost',
                    18,
                    2
                )->default(0);
                $table->string('status', 30)
                    ->default('active');
                $table->timestamps();

                $table->unique(
                    ['tenant_id', 'code'],
                    'general_items_tenant_code_unique'
                );

                $table->index(
                    ['tenant_id', 'category_id', 'status'],
                    'general_items_tenant_category_status_index'
                );
            }
        );

        Schema::create(
            'pharmaco_general_item_locations',
            function (Blueprint $table): void {
                $table->id();
                $table->foreignId('tenant_id')
                    ->constrained('tenants')
                    ->cascadeOnDelete();
                $table->unsignedBigInteger(
                    'branch_id'
                )->nullable();
                $table->unsignedBigInteger(
                    'stock_location_id'
                )->nullable();
                $table->string('code', 100);
                $table->string('name', 191);
                $table->string('status', 30)
                    ->default('active');
                $table->timestamps();

                $table->unique(
                    ['tenant_id', 'code'],
                    'general_item_locations_tenant_code_unique'
                );
            }
        );

        Schema::create(
            'pharmaco_general_item_stocks',
            function (Blueprint $table): void {
                $table->id();
                $table->foreignId('tenant_id')
                    ->constrained('tenants')
                    ->cascadeOnDelete();
                $table->foreignId(
                    'pharmaco_general_item_id'
                )
                    ->constrained(
                        'pharmaco_general_items'
                    )
                    ->cascadeOnDelete();
                $table->foreignId(
                    'pharmaco_general_item_location_id'
                )
                    ->constrained(
                        'pharmaco_general_item_locations'
                    )
                    ->cascadeOnDelete();
                $table->decimal(
                    'quantity_on_hand',
                    15,
                    3
                )->default(0);
                $table->decimal(
                    'average_unit_cost',
                    18,
                    2
                )->default(0);
                $table->timestamp(
                    'last_received_at'
                )->nullable();
                $table->timestamp(
                    'last_issued_at'
                )->nullable();
                $table->timestamps();

                $table->unique(
                    [
                        'pharmaco_general_item_id',
                        'pharmaco_general_item_location_id',
                    ],
                    'general_item_stock_item_location_unique'
                );

                $table->index(
                    ['tenant_id', 'quantity_on_hand'],
                    'general_item_stocks_tenant_quantity_index'
                );
            }
        );

        Schema::create(
            'pharmaco_general_item_movements',
            function (Blueprint $table): void {
                $table->id();
                $table->foreignId('tenant_id')
                    ->constrained('tenants')
                    ->cascadeOnDelete();
                $table->foreignId(
                    'pharmaco_general_item_id'
                )
                    ->constrained(
                        'pharmaco_general_items'
                    )
                    ->cascadeOnDelete();
                $table->foreignId(
                    'pharmaco_general_item_location_id'
                )
                    ->constrained(
                        'pharmaco_general_item_locations'
                    )
                    ->cascadeOnDelete();
                $table->unsignedBigInteger(
                    'purchase_order_item_id'
                )->nullable();
                $table->string(
                    'movement_type',
                    50
                );
                $table->decimal(
                    'quantity',
                    15,
                    3
                );
                $table->decimal(
                    'unit_cost',
                    18,
                    2
                )->default(0);
                $table->string(
                    'reference',
                    100
                )->nullable();
                $table->string(
                    'department',
                    191
                )->nullable();
                $table->text('notes')->nullable();
                $table->unsignedBigInteger(
                    'performed_by'
                )->nullable();
                $table->timestamps();

                $table->index(
                    [
                        'tenant_id',
                        'movement_type',
                        'created_at',
                    ],
                    'general_item_movements_tenant_type_date_index'
                );
            }
        );
    }

    public function down(): void
    {
        Schema::dropIfExists(
            'pharmaco_general_item_movements'
        );

        Schema::dropIfExists(
            'pharmaco_general_item_stocks'
        );

        Schema::dropIfExists(
            'pharmaco_general_item_locations'
        );

        Schema::dropIfExists(
            'pharmaco_general_items'
        );

        Schema::dropIfExists(
            'pharmaco_general_item_categories'
        );
    }
};
