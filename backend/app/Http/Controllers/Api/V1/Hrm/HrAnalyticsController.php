<?php

namespace App\Http\Controllers\Api\V1\Hrm;

use App\Http\Controllers\Controller;
use App\Services\Access\ScopeResolver;
use App\Services\Audit\AuditLogService;
use App\Services\Hrm\HrmTenantContextService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Throwable;

class HrAnalyticsController extends Controller
{
    public function __construct(
        private readonly HrmTenantContextService $tenantContext
    ) {
    }

    public function overview(
        Request $request,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        [
            'tenant' => $tenant,
            'scope' => $scope,
        ] = $this->context(
            $request,
            $scopeResolver
        );

        return response()->json(
            $this->overviewData(
                (int) $tenant->id,
                $scope
            )
        );
    }

    public function workforce(
        Request $request,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        [
            'tenant' => $tenant,
            'scope' => $scope,
        ] = $this->context(
            $request,
            $scopeResolver
        );

        return response()->json(
            $this->workforceData(
                (int) $tenant->id,
                $scope
            )
        );
    }

    public function operations(
        Request $request,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        [
            'tenant' => $tenant,
            'scope' => $scope,
        ] = $this->context(
            $request,
            $scopeResolver
        );

        return response()->json(
            $this->operationsData(
                (int) $tenant->id,
                $scope
            )
        );
    }

    public function talent(
        Request $request,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        [
            'tenant' => $tenant,
            'scope' => $scope,
        ] = $this->context(
            $request,
            $scopeResolver
        );

        return response()->json(
            $this->talentData(
                (int) $tenant->id,
                $scope
            )
        );
    }

    public function reports(
        Request $request,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        [
            'tenant' => $tenant,
            'scope' => $scope,
        ] = $this->context(
            $request,
            $scopeResolver
        );

        $items =
            $this->visibleReports(
                (int) $tenant->id,
                $scope,
                (int) $request->user()->id
            )
                ->map(
                    function ($row) {
                        $row->filters =
                            $this->decrypt(
                                $row->filters_payload
                            );

                        unset(
                            $row->filters_payload
                        );

                        return $row;
                    }
                )
                ->values();

        return response()->json([
            'items' => $items,
        ]);
    }

    public function createReport(
        Request $request,
        ScopeResolver $scopeResolver,
        AuditLogService $audit
    ): JsonResponse {
        [
            'tenant' => $tenant,
            'scope' => $scope,
        ] = $this->context(
            $request,
            $scopeResolver
        );

        $validated =
            $request->validate([
                'code' => [
                    'required',
                    'string',
                    'max:100',
                ],

                'name' => [
                    'required',
                    'string',
                    'max:191',
                ],

                'report_type' => [
                    'required',
                    'in:executive,workforce,operations,talent',
                ],

                'visibility' => [
                    'required',
                    'in:private,branch,tenant',
                ],

                'filters' => [
                    'nullable',
                    'array',
                ],
            ]);

        $tenantId =
            (int) $tenant->id;

        $branchId =
            $this->branchId($scope);

        if (
            $branchId !== null
            &&
            $validated['visibility'] ===
            'tenant'
        ) {
            throw ValidationException::withMessages([
                'visibility' => [
                    'Branch-scoped users cannot create tenant-wide saved reports.',
                ],
            ]);
        }

        if (
            DB::table(
                'hrm_analytics_saved_reports'
            )
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->where(
                    'code',
                    $validated['code']
                )
                ->exists()
        ) {
            throw ValidationException::withMessages([
                'code' => [
                    'This saved report code already exists.',
                ],
            ]);
        }

        $id =
            DB::table(
                'hrm_analytics_saved_reports'
            )
                ->insertGetId([
                    'uuid' =>
                        (string) Str::uuid(),

                    'tenant_id' =>
                        $tenantId,

                    'branch_id' =>
                        $branchId,

                    'owner_user_id' =>
                        $request->user()->id,

                    'code' =>
                        $validated['code'],

                    'name' =>
                        $validated['name'],

                    'report_type' =>
                        $validated['report_type'],

                    'visibility' =>
                        $validated['visibility'],

                    'filters_payload' =>
                        !empty(
                            $validated['filters']
                        )
                            ?
                            Crypt::encryptString(
                                json_encode(
                                    $validated['filters']
                                )
                            )
                            :
                            null,

                    'status' =>
                        'active',

                    'created_at' =>
                        now(),

                    'updated_at' =>
                        now(),
                ]);

        $this->audit(
            $audit,
            $scope,
            'hrm.analytics.saved_report.created',
            'hrm_analytics_saved_report',
            $id,
            [
                'report_id' =>
                    $id,

                'report_type' =>
                    $validated['report_type'],

                'visibility' =>
                    $validated['visibility'],
            ]
        );

        return response()->json([
            'message' =>
                'Saved HR report created.',

            'report_id' =>
                $id,
        ], 201);
    }

