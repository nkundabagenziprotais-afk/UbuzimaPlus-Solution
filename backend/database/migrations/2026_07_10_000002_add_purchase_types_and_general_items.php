<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table(
            'pharmaco_purchase_orders',
            function (Blueprint $table): void {
                $table
                    ->string('purchase_type', 30)
                    ->default('core_products')
                    ->after('po_number');

                $table->index(
                    [
                        'tenant_id',
                        'purchase_type',
                        'status',
                    ],
                    'pharmaco_po_tenant_type_status_idx'
                );
            }
        );

        Schema::create(
            'pharmaco_general_purchase_order_items',
            function (Blueprint $table): void {
                $table->id();
                $table->uuid('uuid')->unique();

                $table
                    ->foreignId('tenant_id')
                    ->constrained()
                    ->cascadeOnDelete();

                $table
                    ->foreignId('pharmaco_purchase_order_id')
                    ->constrained('pharmaco_purchase_orders')
                    ->cascadeOnDelete();

                $table->string('item_name');
                $table->string('item_code', 100)->nullable();
                $table->string('category', 100)->nullable();

                $table
                    ->string('unit_of_measure', 50)
                    ->default('unit');

                $table->decimal(
                    'quantity_ordered',
                    15,
                    3
                );

                $table
                    ->decimal(
                        'quantity_received',
                        15,
                        3
                    )
                    ->default(0);

                $table->decimal('unit_cost', 15, 2);

                $table
                    ->decimal(
                        'discount_amount',
                        15,
                        2
                    )
                    ->default(0);

                $table
                    ->decimal(
                        'tax_amount',
                        15,
                        2
                    )
                    ->default(0);

                $table->decimal('line_total', 15, 2);

                $table
                    ->string('status', 40)
                    ->default('pending');

                $table->text('notes')->nullable();
                $table->json('metadata')->nullable();
                $table->timestamps();

                $table->index(
                    [
                        'tenant_id',
                        'pharmaco_purchase_order_id',
                    ],
                    'pharmaco_general_po_items_tenant_po_idx'
                );

                $table->index(
                    [
                        'tenant_id',
                        'item_code',
                    ],
                    'pharmaco_general_po_items_tenant_code_idx'
                );
            }
        );
    }

    public function down(): void
    {
        Schema::dropIfExists(
            'pharmaco_general_purchase_order_items'
        );

        Schema::table(
            'pharmaco_purchase_orders',
            function (Blueprint $table): void {
                $table->dropIndex(
                    'pharmaco_po_tenant_type_status_idx'
                );

                $table->dropColumn('purchase_type');
            }
        );
    }
};
