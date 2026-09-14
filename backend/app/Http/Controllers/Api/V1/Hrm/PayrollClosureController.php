<?php

namespace App\Http\Controllers\Api\V1\Hrm;

use App\Http\Controllers\Controller;
use App\Services\Access\ScopeContext;
use App\Services\Access\ScopeResolver;
use App\Services\Audit\AuditLogService;
use App\Services\Hrm\HrmTenantContextService;
use App\Services\Hrm\Payroll\PayrollClosureService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Throwable;

class PayrollClosureController extends Controller
{
    public function __construct(
        private readonly HrmTenantContextService $tenantContext,
        private readonly PayrollClosureService $closure
    ) {
    }

    public function overview(
        Request $request,
        int $runId,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        [
            'tenant' => $tenant,
            'scope' => $scope,
        ] =
            $this->tenantContext->resolve(
                $request,
                $scopeResolver
            );

        return response()->json(
            $this->closure->closureOverview(
                (int) $tenant->id,
                $scope,
                $runId
            )
        );
    }

    public function compliance(
        Request $request,
        int $runId,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        [
            'tenant' => $tenant,
            'scope' => $scope,
        ] =
            $this->tenantContext->resolve(
                $request,
                $scopeResolver
            );

        return response()->json(
            $this->closure->compliance(
                (int) $tenant->id,
                $scope,
                $runId
            )
        );
    }

    public function payslips(
        Request $request,
        int $runId,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        [
            'tenant' => $tenant,
            'scope' => $scope,
        ] =
            $this->tenantContext->resolve(
                $request,
                $scopeResolver
            );

        return response()->json(
            $this->closure->payslips(
                (int) $tenant->id,
                $scope,
                $runId
            )
        );
    }

    public function paymentProfile(
        Request $request,
        int $employeeId,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        [
            'tenant' => $tenant,
            'scope' => $scope,
        ] =
            $this->tenantContext->resolve(
                $request,
                $scopeResolver
            );

        $this->assertEmployeeScope(
            (int) $tenant->id,
            $scope,
            $employeeId
        );

        $profile =
            DB::table(
                'payroll_employee_payment_profiles'
            )
                ->where(
                    'tenant_id',
                    $tenant->id
                )
                ->where(
                    'employee_id',
                    $employeeId
                )
                ->first();

        return response()->json([
            'employee_id' =>
                $employeeId,

            'profile' =>
                $profile
                    ? $this->serializePaymentProfile(
                        $profile
                    )
                    : null,
        ]);
    }

