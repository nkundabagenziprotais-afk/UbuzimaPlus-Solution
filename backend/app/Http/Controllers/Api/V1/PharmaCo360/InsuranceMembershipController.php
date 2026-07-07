<?php

namespace App\Http\Controllers\Api\V1\PharmaCo360;

use App\Http\Controllers\Controller;
use App\Models\CustomerInsuranceMembership;
use App\Models\InsuranceInstitution;
use App\Models\InsurancePartner;
use App\Models\InsuranceScheme;
use App\Services\Access\ScopeResolver;
use App\Services\Audit\AuditLogService;
use App\Services\PharmaCo360\InsuranceEligibilityService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class InsuranceMembershipController extends Controller
{
    public function memberships(Request $request): JsonResponse
    {
        $tenant = $request->attributes->get('tenant');

        $perPage = min(
            max((int) $request->query('per_page', 25), 1),
            200
        );

        $memberships = CustomerInsuranceMembership::query()
            ->with([
                'customer',
                'partner',
                'scheme',
                'institution',
            ])
            ->where('tenant_id', $tenant->id)
            ->when(
                $request->query('customer_id'),
                fn ($query, $customerId) =>
                    $query->where('customer_id', $customerId)
            )
            ->when(
                $request->query('insurance_partner_id'),
                fn ($query, $partnerId) =>
                    $query->where('insurance_partner_id', $partnerId)
            )
            ->when(
                $request->query('insurance_scheme_id'),
                fn ($query, $schemeId) =>
                    $query->where('insurance_scheme_id', $schemeId)
            )
            ->when(
                $request->query('verification_status'),
                fn ($query, $verificationStatus) =>
                    $query->where(
                        'verification_status',
                        $verificationStatus
                    )
            )
            ->when(
                $request->query('status'),
                fn ($query, $status) =>
                    $status === 'all'
                        ? $query
                        : $query->where('status', $status)
            )
            ->when(
                $request->query('search'),
                function ($query, $search): void {
                    $term = '%' . trim((string) $search) . '%';

                    $query->where(
                        function ($searchQuery) use ($term): void {
                            $searchQuery
                                ->where('member_number', 'like', $term)
                                ->orWhere('policy_number', 'like', $term)
                                ->orWhere(
                                    'principal_member_number',
                                    'like',
                                    $term
                                )
                                ->orWhereHas(
                                    'customer',
                                    function ($customerQuery) use ($term): void {
                                        $customerQuery
                                            ->where(
                                                'first_name',
                                                'like',
                                                $term
                                            )
                                            ->orWhere(
                                                'last_name',
                                                'like',
                                                $term
                                            )
                                            ->orWhere(
                                                'phone',
                                                'like',
                                                $term
                                            )
                                            ->orWhere(
                                                'email',
                                                'like',
                                                $term
                                            );
                                    }
                                );
                        }
                    );
                }
            )
            ->orderByDesc('id')
            ->paginate($perPage);

        return response()->json([
            'tenant' => $this->tenantPayload($tenant),
            'memberships' => collect($memberships->items())
                ->map(
                    fn (CustomerInsuranceMembership $membership) =>
                        $this->serializeMembership($membership)
                )
                ->values(),
            'meta' => $this->paginationPayload($memberships),
        ]);
    }

    public function createMembership(
        Request $request,
        AuditLogService $auditLogService,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        $tenant = $request->attributes->get('tenant');

        $validated = $request->validate(
            $this->membershipRules(
                tenantId: $tenant->id,
                partnerId: (int) $request->input(
                    'insurance_partner_id'
                )
            )
        );

        $this->validateInsuranceScope(
            tenantId: $tenant->id,
            data: $validated
        );

        $verificationStatus =
            $validated['verification_status'] ?? 'pending';

        $membership = CustomerInsuranceMembership::query()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $tenant->id,
            'customer_id' => $validated['customer_id'],
            'insurance_partner_id' =>
                $validated['insurance_partner_id'],
            'insurance_scheme_id' =>
                $validated['insurance_scheme_id'],
            'insurance_institution_id' =>
                $validated['insurance_institution_id'] ?? null,
            'member_number' => trim($validated['member_number']),
            'policy_number' => $validated['policy_number'] ?? null,
            'principal_member_number' =>
                $validated['principal_member_number'] ?? null,
            'relationship_to_principal' =>
                $validated['relationship_to_principal'] ?? 'self',
            'coverage_from' => $validated['coverage_from'] ?? null,
            'coverage_to' => $validated['coverage_to'] ?? null,
            'verification_status' => $verificationStatus,
            'verified_at' =>
                $verificationStatus === 'verified' ? now() : null,
            'verified_by' =>
                $verificationStatus === 'verified'
                    ? $request->user()->id
                    : null,
            'status' => $validated['status'] ?? 'active',
            'metadata' => array_merge(
                $validated['metadata'] ?? [],
                [
                    'created_from' =>
                        'pharmaco_insurance_membership_api',
                ]
            ),
        ]);

        $membership->load([
            'customer',
            'partner',
            'scheme',
            'institution',
        ]);

        $scope = $scopeResolver->resolveForUser($request->user());

        $auditLogService->record(
            action: 'pharmaco.insurance_membership.created',
            scope: $scope,
            metadata: [
                'tenant_slug' => $tenant->slug,
                'customer_id' => $membership->customer_id,
                'insurance_partner_id' =>
                    $membership->insurance_partner_id,
                'insurance_scheme_id' =>
                    $membership->insurance_scheme_id,
                'member_number' => $membership->member_number,
                'verification_status' =>
                    $membership->verification_status,
            ],
            dataClassification: 'confidential',
            auditableType: CustomerInsuranceMembership::class,
            auditableId: $membership->id
        );

        return response()->json([
            'message' =>
                'Customer insurance membership created successfully.',
            'tenant' => $this->tenantPayload($tenant),
            'membership' =>
                $this->serializeMembership($membership),
        ], 201);
    }

    public function updateMembership(
        Request $request,
        CustomerInsuranceMembership $customerInsuranceMembership,
        AuditLogService $auditLogService,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        $tenant = $request->attributes->get('tenant');

        abort_unless(
            (int) $customerInsuranceMembership->tenant_id ===
                (int) $tenant->id,
            404
        );

        $partnerId = (int) $request->input(
            'insurance_partner_id',
            $customerInsuranceMembership->insurance_partner_id
        );

        $validated = $request->validate(
            $this->membershipRules(
                tenantId: $tenant->id,
                partnerId: $partnerId,
                membership:
                    $customerInsuranceMembership,
                partial: true
            )
        );

        $scopeData = array_merge(
            [
                'customer_id' =>
                    $customerInsuranceMembership->customer_id,
                'insurance_partner_id' =>
                    $customerInsuranceMembership
                        ->insurance_partner_id,
                'insurance_scheme_id' =>
                    $customerInsuranceMembership
                        ->insurance_scheme_id,
                'insurance_institution_id' =>
                    $customerInsuranceMembership
                        ->insurance_institution_id,
            ],
            $validated
        );

        $this->validateInsuranceScope(
            tenantId: $tenant->id,
            data: $scopeData
        );

        $before = $customerInsuranceMembership->only([
            'customer_id',
            'insurance_partner_id',
            'insurance_scheme_id',
            'insurance_institution_id',
            'member_number',
            'policy_number',
            'principal_member_number',
            'relationship_to_principal',
            'coverage_from',
            'coverage_to',
            'verification_status',
            'verified_at',
            'verified_by',
            'status',
        ]);

        $customerInsuranceMembership->fill($validated);

        if (array_key_exists('member_number', $validated)) {
            $customerInsuranceMembership->member_number =
                trim($validated['member_number']);
        }

        if (
            array_key_exists('verification_status', $validated) &&
            $validated['verification_status'] === 'verified'
        ) {
            $customerInsuranceMembership->verified_at = now();
            $customerInsuranceMembership->verified_by =
                $request->user()->id;
        }

        if (
            array_key_exists('verification_status', $validated) &&
            $validated['verification_status'] !== 'verified'
        ) {
            $customerInsuranceMembership->verified_at = null;
            $customerInsuranceMembership->verified_by = null;
        }

        $customerInsuranceMembership->eligibility_response = null;
        $customerInsuranceMembership->save();

        $customerInsuranceMembership->load([
            'customer',
            'partner',
            'scheme',
            'institution',
        ]);

        $scope = $scopeResolver->resolveForUser($request->user());

        $auditLogService->record(
            action: 'pharmaco.insurance_membership.updated',
            scope: $scope,
            metadata: [
                'tenant_slug' => $tenant->slug,
                'member_number' =>
                    $customerInsuranceMembership->member_number,
                'before' => $before,
                'after' =>
                    $customerInsuranceMembership->only(
                        array_keys($before)
                    ),
            ],
            dataClassification: 'confidential',
            auditableType: CustomerInsuranceMembership::class,
            auditableId: $customerInsuranceMembership->id
        );

        return response()->json([
            'message' =>
                'Customer insurance membership updated successfully.',
            'tenant' => $this->tenantPayload($tenant),
            'membership' => $this->serializeMembership(
                $customerInsuranceMembership
            ),
        ]);
    }

    public function checkEligibility(
        Request $request,
        CustomerInsuranceMembership $customerInsuranceMembership,
        InsuranceEligibilityService $eligibilityService,
        AuditLogService $auditLogService,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        $tenant = $request->attributes->get('tenant');

        abort_unless(
            (int) $customerInsuranceMembership->tenant_id ===
                (int) $tenant->id,
            404
        );

        $validated = $request->validate([
            'service_date' => ['nullable', 'date'],
        ]);

        $result = $eligibilityService->evaluate(
            membership: $customerInsuranceMembership,
            serviceDate: $validated['service_date'] ?? null,
            checkedBy: $request->user()->id
        );

        $scope = $scopeResolver->resolveForUser($request->user());

        $auditLogService->record(
            action:
                'pharmaco.insurance_membership.eligibility_checked',
            scope: $scope,
            metadata: [
                'tenant_slug' => $tenant->slug,
                'membership_id' =>
                    $customerInsuranceMembership->id,
                'customer_id' =>
                    $customerInsuranceMembership->customer_id,
                'service_date' => $result['service_date'],
                'eligible' => $result['eligible'],
                'reason_codes' => collect($result['reasons'])
                    ->pluck('code')
                    ->values()
                    ->all(),
            ],
            dataClassification: 'confidential',
            auditableType: CustomerInsuranceMembership::class,
            auditableId: $customerInsuranceMembership->id
        );

        $customerInsuranceMembership->refresh()->load([
            'customer',
            'partner',
            'scheme',
            'institution',
        ]);

        return response()->json([
            'message' => $result['eligible']
                ? 'Insurance membership is eligible.'
                : 'Insurance membership is not eligible.',
            'tenant' => $this->tenantPayload($tenant),
            'eligibility' => $result,
            'membership' => $this->serializeMembership(
                $customerInsuranceMembership
            ),
        ]);
    }

    private function membershipRules(
        int $tenantId,
        int $partnerId,
        ?CustomerInsuranceMembership $membership = null,
        bool $partial = false
    ): array {
        $required = $partial ? 'sometimes' : 'required';

        $memberNumberRule = Rule::unique(
            'customer_insurance_memberships',
            'member_number'
        )
            ->where('tenant_id', $tenantId)
            ->where('insurance_partner_id', $partnerId);

        if ($membership) {
            $memberNumberRule->ignore($membership->id);
        }

        return [
            'customer_id' => [
                $required,
                'integer',
                Rule::exists('pharmaco_customers', 'id')
                    ->where(
                        fn ($query) =>
                            $query->where('tenant_id', $tenantId)
                    ),
            ],
            'insurance_partner_id' => [
                $required,
                'integer',
                Rule::exists('insurance_partners', 'id')
                    ->where(
                        fn ($query) =>
                            $query->where('tenant_id', $tenantId)
                    ),
            ],
            'insurance_scheme_id' => [
                $required,
                'integer',
                Rule::exists('insurance_schemes', 'id')
                    ->where(
                        fn ($query) =>
                            $query->where('tenant_id', $tenantId)
                    ),
            ],
            'insurance_institution_id' => [
                'nullable',
                'integer',
                Rule::exists('insurance_institutions', 'id')
                    ->where(
                        fn ($query) =>
                            $query->where('tenant_id', $tenantId)
                    ),
            ],
            'member_number' => [
                $required,
                'string',
                'max:120',
                $memberNumberRule,
            ],
            'policy_number' => [
                'nullable',
                'string',
                'max:120',
            ],
            'principal_member_number' => [
                'nullable',
                'string',
                'max:120',
            ],
            'relationship_to_principal' => [
                'nullable',
                'string',
                'max:50',
            ],
            'coverage_from' => ['nullable', 'date'],
            'coverage_to' => [
                'nullable',
                'date',
                'after_or_equal:coverage_from',
            ],
            'verification_status' => [
                $partial ? 'sometimes' : 'nullable',
                Rule::in([
                    'pending',
                    'verified',
                    'rejected',
                    'expired',
                ]),
            ],
            'status' => [
                $partial ? 'sometimes' : 'nullable',
                Rule::in([
                    'active',
                    'inactive',
                    'suspended',
                    'expired',
                ]),
            ],
            'metadata' => ['nullable', 'array'],
        ];
    }

    private function validateInsuranceScope(
        int $tenantId,
        array $data
    ): void {
        $partner = InsurancePartner::query()
            ->where('tenant_id', $tenantId)
            ->findOrFail($data['insurance_partner_id']);

        $scheme = InsuranceScheme::query()
            ->where('tenant_id', $tenantId)
            ->findOrFail($data['insurance_scheme_id']);

        if (
            (int) $scheme->insurance_partner_id !==
            (int) $partner->id
        ) {
            throw ValidationException::withMessages([
                'insurance_scheme_id' =>
                    'The selected scheme does not belong to the selected partner.',
            ]);
        }

        if (!empty($data['insurance_institution_id'])) {
            $institution = InsuranceInstitution::query()
                ->where('tenant_id', $tenantId)
                ->findOrFail(
                    $data['insurance_institution_id']
                );

            if (
                (int) $institution->insurance_partner_id !==
                (int) $partner->id
            ) {
                throw ValidationException::withMessages([
                    'insurance_institution_id' =>
                        'The selected institution does not belong to the selected partner.',
                ]);
            }

            if (
                $scheme->insurance_institution_id &&
                (int) $scheme->insurance_institution_id !==
                    (int) $institution->id
            ) {
                throw ValidationException::withMessages([
                    'insurance_institution_id' =>
                        'The selected institution does not match the selected scheme.',
                ]);
            }
        }
    }

    private function serializeMembership(
        CustomerInsuranceMembership $membership
    ): array {
        $customerName = trim(
            ($membership->customer?->first_name ?? '') .
            ' ' .
            ($membership->customer?->last_name ?? '')
        );

        return [
            'id' => $membership->id,
            'uuid' => $membership->uuid,
            'customer_id' => $membership->customer_id,
            'insurance_partner_id' =>
                $membership->insurance_partner_id,
            'insurance_scheme_id' =>
                $membership->insurance_scheme_id,
            'insurance_institution_id' =>
                $membership->insurance_institution_id,
            'member_number' => $membership->member_number,
            'policy_number' => $membership->policy_number,
            'principal_member_number' =>
                $membership->principal_member_number,
            'relationship_to_principal' =>
                $membership->relationship_to_principal,
            'coverage_from' =>
                $membership->coverage_from?->toDateString(),
            'coverage_to' =>
                $membership->coverage_to?->toDateString(),
            'verification_status' =>
                $membership->verification_status,
            'verified_at' =>
                $membership->verified_at?->toISOString(),
            'verified_by' => $membership->verified_by,
            'status' => $membership->status,
            'eligibility_response' =>
                $membership->eligibility_response,
            'metadata' => $membership->metadata ?? [],
            'customer' => $membership->customer
                ? [
                    'id' => $membership->customer->id,
                    'name' => $customerName,
                    'first_name' =>
                        $membership->customer->first_name,
                    'last_name' =>
                        $membership->customer->last_name,
                    'phone' => $membership->customer->phone,
                    'email' => $membership->customer->email,
                    'status' => $membership->customer->status,
                ]
                : null,
            'partner' => $membership->partner
                ? [
                    'id' => $membership->partner->id,
                    'code' => $membership->partner->code,
                    'name' => $membership->partner->name,
                    'status' => $membership->partner->status,
                ]
                : null,
            'scheme' => $membership->scheme
                ? [
                    'id' => $membership->scheme->id,
                    'code' => $membership->scheme->code,
                    'name' => $membership->scheme->name,
                    'status' => $membership->scheme->status,
                ]
                : null,
            'institution' => $membership->institution
                ? [
                    'id' => $membership->institution->id,
                    'code' => $membership->institution->code,
                    'name' => $membership->institution->name,
                    'status' =>
                        $membership->institution->status,
                ]
                : null,
            'created_at' =>
                $membership->created_at?->toISOString(),
            'updated_at' =>
                $membership->updated_at?->toISOString(),
        ];
    }

    private function paginationPayload($paginator): array
    {
        return [
            'current_page' => $paginator->currentPage(),
            'per_page' => $paginator->perPage(),
            'total' => $paginator->total(),
            'last_page' => $paginator->lastPage(),
            'from' => $paginator->firstItem(),
            'to' => $paginator->lastItem(),
        ];
    }

    private function tenantPayload($tenant): array
    {
        return [
            'id' => $tenant->id,
            'name' => $tenant->name,
            'slug' => $tenant->slug,
        ];
    }
}
