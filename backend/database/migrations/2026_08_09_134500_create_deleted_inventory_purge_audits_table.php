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
                'deleted_inventory_purge_audits'
            )
        ) {
            return;
        }

        Schema::create(
            'deleted_inventory_purge_audits',
            function (Blueprint $table): void {
                $table->id();

                $table
                    ->uuid('uuid')
                    ->unique();

                $table
                    ->unsignedBigInteger('tenant_id');

                $table
                    ->unsignedBigInteger(
                        'deleted_inventory_archive_id'
                    );

                $table
                    ->unsignedBigInteger(
                        'original_stock_batch_id'
                    )
                    ->nullable();

                $table
                    ->unsignedBigInteger('product_id')
                    ->nullable();

                $table
                    ->string(
                        'product_sku',
                        191
                    )
                    ->nullable();

                $table
                    ->string(
                        'product_name',
                        191
                    )
                    ->nullable();

                $table
                    ->string(
                        'batch_number',
                        100
                    )
                    ->nullable();

                $table
                    ->text('purge_reason');

                $table
                    ->unsignedBigInteger('purged_by')
                    ->nullable();

                $table
                    ->string(
                        'purged_by_name',
                        191
                    )
                    ->nullable();

                $table
                    ->dateTime('purged_at');

                /*
                 * Audit evidence is intentionally retained even
                 * when the recoverable recycle-bin row is removed.
                 */
                $table
                    ->longText('archive_snapshot');

                $table->timestamps();

                $table->index(
                    [
                        'tenant_id',
                        'purged_at',
                    ],
                    'dipa_tenant_purged_idx'
                );

                $table->index(
                    [
                        'tenant_id',
                        'original_stock_batch_id',
                    ],
                    'dipa_original_batch_idx'
                );
            }
        );
    }

    public function down(): void
    {
        Schema::dropIfExists(
            'deleted_inventory_purge_audits'
        );
    }
};
