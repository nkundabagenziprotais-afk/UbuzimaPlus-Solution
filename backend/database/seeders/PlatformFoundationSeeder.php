<?php

namespace Database\Seeders;

use App\Models\AiAgent;
use App\Models\AiProvider;
use App\Models\Branch;
use App\Models\Module;
use App\Models\Solution;
use App\Models\Tenant;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class PlatformFoundationSeeder extends Seeder
{
    public function run(): void
    {
        $pharma = Solution::query()->updateOrCreate(
            ['code' => 'pharmaco360'],
            [
                'name' => 'PharmaCo360',
                'description' => 'Pharmacy ecosystem management solution for retail, wholesale, inventory, POS, suppliers, reporting and AI insights.',
                'status' => 'active',
            ]
        );

        Solution::query()->updateOrCreate(
            ['code' => 'clinicco360'],
            [
                'name' => 'ClinicCo360',
                'description' => 'Future clinic operations and care coordination solution.',
                'status' => 'planned',
            ]
        );

        Solution::query()->updateOrCreate(
            ['code' => 'vetco360'],
            [
                'name' => 'VetCo360',
                'description' => 'Future veterinary health and supply chain solution.',
                'status' => 'planned',
            ]
        );

        $modules = [
            ['code' => 'platform.public_website', 'name' => 'Public Website', 'group' => 'platform', 'scope' => 'shared'],
            ['code' => 'platform.auth', 'name' => 'Authentication', 'group' => 'platform', 'scope' => 'shared'],
            ['code' => 'platform.admin_scopes', 'name' => 'Admin Scopes', 'group' => 'security', 'scope' => 'shared'],
            ['code' => 'platform.tenancy', 'name' => 'Tenancy', 'group' => 'platform', 'scope' => 'shared'],
            ['code' => 'platform.rbac', 'name' => 'Roles and Permissions', 'group' => 'security', 'scope' => 'shared'],
            ['code' => 'platform.audit', 'name' => 'Audit Logs', 'group' => 'security', 'scope' => 'shared'],
            ['code' => 'platform.ai_center', 'name' => 'Ubuzima AI Center', 'group' => 'ai', 'scope' => 'shared'],
            ['code' => 'pharmaco.profile', 'name' => 'Pharmacy Profile', 'group' => 'pharmaco', 'scope' => 'pharmaco360'],
            ['code' => 'pharmaco.branches', 'name' => 'Branch Management', 'group' => 'pharmaco', 'scope' => 'pharmaco360'],
            ['code' => 'pharmaco.products', 'name' => 'Product Master', 'group' => 'pharmaco', 'scope' => 'pharmaco360'],
            ['code' => 'pharmaco.inventory', 'name' => 'Inventory', 'group' => 'pharmaco', 'scope' => 'pharmaco360'],
            ['code' => 'pharmaco.pos', 'name' => 'POS and Sales', 'group' => 'pharmaco', 'scope' => 'pharmaco360'],
            ['code' => 'pharmaco.suppliers', 'name' => 'Supplier Management', 'group' => 'pharmaco', 'scope' => 'pharmaco360'],
            ['code' => 'pharmaco.reports', 'name' => 'Reports', 'group' => 'analytics', 'scope' => 'pharmaco360'],
            ['code' => 'pharmaco.wholesale', 'name' => 'Wholesale Ecosystem', 'group' => 'pharmaco', 'scope' => 'pharmaco360'],
            ['code' => 'pharmaco.customers', 'name' => 'Customer Engagement', 'group' => 'pharmaco', 'scope' => 'pharmaco360'],
            ['code' => 'pharmaco.delivery', 'name' => 'Delivery and Dispatch', 'group' => 'logistics', 'scope' => 'pharmaco360'],
            ['code' => 'pharmaco.insurance', 'name' => 'Insurance Claims', 'group' => 'partners', 'scope' => 'pharmaco360'],
            ['code' => 'pharmaco.clinic_integration', 'name' => 'Clinic Integration', 'group' => 'partners', 'scope' => 'pharmaco360'],
        ];

        foreach ($modules as $item) {
            $module = Module::query()->updateOrCreate(
                ['code' => $item['code']],
                [
                    'name' => $item['name'],
                    'module_group' => $item['group'],
                    'solution_scope' => $item['scope'],
                    'status' => $item['code'] === 'platform.ai_center' ? 'controlled' : 'available',
                ]
            );

            DB::table('solution_modules')->updateOrInsert(
                ['solution_id' => $pharma->id, 'module_id' => $module->id],
                [
                    'status' => in_array($item['code'], ['pharmaco.insurance', 'pharmaco.clinic_integration'], true) ? 'planned' : 'available',
                    'updated_at' => now(),
                    'created_at' => now(),
                ]
            );
        }

        $vita = Tenant::query()->updateOrCreate(
            ['slug' => 'vitapharma'],
            [
                'uuid' => (string) Str::uuid(),
                'name' => 'VitaPharma',
                'legal_name' => 'VitaPharma',
                'website_url' => 'https://www.vitapharmaafrica.com',
                'primary_solution_id' => $pharma->id,
                'tenant_type' => 'pharmacy',
                'status' => 'active',
                'branding' => [
                    'display_name' => 'VitaPharma',
                    'solution' => 'PharmaCo360',
                ],
                'settings' => [
                    'ai_activation' => 'controlled',
                    'data_separation' => 'tenant_only',
                ],
            ]
        );

        Branch::query()->updateOrCreate(
            ['tenant_id' => $vita->id, 'code' => 'HQ'],
            [
                'name' => 'VitaPharma Main Branch',
                'branch_type' => 'pharmacy',
                'status' => 'active',
                'settings' => [
                    'phase' => 'pilot',
                ],
            ]
        );

        $phaseOneModules = [
            'platform.public_website',
            'platform.auth',
            'platform.admin_scopes',
            'platform.tenancy',
            'platform.rbac',
            'platform.audit',
            'pharmaco.profile',
            'pharmaco.branches',
            'pharmaco.products',
            'pharmaco.inventory',
            'pharmaco.pos',
            'pharmaco.suppliers',
            'pharmaco.reports',
        ];

        foreach ($phaseOneModules as $moduleCode) {
            $module = Module::query()->where('code', $moduleCode)->first();

            if (! $module) {
                continue;
            }

            DB::table('tenant_module_activations')->updateOrInsert(
                ['tenant_id' => $vita->id, 'module_id' => $module->id],
                [
                    'solution_id' => $pharma->id,
                    'status' => 'active',
                    'configuration' => json_encode(['phase' => 'phase_1']),
                    'activated_at' => now(),
                    'updated_at' => now(),
                    'created_at' => now(),
                ]
            );
        }

        $aiCenter = Module::query()->where('code', 'platform.ai_center')->first();

        if ($aiCenter) {
            DB::table('tenant_module_activations')->updateOrInsert(
                ['tenant_id' => $vita->id, 'module_id' => $aiCenter->id],
                [
                    'solution_id' => $pharma->id,
                    'status' => 'controlled',
                    'configuration' => json_encode(['requires_admin_approval' => true]),
                    'activated_at' => null,
                    'updated_at' => now(),
                    'created_at' => now(),
                ]
            );
        }

        AiProvider::query()->updateOrCreate(
            ['code' => 'external_ai_provider_placeholder'],
            [
                'name' => 'External AI Provider Placeholder',
                'provider_type' => 'external',
                'status' => 'disabled',
                'mode' => 'sandbox',
                'secret_reference' => null,
                'data_policy' => [
                    'external_data_sharing' => 'disabled_until_approved',
                    'tenant_boundary_required' => true,
                    'human_approval_required_for_sensitive_actions' => true,
                ],
            ]
        );

        AiAgent::query()->updateOrCreate(
            ['code' => 'pharmaco_inventory_assistant'],
            [
                'solution_id' => $pharma->id,
                'tenant_id' => null,
                'name' => 'PharmaCo360 Inventory Assistant',
                'description' => 'Supports reorder analysis, stock-out risk, expiry risk and inventory opportunity insights.',
                'status' => 'draft',
                'risk_level' => 'medium',
                'instructions_summary' => 'Advisory only. Must respect tenant scope and require human approval for reorder or stock movement decisions.',
            ]
        );
    }
}
