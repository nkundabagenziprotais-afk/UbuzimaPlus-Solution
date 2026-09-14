<?php

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const PERMISSIONS = [
        'hrm.attendance.view' => [
            'View Time and Attendance',
            'View shifts, attendance records and overtime.',
        ],
        'hrm.attendance.manage' => [
            'Manage Time and Attendance',
            'Create and maintain shifts, attendance and overtime requests.',
        ],
        'hrm.attendance.approve' => [
            'Approve Time and Attendance',
            'Approve or reject submitted attendance and overtime.',
        ],
        'hrm.leave.view' => [
            'View Leave Management',
            'View leave types, policies, balances and requests.',
        ],
        'hrm.leave.manage' => [
            'Manage Leave',
            'Manage leave configuration, balances and requests.',
        ],
        'hrm.leave.approve' => [
            'Approve Leave',
            'Approve or reject submitted employee leave requests.',
        ],
    ];

    private const ADMIN_ROLES = [
        'ubuzima_plus_super_admin',
        'pharmaco360_solution_admin',
        'tenant_admin',
    ];

    public function up(): void
    {
        Schema::create(
            'hrm_shift_templates',
            function (Blueprint $table): void {
                $table->id();
                $table->uuid('uuid')->unique();

                $table->foreignId('tenant_id')
                    ->constrained('tenants')
                    ->cascadeOnDelete();

                $table->foreignId('branch_id')
                    ->nullable()
                    ->constrained('branches')
                    ->nullOnDelete();

                $table->string('code', 100);
                $table->string('name', 191);

                $table->time('start_time');
                $table->time('end_time');

                $table->unsignedInteger('break_minutes')
                    ->default(0);

                $table->json('working_days')
                    ->nullable();

                $table->date('effective_from');

                $table->date('effective_to')
                    ->nullable();

                $table->string('status', 30)
                    ->default('active');

                $table->foreignId('created_by')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table->foreignId('updated_by')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table->timestamps();

                $table->unique(
                    ['tenant_id', 'code'],
                    'hrm_shift_tenant_code_uq'
                );

                $table->index(
                    [
                        'tenant_id',
                        'branch_id',
                        'status',
                    ],
                    'hrm_shift_tenant_branch_status_idx'
                );
            }
        );

        Schema::create(
            'hrm_employee_shift_assignments',
            function (Blueprint $table): void {
                $table->id();
                $table->uuid('uuid')->unique();

                $table->foreignId('tenant_id')
                    ->constrained('tenants')
                    ->cascadeOnDelete();

                $table->foreignId('employee_id')
                    ->constrained('hrm_employees')
                    ->cascadeOnDelete();

                $table->foreignId('shift_template_id')
                    ->constrained('hrm_shift_templates')
                    ->cascadeOnDelete();

                $table->foreignId('branch_id')
                    ->nullable()
                    ->constrained('branches')
                    ->nullOnDelete();

                $table->date('effective_from');

                $table->date('effective_to')
                    ->nullable();

                $table->string('status', 30)
                    ->default('active');

                $table->text('notes')
                    ->nullable();

                $table->foreignId('created_by')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table->timestamps();

                $table->index(
                    [
                        'tenant_id',
                        'employee_id',
                        'effective_from',
                    ],
                    'hrm_shift_assignment_employee_idx'
                );
            }
        );

        Schema::create(
            'hrm_attendance_records',
            function (Blueprint $table): void {
                $table->id();
                $table->uuid('uuid')->unique();

                $table->foreignId('tenant_id')
                    ->constrained('tenants')
                    ->cascadeOnDelete();

                $table->foreignId('employee_id')
                    ->constrained('hrm_employees')
                    ->cascadeOnDelete();

                $table->foreignId('branch_id')
                    ->nullable()
                    ->constrained('branches')
                    ->nullOnDelete();

                $table->foreignId('shift_template_id')
                    ->nullable()
                    ->constrained('hrm_shift_templates')
                    ->nullOnDelete();

                $table->date('work_date');

                $table->dateTime('clock_in_at')
                    ->nullable();

                $table->dateTime('clock_out_at')
                    ->nullable();

                $table->unsignedInteger('scheduled_minutes')
                    ->nullable();

                $table->unsignedInteger('worked_minutes')
                    ->nullable();

                $table->unsignedInteger('overtime_minutes')
                    ->default(0);

                $table->string('source', 50)
                    ->default('manual');

                $table->string('status', 30)
                    ->default('draft');

                $table->text('notes')
                    ->nullable();

                $table->foreignId('created_by')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table->foreignId('submitted_by')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table->timestamp('submitted_at')
                    ->nullable();

                $table->foreignId('approved_by')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table->timestamp('approved_at')
                    ->nullable();

                $table->foreignId('rejected_by')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table->timestamp('rejected_at')
                    ->nullable();

                $table->text('rejection_reason')
                    ->nullable();

                $table->timestamps();

                $table->unique(
                    [
                        'tenant_id',
                        'employee_id',
                        'work_date',
                    ],
                    'hrm_attendance_employee_date_uq'
                );

                $table->index(
                    [
                        'tenant_id',
                        'branch_id',
                        'work_date',
                        'status',
                    ],
                    'hrm_attendance_scope_idx'
                );
            }
        );

        Schema::create(
            'hrm_overtime_requests',
            function (Blueprint $table): void {
                $table->id();
                $table->uuid('uuid')->unique();

                $table->foreignId('tenant_id')
                    ->constrained('tenants')
                    ->cascadeOnDelete();

                $table->foreignId('employee_id')
                    ->constrained('hrm_employees')
                    ->cascadeOnDelete();

                $table->foreignId('branch_id')
                    ->nullable()
                    ->constrained('branches')
                    ->nullOnDelete();

                $table->foreignId('attendance_record_id')
                    ->nullable()
                    ->constrained('hrm_attendance_records')
                    ->nullOnDelete();

                $table->date('work_date');

                $table->unsignedInteger('requested_minutes');

                $table->text('reason');

                $table->string('status', 30)
                    ->default('pending');

                $table->foreignId('created_by')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table->foreignId('approved_by')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table->timestamp('approved_at')
                    ->nullable();

                $table->foreignId('rejected_by')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table->timestamp('rejected_at')
                    ->nullable();

                $table->text('rejection_reason')
                    ->nullable();

                $table->timestamps();

                $table->index(
                    [
                        'tenant_id',
                        'employee_id',
                        'status',
                    ],
                    'hrm_overtime_employee_status_idx'
                );
            }
        );

        Schema::create(
            'hrm_leave_types',
            function (Blueprint $table): void {
                $table->id();
                $table->uuid('uuid')->unique();

                $table->foreignId('tenant_id')
                    ->constrained('tenants')
                    ->cascadeOnDelete();

                $table->string('code', 100);
                $table->string('name', 191);

                $table->string('unit', 30)
                    ->default('days');

                $table->boolean('paid')
                    ->default(true);

                $table->boolean('requires_document')
                    ->default(false);

                $table->string('status', 30)
                    ->default('active');

                $table->text('description')
                    ->nullable();

                $table->foreignId('created_by')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table->timestamps();

                $table->unique(
                    ['tenant_id', 'code'],
                    'hrm_leave_type_tenant_code_uq'
                );
            }
        );

        Schema::create(
            'hrm_leave_policies',
            function (Blueprint $table): void {
                $table->id();
                $table->uuid('uuid')->unique();

                $table->foreignId('tenant_id')
                    ->constrained('tenants')
                    ->cascadeOnDelete();

                $table->foreignId('leave_type_id')
                    ->constrained('hrm_leave_types')
                    ->cascadeOnDelete();

                $table->foreignId('branch_id')
                    ->nullable()
                    ->constrained('branches')
                    ->nullOnDelete();

                $table->string('policy_name', 191);

                $table->decimal(
                    'entitlement_days',
                    8,
                    2
                );

                $table->decimal(
                    'carry_forward_limit',
                    8,
                    2
                )->nullable();

                $table->string(
                    'accrual_method',
                    50
                )->default('annual');

                $table->date('effective_from');

                $table->date('effective_to')
                    ->nullable();

                $table->string('status', 30)
                    ->default('active');

                $table->foreignId('created_by')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table->timestamps();

                $table->index(
                    [
                        'tenant_id',
                        'leave_type_id',
                        'effective_from',
                    ],
                    'hrm_leave_policy_type_date_idx'
                );
            }
        );

        Schema::create(
            'hrm_leave_balances',
            function (Blueprint $table): void {
                $table->id();
                $table->uuid('uuid')->unique();

                $table->foreignId('tenant_id')
                    ->constrained('tenants')
                    ->cascadeOnDelete();

                $table->foreignId('employee_id')
                    ->constrained('hrm_employees')
                    ->cascadeOnDelete();

                $table->foreignId('leave_type_id')
                    ->constrained('hrm_leave_types')
                    ->cascadeOnDelete();

                $table->foreignId('policy_id')
                    ->nullable()
                    ->constrained('hrm_leave_policies')
                    ->nullOnDelete();

                $table->date('period_start');
                $table->date('period_end');

                $table->decimal(
                    'opening_balance',
                    10,
                    2
                )->default(0);

                $table->decimal(
                    'accrued',
                    10,
                    2
                )->default(0);

                $table->decimal(
                    'taken',
                    10,
                    2
                )->default(0);

                $table->decimal(
                    'reserved',
                    10,
                    2
                )->default(0);

                $table->decimal(
                    'adjustment',
                    10,
                    2
                )->default(0);

                $table->decimal(
                    'closing_balance',
                    10,
                    2
                )->default(0);

                $table->string('status', 30)
                    ->default('active');

                $table->foreignId('created_by')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table->timestamps();

                $table->unique(
                    [
                        'tenant_id',
                        'employee_id',
                        'leave_type_id',
                        'period_start',
                        'period_end',
                    ],
                    'hrm_leave_balance_period_uq'
                );
            }
        );

        Schema::create(
            'hrm_leave_requests',
            function (Blueprint $table): void {
                $table->id();
                $table->uuid('uuid')->unique();

                $table->foreignId('tenant_id')
                    ->constrained('tenants')
                    ->cascadeOnDelete();

                $table->foreignId('employee_id')
                    ->constrained('hrm_employees')
                    ->cascadeOnDelete();

                $table->foreignId('leave_type_id')
                    ->constrained('hrm_leave_types')
                    ->cascadeOnDelete();

                $table->foreignId('branch_id')
                    ->nullable()
                    ->constrained('branches')
                    ->nullOnDelete();

                $table->date('start_date');
                $table->date('end_date');

                $table->decimal(
                    'requested_days',
                    8,
                    2
                );

                $table->text('reason')
                    ->nullable();

                $table->string(
                    'attachment_reference',
                    191
                )->nullable();

                $table->string('status', 30)
                    ->default('draft');

                $table->foreignId('created_by')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table->foreignId('submitted_by')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table->timestamp('submitted_at')
                    ->nullable();

                $table->foreignId('approved_by')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table->timestamp('approved_at')
                    ->nullable();

                $table->foreignId('rejected_by')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table->timestamp('rejected_at')
                    ->nullable();

                $table->text('rejection_reason')
                    ->nullable();

                $table->foreignId('cancelled_by')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table->timestamp('cancelled_at')
                    ->nullable();

                $table->timestamps();

                $table->index(
                    [
                        'tenant_id',
                        'employee_id',
                        'status',
                    ],
                    'hrm_leave_request_employee_idx'
                );

                $table->index(
                    [
                        'tenant_id',
                        'start_date',
                        'end_date',
                    ],
                    'hrm_leave_request_dates_idx'
                );
            }
        );

        foreach (
            self::PERMISSIONS
            as $code => [$name, $description]
        ) {
            Permission::query()
                ->firstOrCreate(
                    ['code' => $code],
                    [
                        'name' => $name,
                        'permission_group' => 'hrm',
                        'description' => $description,
                        'status' => 'active',
                    ]
                );
        }

        $permissionIds =
            Permission::query()
                ->whereIn(
                    'code',
                    array_keys(
                        self::PERMISSIONS
                    )
                )
                ->pluck('id');

        Role::query()
            ->where(
                function ($query): void {
                    $query
                        ->whereIn(
                            'code',
                            self::ADMIN_ROLES
                        )
                        ->orWhereHas(
                            'permissions',
                            fn ($permissionQuery) =>
                                $permissionQuery
                                    ->where(
                                        'permissions.code',
                                        'roles.manage'
                                    )
                        );
                }
            )
            ->get()
            ->each(
                fn (Role $role) =>
                    $role->permissions()
                        ->syncWithoutDetaching(
                            $permissionIds->all()
                        )
            );
    }

    public function down(): void
    {
        Schema::dropIfExists(
            'hrm_leave_requests'
        );

        Schema::dropIfExists(
            'hrm_leave_balances'
        );

        Schema::dropIfExists(
            'hrm_leave_policies'
        );

        Schema::dropIfExists(
            'hrm_leave_types'
        );

        Schema::dropIfExists(
            'hrm_overtime_requests'
        );

        Schema::dropIfExists(
            'hrm_attendance_records'
        );

        Schema::dropIfExists(
            'hrm_employee_shift_assignments'
        );

        Schema::dropIfExists(
            'hrm_shift_templates'
        );

        $permissionIds =
            Permission::query()
                ->whereIn(
                    'code',
                    array_keys(
                        self::PERMISSIONS
                    )
                )
                ->pluck('id');

        if ($permissionIds->isNotEmpty()) {
            DB::table('permission_role')
                ->whereIn(
                    'permission_id',
                    $permissionIds
                )
                ->delete();

            Permission::query()
                ->whereIn(
                    'id',
                    $permissionIds
                )
                ->delete();
        }
    }
};
