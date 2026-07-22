<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private array $accounts = [
        ['code' => '1000', 'name' => 'Cash on Hand', 'account_type' => 'asset', 'normal_balance' => 'debit', 'is_cash_or_bank' => true],
        ['code' => '1010', 'name' => 'Bank Account', 'account_type' => 'asset', 'normal_balance' => 'debit', 'is_cash_or_bank' => true],
        ['code' => '1020', 'name' => 'Card Clearing', 'account_type' => 'asset', 'normal_balance' => 'debit', 'is_cash_or_bank' => false],
        ['code' => '1030', 'name' => 'Mobile Money Clearing', 'account_type' => 'asset', 'normal_balance' => 'debit', 'is_cash_or_bank' => false],
        ['code' => '1100', 'name' => 'Accounts Receivable', 'account_type' => 'asset', 'normal_balance' => 'debit', 'is_control_account' => true],
        ['code' => '1110', 'name' => 'Insurance Receivable', 'account_type' => 'asset', 'normal_balance' => 'debit', 'is_control_account' => true],
        ['code' => '1200', 'name' => 'Inventory Asset', 'account_type' => 'asset', 'normal_balance' => 'debit', 'is_control_account' => true],
        ['code' => '2000', 'name' => 'Accounts Payable', 'account_type' => 'liability', 'normal_balance' => 'credit', 'is_control_account' => true],
        ['code' => '2100', 'name' => 'VAT/GST Payable', 'account_type' => 'liability', 'normal_balance' => 'credit', 'is_control_account' => true],
        ['code' => '2200', 'name' => 'Stock Receipt Clearing', 'account_type' => 'liability', 'normal_balance' => 'credit', 'is_control_account' => true],
        ['code' => '4000', 'name' => 'Sales Revenue', 'account_type' => 'income', 'normal_balance' => 'credit'],
        ['code' => '4010', 'name' => 'Sales Returns and Allowances', 'account_type' => 'income', 'normal_balance' => 'debit'],
        ['code' => '5000', 'name' => 'Cost of Goods Sold', 'account_type' => 'expense', 'normal_balance' => 'debit'],
        ['code' => '6000', 'name' => 'Operating Expenses', 'account_type' => 'expense', 'normal_balance' => 'debit'],
        ['code' => '6100', 'name' => 'Supplier Expense Clearing', 'account_type' => 'expense', 'normal_balance' => 'debit'],
        ['code' => '7000', 'name' => 'Insurance Write-Offs', 'account_type' => 'expense', 'normal_balance' => 'debit'],
    ];

    private array $mappings = [
        'pos.cash' => '1000',
        'pos.bank' => '1010',
        'pos.card' => '1020',
        'pos.momo' => '1030',
        'pos.credit' => '1100',
        'pos.insurance' => '1110',
        'sales.revenue' => '4000',
        'sales.returns' => '4010',
        'sales.tax' => '2100',
        'inventory.asset' => '1200',
        'inventory.receipt_clearing' => '2200',
        'inventory.cogs' => '5000',
        'supplier.ap' => '2000',
        'supplier.expense' => '6100',
        'expenses.operating' => '6000',
        'insurance.receivable' => '1110',
        'insurance.writeoff' => '7000',
    ];

    public function up(): void
    {
        if (
            ! Schema::hasTable('tenants')
            || ! Schema::hasTable('finance_chart_of_accounts')
            || ! Schema::hasTable('finance_account_mappings')
        ) {
            return;
        }

        $now = now();
        $tenantIds = DB::table('tenants')->pluck('id');

        foreach ($tenantIds as $tenantId) {
            $accountIdsByCode = [];

            foreach ($this->accounts as $account) {
                $values = [
                    'tenant_id' => $tenantId,
                    'code' => $account['code'],
                    'name' => $account['name'],
                    'account_type' => $account['account_type'],
                    'normal_balance' => $account['normal_balance'],
                    'currency_code' => 'RWF',
                    'is_control_account' => (bool) ($account['is_control_account'] ?? false),
                    'is_cash_or_bank' => (bool) ($account['is_cash_or_bank'] ?? false),
                    'is_active' => true,
                    'metadata' => json_encode([
                        'seeded_by' => 'pharmaco_finance_default_setup',
                        'seed_version' => '2026_07_22_233500',
                    ]),
                    'updated_at' => $now,
                ];

                if (Schema::hasColumn('finance_chart_of_accounts', 'created_at')) {
                    $values['created_at'] = $now;
                }

                DB::table('finance_chart_of_accounts')->updateOrInsert(
                    [
                        'tenant_id' => $tenantId,
                        'code' => $account['code'],
                    ],
                    $values,
                );

                $accountIdsByCode[$account['code']] = DB::table('finance_chart_of_accounts')
                    ->where('tenant_id', $tenantId)
                    ->where('code', $account['code'])
                    ->value('id');
            }

            foreach ($this->mappings as $mappingKey => $accountCode) {
                $accountId = $accountIdsByCode[$accountCode] ?? null;

                if (! $accountId) {
                    continue;
                }

                $existingMappingId = DB::table('finance_account_mappings')
                    ->where('tenant_id', $tenantId)
                    ->whereNull('branch_id')
                    ->where('mapping_key', $mappingKey)
                    ->where('currency_code', 'RWF')
                    ->value('id');

                $values = [
                    'tenant_id' => $tenantId,
                    'branch_id' => null,
                    'mapping_key' => $mappingKey,
                    'finance_chart_of_account_id' => $accountId,
                    'currency_code' => 'RWF',
                    'is_default' => true,
                    'is_active' => true,
                    'metadata' => json_encode([
                        'seeded_by' => 'pharmaco_finance_default_setup',
                        'seed_version' => '2026_07_22_233500',
                    ]),
                    'updated_at' => $now,
                ];

                if (Schema::hasColumn('finance_account_mappings', 'created_at')) {
                    $values['created_at'] = $now;
                }

                if ($existingMappingId) {
                    DB::table('finance_account_mappings')
                        ->where('id', $existingMappingId)
                        ->update($values);
                } else {
                    DB::table('finance_account_mappings')->insert($values);
                }
            }
        }
    }

    public function down(): void
    {
        /*
         * Do not delete seeded accounts/mappings automatically in production.
         * Tenants may customize them after deployment.
         */
    }
};