    public function updateReport(
        Request $request,
        int $reportId,
        ScopeResolver $scopeResolver,
        AuditLogService $audit
    ): JsonResponse {
        [
            'tenant' => $tenant,
            'scope' => $scope,
        ] = $this->context(
            $request,
            $scopeResolver
        );

        $validated =
            $request->validate([
                'name' => [
                    'required',
                    'string',
                    'max:191',
                ],

                'visibility' => [
                    'required',
                    'in:private,branch,tenant',
                ],

                'filters' => [
                    'nullable',
                    'array',
                ],
            ]);

        $report =
            $this->ownedReport(
                (int) $tenant->id,
                $scope,
                (int) $request->user()->id,
                $reportId
            );

        if (
            $this->branchId($scope) !== null
            &&
            $validated['visibility'] ===
            'tenant'
        ) {
            throw ValidationException::withMessages([
                'visibility' => [
                    'Branch-scoped users cannot create tenant-wide saved reports.',
                ],
            ]);
        }

        DB::table(
            'hrm_analytics_saved_reports'
        )
            ->where(
                'id',
                $report->id
            )
            ->update([
                'name' =>
                    $validated['name'],

                'visibility' =>
                    $validated['visibility'],

                'filters_payload' =>
                    !empty(
                        $validated['filters']
                    )
                        ?
                        Crypt::encryptString(
                            json_encode(
                                $validated['filters']
                            )
                        )
                        :
                        null,

                'updated_at' =>
                    now(),
            ]);

        $this->audit(
            $audit,
            $scope,
            'hrm.analytics.saved_report.updated',
            'hrm_analytics_saved_report',
            $report->id,
            [
                'report_id' =>
                    $report->id,
            ]
        );

        return response()->json([
            'message' =>
                'Saved HR report updated.',
        ]);
    }

    public function archiveReport(
        Request $request,
        int $reportId,
        ScopeResolver $scopeResolver,
        AuditLogService $audit
    ): JsonResponse {
        [
            'tenant' => $tenant,
            'scope' => $scope,
        ] = $this->context(
            $request,
            $scopeResolver
        );

        $report =
            $this->ownedReport(
                (int) $tenant->id,
                $scope,
                (int) $request->user()->id,
                $reportId
            );

        DB::table(
            'hrm_analytics_saved_reports'
        )
            ->where(
                'id',
                $report->id
            )
            ->update([
                'status' =>
                    'archived',

                'updated_at' =>
                    now(),
            ]);

        $this->audit(
            $audit,
            $scope,
            'hrm.analytics.saved_report.archived',
            'hrm_analytics_saved_report',
            $report->id,
            [
                'report_id' =>
                    $report->id,
            ]
        );

        return response()->json([
            'message' =>
                'Saved HR report archived.',
        ]);
    }

