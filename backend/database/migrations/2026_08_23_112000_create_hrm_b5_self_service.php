<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const PERMISSIONS = [
        'hrm.self_service.manage' => [
            'Manage HR Self Service',
            'View manager self-service queues.',
        ],

        'hrm.self_service.approve' => [
            'Approve HR Self Service',
            'Approve or reject controlled employee profile changes.',
        ],
    ];

    public function up(): void
    {
        Schema::create(
            'hrm_profile_change_requests',
            function (Blueprint $table): void {
                $table->id();

                $table->uuid('uuid')
                    ->unique();

                $table->foreignId('tenant_id')
                    ->constrained('tenants')
                    ->cascadeOnDelete();

                $table->foreignId('employee_id')
                    ->constrained('hrm_employees')
                    ->cascadeOnDelete();

                $table->foreignId('manager_employee_id')
                    ->nullable()
                    ->constrained('hrm_employees')
                    ->nullOnDelete();

                $table->string(
                    'field_code',
                    50
                );

                /*
                 * Values are encrypted by the application.
                 */
                $table->text(
                    'current_payload'
                )->nullable();

                $table->text(
                    'requested_payload'
                );

                $table->text(
                    'reason'
                )->nullable();

                $table->string(
                    'status',
                    30
                )->default('pending');

                $table->foreignId(
                    'submitted_by'
                )
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table->timestamp(
                    'submitted_at'
                )->nullable();

                $table->foreignId(
                    'decided_by'
                )
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table->timestamp(
                    'decided_at'
                )->nullable();

                $table->text(
                    'decision_notes'
                )->nullable();

                $table->timestamps();

                $table->index(
                    [
                        'tenant_id',
                        'employee_id',
                        'status',
                    ],
                    'hrm_b5_profile_employee_status_idx'
                );

                $table->index(
                    [
                        'tenant_id',
                        'manager_employee_id',
                        'status',
                    ],
                    'hrm_b5_profile_manager_status_idx'
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
            )->insert(
                $row
            );
        }

        $permissionIds =
            DB::table('permissions')
                ->whereIn(
                    'code',
                    array_keys(
                        self::PERMISSIONS
                    )
                )
                ->pluck('id')
                ->all();

        $roleIds =
            DB::table('roles')
                ->whereIn(
                    'code',
                    [
                        'ubuzima_plus_super_admin',
                        'pharmaco360_solution_admin',
                        'tenant_admin',
                        'branch_manager',
                        'hr_manager',
                    ]
                )
                ->pluck('id')
                ->all();

        $pivot = null;

        foreach (
            [
                'permission_role',
                'role_has_permissions',
                'role_permission',
            ]
            as $candidate
        ) {
            if (
                Schema::hasTable(
                    $candidate
                )
            ) {
                $pivot =
                    $candidate;

                break;
            }
        }

        if (
            $pivot
            &&
            $permissionIds
            &&
            $roleIds
        ) {
            foreach (
                $roleIds
                as $roleId
            ) {
                foreach (
                    $permissionIds
                    as $permissionId
                ) {
                    DB::table(
                        $pivot
                    )->insertOrIgnore([
                        'role_id' =>
                            $roleId,

                        'permission_id' =>
                            $permissionId,
                    ]);
                }
            }
        }
    }

    public function down(): void
    {
        Schema::dropIfExists(
            'hrm_profile_change_requests'
        );

        $permissionIds =
            DB::table('permissions')
                ->whereIn(
                    'code',
                    array_keys(
                        self::PERMISSIONS
                    )
                )
                ->pluck('id')
                ->all();

        foreach (
            [
                'permission_role',
                'role_has_permissions',
                'role_permission',
            ]
            as $pivot
        ) {
            if (
                Schema::hasTable(
                    $pivot
                )
                &&
                $permissionIds
            ) {
                DB::table(
                    $pivot
                )
                    ->whereIn(
                        'permission_id',
                        $permissionIds
                    )
                    ->delete();
            }
        }

        DB::table('permissions')
            ->whereIn(
                'code',
                array_keys(
                    self::PERMISSIONS
                )
            )
            ->delete();
    }
};
