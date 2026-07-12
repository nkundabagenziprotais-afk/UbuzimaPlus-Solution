<?php

namespace App\Services\Auth;

use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

class SegregationOfDutiesService
{
    public function assess(array $permissions): array
    {
        $normalized = collect($permissions)
            ->filter(fn ($permission) =>
                is_string($permission)
                && trim($permission) !== ''
            )
            ->map(fn (string $permission) =>
                strtolower(trim($permission))
            )
            ->unique()
            ->values();

        $conflicts = collect();

        $this->detectMatchingActionConflict(
            $normalized,
            'create',
            'approve',
            'creator_approver',
            'A role should not create and approve the same controlled transaction.',
            'high',
            $conflicts
        );

        $this->detectMatchingActionConflict(
            $normalized,
            'prepare',
            'approve',
            'preparer_approver',
            'A role should not prepare and approve the same controlled transaction.',
            'high',
            $conflicts
        );

        $this->detectMatchingActionConflict(
            $normalized,
            'submit',
            'approve',
            'submitter_approver',
            'A role should not submit and approve the same controlled transaction.',
            'high',
            $conflicts
        );

        if (
            $normalized->contains(
                'pharmaco.pos.refund'
            )
            && $normalized->contains(
                fn (string $permission): bool =>
                    str_contains(
                        $permission,
                        'reconcil'
                    )
            )
        ) {
            $conflicts->push([
                'code' =>
                    'refund_reconciliation',
                'severity' => 'high',
                'message' =>
                    'Refund execution and reconciliation must be separated.',
                'permissions' => [
                    'pharmaco.pos.refund',
                    ...$normalized
                        ->filter(
                            fn (
                                string $permission
                            ): bool =>
                                str_contains(
                                    $permission,
                                    'reconcil'
                                )
                        )
                        ->values()
                        ->all(),
                ],
            ]);
        }

        if (
            (
                $normalized->contains(
                    'roles.manage'
                )
                || $normalized->contains(
                    'users.permissions.edit'
                )
            )
            && $normalized->contains(
                fn (string $permission): bool =>
                    str_contains(
                        $permission,
                        'audit'
                    )
                    && str_ends_with(
                        $permission,
                        '.delete'
                    )
            )
        ) {
            $conflicts->push([
                'code' =>
                    'access_admin_audit_deletion',
                'severity' => 'critical',
                'message' =>
                    'Access administrators must not delete their own security audit evidence.',
                'permissions' =>
                    $normalized
                        ->filter(
                            fn (
                                string $permission
                            ): bool =>
                                in_array(
                                    $permission,
                                    [
                                        'roles.manage',
                                        'users.permissions.edit',
                                    ],
                                    true
                                )
                                || (
                                    str_contains(
                                        $permission,
                                        'audit'
                                    )
                                    && str_ends_with(
                                        $permission,
                                        '.delete'
                                    )
                                )
                        )
                        ->values()
                        ->all(),
            ]);
        }

        $elevatedPermissions = $normalized
            ->filter(
                fn (string $permission): bool =>
                    str_ends_with(
                        $permission,
                        '.approve'
                    )
                    || str_ends_with(
                        $permission,
                        '.delete'
                    )
                    || str_ends_with(
                        $permission,
                        '.manage'
                    )
                    || str_contains(
                        $permission,
                        'refund'
                    )
                    || str_contains(
                        $permission,
                        'reset'
                    )
            )
            ->values();

        $blockingConflicts = $conflicts
            ->whereIn(
                'severity',
                ['high', 'critical']
            )
            ->values();

        $riskScore = min(
            100,
            ($blockingConflicts->count() * 30)
            + min(
                40,
                $elevatedPermissions->count() * 4
            )
        );

        $riskLevel = match (true) {
            $blockingConflicts->isNotEmpty()
                => 'blocked',
            $riskScore >= 60 => 'high',
            $riskScore >= 30 => 'medium',
            default => 'low',
        };

        return [
            'risk_score' => $riskScore,
            'risk_level' => $riskLevel,
            'permission_count' =>
                $normalized->count(),
            'elevated_permission_count' =>
                $elevatedPermissions->count(),
            'elevated_permissions' =>
                $elevatedPermissions->all(),
            'conflict_count' =>
                $conflicts->count(),
            'blocking_conflict_count' =>
                $blockingConflicts->count(),
            'conflicts' =>
                $conflicts->values()->all(),
            'compliant' =>
                $blockingConflicts->isEmpty(),
        ];
    }

    public function assertCompliant(
        array $permissions
    ): array {
        $assessment =
            $this->assess($permissions);

        if (! $assessment['compliant']) {
            $messages = collect(
                $assessment['conflicts']
            )
                ->pluck('message')
                ->unique()
                ->implode(' ');

            throw ValidationException::withMessages([
                'permissions' =>
                    $messages
                    ?: 'The selected permissions violate segregation-of-duties policy.',
            ]);
        }

        return $assessment;
    }

    private function detectMatchingActionConflict(
        Collection $permissions,
        string $firstAction,
        string $secondAction,
        string $code,
        string $message,
        string $severity,
        Collection $conflicts
    ): void {
        $firstPermissions = $permissions
            ->filter(
                fn (string $permission): bool =>
                    str_ends_with(
                        $permission,
                        '.' . $firstAction
                    )
            );

        foreach ($firstPermissions as $permission) {
            $base = substr(
                $permission,
                0,
                -strlen('.' . $firstAction)
            );

            $matchingPermission =
                $base . '.' . $secondAction;

            if (
                ! $permissions->contains(
                    $matchingPermission
                )
            ) {
                continue;
            }

            $conflicts->push([
                'code' => $code,
                'severity' => $severity,
                'message' => $message,
                'resource' => $base,
                'permissions' => [
                    $permission,
                    $matchingPermission,
                ],
            ]);
        }
    }
}
