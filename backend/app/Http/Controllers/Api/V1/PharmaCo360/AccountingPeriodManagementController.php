<?php

namespace App\Http\Controllers\Api\V1\PharmaCo360;

/*
 * AQUILA_ACCOUNTING_PERIOD_MANAGEMENT_R1
 *
 * Narrow Accounting Period Create/Open + Safe Edit authority.
 *
 * This controller intentionally DOES NOT:
 * - close periods
 * - reopen periods
 * - approve/reject period lifecycle actions
 * - directly flip status/is_locked on an existing period
 *
 * Those responsibilities remain with FinancePeriodCloseService.
 */

use App\Http\Controllers\Controller;
use App\Models\FinanceAccountingPeriod;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

final class AccountingPeriodManagementController extends Controller
{
    private const BRANCH_TABLE = 'branches';

    public function capabilities(Request $request): JsonResponse
    {
        $user = $request->user();

        if (! $user) {
            abort(401);
        }

        $tenantId = $this->tenantId($request);

        $manage = $this->hasPermission(
            $user,
            'finance.settings.manage'
        );

        $close = $this->hasPermission(
            $user,
            'finance.period.close'
        );

        $reports = $this->hasPermission(
            $user,
            'finance.reports.view'
        );

        $branches = [];

        if ($manage) {
            $query = DB::table(self::BRANCH_TABLE)
                ->where('tenant_id', $tenantId);

            $userBranchId = $this->userBranchId($user);

            if ($userBranchId !== null) {
                $query->where('id', $userBranchId);
            }

            $nameColumn = Schema::hasColumn(
                self::BRANCH_TABLE,
                'name'
            )
                ? 'name'
                : null;

            $rows = $nameColumn
                ? $query
                    ->select(['id', $nameColumn])
                    ->orderBy($nameColumn)
                    ->get()
                : $query
                    ->select(['id'])
                    ->orderBy('id')
                    ->get();

            foreach ($rows as $row) {
                $branches[] = [
                    'id' => $row->id,
                    'name' => $nameColumn
                        ? $row->{$nameColumn}
                        : 'Branch '.$row->id,
                ];
            }
        }

        return response()->json([
            'data' => [
                'manage_periods' => $manage,
                'close_periods' => $close,
                'view_readiness' => ($close || $reports),
                'user_id' => $user->getAuthIdentifier(),
                'branches' => $branches,
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->requirePermission(
            $request,
            'finance.settings.manage'
        );

        $this->rejectProtectedInputs($request);

        $tenantId = $this->tenantId($request);

        $payload = $request->validate([
            'name' => [
                'required',
                'string',
                'min:1',
                'max:191',
            ],
            'branch_id' => [
                'required',
                'integer',
            ],
            'starts_on' => [
                'required',
                'date_format:Y-m-d',
            ],
            'ends_on' => [
                'required',
                'date_format:Y-m-d',
                'after_or_equal:starts_on',
            ],
        ]);

        $branchId = (int) $payload['branch_id'];

        $this->assertBranchInScope(
            $request,
            $tenantId,
            $branchId
        );

        $this->assertNoOverlap(
            $tenantId,
            $branchId,
            $payload['starts_on'],
            $payload['ends_on'],
            null
        );

        $userId = $request->user()->getAuthIdentifier();

        $period = DB::transaction(function () use (
            $tenantId,
            $branchId,
            $payload,
            $userId
        ) {
            /*
             * Initial state only.
             *
             * This is creation of a new period, not a lifecycle status flip.
             * Existing periods are never closed/reopened here.
             */
            $period = new FinanceAccountingPeriod();

            if (
                Schema::hasColumn(
                    'finance_accounting_periods',
                    'uuid'
                )
            ) {
                $period->uuid = (string) Str::uuid();
            }

            $period->tenant_id = $tenantId;
            $period->branch_id = $branchId;
            $period->name = trim($payload['name']);
            $period->starts_on = $payload['starts_on'];
            $period->ends_on = $payload['ends_on'];
            $period->status = 'open';
            $period->is_locked = false;

            $this->setActorColumns(
                $period,
                $userId,
                true
            );

            $period->save();

            Log::info(
                'accounting.period.created',
                [
                    'period_id' => $period->getKey(),
                    'tenant_id' => $tenantId,
                    'branch_id' => $branchId,
                    'actor_user_id' => $userId,
                    'starts_on' => $payload['starts_on'],
                    'ends_on' => $payload['ends_on'],
                ]
            );

            return $period->fresh();
        });

        return response()->json([
            'message' => 'Accounting period created successfully.',
            'data' => $this->periodPayload($period),
        ], 201);
    }

    public function update(
        Request $request,
        $periodId
    ): JsonResponse {
        $this->requirePermission(
            $request,
            'finance.settings.manage'
        );

        $this->rejectProtectedInputs($request);

        if ($request->exists('branch_id')) {
            throw ValidationException::withMessages([
                'branch_id' =>
                    'Branch cannot be changed after an accounting period is created.',
            ]);
        }

        if (! $request->hasAny([
            'name',
            'starts_on',
            'ends_on',
        ])) {
            throw ValidationException::withMessages([
                'period' =>
                    'No editable accounting period fields were provided.',
            ]);
        }

        $payload = $request->validate([
            'name' => [
                'sometimes',
                'string',
                'min:1',
                'max:191',
            ],
            'starts_on' => [
                'sometimes',
                'date_format:Y-m-d',
            ],
            'ends_on' => [
                'sometimes',
                'date_format:Y-m-d',
            ],
        ]);

        $tenantId = $this->tenantId($request);

        $period = DB::transaction(function () use (
            $request,
            $tenantId,
            $periodId,
            $payload
        ) {
            $period = FinanceAccountingPeriod::query()
                ->where('tenant_id', $tenantId)
                ->whereKey($periodId)
                ->lockForUpdate()
                ->first();

            if (! $period) {
                abort(404, 'Accounting period not found.');
            }

            $this->assertBranchInScope(
                $request,
                $tenantId,
                (int) $period->branch_id
            );

            if (
                (bool) $period->is_locked ||
                strtolower((string) $period->status) !== 'open'
            ) {
                throw ValidationException::withMessages([
                    'period' =>
                        'Only an open, unlocked accounting period can be edited.',
                ]);
            }

            $this->assertNoPendingLifecycle(
                $period->getKey()
            );

            $currentStart = $this->dateString(
                $period->starts_on
            );

            $currentEnd = $this->dateString(
                $period->ends_on
            );

            $newStart = $payload['starts_on']
                ?? $currentStart;

            $newEnd = $payload['ends_on']
                ?? $currentEnd;

            if ($newEnd < $newStart) {
                throw ValidationException::withMessages([
                    'ends_on' =>
                        'End date cannot be before start date.',
                ]);
            }

            $dateChanged = (
                $newStart !== $currentStart ||
                $newEnd !== $currentEnd
            );

            if ($dateChanged) {
                if ($this->hasPeriodReferences(
                    $period->getKey()
                )) {
                    throw ValidationException::withMessages([
                        'period' =>
                            'Period dates cannot be changed after accounting activity or lifecycle history exists.',
                    ]);
                }

                $this->assertNoOverlap(
                    $tenantId,
                    (int) $period->branch_id,
                    $newStart,
                    $newEnd,
                    $period->getKey()
                );
            }

            if (array_key_exists('name', $payload)) {
                $period->name = trim(
                    $payload['name']
                );
            }

            if (array_key_exists('starts_on', $payload)) {
                $period->starts_on =
                    $payload['starts_on'];
            }

            if (array_key_exists('ends_on', $payload)) {
                $period->ends_on =
                    $payload['ends_on'];
            }

            /*
             * status and is_locked are intentionally untouched.
             */
            $this->setActorColumns(
                $period,
                $request->user()->getAuthIdentifier(),
                false
            );

            $period->save();

            Log::info(
                'accounting.period.updated',
                [
                    'period_id' => $period->getKey(),
                    'tenant_id' => $tenantId,
                    'branch_id' => $period->branch_id,
                    'actor_user_id' =>
                        $request->user()->getAuthIdentifier(),
                    'date_changed' => $dateChanged,
                ]
            );

            return $period->fresh();
        });

        return response()->json([
            'message' => 'Accounting period updated successfully.',
            'data' => $this->periodPayload($period),
        ]);
    }

    private function rejectProtectedInputs(
        Request $request
    ): void {
        $protected = [
            'status',
            'is_locked',
            'locked',
            'closed_at',
            'closed_by',
            'reopened_at',
            'approved_by',
        ];

        foreach ($protected as $field) {
            if ($request->exists($field)) {
                throw ValidationException::withMessages([
                    $field =>
                        'This field is controlled by the accounting lifecycle and cannot be changed here.',
                ]);
            }
        }
    }

    private function tenantId(Request $request): int
    {
        $user = $request->user();

        if (! $user) {
            abort(401);
        }

        $tenantAttribute = $request->attributes->get(
            'tenant'
        );

        $candidates = [
            $request->attributes->get('tenant_id'),
            $request->attributes->get('current_tenant_id'),
            $request->attributes->get('active_tenant_id'),
            is_object($tenantAttribute)
                ? ($tenantAttribute->id ?? null)
                : null,
            $user->tenant_id ?? null,
            $user->current_tenant_id ?? null,
            $user->active_tenant_id ?? null,
        ];

        foreach ($candidates as $candidate) {
            if (
                $candidate !== null &&
                $candidate !== '' &&
                is_numeric($candidate)
            ) {
                return (int) $candidate;
            }
        }

        abort(
            422,
            'Authenticated tenant context could not be resolved.'
        );
    }

    private function userBranchId($user): ?int
    {
        foreach ([
            $user->branch_id ?? null,
            $user->current_branch_id ?? null,
            $user->active_branch_id ?? null,
        ] as $candidate) {
            if (
                $candidate !== null &&
                $candidate !== '' &&
                is_numeric($candidate)
            ) {
                return (int) $candidate;
            }
        }

        return null;
    }

    private function assertBranchInScope(
        Request $request,
        int $tenantId,
        int $branchId
    ): void {
        $userBranchId = $this->userBranchId(
            $request->user()
        );

        if (
            $userBranchId !== null &&
            $userBranchId !== $branchId
        ) {
            abort(
                403,
                'The selected branch is outside your branch scope.'
            );
        }

        $exists = DB::table(self::BRANCH_TABLE)
            ->where('id', $branchId)
            ->where('tenant_id', $tenantId)
            ->exists();

        if (! $exists) {
            abort(
                403,
                'The selected branch is outside the current tenant.'
            );
        }
    }

    private function assertNoOverlap(
        int $tenantId,
        int $branchId,
        string $startsOn,
        string $endsOn,
        $ignorePeriodId
    ): void {
        $query = FinanceAccountingPeriod::query()
            ->where('tenant_id', $tenantId)
            ->where('branch_id', $branchId)
            ->where('starts_on', '<=', $endsOn)
            ->where('ends_on', '>=', $startsOn);

        if ($ignorePeriodId !== null) {
            $query->whereKeyNot($ignorePeriodId);
        }

        if ($query->exists()) {
            throw ValidationException::withMessages([
                'period' =>
                    'The accounting period overlaps another period for this branch.',
            ]);
        }
    }

    private function assertNoPendingLifecycle(
        $periodId
    ): void {
        $table = 'finance_period_close_actions';

        if (! Schema::hasTable($table)) {
            return;
        }

        if (! Schema::hasColumn($table, 'status')) {
            return;
        }

        $periodColumn = $this->firstExistingColumn(
            $table,
            [
                'accounting_period_id',
                'period_id',
            ]
        );

        if (! $periodColumn) {
            return;
        }

        $pending = DB::table($table)
            ->where($periodColumn, $periodId)
            ->where(function ($query) {
                $query
                    ->whereIn('status', [
                        'pending',
                        'requested',
                        'pending_approval',
                    ])
                    ->orWhere(
                        'status',
                        'like',
                        '%pending%'
                    );
            })
            ->exists();

        if ($pending) {
            throw ValidationException::withMessages([
                'period' =>
                    'This period has a pending close/re-open action and cannot be edited.',
            ]);
        }
    }

    private function hasPeriodReferences(
        $periodId
    ): bool {
        $tables = [
            'finance_journal_entries',
            'finance_journal_drafts',
            'finance_expenses',
            'finance_period_close_actions',
            'finance_bank_transactions',
            'finance_cash_transactions',
            'finance_posting_logs',
        ];

        foreach ($tables as $table) {
            if (! Schema::hasTable($table)) {
                continue;
            }

            $column = $this->firstExistingColumn(
                $table,
                [
                    'accounting_period_id',
                    'period_id',
                ]
            );

            if (! $column) {
                continue;
            }

            if (
                DB::table($table)
                    ->where($column, $periodId)
                    ->exists()
            ) {
                return true;
            }
        }

        return false;
    }

    private function firstExistingColumn(
        string $table,
        array $candidates
    ): ?string {
        foreach ($candidates as $candidate) {
            if (
                Schema::hasColumn(
                    $table,
                    $candidate
                )
            ) {
                return $candidate;
            }
        }

        return null;
    }

    private function requirePermission(
        Request $request,
        string $permission
    ): void {
        $user = $request->user();

        if (! $user) {
            abort(401);
        }

        if (! $this->hasPermission(
            $user,
            $permission
        )) {
            abort(
                403,
                'You do not have permission to perform this accounting period action.'
            );
        }
    }

    private function hasPermission(
        $user,
        string $permission
    ): bool {
        /*
         * AQUILA_ACCOUNTING_PERIOD_RBAC_R1
         *
         * Ubuzima+ RBAC authority is User::hasPermission(), which
         * expands active role permission codes. This User model is
         * not Spatie. Spatie-style probes remain only as fallbacks.
         */
        try {
            if (
                method_exists(
                    $user,
                    'hasPermission'
                ) &&
                $user->hasPermission(
                    $permission
                )
            ) {
                return true;
            }
        } catch (\Throwable $e) {
            // Default deny continues below.
        }

        try {
            if (
                method_exists(
                    $user,
                    'hasPermissionTo'
                ) &&
                $user->hasPermissionTo(
                    $permission
                )
            ) {
                return true;
            }
        } catch (\Throwable $e) {
            // Default deny continues below.
        }

        try {
            if (
                method_exists(
                    $user,
                    'can'
                ) &&
                $user->can($permission)
            ) {
                return true;
            }
        } catch (\Throwable $e) {
            // Default deny continues below.
        }

        try {
            if (
                method_exists(
                    $user,
                    'getAllPermissions'
                )
            ) {
                foreach (
                    $user->getAllPermissions()
                    as $item
                ) {
                    if (
                        (string) ($item->name ?? '') ===
                        $permission
                    ) {
                        return true;
                    }
                }
            }
        } catch (\Throwable $e) {
            // Default deny continues below.
        }

        try {
            if (
                method_exists(
                    $user,
                    'permissions'
                ) &&
                $user->permissions()
                    ->where('name', $permission)
                    ->exists()
            ) {
                return true;
            }
        } catch (\Throwable $e) {
            // Default deny continues below.
        }

        try {
            if (
                method_exists(
                    $user,
                    'roles'
                ) &&
                $user->roles()
                    ->whereHas(
                        'permissions',
                        function ($query) use ($permission) {
                            $query->where(
                                'name',
                                $permission
                            );
                        }
                    )
                    ->exists()
            ) {
                return true;
            }
        } catch (\Throwable $e) {
            // Secure default deny.
        }

        return false;
    }

    private function setActorColumns(
        FinanceAccountingPeriod $period,
        $userId,
        bool $creating
    ): void {
        if (
            $creating &&
            Schema::hasColumn(
                'finance_accounting_periods',
                'created_by'
            )
        ) {
            $period->created_by = $userId;
        }

        if (
            $creating &&
            Schema::hasColumn(
                'finance_accounting_periods',
                'created_by_user_id'
            )
        ) {
            $period->created_by_user_id = $userId;
        }

        if (
            Schema::hasColumn(
                'finance_accounting_periods',
                'updated_by'
            )
        ) {
            $period->updated_by = $userId;
        }

        if (
            Schema::hasColumn(
                'finance_accounting_periods',
                'updated_by_user_id'
            )
        ) {
            $period->updated_by_user_id = $userId;
        }
    }

    private function periodPayload(
        FinanceAccountingPeriod $period
    ): array {
        $payload = $period->toArray();

        $branchNameColumn = Schema::hasColumn(
            self::BRANCH_TABLE,
            'name'
        )
            ? 'name'
            : null;

        if ($branchNameColumn) {
            $payload['branch_name'] = DB::table(
                self::BRANCH_TABLE
            )
                ->where('id', $period->branch_id)
                ->value($branchNameColumn);
        }

        return $payload;
    }

    private function dateString($value): string
    {
        if (
            $value instanceof \DateTimeInterface
        ) {
            return $value->format('Y-m-d');
        }

        return substr(
            (string) $value,
            0,
            10
        );
    }
}