    public function updatePaymentProfile(
        Request $request,
        int $employeeId,
        ScopeResolver $scopeResolver,
        AuditLogService $auditLogService
    ): JsonResponse {
        [
            'tenant' => $tenant,
            'scope' => $scope,
        ] =
            $this->tenantContext->resolve(
                $request,
                $scopeResolver
            );

        $this->assertEmployeeScope(
            (int) $tenant->id,
            $scope,
            $employeeId
        );

        $validated =
            $request->validate([
                'payment_method' => [
                    'required',
                    'string',
                    'in:bank_transfer,mobile_money,manual',
                ],

                'bank_name' => [
                    'nullable',
                    'string',
                    'max:100',
                ],

                'bank_code' => [
                    'nullable',
                    'string',
                    'max:50',
                ],

                'account_name' => [
                    'nullable',
                    'string',
                    'max:191',
                ],

                'account_number' => [
                    'nullable',
                    'string',
                    'max:100',
                ],

                'mobile_number' => [
                    'nullable',
                    'string',
                    'max:50',
                ],

                'status' => [
                    'sometimes',
                    'string',
                    'in:active,inactive',
                ],
            ]);

        if (
            $validated['payment_method']
            ===
            'bank_transfer'
        ) {
            $request->validate([
                'bank_name' => [
                    'required',
                    'string',
                    'max:100',
                ],

                'account_name' => [
                    'required',
                    'string',
                    'max:191',
                ],

                'account_number' => [
                    'required',
                    'string',
                    'max:100',
                ],
            ]);
        }

        if (
            $validated['payment_method']
            ===
            'mobile_money'
        ) {
            $request->validate([
                'mobile_number' => [
                    'required',
                    'string',
                    'max:50',
                ],
            ]);
        }

        $payload = [
            'bank_name' =>
                $validated['bank_name']
                ?? null,

            'bank_code' =>
                $validated['bank_code']
                ?? null,

            'account_name' =>
                $validated['account_name']
                ?? null,

            'account_number' =>
                $validated['account_number']
                ?? null,

            'mobile_number' =>
                $validated['mobile_number']
                ?? null,
        ];

        $encrypted =
            Crypt::encryptString(
                json_encode(
                    $payload,
                    JSON_THROW_ON_ERROR
                )
            );

        $existing =
            DB::table(
                'payroll_employee_payment_profiles'
            )
                ->where(
                    'tenant_id',
                    $tenant->id
                )
                ->where(
                    'employee_id',
                    $employeeId
                )
                ->first();

        DB::transaction(
            function () use (
                $existing,
                $tenant,
                $employeeId,
                $validated,
                $encrypted,
                $request
            ): void {
                $values = [
                    'payment_method' =>
                        $validated[
                            'payment_method'
                        ],

                    'encrypted_payload' =>
                        $encrypted,

                    'status' =>
                        $validated['status']
                        ?? 'active',

                    'updated_by' =>
                        $request->user()->id,

                    'updated_at' =>
                        now(),
                ];

                if ($existing) {
                    DB::table(
                        'payroll_employee_payment_profiles'
                    )
                        ->where(
                            'tenant_id',
                            $tenant->id
                        )
                        ->where(
                            'id',
                            $existing->id
                        )
                        ->update(
                            $values
                        );

                    return;
                }

                DB::table(
                    'payroll_employee_payment_profiles'
                )
                    ->insert(
                        array_merge(
                            $values,
                            [
                                'uuid' =>
                                    (string) Str::uuid(),

                                'tenant_id' =>
                                    (int) $tenant->id,

                                'employee_id' =>
                                    $employeeId,

                                'created_by' =>
                                    $request->user()->id,

                                'created_at' =>
                                    now(),
                            ]
                        )
                    );
            }
        );

        $profile =
            DB::table(
                'payroll_employee_payment_profiles'
            )
                ->where(
                    'tenant_id',
                    $tenant->id
                )
                ->where(
                    'employee_id',
                    $employeeId
                )
                ->first();

        $auditLogService->record(
            action:
                'hrm.payroll.payment_profile.updated',

            scope:
                $scope,

            metadata: [
                'employee_id' =>
                    $employeeId,

                'payment_method' =>
                    $validated['payment_method'],

                'status' =>
                    $validated['status']
                    ?? 'active',

                'sensitive_values_logged' =>
                    false,

                'finance_posting_created' =>
                    false,
            ],

            dataClassification:
                'restricted'
        );

        return response()->json([
            'message' =>
                'Salary payment profile updated securely.',

            'profile' =>
                $this->serializePaymentProfile(
                    $profile
                ),

            'finance_posting_created' =>
                false,
        ]);
    }

