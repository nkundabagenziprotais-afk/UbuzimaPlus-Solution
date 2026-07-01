<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AiAgent;
use App\Models\AiAuditLog;
use App\Models\AiModel;
use App\Models\AiProvider;
use App\Models\AiRecommendation;
use App\Models\Product;
use App\Models\Solution;
use App\Models\StockBatch;
use App\Models\Tenant;
use App\Services\Access\ScopeResolver;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class AiCenterController extends Controller
{
    public function overview(Request $request): JsonResponse
    {
        $tenant = $request->attributes->get('tenant');

        return response()->json([
            'providers' => AiProvider::query()->orderBy('name')->get()->map(fn (AiProvider $provider) => [
                'id' => $provider->id,
                'name' => $provider->name,
                'code' => $provider->code,
                'provider_type' => $provider->provider_type,
                'status' => $provider->status,
                'mode' => $provider->mode,
                'data_policy' => $provider->data_policy ?? [],
            ])->values(),
            'models' => AiModel::query()
                ->with('provider')
                ->when($tenant, fn ($query) => $query->where(fn ($scope) => $scope->whereNull('tenant_id')->orWhere('tenant_id', $tenant->id)))
                ->orderBy('name')
                ->get()
                ->map(fn (AiModel $model) => $this->modelPayload($model))
                ->values(),
            'agents' => AiAgent::query()
                ->when($tenant, fn ($query) => $query->where(fn ($scope) => $scope->whereNull('tenant_id')->orWhere('tenant_id', $tenant->id)))
                ->orderBy('name')
                ->get()
                ->map(fn (AiAgent $agent) => $this->agentPayload($agent))
                ->values(),
            'recommendations' => AiRecommendation::query()
                ->with('agent')
                ->when($tenant, fn ($query) => $query->where('tenant_id', $tenant->id))
                ->orderByDesc('created_at')
                ->limit(30)
                ->get()
                ->map(fn (AiRecommendation $recommendation) => $this->recommendationPayload($recommendation))
                ->values(),
            'summary' => [
                'active_models' => AiModel::where('status', 'active')->count(),
                'active_agents' => AiAgent::where('status', 'active')->count(),
                'pending_recommendations' => AiRecommendation::when($tenant, fn ($query) => $query->where('tenant_id', $tenant->id))
                    ->where('status', 'pending_review')
                    ->count(),
                'implemented_recommendations' => AiRecommendation::when($tenant, fn ($query) => $query->where('tenant_id', $tenant->id))
                    ->where('status', 'implemented')
                    ->count(),
            ],
        ]);
    }

    public function activateDefaults(Request $request, ScopeResolver $scopeResolver): JsonResponse
    {
        $tenant = $request->attributes->get('tenant');
        $solution = Solution::query()->where('code', 'pharmaco360')->first();

        $provider = AiProvider::query()->updateOrCreate(
            ['code' => 'ubuzima_rule_based_ai'],
            [
                'name' => 'Ubuzima Rule-Based AI Engine',
                'provider_type' => 'internal',
                'status' => 'active',
                'mode' => 'production',
                'secret_reference' => null,
                'enabled_by' => $request->user()?->id,
                'configuration' => [
                    'execution' => 'local_operational_rules',
                    'external_provider_required' => false,
                ],
                'data_policy' => [
                    'tenant_boundary_required' => true,
                    'human_approval_required_for_sensitive_actions' => true,
                    'writes_are_draft_until_approved' => true,
                ],
            ]
        );

        $models = [
            ['demand_forecast', 'Demand Forecasting AI', 'forecasting', 'medium'],
            ['reorder_recommendation', 'Reorder Recommendation AI', 'recommendation', 'medium'],
            ['stockout_risk', 'Stock-Out Risk AI', 'risk', 'high'],
            ['expiry_risk', 'Expiry Risk AI', 'risk', 'high'],
            ['price_margin_review', 'Pricing and Margin Review AI', 'analysis', 'medium'],
            ['supplier_performance', 'Supplier Performance AI', 'analysis', 'medium'],
            ['customer_retention', 'Customer Retention AI', 'recommendation', 'medium'],
            ['anomaly_detection', 'Fraud and Anomaly AI', 'risk', 'high'],
            ['finance_forecast', 'Finance Forecast AI', 'forecasting', 'medium'],
            ['business_chat', 'Business Chat AI', 'assistant', 'medium'],
        ];

        foreach ($models as [$code, $name, $type, $risk]) {
            AiModel::query()->updateOrCreate(
                ['code' => 'pharmaco_' . $code],
                [
                    'ai_provider_id' => $provider->id,
                    'solution_id' => $solution?->id,
                    'tenant_id' => null,
                    'name' => $name,
                    'model_type' => $type,
                    'status' => 'active',
                    'risk_level' => $risk,
                    'requires_human_approval' => true,
                    'allowed_data_types' => ['products', 'stock_batches', 'sales', 'suppliers', 'reports'],
                    'approved_by' => $request->user()?->id,
                    'approved_at' => now(),
                ]
            );
        }

        $agent = AiAgent::query()->updateOrCreate(
            ['code' => 'pharmaco_operations_copilot'],
            [
                'solution_id' => $solution?->id,
                'tenant_id' => null,
                'name' => 'PharmaCo360 Operations Copilot',
                'description' => 'Generates advisory stock, expiry, reorder, supplier, and reporting recommendations from approved tenant data.',
                'status' => 'active',
                'risk_level' => 'medium',
                'instructions_summary' => 'Read approved operational data, explain each recommendation, and keep all sensitive actions pending human approval.',
                'created_by' => $request->user()?->id,
            ]
        );

        AiAuditLog::query()->create([
            'ai_agent_id' => $agent->id,
            'solution_id' => $solution?->id,
            'tenant_id' => $tenant?->id,
            'user_id' => $request->user()?->id,
            'action' => 'ai.defaults.activated',
            'risk_level' => 'medium',
            'metadata' => [
                'scope' => $scopeResolver->resolveForUser($request->user())->toArray(),
            ],
            'created_at' => now(),
        ]);

        return response()->json([
            'message' => 'AI Center defaults activated with local governed models and agents.',
            'provider' => $provider->fresh(),
            'models_count' => count($models),
            'agent' => $this->agentPayload($agent->fresh()),
        ]);
    }

    public function generateInventoryRecommendations(Request $request): JsonResponse
    {
        $tenant = $request->attributes->get('tenant');
        $solution = Solution::query()->where('code', 'pharmaco360')->first();
        $agent = AiAgent::query()->firstOrCreate(
            ['code' => 'pharmaco_operations_copilot'],
            [
                'solution_id' => $solution?->id,
                'name' => 'PharmaCo360 Operations Copilot',
                'status' => 'active',
                'risk_level' => 'medium',
                'instructions_summary' => 'Generate advisory recommendations from tenant operational data.',
            ]
        );

        $created = [];

        $lowStockProducts = Product::query()
            ->where('tenant_id', $tenant->id)
            ->withSum('stockBatches as total_quantity_on_hand', 'quantity_on_hand')
            ->get()
            ->filter(fn (Product $product) => (float) ($product->total_quantity_on_hand ?? 0) <= (float) $product->reorder_level)
            ->take(8);

        foreach ($lowStockProducts as $product) {
            $created[] = AiRecommendation::query()->updateOrCreate(
                [
                    'tenant_id' => $tenant->id,
                    'recommendation_type' => 'inventory_reorder',
                    'title' => "Review reorder for {$product->name}",
                    'status' => 'pending_review',
                ],
                [
                    'ai_agent_id' => $agent->id,
                    'solution_id' => $solution?->id,
                    'risk_level' => 'medium',
                    'confidence_score' => 82,
                    'explanation' => "Current quantity is at or below reorder level for SKU {$product->sku}.",
                    'data_source_summary' => 'products.reorder_level and stock_batches.quantity_on_hand',
                    'recommended_action' => 'Review supplier options and create a draft purchase order if demand remains active.',
                    'requires_approval' => true,
                ]
            );
        }

        $nearExpiryBatches = StockBatch::query()
            ->with('product')
            ->where('tenant_id', $tenant->id)
            ->whereNotNull('expiry_date')
            ->whereDate('expiry_date', '<=', now()->addDays(120)->toDateString())
            ->where('quantity_on_hand', '>', 0)
            ->orderBy('expiry_date')
            ->limit(8)
            ->get();

        foreach ($nearExpiryBatches as $batch) {
            $created[] = AiRecommendation::query()->updateOrCreate(
                [
                    'tenant_id' => $tenant->id,
                    'recommendation_type' => 'expiry_risk',
                    'title' => "Reduce expiry risk for {$batch->product->name}",
                    'status' => 'pending_review',
                ],
                [
                    'ai_agent_id' => $agent->id,
                    'solution_id' => $solution?->id,
                    'branch_id' => $batch->branch_id,
                    'risk_level' => 'high',
                    'confidence_score' => 88,
                    'explanation' => "Batch {$batch->batch_number} expires on {$batch->expiry_date?->toDateString()} and still has {$batch->quantity_on_hand} units.",
                    'data_source_summary' => 'stock_batches.expiry_date and quantity_on_hand',
                    'recommended_action' => 'Prioritize FEFO dispensing, review transfer opportunity, or prepare a pharmacist-approved promotion.',
                    'requires_approval' => true,
                ]
            );
        }

        AiAuditLog::query()->create([
            'ai_agent_id' => $agent->id,
            'solution_id' => $solution?->id,
            'tenant_id' => $tenant->id,
            'user_id' => $request->user()?->id,
            'action' => 'ai.inventory_recommendations.generated',
            'risk_level' => 'medium',
            'metadata' => [
                'created_or_refreshed' => count($created),
                'low_stock_products' => $lowStockProducts->count(),
                'near_expiry_batches' => $nearExpiryBatches->count(),
            ],
            'created_at' => now(),
        ]);

        return response()->json([
            'message' => 'Inventory AI recommendations generated from current tenant data.',
            'created_or_refreshed' => count($created),
            'recommendations' => collect($created)->map(fn (AiRecommendation $recommendation) => $this->recommendationPayload($recommendation->fresh('agent')))->values(),
        ]);
    }

    public function updateRecommendation(
        Request $request,
        AiRecommendation $recommendation
    ): JsonResponse {
        $validated = $request->validate([
            'status' => ['required', Rule::in(['approved', 'rejected', 'implemented'])],
            'note' => ['nullable', 'string', 'max:1000'],
        ]);

        $user = $request->user();
        $status = $validated['status'];

        $recommendation->status = $status;

        if ($status === 'approved') {
            $recommendation->approved_by = $user?->id;
        } elseif ($status === 'rejected') {
            $recommendation->rejected_by = $user?->id;
        } elseif ($status === 'implemented') {
            $recommendation->implemented_by = $user?->id;
        }

        $recommendation->save();

        AiAuditLog::query()->create([
            'ai_agent_id' => $recommendation->ai_agent_id,
            'solution_id' => $recommendation->solution_id,
            'tenant_id' => $recommendation->tenant_id,
            'user_id' => $user?->id,
            'action' => 'ai.recommendation.' . $status,
            'risk_level' => $recommendation->risk_level,
            'metadata' => [
                'recommendation_id' => $recommendation->id,
                'note' => $validated['note'] ?? null,
            ],
            'created_at' => now(),
        ]);

        return response()->json([
            'message' => "Recommendation marked {$status}.",
            'recommendation' => $this->recommendationPayload($recommendation->fresh('agent')),
        ]);
    }

    private function modelPayload(AiModel $model): array
    {
        return [
            'id' => $model->id,
            'name' => $model->name,
            'code' => $model->code,
            'model_type' => $model->model_type,
            'status' => $model->status,
            'risk_level' => $model->risk_level,
            'requires_human_approval' => $model->requires_human_approval,
            'allowed_data_types' => $model->allowed_data_types ?? [],
            'provider' => $model->provider ? [
                'id' => $model->provider->id,
                'name' => $model->provider->name,
                'status' => $model->provider->status,
                'mode' => $model->provider->mode,
            ] : null,
        ];
    }

    private function agentPayload(AiAgent $agent): array
    {
        return [
            'id' => $agent->id,
            'name' => $agent->name,
            'code' => $agent->code,
            'description' => $agent->description,
            'status' => $agent->status,
            'risk_level' => $agent->risk_level,
            'instructions_summary' => $agent->instructions_summary,
        ];
    }

    private function recommendationPayload(AiRecommendation $recommendation): array
    {
        return [
            'id' => $recommendation->id,
            'recommendation_type' => $recommendation->recommendation_type,
            'title' => $recommendation->title,
            'risk_level' => $recommendation->risk_level,
            'confidence_score' => $recommendation->confidence_score === null ? null : (float) $recommendation->confidence_score,
            'explanation' => $recommendation->explanation,
            'data_source_summary' => $recommendation->data_source_summary,
            'recommended_action' => $recommendation->recommended_action,
            'requires_approval' => $recommendation->requires_approval,
            'status' => $recommendation->status,
            'agent' => $recommendation->agent ? [
                'id' => $recommendation->agent->id,
                'name' => $recommendation->agent->name,
                'code' => $recommendation->agent->code,
            ] : null,
            'created_at' => $recommendation->created_at?->toISOString(),
        ];
    }
}