    public function snapshots(
        Request $request,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        [
            'tenant' => $tenant,
            'scope' => $scope,
        ] = $this->context(
            $request,
            $scopeResolver
        );

        $query =
            DB::table(
                'hrm_analytics_snapshots'
            )
                ->where(
                    'tenant_id',
                    $tenant->id
                );

        $branchId =
            $this->branchId($scope);

        if ($branchId !== null) {
            $query->where(
                'branch_id',
                $branchId
            );
        }

        $items =
            $query
                ->orderByDesc(
                    'captured_at'
                )
                ->limit(24)
                ->get()
                ->map(
                    function ($row) {
                        $row->metrics =
                            $this->decrypt(
                                $row->metrics_payload
                            );

                        unset(
                            $row->metrics_payload
                        );

                        return $row;
                    }
                );

        return response()->json([
            'items' =>
                $items,
        ]);
    }

    public function captureSnapshot(
        Request $request,
        ScopeResolver $scopeResolver,
        AuditLogService $audit
    ): JsonResponse {
        [
            'tenant' => $tenant,
            'scope' => $scope,
        ] = $this->context(
            $request,
            $scopeResolver
        );

        $tenantId =
            (int) $tenant->id;

        $metrics =
            $this->overviewData(
                $tenantId,
                $scope
            );

        $id =
            DB::table(
                'hrm_analytics_snapshots'
            )
                ->insertGetId([
                    'uuid' =>
                        (string) Str::uuid(),

                    'tenant_id' =>
                        $tenantId,

                    'branch_id' =>
                        $this->branchId(
                            $scope
                        ),

                    'captured_at' =>
                        now(),

                    'metrics_payload' =>
                        Crypt::encryptString(
                            json_encode(
                                $metrics
                            )
                        ),

                    'captured_by' =>
                        $request->user()->id,

                    'created_at' =>
                        now(),

                    'updated_at' =>
                        now(),
                ]);

        $this->audit(
            $audit,
            $scope,
            'hrm.analytics.snapshot.captured',
            'hrm_analytics_snapshot',
            $id,
            [
                'snapshot_id' =>
                    $id,

                'aggregate_only' =>
                    true,
            ]
        );

        return response()->json([
            'message' =>
                'HR analytics snapshot captured.',

            'snapshot_id' =>
                $id,
        ], 201);
    }

    public function export(
        Request $request,
        string $dataset,
        ScopeResolver $scopeResolver,
        AuditLogService $audit
    ) {
        if (
            !in_array(
                $dataset,
                [
                    'executive',
                    'workforce',
                    'operations',
                    'talent',
                ],
                true
            )
        ) {
            abort(404);
        }

        [
            'tenant' => $tenant,
            'scope' => $scope,
        ] = $this->context(
            $request,
            $scopeResolver
        );

        $tenantId =
            (int) $tenant->id;

        $data =
            match ($dataset) {
                'executive' =>
                    $this->overviewData(
                        $tenantId,
                        $scope
                    ),

                'workforce' =>
                    $this->workforceData(
                        $tenantId,
                        $scope
                    ),

                'operations' =>
                    $this->operationsData(
                        $tenantId,
                        $scope
                    ),

                'talent' =>
                    $this->talentData(
                        $tenantId,
                        $scope
                    ),
            };

        $rows =
            $this->flattenAggregate(
                $data
            );

        $csv =
            $this->toCsv($rows);

        $exportId =
            DB::table(
                'hrm_analytics_exports'
            )
                ->insertGetId([
                    'uuid' =>
                        (string) Str::uuid(),

                    'tenant_id' =>
                        $tenantId,

                    'branch_id' =>
                        $this->branchId(
                            $scope
                        ),

                    'report_type' =>
                        $dataset,

                    'format' =>
                        'csv',

                    'row_count' =>
                        count($rows),

                    'checksum' =>
                        hash(
                            'sha256',
                            $csv
                        ),

                    'requested_by' =>
                        $request->user()->id,

                    'requested_at' =>
                        now(),

                    'created_at' =>
                        now(),

                    'updated_at' =>
                        now(),
                ]);

        $this->audit(
            $audit,
            $scope,
            'hrm.analytics.export.generated',
            'hrm_analytics_export',
            $exportId,
            [
                'export_id' =>
                    $exportId,

                'dataset' =>
                    $dataset,

                'row_count' =>
                    count($rows),

                'aggregate_only' =>
                    true,
            ]
        );

        $filename =
            'hrm-'
            . $dataset
            . '-analytics-'
            . now()->format('Ymd-His')
            . '.csv';

        return response(
            $csv,
            200,
            [
                'Content-Type' =>
                    'text/csv; charset=UTF-8',

                'Content-Disposition' =>
                    'attachment; filename="'
                    . $filename
                    . '"',

                'Cache-Control' =>
                    'no-store, private',
            ]
        );
    }


