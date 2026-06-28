<?php

namespace App\Services\Access;

use App\Models\Solution;

class SolutionResolver
{
    public function findActiveByCode(string $code): ?Solution
    {
        return Solution::query()
            ->where('code', $code)
            ->where('status', 'active')
            ->first();
    }

    public function ensureActiveByCode(string $code): Solution
    {
        return Solution::query()
            ->where('code', $code)
            ->where('status', 'active')
            ->firstOrFail();
    }
}
