<?php

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        $allInsuranceCodes = [
            'pharmaco.insurance.manage',
            'insurance.dashboard.view',
            'insurance.configuration.view',
            'insurance.configuration.manage',
            'insurance.memberships.view',
            'insurance.memberships.manage',
            'insurance.eligibility.check',
            'insurance.claims.view',
            'insurance.claims.create',
            'insurance.claims.edit',
            'insurance.claims.approve',
            'insurance.claims.adjudicate',
            'insurance.claims.payments',
            'insurance.reconciliation.view',
            'insurance.reconciliation.manage',
            'insurance.audit.view',
            'insurance.providers.view',
            'insurance.providers.manage',
            'insurance.plans.view',
            'insurance.plans.manage',
            'insurance.pricing.view',
            'insurance.pricing.create',
            'insurance.pricing.edit',
            'insurance.pricing.approve',
            'insurance.pricing.import',
            'insurance.pricing.ai_suggest',
            'insurance.analytics.view',
            'insurance.custom_fields.manage',
        ];

        $operationalViewCodes = [
            'insurance.dashboard.view',
            'insurance.configuration.view',
            'insurance.memberships.view',
            'insurance.eligibility.check',
            'insurance.claims.view',
            'insurance.reconciliation.view',
            'insurance.providers.view',
            'insurance.plans.view',
            'insurance.pricing.view',
        ];

        $auditorCodes = [
            'insurance.dashboard.view',
            'insurance.claims.view',
            'insurance.reconciliation.view',
            'insurance.audit.view',
            'insurance.analytics.view',
            'insurance.providers.view',
            'insurance.plans.view',
            'insurance.pricing.view',
        ];

        $allPermissionIds = Permission::query()
            ->whereIn('code', $allInsuranceCodes)
            ->pluck('id')
            ->all();

        $operationalViewPermissionIds = Permission::query()
            ->whereIn('code', $operationalViewCodes)
            ->pluck('id')
            ->all();

        $auditorPermissionIds = Permission::query()
            ->whereIn('code', $auditorCodes)
            ->pluck('id')
            ->all();

        Role::query()
            ->whereIn('code', [
                'ubuzima_plus_super_admin',
                'pharmaco360_solution_admin',
                'tenant_admin',
                'branch_manager',
                'vitapharma-owner',
            ])
            ->get()
            ->each(function (Role $role) use ($allPermissionIds): void {
                $role->permissions()->syncWithoutDetaching($allPermissionIds);
            });

        Role::query()
            ->whereIn('code', [
                'pharmacist',
                'cashier',
                'vitapharma-pharmacist',
                'vitapharma-cashier',
            ])
            ->get()
            ->each(function (Role $role) use ($operationalViewPermissionIds): void {
                $role->permissions()->syncWithoutDetaching($operationalViewPermissionIds);
            });

        Role::query()
            ->where('code', 'auditor')
            ->get()
            ->each(function (Role $role) use ($auditorPermissionIds): void {
                $role->permissions()->syncWithoutDetaching($auditorPermissionIds);
            });
    }

    public function down(): void
    {
        /*
         * Do not automatically remove permissions from active production roles.
         * Permission removal should be handled through role governance.
         */
    }
};
