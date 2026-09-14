<?php

namespace App\Http\Controllers\Api\V1\Hrm;

use App\Http\Controllers\Controller;
use App\Models\Hrm\Employee;
use App\Models\Hrm\PayrollEmployeeStatutoryProfile;
use App\Services\Access\ScopeResolver;
use App\Services\Audit\AuditLogService;
use App\Services\Hrm\HrmTenantContextService;
use App\Services\Hrm\Payroll\PayrollEngineService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class PayrollEngineController extends Controller
{
    public function __construct(
        private readonly HrmTenantContextService $tenantContext,
        private readonly PayrollEngineService $payroll
    ) {
    }


    private function context(
        Request $request,
        ScopeResolver $scopeResolver
    ): array {
        return $this
            ->tenantContext
            ->resolve(
                $request,
                $scopeResolver
            );
    }


    public function overview(
        Request $request,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        [
            'tenant' => $tenant,
            'scope' => $scope,
        ] =
            $this->context(
                $request,
                $scopeResolver
            );


        return response()->json(
            $this->payroll->overview(
                $tenant->id,
                $scope->isBranch()
                ? $scope->branchId
                : null
            )
        );
    }


    public function statutoryRules(
        Request $request,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        $this->context(
            $request,
            $scopeResolver
        );


        $rules = DB::table(
            'payroll_statutory_rule_versions'
        )
            ->where(
                'status',
                'active'
            )
            ->orderBy(
                'code'
            )
            ->orderBy(
                'effective_from'
            )
            ->get();


        return response()->json([
            'rules' =>
                $rules,

            'finance_posting_created' =>
                false,
        ]);
    }


    public function statutoryProfile(
        Request $request,
        int $employeeId,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        [
            'tenant' => $tenant,
            'scope' => $scope,
        ] =
            $this->context(
                $request,
                $scopeResolver
            );


        $employee =
            $this->scopedEmployee(
                $tenant->id,
                $scope->isBranch()
                ? $scope->branchId
                : null,
                $employeeId
            );


        $profile =
            PayrollEmployeeStatutoryProfile::query()
                ->where(
                    'tenant_id',
                    $tenant->id
                )
                ->where(
                    'employee_id',
                    $employee->id
                )
                ->where(
                    'status',
                    'active'
                )
                ->first();


        $data =
            $profile
            ? (
                $profile
                    ->statutory_payload
                ?: []
            )
            : [];


        return response()->json([
            'employee' => [
                'id' =>
                    $employee->id,

                'employee_number' =>
                    $employee
                        ->employee_number,

                'display_name' =>
                    trim(
                        $employee
                            ->first_name
                        . ' '
                        . (
                            $employee
                                ->middle_name
                            ? $employee
                                ->middle_name
                                . ' '
                            : ''
                        )
                        . $employee
                            ->last_name
                    ),
            ],

            'profile' => [
                'id' =>
                    $profile?->id,

                'employee_category' =>
                    $profile
                    ? $profile
                        ->employee_category
                    : null,

                'rssb_number_masked' =>
                    $this->mask(
                        $data[
                            'rssb_number'
                        ]
                        ?? null
                    ),

                'identity_type' =>
                    $data[
                        'identity_type'
                    ]
                    ?? null,

                'identity_number_masked' =>
                    $this->mask(
                        $data[
                            'identity_number'
                        ]
                        ?? null
                    ),

                'rama_member' =>
                    $data[
                        'rama_member'
                    ]
                    ?? null,

                'paye_employer_type' =>
                    $data[
                        'paye_employer_type'
                    ]
                    ?? null,

                'paye_category' =>
                    $data[
                        'paye_category'
                    ]
                    ?? 'regular',

                'status' =>
                    $profile
                    ? $profile
                        ->status
                    : 'not_configured',
            ],
        ]);
    }


    public function updateStatutoryProfile(
        Request $request,
        int $employeeId,
        ScopeResolver $scopeResolver,
        AuditLogService $auditLogService
    ): JsonResponse {
        [
            'tenant' => $tenant,
            'scope' => $scope,
        ] =
            $this->context(
                $request,
                $scopeResolver
            );


        $employee =
            $this->scopedEmployee(
                $tenant->id,
                $scope->isBranch()
                ? $scope->branchId
                : null,
                $employeeId
            );


        $validated =
            $request->validate([
                'employee_category' => [
                    'required',
                    Rule::in([
                        'regular_employee',
                        'casual_worker',
                    ]),
                ],

                'rssb_number' => [
                    'required',
                    'string',
                    'max:100',
                ],

                'identity_type' => [
                    'required',
                    Rule::in([
                        'nid',
                        'passport',
                    ]),
                ],

                'identity_number' => [
                    'required',
                    'string',
                    'max:100',
                ],

                'rama_member' => [
                    'required',
                    'boolean',
                ],

                'paye_employer_type' => [
                    'required',
                    Rule::in([
                        'first',
                        'secondary',
                    ]),
                ],

                'paye_category' => [
                    'required',
                    Rule::in([
                        'regular',
                        'casual',
                    ]),
                ],
            ]);


        $profile =
            PayrollEmployeeStatutoryProfile::query()
                ->firstOrNew([
                    'tenant_id' =>
                        $tenant->id,

                    'employee_id' =>
                        $employee->id,
                ]);


        $profile->employee_category =
            $validated[
                'employee_category'
            ];


        $profile->statutory_payload = [
            'rssb_number' =>
                trim(
                    $validated[
                        'rssb_number'
                    ]
                ),

            'identity_type' =>
                $validated[
                    'identity_type'
                ],

            'identity_number' =>
                trim(
                    $validated[
                        'identity_number'
                    ]
                ),

            'rama_member' =>
                (bool)
                $validated[
                    'rama_member'
                ],

            'paye_employer_type' =>
                $validated[
                    'paye_employer_type'
                ],

            'paye_category' =>
                $validated[
                    'paye_category'
                ],
        ];


        $profile->status =
            'active';


        if (! $profile->exists) {
            $profile->created_by =
                $request
                    ->user()
                    ->id;
        }


        $profile->updated_by =
            $request
                ->user()
                ->id;


        $profile->save();


        $auditLogService->record(
            action:
                'hrm.payroll.statutory_profile.updated',

            scope:
                $scope,

            metadata: [
                'employee_id' =>
                    $employee->id,

                'employee_number' =>
                    $employee
                        ->employee_number,

                'sensitive_identity_logged' =>
                    false,

                'finance_posting_created' =>
                    false,
            ],

            dataClassification:
                'sensitive',

            auditableType:
                PayrollEmployeeStatutoryProfile::class,

            auditableId:
                $profile->id
        );


        return $this->statutoryProfile(
            $request,
            $employeeId,
            $scopeResolver
        );
    }


    public function createPeriod(
        Request $request,
        ScopeResolver $scopeResolver,
        AuditLogService $auditLogService
    ): JsonResponse {
        [
            'tenant' => $tenant,
            'scope' => $scope,
        ] =
            $this->context(
                $request,
                $scopeResolver
            );


        $validated =
            $request->validate([
                'year' => [
                    'required',
                    'integer',
                    'min:2025',
                    'max:2035',
                ],

                'month' => [
                    'required',
                    'integer',
                    'min:1',
                    'max:12',
                ],

                'branch_id' => [
                    'nullable',
                    'integer',
                ],
            ]);


        $period =
            $this->payroll->createPeriod(
                $tenant->id,

                $scope->isBranch()
                ? $scope->branchId
                : null,

                (int)
                $validated[
                    'year'
                ],

                (int)
                $validated[
                    'month'
                ],

                isset(
                    $validated[
                        'branch_id'
                    ]
                )
                ? (int)
                    $validated[
                        'branch_id'
                    ]
                : null,

                $request
                    ->user()
                    ->id
            );


        $auditLogService->record(
            action:
                'hrm.payroll.period.created',

            scope:
                $scope,

            metadata: [
                'period_id' =>
                    $period->id,

                'finance_posting_created' =>
                    false,
            ],

            dataClassification:
                'internal',

            auditableType:
                'payroll_period',

            auditableId:
                $period->id
        );


        return response()->json([
            'period' =>
                $period,

            'finance_posting_created' =>
                false,
        ], 201);
    }


    public function createRun(
        Request $request,
        ScopeResolver $scopeResolver,
        AuditLogService $auditLogService
    ): JsonResponse {
        [
            'tenant' => $tenant,
            'scope' => $scope,
        ] =
            $this->context(
                $request,
                $scopeResolver
            );


        $validated =
            $request->validate([
                'payroll_period_id' => [
                    'required',
                    'integer',
                ],
            ]);


        $result =
            $this->payroll->createRun(
                $tenant->id,

                $scope->isBranch()
                ? $scope->branchId
                : null,

                (int)
                $validated[
                    'payroll_period_id'
                ],

                $request
                    ->user()
                    ->id
            );


        $auditLogService->record(
            action:
                'hrm.payroll.run.created',

            scope:
                $scope,

            metadata: [
                'run_id' =>
                    $result[
                        'run'
                    ]->id,

                'finance_posting_created' =>
                    false,
            ],

            dataClassification:
                'sensitive',

            auditableType:
                'payroll_run',

            auditableId:
                $result[
                    'run'
                ]->id
        );


        return response()->json(
            $result,
            201
        );
    }


    public function showRun(
        Request $request,
        int $runId,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        [
            'tenant' => $tenant,
            'scope' => $scope,
        ] =
            $this->context(
                $request,
                $scopeResolver
            );


        return response()->json(
            $this->payroll->runDetail(
                $tenant->id,

                $scope->isBranch()
                ? $scope->branchId
                : null,

                $runId
            )
        );
    }


    public function prepareRun(
        Request $request,
        int $runId,
        ScopeResolver $scopeResolver,
        AuditLogService $auditLogService
    ): JsonResponse {
        [
            'tenant' => $tenant,
            'scope' => $scope,
        ] =
            $this->context(
                $request,
                $scopeResolver
            );


        $result =
            $this->payroll->prepareRun(
                $tenant->id,

                $scope->isBranch()
                ? $scope->branchId
                : null,

                $runId,

                $request
                    ->user()
                    ->id
            );


        $auditLogService->record(
            action:
                'hrm.payroll.run.prepared',

            scope:
                $scope,

            metadata: [
                'run_id' =>
                    $runId,

                'finance_posting_created' =>
                    false,
            ],

            dataClassification:
                'sensitive',

            auditableType:
                'payroll_run',

            auditableId:
                $runId
        );


        return response()->json(
            $result
        );
    }


    public function updateEmployeeInputs(
        Request $request,
        int $runId,
        int $runEmployeeId,
        ScopeResolver $scopeResolver,
        AuditLogService $auditLogService
    ): JsonResponse {
        [
            'tenant' => $tenant,
            'scope' => $scope,
        ] =
            $this->context(
                $request,
                $scopeResolver
            );


        $rules = [];


        foreach (
            PayrollEngineService::INPUT_COMPONENTS
            as $code
        ) {
            $rules[
                'inputs.'
                . $code
            ] = [
                'sometimes',
                'numeric',
                'min:0',
                'max:999999999999',
            ];
        }


        $rules[
            'review_notes'
        ] = [
            'nullable',
            'string',
            'max:2000',
        ];


        $validated =
            $request->validate(
                $rules
            );


        $result =
            $this->payroll
                ->updateEmployeeInputs(
                    $tenant->id,

                    $scope->isBranch()
                    ? $scope->branchId
                    : null,

                    $runId,

                    $runEmployeeId,

                    $validated[
                        'inputs'
                    ]
                    ?? [],

                    $validated[
                        'review_notes'
                    ]
                    ?? null,

                    $request
                        ->user()
                        ->id
                );


        $auditLogService->record(
            action:
                'hrm.payroll.employee_inputs.updated',

            scope:
                $scope,

            metadata: [
                'run_id' =>
                    $runId,

                'run_employee_id' =>
                    $runEmployeeId,

                'finance_posting_created' =>
                    false,
            ],

            dataClassification:
                'sensitive',

            auditableType:
                'payroll_run_employee',

            auditableId:
                $runEmployeeId
        );


        return response()->json(
            $result
        );
    }


    public function submitRun(
        Request $request,
        int $runId,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        [
            'tenant' => $tenant,
            'scope' => $scope,
        ] =
            $this->context(
                $request,
                $scopeResolver
            );


        $validated =
            $request->validate([
                'comments' => [
                    'nullable',
                    'string',
                    'max:2000',
                ],
            ]);


        return response()->json(
            $this->payroll->submitRun(
                $tenant->id,

                $scope->isBranch()
                ? $scope->branchId
                : null,

                $runId,

                $request
                    ->user()
                    ->id,

                $validated[
                    'comments'
                ]
                ?? null
            )
        );
    }


    public function rejectRun(
        Request $request,
        int $runId,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        [
            'tenant' => $tenant,
            'scope' => $scope,
        ] =
            $this->context(
                $request,
                $scopeResolver
            );


        $validated =
            $request->validate([
                'comments' => [
                    'required',
                    'string',
                    'max:2000',
                ],
            ]);


        return response()->json(
            $this->payroll->rejectRun(
                $tenant->id,

                $scope->isBranch()
                ? $scope->branchId
                : null,

                $runId,

                $request
                    ->user()
                    ->id,

                trim(
                    $validated[
                        'comments'
                    ]
                )
            )
        );
    }


    public function approveRun(
        Request $request,
        int $runId,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        [
            'tenant' => $tenant,
            'scope' => $scope,
        ] =
            $this->context(
                $request,
                $scopeResolver
            );


        $validated =
            $request->validate([
                'comments' => [
                    'nullable',
                    'string',
                    'max:2000',
                ],
            ]);


        return response()->json(
            $this->payroll->approveRun(
                $tenant->id,

                $scope->isBranch()
                ? $scope->branchId
                : null,

                $runId,

                $request
                    ->user()
                    ->id,

                $validated[
                    'comments'
                ]
                ?? null
            )
        );
    }


    private function scopedEmployee(
        int $tenantId,
        ?int $branchId,
        int $employeeId
    ): Employee {
        $query =
            Employee::query()
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->where(
                    'id',
                    $employeeId
                );


        if (
            $branchId !== null
        ) {
            $query->where(
                'home_branch_id',
                $branchId
            );
        }


        return $query
            ->firstOrFail();
    }


    private function mask(
        mixed $value
    ): ?string {
        if (
            $value === null
            ||
            trim(
                (string) $value
            ) === ''
        ) {
            return null;
        }


        $text =
            trim(
                (string) $value
            );


        if (
            strlen($text)
            <= 4
        ) {
            return str_repeat(
                '*',
                strlen($text)
            );
        }


        return
            str_repeat(
                '*',
                strlen($text) - 4
            )
            .
            substr(
                $text,
                -4
            );
    }
}
