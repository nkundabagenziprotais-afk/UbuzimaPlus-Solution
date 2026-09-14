<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (
            Schema::hasTable(
                'deleted_inventory_batches'
            )
        ) {
            return;
        }

        Schema::create(
            'deleted_inventory_batches',
            function (Blueprint $table): void {
                $table->id();

                $table
                    ->uuid('uuid')
                    ->unique();

                $table->unsignedBigInteger('tenant_id');

                $table
                    ->unsignedBigInteger('branch_id')
                    ->nullable();

                $table
                    ->unsignedBigInteger(
                        'original_stock_batch_id'
                    );

                $table
                    ->unsignedBigInteger(
                        'restored_stock_batch_id'
                    )
                    ->nullable();

                $table
                    ->unsignedBigInteger('product_id')
                    ->nullable();

                $table
                    ->string('product_sku', 191)
                    ->nullable();

                $table
                    ->string('product_name', 191)
                    ->nullable();

                $table
                    ->string(
                        'product_generic_name',
                        191
                    )
                    ->nullable();

                $table
                    ->string('batch_number', 100)
                    ->nullable();

                $table
                    ->decimal(
                        'quantity_on_hand',
                        18,
                        3
                    )
                    ->default(0);

                $table
                    ->decimal(
                        'quantity_reserved',
                        18,
                        3
                    )
                    ->default(0);

                $table
                    ->decimal(
                        'available_quantity',
                        18,
                        3
                    )
                    ->default(0);

                $table
                    ->decimal(
                        'unit_cost',
                        18,
                        4
                    )
                    ->nullable();

                $table
                    ->decimal(
                        'selling_price',
                        18,
                        4
                    )
                    ->nullable();

                $table
                    ->decimal(
                        'margin_per_unit',
                        18,
                        4
                    )
                    ->nullable();

                $table
                    ->string(
                        'supplier_name',
                        191
                    )
                    ->nullable();

                $table
                    ->unsignedBigInteger(
                        'stock_location_id'
                    )
                    ->nullable();

                $table
                    ->string(
                        'stock_location_name',
                        191
                    )
                    ->nullable();

                $table
                    ->date('expiry_date')
                    ->nullable();

                $table
                    ->string(
                        'reference_number',
                        191
                    )
                    ->nullable();

                $table
                    ->string(
                        'receive_source',
                        100
                    )
                    ->nullable();

                $table
                    ->string(
                        'original_status',
                        30
                    )
                    ->nullable();

                $table->longText('batch_snapshot');

                $table
                    ->longText('movement_snapshot')
                    ->nullable();

                $table
                    ->longText('evidence_snapshot')
                    ->nullable();

                $table
                    ->unsignedBigInteger('deleted_by')
                    ->nullable();

                $table
                    ->string(
                        'deleted_by_name',
                        191
                    )
                    ->nullable();

                $table
                    ->dateTime('deleted_at')
                    ->nullable();

                $table
                    ->text('deletion_reason')
                    ->nullable();

                $table
                    ->string(
                        'archive_source',
                        50
                    )
                    ->default('live_delete');

                $table
                    ->string(
                        'evidence_reference',
                        191
                    )
                    ->nullable();

                $table
                    ->string(
                        'evidence_confidence',
                        30
                    )
                    ->default('exact');

                $table
                    ->string(
                        'restore_status',
                        30
                    )
                    ->default('archived');

                $table
                    ->unsignedBigInteger('restored_by')
                    ->nullable();

                $table
                    ->string(
                        'restored_by_name',
                        191
                    )
                    ->nullable();

                $table
                    ->dateTime('restored_at')
                    ->nullable();

                $table
                    ->text('restore_reason')
                    ->nullable();

                $table
                    ->longText('restore_metadata')
                    ->nullable();

                $table
                    ->dateTime(
                        'original_batch_created_at'
                    )
                    ->nullable();

                $table
                    ->dateTime(
                        'original_batch_updated_at'
                    )
                    ->nullable();

                $table->timestamps();

                $table->index(
                    [
                        'tenant_id',
                        'restore_status',
                        'deleted_at',
                    ],
                    'dib_tenant_status_deleted_idx'
                );

                $table->index(
                    [
                        'tenant_id',
                        'product_id',
                    ],
                    'dib_tenant_product_idx'
                );

                $table->index(
                    [
                        'tenant_id',
                        'product_sku',
                    ],
                    'dib_tenant_sku_idx'
                );

                $table->index(
                    [
                        'tenant_id',
                        'original_stock_batch_id',
                    ],
                    'dib_original_batch_idx'
                );
            }
        );
    }

    public function down(): void
    {
        Schema::dropIfExists(
            'deleted_inventory_batches'
        );
    }
};
