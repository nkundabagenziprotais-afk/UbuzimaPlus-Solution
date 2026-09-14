<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const PERMISSIONS = [
        'hrm.pharmacy_workforce.view' => [
            'View Pharmacy Workforce',
            'View regulated pharmacy workforce readiness and assignments.',
        ],

        'hrm.pharmacy_workforce.manage' => [
            'Manage Pharmacy Workforce',
            'Create and submit pharmacy workforce authorizations, assignments and staffing requirements.',
        ],

        'hrm.pharmacy_workforce.approve' => [
            'Approve Pharmacy Workforce',
            'Approve or reject regulated pharmacy workforce authorizations and Responsible Pharmacist assignments.',
        ],

        'hrm.pharmacy_compliance.view' => [
            'View Pharmacy Workforce Compliance',
            'View pharmacy workforce compliance gaps and controlled exceptions.',
        ],

        'hrm.pharmacy_compliance.manage' => [
            'Manage Pharmacy Workforce Compliance',
            'Create and resolve pharmacy workforce compliance exceptions.',
        ],
    ];

    public function up(): void
    {
        Schema::create(
            'hrm_pharmacy_workforce_authorizations',
            function (Blueprint $table): void {
                $table->id();

                $table->uuid('uuid')
                    ->unique();

                $table->foreignId('tenant_id')
                    ->constrained('tenants')
                    ->cascadeOnDelete();

                $table->foreignId('branch_id')
                    ->constrained('branches')
                    ->cascadeOnDelete();

                $table->foreignId('employee_id')
                    ->constrained('hrm_employees')
                    ->cascadeOnDelete();

                $table->string(
                    'professional_category',
                    50
                );

                $table->string(
                    'regulated_function',
                    80
                );

                /*
                 * Professional credential evidence reference.
                 * Core HR remains owner of the employee credential master.
                 */
                $table->string(
                    'credential_reference',
                    191
                );

                $table->date(
                    'credential_expiry_date'
                );

                $table->date(
                    'effective_from'
                );

                $table->date(
                    'effective_to'
                )->nullable();

                $table->string(
                    'status',
                    30
                )->default('draft');

                $table->foreignId('created_by')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table->foreignId('submitted_by')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table->timestamp(
                    'submitted_at'
                )->nullable();

                $table->foreignId('approved_by')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table->timestamp(
                    'approved_at'
                )->nullable();

                $table->foreignId('rejected_by')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table->timestamp(
                    'rejected_at'
                )->nullable();

                $table->text(
                    'rejection_reason'
                )->nullable();

                $table->foreignId('ended_by')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table->timestamp(
                    'ended_at'
                )->nullable();

                $table->text(
                    'end_reason'
                )->nullable();

                $table->timestamps();

                $table->index(
                    [
                        'tenant_id',
                        'branch_id',
                        'employee_id',
                        'status',
                    ],
                    'hrm_pharm_auth_scope_idx'
                );

                $table->index(
                    [
                        'tenant_id',
                        'branch_id',
                        'regulated_function',
                        'status',
                    ],
                    'hrm_pharm_auth_function_idx'
                );
            }
        );

        Schema::create(
            'hrm_pharmacy_responsible_assignments',
            function (Blueprint $table): void {
                $table->id();

                $table->uuid('uuid')
                    ->unique();

                $table->foreignId('tenant_id')
                    ->constrained('tenants')
                    ->cascadeOnDelete();

                $table->foreignId('branch_id')
                    ->constrained('branches')
                    ->cascadeOnDelete();

                $table->foreignId('employee_id')
                    ->constrained('hrm_employees')
                    ->cascadeOnDelete();

                $table->string(
                    'assignment_role',
                    80
                )->default(
                    'responsible_pharmacist'
                );

                $table->date(
                    'effective_from'
                );

                $table->date(
                    'effective_to'
                )->nullable();

                $table->string(
                    'status',
                    30
                )->default('draft');

                $table->foreignId('created_by')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table->foreignId('submitted_by')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table->timestamp(
                    'submitted_at'
                )->nullable();

                $table->foreignId('approved_by')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table->timestamp(
                    'approved_at'
                )->nullable();

                $table->foreignId('rejected_by')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table->timestamp(
                    'rejected_at'
                )->nullable();

                $table->text(
                    'rejection_reason'
                )->nullable();

                $table->foreignId('ended_by')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table->timestamp(
                    'ended_at'
                )->nullable();

                $table->text(
                    'end_reason'
                )->nullable();

                $table->timestamps();

                $table->index(
                    [
                        'tenant_id',
                        'branch_id',
                        'status',
                    ],
                    'hrm_pharm_responsible_scope_idx'
                );
            }
        );

        Schema::create(
            'hrm_pharmacy_coverage_requirements',
            function (Blueprint $table): void {
                $table->id();

                $table->uuid('uuid')
                    ->unique();

                $table->foreignId('tenant_id')
                    ->constrained('tenants')
                    ->cascadeOnDelete();

                $table->foreignId('branch_id')
                    ->constrained('branches')
                    ->cascadeOnDelete();

                $table->string(
                    'regulated_function',
                    80
                );

                $table->unsignedInteger(
                    'minimum_authorized_staff'
                )->default(1);

                $table->date(
                    'effective_from'
                );

                $table->date(
                    'effective_to'
                )->nullable();

                $table->string(
                    'status',
                    30
                )->default('active');

                $table->foreignId('created_by')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table->foreignId('ended_by')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table->timestamp(
                    'ended_at'
                )->nullable();

                $table->timestamps();

                $table->index(
                    [
                        'tenant_id',
                        'branch_id',
                        'regulated_function',
                        'status',
                    ],
                    'hrm_pharm_coverage_scope_idx'
                );
            }
        );

        Schema::create(
            'hrm_pharmacy_compliance_exceptions',
            function (Blueprint $table): void {
                $table->id();

                $table->uuid('uuid')
                    ->unique();

                $table->foreignId('tenant_id')
                    ->constrained('tenants')
                    ->cascadeOnDelete();

                $table->foreignId('branch_id')
                    ->nullable()
                    ->constrained('branches')
                    ->nullOnDelete();

                $table->foreignId('employee_id')
                    ->nullable()
                    ->constrained('hrm_employees')
                    ->nullOnDelete();

                $table->string(
                    'exception_type',
                    80
                );

                $table->string(
                    'severity',
                    30
                )->default('medium');

                /*
                 * Encrypted restricted narrative.
                 */
                $table->text(
                    'detail_payload'
                );

                $table->date(
                    'due_date'
                )->nullable();

                $table->string(
                    'status',
                    30
                )->default('open');

                $table->foreignId('opened_by')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table->foreignId('resolved_by')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table->timestamp(
                    'resolved_at'
                )->nullable();

                /*
                 * Encrypted restricted resolution.
                 */
                $table->text(
                    'resolution_payload'
                )->nullable();

                $table->timestamps();

                $table->index(
                    [
                        'tenant_id',
                        'branch_id',
                        'status',
                    ],
                    'hrm_pharm_exception_scope_idx'
                );
            }
        );

        $now = now();

        foreach (
            self::PERMISSIONS
            as $code => [$name, $description]
        ) {
            $row = [
                'code' =>
                    $code,

                'name' =>
                    $name,

                'permission_group' =>
                    'hrm',

                'description' =>
                    $description,

                'status' =>
                    'active',
            ];

            if (
                Schema::hasColumn(
                    'permissions',
                    'created_at'
                )
            ) {
                $row['created_at'] =
                    $now;
            }

            if (
                Schema::hasColumn(
                    'permissions',
                    'updated_at'
                )
            ) {
                $row['updated_at'] =
                    $now;
            }

            DB::table(
                'permissions'
            )->insert($row);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists(
            'hrm_pharmacy_compliance_exceptions'
        );

        Schema::dropIfExists(
            'hrm_pharmacy_coverage_requirements'
        );

        Schema::dropIfExists(
            'hrm_pharmacy_responsible_assignments'
        );

        Schema::dropIfExists(
            'hrm_pharmacy_workforce_authorizations'
        );

        $ids =
            DB::table(
                'permissions'
            )
                ->whereIn(
                    'code',
                    array_keys(
                        self::PERMISSIONS
                    )
                )
                ->pluck('id')
                ->all();

        if ($ids) {
            DB::table(
                'permission_role'
            )
                ->whereIn(
                    'permission_id',
                    $ids
                )
                ->delete();
        }

        DB::table(
            'permissions'
        )
            ->whereIn(
                'code',
                array_keys(
                    self::PERMISSIONS
                )
            )
            ->delete();
    }
};
