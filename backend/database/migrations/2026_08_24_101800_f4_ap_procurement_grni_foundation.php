<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        /*
         * Existing AP documents are empty at F4-R3 installation.
         *
         * Columns remain nullable where safe production deployment may
         * eventually need to accommodate historical rows. New application
         * writes will enforce branch/accounting lineage in the service layer.
         */

        Schema::table(
            'pharmaco_supplier_invoices',
            function (Blueprint $table): void {
                $table->unsignedBigInteger('branch_id')->nullable();

                $table
                    ->string('currency_code', 3)
                    ->default('RWF');

                $table
                    ->decimal('exchange_rate', 18, 8)
                    ->default(1);

                $table
                    ->string('accounting_status', 30)
                    ->default('unposted');

                $table
                    ->unsignedBigInteger('finance_journal_entry_id')
                    ->nullable();

                $table->timestamp('finance_posted_at')->nullable();

                $table
                    ->string('idempotency_key', 191)
                    ->nullable();

                $table->index(
                    ['tenant_id', 'branch_id', 'status'],
                    'f4_si_branch_status_idx'
                );

                $table->index(
                    ['finance_journal_entry_id'],
                    'f4_si_journal_idx'
                );

                $table->unique(
                    ['idempotency_key'],
                    'f4_si_idempotency_uq'
                );
            }
        );

        Schema::table(
            'pharmaco_supplier_invoice_items',
            function (Blueprint $table): void {
                $table->unsignedBigInteger('branch_id')->nullable();

                $table->index(
                    ['tenant_id', 'branch_id'],
                    'f4_sii_branch_idx'
                );
            }
        );

        Schema::table(
            'pharmaco_supplier_payments',
            function (Blueprint $table): void {
                $table->unsignedBigInteger('branch_id')->nullable();

                $table
                    ->string('currency_code', 3)
                    ->default('RWF');

                $table
                    ->decimal('exchange_rate', 18, 8)
                    ->default(1);

                $table
                    ->string('accounting_status', 30)
                    ->default('unposted');

                $table
                    ->unsignedBigInteger('finance_journal_entry_id')
                    ->nullable();

                $table->timestamp('finance_posted_at')->nullable();

                $table
                    ->string('idempotency_key', 191)
                    ->nullable();

                $table->index(
                    ['tenant_id', 'branch_id', 'status'],
                    'f4_sp_branch_status_idx'
                );

                $table->index(
                    ['finance_journal_entry_id'],
                    'f4_sp_journal_idx'
                );

                $table->unique(
                    ['idempotency_key'],
                    'f4_sp_idempotency_uq'
                );
            }
        );

        /*
         * Durable Goods Receipt / GRN.
         *
         * Existing procurement previously tracked quantity_received on PO
         * lines but did not have an authoritative receipt document.
         */
        Schema::create(
            'pharmaco_goods_receipts',
            function (Blueprint $table): void {
                $table->id();
                $table->uuid('uuid')->unique();

                $table
                    ->foreignId('tenant_id')
                    ->constrained('tenants')
                    ->cascadeOnDelete();

                $table
                    ->foreignId('branch_id')
                    ->constrained('branches')
                    ->restrictOnDelete();

                $table
                    ->foreignId('pharmaco_purchase_order_id')
                    ->constrained('pharmaco_purchase_orders')
                    ->restrictOnDelete();

                $table
                    ->foreignId('pharmaco_supplier_id')
                    ->constrained('pharmaco_suppliers')
                    ->restrictOnDelete();

                $table->unsignedBigInteger('stock_location_id')->nullable();

                $table->string('receipt_number', 100);
                $table->string('source_type', 30)->default('core_products');
                $table->string('status', 30)->default('draft');

                $table->date('receipt_date');

                $table
                    ->decimal('subtotal_amount', 18, 2)
                    ->default(0);

                $table
                    ->decimal('tax_amount', 18, 2)
                    ->default(0);

                $table
                    ->decimal('total_amount', 18, 2)
                    ->default(0);

                $table->string('currency_code', 3)->default('RWF');

                $table
                    ->decimal('exchange_rate', 18, 8)
                    ->default(1);

                $table
                    ->string('accounting_status', 30)
                    ->default('unposted');

                $table->unsignedBigInteger('received_by')->nullable();
                $table->unsignedBigInteger('approved_by')->nullable();

                $table->timestamp('approved_at')->nullable();

                $table
                    ->unsignedBigInteger('finance_journal_entry_id')
                    ->nullable();

                $table->timestamp('finance_posted_at')->nullable();

                $table->string('idempotency_key', 191)->nullable();

                $table->text('notes')->nullable();
                $table->json('metadata')->nullable();

                $table->timestamps();

                $table->unique(
                    ['tenant_id', 'receipt_number'],
                    'f4_grn_tenant_number_uq'
                );

                $table->unique(
                    ['idempotency_key'],
                    'f4_grn_idempotency_uq'
                );

                $table->index(
                    ['tenant_id', 'branch_id', 'status'],
                    'f4_grn_branch_status_idx'
                );

                $table->index(
                    ['pharmaco_purchase_order_id'],
                    'f4_grn_po_idx'
                );

                $table->index(
                    ['pharmaco_supplier_id'],
                    'f4_grn_supplier_idx'
                );

                $table->index(
                    ['finance_journal_entry_id'],
                    'f4_grn_journal_idx'
                );
            }
        );

        Schema::create(
            'pharmaco_goods_receipt_items',
            function (Blueprint $table): void {
                $table->id();
                $table->uuid('uuid')->unique();

                $table
                    ->foreignId('tenant_id')
                    ->constrained('tenants')
                    ->cascadeOnDelete();

                $table->unsignedBigInteger('branch_id');

                $table
                    ->foreignId('pharmaco_goods_receipt_id')
                    ->constrained('pharmaco_goods_receipts')
                    ->cascadeOnDelete();

                /*
                 * Either core-product PO item or general-item PO item may
                 * supply the source lineage.
                 */
                $table
                    ->unsignedBigInteger('pharmaco_purchase_order_item_id')
                    ->nullable();

                $table
                    ->unsignedBigInteger('pharmaco_general_purchase_order_item_id')
                    ->nullable();

                $table->unsignedBigInteger('product_id')->nullable();

                $table
                    ->unsignedBigInteger('pharmaco_general_item_id')
                    ->nullable();

                $table->string('description', 191)->nullable();

                $table->string('batch_number', 100)->nullable();

                $table->date('expiry_date')->nullable();

                $table
                    ->decimal('quantity_received', 18, 3);

                $table
                    ->decimal('unit_cost', 18, 2);

                $table
                    ->decimal('tax_amount', 18, 2)
                    ->default(0);

                $table
                    ->decimal('line_total', 18, 2);

                $table->unsignedBigInteger('stock_batch_id')->nullable();

                $table->unsignedBigInteger('stock_movement_id')->nullable();

                $table->string('status', 30)->default('received');

                $table->json('metadata')->nullable();

                $table->timestamps();

                $table->index(
                    ['tenant_id', 'branch_id'],
                    'f4_grni_branch_idx'
                );

                $table->index(
                    ['pharmaco_goods_receipt_id'],
                    'f4_grni_receipt_idx'
                );

                $table->index(
                    ['pharmaco_purchase_order_item_id'],
                    'f4_grni_po_item_idx'
                );

                $table->index(
                    ['pharmaco_general_purchase_order_item_id'],
                    'f4_grni_general_po_item_idx'
                );
            }
        );

        /*
         * Supplier credit note.
         *
         * This is deliberately separate from customer/sales returns.
         */
        Schema::create(
            'pharmaco_supplier_credit_notes',
            function (Blueprint $table): void {
                $table->id();
                $table->uuid('uuid')->unique();

                $table
                    ->foreignId('tenant_id')
                    ->constrained('tenants')
                    ->cascadeOnDelete();

                $table
                    ->foreignId('branch_id')
                    ->constrained('branches')
                    ->restrictOnDelete();

                $table
                    ->foreignId('pharmaco_supplier_id')
                    ->constrained('pharmaco_suppliers')
                    ->restrictOnDelete();

                $table
                    ->unsignedBigInteger('pharmaco_supplier_invoice_id')
                    ->nullable();

                $table
                    ->unsignedBigInteger('pharmaco_purchase_order_id')
                    ->nullable();

                $table->string('credit_number', 100);

                $table
                    ->string('supplier_credit_number', 100)
                    ->nullable();

                $table->string('status', 30)->default('draft');

                $table->date('credit_date');

                $table->string('reason_code', 50)->nullable();

                $table
                    ->decimal('subtotal_amount', 18, 2)
                    ->default(0);

                $table
                    ->decimal('tax_amount', 18, 2)
                    ->default(0);

                $table
                    ->decimal('total_amount', 18, 2)
                    ->default(0);

                $table
                    ->decimal('applied_amount', 18, 2)
                    ->default(0);

                $table
                    ->decimal('balance_amount', 18, 2)
                    ->default(0);

                $table->string('currency_code', 3)->default('RWF');

                $table
                    ->decimal('exchange_rate', 18, 8)
                    ->default(1);

                $table
                    ->string('accounting_status', 30)
                    ->default('unposted');

                $table->unsignedBigInteger('approved_by')->nullable();
                $table->timestamp('approved_at')->nullable();

                $table
                    ->unsignedBigInteger('finance_journal_entry_id')
                    ->nullable();

                $table->timestamp('finance_posted_at')->nullable();

                $table->string('idempotency_key', 191)->nullable();

                $table->text('notes')->nullable();
                $table->json('metadata')->nullable();

                $table->timestamps();

                $table->unique(
                    ['tenant_id', 'credit_number'],
                    'f4_credit_tenant_number_uq'
                );

                $table->unique(
                    ['idempotency_key'],
                    'f4_credit_idempotency_uq'
                );

                $table->index(
                    ['tenant_id', 'branch_id', 'status'],
                    'f4_credit_branch_status_idx'
                );

                $table->index(
                    ['pharmaco_supplier_id'],
                    'f4_credit_supplier_idx'
                );

                $table->index(
                    ['pharmaco_supplier_invoice_id'],
                    'f4_credit_invoice_idx'
                );
            }
        );

        Schema::create(
            'pharmaco_supplier_credit_note_items',
            function (Blueprint $table): void {
                $table->id();
                $table->uuid('uuid')->unique();

                $table
                    ->foreignId('tenant_id')
                    ->constrained('tenants')
                    ->cascadeOnDelete();

                $table->unsignedBigInteger('branch_id');

                $table
                    ->foreignId('pharmaco_supplier_credit_note_id')
                    ->constrained('pharmaco_supplier_credit_notes')
                    ->cascadeOnDelete();

                $table
                    ->unsignedBigInteger('pharmaco_supplier_invoice_item_id')
                    ->nullable();

                $table
                    ->unsignedBigInteger('pharmaco_goods_receipt_item_id')
                    ->nullable();

                $table->unsignedBigInteger('product_id')->nullable();

                $table->string('description', 191)->nullable();

                $table->decimal('quantity', 18, 3)->default(0);

                $table->decimal('unit_cost', 18, 2)->default(0);

                $table
                    ->decimal('tax_amount', 18, 2)
                    ->default(0);

                $table->decimal('line_total', 18, 2)->default(0);

                $table
                    ->boolean('stock_return_required')
                    ->default(false);

                $table->json('metadata')->nullable();

                $table->timestamps();

                $table->index(
                    ['pharmaco_supplier_credit_note_id'],
                    'f4_credit_item_credit_idx'
                );

                $table->index(
                    ['tenant_id', 'branch_id'],
                    'f4_credit_item_branch_idx'
                );
            }
        );

        /*
         * Supplier advances.
         */
        Schema::create(
            'pharmaco_supplier_advances',
            function (Blueprint $table): void {
                $table->id();
                $table->uuid('uuid')->unique();

                $table
                    ->foreignId('tenant_id')
                    ->constrained('tenants')
                    ->cascadeOnDelete();

                $table
                    ->foreignId('branch_id')
                    ->constrained('branches')
                    ->restrictOnDelete();

                $table
                    ->foreignId('pharmaco_supplier_id')
                    ->constrained('pharmaco_suppliers')
                    ->restrictOnDelete();

                $table->string('advance_number', 100);

                $table->string('status', 30)->default('draft');

                $table->date('advance_date');

                $table->decimal('amount', 18, 2);

                $table
                    ->decimal('applied_amount', 18, 2)
                    ->default(0);

                $table
                    ->decimal('balance_amount', 18, 2)
                    ->default(0);

                $table->string('payment_method', 30);

                $table->string('reference_number', 100)->nullable();

                $table->string('currency_code', 3)->default('RWF');

                $table
                    ->decimal('exchange_rate', 18, 8)
                    ->default(1);

                $table
                    ->string('accounting_status', 30)
                    ->default('unposted');

                $table->unsignedBigInteger('recorded_by')->nullable();
                $table->unsignedBigInteger('approved_by')->nullable();

                $table->timestamp('approved_at')->nullable();

                $table
                    ->unsignedBigInteger('finance_journal_entry_id')
                    ->nullable();

                $table->timestamp('finance_posted_at')->nullable();

                $table->string('idempotency_key', 191)->nullable();

                $table->text('notes')->nullable();
                $table->json('metadata')->nullable();

                $table->timestamps();

                $table->unique(
                    ['tenant_id', 'advance_number'],
                    'f4_advance_tenant_number_uq'
                );

                $table->unique(
                    ['idempotency_key'],
                    'f4_advance_idempotency_uq'
                );

                $table->index(
                    ['tenant_id', 'branch_id', 'status'],
                    'f4_advance_branch_status_idx'
                );

                $table->index(
                    ['pharmaco_supplier_id'],
                    'f4_advance_supplier_idx'
                );
            }
        );

        Schema::create(
            'pharmaco_supplier_advance_applications',
            function (Blueprint $table): void {
                $table->id();
                $table->uuid('uuid')->unique();

                $table
                    ->foreignId('tenant_id')
                    ->constrained('tenants')
                    ->cascadeOnDelete();

                $table->unsignedBigInteger('branch_id');

                $table
                    ->foreignId('pharmaco_supplier_advance_id')
                    ->constrained('pharmaco_supplier_advances')
                    ->restrictOnDelete();

                $table
                    ->unsignedBigInteger('pharmaco_supplier_invoice_id');

                $table->decimal('amount', 18, 2);

                $table->unsignedBigInteger('applied_by')->nullable();
                $table->timestamp('applied_at');

                $table->string('idempotency_key', 191);

                $table->json('metadata')->nullable();

                $table->timestamps();

                $table->unique(
                    ['idempotency_key'],
                    'f4_adv_app_idempotency_uq'
                );

                $table->index(
                    ['pharmaco_supplier_advance_id'],
                    'f4_adv_app_advance_idx'
                );

                $table->index(
                    ['pharmaco_supplier_invoice_id'],
                    'f4_adv_app_invoice_idx'
                );
            }
        );

        /*
         * Durable three-way match evidence.
         */
        Schema::create(
            'pharmaco_procurement_match_records',
            function (Blueprint $table): void {
                $table->id();
                $table->uuid('uuid')->unique();

                $table
                    ->foreignId('tenant_id')
                    ->constrained('tenants')
                    ->cascadeOnDelete();

                $table
                    ->foreignId('branch_id')
                    ->constrained('branches')
                    ->restrictOnDelete();

                $table
                    ->foreignId('pharmaco_purchase_order_id')
                    ->constrained('pharmaco_purchase_orders')
                    ->restrictOnDelete();

                $table
                    ->unsignedBigInteger('pharmaco_goods_receipt_id')
                    ->nullable();

                $table
                    ->unsignedBigInteger('pharmaco_supplier_invoice_id')
                    ->nullable();

                $table->string('match_number', 100);

                $table->string('status', 30)->default('pending');

                $table
                    ->decimal('ordered_amount', 18, 2)
                    ->default(0);

                $table
                    ->decimal('received_amount', 18, 2)
                    ->default(0);

                $table
                    ->decimal('invoiced_amount', 18, 2)
                    ->default(0);

                $table
                    ->decimal('variance_amount', 18, 2)
                    ->default(0);

                $table
                    ->decimal('quantity_variance', 18, 3)
                    ->default(0);

                $table
                    ->decimal('price_variance', 18, 2)
                    ->default(0);

                $table
                    ->decimal('tax_variance', 18, 2)
                    ->default(0);

                $table->unsignedBigInteger('matched_by')->nullable();
                $table->timestamp('matched_at')->nullable();

                $table->unsignedBigInteger('approved_by')->nullable();
                $table->timestamp('approved_at')->nullable();

                $table->text('exception_reason')->nullable();

                $table->json('metadata')->nullable();

                $table->timestamps();

                $table->unique(
                    ['tenant_id', 'match_number'],
                    'f4_match_tenant_number_uq'
                );

                $table->index(
                    ['tenant_id', 'branch_id', 'status'],
                    'f4_match_branch_status_idx'
                );

                $table->index(
                    ['pharmaco_purchase_order_id'],
                    'f4_match_po_idx'
                );

                $table->index(
                    ['pharmaco_goods_receipt_id'],
                    'f4_match_receipt_idx'
                );

                $table->index(
                    ['pharmaco_supplier_invoice_id'],
                    'f4_match_invoice_idx'
                );
            }
        );
    }

    public function down(): void
    {
        Schema::dropIfExists(
            'pharmaco_procurement_match_records'
        );

        Schema::dropIfExists(
            'pharmaco_supplier_advance_applications'
        );

        Schema::dropIfExists(
            'pharmaco_supplier_advances'
        );

        Schema::dropIfExists(
            'pharmaco_supplier_credit_note_items'
        );

        Schema::dropIfExists(
            'pharmaco_supplier_credit_notes'
        );

        Schema::dropIfExists(
            'pharmaco_goods_receipt_items'
        );

        Schema::dropIfExists(
            'pharmaco_goods_receipts'
        );

        Schema::table(
            'pharmaco_supplier_payments',
            function (Blueprint $table): void {
                $table->dropIndex('f4_sp_branch_status_idx');
                $table->dropIndex('f4_sp_journal_idx');
                $table->dropUnique('f4_sp_idempotency_uq');

                $table->dropColumn([
                    'branch_id',
                    'currency_code',
                    'exchange_rate',
                    'accounting_status',
                    'finance_journal_entry_id',
                    'finance_posted_at',
                    'idempotency_key',
                ]);
            }
        );

        Schema::table(
            'pharmaco_supplier_invoice_items',
            function (Blueprint $table): void {
                $table->dropIndex('f4_sii_branch_idx');

                $table->dropColumn([
                    'branch_id',
                ]);
            }
        );

        Schema::table(
            'pharmaco_supplier_invoices',
            function (Blueprint $table): void {
                $table->dropIndex('f4_si_branch_status_idx');
                $table->dropIndex('f4_si_journal_idx');
                $table->dropUnique('f4_si_idempotency_uq');

                $table->dropColumn([
                    'branch_id',
                    'currency_code',
                    'exchange_rate',
                    'accounting_status',
                    'finance_journal_entry_id',
                    'finance_posted_at',
                    'idempotency_key',
                ]);
            }
        );
    }
};