    public function generateIshemaExport(
        Request $request,
        int $runId,
        ScopeResolver $scopeResolver,
        AuditLogService $auditLogService
    ): JsonResponse {
        [
            'tenant' => $tenant,
            'scope' => $scope,
        ] =
            $this->tenantContext->resolve(
                $request,
                $scopeResolver
            );

        $result =
            $this->closure->generateIshema(
                (int) $tenant->id,
                $scope,
                $runId,
                (int) $request->user()->id
            );

        $export =
            $result['export'];

        $auditLogService->record(
            action:
                'hrm.payroll.ishema_export.generated',

            scope:
                $scope,

            metadata: [
                'payroll_run_id' =>
                    $runId,

                'payroll_export_id' =>
                    (int) $export->id,

                'template_code' =>
                    $export->template_code,

                'template_version' =>
                    $export->template_version,

                'checksum_sha256' =>
                    $export->checksum_sha256,

                'row_count' =>
                    (int) $export->row_count,

                'sensitive_values_logged' =>
                    false,

                'finance_posting_created' =>
                    false,
            ],

            dataClassification:
                'restricted'
        );

        return response()->json([
            'message' =>
                'Ishema unified annexure generated from the approved payroll snapshot.',

            'export' => [
                'id' =>
                    (int) $export->id,

                'uuid' =>
                    (string) $export->uuid,

                'file_name' =>
                    (string) $export->file_name,

                'template_code' =>
                    (string) $export->template_code,

                'template_version' =>
                    (string) $export->template_version,

                'checksum_sha256' =>
                    (string) $export->checksum_sha256,

                'row_count' =>
                    (int) $export->row_count,

                'generated_at' =>
                    $export->generated_at,

                'portal_acceptance' =>
                    'requires_test_uat',
            ],

            'finance_posting_created' =>
                false,
        ], 201);
    }

    public function downloadExport(
        Request $request,
        int $exportId,
        ScopeResolver $scopeResolver
    ): BinaryFileResponse {
        [
            'tenant' => $tenant,
            'scope' => $scope,
        ] =
            $this->tenantContext->resolve(
                $request,
                $scopeResolver
            );

        $export =
            $this->closure->exportRecord(
                (int) $tenant->id,
                $exportId
            );

        $this->closure->run(
            (int) $tenant->id,
            $scope,
            (int) $export->payroll_run_id
        );

        $path =
            Storage::disk(
                (string) $export->disk
            )
                ->path(
                    (string) $export->storage_path
                );

        abort_unless(
            is_file($path),
            404,
            'Payroll export file is unavailable.'
        );

        abort_unless(
            hash_file(
                'sha256',
                $path
            )
            ===
            $export->checksum_sha256,
            409,
            'Payroll export checksum verification failed.'
        );

        return response()->download(
            $path,
            (string) $export->file_name,
            [
                'Content-Type' =>
                    (string) $export->mime_type,

                'Cache-Control' =>
                    'private, no-store, max-age=0',
            ]
        );
    }

    public function recordDeclaration(
        Request $request,
        int $runId,
        ScopeResolver $scopeResolver,
        AuditLogService $auditLogService
    ): JsonResponse {
        [
            'tenant' => $tenant,
            'scope' => $scope,
        ] =
            $this->tenantContext->resolve(
                $request,
                $scopeResolver
            );

        $validated =
            $request->validate([
                'status' => [
                    'required',
                    'string',
                    'in:submitted,accepted,revised',
                ],

                'submission_channel' => [
                    'sometimes',
                    'string',
                    'in:ishema,myrra,etax,other',
                ],

                'reference_number' => [
                    'nullable',
                    'string',
                    'max:100',
                ],

                'submitted_at' => [
                    'nullable',
                    'date',
                ],

                'paye' => [
                    'required',
                    'numeric',
                    'min:0',
                ],

                'pension' => [
                    'required',
                    'numeric',
                    'min:0',
                ],

                'occupational_hazard' => [
                    'required',
                    'numeric',
                    'min:0',
                ],

                'maternity' => [
                    'required',
                    'numeric',
                    'min:0',
                ],

                'rama_medical' => [
                    'required',
                    'numeric',
                    'min:0',
                ],

                'cbhi' => [
                    'required',
                    'numeric',
                    'min:0',
                ],

                'notes' => [
                    'nullable',
                    'string',
                    'max:2000',
                ],
            ]);

        if (
            $validated['status']
            ===
            'accepted'
        ) {
            $request->validate([
                'reference_number' => [
                    'required',
                    'string',
                    'max:100',
                ],
            ]);
        }

        $result =
            $this->closure->recordDeclaration(
                (int) $tenant->id,
                $scope,
                $runId,
                (int) $request->user()->id,
                $validated
            );

        $declaration =
            $result['declaration'];

        $auditLogService->record(
            action:
                'hrm.payroll.declaration.recorded',

            scope:
                $scope,

            metadata: [
                'payroll_run_id' =>
                    $runId,

                'payroll_declaration_id' =>
                    (int) $declaration->id,

                'authority' =>
                    $declaration->authority,

                'declaration_type' =>
                    $declaration->declaration_type,

                'submission_channel' =>
                    $declaration->submission_channel,

                'status' =>
                    $declaration->status,

                'reference_number' =>
                    $declaration->reference_number,

                'financial_values_logged' =>
                    false,

                'finance_posting_created' =>
                    false,
            ],

            dataClassification:
                'restricted'
        );

        return response()->json(
            $result,
            201
        );
    }

