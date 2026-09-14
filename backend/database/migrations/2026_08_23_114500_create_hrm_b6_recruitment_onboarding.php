<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const PERMISSIONS = [
        'hrm.recruitment.view' => [
            'View Recruitment',
            'View requisitions, vacancies, candidates, interviews and offers.',
        ],

        'hrm.recruitment.manage' => [
            'Manage Recruitment',
            'Create and progress recruitment records.',
        ],

        'hrm.recruitment.approve' => [
            'Approve Recruitment',
            'Approve requisitions, offers and controlled hiring.',
        ],

        'hrm.onboarding.view' => [
            'View Onboarding',
            'View onboarding plans and checklists.',
        ],

        'hrm.onboarding.manage' => [
            'Manage Onboarding',
            'Create and complete onboarding checklist tasks.',
        ],

        'hrm.onboarding.approve' => [
            'Approve Onboarding',
            'Verify onboarding tasks and complete onboarding plans.',
        ],
    ];

    public function up(): void
    {
        Schema::create(
            'hrm_recruitment_requisitions',
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

                $table->unsignedBigInteger('department_id')
                    ->nullable();

                $table->foreignId('position_id')
                    ->nullable()
                    ->constrained('hrm_positions')
                    ->nullOnDelete();

                $table->foreignId('job_grade_id')
                    ->nullable()
                    ->constrained('hrm_job_grades')
                    ->nullOnDelete();

                $table->string('code', 100);
                $table->string('title', 191);
                $table->string('employment_type', 50);
                $table->unsignedInteger('openings')->default(1);

                $table->text('justification');
                $table->date('target_start_date')->nullable();

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

                $table->timestamp('submitted_at')->nullable();

                $table->foreignId('approved_by')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table->timestamp('approved_at')->nullable();

                $table->foreignId('rejected_by')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table->timestamp('rejected_at')->nullable();
                $table->text('rejection_reason')->nullable();

                $table->timestamps();

                $table->unique(
                    ['tenant_id', 'code'],
                    'hrm_requisition_tenant_code_uq'
                );

                $table->index(
                    [
                        'tenant_id',
                        'branch_id',
                        'status',
                    ],
                    'hrm_requisition_scope_idx'
                );
            }
        );

        Schema::create(
            'hrm_recruitment_vacancies',
            function (Blueprint $table): void {
                $table->id();
                $table->uuid('uuid')->unique();

                $table->foreignId('tenant_id')
                    ->constrained('tenants')
                    ->cascadeOnDelete();

                $table->foreignId('requisition_id')
                    ->constrained('hrm_recruitment_requisitions')
                    ->cascadeOnDelete();

                $table->string('code', 100);
                $table->string('title', 191);

                $table->timestamp('opened_at');
                $table->date('closes_at')->nullable();

                $table->string('status', 30)
                    ->default('open');

                $table->foreignId('created_by')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table->foreignId('closed_by')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table->timestamp('closed_at')->nullable();

                $table->timestamps();

                $table->unique(
                    ['tenant_id', 'code'],
                    'hrm_vacancy_tenant_code_uq'
                );

                $table->index(
                    ['tenant_id', 'status', 'closes_at'],
                    'hrm_vacancy_status_idx'
                );
            }
        );

        Schema::create(
            'hrm_recruitment_candidates',
            function (Blueprint $table): void {
                $table->id();
                $table->uuid('uuid')->unique();

                $table->foreignId('tenant_id')
                    ->constrained('tenants')
                    ->cascadeOnDelete();

                $table->string('first_name', 100);
                $table->string('last_name', 100);

                /*
                 * Contact details are encrypted by the application.
                 * A one-way email hash supports duplicate prevention.
                 */
                $table->string('email_hash', 64);
                $table->text('contact_payload');

                $table->string('source', 50)
                    ->default('direct');

                $table->string('resume_reference', 191)
                    ->nullable();

                $table->string('status', 30)
                    ->default('active');

                $table->foreignId('created_by')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table->timestamps();

                $table->unique(
                    ['tenant_id', 'email_hash'],
                    'hrm_candidate_email_hash_uq'
                );

                $table->index(
                    ['tenant_id', 'status'],
                    'hrm_candidate_status_idx'
                );
            }
        );

        Schema::create(
            'hrm_recruitment_applications',
            function (Blueprint $table): void {
                $table->id();
                $table->uuid('uuid')->unique();

                $table->foreignId('tenant_id')
                    ->constrained('tenants')
                    ->cascadeOnDelete();

                $table->foreignId('candidate_id')
                    ->constrained('hrm_recruitment_candidates')
                    ->cascadeOnDelete();

                $table->foreignId('vacancy_id')
                    ->constrained('hrm_recruitment_vacancies')
                    ->cascadeOnDelete();

                $table->string('stage', 30)
                    ->default('applied');

                $table->text('screening_notes')->nullable();

                $table->timestamp('applied_at');

                $table->timestamp('shortlisted_at')->nullable();
                $table->timestamp('rejected_at')->nullable();
                $table->text('rejection_reason')->nullable();

                $table->foreignId('hired_employee_id')
                    ->nullable()
                    ->constrained('hrm_employees')
                    ->nullOnDelete();

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
                    [
                        'tenant_id',
                        'candidate_id',
                        'vacancy_id',
                    ],
                    'hrm_application_candidate_vacancy_uq'
                );

                $table->index(
                    ['tenant_id', 'stage'],
                    'hrm_application_stage_idx'
                );
            }
        );

        Schema::create(
            'hrm_recruitment_interviews',
            function (Blueprint $table): void {
                $table->id();
                $table->uuid('uuid')->unique();

                $table->foreignId('tenant_id')
                    ->constrained('tenants')
                    ->cascadeOnDelete();

                $table->foreignId('application_id')
                    ->constrained('hrm_recruitment_applications')
                    ->cascadeOnDelete();

                $table->string('interview_type', 50);

                $table->timestamp('scheduled_at');

                $table->foreignId('interviewer_employee_id')
                    ->nullable()
                    ->constrained('hrm_employees')
                    ->nullOnDelete();

                $table->string('status', 30)
                    ->default('scheduled');

                $table->decimal('score', 5, 2)
                    ->nullable();

                /*
                 * Interview feedback is encrypted by the application.
                 */
                $table->text('feedback_payload')
                    ->nullable();

                $table->foreignId('created_by')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table->foreignId('completed_by')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table->timestamp('completed_at')->nullable();

                $table->timestamps();

                $table->index(
                    ['tenant_id', 'status', 'scheduled_at'],
                    'hrm_interview_status_idx'
                );
            }
        );

        Schema::create(
            'hrm_recruitment_offers',
            function (Blueprint $table): void {
                $table->id();
                $table->uuid('uuid')->unique();

                $table->foreignId('tenant_id')
                    ->constrained('tenants')
                    ->cascadeOnDelete();

                $table->foreignId('application_id')
                    ->constrained('hrm_recruitment_applications')
                    ->cascadeOnDelete();

                $table->string('offer_number', 100);

                $table->date('start_date');
                $table->string('employment_type', 50);

                /*
                 * Proposed salary/currency/pay frequency remain encrypted.
                 * Hiring does NOT write Compensation history.
                 */
                $table->text('compensation_payload')
                    ->nullable();

                $table->date('probation_end_date')
                    ->nullable();

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

                $table->timestamp('submitted_at')->nullable();

                $table->foreignId('approved_by')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table->timestamp('approved_at')->nullable();

                $table->foreignId('rejected_by')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table->timestamp('rejected_at')->nullable();
                $table->text('rejection_reason')->nullable();

                $table->foreignId('accepted_by')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table->timestamp('accepted_at')->nullable();

                $table->timestamps();

                $table->unique(
                    ['tenant_id', 'offer_number'],
                    'hrm_offer_number_uq'
                );

                $table->unique(
                    ['tenant_id', 'application_id'],
                    'hrm_offer_application_uq'
                );

                $table->index(
                    ['tenant_id', 'status'],
                    'hrm_offer_status_idx'
                );
            }
        );

        Schema::create(
            'hrm_onboarding_plans',
            function (Blueprint $table): void {
                $table->id();
                $table->uuid('uuid')->unique();

                $table->foreignId('tenant_id')
                    ->constrained('tenants')
                    ->cascadeOnDelete();

                $table->foreignId('application_id')
                    ->nullable()
                    ->constrained('hrm_recruitment_applications')
                    ->nullOnDelete();

                $table->foreignId('employee_id')
                    ->nullable()
                    ->constrained('hrm_employees')
                    ->nullOnDelete();

                $table->string('title', 191);

                $table->date('start_date');
                $table->date('target_completion_date')
                    ->nullable();

                $table->string('status', 30)
                    ->default('active');

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

                $table->unique(
                    ['tenant_id', 'employee_id'],
                    'hrm_onboarding_employee_uq'
                );

                $table->index(
                    ['tenant_id', 'status'],
                    'hrm_onboarding_status_idx'
                );
            }
        );

        Schema::create(
            'hrm_onboarding_tasks',
            function (Blueprint $table): void {
                $table->id();
                $table->uuid('uuid')->unique();

                $table->foreignId('tenant_id')
                    ->constrained('tenants')
                    ->cascadeOnDelete();

                $table->foreignId('plan_id')
                    ->constrained('hrm_onboarding_plans')
                    ->cascadeOnDelete();

                /*
                 * Supported task types:
                 * induction
                 * equipment
                 * document_verification
                 * probation
                 * other
                 */
                $table->string('task_type', 50);
                $table->string('title', 191);
                $table->text('description')->nullable();

                $table->date('due_date')->nullable();

                /*
                 * Equipment code, document reference, training reference,
                 * etc. No private file path is required here.
                 */
                $table->string('reference', 191)
                    ->nullable();

                $table->foreignId('assigned_employee_id')
                    ->nullable()
                    ->constrained('hrm_employees')
                    ->nullOnDelete();

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

                $table->foreignId('verified_by')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table->timestamp('verified_at')
                    ->nullable();

                $table->text('completion_notes')
                    ->nullable();

                $table->timestamps();

                $table->index(
                    ['tenant_id', 'plan_id', 'status'],
                    'hrm_onboarding_task_plan_idx'
                );

                $table->index(
                    ['tenant_id', 'task_type', 'status'],
                    'hrm_onboarding_task_type_idx'
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

        $permissionIds =
            DB::table('permissions')
                ->whereIn(
                    'code',
                    array_keys(self::PERMISSIONS)
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
                        'recruiter',
                    ]
                )
                ->pluck('id')
                ->all();

        foreach ($roleIds as $roleId) {
            foreach ($permissionIds as $permissionId) {
                DB::table('permission_role')
                    ->insertOrIgnore([
                        'role_id' => $roleId,
                        'permission_id' => $permissionId,
                    ]);
            }
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('hrm_onboarding_tasks');
        Schema::dropIfExists('hrm_onboarding_plans');
        Schema::dropIfExists('hrm_recruitment_offers');
        Schema::dropIfExists('hrm_recruitment_interviews');
        Schema::dropIfExists('hrm_recruitment_applications');
        Schema::dropIfExists('hrm_recruitment_candidates');
        Schema::dropIfExists('hrm_recruitment_vacancies');
        Schema::dropIfExists('hrm_recruitment_requisitions');

        $permissionIds =
            DB::table('permissions')
                ->whereIn(
                    'code',
                    array_keys(self::PERMISSIONS)
                )
                ->pluck('id')
                ->all();

        if ($permissionIds) {
            DB::table('permission_role')
                ->whereIn(
                    'permission_id',
                    $permissionIds
                )
                ->delete();
        }

        DB::table('permissions')
            ->whereIn(
                'code',
                array_keys(self::PERMISSIONS)
            )
            ->delete();
    }
};
