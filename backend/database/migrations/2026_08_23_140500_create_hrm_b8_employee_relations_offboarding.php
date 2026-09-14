<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const PERMISSIONS = [
        'hrm.employee_relations.view' => [
            'View Employee Relations',
            'View employee relations cases, actions and hearings.',
        ],

        'hrm.employee_relations.manage' => [
            'Manage Employee Relations',
            'Create and manage employee relations cases and actions.',
        ],

        'hrm.employee_relations.approve' => [
            'Approve Employee Relations',
            'Approve and close controlled employee relations cases.',
        ],

        'hrm.offboarding.view' => [
            'View Offboarding',
            'View employee separation, clearance and exit records.',
        ],

        'hrm.offboarding.manage' => [
            'Manage Offboarding',
            'Create and manage offboarding and clearance records.',
        ],

        'hrm.offboarding.approve' => [
            'Approve Offboarding',
            'Approve and finalise controlled employee separation.',
        ],
    ];

    public function up(): void
    {
        Schema::create(
            'hrm_employee_relation_cases',
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

                $table->foreignId('employee_id')
                    ->constrained('hrm_employees')
                    ->cascadeOnDelete();

                $table->string('case_number', 100);
                $table->string('case_type', 50);
                $table->string('severity', 30)
                    ->default('medium');

                $table->string('confidentiality', 30)
                    ->default('restricted');

                /*
                 * Encrypted:
                 * summary
                 * details
                 */
                $table->text('detail_payload');

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

                $table->foreignId('closed_by')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table->timestamp('closed_at')
                    ->nullable();

                /*
                 * Encrypted final resolution.
                 */
                $table->text('resolution_payload')
                    ->nullable();

                $table->timestamps();

                $table->unique(
                    [
                        'tenant_id',
                        'case_number',
                    ],
                    'hrm_er_case_number_uq'
                );

                $table->index(
                    [
                        'tenant_id',
                        'branch_id',
                        'status',
                    ],
                    'hrm_er_case_scope_idx'
                );
            }
        );

        Schema::create(
            'hrm_employee_relation_case_notes',
            function (Blueprint $table): void {
                $table->id();
                $table->uuid('uuid')->unique();

                $table->foreignId('tenant_id')
                    ->constrained('tenants')
                    ->cascadeOnDelete();

                $table->foreignId('case_id')
                    ->constrained('hrm_employee_relation_cases')
                    ->cascadeOnDelete();

                $table->string('note_type', 50)
                    ->default('internal');

                /*
                 * Encrypted note content.
                 */
                $table->text('note_payload');

                $table->foreignId('created_by')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table->timestamps();

                $table->index(
                    [
                        'tenant_id',
                        'case_id',
                    ],
                    'hrm_er_note_case_idx'
                );
            }
        );

        Schema::create(
            'hrm_employee_relation_actions',
            function (Blueprint $table): void {
                $table->id();
                $table->uuid('uuid')->unique();

                $table->foreignId('tenant_id')
                    ->constrained('tenants')
                    ->cascadeOnDelete();

                $table->foreignId('case_id')
                    ->constrained('hrm_employee_relation_cases')
                    ->cascadeOnDelete();

                $table->string('action_type', 50);
                $table->string('title', 191);

                /*
                 * Encrypted action details.
                 */
                $table->text('detail_payload')
                    ->nullable();

                $table->date('due_date')
                    ->nullable();

                $table->string('status', 30)
                    ->default('pending');

                /*
                 * Encrypted outcome / completion evidence.
                 */
                $table->text('outcome_payload')
                    ->nullable();

                $table->foreignId('created_by')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table->foreignId('completed_by')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table->timestamp('completed_at')
                    ->nullable();

                $table->timestamps();

                $table->index(
                    [
                        'tenant_id',
                        'case_id',
                        'status',
                    ],
                    'hrm_er_action_case_idx'
                );
            }
        );

        Schema::create(
            'hrm_employee_relation_hearings',
            function (Blueprint $table): void {
                $table->id();
                $table->uuid('uuid')->unique();

                $table->foreignId('tenant_id')
                    ->constrained('tenants')
                    ->cascadeOnDelete();

                $table->foreignId('case_id')
                    ->constrained('hrm_employee_relation_cases')
                    ->cascadeOnDelete();

                $table->string('hearing_type', 50);

                $table->timestamp('scheduled_at');

                $table->foreignId('chair_employee_id')
                    ->nullable()
                    ->constrained('hrm_employees')
                    ->nullOnDelete();

                $table->string('status', 30)
                    ->default('scheduled');

                /*
                 * Encrypted hearing outcome.
                 */
                $table->text('outcome_payload')
                    ->nullable();

                $table->foreignId('created_by')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table->foreignId('completed_by')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table->timestamp('completed_at')
                    ->nullable();

                $table->timestamps();

                $table->index(
                    [
                        'tenant_id',
                        'case_id',
                        'status',
                    ],
                    'hrm_er_hearing_case_idx'
                );
            }
        );

        Schema::create(
            'hrm_offboarding_cases',
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

                $table->foreignId('employee_id')
                    ->constrained('hrm_employees')
                    ->cascadeOnDelete();

                $table->string('case_number', 100);
                $table->string('separation_type', 50);

                $table->date('notice_date')
                    ->nullable();

                $table->date('last_working_date');

                /*
                 * Encrypted separation reason/details.
                 */
                $table->text('reason_payload');

                $table->string('status', 30)
                    ->default('draft');

                $table->string(
                    'final_settlement_reference',
                    191
                )->nullable();

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

                $table->foreignId('finalised_by')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table->timestamp('finalised_at')
                    ->nullable();

                $table->timestamps();

                $table->unique(
                    [
                        'tenant_id',
                        'case_number',
                    ],
                    'hrm_offboarding_case_number_uq'
                );

                $table->index(
                    [
                        'tenant_id',
                        'branch_id',
                        'status',
                    ],
                    'hrm_offboarding_scope_idx'
                );
            }
        );

        Schema::create(
            'hrm_offboarding_clearance_items',
            function (Blueprint $table): void {
                $table->id();
                $table->uuid('uuid')->unique();

                $table->foreignId('tenant_id')
                    ->constrained('tenants')
                    ->cascadeOnDelete();

                $table->foreignId('offboarding_id')
                    ->constrained('hrm_offboarding_cases')
                    ->cascadeOnDelete();

                $table->string('category', 50);
                $table->string('title', 191);

                $table->string('reference', 191)
                    ->nullable();

                $table->foreignId('assigned_employee_id')
                    ->nullable()
                    ->constrained('hrm_employees')
                    ->nullOnDelete();

                $table->string('status', 30)
                    ->default('pending');

                $table->text('completion_notes')
                    ->nullable();

                $table->foreignId('created_by')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table->foreignId('completed_by')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table->timestamp('completed_at')
                    ->nullable();

                $table->foreignId('verified_by')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table->timestamp('verified_at')
                    ->nullable();

                $table->timestamps();

                $table->index(
                    [
                        'tenant_id',
                        'offboarding_id',
                        'status',
                    ],
                    'hrm_offboarding_clearance_idx'
                );
            }
        );

        Schema::create(
            'hrm_offboarding_exit_interviews',
            function (Blueprint $table): void {
                $table->id();
                $table->uuid('uuid')->unique();

                $table->foreignId('tenant_id')
                    ->constrained('tenants')
                    ->cascadeOnDelete();

                $table->foreignId('offboarding_id')
                    ->constrained('hrm_offboarding_cases')
                    ->cascadeOnDelete();

                $table->timestamp('interview_at');

                $table->foreignId('interviewer_employee_id')
                    ->nullable()
                    ->constrained('hrm_employees')
                    ->nullOnDelete();

                /*
                 * Encrypted exit feedback.
                 */
                $table->text('feedback_payload');

                $table->boolean('rehire_eligible')
                    ->default(false);

                $table->foreignId('created_by')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table->timestamps();

                $table->unique(
                    ['offboarding_id'],
                    'hrm_exit_interview_offboarding_uq'
                );
            }
        );

        Schema::create(
            'hrm_offboarding_access_actions',
            function (Blueprint $table): void {
                $table->id();
                $table->uuid('uuid')->unique();

                $table->foreignId('tenant_id')
                    ->constrained('tenants')
                    ->cascadeOnDelete();

                $table->foreignId('offboarding_id')
                    ->constrained('hrm_offboarding_cases')
                    ->cascadeOnDelete();

                $table->string('access_type', 50);
                $table->string('system_name', 191);
                $table->string('action', 50);

                $table->string('evidence_reference', 191)
                    ->nullable();

                $table->string('status', 30)
                    ->default('pending');

                $table->foreignId('created_by')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table->foreignId('completed_by')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table->timestamp('completed_at')
                    ->nullable();

                $table->timestamps();

                $table->index(
                    [
                        'tenant_id',
                        'offboarding_id',
                        'status',
                    ],
                    'hrm_offboarding_access_idx'
                );
            }
        );

        $now = now();

        foreach (
            self::PERMISSIONS
            as $code => [$name, $description]
        ) {
            $row = [
                'code' => $code,
                'name' => $name,
                'permission_group' => 'hrm',
                'description' => $description,
                'status' => 'active',
            ];

            if (
                Schema::hasColumn(
                    'permissions',
                    'created_at'
                )
            ) {
                $row['created_at'] = $now;
            }

            if (
                Schema::hasColumn(
                    'permissions',
                    'updated_at'
                )
            ) {
                $row['updated_at'] = $now;
            }

            DB::table('permissions')
                ->insert($row);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists(
            'hrm_offboarding_access_actions'
        );

        Schema::dropIfExists(
            'hrm_offboarding_exit_interviews'
        );

        Schema::dropIfExists(
            'hrm_offboarding_clearance_items'
        );

        Schema::dropIfExists(
            'hrm_offboarding_cases'
        );

        Schema::dropIfExists(
            'hrm_employee_relation_hearings'
        );

        Schema::dropIfExists(
            'hrm_employee_relation_actions'
        );

        Schema::dropIfExists(
            'hrm_employee_relation_case_notes'
        );

        Schema::dropIfExists(
            'hrm_employee_relation_cases'
        );

        $ids =
            DB::table('permissions')
                ->whereIn(
                    'code',
                    array_keys(
                        self::PERMISSIONS
                    )
                )
                ->pluck('id')
                ->all();

        if ($ids) {
            DB::table('permission_role')
                ->whereIn(
                    'permission_id',
                    $ids
                )
                ->delete();
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
