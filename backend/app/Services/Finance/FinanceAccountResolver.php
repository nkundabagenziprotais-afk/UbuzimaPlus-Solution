<?php

namespace App\Services\Finance;

use App\Models\FinanceAccountMapping;
use RuntimeException;

class FinanceAccountResolver
{
    public function resolve(
        int $tenantId,
        ?int $branchId,
        string $mappingKey,
        string $currencyCode = 'RWF',
    ): int {
        $mapping = FinanceAccountMapping::query()
            ->where('tenant_id', $tenantId)
            ->where('mapping_key', $mappingKey)
            ->where('currency_code', $currencyCode)
            ->where('is_active', true)
            ->where(function ($query) use ($branchId): void {
                $query->whereNull('branch_id');

                if ($branchId !== null) {
                    $query->orWhere('branch_id', $branchId);
                }
            })
            ->orderByRaw('CASE WHEN branch_id IS NULL THEN 1 ELSE 0 END')
            ->first();

        if (! $mapping) {
            throw new RuntimeException("Missing finance account mapping: {$mappingKey}");
        }

        return (int) $mapping->finance_chart_of_account_id;
    }
}
