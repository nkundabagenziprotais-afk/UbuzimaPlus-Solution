<?php

namespace App\Http\Controllers\Api\V1\PharmaCo360;

use App\Http\Controllers\Controller;
use App\Models\Branch;
use App\Models\BranchDepartment;
use App\Models\PharmacyProfile;
use App\Services\Access\ScopeResolver;
use App\Services\Audit\AuditLogService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

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
    public function updateBranch(
        Request $request,
        Branch $branch,
        AuditLogService $auditLogService,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        $tenant = $request->attributes->get('tenant');

        if ((int) $branch->tenant_id !== (int) $tenant->id) {
            abort(404);
        }

        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'branch_type' => ['sometimes', 'string', 'max:120'],
            'status' => ['sometimes', Rule::in(['active', 'inactive', 'maintenance'])],
            'phone' => ['nullable', 'string', 'max:80'],
            'email' => ['nullable', 'email', 'max:255'],
            'address' => ['nullable', 'string', 'max:500'],
        ]);

        $before = $branch->only(array_keys($validated));

        $branch->fill($validated);
        $branch->save();

        $scope = $scopeResolver->resolveForUser($request->user());

        $auditLogService->record(
            action: 'pharmaco.branch.updated',
            scope: $scope,
            metadata: [
                'tenant_slug' => $tenant->slug,
                'branch_code' => $branch->code,
                'before' => $before,
                'after' => $branch->only(array_keys($validated)),
            ],
            dataClassification: 'internal',
            auditableType: Branch::class,
            auditableId: $branch->id
        );

        return response()->json([
            'message' => 'Branch updated successfully.',
            'branch' => $this->serializeBranch($branch),
        ]);
    }

    public function createBranchDepartment(
        Request $request,
        Branch $branch,
        AuditLogService $auditLogService,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        $tenant = $request->attributes->get('tenant');

        if ((int) $branch->tenant_id !== (int) $tenant->id) {
            abort(404);
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'code' => [
                'required',
                'string',
                'max:80',
                Rule::unique('branch_departments', 'code')->where('branch_id', $branch->id),
            ],
            'department_type' => ['required', 'string', 'max:120'],
            'phone' => ['nullable', 'string', 'max:80'],
            'email' => ['nullable', 'email', 'max:255'],
            'opening_time' => ['nullable', 'date_format:H:i'],
            'closing_time' => ['nullable', 'date_format:H:i'],
            'is_revenue_center' => ['sometimes', 'boolean'],
            'operating_status' => ['sometimes', Rule::in(['active', 'inactive', 'maintenance'])],
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);

        $department = BranchDepartment::query()->create([
            ...$validated,
            'uuid' => (string) \Illuminate\Support\Str::uuid(),
            'tenant_id' => $tenant->id,
            'branch_id' => $branch->id,
            'is_revenue_center' => $validated['is_revenue_center'] ?? false,
            'operating_status' => $validated['operating_status'] ?? 'active',
            'metadata' => [
                'created_from' => 'pharmaco_core_api',
            ],
        ]);

        $scope = $scopeResolver->resolveForUser($request->user());

        $auditLogService->record(
            action: 'pharmaco.branch_department.created',
            scope: $scope,
            metadata: [
                'tenant_slug' => $tenant->slug,
                'branch_code' => $branch->code,
                'department_code' => $department->code,
            ],
            dataClassification: 'internal',
            auditableType: BranchDepartment::class,
            auditableId: $department->id
        );

        return response()->json([
            'message' => 'Branch department created successfully.',
            'department' => $this->serializeDepartment($department),
        ], 201);
    }

    public function updateBranchDepartment(
        Request $request,
        Branch $branch,
        BranchDepartment $department,
        AuditLogService $auditLogService,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        $tenant = $request->attributes->get('tenant');

        if ((int) $branch->tenant_id !== (int) $tenant->id) {
            abort(404);
        }

        if ((int) $department->tenant_id !== (int) $tenant->id || (int) $department->branch_id !== (int) $branch->id) {
            abort(404);
        }

        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'code' => [
                'sometimes',
                'string',
                'max:80',
                Rule::unique('branch_departments', 'code')
                    ->where('branch_id', $branch->id)
                    ->ignore($department->id),
            ],
            'department_type' => ['sometimes', 'string', 'max:120'],
            'phone' => ['nullable', 'string', 'max:80'],
            'email' => ['nullable', 'email', 'max:255'],
            'opening_time' => ['nullable', 'date_format:H:i'],
            'closing_time' => ['nullable', 'date_format:H:i'],
            'is_revenue_center' => ['sometimes', 'boolean'],
            'operating_status' => ['sometimes', Rule::in(['active', 'inactive', 'maintenance'])],
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);

        $before = $department->only(array_keys($validated));

        $department->fill($validated);
        $department->save();

        $scope = $scopeResolver->resolveForUser($request->user());

        $auditLogService->record(
            action: 'pharmaco.branch_department.updated',
            scope: $scope,
            metadata: [
                'tenant_slug' => $tenant->slug,
                'branch_code' => $branch->code,
                'department_code' => $department->code,
                'before' => $before,
                'after' => $department->only(array_keys($validated)),
            ],
            dataClassification: 'internal',
            auditableType: BranchDepartment::class,
            auditableId: $department->id
        );

        return response()->json([
            'message' => 'Branch department updated successfully.',
            'department' => $this->serializeDepartment($department),
        ]);
    }

    private function serializeBranch(Branch $branch): array
    {
        return [
            'id' => $branch->id,
            'name' => $branch->name,
            'code' => $branch->code,
            'branch_type' => $branch->branch_type,
            'status' => $branch->status,
            'phone' => $branch->phone,
            'email' => $branch->email,
            'address' => $branch->address,
            'settings' => $branch->settings ?? [],
        ];
    }

    private function serializeDepartment(BranchDepartment $department): array
    {
        return [
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
        ];
    }

}
