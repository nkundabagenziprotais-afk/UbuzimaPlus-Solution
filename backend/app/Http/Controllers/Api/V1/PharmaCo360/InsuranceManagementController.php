<?php

namespace App\Http\Controllers\Api\V1\PharmaCo360;

use App\Http\Controllers\Controller;
use App\Models\InsurancePartner;
use App\Models\InsuranceScheme;
use App\Models\Product;
use App\Services\Access\ScopeResolver;
use App\Services\Audit\AuditLogService;
use App\Services\PharmaCo360\InsurancePricingResolver;
use App\Services\PharmaCo360\InsuranceTenantBootstrapService;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
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