    # ============================================================
    # ANALYTICS BUILDERS
    # ============================================================

    private function overviewData(
        int $tenantId,
        $scope
    ): array {
        $workforce =
            $this->workforceData(
                $tenantId,
                $scope
            );

        $operations =
            $this->operationsData(
                $tenantId,
                $scope
            );

        $talent =
            $this->talentData(
                $tenantId,
                $scope
            );

        return [
            'summary' => [
                'active_headcount' =>
                    $workforce[
                        'summary'
                    ][
                        'active_headcount'
                    ],

                'total_headcount' =>
                    $workforce[
                        'summary'
                    ][
                        'total_headcount'
                    ],

                'new_hires_30d' =>
                    $workforce[
                        'summary'
                    ][
                        'new_hires_30d'
                    ],

                'exits_30d' =>
                    $workforce[
                        'summary'
                    ][
                        'exits_30d'
                    ],

                'pending_leave' =>
                    $operations[
                        'summary'
                    ][
                        'pending_leave'
                    ],

                'attendance_records_30d' =>
                    $operations[
                        'summary'
                    ][
                        'attendance_records_30d'
                    ],

                'open_goals' =>
                    $talent[
                        'summary'
                    ][
                        'open_goals'
                    ],

                'pending_reviews' =>
                    $talent[
                        'summary'
                    ][
                        'pending_reviews'
                    ],

                'active_learning' =>
                    $talent[
                        'summary'
                    ][
                        'active_learning'
                    ],

                'valid_certifications' =>
                    $talent[
                        'summary'
                    ][
                        'valid_certifications'
                    ],
            ],

            'branch_headcount' =>
                $workforce[
                    'branch_headcount'
                ],

            'employment_status' =>
                $workforce[
                    'employment_status'
                ],

            'position_headcount' =>
                $workforce[
                    'position_headcount'
                ],

            'movement_monthly' =>
                $workforce[
                    'movement_monthly'
                ],

            'generated_at' =>
                now()->toIso8601String(),

            'controls' => [
                'aggregate_only' =>
                    true,

                'automated_hr_decision' =>
                    false,

                'employee_relations_narrative' =>
                    false,

                'compensation_history_write' =>
                    false,

                'automatic_payroll_recalculation' =>
                    false,

                'automatic_payroll_approval' =>
                    false,

                'finance_posting' =>
                    false,
            ],
        ];
    }

