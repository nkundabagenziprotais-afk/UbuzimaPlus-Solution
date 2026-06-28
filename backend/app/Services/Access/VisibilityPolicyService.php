<?php

namespace App\Services\Access;

use Illuminate\Support\Facades\DB;

class VisibilityPolicyService
{
    public function rulesFor(string $scopeType, ?int $scopeId, string $policyCode): array
    {
        $record = DB::table('visibility_policies')
            ->where('scope_type', $scopeType)
            ->where('scope_id', $scopeId)
            ->where('policy_code', $policyCode)
            ->where('status', 'active')
            ->first();

        if (! $record) {
            return [];
        }

        return json_decode($record->rules, true) ?: [];
    }

    public function allowsAggregatedInsights(string $scopeType, ?int $scopeId): bool
    {
        $rules = $this->rulesFor($scopeType, $scopeId, 'aggregated_insights');

        return (bool) ($rules['allowed'] ?? false);
    }
}
