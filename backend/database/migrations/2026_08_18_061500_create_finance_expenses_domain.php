<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const PERMISSIONS = [
        'finance.expenses.view' =>
            'View Finance Expenses',

        'finance.expenses.create' =>
            'Create and Submit Finance Expenses',

        'finance.expenses.approve' =>
            'Approve Reject and Post Finance Expenses',

        'finance.expenses.reverse' =>
            'Reverse Posted Finance Expenses',
    ];

    private const ROLE_GRANTS = [
        'ubuzima_plus_super_admin' => [
            'finance.expenses.view',
            'finance.expenses.create',
            'finance.expenses.approve',
            'finance.expenses.reverse',
        ],

        'pharmaco360_solution_admin' => [
            'finance.expenses.view',
            'finance.expenses.create',
            'finance.expenses.approve',
            'finance.expenses.reverse',
        ],

        'tenant_admin' => [
            'finance.expenses.view',
            'finance.expenses.create',
            'finance.expenses.approve',
            'finance.expenses.reverse',
        ],

        'vitapharma-cashier' => [
            'finance.expenses.view',
            'finance.expenses.create',
        ],

        'vitapharma-owner' => [
            'finance.expenses.view',
            'finance.expenses.approve',
            'finance.expenses.reverse',
        ],

        'vitapharma-support-assistant' => [
            'finance.expenses.view',
        ],
    ];

    public function up(): void
    {
        foreach (
            [
                'finance_expenses',
                'finance_expense_lines',
                'finance_expense_actions',
            ]
            as $table
        ) {
            if (Schema::hasTable($table)) {
                throw new RuntimeException(
                    "Expense table already exists: {$table}"
                );
            }
        }

        Schema::create(
            'finance_expenses',
            function (Blueprint $table): void {
                $table->id();

                $table
                    ->uuid('uuid')
                    ->unique();

                $table
                    ->foreignId('tenant_id')
                    ->constrained('tenants')
                    ->cascadeOnDelete();

                $table
                    ->foreignId('branch_id')
                    ->nullable()
                    ->constrained('branches')
                    ->nullOnDelete();

                $table->string(
                    'expense_number',
                    100
                );

                $table->string(
                    'idempotency_key',
                    100
                );

                $table->string(
                    'request_fingerprint',
                    64
                );

                $table->date(
                    'business_date'
                );

                $table
                    ->foreignId('supplier_id')
                    ->nullable()
                    ->constrained(
                        'pharmaco_suppliers'
                    )
                    ->nullOnDelete();

                $table->string(
                    'payee_name',
                    191
                )->nullable();

                $table->string(
                    'payment_source',
                    30
                );

                $table->string(
                    'reference_number',
                    100
                )->nullable();

                $table->string(
                    'receipt_number',
                    100
                )->nullable();

                $table->text('purpose');

                $table->text(
                    'notes'
                )->nullable();

                $table->string(
                    'currency_code',
                    3
                )->default('RWF');

                $table->decimal(
                    'total_amount',
                    18,
                    4
                )->default(0);

                $table->string(
                    'status',
                    30
                )->default('draft');

                /*
                 * Evidence metadata.
                 * Secure private upload is enabled in R4B.
                 */
                $table->string(
                    'evidence_disk',
                    30
                )->nullable();

                $table->string(
                    'evidence_path',
                    191
                )->nullable();

                $table->string(
                    'evidence_original_name',
                    191
                )->nullable();

                $table->string(
                    'evidence_mime_type',
                    100
                )->nullable();

                $table
                    ->unsignedBigInteger(
                        'evidence_size'
                    )
                    ->nullable();

                $table
                    ->foreignId(
                        'evidence_uploaded_by'
                    )
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table
                    ->timestamp(
                        'evidence_uploaded_at'
                    )
                    ->nullable();

                $table
                    ->foreignId('prepared_by')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table
                    ->foreignId('submitted_by')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table
                    ->foreignId('approved_by')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table
                    ->foreignId('posted_by')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table
                    ->foreignId('rejected_by')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table
                    ->foreignId('reversed_by')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table
                    ->foreignId(
                        'finance_journal_draft_id'
                    )
                    ->nullable()
                    ->constrained(
                        'finance_journal_drafts'
                    )
                    ->nullOnDelete();

                $table
                    ->foreignId(
                        'posted_journal_entry_id'
                    )
                    ->nullable()
                    ->constrained(
                        'finance_journal_entries'
                    )
                    ->nullOnDelete();

                $table
                    ->foreignId(
                        'reversal_journal_entry_id'
                    )
                    ->nullable()
                    ->constrained(
                        'finance_journal_entries'
                    )
                    ->nullOnDelete();

                $table
                    ->timestamp('submitted_at')
                    ->nullable();

                $table
                    ->timestamp('approved_at')
                    ->nullable();

                $table
                    ->timestamp('posted_at')
                    ->nullable();

                $table
                    ->timestamp('rejected_at')
                    ->nullable();

                $table
                    ->timestamp('reversed_at')
                    ->nullable();

                $table->text(
                    'rejection_reason'
                )->nullable();

                $table->text(
                    'reversal_reason'
                )->nullable();

                $table
                    ->unsignedInteger('version')
                    ->default(1);

                $table->json(
                    'metadata'
                )->nullable();

                $table->timestamps();

                $table->unique(
                    [
                        'tenant_id',
                        'expense_number',
                    ],
                    'finance_expense_number_uq'
                );

                $table->unique(
                    [
                        'tenant_id',
                        'idempotency_key',
                    ],
                    'finance_expense_idempotency_uq'
                );

                $table->index(
                    [
                        'tenant_id',
                        'business_date',
                    ],
                    'finance_expense_date_idx'
                );

                $table->index(
                    [
                        'tenant_id',
                        'status',
                    ],
                    'finance_expense_status_idx'
                );

                $table->index(
                    [
                        'tenant_id',
                        'supplier_id',
                    ],
                    'finance_expense_supplier_idx'
                );

                $table->index(
                    [
                        'tenant_id',
                        'payment_source',
                    ],
                    'finance_expense_payment_idx'
                );
            }
        );

        Schema::create(
            'finance_expense_lines',
            function (Blueprint $table): void {
                $table->id();

                $table
                    ->foreignId(
                        'finance_expense_id'
                    )
                    ->constrained(
                        'finance_expenses'
                    )
                    ->cascadeOnDelete();

                $table
                    ->unsignedSmallInteger(
                        'line_number'
                    );

                $table
                    ->foreignId(
                        'finance_chart_of_account_id'
                    )
                    ->constrained(
                        'finance_chart_of_accounts'
                    )
                    ->restrictOnDelete();

                $table->string(
                    'description',
                    500
                )->nullable();

                $table->decimal(
                    'amount',
                    18,
                    4
                );

                $table->string(
                    'mapping_key',
                    100
                );

                $table->json(
                    'metadata'
                )->nullable();

                $table->timestamps();

                $table->unique(
                    [
                        'finance_expense_id',
                        'line_number',
                    ],
                    'finance_expense_line_uq'
                );

                $table->index(
                    'finance_chart_of_account_id',
                    'finance_expense_line_account_idx'
                );
            }
        );

        Schema::create(
            'finance_expense_actions',
            function (Blueprint $table): void {
                $table->id();

                $table
                    ->uuid('uuid')
                    ->unique();

                $table
                    ->foreignId(
                        'finance_expense_id'
                    )
                    ->constrained(
                        'finance_expenses'
                    )
                    ->cascadeOnDelete();

                $table
                    ->foreignId('tenant_id')
                    ->constrained('tenants')
                    ->cascadeOnDelete();

                $table
                    ->foreignId('actor_id')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table->string(
                    'action',
                    50
                );

                $table->string(
                    'previous_status',
                    30
                )->nullable();

                $table->string(
                    'new_status',
                    30
                );

                $table->text(
                    'comment'
                )->nullable();

                $table->json(
                    'metadata'
                )->nullable();

                $table
                    ->timestamp('acted_at')
                    ->useCurrent();

                $table->index(
                    [
                        'finance_expense_id',
                        'acted_at',
                    ],
                    'finance_expense_action_idx'
                );

                $table->index(
                    [
                        'tenant_id',
                        'action',
                    ],
                    'finance_expense_action_tenant_idx'
                );
            }
        );

        $this->registerPermissions();
        $this->grantPermissions();
    }

    public function down(): void
    {
        Schema::dropIfExists(
            'finance_expense_actions'
        );

        Schema::dropIfExists(
            'finance_expense_lines'
        );

        Schema::dropIfExists(
            'finance_expenses'
        );

        if (
            Schema::hasTable('permissions')
            && Schema::hasTable(
                'permission_role'
            )
        ) {
            $ids =
                DB::table('permissions')
                    ->whereIn(
                        'code',
                        array_keys(
                            self::PERMISSIONS
                        )
                    )
                    ->pluck('id');

            if ($ids->isNotEmpty()) {
                DB::table(
                    'permission_role'
                )
                    ->whereIn(
                        'permission_id',
                        $ids
                    )
                    ->delete();
            }

            DB::table('permissions')
                ->whereIn(
                    'code',
                    array_keys(
                        self::PERMISSIONS
                    )
                )
                ->delete();
        }
    }

    private function registerPermissions(): void
    {
        $columns =
            Schema::getColumnListing(
                'permissions'
            );

        $now = now();

        foreach (
            self::PERMISSIONS
            as $code => $name
        ) {
            $values = [];

            if (
                in_array(
                    'name',
                    $columns,
                    true
                )
            ) {
                $values['name'] =
                    $name;
            }

            if (
                in_array(
                    'permission_group',
                    $columns,
                    true
                )
            ) {
                $values[
                    'permission_group'
                ] = 'finance';
            }

            if (
                in_array(
                    'description',
                    $columns,
                    true
                )
            ) {
                $values[
                    'description'
                ] = $name;
            }

            if (
                in_array(
                    'status',
                    $columns,
                    true
                )
            ) {
                $values['status'] =
                    'active';
            }

            if (
                in_array(
                    'created_at',
                    $columns,
                    true
                )
            ) {
                $values['created_at'] =
                    $now;
            }

            if (
                in_array(
                    'updated_at',
                    $columns,
                    true
                )
            ) {
                $values['updated_at'] =
                    $now;
            }

            DB::table('permissions')
                ->updateOrInsert(
                    ['code' => $code],
                    $values
                );
        }
    }

    private function grantPermissions(): void
    {
        $pivotColumns =
            Schema::getColumnListing(
                'permission_role'
            );

        $now = now();

        foreach (
            self::ROLE_GRANTS
            as $roleCode => $codes
        ) {
            $roleId =
                DB::table('roles')
                    ->where(
                        'code',
                        $roleCode
                    )
                    ->value('id');

            if ($roleId === null) {
                continue;
            }

            foreach ($codes as $code) {
                $permissionId =
                    DB::table('permissions')
                        ->where(
                            'code',
                            $code
                        )
                        ->value('id');

                if ($permissionId === null) {
                    throw new RuntimeException(
                        'Unable to resolve '
                        . 'Expense permission: '
                        . $code
                    );
                }

                $payload = [
                    'role_id' =>
                        (int) $roleId,

                    'permission_id' =>
                        (int) $permissionId,
                ];

                if (
                    in_array(
                        'created_at',
                        $pivotColumns,
                        true
                    )
                ) {
                    $payload['created_at'] =
                        $now;
                }

                if (
                    in_array(
                        'updated_at',
                        $pivotColumns,
                        true
                    )
                ) {
                    $payload['updated_at'] =
                        $now;
                }

                DB::table(
                    'permission_role'
                )->insertOrIgnore(
                    $payload
                );
            }
        }
    }
};