    private function workforceData(
        int $tenantId,
        $scope
    ): array {
        $employees =
            $this->employeeScope(
                $tenantId,
                $scope
            );

        $total =
            (clone $employees)
                ->count();

        $active =
            (clone $employees)
                ->whereNotIn(
                    'e.employment_status',
                    [
                        'terminated',
                        'inactive',
                    ]
                )
                ->count();

        $hireColumn =
            $this->firstColumn(
                'hrm_employees',
                [
                    'hire_date',
                    'employment_start_date',
                    'start_date',
                    'date_hired',
                ]
            );

        $terminationColumn =
            $this->firstColumn(
                'hrm_employees',
                [
                    'termination_date',
                    'terminated_at',
                    'end_date',
                ]
            );

        $since =
            now()
                ->subDays(30)
                ->toDateString();

        $newHires =
            $hireColumn
                ?
                (clone $employees)
                    ->whereDate(
                        'e.' . $hireColumn,
                        '>=',
                        $since
                    )
                    ->count()
                :
                0;

        $exits =
            $terminationColumn
                ?
                (clone $employees)
                    ->whereNotNull(
                        'e.' . $terminationColumn
                    )
                    ->whereDate(
                        'e.' . $terminationColumn,
                        '>=',
                        $since
                    )
                    ->count()
                :
                0;

        $branchRows =
            (clone $employees)
                ->leftJoin(
                    'branches as b',
                    'b.id',
                    '=',
                    'e.home_branch_id'
                )
                ->selectRaw(
                    "COALESCE(b.name, 'Unassigned') as label, COUNT(*) as value"
                )
                ->groupBy(
                    'e.home_branch_id',
                    'b.name'
                )
                ->orderByDesc('value')
                ->get();

        $statusRows =
            (clone $employees)
                ->selectRaw(
                    "COALESCE(e.employment_status, 'unknown') as label, COUNT(*) as value"
                )
                ->groupBy(
                    'e.employment_status'
                )
                ->orderByDesc('value')
                ->get();

        $positionRows =
            (clone $employees)
                ->leftJoin(
                    'hrm_positions as p',
                    'p.id',
                    '=',
                    'e.current_position_id'
                )
                ->selectRaw(
                    "COALESCE(p.title, 'Unassigned') as label, COUNT(*) as value"
                )
                ->groupBy(
                    'e.current_position_id',
                    'p.title'
                )
                ->orderByDesc('value')
                ->limit(12)
                ->get();

        $movement =
            [];

        for ($i = 11; $i >= 0; $i--) {
            $month =
                now()
                    ->startOfMonth()
                    ->subMonths($i);

            $start =
                $month
                    ->copy()
                    ->startOfMonth()
                    ->toDateString();

            $end =
                $month
                    ->copy()
                    ->endOfMonth()
                    ->toDateString();

            $hires =
                $hireColumn
                    ?
                    (clone $employees)
                        ->whereDate(
                            'e.' . $hireColumn,
                            '>=',
                            $start
                        )
                        ->whereDate(
                            'e.' . $hireColumn,
                            '<=',
                            $end
                        )
                        ->count()
                    :
                    0;

            $monthExits =
                $terminationColumn
                    ?
                    (clone $employees)
                        ->whereNotNull(
                            'e.' . $terminationColumn
                        )
                        ->whereDate(
                            'e.' . $terminationColumn,
                            '>=',
                            $start
                        )
                        ->whereDate(
                            'e.' . $terminationColumn,
                            '<=',
                            $end
                        )
                        ->count()
                    :
                    0;

            $movement[] = [
                'month' =>
                    $month->format('M Y'),

                'hires' =>
                    $hires,

                'exits' =>
                    $monthExits,
            ];
        }

        return [
            'summary' => [
                'total_headcount' =>
                    $total,

                'active_headcount' =>
                    $active,

                'new_hires_30d' =>
                    $newHires,

                'exits_30d' =>
                    $exits,
            ],

            'branch_headcount' =>
                $branchRows,

            'employment_status' =>
                $statusRows,

            'position_headcount' =>
                $positionRows,

            'movement_monthly' =>
                $movement,
        ];
    }