    public function recordPayment(
        Request $request,
        int $runId,
        ScopeResolver $scopeResolver,
        AuditLogService $auditLogService
    ): JsonResponse {
        [
            'tenant' => $tenant,
            'scope' => $scope,
        ] =
            $this->tenantContext->resolve(
                $request,
                $scopeResolver
            );

        $validated =
            $request->validate([
                'payment_type' => [
                    'required',
                    'string',
                    'in:salary,paye,pension,occupational_hazard,maternity,rama_medical,cbhi,rssb_combined,unified_paye_rssb',
                ],

                'amount' => [
                    'required',
                    'numeric',
                    'gt:0',
                ],

                'payment_method' => [
                    'required',
                    'string',
                    'in:bank_transfer,mobile_money,airtel_money,mobile_banking,mobicash,internet_banking,commercial_bank,manual',
                ],

                'reference_number' => [
                    'nullable',
                    'string',
                    'max:100',
                ],

                'paid_at' => [
                    'nullable',
                    'date',
                ],

                'status' => [
                    'sometimes',
                    'string',
                    'in:confirmed,reconciled',
                ],

                'notes' => [
                    'nullable',
                    'string',
                    'max:2000',
                ],
            ]);

        $result =
            $this->closure->recordPayment(
                (int) $tenant->id,
                $scope,
                $runId,
                (int) $request->user()->id,
                $validated
            );

        $payment =
            $result['payment'];

        $auditLogService->record(
            action:
                'hrm.payroll.payment.recorded',

            scope:
                $scope,

            metadata: [
                'payroll_run_id' =>
                    $runId,

                'payroll_payment_id' =>
                    (int) $payment->id,

                'payment_type' =>
                    $payment->payment_type,

                'payment_method' =>
                    $payment->payment_method,

                'reference_number' =>
                    $payment->reference_number,

                'financial_values_logged' =>
                    false,

                'finance_posting_created' =>
                    false,
            ],

            dataClassification:
                'restricted'
        );

        return response()->json(
            $result,
            201
        );
    }

    public function reconcilePayment(
        Request $request,
        int $runId,
        int $paymentId,
        ScopeResolver $scopeResolver,
        AuditLogService $auditLogService
    ): JsonResponse {
        [
            'tenant' => $tenant,
            'scope' => $scope,
        ] =
            $this->tenantContext->resolve(
                $request,
                $scopeResolver
            );

        $payment =
            $this->closure->reconcilePayment(
                (int) $tenant->id,
                $scope,
                $runId,
                $paymentId,
                (int) $request->user()->id
            );

        $auditLogService->record(
            action:
                'hrm.payroll.payment.reconciled',

            scope:
                $scope,

            metadata: [
                'payroll_run_id' =>
                    $runId,

                'payroll_payment_id' =>
                    $paymentId,

                'payment_type' =>
                    $payment->payment_type,

                'reference_number' =>
                    $payment->reference_number,

                'financial_values_logged' =>
                    false,

                'finance_posting_created' =>
                    false,
            ],

            dataClassification:
                'restricted'
        );

        return response()->json([
            'message' =>
                'Payroll payment reconciled.',

            'payment' =>
                $payment,

            'finance_posting_created' =>
                false,
        ]);
    }

