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
                $table->uuid('uuid')->unique();
                $table->foreignId('tenant_id')
                    ->constrained('tenants')
                    ->cascadeOnDelete();

                $table->string('name', 191);
                $table->string('code', 100);
                $table->string('status', 30)
                    ->default('active');
                $table->text('description')->nullable();
                $table->json('metadata')->nullable();
                $table->timestamps();

                $table->unique(
                    ['tenant_id', 'code'],
                    'general_item_categories_tenant_code_unique'
                );

                $table->index(
                    ['tenant_id', 'status'],
                    'general_item_categories_tenant_status_idx'
                );
            }
        );

        Schema::create(
            'pharmaco_general_items',
            function (Blueprint $table): void {
                $table->id();
                $table->uuid('uuid')->unique();

                $table->foreignId('tenant_id')
                    ->constrained('tenants')
                    ->cascadeOnDelete();

                $table->foreignId(
                    'pharmaco_general_item_category_id'
                )
                    ->constrained(
                        'pharmaco_general_item_categories'
                    )
                    ->restrictOnDelete();

                $table->foreignId(
                    'preferred_supplier_id'
                )
                    ->nullable()
                    ->constrained('pharmaco_suppliers')
                    ->nullOnDelete();

                $table->string('name', 191);
                $table->string('code', 100);
                $table->string(
                    'unit_of_measure',
                    50
                )->default('unit');

                $table->decimal(
                    'reorder_level',
                    14,
                    3
                )->default(0);

                $table->decimal(
                    'minimum_stock_level',
                    14,
                    3
                )->default(0);

                $table->boolean('track_stock')
                    ->default(true);

                $table->string('status', 30)
                    ->default('active');

                $table->text('description')->nullable();
                $table->json('metadata')->nullable();
                $table->timestamps();

                $table->unique(
                    ['tenant_id', 'code'],
                    'general_items_tenant_code_unique'
                );

                $table->index(
                    [
                        'tenant_id',
                        'pharmaco_general_item_category_id',
                        'status',
                    ],
                    'general_items_tenant_category_status_idx'
                );
            }
        );

        Schema::create(
            'pharmaco_general_item_locations',
            function (Blueprint $table): void {
                $table->id();
                $table->uuid('uuid')->unique();

                $table->foreignId('tenant_id')
                    ->constrained('tenants')
                    ->cascadeOnDelete();

                $table->foreignId('branch_id')
                    ->constrained('branches')
                    ->cascadeOnDelete();

                $table->string('name', 191);
                $table->string('code', 100);
                $table->string(
                    'location_type',
                    50
                )->default('store');

                $table->string('status', 30)
                    ->default('active');

                $table->text('description')->nullable();
                $table->json('metadata')->nullable();
                $table->timestamps();

                $table->unique(
                    ['tenant_id', 'branch_id', 'code'],
                    'general_item_locations_branch_code_unique'
                );

                $table->index(
                    ['tenant_id', 'branch_id', 'status'],
                    'general_item_locations_tenant_branch_status_idx'
                );
            }
        );

        Schema::create(
            'pharmaco_general_item_stocks',
            function (Blueprint $table): void {
                $table->id();
                $table->uuid('uuid')->unique();

                $table->foreignId('tenant_id')
                    ->constrained('tenants')
                    ->cascadeOnDelete();

                $table->foreignId('branch_id')
                    ->constrained('branches')
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
                    ->restrictOnDelete();

                $table->decimal(
                    'quantity_on_hand',
                    14,
                    3
                )->default(0);

                $table->decimal(
                    'quantity_reserved',
                    14,
                    3
                )->default(0);

                $table->decimal(
                    'average_unit_cost',
                    14,
                    2
                )->default(0);

                $table->decimal(
                    'last_unit_cost',
                    14,
                    2
                )->default(0);

                $table->timestamp(
                    'last_received_at'
                )->nullable();

                $table->timestamp(
                    'last_issued_at'
                )->nullable();

                $table->json('metadata')->nullable();
                $table->timestamps();

                $table->unique(
                    [
                        'tenant_id',
                        'pharmaco_general_item_id',
                        'pharmaco_general_item_location_id',
                    ],
                    'general_item_stock_item_location_unique'
                );

                $table->index(
                    ['tenant_id', 'branch_id'],
                    'general_item_stocks_tenant_branch_idx'
                );
            }
        );

        Schema::create(
            'pharmaco_general_item_movements',
            function (Blueprint $table): void {
                $table->id();
                $table->uuid('uuid')->unique();

                $table->foreignId('tenant_id')
                    ->constrained('tenants')
                    ->cascadeOnDelete();

                $table->foreignId('branch_id')
                    ->constrained('branches')
                    ->cascadeOnDelete();

                $table->foreignId(
                    'pharmaco_general_item_id'
                )
                    ->constrained(
                        'pharmaco_general_items'
                    )
                    ->cascadeOnDelete();

                $table->foreignId(
                    'pharmaco_general_item_stock_id'
                )
                    ->constrained(
                        'pharmaco_general_item_stocks'
                    )
                    ->cascadeOnDelete();

                $table->foreignId(
                    'pharmaco_general_item_location_id'
                )
                    ->constrained(
                        'pharmaco_general_item_locations'
                    )
                    ->restrictOnDelete();

                $table->foreignId('performed_by')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table->string('movement_type', 50);

                $table->decimal(
                    'quantity',
                    14,
                    3
                );

                $table->decimal(
                    'unit_cost',
                    14,
                    2
                )->default(0);

                $table->decimal(
                    'total_value',
                    16,
                    2
                )->default(0);

                $table->decimal(
                    'running_balance',
                    14,
                    3
                );

                $table->string(
                    'reference_type',
                    50
                )->nullable();

                $table->string(
                    'reference_number',
                    100
                )->nullable();

                $table->text('reason')->nullable();
                $table->timestamp('occurred_at');
                $table->json('metadata')->nullable();
                $table->timestamps();

                $table->index(
                    [
                        'tenant_id',
                        'pharmaco_general_item_id',
                        'occurred_at',
                    ],
                    'general_item_movements_item_date_idx'
                );

                $table->index(
                    [
                        'tenant_id',
                        'movement_type',
                        'occurred_at',
                    ],
                    'general_item_movements_type_date_idx'
                );
            }
        );

        Schema::table(
            'pharmaco_general_purchase_order_items',
            function (Blueprint $table): void {
                $table->foreignId(
                    'pharmaco_general_item_id'
                )
                    ->nullable()
                    ->after('pharmaco_purchase_order_id')
                    ->constrained(
                        'pharmaco_general_items'
                    )
                    ->restrictOnDelete();

                $table->index(
                    [
                        'tenant_id',
                        'pharmaco_general_item_id',
                    ],
                    'general_po_items_tenant_master_item_idx'
                );
            }
        );
    }

    public function down(): void
    {
        Schema::table(
            'pharmaco_general_purchase_order_items',
            function (Blueprint $table): void {
                $table->dropForeign([
                    'pharmaco_general_item_id',
                ]);

                $table->dropIndex(
                    'general_po_items_tenant_master_item_idx'
                );

                $table->dropColumn(
                    'pharmaco_general_item_id'
                );
            }
        );

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