    private function operationsData(
        int $tenantId,
        $scope
    ): array {
        $attendance =
            $this->statusCounts(
                'hrm_attendance_records',
                $tenantId,
                $scope
            );

        $leave =
            $this->statusCounts(
                'hrm_leave_requests',
                $tenantId,
                $scope
            );

        $overtime =
            $this->statusCounts(
                'hrm_overtime_requests',
                $tenantId,
                $scope
            );

        $pendingLeave =
            $this->statusTotal(
                $leave,
                [
                    'draft',
                    'submitted',
                    'pending',
                    'under_review',
                ]
            );

        $pendingOvertime =
            $this->statusTotal(
                $overtime,
                [
                    'draft',
                    'submitted',
                    'pending',
                    'under_review',
                ]
            );

        $attendance30 =
            $this->recentCount(
                'hrm_attendance_records',
                $tenantId,
                $scope,
                [
                    'attendance_date',
                    'work_date',
                    'date',
                ],
                30
            );

        return [
            'summary' => [
                'attendance_records_30d' =>
                    $attendance30,

                'pending_leave' =>
                    $pendingLeave,

                'pending_overtime' =>
                    $pendingOvertime,
            ],

            'attendance_status' =>
                $attendance,

            'leave_status' =>
                $leave,

            'overtime_status' =>
                $overtime,
        ];
    }

    private function talentData(
        int $tenantId,
        $scope
    ): array {
        $goals =
            $this->statusCounts(
                'hrm_performance_goals',
                $tenantId,
                $scope
            );

        $reviews =
            $this->statusCounts(
                'hrm_performance_reviews',
                $tenantId,
                $scope
            );

        $development =
            $this->statusCounts(
                'hrm_development_plans',
                $tenantId,
                $scope
            );

        $learning =
            $this->statusCounts(
                'hrm_learning_enrollments',
                $tenantId,
                $scope
            );

        $certifications =
            $this->statusCounts(
                'hrm_learning_certifications',
                $tenantId,
                $scope
            );

        return [
            'summary' => [
                'open_goals' =>
                    $this->statusTotal(
                        $goals,
                        [
                            'active',
                            'in_progress',
                        ]
                    ),

                'pending_reviews' =>
                    $this->statusTotal(
                        $reviews,
                        [
                            'draft',
                            'submitted',
                        ]
                    ),

                'active_development' =>
                    $this->statusTotal(
                        $development,
                        [
                            'active',
                            'in_progress',
                        ]
                    ),

                'active_learning' =>
                    $this->statusTotal(
                        $learning,
                        [
                            'enrolled',
                            'in_progress',
                        ]
                    ),

                'valid_certifications' =>
                    $this->statusTotal(
                        $certifications,
                        [
                            'valid',
                        ]
                    ),
            ],

            'performance_goals' =>
                $goals,

            'performance_reviews' =>
                $reviews,

            'development_plans' =>
                $development,

            'learning_enrollments' =>
                $learning,

            'certifications' =>
                $certifications,
        ];
    }


    # ============================================================
    # SAFE SCOPED AGGREGATION HELPERS
    # ============================================================

    private function employeeScope(
        int $tenantId,
        $scope
    ) {
        $query =
            DB::table(
                'hrm_employees as e'
            )
                ->where(
                    'e.tenant_id',
                    $tenantId
                );

        $branchId =
            $this->branchId(
                $scope
            );

        if ($branchId !== null) {
            $query->where(
                'e.home_branch_id',
                $branchId
            );
        }

        return $query;
    }

    private function statusCounts(
        string $table,
        int $tenantId,
        $scope
    ): Collection {
        if (
            !Schema::hasTable($table)
            ||
            !Schema::hasColumn(
                $table,
                'status'
            )
        ) {
            return collect();
        }

        $query =
            DB::table(
                $table . ' as x'
            );

        if (
            Schema::hasColumn(
                $table,
                'tenant_id'
            )
        ) {
            $query->where(
                'x.tenant_id',
                $tenantId
            );
        }

        $branchId =
            $this->branchId(
                $scope
            );

        if ($branchId !== null) {
            if (
                Schema::hasColumn(
                    $table,
                    'employee_id'
                )
            ) {
                $query
                    ->join(
                        'hrm_employees as e',
                        'e.id',
                        '=',
                        'x.employee_id'
                    )
                    ->where(
                        'e.home_branch_id',
                        $branchId
                    );
            } elseif (
                Schema::hasColumn(
                    $table,
                    'branch_id'
                )
            ) {
                $query->where(
                    'x.branch_id',
                    $branchId
                );
            } else {
                return collect();
            }
        }

        return $query
            ->selectRaw(
                "COALESCE(x.status, 'unknown') as label, COUNT(*) as value"
            )
            ->groupBy('x.status')
            ->orderByDesc('value')
            ->get();
    }