    public function closeRun(
        Request $request,
        int $runId,
        ScopeResolver $scopeResolver,
        AuditLogService $auditLogService
    ): JsonResponse {
        [
            'tenant' => $tenant,
            'scope' => $scope,
        ] =
            $this->tenantContext->resolve(
                $request,
                $scopeResolver
            );

        $result =
            $this->closure->close(
                (int) $tenant->id,
                $scope,
                $runId,
                (int) $request->user()->id
            );

        $auditLogService->record(
            action:
                'hrm.payroll.closed',

            scope:
                $scope,

            metadata: [
                'payroll_run_id' =>
                    $runId,

                'status' =>
                    'CLOSED',

                'correction_policy' =>
                    'revision_adjustment_reversal',

                'finance_posting_created' =>
                    false,
            ],

            dataClassification:
                'restricted'
        );

        return response()->json(
            $result
        );
    }

    private function assertEmployeeScope(
        int $tenantId,
        ScopeContext $scope,
        int $employeeId
    ): object {
        $query =
            DB::table('hrm_employees')
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->where(
                    'id',
                    $employeeId
                );

        if ($scope->branchId !== null) {
            $branchId =
                $scope->branchId;

            $query->where(
                function ($query) use (
                    $branchId,
                    $tenantId,
                    $employeeId
                ): void {
                    $query
                        ->where(
                            'home_branch_id',
                            $branchId
                        )
                        ->orWhereExists(
                            function ($subquery) use (
                                $branchId,
                                $tenantId,
                                $employeeId
                            ): void {
                                $subquery
                                    ->selectRaw('1')
                                    ->from(
                                        'hrm_employee_assignments'
                                    )
                                    ->where(
                                        'tenant_id',
                                        $tenantId
                                    )
                                    ->where(
                                        'employee_id',
                                        $employeeId
                                    )
                                    ->where(
                                        'branch_id',
                                        $branchId
                                    )
                                    ->where(
                                        'status',
                                        'active'
                                    );
                            }
                        );
                }
            );
        }

        $employee =
            $query->first();

        abort_unless(
            $employee !== null,
            404
        );

        return $employee;
    }

    private function serializePaymentProfile(
        object $profile
    ): array {
        $payload = [];

        try {
            $decoded =
                json_decode(
                    Crypt::decryptString(
                        (string) $profile->encrypted_payload
                    ),
                    true
                );

            if (is_array($decoded)) {
                $payload =
                    $decoded;
            }
        } catch (Throwable) {
            $payload = [];
        }

        return [
            'id' =>
                (int) $profile->id,

            'uuid' =>
                (string) $profile->uuid,

            'employee_id' =>
                (int) $profile->employee_id,

            'payment_method' =>
                (string) $profile->payment_method,

            'bank_name' =>
                $payload['bank_name']
                ?? null,

            'bank_code' =>
                $payload['bank_code']
                ?? null,

            'account_name' =>
                $payload['account_name']
                ?? null,

            'account_number_masked' =>
                $this->mask(
                    $payload['account_number']
                    ?? null
                ),

            'mobile_number_masked' =>
                $this->mask(
                    $payload['mobile_number']
                    ?? null
                ),

            'status' =>
                (string) $profile->status,

            'updated_at' =>
                $profile->updated_at,
        ];
    }

    private function mask(
        mixed $value
    ): ?string {
        if (
            ! is_string($value)
            ||
            $value === ''
        ) {
            return null;
        }

        $length =
            strlen($value);

        if ($length <= 4) {
            return str_repeat(
                '*',
                $length
            );
        }

        return
            str_repeat(
                '*',
                max(
                    4,
                    $length - 4
                )
            )
            .
            substr(
                $value,
                -4
            );
    }
}

