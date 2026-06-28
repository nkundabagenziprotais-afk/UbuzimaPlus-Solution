<?php

namespace App\Http\Controllers\Api\V1\PharmaCo360;

use App\Http\Controllers\Controller;
use App\Models\Branch;
use App\Models\BranchDepartment;
use App\Models\PharmacyProfile;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CoreProfileController extends Controller
{
    public function profile(Request $request): JsonResponse
    {
        $tenant = $request->attributes->get('tenant');

        $profile = PharmacyProfile::query()
            ->where('tenant_id', $tenant->id)
            ->firstOrFail();

        return response()->json([
            'tenant' => [
                'id' => $tenant->id,
                'name' => $tenant->name,
                'slug' => $tenant->slug,
                'status' => $tenant->status,
            ],
            'profile' => [
                'id' => $profile->id,
                'uuid' => $profile->uuid,
                'legal_name' => $profile->legal_name,
                'trading_name' => $profile->trading_name,
                'pharmacy_category' => $profile->pharmacy_category,
                'ownership_type' => $profile->ownership_type,
                'license_number' => $profile->license_number,
                'tin' => $profile->tin,
                'rssb_provider_code' => $profile->rssb_provider_code,
                'insurance_partner_code' => $profile->insurance_partner_code,
                'regulator_name' => $profile->regulator_name,
                'primary_contact_name' => $profile->primary_contact_name,
                'primary_phone' => $profile->primary_phone,
                'primary_email' => $profile->primary_email,
                'website' => $profile->website,
                'country' => $profile->country,
                'city' => $profile->city,
                'district' => $profile->district,
                'sector' => $profile->sector,
                'physical_address' => $profile->physical_address,
                'capabilities' => $profile->capabilities ?? [],
                'insurance_partners' => $profile->insurance_partners ?? [],
                'operating_hours' => $profile->operating_hours ?? [],
                'status' => $profile->status,
                'is_primary' => $profile->is_primary,
                'verified_at' => $profile->verified_at?->toISOString(),
            ],
        ]);
    }

    public function branches(Request $request): JsonResponse
    {
        $tenant = $request->attributes->get('tenant');

        $branches = Branch::query()
            ->where('tenant_id', $tenant->id)
            ->orderBy('name')
            ->get()
            ->map(fn (Branch $branch) => [
                'id' => $branch->id,
                'name' => $branch->name,
                'code' => $branch->code,
                'branch_type' => $branch->branch_type,
                'status' => $branch->status,
                'phone' => $branch->phone,
                'email' => $branch->email,
                'address' => $branch->address,
                'settings' => $branch->settings ?? [],
            ])
            ->values();

        return response()->json([
            'tenant' => [
                'id' => $tenant->id,
                'name' => $tenant->name,
                'slug' => $tenant->slug,
            ],
            'branches' => $branches,
        ]);
    }

    public function branchDepartments(Request $request, Branch $branch): JsonResponse
    {
        $tenant = $request->attributes->get('tenant');

        if ((int) $branch->tenant_id !== (int) $tenant->id) {
            abort(404);
        }

        $departments = BranchDepartment::query()
            ->where('tenant_id', $tenant->id)
            ->where('branch_id', $branch->id)
            ->orderBy('name')
            ->get()
            ->map(fn (BranchDepartment $department) => [
                'id' => $department->id,
                'uuid' => $department->uuid,
                'name' => $department->name,
                'code' => $department->code,
                'department_type' => $department->department_type,
                'phone' => $department->phone,
                'email' => $department->email,
                'opening_time' => $department->opening_time,
                'closing_time' => $department->closing_time,
                'is_revenue_center' => $department->is_revenue_center,
                'operating_status' => $department->operating_status,
                'notes' => $department->notes,
                'metadata' => $department->metadata ?? [],
            ])
            ->values();

        return response()->json([
            'tenant' => [
                'id' => $tenant->id,
                'name' => $tenant->name,
                'slug' => $tenant->slug,
            ],
            'branch' => [
                'id' => $branch->id,
                'name' => $branch->name,
                'code' => $branch->code,
                'status' => $branch->status,
            ],
            'departments' => $departments,
        ]);
    }
}