    private function recentCount(
        string $table,
        int $tenantId,
        $scope,
        array $candidateDateColumns,
        int $days
    ): int {
        if (!Schema::hasTable($table)) {
            return 0;
        }

        $query =
            DB::table(
                $table . ' as x'
            );

        if (
            Schema::hasColumn(
                $table,
                'tenant_id'
            )
        ) {
            $query->where(
                'x.tenant_id',
                $tenantId
            );
        }

        $branchId =
            $this->branchId(
                $scope
            );

        if ($branchId !== null) {
            if (
                Schema::hasColumn(
                    $table,
                    'employee_id'
                )
            ) {
                $query
                    ->join(
                        'hrm_employees as e',
                        'e.id',
                        '=',
                        'x.employee_id'
                    )
                    ->where(
                        'e.home_branch_id',
                        $branchId
                    );
            } elseif (
                Schema::hasColumn(
                    $table,
                    'branch_id'
                )
            ) {
                $query->where(
                    'x.branch_id',
                    $branchId
                );
            } else {
                return 0;
            }
        }

        $dateColumn =
            $this->firstColumn(
                $table,
                $candidateDateColumns
            );

        if ($dateColumn) {
            $query->whereDate(
                'x.' . $dateColumn,
                '>=',
                now()
                    ->subDays($days)
                    ->toDateString()
            );
        }

        return $query->count();
    }

    private function statusTotal(
        Collection $rows,
        array $statuses
    ): int {
        $wanted =
            array_map(
                static fn ($value) =>
                    strtolower(
                        (string) $value
                    ),
                $statuses
            );

        return (int)
            $rows
                ->filter(
                    static function ($row) use (
                        $wanted
                    ) {
                        return in_array(
                            strtolower(
                                (string)
                                (
                                    $row->label
                                    ?? ''
                                )
                            ),
                            $wanted,
                            true
                        );
                    }
                )
                ->sum('value');
    }

    private function firstColumn(
        string $table,
        array $candidates
    ): ?string {
        if (!Schema::hasTable($table)) {
            return null;
        }

        foreach ($candidates as $column) {
            if (
                Schema::hasColumn(
                    $table,
                    $column
                )
            ) {
                return $column;
            }
        }

        return null;
    }


    # ============================================================
    # SAVED REPORT SECURITY
    # ============================================================

    private function visibleReports(
        int $tenantId,
        $scope,
        int $userId
    ): Collection {
        $query =
            DB::table(
                'hrm_analytics_saved_reports'
            )
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->where(
                    'status',
                    'active'
                );

        $branchId =
            $this->branchId(
                $scope
            );

        if ($branchId !== null) {
            $query->where(
                function ($nested) use (
                    $branchId,
                    $userId
                ) {
                    $nested
                        ->where(
                            'visibility',
                            'tenant'
                        )
                        ->orWhere(
                            function ($branch) use (
                                $branchId
                            ) {
                                $branch
                                    ->where(
                                        'visibility',
                                        'branch'
                                    )
                                    ->where(
                                        'branch_id',
                                        $branchId
                                    );
                            }
                        )
                        ->orWhere(
                            function ($private) use (
                                $userId
                            ) {
                                $private
                                    ->where(
                                        'visibility',
                                        'private'
                                    )
                                    ->where(
                                        'owner_user_id',
                                        $userId
                                    );
                            }
                        );
                }
            );
        } else {
            $query->where(
                function ($nested) use (
                    $userId
                ) {
                    $nested
                        ->whereIn(
                            'visibility',
                            [
                                'tenant',
                                'branch',
                            ]
                        )
                        ->orWhere(
                            function ($private) use (
                                $userId
                            ) {
                                $private
                                    ->where(
                                        'visibility',
                                        'private'
                                    )
                                    ->where(
                                        'owner_user_id',
                                        $userId
                                    );
                            }
                        );
                }
            );
        }

        return $query
            ->orderBy('name')
            ->get();
    }

