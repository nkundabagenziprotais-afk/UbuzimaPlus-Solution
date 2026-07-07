<?php

namespace App\Http\Controllers\Api\V1\PharmaCo360;

use App\Http\Controllers\Controller;
use App\Models\InsuranceContributionRule;
use App\Models\InsuranceInstitution;
use App\Models\InsurancePartner;
use App\Models\InsurancePriceList;
use App\Models\InsuranceProductPrice;
use App\Models\InsuranceScheme;
use App\Models\Product;
use App\Services\Access\ScopeResolver;
use App\Services\Audit\AuditLogService;
use App\Services\PharmaCo360\InsurancePricingResolver;
use App\Services\PharmaCo360\InsuranceTenantBootstrapService;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Response;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class InsuranceManagementController extends Controller
{
    public function bootstrap(
        Request $request,
        InsuranceTenantBootstrapService $bootstrapService,
        AuditLogService $auditLogService,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        $tenant = $request->attributes->get('tenant');

        $result = $bootstrapService->bootstrap($tenant);

        $scope = $scopeResolver->resolveForUser($request->user());

        $auditLogService->record(
            action: 'pharmaco.insurance.bootstrap.completed',
            scope: $scope,
            metadata: [
                'tenant_slug' => $tenant->slug,
                'partner_count' => $result['partner_count'],
                'partner_codes' => collect($result['partners'])
                    ->pluck('partner_code')
                    ->values()
                    ->all(),
            ],
            dataClassification: 'internal',
            auditableType: \App\Models\Tenant::class,
            auditableId: $tenant->id
        );

        return response()->json([
            'message' => 'Insurance management defaults initialized successfully.',
            'tenant' => $this->tenantPayload($tenant),
            'bootstrap' => $result,
        ]);
    }

    public function partners(Request $request): JsonResponse
    {
        $tenant = $request->attributes->get('tenant');

        $perPage = min(
            max((int) $request->query('per_page', 25), 1),
            200
        );

        $query = InsurancePartner::query()
            ->where('tenant_id', $tenant->id)
            ->withCount([
                'institutions',
                'schemes',
                'priceLists',
                'claims',
            ])
            ->when(
                $request->query('status'),
                fn ($query, $status) =>
                    $status === 'all'
                        ? $query
                        : $query->where('status', $status)
            )
            ->when(
                $request->query('partner_type'),
                fn ($query, $type) =>
                    $query->where('partner_type', $type)
            )
            ->when(
                $request->query('search'),
                function ($query, $search): void {
                    $term = '%' . trim((string) $search) . '%';

                    $query->where(function ($searchQuery) use ($term): void {
                        $searchQuery
                            ->where('name', 'like', $term)
                            ->orWhere('code', 'like', $term)
                            ->orWhere('registration_number', 'like', $term)
                            ->orWhere('contact_name', 'like', $term)
                            ->orWhere('contact_email', 'like', $term);
                    });
                }
            )
            ->orderByDesc('is_default')
            ->orderBy('name');

        $partners = $query->paginate($perPage);

        return response()->json([
            'tenant' => $this->tenantPayload($tenant),
            'partners' => collect($partners->items())
                ->map(
                    fn (InsurancePartner $partner) =>
                        $this->serializePartner($partner)
                )
                ->values(),
            'meta' => [
                'current_page' => $partners->currentPage(),
                'last_page' => $partners->lastPage(),
                'per_page' => $partners->perPage(),
                'total' => $partners->total(),
                'from' => $partners->firstItem(),
                'to' => $partners->lastItem(),
            ],
        ]);
    }

    public function createPartner(
        Request $request,
        AuditLogService $auditLogService,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        $tenant = $request->attributes->get('tenant');

        if ($request->filled('code')) {
            $request->merge([
                'code' => strtoupper(trim((string) $request->input('code'))),
            ]);
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:191'],
            'code' => [
                'required',
                'string',
                'max:80',
                Rule::unique('insurance_partners', 'code')
                    ->where('tenant_id', $tenant->id),
            ],
            'partner_type' => ['nullable', 'string', 'max:60'],
            'registration_number' => ['nullable', 'string', 'max:191'],
            'tax_identification_number' => ['nullable', 'string', 'max:191'],
            'contact_name' => ['nullable', 'string', 'max:191'],
            'contact_email' => ['nullable', 'email', 'max:191'],
            'contact_phone' => ['nullable', 'string', 'max:80'],
            'claims_email' => ['nullable', 'email', 'max:191'],
            'currency' => ['nullable', 'string', 'size:3'],
            'status' => [
                'nullable',
                Rule::in(['active', 'inactive', 'suspended']),
            ],
            'is_default' => ['nullable', 'boolean'],
            'integration_settings' => ['nullable', 'array'],
            'metadata' => ['nullable', 'array'],
        ]);

        if (($validated['is_default'] ?? false) === true) {
            InsurancePartner::query()
                ->where('tenant_id', $tenant->id)
                ->update(['is_default' => false]);
        }

        $partner = InsurancePartner::query()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $tenant->id,
            'name' => $validated['name'],
            'code' => $validated['code'],
            'partner_type' => $validated['partner_type'] ?? 'insurer',
            'registration_number' =>
                $validated['registration_number'] ?? null,
            'tax_identification_number' =>
                $validated['tax_identification_number'] ?? null,
            'contact_name' => $validated['contact_name'] ?? null,
            'contact_email' => $validated['contact_email'] ?? null,
            'contact_phone' => $validated['contact_phone'] ?? null,
            'claims_email' => $validated['claims_email'] ?? null,
            'currency' => strtoupper($validated['currency'] ?? 'RWF'),
            'status' => $validated['status'] ?? 'active',
            'is_default' => $validated['is_default'] ?? false,
            'integration_settings' =>
                $validated['integration_settings'] ?? null,
            'metadata' => array_merge(
                $validated['metadata'] ?? [],
                [
                    'created_from' =>
                        'pharmaco_insurance_management_api',
                ]
            ),
        ]);

        $scope = $scopeResolver->resolveForUser($request->user());

        $auditLogService->record(
            action: 'pharmaco.insurance_partner.created',
            scope: $scope,
            metadata: [
                'tenant_slug' => $tenant->slug,
                'partner_code' => $partner->code,
                'partner_name' => $partner->name,
            ],
            dataClassification: 'internal',
            auditableType: InsurancePartner::class,
            auditableId: $partner->id
        );

        return response()->json([
            'message' => 'Insurance partner created successfully.',
            'tenant' => $this->tenantPayload($tenant),
            'partner' => $this->serializePartner($partner),
        ], 201);
    }

    public function updatePartner(
        Request $request,
        InsurancePartner $insurancePartner,
        AuditLogService $auditLogService,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        $tenant = $request->attributes->get('tenant');

        abort_unless(
            (int) $insurancePartner->tenant_id === (int) $tenant->id,
            404
        );

        if ($request->filled('code')) {
            $request->merge([
                'code' => strtoupper(trim((string) $request->input('code'))),
            ]);
        }

        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:191'],
            'code' => [
                'sometimes',
                'string',
                'max:80',
                Rule::unique('insurance_partners', 'code')
                    ->where('tenant_id', $tenant->id)
                    ->ignore($insurancePartner->id),
            ],
            'partner_type' => ['sometimes', 'string', 'max:60'],
            'registration_number' => ['nullable', 'string', 'max:191'],
            'tax_identification_number' => ['nullable', 'string', 'max:191'],
            'contact_name' => ['nullable', 'string', 'max:191'],
            'contact_email' => ['nullable', 'email', 'max:191'],
            'contact_phone' => ['nullable', 'string', 'max:80'],
            'claims_email' => ['nullable', 'email', 'max:191'],
            'currency' => ['sometimes', 'string', 'size:3'],
            'status' => [
                'sometimes',
                Rule::in(['active', 'inactive', 'suspended']),
            ],
            'is_default' => ['sometimes', 'boolean'],
            'integration_settings' => ['nullable', 'array'],
            'metadata' => ['nullable', 'array'],
        ]);

        if (($validated['is_default'] ?? false) === true) {
            InsurancePartner::query()
                ->where('tenant_id', $tenant->id)
                ->whereKeyNot($insurancePartner->id)
                ->update(['is_default' => false]);
        }

        if (array_key_exists('currency', $validated)) {
            $validated['currency'] = strtoupper($validated['currency']);
        }

        if (array_key_exists('metadata', $validated)) {
            $validated['metadata'] = array_merge(
                $insurancePartner->metadata ?? [],
                $validated['metadata'] ?? []
            );
        }

        $before = $insurancePartner->only(
            array_keys($validated)
        );

        $insurancePartner->fill($validated);
        $insurancePartner->save();

        $scope = $scopeResolver->resolveForUser($request->user());

        $auditLogService->record(
            action: 'pharmaco.insurance_partner.updated',
            scope: $scope,
            metadata: [
                'tenant_slug' => $tenant->slug,
                'partner_code' => $insurancePartner->code,
                'before' => $before,
                'after' => $insurancePartner->only(
                    array_keys($validated)
                ),
            ],
            dataClassification: 'internal',
            auditableType: InsurancePartner::class,
            auditableId: $insurancePartner->id
        );

        return response()->json([
            'message' => 'Insurance partner updated successfully.',
            'tenant' => $this->tenantPayload($tenant),
            'partner' => $this->serializePartner($insurancePartner),
        ]);
    }

    public function schemes(Request $request): JsonResponse
    {
        $tenant = $request->attributes->get('tenant');

        $perPage = min(
            max((int) $request->query('per_page', 25), 1),
            200
        );

        $query = InsuranceScheme::query()
            ->with(['partner', 'institution'])
            ->where('tenant_id', $tenant->id)
            ->when(
                $request->query('insurance_partner_id'),
                fn ($query, $partnerId) =>
                    $query->where('insurance_partner_id', $partnerId)
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

                    $query->where(function ($searchQuery) use ($term): void {
                        $searchQuery
                            ->where('name', 'like', $term)
                            ->orWhere('code', 'like', $term)
                            ->orWhere('scheme_type', 'like', $term);
                    });
                }
            )
            ->orderBy('name');

        $schemes = $query->paginate($perPage);

        return response()->json([
            'tenant' => $this->tenantPayload($tenant),
            'schemes' => collect($schemes->items())
                ->map(
                    fn (InsuranceScheme $scheme) =>
                        $this->serializeScheme($scheme)
                )
                ->values(),
            'meta' => [
                'current_page' => $schemes->currentPage(),
                'last_page' => $schemes->lastPage(),
                'per_page' => $schemes->perPage(),
                'total' => $schemes->total(),
                'from' => $schemes->firstItem(),
                'to' => $schemes->lastItem(),
            ],
        ]);
    }

    public function createScheme(
        Request $request,
        AuditLogService $auditLogService,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        $tenant = $request->attributes->get('tenant');

        if ($request->filled('code')) {
            $request->merge([
                'code' => strtoupper(trim((string) $request->input('code'))),
            ]);
        }

        $validated = $request->validate([
            'insurance_partner_id' => [
                'required',
                'integer',
                Rule::exists('insurance_partners', 'id')
                    ->where(
                        fn ($query) =>
                            $query->where('tenant_id', $tenant->id)
                    ),
            ],
            'insurance_institution_id' => [
                'nullable',
                'integer',
                Rule::exists('insurance_institutions', 'id')
                    ->where(
                        fn ($query) =>
                            $query->where('tenant_id', $tenant->id)
                    ),
            ],
            'name' => ['required', 'string', 'max:191'],
            'code' => [
                'required',
                'string',
                'max:100',
                Rule::unique('insurance_schemes', 'code')
                    ->where(
                        fn ($query) => $query
                            ->where('tenant_id', $tenant->id)
                            ->where(
                                'insurance_partner_id',
                                $request->input('insurance_partner_id')
                            )
                    ),
            ],
            'scheme_type' => ['nullable', 'string', 'max:60'],
            'annual_limit' => ['nullable', 'numeric', 'min:0'],
            'per_visit_limit' => ['nullable', 'numeric', 'min:0'],
            'default_customer_contribution_percent' => [
                'required',
                'numeric',
                'min:0',
                'max:100',
            ],
            'default_insurer_contribution_percent' => [
                'required',
                'numeric',
                'min:0',
                'max:100',
            ],
            'effective_from' => ['nullable', 'date'],
            'effective_to' => [
                'nullable',
                'date',
                'after_or_equal:effective_from',
            ],
            'status' => [
                'nullable',
                Rule::in(['draft', 'active', 'inactive', 'suspended']),
            ],
            'coverage_settings' => ['nullable', 'array'],
            'metadata' => ['nullable', 'array'],
        ]);

        $totalContribution =
            (float) $validated['default_customer_contribution_percent']
            + (float) $validated['default_insurer_contribution_percent'];

        if (abs($totalContribution - 100) > 0.0001) {
            return response()->json([
                'message' => 'The customer and insurer contribution percentages must total 100.',
                'errors' => [
                    'default_insurer_contribution_percent' => [
                        'The total contribution percentage must equal 100.',
                    ],
                ],
            ], 422);
        }

        $scheme = InsuranceScheme::query()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $tenant->id,
            ...$validated,
            'scheme_type' => $validated['scheme_type'] ?? 'medical',
            'status' => $validated['status'] ?? 'active',
            'metadata' => array_merge(
                $validated['metadata'] ?? [],
                [
                    'created_from' =>
                        'pharmaco_insurance_management_api',
                ]
            ),
        ]);

        $scheme->load(['partner', 'institution']);

        $scope = $scopeResolver->resolveForUser($request->user());

        $auditLogService->record(
            action: 'pharmaco.insurance_scheme.created',
            scope: $scope,
            metadata: [
                'tenant_slug' => $tenant->slug,
                'scheme_code' => $scheme->code,
                'partner_id' => $scheme->insurance_partner_id,
            ],
            dataClassification: 'internal',
            auditableType: InsuranceScheme::class,
            auditableId: $scheme->id
        );

        return response()->json([
            'message' => 'Insurance scheme created successfully.',
            'tenant' => $this->tenantPayload($tenant),
            'scheme' => $this->serializeScheme($scheme),
        ], 201);
    }

    public function institutions(Request $request): JsonResponse
    {
        $tenant = $request->attributes->get('tenant');

        $perPage = min(
            max((int) $request->query('per_page', 25), 1),
            200
        );

        $query = InsuranceInstitution::query()
            ->with('partner')
            ->where('tenant_id', $tenant->id)
            ->when(
                $request->query('insurance_partner_id'),
                fn ($query, $partnerId) =>
                    $query->where('insurance_partner_id', $partnerId)
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

                    $query->where(function ($searchQuery) use ($term): void {
                        $searchQuery
                            ->where('name', 'like', $term)
                            ->orWhere('code', 'like', $term)
                            ->orWhere('registration_number', 'like', $term)
                            ->orWhere('contact_name', 'like', $term)
                            ->orWhere('contact_email', 'like', $term);
                    });
                }
            )
            ->orderBy('name');

        $institutions = $query->paginate($perPage);

        return response()->json([
            'tenant' => $this->tenantPayload($tenant),
            'institutions' => collect($institutions->items())
                ->map(
                    fn (InsuranceInstitution $institution) =>
                        $this->serializeInstitution($institution)
                )
                ->values(),
            'meta' => $this->paginationPayload($institutions),
        ]);
    }

    public function createInstitution(
        Request $request,
        AuditLogService $auditLogService,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        $tenant = $request->attributes->get('tenant');

        if ($request->filled('code')) {
            $request->merge([
                'code' => strtoupper(trim((string) $request->input('code'))),
            ]);
        }

        $validated = $request->validate([
            'insurance_partner_id' => [
                'required',
                'integer',
                Rule::exists('insurance_partners', 'id')
                    ->where(
                        fn ($query) =>
                            $query->where('tenant_id', $tenant->id)
                    ),
            ],
            'name' => ['required', 'string', 'max:191'],
            'code' => [
                'required',
                'string',
                'max:100',
                Rule::unique('insurance_institutions', 'code')
                    ->where(
                        fn ($query) => $query
                            ->where('tenant_id', $tenant->id)
                            ->where(
                                'insurance_partner_id',
                                $request->input('insurance_partner_id')
                            )
                    ),
            ],
            'institution_type' => ['nullable', 'string', 'max:60'],
            'registration_number' => ['nullable', 'string', 'max:191'],
            'contact_name' => ['nullable', 'string', 'max:191'],
            'contact_email' => ['nullable', 'email', 'max:191'],
            'contact_phone' => ['nullable', 'string', 'max:80'],
            'status' => [
                'nullable',
                Rule::in(['active', 'inactive', 'suspended']),
            ],
            'metadata' => ['nullable', 'array'],
        ]);

        $institution = InsuranceInstitution::query()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $tenant->id,
            'insurance_partner_id' =>
                $validated['insurance_partner_id'],
            'name' => $validated['name'],
            'code' => $validated['code'],
            'institution_type' =>
                $validated['institution_type'] ?? 'employer',
            'registration_number' =>
                $validated['registration_number'] ?? null,
            'contact_name' => $validated['contact_name'] ?? null,
            'contact_email' => $validated['contact_email'] ?? null,
            'contact_phone' => $validated['contact_phone'] ?? null,
            'status' => $validated['status'] ?? 'active',
            'metadata' => array_merge(
                $validated['metadata'] ?? [],
                [
                    'created_from' =>
                        'pharmaco_insurance_management_api',
                ]
            ),
        ]);

        $institution->load('partner');

        $this->recordAudit(
            request: $request,
            auditLogService: $auditLogService,
            scopeResolver: $scopeResolver,
            action: 'pharmaco.insurance_institution.created',
            auditableType: InsuranceInstitution::class,
            auditableId: $institution->id,
            metadata: [
                'institution_code' => $institution->code,
                'partner_id' => $institution->insurance_partner_id,
            ]
        );

        return response()->json([
            'message' => 'Insurance institution created successfully.',
            'tenant' => $this->tenantPayload($tenant),
            'institution' =>
                $this->serializeInstitution($institution),
        ], 201);
    }

    public function updateInstitution(
        Request $request,
        InsuranceInstitution $insuranceInstitution,
        AuditLogService $auditLogService,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        $tenant = $request->attributes->get('tenant');

        abort_unless(
            (int) $insuranceInstitution->tenant_id === (int) $tenant->id,
            404
        );

        if ($request->filled('code')) {
            $request->merge([
                'code' => strtoupper(trim((string) $request->input('code'))),
            ]);
        }

        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:191'],
            'code' => [
                'sometimes',
                'string',
                'max:100',
                Rule::unique('insurance_institutions', 'code')
                    ->where(
                        fn ($query) => $query
                            ->where('tenant_id', $tenant->id)
                            ->where(
                                'insurance_partner_id',
                                $insuranceInstitution->insurance_partner_id
                            )
                    )
                    ->ignore($insuranceInstitution->id),
            ],
            'institution_type' => ['sometimes', 'string', 'max:60'],
            'registration_number' => ['nullable', 'string', 'max:191'],
            'contact_name' => ['nullable', 'string', 'max:191'],
            'contact_email' => ['nullable', 'email', 'max:191'],
            'contact_phone' => ['nullable', 'string', 'max:80'],
            'status' => [
                'sometimes',
                Rule::in(['active', 'inactive', 'suspended']),
            ],
            'metadata' => ['nullable', 'array'],
        ]);

        if (array_key_exists('metadata', $validated)) {
            $validated['metadata'] = array_merge(
                $insuranceInstitution->metadata ?? [],
                $validated['metadata'] ?? []
            );
        }

        $before = $insuranceInstitution->only(array_keys($validated));

        $insuranceInstitution->fill($validated);
        $insuranceInstitution->save();
        $insuranceInstitution->load('partner');

        $this->recordAudit(
            request: $request,
            auditLogService: $auditLogService,
            scopeResolver: $scopeResolver,
            action: 'pharmaco.insurance_institution.updated',
            auditableType: InsuranceInstitution::class,
            auditableId: $insuranceInstitution->id,
            metadata: [
                'institution_code' =>
                    $insuranceInstitution->code,
                'before' => $before,
                'after' => $insuranceInstitution->only(
                    array_keys($validated)
                ),
            ]
        );

        return response()->json([
            'message' => 'Insurance institution updated successfully.',
            'tenant' => $this->tenantPayload($tenant),
            'institution' =>
                $this->serializeInstitution($insuranceInstitution),
        ]);
    }

    public function updateScheme(
        Request $request,
        InsuranceScheme $insuranceScheme,
        AuditLogService $auditLogService,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        $tenant = $request->attributes->get('tenant');

        abort_unless(
            (int) $insuranceScheme->tenant_id === (int) $tenant->id,
            404
        );

        if ($request->filled('code')) {
            $request->merge([
                'code' => strtoupper(trim((string) $request->input('code'))),
            ]);
        }

        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:191'],
            'code' => [
                'sometimes',
                'string',
                'max:100',
                Rule::unique('insurance_schemes', 'code')
                    ->where(
                        fn ($query) => $query
                            ->where('tenant_id', $tenant->id)
                            ->where(
                                'insurance_partner_id',
                                $insuranceScheme->insurance_partner_id
                            )
                    )
                    ->ignore($insuranceScheme->id),
            ],
            'insurance_institution_id' => [
                'nullable',
                'integer',
                Rule::exists('insurance_institutions', 'id')
                    ->where(
                        fn ($query) => $query
                            ->where('tenant_id', $tenant->id)
                            ->where(
                                'insurance_partner_id',
                                $insuranceScheme->insurance_partner_id
                            )
                    ),
            ],
            'scheme_type' => ['sometimes', 'string', 'max:60'],
            'annual_limit' => ['nullable', 'numeric', 'min:0'],
            'per_visit_limit' => ['nullable', 'numeric', 'min:0'],
            'default_customer_contribution_percent' => [
                'sometimes',
                'numeric',
                'min:0',
                'max:100',
            ],
            'default_insurer_contribution_percent' => [
                'sometimes',
                'numeric',
                'min:0',
                'max:100',
            ],
            'effective_from' => ['nullable', 'date'],
            'effective_to' => ['nullable', 'date'],
            'status' => [
                'sometimes',
                Rule::in(['draft', 'active', 'inactive', 'suspended']),
            ],
            'coverage_settings' => ['nullable', 'array'],
            'metadata' => ['nullable', 'array'],
        ]);

        $customerPercent = array_key_exists(
            'default_customer_contribution_percent',
            $validated
        )
            ? (float) $validated[
                'default_customer_contribution_percent'
            ]
            : (float)
                $insuranceScheme
                    ->default_customer_contribution_percent;

        $insurerPercent = array_key_exists(
            'default_insurer_contribution_percent',
            $validated
        )
            ? (float) $validated[
                'default_insurer_contribution_percent'
            ]
            : (float)
                $insuranceScheme
                    ->default_insurer_contribution_percent;

        if (abs(($customerPercent + $insurerPercent) - 100) > 0.0001) {
            return response()->json([
                'message' =>
                    'The customer and insurer contribution percentages must total 100.',
                'errors' => [
                    'default_insurer_contribution_percent' => [
                        'The total contribution percentage must equal 100.',
                    ],
                ],
            ], 422);
        }

        if (
            isset($validated['effective_from'])
            && isset($validated['effective_to'])
            && $validated['effective_to']
                < $validated['effective_from']
        ) {
            return response()->json([
                'message' => 'The effective-to date must be on or after the effective-from date.',
                'errors' => [
                    'effective_to' => [
                        'The effective-to date is invalid.',
                    ],
                ],
            ], 422);
        }

        if (array_key_exists('metadata', $validated)) {
            $validated['metadata'] = array_merge(
                $insuranceScheme->metadata ?? [],
                $validated['metadata'] ?? []
            );
        }

        $before = $insuranceScheme->only(array_keys($validated));

        $insuranceScheme->fill($validated);
        $insuranceScheme->save();
        $insuranceScheme->load(['partner', 'institution']);

        $this->recordAudit(
            request: $request,
            auditLogService: $auditLogService,
            scopeResolver: $scopeResolver,
            action: 'pharmaco.insurance_scheme.updated',
            auditableType: InsuranceScheme::class,
            auditableId: $insuranceScheme->id,
            metadata: [
                'scheme_code' => $insuranceScheme->code,
                'before' => $before,
                'after' => $insuranceScheme->only(
                    array_keys($validated)
                ),
            ]
        );

        return response()->json([
            'message' => 'Insurance scheme updated successfully.',
            'tenant' => $this->tenantPayload($tenant),
            'scheme' => $this->serializeScheme($insuranceScheme),
        ]);
    }

    public function priceLists(Request $request): JsonResponse
    {
        $tenant = $request->attributes->get('tenant');

        $perPage = min(
            max((int) $request->query('per_page', 25), 1),
            200
        );

        $query = InsurancePriceList::query()
            ->with(['partner', 'scheme'])
            ->withCount('productPrices')
            ->where('tenant_id', $tenant->id)
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

                    $query->where(function ($searchQuery) use ($term): void {
                        $searchQuery
                            ->where('name', 'like', $term)
                            ->orWhere('code', 'like', $term);
                    });
                }
            )
            ->orderBy('priority')
            ->orderByDesc('effective_from');

        $priceLists = $query->paginate($perPage);

        return response()->json([
            'tenant' => $this->tenantPayload($tenant),
            'price_lists' => collect($priceLists->items())
                ->map(
                    fn (InsurancePriceList $priceList) =>
                        $this->serializePriceList($priceList)
                )
                ->values(),
            'meta' => $this->paginationPayload($priceLists),
        ]);
    }

    public function createPriceList(
        Request $request,
        AuditLogService $auditLogService,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        $tenant = $request->attributes->get('tenant');

        if ($request->filled('code')) {
            $request->merge([
                'code' => strtoupper(trim((string) $request->input('code'))),
            ]);
        }

        $validated = $request->validate([
            'insurance_partner_id' => [
                'required',
                'integer',
                Rule::exists('insurance_partners', 'id')
                    ->where(
                        fn ($query) =>
                            $query->where('tenant_id', $tenant->id)
                    ),
            ],
            'insurance_scheme_id' => [
                'nullable',
                'integer',
                Rule::exists('insurance_schemes', 'id')
                    ->where(
                        fn ($query) =>
                            $query->where('tenant_id', $tenant->id)
                    ),
            ],
            'name' => ['required', 'string', 'max:191'],
            'code' => [
                'required',
                'string',
                'max:100',
                Rule::unique('insurance_price_lists', 'code')
                    ->where(
                        fn ($query) => $query
                            ->where('tenant_id', $tenant->id)
                            ->where(
                                'insurance_partner_id',
                                $request->input('insurance_partner_id')
                            )
                    ),
            ],
            'currency' => ['nullable', 'string', 'size:3'],
            'effective_from' => ['required', 'date'],
            'effective_to' => [
                'nullable',
                'date',
                'after_or_equal:effective_from',
            ],
            'priority' => ['nullable', 'integer', 'min:1'],
            'status' => [
                'nullable',
                Rule::in(['draft', 'active', 'inactive', 'expired']),
            ],
            'is_default' => ['nullable', 'boolean'],
            'metadata' => ['nullable', 'array'],
        ]);

        if (! empty($validated['insurance_scheme_id'])) {
            $scheme = InsuranceScheme::query()
                ->where('tenant_id', $tenant->id)
                ->where(
                    'insurance_partner_id',
                    $validated['insurance_partner_id']
                )
                ->find($validated['insurance_scheme_id']);

            if (! $scheme) {
                return response()->json([
                    'message' =>
                        'The selected scheme does not belong to the selected insurance partner.',
                    'errors' => [
                        'insurance_scheme_id' => [
                            'The selected scheme is invalid.',
                        ],
                    ],
                ], 422);
            }
        }

        if (($validated['is_default'] ?? false) === true) {
            InsurancePriceList::query()
                ->where('tenant_id', $tenant->id)
                ->where(
                    'insurance_partner_id',
                    $validated['insurance_partner_id']
                )
                ->update(['is_default' => false]);
        }

        $priceList = InsurancePriceList::query()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $tenant->id,
            'insurance_partner_id' =>
                $validated['insurance_partner_id'],
            'insurance_scheme_id' =>
                $validated['insurance_scheme_id'] ?? null,
            'name' => $validated['name'],
            'code' => $validated['code'],
            'currency' => strtoupper($validated['currency'] ?? 'RWF'),
            'effective_from' => $validated['effective_from'],
            'effective_to' => $validated['effective_to'] ?? null,
            'priority' => $validated['priority'] ?? 100,
            'status' => $validated['status'] ?? 'draft',
            'is_default' => $validated['is_default'] ?? false,
            'metadata' => array_merge(
                $validated['metadata'] ?? [],
                [
                    'created_from' =>
                        'pharmaco_insurance_management_api',
                ]
            ),
        ]);

        $priceList->load(['partner', 'scheme']);

        $this->recordAudit(
            request: $request,
            auditLogService: $auditLogService,
            scopeResolver: $scopeResolver,
            action: 'pharmaco.insurance_price_list.created',
            auditableType: InsurancePriceList::class,
            auditableId: $priceList->id,
            metadata: [
                'price_list_code' => $priceList->code,
                'partner_id' => $priceList->insurance_partner_id,
            ]
        );

        return response()->json([
            'message' => 'Insurance price list created successfully.',
            'tenant' => $this->tenantPayload($tenant),
            'price_list' => $this->serializePriceList($priceList),
        ], 201);
    }

    public function updatePriceList(
        Request $request,
        InsurancePriceList $insurancePriceList,
        AuditLogService $auditLogService,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        $tenant = $request->attributes->get('tenant');

        abort_unless(
            (int) $insurancePriceList->tenant_id === (int) $tenant->id,
            404
        );

        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:191'],
            'currency' => ['sometimes', 'string', 'size:3'],
            'effective_from' => ['sometimes', 'date'],
            'effective_to' => ['nullable', 'date'],
            'priority' => ['sometimes', 'integer', 'min:1'],
            'status' => [
                'sometimes',
                Rule::in(['draft', 'active', 'inactive', 'expired']),
            ],
            'is_default' => ['sometimes', 'boolean'],
            'metadata' => ['nullable', 'array'],
        ]);

        if (
            isset($validated['effective_from'])
            && isset($validated['effective_to'])
            && $validated['effective_to']
                < $validated['effective_from']
        ) {
            return response()->json([
                'message' => 'The effective-to date must be on or after the effective-from date.',
                'errors' => [
                    'effective_to' => [
                        'The effective-to date is invalid.',
                    ],
                ],
            ], 422);
        }

        if (($validated['is_default'] ?? false) === true) {
            InsurancePriceList::query()
                ->where('tenant_id', $tenant->id)
                ->where(
                    'insurance_partner_id',
                    $insurancePriceList->insurance_partner_id
                )
                ->whereKeyNot($insurancePriceList->id)
                ->update(['is_default' => false]);
        }

        if (array_key_exists('currency', $validated)) {
            $validated['currency'] = strtoupper($validated['currency']);
        }

        if (array_key_exists('metadata', $validated)) {
            $validated['metadata'] = array_merge(
                $insurancePriceList->metadata ?? [],
                $validated['metadata'] ?? []
            );
        }

        $before = $insurancePriceList->only(array_keys($validated));

        $insurancePriceList->fill($validated);
        $insurancePriceList->save();
        $insurancePriceList->load(['partner', 'scheme']);

        $this->recordAudit(
            request: $request,
            auditLogService: $auditLogService,
            scopeResolver: $scopeResolver,
            action: 'pharmaco.insurance_price_list.updated',
            auditableType: InsurancePriceList::class,
            auditableId: $insurancePriceList->id,
            metadata: [
                'price_list_code' => $insurancePriceList->code,
                'before' => $before,
                'after' => $insurancePriceList->only(
                    array_keys($validated)
                ),
            ]
        );

        return response()->json([
            'message' => 'Insurance price list updated successfully.',
            'tenant' => $this->tenantPayload($tenant),
            'price_list' =>
                $this->serializePriceList($insurancePriceList),
        ]);
    }

    public function productPrices(Request $request): JsonResponse
    {
        $tenant = $request->attributes->get('tenant');

        $perPage = min(
            max((int) $request->query('per_page', 25), 1),
            500
        );

        $query = InsuranceProductPrice::query()
            ->with(['priceList', 'product'])
            ->where('tenant_id', $tenant->id)
            ->when(
                $request->query('insurance_price_list_id'),
                fn ($query, $priceListId) =>
                    $query->where(
                        'insurance_price_list_id',
                        $priceListId
                    )
            )
            ->when(
                $request->query('coverage_status'),
                fn ($query, $status) =>
                    $query->where('coverage_status', $status)
            )
            ->when(
                $request->query('search'),
                function ($query, $search): void {
                    $term = '%' . trim((string) $search) . '%';

                    $query->whereHas(
                        'product',
                        fn ($productQuery) => $productQuery
                            ->where('name', 'like', $term)
                            ->orWhere('sku', 'like', $term)
                    );
                }
            )
            ->orderBy('product_id');

        $productPrices = $query->paginate($perPage);

        return response()->json([
            'tenant' => $this->tenantPayload($tenant),
            'product_prices' => collect($productPrices->items())
                ->map(
                    fn (InsuranceProductPrice $productPrice) =>
                        $this->serializeProductPrice($productPrice)
                )
                ->values(),
            'meta' => $this->paginationPayload($productPrices),
        ]);
    }

    public function upsertProductPrice(
        Request $request,
        AuditLogService $auditLogService,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        $tenant = $request->attributes->get('tenant');

        $validated = $request->validate([
            'insurance_price_list_id' => [
                'required',
                'integer',
                Rule::exists('insurance_price_lists', 'id')
                    ->where(
                        fn ($query) =>
                            $query->where('tenant_id', $tenant->id)
                    ),
            ],
            'product_id' => [
                'required',
                'integer',
                Rule::exists('products', 'id')
                    ->where(
                        fn ($query) =>
                            $query->where('tenant_id', $tenant->id)
                    ),
            ],
            'agreed_unit_price' => ['required', 'numeric', 'min:0'],
            'maximum_claimable_price' => [
                'nullable',
                'numeric',
                'min:0',
            ],
            'customer_contribution_percent' => [
                'nullable',
                'numeric',
                'min:0',
                'max:100',
            ],
            'insurer_contribution_percent' => [
                'nullable',
                'numeric',
                'min:0',
                'max:100',
            ],
            'requires_pre_authorization' => ['nullable', 'boolean'],
            'is_covered' => ['nullable', 'boolean'],
            'coverage_status' => [
                'nullable',
                Rule::in([
                    'covered',
                    'not_covered',
                    'restricted',
                    'requires_pre_authorization',
                ]),
            ],
            'restrictions' => ['nullable', 'array'],
            'metadata' => ['nullable', 'array'],
        ]);

        $this->validateOptionalContributionTotal($validated);

        $existing = InsuranceProductPrice::query()
            ->where('tenant_id', $tenant->id)
            ->where(
                'insurance_price_list_id',
                $validated['insurance_price_list_id']
            )
            ->where('product_id', $validated['product_id'])
            ->first();

        $productPrice = InsuranceProductPrice::query()->updateOrCreate(
            [
                'tenant_id' => $tenant->id,
                'insurance_price_list_id' =>
                    $validated['insurance_price_list_id'],
                'product_id' => $validated['product_id'],
            ],
            [
                'uuid' => $existing?->uuid ?? (string) Str::uuid(),
                'agreed_unit_price' =>
                    $validated['agreed_unit_price'],
                'maximum_claimable_price' =>
                    $validated['maximum_claimable_price'] ?? null,
                'customer_contribution_percent' =>
                    $validated[
                        'customer_contribution_percent'
                    ] ?? null,
                'insurer_contribution_percent' =>
                    $validated[
                        'insurer_contribution_percent'
                    ] ?? null,
                'requires_pre_authorization' =>
                    $validated[
                        'requires_pre_authorization'
                    ] ?? false,
                'is_covered' => $validated['is_covered'] ?? true,
                'coverage_status' =>
                    $validated['coverage_status'] ?? 'covered',
                'restrictions' =>
                    $validated['restrictions'] ?? null,
                'metadata' => array_merge(
                    $existing?->metadata ?? [],
                    $validated['metadata'] ?? []
                ),
            ]
        );

        $productPrice->load(['priceList', 'product']);

        $this->recordAudit(
            request: $request,
            auditLogService: $auditLogService,
            scopeResolver: $scopeResolver,
            action: $existing
                ? 'pharmaco.insurance_product_price.updated'
                : 'pharmaco.insurance_product_price.created',
            auditableType: InsuranceProductPrice::class,
            auditableId: $productPrice->id,
            metadata: [
                'price_list_id' =>
                    $productPrice->insurance_price_list_id,
                'product_id' => $productPrice->product_id,
            ]
        );

        return response()->json([
            'message' => $existing
                ? 'Insurance product price updated successfully.'
                : 'Insurance product price created successfully.',
            'tenant' => $this->tenantPayload($tenant),
            'product_price' =>
                $this->serializeProductPrice($productPrice),
        ], $existing ? 200 : 201);
    }

    public function contributionRules(Request $request): JsonResponse
    {
        $tenant = $request->attributes->get('tenant');

        $perPage = min(
            max((int) $request->query('per_page', 25), 1),
            200
        );

        $query = InsuranceContributionRule::query()
            ->with(['partner'])
            ->where('tenant_id', $tenant->id)
            ->when(
                $request->query('insurance_partner_id'),
                fn ($query, $partnerId) =>
                    $query->where('insurance_partner_id', $partnerId)
            )
            ->when(
                $request->query('rule_scope'),
                fn ($query, $scope) =>
                    $query->where('rule_scope', $scope)
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
                    $query->where('rule_name', 'like', $term);
                }
            )
            ->orderBy('priority')
            ->orderBy('rule_name');

        $rules = $query->paginate($perPage);

        return response()->json([
            'tenant' => $this->tenantPayload($tenant),
            'contribution_rules' => collect($rules->items())
                ->map(
                    fn (InsuranceContributionRule $rule) =>
                        $this->serializeContributionRule($rule)
                )
                ->values(),
            'meta' => $this->paginationPayload($rules),
        ]);
    }

    public function createContributionRule(
        Request $request,
        AuditLogService $auditLogService,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        $tenant = $request->attributes->get('tenant');

        $validated = $this->validateContributionRuleRequest(
            $request,
            $tenant->id
        );

        $rule = InsuranceContributionRule::query()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $tenant->id,
            ...$validated,
            'priority' => $validated['priority'] ?? 100,
            'status' => $validated['status'] ?? 'active',
        ]);

        $rule->load('partner');

        $this->recordAudit(
            request: $request,
            auditLogService: $auditLogService,
            scopeResolver: $scopeResolver,
            action: 'pharmaco.insurance_contribution_rule.created',
            auditableType: InsuranceContributionRule::class,
            auditableId: $rule->id,
            metadata: [
                'rule_name' => $rule->rule_name,
                'rule_scope' => $rule->rule_scope,
            ]
        );

        return response()->json([
            'message' => 'Insurance contribution rule created successfully.',
            'tenant' => $this->tenantPayload($tenant),
            'contribution_rule' =>
                $this->serializeContributionRule($rule),
        ], 201);
    }

    public function updateContributionRule(
        Request $request,
        InsuranceContributionRule $insuranceContributionRule,
        AuditLogService $auditLogService,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        $tenant = $request->attributes->get('tenant');

        abort_unless(
            (int) $insuranceContributionRule->tenant_id
                === (int) $tenant->id,
            404
        );

        $validated = $this->validateContributionRuleRequest(
            $request,
            $tenant->id,
            partial: true
        );

        $merged = array_merge(
            $insuranceContributionRule->toArray(),
            $validated
        );

        $this->validateContributionScope($merged);
        $this->validateOptionalContributionTotal($merged);

        if (array_key_exists('metadata', $validated)) {
            $validated['metadata'] = array_merge(
                $insuranceContributionRule->metadata ?? [],
                $validated['metadata'] ?? []
            );
        }

        $before = $insuranceContributionRule->only(
            array_keys($validated)
        );

        $insuranceContributionRule->fill($validated);
        $insuranceContributionRule->save();
        $insuranceContributionRule->load('partner');

        $this->recordAudit(
            request: $request,
            auditLogService: $auditLogService,
            scopeResolver: $scopeResolver,
            action: 'pharmaco.insurance_contribution_rule.updated',
            auditableType: InsuranceContributionRule::class,
            auditableId: $insuranceContributionRule->id,
            metadata: [
                'rule_name' =>
                    $insuranceContributionRule->rule_name,
                'before' => $before,
                'after' => $insuranceContributionRule->only(
                    array_keys($validated)
                ),
            ]
        );

        return response()->json([
            'message' => 'Insurance contribution rule updated successfully.',
            'tenant' => $this->tenantPayload($tenant),
            'contribution_rule' =>
                $this->serializeContributionRule(
                    $insuranceContributionRule
                ),
        ]);
    }

    public function bulkImportProductPrices(
        Request $request,
        AuditLogService $auditLogService,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        $tenant = $request->attributes->get('tenant');

        $validated = $request->validate([
            'insurance_price_list_id' => [
                'required',
                'integer',
                Rule::exists('insurance_price_lists', 'id')
                    ->where(
                        fn ($query) =>
                            $query->where('tenant_id', $tenant->id)
                    ),
            ],
            'rows' => ['required', 'array', 'min:1', 'max:1000'],
            'rows.*.product_id' => [
                'required',
                'integer',
                Rule::exists('products', 'id')
                    ->where(
                        fn ($query) =>
                            $query->where('tenant_id', $tenant->id)
                    ),
            ],
            'rows.*.agreed_unit_price' => [
                'required',
                'numeric',
                'min:0',
            ],
            'rows.*.maximum_claimable_price' => [
                'nullable',
                'numeric',
                'min:0',
            ],
            'rows.*.customer_contribution_percent' => [
                'nullable',
                'numeric',
                'min:0',
                'max:100',
            ],
            'rows.*.insurer_contribution_percent' => [
                'nullable',
                'numeric',
                'min:0',
                'max:100',
            ],
            'rows.*.is_covered' => ['nullable', 'boolean'],
            'rows.*.coverage_status' => [
                'nullable',
                Rule::in([
                    'covered',
                    'not_covered',
                    'restricted',
                    'requires_pre_authorization',
                ]),
            ],
            'rows.*.requires_pre_authorization' => [
                'nullable',
                'boolean',
            ],
        ]);

        $created = 0;
        $updated = 0;

        DB::transaction(function () use (
            $validated,
            $tenant,
            &$created,
            &$updated
        ): void {
            foreach ($validated['rows'] as $row) {
                $this->validateOptionalContributionTotal($row);

                $existing = InsuranceProductPrice::query()
                    ->where('tenant_id', $tenant->id)
                    ->where(
                        'insurance_price_list_id',
                        $validated['insurance_price_list_id']
                    )
                    ->where('product_id', $row['product_id'])
                    ->first();

                InsuranceProductPrice::query()->updateOrCreate(
                    [
                        'tenant_id' => $tenant->id,
                        'insurance_price_list_id' =>
                            $validated['insurance_price_list_id'],
                        'product_id' => $row['product_id'],
                    ],
                    [
                        'uuid' =>
                            $existing?->uuid ?? (string) Str::uuid(),
                        'agreed_unit_price' =>
                            $row['agreed_unit_price'],
                        'maximum_claimable_price' =>
                            $row['maximum_claimable_price'] ?? null,
                        'customer_contribution_percent' =>
                            $row[
                                'customer_contribution_percent'
                            ] ?? null,
                        'insurer_contribution_percent' =>
                            $row[
                                'insurer_contribution_percent'
                            ] ?? null,
                        'requires_pre_authorization' =>
                            $row[
                                'requires_pre_authorization'
                            ] ?? false,
                        'is_covered' =>
                            $row['is_covered'] ?? true,
                        'coverage_status' =>
                            $row['coverage_status'] ?? 'covered',
                    ]
                );

                $existing ? $updated++ : $created++;
            }
        });

        $this->recordAudit(
            request: $request,
            auditLogService: $auditLogService,
            scopeResolver: $scopeResolver,
            action: 'pharmaco.insurance_product_prices.bulk_imported',
            auditableType: InsurancePriceList::class,
            auditableId: $validated['insurance_price_list_id'],
            metadata: [
                'created' => $created,
                'updated' => $updated,
                'total_rows' => count($validated['rows']),
            ]
        );

        return response()->json([
            'message' => 'Insurance product prices imported successfully.',
            'tenant' => $this->tenantPayload($tenant),
            'result' => [
                'created' => $created,
                'updated' => $updated,
                'total_rows' => count($validated['rows']),
            ],
        ]);
    }

    public function exportProductPrices(Request $request)
    {
        $tenant = $request->attributes->get('tenant');

        $validated = $request->validate([
            'insurance_price_list_id' => [
                'required',
                'integer',
                Rule::exists('insurance_price_lists', 'id')
                    ->where(
                        fn ($query) =>
                            $query->where('tenant_id', $tenant->id)
                    ),
            ],
        ]);

        $priceList = InsurancePriceList::query()
            ->where('tenant_id', $tenant->id)
            ->findOrFail($validated['insurance_price_list_id']);

        $rows = InsuranceProductPrice::query()
            ->with('product')
            ->where('tenant_id', $tenant->id)
            ->where(
                'insurance_price_list_id',
                $priceList->id
            )
            ->orderBy('product_id')
            ->get();

        $handle = fopen('php://temp', 'w+');

        fputcsv($handle, [
            'product_id',
            'sku',
            'product_name',
            'agreed_unit_price',
            'maximum_claimable_price',
            'customer_contribution_percent',
            'insurer_contribution_percent',
            'coverage_status',
            'is_covered',
            'requires_pre_authorization',
        ]);

        foreach ($rows as $row) {
            fputcsv($handle, [
                $row->product_id,
                $row->product?->sku,
                $row->product?->name,
                $row->agreed_unit_price,
                $row->maximum_claimable_price,
                $row->customer_contribution_percent,
                $row->insurer_contribution_percent,
                $row->coverage_status,
                $row->is_covered ? '1' : '0',
                $row->requires_pre_authorization ? '1' : '0',
            ]);
        }

        rewind($handle);
        $csv = stream_get_contents($handle);
        fclose($handle);

        $filename = sprintf(
            'insurance-price-list-%s.csv',
            strtolower($priceList->code)
        );

        return Response::make(
            $csv,
            200,
            [
                'Content-Type' => 'text/csv',
                'Content-Disposition' =>
                    'attachment; filename="' . $filename . '"',
            ]
        );
    }

    public function resolvePricing(
        Request $request,
        InsurancePricingResolver $pricingResolver
    ): JsonResponse {
        $tenant = $request->attributes->get('tenant');

        $validated = $request->validate([
            'insurance_partner_id' => [
                'required',
                'integer',
                Rule::exists('insurance_partners', 'id')
                    ->where(
                        fn ($query) =>
                            $query->where('tenant_id', $tenant->id)
                    ),
            ],
            'insurance_scheme_id' => [
                'nullable',
                'integer',
                Rule::exists('insurance_schemes', 'id')
                    ->where(
                        fn ($query) =>
                            $query->where('tenant_id', $tenant->id)
                    ),
            ],
            'insurance_institution_id' => [
                'nullable',
                'integer',
                Rule::exists('insurance_institutions', 'id')
                    ->where(
                        fn ($query) =>
                            $query->where('tenant_id', $tenant->id)
                    ),
            ],
            'product_id' => [
                'required',
                'integer',
                Rule::exists('products', 'id')
                    ->where(
                        fn ($query) =>
                            $query->where('tenant_id', $tenant->id)
                    ),
            ],
            'retail_unit_price' => [
                'required',
                'numeric',
                'min:0',
            ],
            'service_date' => ['nullable', 'date'],
        ]);

        $partner = InsurancePartner::query()
            ->where('tenant_id', $tenant->id)
            ->findOrFail($validated['insurance_partner_id']);

        $product = Product::query()
            ->where('tenant_id', $tenant->id)
            ->findOrFail($validated['product_id']);

        $scheme = null;

        if (! empty($validated['insurance_scheme_id'])) {
            $scheme = InsuranceScheme::query()
                ->where('tenant_id', $tenant->id)
                ->where('insurance_partner_id', $partner->id)
                ->findOrFail($validated['insurance_scheme_id']);
        }

        $resolution = $pricingResolver->resolve(
            tenantId: $tenant->id,
            partner: $partner,
            product: $product,
            retailUnitPrice: (float) $validated['retail_unit_price'],
            scheme: $scheme,
            institutionId:
                $validated['insurance_institution_id'] ?? null,
            serviceDate: isset($validated['service_date'])
                ? CarbonImmutable::parse($validated['service_date'])
                : null
        );

        return response()->json([
            'tenant' => $this->tenantPayload($tenant),
            'resolution' => $resolution,
        ]);
    }

    private function serializeInstitution(
        InsuranceInstitution $institution
    ): array {
        return [
            'id' => $institution->id,
            'uuid' => $institution->uuid,
            'insurance_partner_id' =>
                $institution->insurance_partner_id,
            'name' => $institution->name,
            'code' => $institution->code,
            'institution_type' =>
                $institution->institution_type,
            'registration_number' =>
                $institution->registration_number,
            'contact_name' => $institution->contact_name,
            'contact_email' => $institution->contact_email,
            'contact_phone' => $institution->contact_phone,
            'status' => $institution->status,
            'metadata' => $institution->metadata,
            'partner' =>
                $institution->relationLoaded('partner')
                && $institution->partner
                    ? [
                        'id' => $institution->partner->id,
                        'code' => $institution->partner->code,
                        'name' => $institution->partner->name,
                    ]
                    : null,
            'created_at' =>
                $institution->created_at?->toISOString(),
            'updated_at' =>
                $institution->updated_at?->toISOString(),
        ];
    }

    private function serializePriceList(
        InsurancePriceList $priceList
    ): array {
        return [
            'id' => $priceList->id,
            'uuid' => $priceList->uuid,
            'insurance_partner_id' =>
                $priceList->insurance_partner_id,
            'insurance_scheme_id' =>
                $priceList->insurance_scheme_id,
            'name' => $priceList->name,
            'code' => $priceList->code,
            'currency' => $priceList->currency,
            'effective_from' =>
                $priceList->effective_from?->toDateString(),
            'effective_to' =>
                $priceList->effective_to?->toDateString(),
            'priority' => $priceList->priority,
            'status' => $priceList->status,
            'is_default' => (bool) $priceList->is_default,
            'metadata' => $priceList->metadata,
            'product_prices_count' =>
                $priceList->product_prices_count ?? null,
            'partner' =>
                $priceList->relationLoaded('partner')
                && $priceList->partner
                    ? [
                        'id' => $priceList->partner->id,
                        'code' => $priceList->partner->code,
                        'name' => $priceList->partner->name,
                    ]
                    : null,
            'scheme' =>
                $priceList->relationLoaded('scheme')
                && $priceList->scheme
                    ? [
                        'id' => $priceList->scheme->id,
                        'code' => $priceList->scheme->code,
                        'name' => $priceList->scheme->name,
                    ]
                    : null,
            'created_at' =>
                $priceList->created_at?->toISOString(),
            'updated_at' =>
                $priceList->updated_at?->toISOString(),
        ];
    }

    private function serializeProductPrice(
        InsuranceProductPrice $productPrice
    ): array {
        return [
            'id' => $productPrice->id,
            'uuid' => $productPrice->uuid,
            'insurance_price_list_id' =>
                $productPrice->insurance_price_list_id,
            'product_id' => $productPrice->product_id,
            'agreed_unit_price' =>
                (float) $productPrice->agreed_unit_price,
            'maximum_claimable_price' =>
                $productPrice->maximum_claimable_price !== null
                    ? (float)
                        $productPrice->maximum_claimable_price
                    : null,
            'customer_contribution_percent' =>
                $productPrice
                    ->customer_contribution_percent !== null
                    ? (float)
                        $productPrice
                            ->customer_contribution_percent
                    : null,
            'insurer_contribution_percent' =>
                $productPrice
                    ->insurer_contribution_percent !== null
                    ? (float)
                        $productPrice
                            ->insurer_contribution_percent
                    : null,
            'requires_pre_authorization' =>
                (bool)
                $productPrice->requires_pre_authorization,
            'is_covered' => (bool) $productPrice->is_covered,
            'coverage_status' =>
                $productPrice->coverage_status,
            'restrictions' => $productPrice->restrictions,
            'metadata' => $productPrice->metadata,
            'product' =>
                $productPrice->relationLoaded('product')
                && $productPrice->product
                    ? [
                        'id' => $productPrice->product->id,
                        'sku' => $productPrice->product->sku,
                        'name' => $productPrice->product->name,
                    ]
                    : null,
            'price_list' =>
                $productPrice->relationLoaded('priceList')
                && $productPrice->priceList
                    ? [
                        'id' => $productPrice->priceList->id,
                        'code' => $productPrice->priceList->code,
                        'name' => $productPrice->priceList->name,
                    ]
                    : null,
        ];
    }

    private function serializeContributionRule(
        InsuranceContributionRule $rule
    ): array {
        return [
            'id' => $rule->id,
            'uuid' => $rule->uuid,
            'insurance_partner_id' =>
                $rule->insurance_partner_id,
            'insurance_scheme_id' =>
                $rule->insurance_scheme_id,
            'insurance_institution_id' =>
                $rule->insurance_institution_id,
            'product_id' => $rule->product_id,
            'rule_name' => $rule->rule_name,
            'rule_scope' => $rule->rule_scope,
            'customer_contribution_percent' =>
                (float) $rule->customer_contribution_percent,
            'insurer_contribution_percent' =>
                (float) $rule->insurer_contribution_percent,
            'fixed_customer_amount' =>
                $rule->fixed_customer_amount !== null
                    ? (float) $rule->fixed_customer_amount
                    : null,
            'maximum_insurer_amount' =>
                $rule->maximum_insurer_amount !== null
                    ? (float) $rule->maximum_insurer_amount
                    : null,
            'priority' => $rule->priority,
            'effective_from' =>
                $rule->effective_from?->toDateString(),
            'effective_to' =>
                $rule->effective_to?->toDateString(),
            'status' => $rule->status,
            'conditions' => $rule->conditions,
            'metadata' => $rule->metadata,
            'partner' =>
                $rule->relationLoaded('partner')
                && $rule->partner
                    ? [
                        'id' => $rule->partner->id,
                        'code' => $rule->partner->code,
                        'name' => $rule->partner->name,
                    ]
                    : null,
        ];
    }

    private function validateContributionRuleRequest(
        Request $request,
        int $tenantId,
        bool $partial = false
    ): array {
        $required = $partial ? 'sometimes' : 'required';

        $validated = $request->validate([
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
                'nullable',
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
            'product_id' => [
                'nullable',
                'integer',
                Rule::exists('products', 'id')
                    ->where(
                        fn ($query) =>
                            $query->where('tenant_id', $tenantId)
                    ),
            ],
            'rule_name' => [$required, 'string', 'max:191'],
            'rule_scope' => [
                $required,
                Rule::in([
                    'partner',
                    'scheme',
                    'institution',
                    'product',
                ]),
            ],
            'customer_contribution_percent' => [
                $required,
                'numeric',
                'min:0',
                'max:100',
            ],
            'insurer_contribution_percent' => [
                $required,
                'numeric',
                'min:0',
                'max:100',
            ],
            'fixed_customer_amount' => [
                'nullable',
                'numeric',
                'min:0',
            ],
            'maximum_insurer_amount' => [
                'nullable',
                'numeric',
                'min:0',
            ],
            'priority' => ['nullable', 'integer', 'min:1'],
            'effective_from' => ['nullable', 'date'],
            'effective_to' => ['nullable', 'date'],
            'status' => [
                'nullable',
                Rule::in(['active', 'inactive', 'draft']),
            ],
            'conditions' => ['nullable', 'array'],
            'metadata' => ['nullable', 'array'],
        ]);

        if (! $partial) {
            $this->validateContributionScope($validated);
            $this->validateOptionalContributionTotal($validated);
        }

        return $validated;
    }

    private function validateContributionScope(array $data): void
    {
        $scope = $data['rule_scope'] ?? null;

        $valid = match ($scope) {
            'partner' =>
                empty($data['insurance_scheme_id'])
                && empty($data['insurance_institution_id'])
                && empty($data['product_id']),

            'scheme' =>
                ! empty($data['insurance_scheme_id']),

            'institution' =>
                ! empty($data['insurance_institution_id']),

            'product' =>
                ! empty($data['product_id']),

            default => false,
        };

        if (! $valid) {
            abort(response()->json([
                'message' =>
                    'The contribution rule scope does not match its selected target.',
                'errors' => [
                    'rule_scope' => [
                        'Select the required target for this rule scope.',
                    ],
                ],
            ], 422));
        }
    }

    private function validateOptionalContributionTotal(
        array $data
    ): void {
        $hasCustomer = array_key_exists(
            'customer_contribution_percent',
            $data
        ) && $data['customer_contribution_percent'] !== null;

        $hasInsurer = array_key_exists(
            'insurer_contribution_percent',
            $data
        ) && $data['insurer_contribution_percent'] !== null;

        if ($hasCustomer xor $hasInsurer) {
            abort(response()->json([
                'message' =>
                    'Provide both customer and insurer contribution percentages.',
                'errors' => [
                    'insurer_contribution_percent' => [
                        'Both contribution percentages are required together.',
                    ],
                ],
            ], 422));
        }

        if ($hasCustomer && $hasInsurer) {
            $total =
                (float) $data['customer_contribution_percent']
                + (float) $data['insurer_contribution_percent'];

            if (abs($total - 100) > 0.0001) {
                abort(response()->json([
                    'message' =>
                        'The customer and insurer contribution percentages must total 100.',
                    'errors' => [
                        'insurer_contribution_percent' => [
                            'The total contribution percentage must equal 100.',
                        ],
                    ],
                ], 422));
            }
        }
    }

    private function paginationPayload($paginator): array
    {
        return [
            'current_page' => $paginator->currentPage(),
            'last_page' => $paginator->lastPage(),
            'per_page' => $paginator->perPage(),
            'total' => $paginator->total(),
            'from' => $paginator->firstItem(),
            'to' => $paginator->lastItem(),
        ];
    }

    private function recordAudit(
        Request $request,
        AuditLogService $auditLogService,
        ScopeResolver $scopeResolver,
        string $action,
        string $auditableType,
        int $auditableId,
        array $metadata
    ): void {
        $tenant = $request->attributes->get('tenant');
        $scope = $scopeResolver->resolveForUser($request->user());

        $auditLogService->record(
            action: $action,
            scope: $scope,
            metadata: array_merge(
                ['tenant_slug' => $tenant->slug],
                $metadata
            ),
            dataClassification: 'internal',
            auditableType: $auditableType,
            auditableId: $auditableId
        );
    }

    private function serializePartner(
        InsurancePartner $partner
    ): array {
        return [
            'id' => $partner->id,
            'uuid' => $partner->uuid,
            'name' => $partner->name,
            'code' => $partner->code,
            'partner_type' => $partner->partner_type,
            'registration_number' => $partner->registration_number,
            'tax_identification_number' =>
                $partner->tax_identification_number,
            'contact_name' => $partner->contact_name,
            'contact_email' => $partner->contact_email,
            'contact_phone' => $partner->contact_phone,
            'claims_email' => $partner->claims_email,
            'currency' => $partner->currency,
            'status' => $partner->status,
            'is_default' => (bool) $partner->is_default,
            'integration_settings' =>
                $partner->integration_settings,
            'metadata' => $partner->metadata,
            'institutions_count' =>
                $partner->institutions_count ?? null,
            'schemes_count' =>
                $partner->schemes_count ?? null,
            'price_lists_count' =>
                $partner->price_lists_count ?? null,
            'claims_count' =>
                $partner->claims_count ?? null,
            'created_at' =>
                $partner->created_at?->toISOString(),
            'updated_at' =>
                $partner->updated_at?->toISOString(),
        ];
    }

    private function serializeScheme(
        InsuranceScheme $scheme
    ): array {
        return [
            'id' => $scheme->id,
            'uuid' => $scheme->uuid,
            'insurance_partner_id' =>
                $scheme->insurance_partner_id,
            'insurance_institution_id' =>
                $scheme->insurance_institution_id,
            'name' => $scheme->name,
            'code' => $scheme->code,
            'scheme_type' => $scheme->scheme_type,
            'annual_limit' => $scheme->annual_limit !== null
                ? (float) $scheme->annual_limit
                : null,
            'per_visit_limit' =>
                $scheme->per_visit_limit !== null
                    ? (float) $scheme->per_visit_limit
                    : null,
            'default_customer_contribution_percent' =>
                (float)
                $scheme->default_customer_contribution_percent,
            'default_insurer_contribution_percent' =>
                (float)
                $scheme->default_insurer_contribution_percent,
            'effective_from' =>
                $scheme->effective_from?->toDateString(),
            'effective_to' =>
                $scheme->effective_to?->toDateString(),
            'status' => $scheme->status,
            'coverage_settings' =>
                $scheme->coverage_settings,
            'metadata' => $scheme->metadata,
            'partner' => $scheme->relationLoaded('partner')
                && $scheme->partner
                    ? [
                        'id' => $scheme->partner->id,
                        'code' => $scheme->partner->code,
                        'name' => $scheme->partner->name,
                    ]
                    : null,
            'institution' =>
                $scheme->relationLoaded('institution')
                && $scheme->institution
                    ? [
                        'id' => $scheme->institution->id,
                        'code' => $scheme->institution->code,
                        'name' => $scheme->institution->name,
                    ]
                    : null,
            'created_at' =>
                $scheme->created_at?->toISOString(),
            'updated_at' =>
                $scheme->updated_at?->toISOString(),
        ];
    }

    private function tenantPayload($tenant): array
    {
        return [
            'id' => $tenant->id,
            'uuid' => $tenant->uuid,
            'name' => $tenant->name,
            'slug' => $tenant->slug,
        ];
    }
}
