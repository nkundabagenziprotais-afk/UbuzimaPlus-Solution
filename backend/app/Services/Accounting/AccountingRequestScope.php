<?php

namespace App\Services\Accounting;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\HttpException;

class AccountingRequestScope
{
    /**
     * @return array{
     *     tenant_id:int,
     *     branch_id:?int,
     *     user_id:int
     * }
     */
    public function resolve(Request $request): array
    {
        $user = $request->user();

        if (! $user) {
            throw new HttpException(
                401,
                'Authentication is required.'
            );
        }

        $tenant = $request->attributes->get(
            'tenant'
        );

        $tenantId = (int) (
            $tenant?->id ?? 0
        );

        if ($tenantId <= 0) {
            throw new HttpException(
                422,
                'A verified tenant context is required '
                . 'for Accounting.'
            );
        }

        $assignments = $user
            ->tenantAssignments()
            ->where('tenant_id', $tenantId)
            ->where('status', 'active')
            ->orderBy('id')
            ->get();

        if ($assignments->isEmpty()) {
            throw new HttpException(
                403,
                'You are not assigned to this '
                . 'Accounting tenant.'
            );
        }

        $tenantWide = $assignments->first(
            static fn ($assignment): bool =>
                $assignment->branch_id === null
        );

        if ($tenantWide) {
            $branchId = null;
        } else {
            $branchIds = $assignments
                ->pluck('branch_id')
                ->filter(
                    static fn ($value): bool =>
                        $value !== null
                )
                ->map(
                    static fn ($value): int =>
                        (int) $value
                )
                ->unique()
                ->values();

            if ($branchIds->count() !== 1) {
                throw new HttpException(
                    409,
                    'A single active Accounting branch '
                    . 'assignment is required.'
                );
            }

            $branchId = (int) $branchIds->first();
        }

        if (
            $branchId !== null
            && ! DB::table('branches')
                ->where('id', $branchId)
                ->where('tenant_id', $tenantId)
                ->where('status', 'active')
                ->exists()
        ) {
            throw new HttpException(
                403,
                'Your Accounting branch assignment '
                . 'is not active.'
            );
        }

        return [
            'tenant_id' => $tenantId,
            'branch_id' => $branchId,
            'user_id' => (int) $user->getKey(),
        ];
    }
}
