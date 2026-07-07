<?php

namespace App\Services\PharmaCo360;

use App\Models\CustomerInsuranceMembership;
use Carbon\CarbonImmutable;

class InsuranceEligibilityService
{
    public function evaluate(
        CustomerInsuranceMembership $membership,
        ?string $serviceDate = null,
        ?int $checkedBy = null
    ): array {
        $membership->loadMissing([
            'customer',
            'partner',
            'scheme',
            'institution',
        ]);

        $date = $serviceDate
            ? CarbonImmutable::parse($serviceDate)->startOfDay()
            : CarbonImmutable::today();

        $reasons = [];

        if ($membership->status !== 'active') {
            $reasons[] = [
                'code' => 'membership_not_active',
                'message' => 'The insurance membership is not active.',
            ];
        }

        if ($membership->verification_status !== 'verified') {
            $reasons[] = [
                'code' => 'membership_not_verified',
                'message' =>
                    'The insurance membership has not been verified.',
            ];
        }

        if (!$membership->customer) {
            $reasons[] = [
                'code' => 'customer_missing',
                'message' => 'The linked customer record is unavailable.',
            ];
        } elseif ($membership->customer->status !== 'active') {
            $reasons[] = [
                'code' => 'customer_not_active',
                'message' => 'The linked customer is not active.',
            ];
        }

        if (!$membership->partner) {
            $reasons[] = [
                'code' => 'partner_missing',
                'message' => 'The insurance partner is unavailable.',
            ];
        } elseif ($membership->partner->status !== 'active') {
            $reasons[] = [
                'code' => 'partner_not_active',
                'message' => 'The insurance partner is not active.',
            ];
        }

        if (!$membership->scheme) {
            $reasons[] = [
                'code' => 'scheme_missing',
                'message' => 'The insurance scheme is unavailable.',
            ];
        } elseif ($membership->scheme->status !== 'active') {
            $reasons[] = [
                'code' => 'scheme_not_active',
                'message' => 'The insurance scheme is not active.',
            ];
        }

        if (
            $membership->institution &&
            $membership->institution->status !== 'active'
        ) {
            $reasons[] = [
                'code' => 'institution_not_active',
                'message' =>
                    'The linked insurance institution is not active.',
            ];
        }

        if (
            $membership->coverage_from &&
            $membership->coverage_from->startOfDay()->greaterThan($date)
        ) {
            $reasons[] = [
                'code' => 'coverage_not_started',
                'message' =>
                    'The membership coverage has not started.',
            ];
        }

        if (
            $membership->coverage_to &&
            $membership->coverage_to->endOfDay()->lessThan($date)
        ) {
            $reasons[] = [
                'code' => 'coverage_expired',
                'message' => 'The membership coverage has expired.',
            ];
        }

        $result = [
            'eligible' => count($reasons) === 0,
            'service_date' => $date->toDateString(),
            'checked_at' => now()->toISOString(),
            'checked_by' => $checkedBy,
            'membership_id' => $membership->id,
            'customer_id' => $membership->customer_id,
            'insurance_partner_id' =>
                $membership->insurance_partner_id,
            'insurance_scheme_id' =>
                $membership->insurance_scheme_id,
            'insurance_institution_id' =>
                $membership->insurance_institution_id,
            'member_number' => $membership->member_number,
            'reasons' => $reasons,
        ];

        $membership->forceFill([
            'eligibility_response' => $result,
        ])->save();

        return $result;
    }
}
