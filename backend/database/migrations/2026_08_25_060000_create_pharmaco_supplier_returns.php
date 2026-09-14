<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pharmaco_supplier_returns', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();

            $table->unsignedBigInteger('tenant_id');
            $table->unsignedBigInteger('branch_id');
            $table->unsignedBigInteger('pharmaco_supplier_id');

            $table->unsignedBigInteger('pharmaco_purchase_order_id');
            $table->unsignedBigInteger('pharmaco_goods_receipt_id');
            $table->unsignedBigInteger('pharmaco_supplier_invoice_id');

            $table->string('return_number', 120);
            $table->date('business_date');

            $table->string('reason_code', 80)->nullable();
            $table->text('notes')->nullable();

            $table->string('status', 40)->default('draft');

            $table->decimal('subtotal_amount', 15, 2)->default(0);
            $table->decimal('tax_amount', 15, 2)->default(0);
            $table->decimal('total_amount', 15, 2)->default(0);

            $table->string('currency_code', 3)->default('RWF');

            $table->string('idempotency_key', 180)->unique();

            $table->unsignedBigInteger('created_by')->nullable();

            $table->unsignedBigInteger('submitted_by')->nullable();
            $table->timestamp('submitted_at')->nullable();

            $table->unsignedBigInteger('approved_by')->nullable();
            $table->timestamp('approved_at')->nullable();

            $table->unsignedBigInteger('rejected_by')->nullable();
            $table->timestamp('rejected_at')->nullable();
            $table->text('rejection_reason')->nullable();

            $table->unsignedBigInteger('pharmaco_supplier_credit_note_id')->nullable();
            $table->unsignedBigInteger('finance_journal_entry_id')->nullable();

            $table->json('metadata')->nullable();

            $table->timestamps();

            $table->unique(
                ['tenant_id', 'return_number'],
                'f4_supplier_return_number_uq'
            );

            $table->index(
                ['tenant_id', 'branch_id', 'status'],
                'f4_supplier_return_scope_idx'
            );

            $table->index(
                ['pharmaco_supplier_id', 'business_date'],
                'f4_supplier_return_supplier_idx'
            );

            $table->index(
                'pharmaco_goods_receipt_id',
                'f4_supplier_return_grn_idx'
            );

            $table->index(
                'pharmaco_supplier_invoice_id',
                'f4_supplier_return_invoice_idx'
            );
        });

        Schema::create('pharmaco_supplier_return_items', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();

            $table->unsignedBigInteger('tenant_id');
            $table->unsignedBigInteger('branch_id');

            $table->unsignedBigInteger('pharmaco_supplier_return_id');

            $table->unsignedBigInteger('pharmaco_purchase_order_item_id');
            $table->unsignedBigInteger('pharmaco_goods_receipt_item_id');
            $table->unsignedBigInteger('pharmaco_supplier_invoice_item_id');

            $table->unsignedBigInteger('product_id');
            $table->unsignedBigInteger('stock_batch_id');

            $table->string('batch_number', 150);
            $table->date('expiry_date')->nullable();

            $table->decimal('quantity', 15, 4);
            $table->decimal('unit_cost', 15, 4);

            $table->decimal('tax_amount', 15, 2)->default(0);
            $table->decimal('line_total', 15, 2);

            $table->string('reason_code', 80)->nullable();

            $table->unsignedBigInteger('stock_movement_id')->nullable();

            $table->json('metadata')->nullable();

            $table->timestamps();

            $table->index(
                ['tenant_id', 'branch_id'],
                'f4_supplier_return_item_scope_idx'
            );

            $table->index(
                'pharmaco_supplier_return_id',
                'f4_supplier_return_item_return_idx'
            );

            $table->index(
                'pharmaco_goods_receipt_item_id',
                'f4_supplier_return_item_grn_idx'
            );

            $table->index(
                'stock_batch_id',
                'f4_supplier_return_item_batch_idx'
            );
        });

        Schema::create('pharmaco_supplier_return_events', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();

            $table->unsignedBigInteger('tenant_id');
            $table->unsignedBigInteger('branch_id');

            $table->unsignedBigInteger('pharmaco_supplier_return_id');

            $table->string('event_type', 80);

            $table->unsignedBigInteger('actor_id')->nullable();

            $table->json('payload')->nullable();

            $table->timestamp('occurred_at');

            $table->timestamps();

            $table->index(
                ['pharmaco_supplier_return_id', 'occurred_at'],
                'f4_supplier_return_event_idx'
            );
        });

        /*
         * Append-only lifecycle evidence.
         *
         * The application never updates or deletes Supplier Return events.
         * Database triggers additionally make the event table immutable.
         */
        $driver = DB::connection()->getDriverName();

        if ($driver === 'sqlite') {
            DB::unprepared(
                "CREATE TRIGGER f4_supplier_return_events_no_update
                 BEFORE UPDATE ON pharmaco_supplier_return_events
                 BEGIN
                    SELECT RAISE(
                        ABORT,
                        'Supplier Return lifecycle events are immutable'
                    );
                 END;"
            );

            DB::unprepared(
                "CREATE TRIGGER f4_supplier_return_events_no_delete
                 BEFORE DELETE ON pharmaco_supplier_return_events
                 BEGIN
                    SELECT RAISE(
                        ABORT,
                        'Supplier Return lifecycle events are immutable'
                    );
                 END;"
            );
        }

        if (in_array($driver, ['mysql', 'mariadb'], true)) {
            DB::unprepared(
                "CREATE TRIGGER f4_supplier_return_events_no_update
                 BEFORE UPDATE ON pharmaco_supplier_return_events
                 FOR EACH ROW
                 SIGNAL SQLSTATE '45000'
                 SET MESSAGE_TEXT =
                    'Supplier Return lifecycle events are immutable'"
            );

            DB::unprepared(
                "CREATE TRIGGER f4_supplier_return_events_no_delete
                 BEFORE DELETE ON pharmaco_supplier_return_events
                 FOR EACH ROW
                 SIGNAL SQLSTATE '45000'
                 SET MESSAGE_TEXT =
                    'Supplier Return lifecycle events are immutable'"
            );
        }
    }

    public function down(): void
    {
        $driver = DB::connection()->getDriverName();

        if ($driver === 'sqlite') {
            DB::unprepared(
                'DROP TRIGGER IF EXISTS f4_supplier_return_events_no_update'
            );

            DB::unprepared(
                'DROP TRIGGER IF EXISTS f4_supplier_return_events_no_delete'
            );
        }

        if (in_array($driver, ['mysql', 'mariadb'], true)) {
            DB::unprepared(
                'DROP TRIGGER IF EXISTS f4_supplier_return_events_no_update'
            );

            DB::unprepared(
                'DROP TRIGGER IF EXISTS f4_supplier_return_events_no_delete'
            );
        }

        Schema::dropIfExists('pharmaco_supplier_return_events');
        Schema::dropIfExists('pharmaco_supplier_return_items');
        Schema::dropIfExists('pharmaco_supplier_returns');
    }
};
