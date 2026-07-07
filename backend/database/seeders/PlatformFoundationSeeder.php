<?php

namespace Database\Seeders;

use App\Models\AiAgent;
use App\Models\AiProvider;
use App\Models\Branch;
use App\Models\Market;
use App\Models\Module;
use App\Models\PlatformContentPage;
use App\Models\PlatformContentSection;
use App\Models\ServiceProviderLocation;
use App\Models\Solution;
use App\Models\SystemNotification;
use App\Models\Tenant;
use App\Models\TenantMarketAssignment;
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
            ['code' => 'platform.corporate_email', 'name' => 'Corporate Email', 'group' => 'communications', 'scope' => 'shared'],
            ['code' => 'platform.data_layer', 'name' => 'Admin Data Layer', 'group' => 'platform', 'scope' => 'shared'],
            ['code' => 'platform.localization', 'name' => 'Localization', 'group' => 'market', 'scope' => 'shared'],
            ['code' => 'platform.market_management', 'name' => 'Market Management', 'group' => 'market', 'scope' => 'shared'],
            ['code' => 'platform.nearby_providers', 'name' => 'Nearby Providers', 'group' => 'market', 'scope' => 'shared'],
            ['code' => 'platform.notification_center', 'name' => 'Notification Center', 'group' => 'communications', 'scope' => 'shared'],
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
            ['code' => 'pharmaco.sales', 'name' => 'Sales and Dispensing', 'group' => 'pharmaco', 'scope' => 'pharmaco360'],
            ['code' => 'pharmaco.pharmacist_chat', 'name' => 'Pharmacist Chat', 'group' => 'pharmaco', 'scope' => 'pharmaco360'],
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
                    'status' => $item['code'] === 'pharmaco.clinic_integration'
                        ? 'planned'
                        : 'available',
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
                    'logo_asset' => '/assets/vitapharma-logo.png',
                    'brand_colors' => ['primary' => '#19753a', 'secondary' => '#91c653', 'neutral' => '#8f7e7b'],
                ],
                'settings' => [
                    'ai_activation' => 'controlled',
                    'data_separation' => 'tenant_only',
                    'website_path' => '/vitapharma',
                    'business_category' => 'retail_pharmacy',
                ],
            ]
        );

        $mainBranch = Branch::query()->updateOrCreate(
            ['tenant_id' => $vita->id, 'code' => 'HQ'],
            [
                'name' => 'VitaPharma Main Branch',
                'branch_type' => 'pharmacy',
                'status' => 'active',
                'phone' => '+250 788 000 000',
                'email' => 'care@vitapharmaafrica.com',
                'address' => 'Kigali, Rwanda',
                'settings' => [
                    'phase' => 'pilot',
                    'service_model' => 'retail_pharmacy',
                ],
            ]
        );

        $markets = [
            ['code' => 'RW', 'name' => 'Rwanda', 'country_code' => 'RW', 'default_language' => 'en', 'currency_code' => 'RWF', 'timezone' => 'Africa/Kigali', 'radius' => 12],
            ['code' => 'CD', 'name' => 'Democratic Republic of Congo', 'country_code' => 'CD', 'default_language' => 'fr', 'currency_code' => 'CDF', 'timezone' => 'Africa/Kinshasa', 'radius' => 15],
            ['code' => 'MZ', 'name' => 'Mozambique', 'country_code' => 'MZ', 'default_language' => 'pt', 'currency_code' => 'MZN', 'timezone' => 'Africa/Maputo', 'radius' => 15],
            ['code' => 'AO', 'name' => 'Angola', 'country_code' => 'AO', 'default_language' => 'pt', 'currency_code' => 'AOA', 'timezone' => 'Africa/Luanda', 'radius' => 15],
        ];

        foreach ($markets as $marketData) {
            Market::query()->updateOrCreate(
                ['code' => $marketData['code']],
                [
                    'uuid' => (string) Str::uuid(),
                    'name' => $marketData['name'],
                    'country_code' => $marketData['country_code'],
                    'default_language' => $marketData['default_language'],
                    'currency_code' => $marketData['currency_code'],
                    'timezone' => $marketData['timezone'],
                    'service_radius_km' => $marketData['radius'],
                    'status' => 'active',
                    'metadata' => [
                        'language_options' => ['en', 'fr', 'pt'],
                        'ip_policy' => 'country_code_maps_to_market',
                    ],
                ]
            );
        }

        $rwandaMarket = Market::query()->where('code', 'RW')->firstOrFail();

        TenantMarketAssignment::query()->updateOrCreate(
            ['tenant_id' => $vita->id, 'market_id' => $rwandaMarket->id],
            [
                'status' => 'active',
                'service_radius_km' => 12,
                'assigned_at' => now(),
                'metadata' => [
                    'first_tenant' => true,
                    'service_model' => 'retail_pharmacy',
                ],
            ]
        );

        ServiceProviderLocation::query()->updateOrCreate(
            ['tenant_id' => $vita->id, 'branch_id' => $mainBranch->id, 'name' => 'VitaPharma Main Branch'],
            [
                'uuid' => (string) Str::uuid(),
                'market_id' => $rwandaMarket->id,
                'provider_type' => 'retail_pharmacy',
                'service_channels' => ['in_store', 'phone', 'mobile_chat'],
                'phone' => '+250 788 000 000',
                'email' => 'care@vitapharmaafrica.com',
                'address' => 'Kigali, Rwanda',
                'latitude' => -1.9441000,
                'longitude' => 30.0619000,
                'service_radius_km' => 12,
                'status' => 'active',
                'metadata' => [
                    'powered_by' => 'Ubuzima+ PharmaCo360',
                    'launch_status' => 'first_tenant_ready',
                ],
            ]
        );

        SystemNotification::query()->updateOrCreate(
            ['uuid' => '00000000-0000-4000-8000-000000000140'],
            [
                'tenant_id' => $vita->id,
                'market_id' => $rwandaMarket->id,
                'title' => 'VitaPharma onboarding workspace is active',
                'body' => 'Your first tenant workspace is prepared with product inventory, POS, corporate email, pharmacist chat, notifications, localization, and governed AI readiness.',
                'notification_type' => 'tenant_onboarding',
                'channel' => 'in_app',
                'audience_scope' => 'tenant_staff',
                'status' => 'published',
                'published_at' => now(),
                'created_by' => null,
                'metadata' => [
                    'sms_ready_later' => true,
                    'call_to_action' => 'Confirm users, products, opening stock, and daily POS workflow.',
                ],
            ]
        );

        $phaseOneModules = [
            'platform.public_website',
            'platform.auth',
            'platform.corporate_email',
            'platform.data_layer',
            'platform.localization',
            'platform.market_management',
            'platform.nearby_providers',
            'platform.notification_center',
            'platform.admin_scopes',
            'platform.tenancy',
            'platform.rbac',
            'platform.audit',
            'pharmaco.profile',
            'pharmaco.branches',
            'pharmaco.products',
            'pharmaco.inventory',
            'pharmaco.insurance',
            'pharmaco.pos',
            'pharmaco.sales',
            'pharmaco.pharmacist_chat',
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
                    'status' => 'active',
                    'configuration' => json_encode([
                        'requires_admin_approval' => true,
                        'activation_mode' => 'governed',
                    ]),
                    'activated_at' => now(),
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

        $homePage = PlatformContentPage::query()->updateOrCreate(
            ['slug' => 'home'],
            [
                'title' => 'Ubuzima+ Digital Health Operations',
                'description' => 'Commercial public website content for Ubuzima+ and PharmaCo360.',
                'template' => 'public_home',
                'status' => 'published',
                'seo' => [
                    'title' => 'Ubuzima+ | Digital health operations platform',
                    'description' => 'Run pharmacy branches, inventory, POS, procurement, finance, reporting and governed AI from Ubuzima+.',
                ],
                'style' => [
                    'font_family' => 'Inter',
                    'primary_color' => '#0877c9',
                    'accent_color' => '#36ad3a',
                    'radius' => 8,
                ],
                'published_at' => now(),
            ]
        );

        $sections = [
            [
                'section_key' => 'hero',
                'eyebrow' => 'Digital health business platform',
                'title' => 'Ubuzima+ digital health operations platform.',
                'body' => 'Run pharmacy branches, stock, sales, dispensing, procurement, finance visibility, reporting, customer follow-up, and AI-assisted decisions from a secure modular platform.',
                'sort_order' => 1,
                'content' => [
                    'primary_action' => 'Request Demo',
                    'secondary_action' => 'Explore PharmaCo360',
                ],
                'style' => [
                    'layout' => 'image_hero',
                    'text_width' => '620px',
                ],
            ],
            [
                'section_key' => 'solutions',
                'eyebrow' => 'Solution portfolio',
                'title' => 'One platform foundation, multiple health-sector solutions.',
                'body' => 'PharmaCore 360 is active for the first tenant. ClinicCore, VetCore, and InsuCore remain visible as portfolio-ready solutions until activated.',
                'sort_order' => 2,
                'content' => [
                    'items' => ['PharmaCore 360', 'ClinicCore 360', 'VetCore 360', 'InsuCore 260'],
                ],
                'style' => [
                    'columns' => 4,
                    'background' => 'white',
                ],
            ],
            [
                'section_key' => 'pharmaco_modules',
                'eyebrow' => 'PharmaCore 360',
                'title' => 'A full pharmacy ecosystem, not only a POS.',
                'body' => 'Start with product master, inventory, POS, procurement, finance, reports, and branch controls. Activate AI, wholesale, delivery, insurance, and clinic links when ready.',
                'sort_order' => 3,
                'content' => [
                    'priority_modules' => ['AI Model', 'Inventory', 'POS', 'Procurement', 'Reports'],
                ],
                'style' => [
                    'background' => 'soft',
                    'columns' => 3,
                ],
            ],
            [
                'section_key' => 'security',
                'eyebrow' => 'Security and trust',
                'title' => 'Commercial viability depends on confidence.',
                'body' => 'Ubuzima+ is designed around tenant separation, permissioned access, auditability, mandatory staff 2FA, trusted devices, and controlled AI.',
                'sort_order' => 4,
                'content' => [
                    'controls' => ['Tenant data separation', 'Role and branch scope', 'Two-factor authentication', 'Audit logs', 'Human approval for sensitive AI'],
                ],
                'style' => [
                    'background' => 'white',
                    'accent' => '#073844',
                ],
            ],
            [
                'section_key' => 'onboarding',
                'eyebrow' => 'First tenant readiness',
                'title' => 'Move from setup to daily use in controlled stages.',
                'body' => 'Prepare VitaPharma with staff security, business setup, branches, products, opening stock, suppliers, POS, reports, and daily close routines before adding advanced modules.',
                'sort_order' => 5,
                'content' => [
                    'steps' => ['Secure staff access', 'Confirm branch setup', 'Load products and stock', 'Practice POS and receiving', 'Go live with daily review'],
                ],
                'style' => [
                    'background' => 'teal',
                    'text_color' => 'white',
                ],
            ],
        ];

        foreach ($sections as $section) {
            PlatformContentSection::query()->updateOrCreate(
                ['page_id' => $homePage->id, 'section_key' => $section['section_key']],
                [
                    ...$section,
                    'page_id' => $homePage->id,
                    'status' => 'active',
                ]
            );
        }
    }
}
