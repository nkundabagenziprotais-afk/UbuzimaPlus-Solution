<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (
            Schema::hasTable(
                'pharmaco_sale_receipt_snapshots'
            )
        ) {
            return;
        }

        Schema::create(
            'pharmaco_sale_receipt_snapshots',
            function (
                Blueprint $table
            ): void {
                $table->id();

                $table
                    ->uuid('uuid')
                    ->unique();

                $table
                    ->unsignedBigInteger(
                        'tenant_id'
                    );

                $table
                    ->unsignedBigInteger(
                        'branch_id'
                    )
                    ->nullable();

                /*
                 * Exactly one canonical receipt snapshot
                 * may exist for one persisted sale.
                 */
                $table
                    ->unsignedBigInteger(
                        'pharmaco_sale_id'
                    )
                    ->unique();

                $table
                    ->string(
                        'sale_number',
                        100
                    )
                    ->nullable();

                $table
                    ->string(
                        'receipt_number',
                        100
                    )
                    ->nullable();

                $table
                    ->string(
                        'sale_reference',
                        100
                    )
                    ->nullable();

                $table
                    ->string(
                        'customer_name',
                        191
                    )
                    ->nullable();

                $table
                    ->string(
                        'customer_phone',
                        30
                    )
                    ->nullable();

                $table
                    ->string(
                        'customer_tin',
                        20
                    )
                    ->nullable();

                $table
                    ->string(
                        'insurance_name',
                        191
                    )
                    ->nullable();

                $table
                    ->unsignedBigInteger(
                        'cashier_user_id'
                    )
                    ->nullable();

                $table
                    ->unsignedBigInteger(
                        'pos_session_id'
                    )
                    ->nullable();

                $table
                    ->date(
                        'business_date'
                    )
                    ->nullable();

                $table
                    ->dateTime(
                        'sold_at'
                    )
                    ->nullable();

                $table
                    ->decimal(
                        'subtotal_amount',
                        18,
                        2
                    )
                    ->nullable();

                $table
                    ->decimal(
                        'discount_amount',
                        18,
                        2
                    )
                    ->nullable();

                $table
                    ->decimal(
                        'tax_amount',
                        18,
                        2
                    )
                    ->nullable();

                $table
                    ->decimal(
                        'total_amount',
                        18,
                        2
                    )
                    ->nullable();

                $table
                    ->decimal(
                        'paid_amount',
                        18,
                        2
                    )
                    ->nullable();

                $table
                    ->decimal(
                        'balance_amount',
                        18,
                        2
                    )
                    ->nullable();

                /*
                 * Complete immutable business document.
                 */
                $table->json(
                    'transaction_setup'
                );

                $table->json(
                    'receipt_payload'
                );

                $table
                    ->string(
                        'snapshot_version',
                        30
                    );

                $table
                    ->string(
                        'snapshot_sha256',
                        64
                    );

                $table->timestamps();

                $table->index(
                    'tenant_id',
                    'psrs_tenant_idx'
                );

                $table->index(
                    [
                        'tenant_id',
                        'branch_id',
                        'business_date',
                    ],
                    'psrs_tenant_branch_date_idx'
                );

                $table->index(
                    [
                        'tenant_id',
                        'sale_number',
                    ],
                    'psrs_tenant_sale_number_idx'
                );

                $table->index(
                    'pos_session_id',
                    'psrs_pos_session_idx'
                );
            }
        );
    }

    public function down(): void
    {
        if (
            ! Schema::hasTable(
                'pharmaco_sale_receipt_snapshots'
            )
        ) {
            return;
        }

        /*
         * Data-protection rule:
         * never permit migration rollback to delete
         * real persisted receipt documents.
         */
        if (
            DB::table(
                'pharmaco_sale_receipt_snapshots'
            )->exists()
        ) {
            throw new RuntimeException(
                'Refusing to drop receipt snapshots because '
                . 'persisted transaction documents exist.'
            );
        }

        Schema::dropIfExists(
            'pharmaco_sale_receipt_snapshots'
        );
    }
};
