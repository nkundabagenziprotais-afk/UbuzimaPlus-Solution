<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (
            DB::connection()
                ->getDriverName()
            !== 'sqlite'
        ) {
            throw new RuntimeException(
                'AQUILA Sales Authority R1.1 is TEST SQLite only.'
            );
        }

        if (
            ! Schema::hasTable(
                'pharmaco_sales'
            )
        ) {
            throw new RuntimeException(
                'pharmaco_sales is unavailable.'
            );
        }

        $missing = [];

        foreach (
            [
                'receipt_number',
                'customer_name',
                'customer_phone',
                'customer_tin',
                'insurance_name',
                'transaction_setup',
                'receipt_payload',
                'receipt_authority',
                'receipt_version',
                'receipt_sha256',
                'receipt_locked',
                'receipt_finalized_at',
            ]
            as $column
        ) {
            $missing[$column] =
                ! Schema::hasColumn(
                    'pharmaco_sales',
                    $column
                );
        }

        Schema::table(
            'pharmaco_sales',
            function (
                Blueprint $table
            ) use (
                $missing
            ): void {

                if (
                    $missing[
                        'receipt_number'
                    ]
                ) {
                    $table
                        ->string(
                            'receipt_number',
                            100
                        )
                        ->nullable();
                }

                if (
                    $missing[
                        'customer_name'
                    ]
                ) {
                    $table
                        ->string(
                            'customer_name',
                            191
                        )
                        ->nullable();
                }

                if (
                    $missing[
                        'customer_phone'
                    ]
                ) {
                    $table
                        ->string(
                            'customer_phone',
                            100
                        )
                        ->nullable();
                }

                if (
                    $missing[
                        'customer_tin'
                    ]
                ) {
                    $table
                        ->string(
                            'customer_tin',
                            30
                        )
                        ->nullable();
                }

                if (
                    $missing[
                        'insurance_name'
                    ]
                ) {
                    $table
                        ->string(
                            'insurance_name',
                            191
                        )
                        ->nullable();
                }

                if (
                    $missing[
                        'transaction_setup'
                    ]
                ) {
                    $table
                        ->text(
                            'transaction_setup'
                        )
                        ->nullable();
                }

                if (
                    $missing[
                        'receipt_payload'
                    ]
                ) {
                    $table
                        ->text(
                            'receipt_payload'
                        )
                        ->nullable();
                }

                if (
                    $missing[
                        'receipt_authority'
                    ]
                ) {
                    $table
                        ->string(
                            'receipt_authority',
                            30
                        )
                        ->nullable();
                }

                if (
                    $missing[
                        'receipt_version'
                    ]
                ) {
                    $table
                        ->string(
                            'receipt_version',
                            30
                        )
                        ->nullable();
                }

                if (
                    $missing[
                        'receipt_sha256'
                    ]
                ) {
                    $table
                        ->string(
                            'receipt_sha256',
                            64
                        )
                        ->nullable();
                }

                if (
                    $missing[
                        'receipt_locked'
                    ]
                ) {
                    $table
                        ->boolean(
                            'receipt_locked'
                        )
                        ->default(false);
                }

                if (
                    $missing[
                        'receipt_finalized_at'
                    ]
                ) {
                    $table
                        ->dateTime(
                            'receipt_finalized_at'
                        )
                        ->nullable();
                }
            }
        );


        DB::statement(
            <<<'SQL'
CREATE INDEX IF NOT EXISTS pharmaco_sales_tenant_receipt_idx
ON pharmaco_sales (tenant_id, receipt_number)
SQL
        );


        if (
            ! Schema::hasTable(
                'pharmaco_sale_receipt_snapshots'
            )
        ) {
            throw new RuntimeException(
                'R101 compatibility table is unavailable.'
            );
        }


        DB::statement(
            'DROP TRIGGER IF EXISTS '
            . 'aquila_sales_receipt_capture_r1'
        );


        /*
         * Existing R101 writes the completed immutable receipt before
         * Atomic checkout commits.
         *
         * This trigger copies that same payload into pharmaco_sales
         * in the same SQLite transaction.
         *
         * Print/Reprint authority becomes pharmaco_sales.
         */
        DB::statement(
            <<<'SQL'
CREATE TRIGGER aquila_sales_receipt_capture_r1
AFTER INSERT ON pharmaco_sale_receipt_snapshots
FOR EACH ROW
WHEN (
    SELECT receipt_payload
    FROM pharmaco_sales
    WHERE id = NEW.pharmaco_sale_id
) IS NULL
BEGIN
    UPDATE pharmaco_sales
    SET
        receipt_number =
            NEW.receipt_number,

        customer_name =
            NEW.customer_name,

        customer_phone =
            NEW.customer_phone,

        customer_tin =
            NEW.customer_tin,

        insurance_name =
            NEW.insurance_name,

        transaction_setup =
            NEW.transaction_setup,

        receipt_payload =
            NEW.receipt_payload,

        receipt_authority =
            'pharmaco_sales',

        receipt_version =
            NEW.snapshot_version,

        receipt_sha256 =
            NEW.snapshot_sha256,

        receipt_locked =
            1,

        receipt_finalized_at =
            COALESCE(
                NEW.created_at,
                CURRENT_TIMESTAMP
            )

    WHERE
        id = NEW.pharmaco_sale_id
        AND receipt_payload IS NULL;
END
SQL
        );


        DB::statement(
            'DROP TRIGGER IF EXISTS '
            . 'aquila_sales_receipt_immutable_r1'
        );


        DB::statement(
            <<<'SQL'
CREATE TRIGGER aquila_sales_receipt_immutable_r1
BEFORE UPDATE OF
    receipt_number,
    customer_name,
    customer_phone,
    customer_tin,
    insurance_name,
    transaction_setup,
    receipt_payload,
    receipt_authority,
    receipt_version,
    receipt_sha256,
    receipt_locked,
    receipt_finalized_at
ON pharmaco_sales
FOR EACH ROW
WHEN
    OLD.receipt_locked = 1
    AND (
        NEW.receipt_number IS NOT OLD.receipt_number
        OR NEW.customer_name IS NOT OLD.customer_name
        OR NEW.customer_phone IS NOT OLD.customer_phone
        OR NEW.customer_tin IS NOT OLD.customer_tin
        OR NEW.insurance_name IS NOT OLD.insurance_name
        OR NEW.transaction_setup IS NOT OLD.transaction_setup
        OR NEW.receipt_payload IS NOT OLD.receipt_payload
        OR NEW.receipt_authority IS NOT OLD.receipt_authority
        OR NEW.receipt_version IS NOT OLD.receipt_version
        OR NEW.receipt_sha256 IS NOT OLD.receipt_sha256
        OR NEW.receipt_locked IS NOT OLD.receipt_locked
        OR NEW.receipt_finalized_at IS NOT OLD.receipt_finalized_at
    )
BEGIN
    SELECT RAISE(
        ABORT,
        'Completed sale receipt authority is immutable'
    );
END
SQL
        );
    }


    public function down(): void
    {
        /*
         * Intentionally non-destructive.
         *
         * Real completed transaction receipt data must never be
         * deleted by code rollback.
         */
    }
};
