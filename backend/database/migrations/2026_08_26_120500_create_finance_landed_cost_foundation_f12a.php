<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const RELEASE = 'F12A-R1.1';

    private const ACCOUNT_CODE = '2210';

    private const ACCOUNT_NAME = 'Landed Cost Accrual';

    private const MAPPING_KEY = 'inventory.landed_cost_accrual';

    public function up(): void
    {
        foreach ([
            'finance_landed_cost_documents',
            'finance_landed_cost_charges',
            'finance_landed_cost_allocations',
            'finance_landed_cost_actions',
        ] as $table) {
            if (Schema::hasTable($table)) {
                throw new \RuntimeException(
                    "F12A cannot continue because {$table} already exists."
                );
            }
        }

        Schema::create(
            'finance_landed_cost_documents',
            function (Blueprint $table): void {
                $table->id();

                $table->uuid('uuid')
                    ->unique();

                $table->foreignId('tenant_id')
                    ->constrained('tenants')
                    ->cascadeOnDelete();

                $table->foreignId('branch_id')
                    ->constrained('branches')
                    ->restrictOnDelete();

                $table->unsignedBigInteger(
                    'pharmaco_goods_receipt_id'
                );

                $table->string(
                    'document_number',
                    100
                );

                $table->date(
                    'business_date'
                );

                $table->string(
                    'allocation_method',
                    30
                );

                $table->string(
                    'status',
                    30
                )->default('draft');

                $table->string(
                    'currency_code',
                    3
                )->default('RWF');

                $table->decimal(
                    'exchange_rate',
                    18,
                    8
                )->default(1);

                $table->decimal(
                    'total_charge_amount',
                    18,
                    4
                )->default(0);

                $table->unsignedBigInteger(
                    'created_by'
                );

                $table->unsignedBigInteger(
                    'posted_by'
                )->nullable();

                $table->unsignedBigInteger(
                    'finance_journal_entry_id'
                )->nullable();

                $table->dateTime(
                    'finance_posted_at'
                )->nullable();

                $table->string(
                    'idempotency_key',
                    100
                );

                $table->text('notes')
                    ->nullable();

                $table->json('metadata')
                    ->nullable();

                $table->timestamps();

                $table->unique(
                    [
                        'tenant_id',
                        'document_number',
                    ],
                    'f12a_lc_document_number_uq'
                );

                $table->unique(
                    [
                        'tenant_id',
                        'idempotency_key',
                    ],
                    'f12a_lc_idempotency_uq'
                );

                $table->index(
                    [
                        'tenant_id',
                        'branch_id',
                        'status',
                    ],
                    'f12a_lc_tenant_branch_status_idx'
                );

                $table->index(
                    [
                        'tenant_id',
                        'pharmaco_goods_receipt_id',
                    ],
                    'f12a_lc_goods_receipt_idx'
                );

                $table->index(
                    [
                        'tenant_id',
                        'finance_journal_entry_id',
                    ],
                    'f12a_lc_journal_idx'
                );

                $table->foreign(
                    'pharmaco_goods_receipt_id'
                )
                    ->references('id')
                    ->on('pharmaco_goods_receipts')
                    ->restrictOnDelete();

                $table->foreign(
                    'finance_journal_entry_id'
                )
                    ->references('id')
                    ->on('finance_journal_entries')
                    ->nullOnDelete();
            }
        );

        Schema::create(
            'finance_landed_cost_charges',
            function (Blueprint $table): void {
                $table->id();

                $table->uuid('uuid')
                    ->unique();

                $table->foreignId(
                    'finance_landed_cost_document_id'
                )
                    ->constrained(
                        'finance_landed_cost_documents'
                    )
                    ->cascadeOnDelete();

                $table->foreignId('tenant_id')
                    ->constrained('tenants')
                    ->cascadeOnDelete();

                $table->foreignId('branch_id')
                    ->constrained('branches')
                    ->restrictOnDelete();

                $table->string(
                    'charge_type',
                    50
                );

                $table->string(
                    'description',
                    191
                );

                $table->decimal(
                    'amount',
                    18,
                    4
                );

                $table->unsignedBigInteger(
                    'source_supplier_id'
                )->nullable();

                $table->string(
                    'source_reference',
                    100
                )->nullable();

                $table->json('metadata')
                    ->nullable();

                $table->timestamps();

                $table->index(
                    [
                        'tenant_id',
                        'finance_landed_cost_document_id',
                    ],
                    'f12a_lc_charge_document_idx'
                );

                $table->index(
                    [
                        'tenant_id',
                        'charge_type',
                    ],
                    'f12a_lc_charge_type_idx'
                );
            }
        );

        Schema::create(
            'finance_landed_cost_allocations',
            function (Blueprint $table): void {
                $table->id();

                $table->uuid('uuid')
                    ->unique();

                $table->foreignId(
                    'finance_landed_cost_document_id'
                )
                    ->constrained(
                        'finance_landed_cost_documents'
                    )
                    ->cascadeOnDelete();

                $table->foreignId('tenant_id')
                    ->constrained('tenants')
                    ->cascadeOnDelete();

                $table->foreignId('branch_id')
                    ->constrained('branches')
                    ->restrictOnDelete();

                $table->unsignedBigInteger(
                    'pharmaco_goods_receipt_item_id'
                );

                $table->unsignedBigInteger(
                    'stock_batch_id'
                );

                $table->unsignedBigInteger(
                    'stock_movement_id'
                );

                $table->unsignedBigInteger(
                    'product_id'
                );

                $table->unsignedBigInteger(
                    'stock_location_id'
                )->nullable();

                $table->decimal(
                    'basis_value',
                    18,
                    4
                );

                $table->decimal(
                    'allocated_amount',
                    18,
                    4
                );

                $table->decimal(
                    'quantity_received',
                    18,
                    4
                );

                $table->decimal(
                    'batch_quantity_snapshot',
                    18,
                    4
                );

                $table->decimal(
                    'unit_cost_before',
                    18,
                    4
                );

                $table->decimal(
                    'unit_cost_after',
                    18,
                    4
                )->nullable();

                $table->string(
                    'status',
                    30
                )->default('planned');

                $table->unsignedBigInteger(
                    'applied_stock_movement_id'
                )->nullable();

                $table->json('metadata')
                    ->nullable();

                $table->timestamps();

                $table->unique(
                    [
                        'finance_landed_cost_document_id',
                        'pharmaco_goods_receipt_item_id',
                    ],
                    'f12a_lc_document_item_uq'
                );

                $table->index(
                    [
                        'tenant_id',
                        'stock_batch_id',
                    ],
                    'f12a_lc_batch_idx'
                );

                $table->index(
                    [
                        'tenant_id',
                        'status',
                    ],
                    'f12a_lc_allocation_status_idx'
                );
            }
        );

        Schema::create(
            'finance_landed_cost_actions',
            function (Blueprint $table): void {
                $table->id();

                $table->uuid('uuid')
                    ->unique();

                $table->foreignId(
                    'finance_landed_cost_document_id'
                )
                    ->constrained(
                        'finance_landed_cost_documents'
                    )
                    ->cascadeOnDelete();

                $table->foreignId('tenant_id')
                    ->constrained('tenants')
                    ->cascadeOnDelete();

                $table->unsignedBigInteger(
                    'actor_id'
                );

                $table->string(
                    'action',
                    50
                );

                $table->text(
                    'comment'
                )->nullable();

                $table->json('metadata')
                    ->nullable();

                $table->timestamps();

                $table->index(
                    [
                        'tenant_id',
                        'finance_landed_cost_document_id',
                    ],
                    'f12a_lc_action_document_idx'
                );

                $table->index(
                    [
                        'tenant_id',
                        'action',
                    ],
                    'f12a_lc_action_type_idx'
                );
            }
        );

        $now = now();

        foreach (
            DB::table('tenants')
                ->pluck('id')
            as $tenantId
        ) {
            $tenantId = (int) $tenantId;

            $existingCode =
                DB::table(
                    'finance_chart_of_accounts'
                )
                    ->where(
                        'tenant_id',
                        $tenantId
                    )
                    ->where(
                        'code',
                        self::ACCOUNT_CODE
                    )
                    ->exists();

            if ($existingCode) {
                throw new \RuntimeException(
                    'F12A account code 2210 already exists.'
                );
            }

            $existingMapping =
                DB::table(
                    'finance_account_mappings'
                )
                    ->where(
                        'tenant_id',
                        $tenantId
                    )
                    ->where(
                        'mapping_key',
                        self::MAPPING_KEY
                    )
                    ->exists();

            if ($existingMapping) {
                throw new \RuntimeException(
                    'F12A Landed Cost mapping already exists.'
                );
            }

            $grni =
                DB::table(
                    'finance_chart_of_accounts'
                )
                    ->where(
                        'tenant_id',
                        $tenantId
                    )
                    ->where(
                        'code',
                        '2200'
                    )
                    ->where(
                        'is_active',
                        true
                    )
                    ->first();

            if (! $grni) {
                throw new \RuntimeException(
                    'Stock Receipt Clearing account 2200 is required before F12A.'
                );
            }

            $accountId =
                DB::table(
                    'finance_chart_of_accounts'
                )
                    ->insertGetId([
                        'tenant_id' =>
                            $tenantId,

                        'parent_id' =>
                            $grni->parent_id,

                        'code' =>
                            self::ACCOUNT_CODE,

                        'name' =>
                            self::ACCOUNT_NAME,

                        'account_type' =>
                            'liability',

                        'normal_balance' =>
                            'credit',

                        'currency_code' =>
                            'RWF',

                        'is_control_account' =>
                            true,

                        'is_cash_or_bank' =>
                            false,

                        'is_active' =>
                            true,

                        'metadata' =>
                            json_encode([
                                'package' =>
                                    'F12_LANDED_COST',

                                'release' =>
                                    self::RELEASE,

                                'purpose' =>
                                    'accrued_directly_attributable_inventory_costs',
                            ]),

                        'created_at' =>
                            $now,

                        'updated_at' =>
                            $now,
                    ]);

            DB::table(
                'finance_account_mappings'
            )
                ->insert([
                    'tenant_id' =>
                        $tenantId,

                    'branch_id' =>
                        null,

                    'mapping_key' =>
                        self::MAPPING_KEY,

                    'finance_chart_of_account_id' =>
                        $accountId,

                    'source_module' =>
                        'finance',

                    'source_type' =>
                        'landed_cost_allocation',

                    'payment_method' =>
                        null,

                    'currency_code' =>
                        'RWF',

                    'is_default' =>
                        true,

                    'is_active' =>
                        true,

                    'metadata' =>
                        json_encode([
                            'package' =>
                                'F12_LANDED_COST',

                            'release' =>
                                self::RELEASE,
                        ]),

                    'created_at' =>
                        $now,

                    'updated_at' =>
                        $now,
                ]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists(
            'finance_landed_cost_actions'
        );

        Schema::dropIfExists(
            'finance_landed_cost_allocations'
        );

        Schema::dropIfExists(
            'finance_landed_cost_charges'
        );

        Schema::dropIfExists(
            'finance_landed_cost_documents'
        );

        if (
            ! Schema::hasTable(
                'finance_account_mappings'
            )
            ||
            ! Schema::hasTable(
                'finance_chart_of_accounts'
            )
        ) {
            return;
        }

        $accountIds =
            DB::table(
                'finance_chart_of_accounts'
            )
                ->where(
                    'code',
                    self::ACCOUNT_CODE
                )
                ->where(
                    'metadata',
                    'like',
                    '%F12A-R1.1%'
                )
                ->pluck('id');

        if (
            Schema::hasTable(
                'finance_journal_lines'
            )
            &&
            $accountIds->isNotEmpty()
        ) {
            $used =
                DB::table(
                    'finance_journal_lines'
                )
                    ->whereIn(
                        'chart_of_account_id',
                        $accountIds
                    )
                    ->exists();

            if ($used) {
                throw new \RuntimeException(
                    'F12A rollback refused because the Landed Cost Accrual account is already used by Finance journals.'
                );
            }
        }

        DB::table(
            'finance_account_mappings'
        )
            ->where(
                'mapping_key',
                self::MAPPING_KEY
            )
            ->where(
                'metadata',
                'like',
                '%F12A-R1.1%'
            )
            ->delete();

        DB::table(
            'finance_chart_of_accounts'
        )
            ->where(
                'code',
                self::ACCOUNT_CODE
            )
            ->where(
                'metadata',
                'like',
                '%F12A-R1.1%'
            )
            ->delete();
    }
};
