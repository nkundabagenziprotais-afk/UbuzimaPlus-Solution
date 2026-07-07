<?php

namespace App\Services\PharmaCo360;

use App\Models\CustomerInsuranceMembership;
use App\Models\InsuranceClaim;
use App\Models\InsuranceClaimLine;
use App\Models\PharmacoSale;
use App\Models\PharmacoSaleItem;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

class InsuranceClaimGenerationService
{
    public function __construct(
        private readonly InsuranceEligibilityService $eligibilityService,
        private readonly InsurancePricingResolver $pricingResolver
    ) {
    }

    public function generateDraft(
        int $tenantId,
        PharmacoSale $sale,
        CustomerInsuranceMembership $membership,
        ?string $serviceDate = null,
        ?int $generatedBy = null
    ): InsuranceClaim {
        $date = $serviceDate
            ? CarbonImmutable::parse($serviceDate)->startOfDay()
            : CarbonImmutable::parse(
                $sale->sold_at ?? now()
            )->startOfDay();

        return DB::transaction(function () use (
            $tenantId,
            $sale,
            $membership,
            $date,
            $generatedBy
        ): InsuranceClaim {
            $lockedSale = PharmacoSale::query()
                ->where('tenant_id', $tenantId)
                ->lockForUpdate()
                ->findOrFail($sale->id);

            $lockedMembership =
                CustomerInsuranceMembership::query()
                    ->where('tenant_id', $tenantId)
                    ->lockForUpdate()
                    ->findOrFail($membership->id);

            $this->validateSaleAndMembership(
                $tenantId,
                $lockedSale,
                $lockedMembership
            );

            $duplicate = InsuranceClaim::query()
                ->where('tenant_id', $tenantId)
                ->where('sale_id', $lockedSale->id)
                ->where(
                    'customer_insurance_membership_id',
                    $lockedMembership->id
                )
                ->exists();

            if ($duplicate) {
                throw new ConflictHttpException(
                    'An insurance claim already exists for this sale and membership.'
                );
            }

            $eligibility = $this->eligibilityService->evaluate(
                membership: $lockedMembership,
                serviceDate: $date->toDateString(),
                checkedBy: $generatedBy
            );

            if (!$eligibility['eligible']) {
                throw ValidationException::withMessages([
                    'customer_insurance_membership_id' => [
                        'The selected insurance membership is not eligible on the service date.',
                    ],
                ]);
            }

            $lockedMembership->load([
                'partner',
                'scheme',
                'institution',
                'customer',
            ]);

            $lockedSale->load([
                'branch',
                'customer',
                'prescription',
                'items.product',
            ]);

            if (!$lockedMembership->partner) {
                throw ValidationException::withMessages([
                    'customer_insurance_membership_id' => [
                        'The insurance membership has no valid insurance partner.',
                    ],
                ]);
            }

            $claim = InsuranceClaim::query()->create([
                'uuid' => (string) Str::uuid(),
                'tenant_id' => $tenantId,
                'insurance_partner_id' =>
                    $lockedMembership->insurance_partner_id,
                'insurance_scheme_id' =>
                    $lockedMembership->insurance_scheme_id,
                'customer_insurance_membership_id' =>
                    $lockedMembership->id,
                'sale_id' => $lockedSale->id,
                'claim_number' =>
                    $this->nextClaimNumber($tenantId),
                'service_date' => $date->toDateString(),
                'gross_amount' => 0,
                'customer_amount' => 0,
                'claimed_amount' => 0,
                'approved_amount' => 0,
                'rejected_amount' => 0,
                'paid_amount' => 0,
                'status' => 'draft',
                'metadata' => [
                    'generation_workflow' =>
                        'phase_4f1b_claim_from_confirmed_sale',
                    'generated_by' => $generatedBy,
                    'generated_at' => now()->toISOString(),
                    'sale_number' => $lockedSale->sale_number,
                    'membership_number' =>
                        $lockedMembership->member_number,
                    'eligibility_snapshot' => $eligibility,
                ],
            ]);

            $totals = [
                'gross' => 0.0,
                'customer' => 0.0,
                'claimed' => 0.0,
            ];

            foreach ($lockedSale->items as $saleItem) {
                $line = $this->createClaimLine(
                    tenantId: $tenantId,
                    claim: $claim,
                    membership: $lockedMembership,
                    saleItem: $saleItem,
                    serviceDate: $date
                );

                $totals['gross'] +=
                    (float) $line->gross_amount;
                $totals['customer'] +=
                    (float) $line->customer_amount;
                $totals['claimed'] +=
                    (float) $line->claimed_amount;
            }

            $claim->forceFill([
                'gross_amount' =>
                    round($totals['gross'], 2),
                'customer_amount' =>
                    round($totals['customer'], 2),
                'claimed_amount' =>
                    round($totals['claimed'], 2),
            ])->save();

            return $claim->fresh([
                'partner',
                'scheme',
                'membership.customer',
                'sale.branch',
                'sale.customer',
                'lines.product',
                'lines.saleItem',
            ]);
        });
    }

