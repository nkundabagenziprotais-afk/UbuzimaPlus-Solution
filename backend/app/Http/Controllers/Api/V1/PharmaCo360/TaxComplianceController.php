<?php

namespace App\Http\Controllers\Api\V1\PharmaCo360;

use App\Http\Controllers\Controller;
use App\Models\PharmacoTaxComplianceRule;
use App\Models\ProductCategory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class TaxComplianceController extends Controller
{
    public function rules(Request $request): JsonResponse
    {
        $tenant = $request->attributes->get('tenant');

        $rules = PharmacoTaxComplianceRule::query()
            ->with('productCategory')
            ->where('tenant_id', $tenant->id)
            ->when($request->query('status', 'active'), fn ($query, $status) => $query->where('status', $status))
            ->orderByRaw("case applies_to when 'product_category' then 1 when 'product_type' then 2 else 3 end")
            ->orderBy('name')
            ->get();

        return response()->json([
            'tenant' => [
                'id' => $tenant->id,
                'name' => $tenant->name,
                'slug' => $tenant->slug,
            ],
            'rules' => $rules->map(fn (PharmacoTaxComplianceRule $rule) => $this->serializeRule($rule))->values(),
            'api_sync' => [
                'endpoint' => '/api/v1/pharmaco/tax-compliance/rules/sync',
                'status' => 'ready_for_rra_integration',
            ],
        ]);
    }

    public function syncRules(Request $request): JsonResponse
    {
        $tenant = $request->attributes->get('tenant');

        $validated = $request->validate([
            'rules' => ['required', 'array', 'min:1'],
            'rules.*.code' => ['required', 'string', 'max:120'],
            'rules.*.name' => ['required', 'string', 'max:255'],
            'rules.*.applies_to' => ['nullable', 'string', Rule::in(['all_products', 'product_category', 'product_type'])],
            'rules.*.product_category_id' => ['nullable', 'integer'],
            'rules.*.product_type' => ['nullable', 'string', 'max:80'],
            'rules.*.tax_rate' => ['required', 'numeric', 'gte:0', 'lte:100'],
            'rules.*.effective_from' => ['nullable', 'date'],
            'rules.*.effective_until' => ['nullable', 'date'],
            'rules.*.status' => ['nullable', 'string', Rule::in(['active', 'inactive', 'retired'])],
            'rules.*.metadata' => ['nullable', 'array'],
        ]);

        $syncedRules = DB::transaction(function () use ($tenant, $validated) {
            return collect($validated['rules'])->map(function (array $payload) use ($tenant) {
                $categoryId = $payload['product_category_id'] ?? null;

                if ($categoryId) {
                    ProductCategory::query()
                        ->where('tenant_id', $tenant->id)
                        ->whereKey($categoryId)
                        ->firstOrFail();
                }

                $rule = PharmacoTaxComplianceRule::query()->firstOrNew([
                    'tenant_id' => $tenant->id,
                    'code' => Str::upper($payload['code']),
                ]);

                if (! $rule->exists) {
                    $rule->uuid = (string) Str::uuid();
                }

                $rule->fill([
                    'product_category_id' => $categoryId,
                    'name' => $payload['name'],
                    'applies_to' => $payload['applies_to'] ?? 'all_products',
                    'product_type' => $payload['product_type'] ?? null,
                    'tax_rate' => round((float) $payload['tax_rate'], 4),
                    'effective_from' => $payload['effective_from'] ?? null,
                    'effective_until' => $payload['effective_until'] ?? null,
                    'status' => $payload['status'] ?? 'active',
                    'metadata' => $payload['metadata'] ?? [],
                ]);
                $rule->save();

                return $rule->fresh('productCategory');
            });
        });

        return response()->json([
            'message' => 'Tax compliance rules synced successfully.',
            'rules' => $syncedRules->map(fn (PharmacoTaxComplianceRule $rule) => $this->serializeRule($rule))->values(),
        ]);
    }

    private function serializeRule(PharmacoTaxComplianceRule $rule): array
    {
        return [
            'id' => $rule->id,
            'uuid' => $rule->uuid,
            'code' => $rule->code,
            'name' => $rule->name,
            'applies_to' => $rule->applies_to,
            'product_type' => $rule->product_type,
            'tax_rate' => (float) $rule->tax_rate,
            'effective_from' => $rule->effective_from?->toDateString(),
            'effective_until' => $rule->effective_until?->toDateString(),
            'status' => $rule->status,
            'product_category' => $rule->productCategory ? [
                'id' => $rule->productCategory->id,
                'name' => $rule->productCategory->name,
                'code' => $rule->productCategory->code,
            ] : null,
            'metadata' => $rule->metadata ?? [],
        ];
    }
}
