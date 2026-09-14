<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create(
            'payroll_employee_statutory_profiles',
            function (Blueprint $table) {
                $table->id();
                $table->uuid('uuid')->unique();

                $table->foreignId('tenant_id')
                    ->constrained('tenants')
                    ->cascadeOnDelete();

                $table->foreignId('employee_id')
                    ->constrained('hrm_employees')
                    ->cascadeOnDelete();

                $table->string(
                    'employee_category',
                    50
                )->nullable();

                $table->text(
                    'statutory_payload'
                )->nullable();

                $table->string(
                    'status',
                    30
                )->default('active');

                $table->unsignedBigInteger(
                    'created_by'
                )->nullable();

                $table->unsignedBigInteger(
                    'updated_by'
                )->nullable();

                $table->timestamps();

                $table->unique(
                    [
                        'tenant_id',
                        'employee_id',
                    ],
                    'payroll_stat_profile_employee_uq'
                );

                $table->index(
                    [
                        'tenant_id',
                        'status',
                    ],
                    'payroll_stat_profile_status_ix'
                );
            }
        );


        Schema::create(
            'payroll_statutory_rule_versions',
            function (Blueprint $table) {
                $table->id();
                $table->uuid('uuid')->unique();

                $table->string(
                    'code',
                    100
                );

                $table->string(
                    'name',
                    191
                );

                $table->date(
                    'effective_from'
                );

                $table->date(
                    'effective_to'
                )->nullable();

                $table->decimal(
                    'employee_rate',
                    9,
                    6
                )->default(0);

                $table->decimal(
                    'employer_rate',
                    9,
                    6
                )->default(0);

                $table->string(
                    'base_code',
                    100
                );

                $table->string(
                    'rounding_rule',
                    50
                )->default('nearest_rwf');

                $table->string(
                    'condition_code',
                    100
                )->nullable();

                $table->string(
                    'source_reference',
                    191
                );

                $table->text(
                    'source_url'
                )->nullable();

                $table->json(
                    'metadata'
                )->nullable();

                $table->string(
                    'status',
                    30
                )->default('active');

                $table->timestamps();

                $table->index(
                    [
                        'code',
                        'effective_from',
                        'effective_to',
                        'status',
                    ],
                    'payroll_rule_effective_ix'
                );
            }
        );


        Schema::create(
            'payroll_periods',
            function (Blueprint $table) {
                $table->id();
                $table->uuid('uuid')->unique();

                $table->foreignId('tenant_id')
                    ->constrained('tenants')
                    ->cascadeOnDelete();

                $table->foreignId('branch_id')
                    ->nullable()
                    ->constrained('branches')
                    ->nullOnDelete();

                $table->unsignedSmallInteger(
                    'period_year'
                );

                $table->unsignedTinyInteger(
                    'period_month'
                );

                $table->date('starts_on');
                $table->date('ends_on');

                $table->string(
                    'status',
                    30
                )->default('OPEN');

                $table->unsignedBigInteger(
                    'created_by'
                )->nullable();

                $table->unsignedBigInteger(
                    'closed_by'
                )->nullable();

                $table->timestamp(
                    'closed_at'
                )->nullable();

                $table->timestamps();

                $table->unique(
                    [
                        'tenant_id',
                        'branch_id',
                        'period_year',
                        'period_month',
                    ],
                    'payroll_period_scope_month_uq'
                );

                $table->index(
                    [
                        'tenant_id',
                        'status',
                    ],
                    'payroll_period_status_ix'
                );
            }
        );


        Schema::create(
            'payroll_runs',
            function (Blueprint $table) {
                $table->id();
                $table->uuid('uuid')->unique();

                $table->foreignId('tenant_id')
                    ->constrained('tenants')
                    ->cascadeOnDelete();

                $table->foreignId('branch_id')
                    ->nullable()
                    ->constrained('branches')
                    ->nullOnDelete();

                $table->foreignId(
                    'payroll_period_id'
                )
                    ->constrained('payroll_periods')
                    ->restrictOnDelete();

                $table->string(
                    'run_number',
                    100
                );

                $table->unsignedInteger(
                    'revision_no'
                )->default(1);

                $table->string(
                    'status',
                    30
                )->default('DRAFT');

                $table->unsignedInteger(
                    'employee_count'
                )->default(0);

                $table->unsignedInteger(
                    'blocked_count'
                )->default(0);

                $table->decimal(
                    'total_gross_employment_income',
                    18,
                    2
                )->default(0);

                $table->decimal(
                    'total_paye',
                    18,
                    2
                )->default(0);

                $table->decimal(
                    'total_employee_deductions',
                    18,
                    2
                )->default(0);

                $table->decimal(
                    'total_net_salary',
                    18,
                    2
                )->default(0);

                $table->decimal(
                    'total_employer_contributions',
                    18,
                    2
                )->default(0);

                $table->decimal(
                    'total_employer_cost',
                    18,
                    2
                )->default(0);

                $table->unsignedBigInteger('created_by');

                $table->unsignedBigInteger(
                    'prepared_by'
                )->nullable();

                $table->unsignedBigInteger(
                    'submitted_by'
                )->nullable();

                $table->unsignedBigInteger(
                    'approved_by'
                )->nullable();

                $table->timestamp(
                    'prepared_at'
                )->nullable();

                $table->timestamp(
                    'submitted_at'
                )->nullable();

                $table->timestamp(
                    'approved_at'
                )->nullable();

                $table->json(
                    'metadata'
                )->nullable();

                $table->timestamps();

                $table->unique(
                    [
                        'tenant_id',
                        'run_number',
                    ],
                    'payroll_run_number_uq'
                );

                $table->index(
                    [
                        'tenant_id',
                        'status',
                    ],
                    'payroll_run_status_ix'
                );

                $table->index(
                    [
                        'payroll_period_id',
                        'revision_no',
                    ],
                    'payroll_run_period_revision_ix'
                );
            }
        );


        Schema::create(
            'payroll_run_employees',
            function (Blueprint $table) {
                $table->id();
                $table->uuid('uuid')->unique();

                $table->foreignId('tenant_id')
                    ->constrained('tenants')
                    ->cascadeOnDelete();

                $table->foreignId(
                    'payroll_run_id'
                )
                    ->constrained('payroll_runs')
                    ->cascadeOnDelete();

                $table->foreignId(
                    'employee_id'
                )
                    ->constrained('hrm_employees')
                    ->restrictOnDelete();

                $table->foreignId(
                    'compensation_id'
                )
                    ->nullable()
                    ->constrained(
                        'hrm_compensation_histories'
                    )
                    ->nullOnDelete();

                $table->string(
                    'employee_number',
                    100
                );

                $table->string(
                    'employee_name',
                    191
                );

                $table->string(
                    'employment_type',
                    50
                )->nullable();

                $table->json(
                    'compensation_snapshot'
                )->nullable();

                $table->text(
                    'statutory_snapshot'
                )->nullable();

                $table->decimal(
                    'basic_salary',
                    18,
                    2
                )->default(0);

                $table->decimal(
                    'fixed_gross_compensation',
                    18,
                    2
                )->nullable();

                $table->decimal(
                    'cash_gross_pay',
                    18,
                    2
                )->default(0);

                $table->decimal(
                    'gross_employment_income',
                    18,
                    2
                )->default(0);

                $table->decimal(
                    'absence_unpaid_leave',
                    18,
                    2
                )->default(0);

                $table->decimal(
                    'paye_taxable_income',
                    18,
                    2
                )->default(0);

                $table->decimal(
                    'pension_base',
                    18,
                    2
                )->default(0);

                $table->decimal(
                    'employee_pension',
                    18,
                    2
                )->default(0);

                $table->decimal(
                    'employer_pension',
                    18,
                    2
                )->default(0);

                $table->decimal(
                    'occupational_hazard_base',
                    18,
                    2
                )->default(0);

                $table->decimal(
                    'employer_occupational_hazard',
                    18,
                    2
                )->default(0);

                $table->decimal(
                    'maternity_base',
                    18,
                    2
                )->default(0);

                $table->decimal(
                    'employee_maternity',
                    18,
                    2
                )->default(0);

                $table->decimal(
                    'employer_maternity',
                    18,
                    2
                )->default(0);

                $table->decimal(
                    'rama_base',
                    18,
                    2
                )->default(0);

                $table->decimal(
                    'employee_rama',
                    18,
                    2
                )->default(0);

                $table->decimal(
                    'employer_rama',
                    18,
                    2
                )->default(0);

                $table->decimal(
                    'paye',
                    18,
                    2
                )->default(0);

                $table->decimal(
                    'net_before_cbhi',
                    18,
                    2
                )->default(0);

                $table->decimal(
                    'cbhi',
                    18,
                    2
                )->default(0);

                $table->decimal(
                    'total_employee_deductions',
                    18,
                    2
                )->default(0);

                $table->decimal(
                    'net_salary',
                    18,
                    2
                )->default(0);

                $table->decimal(
                    'employer_statutory_contributions',
                    18,
                    2
                )->default(0);

                $table->decimal(
                    'total_employer_cost',
                    18,
                    2
                )->default(0);

                $table->string(
                    'validation_status',
                    30
                )->default('blocked');

                $table->json(
                    'validation_flags'
                )->nullable();

                $table->text(
                    'review_notes'
                )->nullable();

                $table->timestamps();

                $table->unique(
                    [
                        'payroll_run_id',
                        'employee_id',
                    ],
                    'payroll_run_employee_uq'
                );

                $table->index(
                    [
                        'tenant_id',
                        'validation_status',
                    ],
                    'payroll_run_employee_validation_ix'
                );
            }
        );


        Schema::create(
            'payroll_run_components',
            function (Blueprint $table) {
                $table->id();
                $table->uuid('uuid')->unique();

                $table->foreignId('tenant_id')
                    ->constrained('tenants')
                    ->cascadeOnDelete();

                $table->foreignId(
                    'payroll_run_employee_id'
                )
                    ->constrained(
                        'payroll_run_employees'
                    )
                    ->cascadeOnDelete();

                $table->string(
                    'code',
                    100
                );

                $table->string(
                    'name',
                    191
                );

                $table->string(
                    'component_type',
                    50
                );

                $table->decimal(
                    'amount',
                    18,
                    2
                )->default(0);

                $table->boolean(
                    'affects_paye'
                )->default(false);

                $table->boolean(
                    'affects_pension'
                )->default(false);

                $table->string(
                    'source_type',
                    50
                )->default('manual');

                $table->unsignedBigInteger(
                    'source_id'
                )->nullable();

                $table->json(
                    'metadata'
                )->nullable();

                $table->unsignedBigInteger(
                    'created_by'
                )->nullable();

                $table->unsignedBigInteger(
                    'updated_by'
                )->nullable();

                $table->timestamps();

                $table->unique(
                    [
                        'payroll_run_employee_id',
                        'code',
                    ],
                    'payroll_component_employee_code_uq'
                );
            }
        );


        Schema::create(
            'payroll_statutory_lines',
            function (Blueprint $table) {
                $table->id();
                $table->uuid('uuid')->unique();

                $table->foreignId('tenant_id')
                    ->constrained('tenants')
                    ->cascadeOnDelete();

                $table->foreignId(
                    'payroll_run_employee_id'
                )
                    ->constrained(
                        'payroll_run_employees'
                    )
                    ->cascadeOnDelete();

                $table->foreignId(
                    'rule_version_id'
                )
                    ->constrained(
                        'payroll_statutory_rule_versions'
                    )
                    ->restrictOnDelete();

                $table->string(
                    'code',
                    100
                );

                $table->decimal(
                    'base_amount',
                    18,
                    2
                )->default(0);

                $table->decimal(
                    'employee_rate',
                    9,
                    6
                )->default(0);

                $table->decimal(
                    'employer_rate',
                    9,
                    6
                )->default(0);

                $table->decimal(
                    'employee_amount',
                    18,
                    2
                )->default(0);

                $table->decimal(
                    'employer_amount',
                    18,
                    2
                )->default(0);

                $table->json(
                    'calculation_snapshot'
                )->nullable();

                $table->timestamps();

                $table->unique(
                    [
                        'payroll_run_employee_id',
                        'code',
                    ],
                    'payroll_statutory_employee_code_uq'
                );
            }
        );


        Schema::create(
            'payroll_approval_actions',
            function (Blueprint $table) {
                $table->id();
                $table->uuid('uuid')->unique();

                $table->foreignId('tenant_id')
                    ->constrained('tenants')
                    ->cascadeOnDelete();

                $table->foreignId(
                    'payroll_run_id'
                )
                    ->constrained('payroll_runs')
                    ->cascadeOnDelete();

                $table->string(
                    'action',
                    50
                );

                $table->string(
                    'from_status',
                    30
                )->nullable();

                $table->string(
                    'to_status',
                    30
                );

                $table->unsignedBigInteger(
                    'actor_user_id'
                );

                $table->text(
                    'comments'
                )->nullable();

                $table->json(
                    'metadata'
                )->nullable();

                $table->timestamps();

                $table->index(
                    [
                        'payroll_run_id',
                        'created_at',
                    ],
                    'payroll_approval_run_created_ix'
                );
            }
        );


        $now = now();


        $rules = [
            [
                'code' =>
                    'PAYE',

                'name' =>
                    'Rwanda PAYE - regular monthly employment income',

                'effective_from' =>
                    '2025-01-01',

                'effective_to' =>
                    null,

                'employee_rate' =>
                    0,

                'employer_rate' =>
                    0,

                'base_code' =>
                    'paye_taxable_income',

                'rounding_rule' =>
                    'ceil_rwf',

                'condition_code' =>
                    'regular_or_secondary_employer',

                'source_reference' =>
                    'Rwanda Revenue Authority - Employment Tax / PAYE',

                'source_url' =>
                    'https://www.rra.gov.rw/en/tax-calculator/paye-calculator',

                'metadata' =>
                    json_encode([
                        'monthly_brackets' => [
                            [
                                'from' => 0,
                                'to' => 60000,
                                'rate' => 0.00,
                            ],
                            [
                                'from' => 60000,
                                'to' => 100000,
                                'rate' => 0.10,
                            ],
                            [
                                'from' => 100000,
                                'to' => 200000,
                                'rate' => 0.20,
                            ],
                            [
                                'from' => 200000,
                                'to' => null,
                                'rate' => 0.30,
                            ],
                        ],

                        'secondary_employer_rate' =>
                            0.30,

                        'casual_worker_rate_above_60000' =>
                            0.15,
                    ]),
            ],

            [
                'code' =>
                    'PENSION',

                'name' =>
                    'Mandatory pension 2025-2026',

                'effective_from' =>
                    '2025-01-01',

                'effective_to' =>
                    '2026-12-31',

                'employee_rate' =>
                    0.06,

                'employer_rate' =>
                    0.06,

                'base_code' =>
                    'contributory_gross_salary',

                'rounding_rule' =>
                    'nearest_rwf',

                'condition_code' =>
                    'mandatory_member',

                'source_reference' =>
                    'Presidential Order 086/01 of 12/12/2024',

                'source_url' =>
                    'https://www.rssb.rw/publications',

                'metadata' =>
                    json_encode([
                        'total_rate' => 0.12,
                        'equal_employer_employee_split' => true,
                    ]),
            ],

            [
                'code' =>
                    'PENSION',

                'name' =>
                    'Mandatory pension 2027',

                'effective_from' =>
                    '2027-01-01',

                'effective_to' =>
                    '2027-12-31',

                'employee_rate' =>
                    0.07,

                'employer_rate' =>
                    0.07,

                'base_code' =>
                    'contributory_gross_salary',

                'rounding_rule' =>
                    'nearest_rwf',

                'condition_code' =>
                    'mandatory_member',

                'source_reference' =>
                    'Presidential Order 086/01 of 12/12/2024',

                'source_url' =>
                    'https://www.rssb.rw/publications',

                'metadata' =>
                    json_encode([
                        'total_rate' => 0.14,
                    ]),
            ],

            [
                'code' =>
                    'PENSION',

                'name' =>
                    'Mandatory pension 2028',

                'effective_from' =>
                    '2028-01-01',

                'effective_to' =>
                    '2028-12-31',

                'employee_rate' =>
                    0.08,

                'employer_rate' =>
                    0.08,

                'base_code' =>
                    'contributory_gross_salary',

                'rounding_rule' =>
                    'nearest_rwf',

                'condition_code' =>
                    'mandatory_member',

                'source_reference' =>
                    'Presidential Order 086/01 of 12/12/2024',

                'source_url' =>
                    'https://www.rssb.rw/publications',

                'metadata' =>
                    json_encode([
                        'total_rate' => 0.16,
                    ]),
            ],

            [
                'code' =>
                    'PENSION',

                'name' =>
                    'Mandatory pension 2029',

                'effective_from' =>
                    '2029-01-01',

                'effective_to' =>
                    '2029-12-31',

                'employee_rate' =>
                    0.09,

                'employer_rate' =>
                    0.09,

                'base_code' =>
                    'contributory_gross_salary',

                'rounding_rule' =>
                    'nearest_rwf',

                'condition_code' =>
                    'mandatory_member',

                'source_reference' =>
                    'Presidential Order 086/01 of 12/12/2024',

                'source_url' =>
                    'https://www.rssb.rw/publications',

                'metadata' =>
                    json_encode([
                        'total_rate' => 0.18,
                    ]),
            ],

            [
                'code' =>
                    'PENSION',

                'name' =>
                    'Mandatory pension 2030 onward',

                'effective_from' =>
                    '2030-01-01',

                'effective_to' =>
                    null,

                'employee_rate' =>
                    0.10,

                'employer_rate' =>
                    0.10,

                'base_code' =>
                    'contributory_gross_salary',

                'rounding_rule' =>
                    'nearest_rwf',

                'condition_code' =>
                    'mandatory_member',

                'source_reference' =>
                    'Presidential Order 086/01 of 12/12/2024',

                'source_url' =>
                    'https://www.rssb.rw/publications',

                'metadata' =>
                    json_encode([
                        'total_rate' => 0.20,
                    ]),
            ],

            [
                'code' =>
                    'OCCUPATIONAL_HAZARD',

                'name' =>
                    'RSSB Occupational Hazards',

                'effective_from' =>
                    '2025-01-01',

                'effective_to' =>
                    null,

                'employee_rate' =>
                    0,

                'employer_rate' =>
                    0.02,

                'base_code' =>
                    'contributory_gross_salary',

                'rounding_rule' =>
                    'nearest_rwf',

                'condition_code' =>
                    'mandatory_member',

                'source_reference' =>
                    'RSSB Occupational Hazards Scheme',

                'source_url' =>
                    'https://www.rssb.rw/scheme/occupational-hazards',

                'metadata' =>
                    json_encode([
                        'employer_only' => true,
                    ]),
            ],

            [
                'code' =>
                    'MATERNITY',

                'name' =>
                    'RSSB Maternity Leave Benefits',

                'effective_from' =>
                    '2025-01-01',

                'effective_to' =>
                    null,

                'employee_rate' =>
                    0.003,

                'employer_rate' =>
                    0.003,

                'base_code' =>
                    'contributory_gross_salary',

                'rounding_rule' =>
                    'nearest_rwf',

                'condition_code' =>
                    'employee',

                'source_reference' =>
                    'RSSB Maternity Leave Scheme',

                'source_url' =>
                    'https://www.rssb.rw/scheme/maternity-leave',

                'metadata' =>
                    json_encode([
                        'total_rate' => 0.006,
                    ]),
            ],

            [
                'code' =>
                    'RAMA',

                'name' =>
                    'RSSB Medical Scheme / RAMA',

                'effective_from' =>
                    '2025-01-01',

                'effective_to' =>
                    null,

                'employee_rate' =>
                    0.075,

                'employer_rate' =>
                    0.075,

                'base_code' =>
                    'basic_salary',

                'rounding_rule' =>
                    'nearest_rwf',

                'condition_code' =>
                    'rama_member',

                'source_reference' =>
                    'RSSB Medical Scheme',

                'source_url' =>
                    'https://www.rssb.rw/scheme/medical-scheme',

                'metadata' =>
                    json_encode([
                        'total_rate' => 0.15,
                    ]),
            ],

            [
                'code' =>
                    'CBHI',

                'name' =>
                    'CBHI employee solidarity contribution',

                'effective_from' =>
                    '2025-01-01',

                'effective_to' =>
                    null,

                'employee_rate' =>
                    0.005,

                'employer_rate' =>
                    0,

                'base_code' =>
                    'net_before_cbhi',

                'rounding_rule' =>
                    'nearest_rwf',

                'condition_code' =>
                    'employee',

                'source_reference' =>
                    'RRA CBHI Contribution',

                'source_url' =>
                    'https://www.rra.gov.rw/en/domestic-tax-services/rssb-contributions/cbhi-contribution',

                'metadata' =>
                    json_encode([
                        'deducted_and_paid_by_employer' =>
                            true,
                    ]),
            ],
        ];


        foreach ($rules as $rule) {
            DB::table(
                'payroll_statutory_rule_versions'
            )->insert([
                'uuid' =>
                    (string) Str::uuid(),

                ...$rule,

                'status' =>
                    'active',

                'created_at' =>
                    $now,

                'updated_at' =>
                    $now,
            ]);
        }
    }


    public function down(): void
    {
        Schema::dropIfExists(
            'payroll_approval_actions'
        );

        Schema::dropIfExists(
            'payroll_statutory_lines'
        );

        Schema::dropIfExists(
            'payroll_run_components'
        );

        Schema::dropIfExists(
            'payroll_run_employees'
        );

        Schema::dropIfExists(
            'payroll_runs'
        );

        Schema::dropIfExists(
            'payroll_periods'
        );

        Schema::dropIfExists(
            'payroll_statutory_rule_versions'
        );

        Schema::dropIfExists(
            'payroll_employee_statutory_profiles'
        );
    }
};