    private function validateSaleAndMembership(
        int $tenantId,
        PharmacoSale $sale,
        CustomerInsuranceMembership $membership
    ): void {
        $errors = [];

        if ((int) $sale->tenant_id !== $tenantId) {
            $errors['sale_id'][] =
                'The sale does not belong to the current tenant.';
        }

        if ((int) $membership->tenant_id !== $tenantId) {
            $errors[
                'customer_insurance_membership_id'
            ][] =
                'The membership does not belong to the current tenant.';
        }

        if ($sale->status !== 'dispensed') {
            $errors['sale_id'][] =
                'Only a confirmed and dispensed sale can generate an insurance claim.';
        }

        if ($sale->sale_type !== 'insurance_sale') {
            $errors['sale_id'][] =
                'Only an insurance sale can generate an insurance claim.';
        }

        if (!$sale->pharmaco_customer_id) {
            $errors['sale_id'][] =
                'The insurance sale must have a customer.';
        }

        if (
            $sale->pharmaco_customer_id &&
            (int) $membership->customer_id !==
                (int) $sale->pharmaco_customer_id
        ) {
            $errors[
                'customer_insurance_membership_id'
            ][] =
                'The membership belongs to a different customer.';
        }

        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }
    }

    private function createClaimLine(
        int $tenantId,
        InsuranceClaim $claim,
        CustomerInsuranceMembership $membership,
        PharmacoSaleItem $saleItem,
        CarbonImmutable $serviceDate
    ): InsuranceClaimLine {
        if (!$saleItem->product) {
            throw ValidationException::withMessages([
                'sale_items' => [
                    "Product for sale item {$saleItem->id} is unavailable.",
                ],
            ]);
        }

        $quantity = round(
            (float) $saleItem->quantity,
            4
        );

        $retailUnitPrice = round(
            (float) $saleItem->unit_price,
            4
        );

        $resolution = $this->pricingResolver->resolve(
            tenantId: $tenantId,
            partner: $membership->partner,
            product: $saleItem->product,
            retailUnitPrice: $retailUnitPrice,
            scheme: $membership->scheme,
            institutionId:
                $membership->insurance_institution_id,
            serviceDate: $serviceDate
        );

        $grossAmount = round(
            (float) $saleItem->line_total,
            2
        );

        $agreedUnitPrice = max(
            0,
            (float) (
                $resolution['agreed_unit_price']
                ?? $retailUnitPrice
            )
        );

        $maximumClaimablePrice =
            $resolution['maximum_claimable_price']
            ?? null;

        $eligibleUnitPrice =
            $maximumClaimablePrice !== null
                ? min(
                    $agreedUnitPrice,
                    max(
                        0,
                        (float) $maximumClaimablePrice
                    )
                )
                : $agreedUnitPrice;

        $eligibleGross = round(
            $eligibleUnitPrice * $quantity,
            2
        );

        $isCovered = (bool) (
            $resolution['is_covered'] ?? false
        );

        if (!$isCovered) {
            $customerAmount = $grossAmount;
            $claimedAmount = 0.0;
            $status = 'not_covered';
        } else {
            $resolvedCustomerUnit = max(
                0,
                (float) (
                    $resolution['customer_amount'] ?? 0
                )
            );

            $resolvedInsurerUnit = max(
                0,
                (float) (
                    $resolution['insurer_amount'] ?? 0
                )
            );

            $coveredCustomer = round(
                min(
                    $eligibleUnitPrice,
                    $resolvedCustomerUnit
                ) * $quantity,
                2
            );

            $claimedAmount = round(
                min(
                    max(
                        0,
                        $eligibleUnitPrice -
                            min(
                                $eligibleUnitPrice,
                                $resolvedCustomerUnit
                            )
                    ),
                    $resolvedInsurerUnit
                ) * $quantity,
                2
            );

            $customerAmount = round(
                max(
                    0,
                    $grossAmount - $claimedAmount
                ),
                2
            );

            $status = (bool) (
                $resolution[
                    'requires_pre_authorization'
                ] ?? false
            )
                ? 'preauthorization_required'
                : 'pending';
        }

        return InsuranceClaimLine::query()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $tenantId,
            'insurance_claim_id' => $claim->id,
            'product_id' => $saleItem->product_id,
            'sale_item_id' => $saleItem->id,
            'description' =>
                $saleItem->product_name_snapshot
                ?: $saleItem->product->name,
            'quantity' => $quantity,
            'unit_price' =>
                round($eligibleUnitPrice, 4),
            'gross_amount' => $grossAmount,
            'customer_amount' => $customerAmount,
            'claimed_amount' => $claimedAmount,
            'approved_amount' => 0,
            'rejected_amount' => 0,
            'status' => $status,
            'metadata' => [
                'sale_item_snapshot' => [
                    'sale_item_id' => $saleItem->id,
                    'product_id' =>
                        $saleItem->product_id,
                    'product_name' =>
                        $saleItem->product_name_snapshot,
                    'sku' => $saleItem->sku_snapshot,
                    'quantity' => $quantity,
                    'retail_unit_price' =>
                        $retailUnitPrice,
                    'discount_amount' =>
                        (float) $saleItem
                            ->discount_amount,
                    'tax_amount' =>
                        (float) $saleItem->tax_amount,
                    'line_total' => $grossAmount,
                ],
                'pricing_resolution' => $resolution,
                'eligible_unit_price' =>
                    round($eligibleUnitPrice, 4),
                'eligible_gross_amount' =>
                    $eligibleGross,
                'uncovered_difference' => max(
                    0,
                    round(
                        $grossAmount - $eligibleGross,
                        2
                    )
                ),
                'is_covered' => $isCovered,
                'coverage_status' =>
                    $resolution['coverage_status']
                    ?? null,
                'requires_pre_authorization' =>
                    (bool) (
                        $resolution[
                            'requires_pre_authorization'
                        ] ?? false
                    ),
            ],
        ]);
    }

    private function nextClaimNumber(
        int $tenantId
    ): string {
        $sequence = InsuranceClaim::query()
            ->where('tenant_id', $tenantId)
            ->count() + 1;

        return sprintf(
            'CLM-%04d-%s-%04d',
            $tenantId,
            now()->format('Ymd'),
            $sequence
        );
    }
}
