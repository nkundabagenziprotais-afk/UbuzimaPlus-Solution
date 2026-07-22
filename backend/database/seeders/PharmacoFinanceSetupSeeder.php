<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class PharmacoFinanceSetupSeeder extends Seeder
{
    private array $permissions = [
        'finance.dashboard.view' => 'View Finance Dashboard',
        'finance.chart_of_accounts.manage' => 'Manage Chart of Accounts',
        'finance.journal.view' => 'View Finance Journal',
        'finance.journal.create' => 'Create Finance Journal Entries',
        'finance.journal.approve' => 'Approve Finance Journal Entries',
        'finance.reports.view' => 'View Finance Reports',
        'finance.reconciliation.manage' => 'Manage Finance Reconciliation',
        'finance.period.close' => 'Close Finance Periods',
        'finance.settings.manage' => 'Manage Finance Settings',
    ];

    private array $accounts = [
        ['code' => '1000', 'name' => 'Cash on Hand', 'account_type' => 'asset', 'normal_balance' => 'debit', 'is_cash_or_bank' => true],
        ['code' => '1010', 'name' => 'Bank Account', 'account_type' => 'asset', 'normal_balance' => 'debit', 'is_cash_or_bank' => true],
        ['code' => '1020', 'name' => 'Card Clearing', 'account_type' => 'asset', 'normal_balance' => 'debit'],
        ['code' => '1030', 'name' => 'Mobile Money Clearing', 'account_type' => 'asset', 'normal_balance' => 'debit'],
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

    public function run(): void
    {
        if (
            ! Schema::hasTable('tenants')
            || ! Schema::hasTable('finance_chart_of_accounts')
            || ! Schema::hasTable('finance_account_mappings')
        ) {
            return;
        }

        $this->registerFinancePermissions();
        $this->grantFinancePermissionsToAdministrativeRoles();
        $this->seedAccountsAndMappings();
    }

    private function registerFinancePermissions(): void
    {
        if (! Schema::hasTable('permissions')) {
            return;
        }

        $now = now();

        foreach ($this->permissions as $code => $name) {
            $values = ['code' => $code];

            if (Schema::hasColumn('permissions', 'name')) {
                $values['name'] = $name;
            }

            if (Schema::hasColumn('permissions', 'permission_group')) {
                $values['permission_group'] = 'finance';
            }

            if (Schema::hasColumn('permissions', 'group')) {
                $values['group'] = 'finance';
            }

            if (Schema::hasColumn('permissions', 'description')) {
                $values['description'] = $name;
            }

            if (Schema::hasColumn('permissions', 'created_at')) {
                $values['created_at'] = $now;
            }

            if (Schema::hasColumn('permissions', 'updated_at')) {
                $values['updated_at'] = $now;
            }

            DB::table('permissions')->updateOrInsert(['code' => $code], $values);
        }
    }

    private function grantFinancePermissionsToAdministrativeRoles(): void
    {
        if (
            ! Schema::hasTable('roles')
            || ! Schema::hasTable('permissions')
            || ! Schema::hasTable('permission_role')
        ) {
            return;
        }

        $permissionIds = DB::table('permissions')
            ->whereIn('code', array_keys($this->permissions))
            ->pluck('id');

        $roleIds = DB::table('roles')
            ->whereIn('code', [
                'ubuzima_plus_super_admin',
                'pharmaco360_solution_admin',
                'tenant_admin',
            ])
            ->pluck('id');

        $pivotHasCreatedAt = Schema::hasColumn('permission_role', 'created_at');
        $pivotHasUpdatedAt = Schema::hasColumn('permission_role', 'updated_at');
        $now = now();

        foreach ($roleIds as $roleId) {
            foreach ($permissionIds as $permissionId) {
                $payload = [
                    'role_id' => $roleId,
                    'permission_id' => $permissionId,
                ];

                if ($pivotHasCreatedAt) {
                    $payload['created_at'] = $now;
                }

                if ($pivotHasUpdatedAt) {
                    $payload['updated_at'] = $now;
                }

                DB::table('permission_role')->insertOrIgnore($payload);
            }
        }
    }

    private function seedAccountsAndMappings(): void
    {
        $now = now();

        foreach (DB::table('tenants')->pluck('id') as $tenantId) {
            $accountIdsByCode = [];

            foreach ($this->accounts as $account) {
                DB::table('finance_chart_of_accounts')->updateOrInsert(
                    [
                        'tenant_id' => $tenantId,
                        'code' => $account['code'],
                    ],
                    [
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
                            'seeded_by' => 'pharmaco_finance_setup_seeder',
                            'seed_version' => '2026_07_22_233500',
                        ]),
                        'created_at' => $now,
                        'updated_at' => $now,
                    ],
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

                DB::table('finance_account_mappings')->updateOrInsert(
                    [
                        'tenant_id' => $tenantId,
                        'branch_id' => null,
                        'mapping_key' => $mappingKey,
                        'currency_code' => 'RWF',
                    ],
                    [
                        'tenant_id' => $tenantId,
                        'branch_id' => null,
                        'mapping_key' => $mappingKey,
                        'finance_chart_of_account_id' => $accountId,
                        'currency_code' => 'RWF',
                        'is_default' => true,
                        'is_active' => true,
                        'metadata' => json_encode([
                            'seeded_by' => 'pharmaco_finance_setup_seeder',
                            'seed_version' => '2026_07_22_233500',
                        ]),
                        'created_at' => $now,
                        'updated_at' => $now,
                    ],
                );
            }
        }
    }
}
