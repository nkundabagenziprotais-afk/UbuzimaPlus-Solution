<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Market;
use App\Models\ServiceProviderLocation;
use App\Models\Tenant;
use App\Models\TenantMarketAssignment;
use App\Services\Access\ScopeResolver;
use App\Services\Audit\AuditLogService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class MarketManagementController extends Controller
{
    public function publicMarkets(): JsonResponse
    {
        return response()->json([
            'markets' => Market::query()
                ->where('status', 'active')
                ->orderBy('name')
                ->get()
                ->map(fn (Market $market) => $this->marketPayload($market))
                ->values(),
        ]);
    }

    public function adminIndex(): JsonResponse
    {
        return response()->json([
            'markets' => Market::query()
                ->withCount(['tenantAssignments', 'serviceProviders'])
                ->orderBy('name')
                ->get()
                ->map(fn (Market $market) => [
                    ...$this->marketPayload($market),
                    'tenant_assignments_count' => $market->tenant_assignments_count,
                    'service_providers_count' => $market->service_providers_count,
                ])
                ->values(),
            'assignments' => TenantMarketAssignment::query()
                ->with(['tenant', 'market'])
                ->orderByDesc('updated_at')
                ->limit(50)
                ->get()
                ->map(fn (TenantMarketAssignment $assignment) => $this->assignmentPayload($assignment))
                ->values(),
            'provider_types' => [
                'retail_pharmacy',
                'wholesale_pharmacy',
                'clinic',
                'veterinary',
                'insurance_partner',
            ],
        ]);
    }

    public function assignTenant(
        Request $request,
        AuditLogService $auditLogService,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        $validated = $request->validate([
            'tenant_slug' => ['required', 'string', 'max:191', Rule::exists('tenants', 'slug')],
            'market_code' => ['required', 'string', 'max:50', Rule::exists('markets', 'code')],
            'status' => ['sometimes', Rule::in(['active', 'suspended', 'planned'])],
            'service_radius_km' => ['nullable', 'numeric', 'min:1', 'max:500'],
            'metadata' => ['sometimes', 'array'],
        ]);

        $tenant = Tenant::query()->where('slug', $validated['tenant_slug'])->firstOrFail();
        $market = Market::query()->where('code', $validated['market_code'])->firstOrFail();

        $assignment = TenantMarketAssignment::query()->updateOrCreate(
            ['tenant_id' => $tenant->id, 'market_id' => $market->id],
            [
                'status' => $validated['status'] ?? 'active',
                'service_radius_km' => $validated['service_radius_km'] ?? $market->service_radius_km,
                'assigned_at' => now(),
                'metadata' => $validated['metadata'] ?? ['source' => 'admin_market_management'],
            ]
        );

        $auditLogService->record(
            action: 'market.tenant.assigned',
            scope: $scopeResolver->resolveForUser($request->user()),
            metadata: [
                'tenant_id' => $tenant->id,
                'market_id' => $market->id,
                'status' => $assignment->status,
            ],
            dataClassification: 'internal'
        );

        return response()->json([
            'message' => 'Tenant market assignment saved.',
            'assignment' => $this->assignmentPayload($assignment->fresh(['tenant', 'market'])),
        ]);
    }

    public function nearbyProviders(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'market_code' => ['nullable', 'string', 'max:50'],
            'provider_type' => ['nullable', 'string', 'max:80'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:50'],
        ]);

        $market = isset($validated['market_code'])
            ? Market::query()->where('code', $validated['market_code'])->where('status', 'active')->first()
            : Market::query()->where('code', 'RW')->where('status', 'active')->first();

        $providers = ServiceProviderLocation::query()
            ->with(['tenant', 'branch', 'market'])
            ->where('status', 'active')
            ->when($market, fn ($query) => $query->where('market_id', $market->id))
            ->when($validated['provider_type'] ?? null, fn ($query, string $type) => $query->where('provider_type', $type))
            ->limit(100)
            ->get()
            ->map(function (ServiceProviderLocation $provider) use ($validated) {
                $distance = null;

                if (isset($validated['latitude'], $validated['longitude']) && $provider->latitude && $provider->longitude) {
                    $distance = $this->distanceKm(
                        (float) $validated['latitude'],
                        (float) $validated['longitude'],
                        (float) $provider->latitude,
                        (float) $provider->longitude
                    );
                }

                return [
                    ...$this->providerPayload($provider),
                    'distance_km' => $distance !== null ? round($distance, 2) : null,
                ];
            })
            ->sortBy(fn (array $provider) => $provider['distance_km'] ?? 999999)
            ->take($validated['limit'] ?? 10)
            ->values();

        return response()->json([
            'market' => $market ? $this->marketPayload($market) : null,
            'providers' => $providers,
        ]);
    }

    private function marketPayload(Market $market): array
    {
        return [
            'id' => $market->id,
            'code' => $market->code,
            'name' => $market->name,
            'country_code' => $market->country_code,
            'default_language' => $market->default_language,
            'currency_code' => $market->currency_code,
            'timezone' => $market->timezone,
            'service_radius_km' => (float) $market->service_radius_km,
            'status' => $market->status,
        ];
    }

    private function assignmentPayload(TenantMarketAssignment $assignment): array
    {
        return [
            'id' => $assignment->id,
            'status' => $assignment->status,
            'service_radius_km' => $assignment->service_radius_km !== null ? (float) $assignment->service_radius_km : null,
            'assigned_at' => $assignment->assigned_at?->toISOString(),
            'tenant' => $assignment->tenant ? [
                'id' => $assignment->tenant->id,
                'name' => $assignment->tenant->name,
                'slug' => $assignment->tenant->slug,
                'tenant_type' => $assignment->tenant->tenant_type,
                'status' => $assignment->tenant->status,
            ] : null,
            'market' => $assignment->market ? $this->marketPayload($assignment->market) : null,
        ];
    }

    private function providerPayload(ServiceProviderLocation $provider): array
    {
        return [
            'id' => $provider->id,
            'uuid' => $provider->uuid,
            'name' => $provider->name,
            'provider_type' => $provider->provider_type,
            'service_channels' => $provider->service_channels ?? [],
            'phone' => $provider->phone,
            'email' => $provider->email,
            'address' => $provider->address,
            'latitude' => $provider->latitude !== null ? (float) $provider->latitude : null,
            'longitude' => $provider->longitude !== null ? (float) $provider->longitude : null,
            'service_radius_km' => $provider->service_radius_km !== null ? (float) $provider->service_radius_km : null,
            'tenant' => $provider->tenant ? [
                'id' => $provider->tenant->id,
                'name' => $provider->tenant->name,
                'slug' => $provider->tenant->slug,
                'website_url' => $provider->tenant->website_url,
            ] : null,
            'branch' => $provider->branch ? [
                'id' => $provider->branch->id,
                'name' => $provider->branch->name,
                'code' => $provider->branch->code,
            ] : null,
            'market' => $provider->market ? [
                'code' => $provider->market->code,
                'name' => $provider->market->name,
            ] : null,
        ];
    }

    private function distanceKm(float $lat1, float $lon1, float $lat2, float $lon2): float
    {
        $earthRadiusKm = 6371;
        $latDelta = deg2rad($lat2 - $lat1);
        $lonDelta = deg2rad($lon2 - $lon1);

        $a = sin($latDelta / 2) ** 2
            + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($lonDelta / 2) ** 2;

        return $earthRadiusKm * (2 * atan2(sqrt($a), sqrt(1 - $a)));
    }
}
