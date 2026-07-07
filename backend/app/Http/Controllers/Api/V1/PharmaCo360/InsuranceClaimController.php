<?php

namespace App\Http\Controllers\Api\V1\PharmaCo360;

use App\Http\Controllers\Controller;
use App\Models\CustomerInsuranceMembership;
use App\Models\InsuranceClaim;
use App\Models\PharmacoSale;
use App\Services\Access\ScopeResolver;
use App\Services\Audit\AuditLogService;
use App\Services\PharmaCo360\InsuranceClaimGenerationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class InsuranceClaimController extends Controller
{
    public function claims(
        Request $request
    ): JsonResponse {
        $tenant = $request->attributes->get('tenant');

        $perPage = min(
            max(
                (int) $request->query(
                    'per_page',
                    25
                ),
                1
            ),
            200
        );

        $claims = InsuranceClaim::query()
            ->with([
                'partner',
                'scheme',
                'membership.customer',
                'sale.branch',
                'sale.customer',
            ])
            ->withCount('lines')
            ->where('tenant_id', $tenant->id)
            ->when(
                $request->query('status'),
                fn ($query, $status) =>
                    $status === 'all'
                        ? $query
                        : $query->where(
                            'status',
                            $status
                        )
            )
            ->when(
                $request->query(
                    'insurance_partner_id'
                ),
                fn ($query, $partnerId) =>
                    $query->where(
                        'insurance_partner_id',
                        $partnerId
                    )
            )
            ->when(
                $request->query('sale_id'),
                fn ($query, $saleId) =>
                    $query->where(
                        'sale_id',
                        $saleId
                    )
            )
            ->when(
                $request->query('search'),
                function ($query, $search): void {
                    $term =
                        '%' .
                        trim((string) $search) .
                        '%';

                    $query->where(
                        function ($inner) use (
                            $term
                        ): void {
                            $inner
                                ->where(
                                    'claim_number',
                                    'like',
                                    $term
                                )
                                ->orWhereHas(
                                    'sale',
                                    fn ($saleQuery) =>
                                        $saleQuery
                                            ->where(
                                                'sale_number',
                                                'like',
                                                $term
                                            )
                                )
                                ->orWhereHas(
                                    'membership',
                                    fn (
                                        $membershipQuery
                                    ) =>
                                        $membershipQuery
                                            ->where(
                                                'member_number',
                                                'like',
                                                $term
                                            )
                                );
                        }
                    );
                }
            )
            ->latest('id')
            ->paginate($perPage);

        return response()->json([
            'tenant' =>
                $this->tenantPayload($tenant),
            'claims' =>
                collect($claims->items())
                    ->map(
                        fn (
                            InsuranceClaim $claim
                        ) =>
                            $this->serializeClaim(
                                $claim
                            )
                    )
                    ->values(),
            'meta' =>
                $this->paginationPayload(
                    $claims
                ),
        ]);
    }

    public function claim(
        Request $request,
        InsuranceClaim $insuranceClaim
    ): JsonResponse {
        $tenant = $request->attributes->get('tenant');

        abort_unless(
            (int) $insuranceClaim->tenant_id ===
                (int) $tenant->id,
            404
        );

        $insuranceClaim->load([
            'partner',
            'scheme',
            'membership.customer',
            'sale.branch',
            'sale.customer',
            'lines.product',
            'lines.saleItem',
        ]);

        return response()->json([
            'tenant' =>
                $this->tenantPayload($tenant),
            'claim' => $this->serializeClaim(
                $insuranceClaim,
                true
            ),
        ]);
    }

    public function createFromSale(
        Request $request,
        InsuranceClaimGenerationService $service,
        AuditLogService $auditLogService,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        $tenant = $request->attributes->get('tenant');

        $validated = $request->validate([
            'sale_id' => [
                'required',
                'integer',
                Rule::exists(
                    'pharmaco_sales',
                    'id'
                )->where(
                    fn ($query) =>
                        $query->where(
                            'tenant_id',
                            $tenant->id
                        )
                ),
            ],
            'customer_insurance_membership_id' => [
                'required',
                'integer',
                Rule::exists(
                    'customer_insurance_memberships',
                    'id'
                )->where(
                    fn ($query) =>
                        $query->where(
                            'tenant_id',
                            $tenant->id
                        )
                ),
            ],
            'service_date' => [
                'nullable',
                'date',
            ],
        ]);

        $sale = PharmacoSale::query()
            ->where(
                'tenant_id',
                $tenant->id
            )
            ->findOrFail(
                $validated['sale_id']
            );

        $membership =
            CustomerInsuranceMembership::query()
                ->where(
                    'tenant_id',
                    $tenant->id
                )
                ->findOrFail(
                    $validated[
                        'customer_insurance_membership_id'
                    ]
                );

        $claim = $service->generateDraft(
            tenantId: $tenant->id,
            sale: $sale,
            membership: $membership,
            serviceDate:
                $validated['service_date']
                ?? null,
            generatedBy:
                $request->user()->id
        );

        $scope = $scopeResolver->resolveForUser(
            $request->user()
        );

        $auditLogService->record(
            action:
                'pharmaco.insurance_claim.created',
            scope: $scope,
            metadata: [
                'tenant_slug' => $tenant->slug,
                'claim_id' => $claim->id,
                'claim_number' =>
                    $claim->claim_number,
                'sale_id' => $claim->sale_id,
                'sale_number' =>
                    $claim->sale?->sale_number,
                'membership_id' =>
                    $claim
                        ->customer_insurance_membership_id,
                'member_number' =>
                    $claim->membership
                        ?->member_number,
                'gross_amount' =>
                    (float) $claim->gross_amount,
                'customer_amount' =>
                    (float) $claim
                        ->customer_amount,
                'claimed_amount' =>
                    (float) $claim
                        ->claimed_amount,
                'line_count' =>
                    $claim->lines->count(),
            ],
            dataClassification: 'confidential',
            auditableType: InsuranceClaim::class,
            auditableId: $claim->id
        );

        return response()->json([
            'message' =>
                'Draft insurance claim generated successfully.',
            'tenant' =>
                $this->tenantPayload($tenant),
            'claim' => $this->serializeClaim(
                $claim,
                true
            ),
        ], 201);
    }

    private function serializeClaim(
        InsuranceClaim $claim,
        bool $includeLines = false
    ): array {
        $payload = [
            'id' => $claim->id,
            'uuid' => $claim->uuid,
            'claim_number' =>
                $claim->claim_number,
            'external_claim_reference' =>
                $claim
                    ->external_claim_reference,
            'insurance_partner_id' =>
                $claim
                    ->insurance_partner_id,
            'insurance_scheme_id' =>
                $claim
                    ->insurance_scheme_id,
            'customer_insurance_membership_id' =>
                $claim
                    ->customer_insurance_membership_id,
            'sale_id' => $claim->sale_id,
            'service_date' =>
                $claim->service_date
                    ?->toDateString(),
            'gross_amount' =>
                (float) $claim->gross_amount,
            'customer_amount' =>
                (float) $claim
                    ->customer_amount,
            'claimed_amount' =>
                (float) $claim
                    ->claimed_amount,
            'approved_amount' =>
                (float) $claim
                    ->approved_amount,
            'rejected_amount' =>
                (float) $claim
                    ->rejected_amount,
            'paid_amount' =>
                (float) $claim->paid_amount,
            'status' => $claim->status,
            'metadata' =>
                $claim->metadata ?? [],
            'lines_count' =>
                $claim->lines_count
                ?? (
                    $claim->relationLoaded(
                        'lines'
                    )
                        ? $claim
                            ->lines
                            ->count()
                        : null
                ),
            'partner' => $claim->partner
                ? [
                    'id' =>
                        $claim->partner->id,
                    'code' =>
                        $claim->partner->code,
                    'name' =>
                        $claim->partner->name,
                ]
                : null,
            'scheme' => $claim->scheme
                ? [
                    'id' =>
                        $claim->scheme->id,
                    'code' =>
                        $claim->scheme->code,
                    'name' =>
                        $claim->scheme->name,
                ]
                : null,
            'membership' =>
                $claim->membership
                    ? [
                        'id' =>
                            $claim
                                ->membership->id,
                        'member_number' =>
                            $claim
                                ->membership
                                ->member_number,
                        'verification_status' =>
                            $claim
                                ->membership
                                ->verification_status,
                        'status' =>
                            $claim
                                ->membership
                                ->status,
                    ]
                    : null,
            'sale' => $claim->sale
                ? [
                    'id' =>
                        $claim->sale->id,
                    'sale_number' =>
                        $claim
                            ->sale
                            ->sale_number,
                    'sale_type' =>
                        $claim
                            ->sale
                            ->sale_type,
                    'status' =>
                        $claim->sale->status,
                    'total_amount' =>
                        (float) $claim
                            ->sale
                            ->total_amount,
                    'sold_at' =>
                        $claim
                            ->sale
                            ->sold_at
                            ?->toISOString(),
                ]
                : null,
            'created_at' =>
                $claim->created_at
                    ?->toISOString(),
            'updated_at' =>
                $claim->updated_at
                    ?->toISOString(),
        ];

        if ($includeLines) {
            $payload['lines'] =
                $claim->lines
                    ->map(
                        fn ($line) => [
                            'id' => $line->id,
                            'uuid' =>
                                $line->uuid,
                            'product_id' =>
                                $line
                                    ->product_id,
                            'sale_item_id' =>
                                $line
                                    ->sale_item_id,
                            'description' =>
                                $line
                                    ->description,
                            'quantity' =>
                                (float) $line
                                    ->quantity,
                            'unit_price' =>
                                (float) $line
                                    ->unit_price,
                            'gross_amount' =>
                                (float) $line
                                    ->gross_amount,
                            'customer_amount' =>
                                (float) $line
                                    ->customer_amount,
                            'claimed_amount' =>
                                (float) $line
                                    ->claimed_amount,
                            'approved_amount' =>
                                (float) $line
                                    ->approved_amount,
                            'rejected_amount' =>
                                (float) $line
                                    ->rejected_amount,
                            'status' =>
                                $line->status,
                            'metadata' =>
                                $line
                                    ->metadata
                                ?? [],
                            'product' =>
                                $line->product
                                    ? [
                                        'id' =>
                                            $line
                                                ->product
                                                ->id,
                                        'sku' =>
                                            $line
                                                ->product
                                                ->sku,
                                        'name' =>
                                            $line
                                                ->product
                                                ->name,
                                    ]
                                    : null,
                        ]
                    )
                    ->values();
        }

        return $payload;
    }

    private function paginationPayload(
        $paginator
    ): array {
        return [
            'current_page' =>
                $paginator->currentPage(),
            'per_page' =>
                $paginator->perPage(),
            'total' => $paginator->total(),
            'last_page' =>
                $paginator->lastPage(),
            'from' =>
                $paginator->firstItem(),
            'to' =>
                $paginator->lastItem(),
        ];
    }

    private function tenantPayload(
        $tenant
    ): array {
        return [
            'id' => $tenant->id,
            'name' => $tenant->name,
            'slug' => $tenant->slug,
        ];
    }
}
