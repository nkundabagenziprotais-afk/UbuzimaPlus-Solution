<?php

declare(strict_types=1);

namespace App\Http\Middleware\Hrm;

use App\Services\Hrm\Payroll\PayrollR1ScopeService;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

final class EnsurePayrollFinanceReadyForClose
{
    public function __construct(
        private readonly PayrollR1ScopeService $scope
    ) {
    }

    public function handle(
        Request $request,
        Closure $next
    ): Response {
        $runId = (int)
            $request->route(
                'runId'
            );

        if ($runId <= 0) {
            return $next(
                $request
            );
        }

        $ctx =
            $this->scope->resolve(
                $request
            );

        $query = DB::table(
            'payroll_runs'
        )
            ->where(
                'id',
                $runId
            )
            ->where(
                'tenant_id',
                $ctx['tenant_id']
            );

        if (
            $ctx['branch_id']
            !==
            null
        ) {
            $query->where(
                'branch_id',
                $ctx['branch_id']
            );
        }

        $run =
            $query->first();

        if ($run === null) {
            return $next(
                $request
            );
        }

        $employerCost =
            (float)
                $run
                    ->total_employer_cost;

        if ($employerCost <= 0) {
            return $next(
                $request
            );
        }

        $expense = DB::table(
            'finance_expenses'
        )
            ->where(
                'tenant_id',
                $ctx['tenant_id']
            )
            ->where(
                'reference_number',
                'PAYROLL-RUN-'
                    . $runId
            )
            ->orderByDesc('id')
            ->first();

        if ($expense === null) {
            return response()->json([
                'message' =>
                    'Payroll cannot close before the Finance Expense handoff is completed.',

                'code' =>
                    'PAYROLL_FINANCE_HANDOFF_REQUIRED',
            ], 422);
        }

        $status = strtolower(
            (string)
                $expense->status
        );

        $posted =
            $status === 'posted'
            ||
            $expense
                ->posted_journal_entry_id
                !==
                null;

        if (! $posted) {
            return response()->json([
                'message' =>
                    'Payroll cannot close until the linked Finance Expense is independently approved and posted.',

                'code' =>
                    'PAYROLL_FINANCE_NOT_POSTED',

                'finance_expense_uuid' =>
                    $expense->uuid,

                'finance_status' =>
                    $expense->status,
            ], 422);
        }

        return $next(
            $request
        );
    }
}
