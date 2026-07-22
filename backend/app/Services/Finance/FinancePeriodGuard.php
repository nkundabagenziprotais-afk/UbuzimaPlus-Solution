<?php

namespace App\Services\Finance;

use App\Models\FinanceAccountingPeriod;
use RuntimeException;

class FinancePeriodGuard
{
    public function openPeriodFor(
        int $tenantId,
        ?int $branchId,
        string $businessDate,
    ): ?FinanceAccountingPeriod {
        $period = FinanceAccountingPeriod::query()
            ->where('tenant_id', $tenantId)
            ->whereDate('starts_on', '<=', $businessDate)
            ->whereDate('ends_on', '>=', $businessDate)
            ->where(function ($query) use ($branchId): void {
                $query->whereNull('branch_id');

                if ($branchId !== null) {
                    $query->orWhere('branch_id', $branchId);
                }
            })
            ->orderByRaw('CASE WHEN branch_id IS NULL THEN 1 ELSE 0 END')
            ->first();

        if ($period && $period->isClosedOrLocked()) {
            throw new RuntimeException('Accounting period is closed or locked.');
        }

        return $period;
    }
}