    private function ownedReport(
        int $tenantId,
        $scope,
        int $userId,
        int $reportId
    ): object {
        $query =
            DB::table(
                'hrm_analytics_saved_reports'
            )
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->where(
                    'id',
                    $reportId
                )
                ->where(
                    'owner_user_id',
                    $userId
                )
                ->where(
                    'status',
                    'active'
                );

        $branchId =
            $this->branchId(
                $scope
            );

        if ($branchId !== null) {
            $query->where(
                'branch_id',
                $branchId
            );
        }

        $row =
            $query->first();

        if (!$row) {
            abort(404);
        }

        return $row;
    }


    # ============================================================
    # EXPORT HELPERS
    # ============================================================

    private function flattenAggregate(
        array $data
    ): array {
        $rows = [];

        $walk =
            function (
                $value,
                string $path
            ) use (
                &$rows,
                &$walk
            ): void {
                if (
                    is_scalar($value)
                    ||
                    $value === null
                ) {
                    $rows[] = [
                        'metric' =>
                            $path,

                        'value' =>
                            $value,
                    ];

                    return;
                }

                if ($value instanceof Collection) {
                    $value =
                        $value->toArray();
                }

                if (is_object($value)) {
                    $value =
                        (array) $value;
                }

                if (!is_array($value)) {
                    return;
                }

                foreach (
                    $value
                    as $key => $item
                ) {
                    $next =
                        $path === ''
                            ?
                            (string) $key
                            :
                            $path
                            . '.'
                            . $key;

                    $walk(
                        $item,
                        $next
                    );
                }
            };

        $walk(
            $data,
            ''
        );

        return $rows;
    }

    private function toCsv(
        array $rows
    ): string {
        $stream =
            fopen(
                'php://temp',
                'w+'
            );

        fputcsv(
            $stream,
            [
                'Metric',
                'Value',
            ]
        );

        foreach ($rows as $row) {
            fputcsv(
                $stream,
                [
                    $row['metric'],
                    is_bool(
                        $row['value']
                    )
                        ?
                        (
                            $row['value']
                                ?
                                'true'
                                :
                                'false'
                        )
                        :
                        $row['value'],
                ]
            );
        }

        rewind($stream);

        $csv =
            stream_get_contents(
                $stream
            );

        fclose($stream);

        return $csv;
    }


    # ============================================================
    # COMMON HELPERS
    # ============================================================

    private function context(
        Request $request,
        ScopeResolver $scopeResolver
    ): array {
        return $this->tenantContext
            ->resolve(
                $request,
                $scopeResolver
            );
    }

    private function branchId(
        $scope
    ): ?int {
        if (
            $scope->isBranch()
            &&
            $scope->branchId !== null
        ) {
            return
                (int) $scope->branchId;
        }

        return null;
    }

    private function decrypt(
        ?string $payload
    ): array {
        if (!$payload) {
            return [];
        }

        try {
            $value =
                json_decode(
                    Crypt::decryptString(
                        $payload
                    ),
                    true
                );

            return
                is_array($value)
                    ?
                    $value
                    :
                    [];
        } catch (Throwable) {
            return [];
        }
    }

    private function audit(
        AuditLogService $audit,
        $scope,
        string $action,
        string $type,
        int $id,
        array $metadata
    ): void {
        $audit->record(
            action:
                $action,

            scope:
                $scope,

            metadata:
                $metadata,

            dataClassification:
                'internal',

            auditableType:
                $type,

            auditableId:
                $id
        );
    }
}
