<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const PERMISSIONS = [
        'hrm.performance.view' => [
            'View Performance',
            'View performance cycles, goals, reviews and development plans.',
        ],

        'hrm.performance.manage' => [
            'Manage Performance',
            'Create and manage performance records.',
        ],

        'hrm.performance.approve' => [
            'Approve Performance',
            'Approve performance cycles and completed reviews.',
        ],

        'hrm.learning.view' => [
            'View Learning',
            'View learning catalogue, enrolment and certification records.',
        ],

        'hrm.learning.manage' => [
            'Manage Learning',
            'Manage courses, enrolments and learning completion.',
        ],

        'hrm.learning.approve' => [
            'Approve Learning',
            'Issue and control employee learning certifications.',
        ],
    ];

    public function up(): void
    {
        Schema::create(
            'hrm_performance_cycles',
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

                $table->date('starts_on');
                $table->date('ends_on');

                $table->date('goal_setting_deadline')
                    ->nullable();

                $table->date('review_deadline')
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

                $table->timestamp('submitted_at')
                    ->nullable();

                $table->foreignId('approved_by')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table->timestamp('approved_at')
                    ->nullable();

                $table->timestamps();

                $table->unique(
                    [
                        'tenant_id',
                        'code',
                    ],
                    'hrm_perf_cycle_code_uq'
                );

                $table->index(
                    [
                        'tenant_id',
                        'branch_id',
                        'status',
                    ],
                    'hrm_perf_cycle_scope_idx'
                );
            }
        );

        Schema::create(
            'hrm_performance_goals',
            function (Blueprint $table): void {
                $table->id();
                $table->uuid('uuid')->unique();

                $table->foreignId('tenant_id')
                    ->constrained('tenants')
                    ->cascadeOnDelete();

                $table->foreignId('cycle_id')
                    ->constrained('hrm_performance_cycles')
                    ->cascadeOnDelete();

                $table->foreignId('employee_id')
                    ->constrained('hrm_employees')
                    ->cascadeOnDelete();

                $table->foreignId('manager_employee_id')
                    ->nullable()
                    ->constrained('hrm_employees')
                    ->nullOnDelete();

                $table->string('title', 191);
                $table->text('description')->nullable();

                $table->string('metric_type', 50)
                    ->default('percentage');

                $table->string('target_value', 191)
                    ->nullable();

                $table->decimal('weight', 5, 2)
                    ->default(0);

                $table->decimal('progress_percent', 5, 2)
                    ->default(0);

                $table->date('due_date')
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

                $table->index(
                    [
                        'tenant_id',
                        'cycle_id',
                        'employee_id',
                        'status',
                    ],
                    'hrm_perf_goal_scope_idx'
                );
            }
        );

        Schema::create(
            'hrm_performance_reviews',
            function (Blueprint $table): void {
                $table->id();
                $table->uuid('uuid')->unique();

                $table->foreignId('tenant_id')
                    ->constrained('tenants')
                    ->cascadeOnDelete();

                $table->foreignId('cycle_id')
                    ->constrained('hrm_performance_cycles')
                    ->cascadeOnDelete();

                $table->foreignId('employee_id')
                    ->constrained('hrm_employees')
                    ->cascadeOnDelete();

                $table->foreignId('reviewer_employee_id')
                    ->nullable()
                    ->constrained('hrm_employees')
                    ->nullOnDelete();

                $table->decimal('overall_rating', 4, 2)
                    ->nullable();

                $table->text('employee_comments')
                    ->nullable();

                $table->text('manager_comments')
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

                $table->timestamp('submitted_at')
                    ->nullable();

                $table->foreignId('approved_by')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table->timestamp('approved_at')
                    ->nullable();

                $table->timestamps();

                $table->unique(
                    [
                        'tenant_id',
                        'cycle_id',
                        'employee_id',
                    ],
                    'hrm_perf_review_employee_cycle_uq'
                );

                $table->index(
                    [
                        'tenant_id',
                        'status',
                    ],
                    'hrm_perf_review_status_idx'
                );
            }
        );

        Schema::create(
            'hrm_performance_review_competencies',
            function (Blueprint $table): void {
                $table->id();
                $table->uuid('uuid')->unique();

                $table->foreignId('tenant_id')
                    ->constrained('tenants')
                    ->cascadeOnDelete();

                $table->foreignId('review_id')
                    ->constrained('hrm_performance_reviews')
                    ->cascadeOnDelete();

                $table->string('competency_code', 100);
                $table->string('competency_name', 191);

                $table->decimal('rating', 4, 2);

                $table->text('evidence')
                    ->nullable();

                $table->foreignId('assessed_by')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table->timestamps();

                $table->unique(
                    [
                        'review_id',
                        'competency_code',
                    ],
                    'hrm_perf_review_competency_uq'
                );
            }
        );

        Schema::create(
            'hrm_development_plans',
            function (Blueprint $table): void {
                $table->id();
                $table->uuid('uuid')->unique();

                $table->foreignId('tenant_id')
                    ->constrained('tenants')
                    ->cascadeOnDelete();

                $table->foreignId('employee_id')
                    ->constrained('hrm_employees')
                    ->cascadeOnDelete();

                $table->foreignId('source_review_id')
                    ->nullable()
                    ->constrained('hrm_performance_reviews')
                    ->nullOnDelete();

                $table->string('objective', 191);
                $table->text('development_action');

                $table->date('target_date')
                    ->nullable();

                $table->string('status', 30)
                    ->default('active');

                $table->text('progress_notes')
                    ->nullable();

                $table->foreignId('created_by')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table->foreignId('updated_by')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table->timestamps();

                $table->index(
                    [
                        'tenant_id',
                        'employee_id',
                        'status',
                    ],
                    'hrm_development_plan_scope_idx'
                );
            }
        );

        Schema::create(
            'hrm_learning_courses',
            function (Blueprint $table): void {
                $table->id();
                $table->uuid('uuid')->unique();

                $table->foreignId('tenant_id')
                    ->constrained('tenants')
                    ->cascadeOnDelete();

                $table->string('code', 100);
                $table->string('title', 191);

                $table->string('provider', 191)
                    ->nullable();

                $table->string('delivery_mode', 50)
                    ->default('classroom');

                $table->decimal('duration_hours', 8, 2)
                    ->nullable();

                $table->boolean('mandatory')
                    ->default(false);

                $table->boolean('certification_required')
                    ->default(false);

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
                    [
                        'tenant_id',
                        'code',
                    ],
                    'hrm_learning_course_code_uq'
                );

                $table->index(
                    [
                        'tenant_id',
                        'status',
                    ],
                    'hrm_learning_course_status_idx'
                );
            }
        );

        Schema::create(
            'hrm_learning_enrollments',
            function (Blueprint $table): void {
                $table->id();
                $table->uuid('uuid')->unique();

                $table->foreignId('tenant_id')
                    ->constrained('tenants')
                    ->cascadeOnDelete();

                $table->foreignId('employee_id')
                    ->constrained('hrm_employees')
                    ->cascadeOnDelete();

                $table->foreignId('course_id')
                    ->constrained('hrm_learning_courses')
                    ->cascadeOnDelete();

                $table->string('status', 30)
                    ->default('enrolled');

                $table->timestamp('enrolled_at');

                $table->date('due_date')
                    ->nullable();

                $table->timestamp('completed_at')
                    ->nullable();

                $table->decimal('score', 6, 2)
                    ->nullable();

                $table->string('result', 30)
                    ->nullable();

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

                $table->timestamps();

                $table->unique(
                    [
                        'tenant_id',
                        'employee_id',
                        'course_id',
                    ],
                    'hrm_learning_enrollment_uq'
                );

                $table->index(
                    [
                        'tenant_id',
                        'status',
                    ],
                    'hrm_learning_enrollment_status_idx'
                );
            }
        );

        Schema::create(
            'hrm_learning_certifications',
            function (Blueprint $table): void {
                $table->id();
                $table->uuid('uuid')->unique();

                $table->foreignId('tenant_id')
                    ->constrained('tenants')
                    ->cascadeOnDelete();

                $table->foreignId('employee_id')
                    ->constrained('hrm_employees')
                    ->cascadeOnDelete();

                $table->foreignId('course_id')
                    ->nullable()
                    ->constrained('hrm_learning_courses')
                    ->nullOnDelete();

                $table->foreignId('enrollment_id')
                    ->nullable()
                    ->constrained('hrm_learning_enrollments')
                    ->nullOnDelete();

                $table->string('certificate_code', 100);

                $table->date('issued_at');

                $table->date('expires_at')
                    ->nullable();

                $table->string('status', 30)
                    ->default('valid');

                $table->foreignId('issued_by')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table->timestamps();

                $table->unique(
                    [
                        'tenant_id',
                        'certificate_code',
                    ],
                    'hrm_learning_certificate_code_uq'
                );

                $table->index(
                    [
                        'tenant_id',
                        'employee_id',
                        'status',
                    ],
                    'hrm_learning_certificate_scope_idx'
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
            'hrm_learning_certifications'
        );

        Schema::dropIfExists(
            'hrm_learning_enrollments'
        );

        Schema::dropIfExists(
            'hrm_learning_courses'
        );

        Schema::dropIfExists(
            'hrm_development_plans'
        );

        Schema::dropIfExists(
            'hrm_performance_review_competencies'
        );

        Schema::dropIfExists(
            'hrm_performance_reviews'
        );

        Schema::dropIfExists(
            'hrm_performance_goals'
        );

        Schema::dropIfExists(
            'hrm_performance_cycles'
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
