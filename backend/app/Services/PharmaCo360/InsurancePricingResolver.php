<?php

namespace App\Services\PharmaCo360;

use App\Models\InsuranceContributionRule;
use App\Models\InsurancePartner;
use App\Models\InsurancePriceList;
use App\Models\InsuranceProductPrice;
use App\Models\InsuranceScheme;
use App\Models\Product;
use Carbon\CarbonInterface;
use Illuminate\Validation\ValidationException;

class InsurancePricingResolver
{
    public function resolve(
        int $tenantId,
        InsurancePartner $partner,
        Product $product,
        float $retailUnitPrice,
        ?InsuranceScheme $scheme = null,
        ?int $institutionId = null,
        ?CarbonInterface $serviceDate = null
    ): array {
        $date = ($serviceDate ?? now())->toDateString();

        $this->assertTenantOwnership(
            tenantId: $tenantId,
            partner: $partner,
            product: $product,
            scheme: $scheme
        );

        $priceList = $this->resolvePriceList(
            tenantId: $tenantId,
            partnerId: $partner->id,
            schemeId: $scheme?->id,
            date: $date
        );

        $productPrice = $priceList
            ? InsuranceProductPrice::query()
                ->where('tenant_id', $tenantId)
                ->where('insurance_price_list_id', $priceList->id)
                ->where('product_id', $product->id)
                ->first()
            : null;

        $rule = $this->resolveContributionRule(
            tenantId: $tenantId,
            partnerId: $partner->id,
            schemeId: $scheme?->id,
            institutionId: $institutionId,
            productId: $product->id,
            date: $date
        );

        $agreedUnitPrice = $productPrice
            ? (float) $productPrice->agreed_unit_price
            : max(0, $retailUnitPrice);

        $customerPercent = $this->customerPercent(
            productPrice: $productPrice,
            rule: $rule,
            scheme: $scheme
        );

        $insurerPercent = $this->insurerPercent(
            productPrice: $productPrice,
            rule: $rule,
            scheme: $scheme,
            customerPercent: $customerPercent
        );

        $customerAmount = $rule?->fixed_customer_amount !== null
            ? min(
                $agreedUnitPrice,
                max(0, (float) $rule->fixed_customer_amount)
            )
            : round(
                $agreedUnitPrice * ($customerPercent / 100),
                2
            );

        $insurerAmount = max(
            0,
            $agreedUnitPrice - $customerAmount
        );

        if ($rule?->maximum_insurer_amount !== null) {
            $insurerAmount = min(
                $insurerAmount,
                (float) $rule->maximum_insurer_amount
            );

            $customerAmount = max(
                0,
                $agreedUnitPrice - $insurerAmount
            );
        }

        $isCovered = $productPrice
            ? (bool) $productPrice->is_covered
            : true;

        if (
            $productPrice
            && $productPrice->coverage_status !== 'covered'
        ) {
            $isCovered = false;
        }

        return [
            'tenant_id' => $tenantId,
            'partner_id' => $partner->id,
            'partner_code' => $partner->code,
            'scheme_id' => $scheme?->id,
            'institution_id' => $institutionId,
            'product_id' => $product->id,
            'service_date' => $date,
            'currency' => $priceList?->currency
                ?? $partner->currency
                ?? 'RWF',
            'retail_unit_price' => round(
                max(0, $retailUnitPrice),
                4
            ),
            'agreed_unit_price' => round(
                $agreedUnitPrice,
                4
            ),
            'maximum_claimable_price' =>
                $productPrice?->maximum_claimable_price !== null
                    ? round(
                        (float) $productPrice->maximum_claimable_price,
                        4
                    )
                    : null,
            'customer_contribution_percent' => round(
                $customerPercent,
                4
            ),
            'insurer_contribution_percent' => round(
                $insurerPercent,
                4
            ),
            'customer_amount' => round(
                $customerAmount,
                2
            ),
            'insurer_amount' => round(
                $insurerAmount,
                2
            ),
            'is_covered' => $isCovered,
            'coverage_status' =>
                $productPrice?->coverage_status
                ?? ($isCovered ? 'covered' : 'not_covered'),
            'requires_pre_authorization' =>
                (bool) (
                    $productPrice?->requires_pre_authorization
                    ?? false
                ),
            'pricing_source' => $productPrice
                ? 'insurance_product_price'
                : 'retail_fallback',
            'contribution_source' => $rule
                ? 'contribution_rule'
                : ($scheme ? 'scheme_default' : 'partner_fallback'),
            'price_list' => $priceList
                ? [
                    'id' => $priceList->id,
                    'code' => $priceList->code,
                    'name' => $priceList->name,
                    'priority' => $priceList->priority,
                ]
                : null,
            'product_price_id' => $productPrice?->id,
            'contribution_rule' => $rule
                ? [
                    'id' => $rule->id,
                    'name' => $rule->rule_name,
                    'scope' => $rule->rule_scope,
                    'priority' => $rule->priority,
                ]
                : null,
        ];
    }

