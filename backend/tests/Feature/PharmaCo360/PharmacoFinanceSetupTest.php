<?php

namespace Tests\Feature\PharmaCo360;

use App\Models\FinanceAccountMapping;
use App\Models\FinanceChartOfAccount;
use App\Models\Permission;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class PharmacoFinanceSetupTest extends TestCase
{
    use RefreshDatabase;

    public function test_finance_module_permissions_accounts_and_mappings_are_available_after_setup(): void
    {
        $this->seed();

        $tenantId = DB::table('tenants')
            ->where('slug', 'vitapharma')
            ->value('id');

        $this->assertNotNull($tenantId);

        $this->assertDatabaseHas('modules', [
            'code' => 'pharmaco.finance',
        ]);

        foreach ($this->expectedPermissions() as $permission) {
            $this->assertDatabaseHas('permissions', [
                'code' => $permission,
            ]);
        }

        foreach (['1000', '1100', '1200', '2000', '2100', '4000', '5000'] as $accountCode) {
            $this->assertDatabaseHas('finance_chart_of_accounts', [
                'tenant_id' => $tenantId,
                'code' => $accountCode,
                'is_active' => true,
            ]);
        }

        foreach (['pos.cash', 'sales.revenue', 'sales.tax', 'inventory.asset', 'inventory.cogs', 'supplier.ap'] as $mappingKey) {
            $this->assertDatabaseHas('finance_account_mappings', [
                'tenant_id' => $tenantId,
                'mapping_key' => $mappingKey,
                'currency_code' => 'RWF',
                'is_active' => true,
            ]);
        }

        $tenantAdminRoleId = DB::table('roles')
            ->where('code', 'tenant_admin')
            ->value('id');

        $dashboardPermissionId = Permission::query()
            ->where('code', 'finance.dashboard.view')
            ->value('id');

        $this->assertNotNull($tenantAdminRoleId);
        $this->assertNotNull($dashboardPermissionId);

        $this->assertDatabaseHas('role_permissions', [
            'role_id' => $tenantAdminRoleId,
            'permission_id' => $dashboardPermissionId,
        ]);

        $this->assertGreaterThanOrEqual(
            16,
            FinanceChartOfAccount::query()->where('tenant_id', $tenantId)->count()
        );

        $this->assertGreaterThanOrEqual(
            17,
            FinanceAccountMapping::query()->where('tenant_id', $tenantId)->count()
        );
    }

    public function test_trial_balance_command_reports_balanced_empty_ledger(): void
    {
        $this->artisan('finance:trial-balance-check')
            ->expectsOutput('Finance Trial Balance Check')
            ->expectsOutput('Trial balance is balanced.')
            ->assertExitCode(0);
    }

    private function expectedPermissions(): array
    {
        return [
            'finance.dashboard.view',
            'finance.chart_of_accounts.manage',
            'finance.journal.view',
            'finance.journal.create',
            'finance.journal.approve',
            'finance.reports.view',
            'finance.reconciliation.manage',
            'finance.period.close',
            'finance.settings.manage',
        ];
    }
}
