<?php

namespace App\Services\PharmaCo360;

use App\Models\InsuranceContributionRule;
use App\Models\InsurancePartner;
use App\Models\InsurancePriceList;
use App\Models\InsuranceScheme;
use App\Models\Tenant;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class InsuranceTenantBootstrapService
{
    public function bootstrap(Tenant $tenant): array
    {
        return DB::transaction(function () use ($tenant): array {
            $definitions = [
                [
                    'code' => 'RSSB',
                    'name' => 'Rwanda Social Security Board',
                    'partner_type' => 'public_insurer',
                    'customer_percent' => 15,
                    'insurer_percent' => 85,
                    'is_default' => true,
                ],
                [
                    'code' => 'MMI',
                    'name' => 'Military Medical Insurance',
                    'partner_type' => 'public_insurer',
                    'customer_percent' => 10,
                    'insurer_percent' => 90,
                    'is_default' => false,
                ],
                [
                    'code' => 'PRIVATE',
                    'name' => 'Private Medical Insurance',
                    'partner_type' => 'private_insurer',
                    'customer_percent' => 20,
                    'insurer_percent' => 80,
                    'is_default' => false,
                ],
            ];

            $partners = [];

            foreach ($definitions as $definition) {
                $partners[] = $this->bootstrapPartner(
                    tenant: $tenant,
                    definition: $definition
                );
            }

            return [
                'tenant_id' => $tenant->id,
                'partner_count' => count($partners),
                'partners' => $partners,
            ];
        });
    }

    private function bootstrapPartner(
        Tenant $tenant,
        array $definition
    ): array {
        $partner = InsurancePartner::query()->firstOrCreate(
            [
                'tenant_id' => $tenant->id,
                'code' => $definition['code'],
            ],
            [
                'uuid' => (string) Str::uuid(),
                'name' => $definition['name'],
                'partner_type' => $definition['partner_type'],
                'currency' => 'RWF',
                'status' => 'active',
                'is_default' => $definition['is_default'],
                'metadata' => [
                    'bootstrap_template' => true,
                ],
            ]
        );

        $scheme = InsuranceScheme::query()->firstOrCreate(
            [
                'tenant_id' => $tenant->id,
                'insurance_partner_id' => $partner->id,
                'code' => "{$definition['code']}-STANDARD",
            ],
            [
                'uuid' => (string) Str::uuid(),
                'name' => "{$definition['name']} Standard Scheme",
                'scheme_type' => 'medical',
                'default_customer_contribution_percent' =>
                    $definition['customer_percent'],
                'default_insurer_contribution_percent' =>
                    $definition['insurer_percent'],
                'effective_from' => now()->startOfYear()->toDateString(),
                'status' => 'active',
                'coverage_settings' => [
                    'medicines' => true,
                    'requires_member_verification' => true,
                ],
                'metadata' => [
                    'bootstrap_template' => true,
                ],
            ]
        );

        $priceList = InsurancePriceList::query()->firstOrCreate(
            [
                'tenant_id' => $tenant->id,
                'insurance_partner_id' => $partner->id,
                'code' => "{$definition['code']}-DEFAULT",
            ],
            [
                'uuid' => (string) Str::uuid(),
                'insurance_scheme_id' => $scheme->id,
                'name' => "{$definition['name']} Default Price List",
                'currency' => 'RWF',
                'effective_from' => now()->startOfYear()->toDateString(),
                'priority' => 100,
                'status' => 'active',
                'is_default' => true,
                'metadata' => [
                    'bootstrap_template' => true,
                    'retail_fallback_enabled' => true,
                ],
            ]
        );

        $rule = InsuranceContributionRule::query()->firstOrCreate(
            [
                'tenant_id' => $tenant->id,
                'insurance_partner_id' => $partner->id,
                'insurance_scheme_id' => $scheme->id,
                'rule_scope' => 'scheme',
                'rule_name' => "{$definition['code']} default contribution",
            ],
            [
                'uuid' => (string) Str::uuid(),
                'customer_contribution_percent' =>
                    $definition['customer_percent'],
                'insurer_contribution_percent' =>
                    $definition['insurer_percent'],
                'priority' => 100,
                'effective_from' => now()->startOfYear()->toDateString(),
                'status' => 'active',
                'metadata' => [
                    'bootstrap_template' => true,
                ],
            ]
        );

        return [
            'partner_id' => $partner->id,
            'partner_code' => $partner->code,
            'scheme_id' => $scheme->id,
            'price_list_id' => $priceList->id,
            'contribution_rule_id' => $rule->id,
        ];
    }
}