    private function resolvePriceList(
        int $tenantId,
        int $partnerId,
        ?int $schemeId,
        string $date
    ): ?InsurancePriceList {
        $query = InsurancePriceList::query()
            ->where('tenant_id', $tenantId)
            ->where('insurance_partner_id', $partnerId)
            ->where('status', 'active')
            ->whereDate('effective_from', '<=', $date)
            ->where(function ($query) use ($date): void {
                $query
                    ->whereNull('effective_to')
                    ->orWhereDate('effective_to', '>=', $date);
            });

        if ($schemeId !== null) {
            $query->where(function ($query) use ($schemeId): void {
                $query
                    ->where('insurance_scheme_id', $schemeId)
                    ->orWhereNull('insurance_scheme_id');
            });
        } else {
            $query->whereNull('insurance_scheme_id');
        }

        $priceLists = $query->get();

        return $priceLists
            ->sortBy(fn (InsurancePriceList $priceList): array => [
                $schemeId !== null
                    && (int) $priceList->insurance_scheme_id === $schemeId
                        ? 0
                        : 1,
                (int) $priceList->priority,
                -1 * $priceList->effective_from->timestamp,
                $priceList->id,
            ])
            ->first();
    }

    private function resolveContributionRule(
        int $tenantId,
        int $partnerId,
        ?int $schemeId,
        ?int $institutionId,
        int $productId,
        string $date
    ): ?InsuranceContributionRule {
        $rules = InsuranceContributionRule::query()
            ->where('tenant_id', $tenantId)
            ->where('insurance_partner_id', $partnerId)
            ->where('status', 'active')
            ->where(function ($query) use ($date): void {
                $query
                    ->whereNull('effective_from')
                    ->orWhereDate('effective_from', '<=', $date);
            })
            ->where(function ($query) use ($date): void {
                $query
                    ->whereNull('effective_to')
                    ->orWhereDate('effective_to', '>=', $date);
            })
            ->get()
            ->filter(function (
                InsuranceContributionRule $rule
            ) use (
                $schemeId,
                $institutionId,
                $productId
            ): bool {
                return match ($rule->rule_scope) {
                    'product' =>
                        (int) $rule->product_id === $productId,

                    'institution' =>
                        $institutionId !== null
                        && (int) $rule->insurance_institution_id
                            === $institutionId,

                    'scheme' =>
                        $schemeId !== null
                        && (int) $rule->insurance_scheme_id
                            === $schemeId,

                    'partner' =>
                        $rule->insurance_scheme_id === null
                        && $rule->insurance_institution_id === null
                        && $rule->product_id === null,

                    default => false,
                };
            });

        return $rules
            ->sortBy(fn (
                InsuranceContributionRule $rule
            ): array => [
                $this->scopeRank($rule->rule_scope),
                (int) $rule->priority,
                $rule->id,
            ])
            ->first();
    }

    private function customerPercent(
        ?InsuranceProductPrice $productPrice,
        ?InsuranceContributionRule $rule,
        ?InsuranceScheme $scheme
    ): float {
        if (
            $productPrice?->customer_contribution_percent
            !== null
        ) {
            return $this->normalizePercent(
                (float)
                $productPrice->customer_contribution_percent
            );
        }

        if ($rule !== null) {
            return $this->normalizePercent(
                (float) $rule->customer_contribution_percent
            );
        }

        if ($scheme !== null) {
            return $this->normalizePercent(
                (float)
                $scheme->default_customer_contribution_percent
            );
        }

        return 100;
    }

    private function insurerPercent(
        ?InsuranceProductPrice $productPrice,
        ?InsuranceContributionRule $rule,
        ?InsuranceScheme $scheme,
        float $customerPercent
    ): float {
        if (
            $productPrice?->insurer_contribution_percent
            !== null
        ) {
            return $this->normalizePercent(
                (float)
                $productPrice->insurer_contribution_percent
            );
        }

        if ($rule !== null) {
            return $this->normalizePercent(
                (float) $rule->insurer_contribution_percent
            );
        }

        if ($scheme !== null) {
            return $this->normalizePercent(
                (float)
                $scheme->default_insurer_contribution_percent
            );
        }

        return $this->normalizePercent(
            100 - $customerPercent
        );
    }

    private function normalizePercent(float $value): float
    {
        return min(100, max(0, $value));
    }

    private function scopeRank(string $scope): int
    {
        return match ($scope) {
            'product' => 10,
            'institution' => 20,
            'scheme' => 30,
            'partner' => 40,
            default => 100,
        };
    }

    private function assertTenantOwnership(
        int $tenantId,
        InsurancePartner $partner,
        Product $product,
        ?InsuranceScheme $scheme
    ): void {
        $errors = [];

        if ((int) $partner->tenant_id !== $tenantId) {
            $errors['insurance_partner_id'] = [
                'The insurance partner does not belong to the current tenant.',
            ];
        }

        if ((int) $product->tenant_id !== $tenantId) {
            $errors['product_id'] = [
                'The product does not belong to the current tenant.',
            ];
        }

        if (
            $scheme !== null
            && (
                (int) $scheme->tenant_id !== $tenantId
                || (int) $scheme->insurance_partner_id
                    !== (int) $partner->id
            )
        ) {
            $errors['insurance_scheme_id'] = [
                'The insurance scheme does not belong to this tenant and partner.',
            ];
        }

        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }
    }
}
