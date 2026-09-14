<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private $permissions = [
        'hrm.view' => [
            'name' => 'View Human Resources',
            'description' => 'Access the Human Resources Management workspace.',
        ],

        'hrm.organization.view' => [
            'name' => 'View HR Organization Structure',
            'description' => 'View HR positions, grades and organization assignments.',
        ],

        'hrm.organization.manage' => [
            'name' => 'Manage HR Organization Structure',
            'description' => 'Create and maintain HR positions, grades and organization assignments.',
        ],

        'hrm.employee.view' => [
            'name' => 'View Employees',
            'description' => 'View employee master records within authorized scope.',
        ],

        'hrm.employee.manage' => [
            'name' => 'Manage Employees',
            'description' => 'Create and maintain employee master and assignment records.',
        ],

        'hrm.employee.sensitive.view' => [
            'name' => 'View Sensitive Employee Information',
            'description' => 'View protected employee personal and confidential information.',
        ],

        'hrm.employee.sensitive.manage' => [
            'name' => 'Manage Sensitive Employee Information',
            'description' => 'Maintain protected employee personal and confidential information.',
        ],

        'hrm.contract.view' => [
            'name' => 'View Employee Contracts',
            'description' => 'View employment contract records.',
        ],

        'hrm.contract.manage' => [
            'name' => 'Manage Employee Contracts',
            'description' => 'Create and maintain employment contract records.',
        ],

        'hrm.compensation.view' => [
            'name' => 'View Employee Compensation',
            'description' => 'View compensation history for authorized employees.',
        ],

        'hrm.compensation.manage' => [
            'name' => 'Manage Employee Compensation',
            'description' => 'Prepare and maintain controlled compensation changes.',
        ],

        'hrm.compensation.approve' => [
            'name' => 'Approve Employee Compensation',
            'description' => 'Approve controlled employee compensation changes.',
        ],

        'hrm.document.view' => [
            'name' => 'View Employee Documents',
            'description' => 'View authorized employee document metadata and files.',
        ],

        'hrm.document.manage' => [
            'name' => 'Manage Employee Documents',
            'description' => 'Upload and maintain authorized employee documents.',
        ],

        'hrm.credential.view' => [
            'name' => 'View Professional Credentials',
            'description' => 'View professional qualifications, licences and credential expiry status.',
        ],

        'hrm.credential.manage' => [
            'name' => 'Manage Professional Credentials',
            'description' => 'Maintain professional qualifications, licences and credential verification.',
        ],

        'hrm.audit.view' => [
            'name' => 'View HR Audit Trail',
            'description' => 'View authorized HRM audit history.',
        ],
    ];


    public function up(): void
    {
        DB::transaction(function (): void {
            $this->createJobGrades();
            $this->createPositions();
            $this->createEmployees();
            $this->createAssignments();
            $this->createContracts();
            $this->createCompensationHistory();
            $this->createDocuments();
            $this->createCredentials();
            $this->createEmergencyContacts();
            $this->createDependants();

            $this->registerPermissions();
            $this->grantAdministrativePermissions();
        });
    }


    private function createJobGrades(): void
    {
        Schema::create('hrm_job_grades', function (Blueprint $table): void {
            $table->bigIncrements('id');

            $table->uuid('uuid')->unique();

            $table->unsignedBigInteger('tenant_id');

            $table->string('code', 100);
            $table->string('name', 191);

            $table->text('description')->nullable();

            $table->unsignedInteger('grade_level')->nullable();

            $table->decimal('minimum_salary', 18, 2)->nullable();
            $table->decimal('maximum_salary', 18, 2)->nullable();

            $table->string('currency', 3)->default('RWF');

            $table->string('status', 30)->default('active');

            $table->date('effective_from')->nullable();
            $table->date('effective_to')->nullable();

            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();

            $table->timestamps();

            $table->unique(
                ['tenant_id', 'code'],
                'uq_hrm_grade_tenant_code'
            );

            $table->index(
                ['tenant_id', 'status'],
                'ix_hrm_grade_tenant_status'
            );
        });
    }


    private function createPositions(): void
    {
        Schema::create('hrm_positions', function (Blueprint $table): void {
            $table->bigIncrements('id');

            $table->uuid('uuid')->unique();

            $table->unsignedBigInteger('tenant_id');

            $table->unsignedBigInteger('branch_id')->nullable();
            $table->unsignedBigInteger('department_id')->nullable();

            $table->unsignedBigInteger('job_grade_id')->nullable();
            $table->unsignedBigInteger('reports_to_position_id')->nullable();

            $table->string('code', 100);
            $table->string('title', 191);

            $table->text('description')->nullable();

            $table->unsignedInteger('headcount_budget')->nullable();

            $table->boolean('requires_professional_license')
                ->default(false);

            $table->string('status', 30)->default('active');

            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();

            $table->timestamps();

            $table->unique(
                ['tenant_id', 'code'],
                'uq_hrm_position_tenant_code'
            );

            $table->index(
                ['tenant_id', 'branch_id', 'department_id'],
                'ix_hrm_position_scope'
            );

            $table->index(
                ['tenant_id', 'status'],
                'ix_hrm_position_status'
            );

            $table->foreign(
                'job_grade_id',
                'fk_hrm_position_grade'
            )
                ->references('id')
                ->on('hrm_job_grades')
                ->nullOnDelete();
        });
    }


    private function createEmployees(): void
    {
        Schema::create('hrm_employees', function (Blueprint $table): void {
            $table->bigIncrements('id');

            $table->uuid('uuid')->unique();

            $table->unsignedBigInteger('tenant_id');

            $table->string('employee_number', 100);

            /*
             * Employee identity is independent from application login.
             */
            $table->unsignedBigInteger('user_id')->nullable();

            $table->unsignedBigInteger('home_branch_id')->nullable();
            $table->unsignedBigInteger('current_department_id')->nullable();

            $table->unsignedBigInteger('current_position_id')->nullable();
            $table->unsignedBigInteger('job_grade_id')->nullable();

            $table->unsignedBigInteger('manager_employee_id')->nullable();

            $table->string('first_name', 100);
            $table->string('middle_name', 100)->nullable();
            $table->string('last_name', 100);
            $table->string('preferred_name', 100)->nullable();

            $table->string('work_email', 191)->nullable();

            $table->string('employment_status', 30)
                ->default('active');

            $table->string('employment_type', 50)
                ->default('permanent');

            $table->date('hire_date')->nullable();
            $table->date('termination_date')->nullable();
            $table->date('probation_end_date')->nullable();

            /*
             * Sensitive identity/contact/statutory profile is encrypted
             * at the application model layer.
             */
            $table->text('private_profile')->nullable();

            $table->json('metadata')->nullable();

            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();

            $table->timestamps();

            $table->unique(
                ['tenant_id', 'employee_number'],
                'uq_hrm_employee_number'
            );

            $table->index(
                ['tenant_id', 'employment_status'],
                'ix_hrm_employee_status'
            );

            $table->index(
                ['tenant_id', 'home_branch_id'],
                'ix_hrm_employee_branch'
            );

            $table->index(
                ['tenant_id', 'current_department_id'],
                'ix_hrm_employee_department'
            );

            $table->index(
                ['tenant_id', 'current_position_id'],
                'ix_hrm_employee_position'
            );

            $table->index(
                ['tenant_id', 'user_id'],
                'ix_hrm_employee_user'
            );

            $table->foreign(
                'current_position_id',
                'fk_hrm_employee_position'
            )
                ->references('id')
                ->on('hrm_positions')
                ->nullOnDelete();

            $table->foreign(
                'job_grade_id',
                'fk_hrm_employee_grade'
            )
                ->references('id')
                ->on('hrm_job_grades')
                ->nullOnDelete();
        });
    }


    private function createAssignments(): void
    {
        Schema::create('hrm_employee_assignments', function (Blueprint $table): void {
            $table->bigIncrements('id');

            $table->uuid('uuid')->unique();

            $table->unsignedBigInteger('tenant_id');
            $table->unsignedBigInteger('employee_id');

            $table->unsignedBigInteger('branch_id')->nullable();
            $table->unsignedBigInteger('department_id')->nullable();

            $table->unsignedBigInteger('position_id')->nullable();
            $table->unsignedBigInteger('job_grade_id')->nullable();

            $table->unsignedBigInteger('manager_employee_id')->nullable();

            $table->string('assignment_type', 50)
                ->default('primary');

            $table->date('effective_from');
            $table->date('effective_to')->nullable();

            $table->string('status', 30)
                ->default('active');

            $table->text('reason')->nullable();

            $table->unsignedBigInteger('approved_by')->nullable();
            $table->timestamp('approved_at')->nullable();

            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();

            $table->timestamps();

            $table->index(
                ['tenant_id', 'employee_id'],
                'ix_hrm_assignment_employee'
            );

            $table->index(
                ['tenant_id', 'branch_id', 'department_id'],
                'ix_hrm_assignment_scope'
            );

            $table->index(
                ['employee_id', 'effective_from', 'effective_to'],
                'ix_hrm_assignment_dates'
            );

            $table->foreign(
                'employee_id',
                'fk_hrm_assignment_employee'
            )
                ->references('id')
                ->on('hrm_employees')
                ->cascadeOnDelete();

            $table->foreign(
                'position_id',
                'fk_hrm_assignment_position'
            )
                ->references('id')
                ->on('hrm_positions')
                ->nullOnDelete();

            $table->foreign(
                'job_grade_id',
                'fk_hrm_assignment_grade'
            )
                ->references('id')
                ->on('hrm_job_grades')
                ->nullOnDelete();
        });
    }


    private function createContracts(): void
    {
        Schema::create('hrm_employee_contracts', function (Blueprint $table): void {
            $table->bigIncrements('id');

            $table->uuid('uuid')->unique();

            $table->unsignedBigInteger('tenant_id');
            $table->unsignedBigInteger('employee_id');

            $table->string('contract_number', 100);

            $table->string('contract_type', 50);

            $table->date('start_date');
            $table->date('end_date')->nullable();

            $table->date('probation_end_date')->nullable();

            $table->string('work_schedule_type', 50)
                ->nullable();

            $table->decimal(
                'working_hours_per_week',
                6,
                2
            )->nullable();

            $table->string('status', 30)
                ->default('draft');

            $table->timestamp('signed_at')->nullable();

            $table->text('notes')->nullable();

            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();

            $table->timestamps();

            $table->unique(
                ['tenant_id', 'contract_number'],
                'uq_hrm_contract_number'
            );

            $table->index(
                ['tenant_id', 'employee_id', 'status'],
                'ix_hrm_contract_employee'
            );

            $table->index(
                ['employee_id', 'start_date', 'end_date'],
                'ix_hrm_contract_dates'
            );

            $table->foreign(
                'employee_id',
                'fk_hrm_contract_employee'
            )
                ->references('id')
                ->on('hrm_employees')
                ->cascadeOnDelete();
        });
    }


    private function createCompensationHistory(): void
    {
        Schema::create('hrm_compensation_histories', function (Blueprint $table): void {
            $table->bigIncrements('id');

            $table->uuid('uuid')->unique();

            $table->unsignedBigInteger('tenant_id');
            $table->unsignedBigInteger('employee_id');
            $table->unsignedBigInteger('contract_id')->nullable();

            $table->date('effective_from');
            $table->date('effective_to')->nullable();

            $table->string('currency', 3)
                ->default('RWF');

            $table->string('pay_frequency', 30)
                ->default('monthly');

            /*
             * Compensation fact, not payroll result.
             */
            $table->decimal('basic_salary', 18, 2);

            $table->decimal(
                'fixed_gross_compensation',
                18,
                2
            )->nullable();

            $table->string('status', 30)
                ->default('draft');

            $table->text('reason')->nullable();

            $table->unsignedBigInteger('approved_by')->nullable();
            $table->timestamp('approved_at')->nullable();

            $table->json('metadata')->nullable();

            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();

            $table->timestamps();

            $table->index(
                ['tenant_id', 'employee_id', 'status'],
                'ix_hrm_comp_employee'
            );

            $table->index(
                ['employee_id', 'effective_from', 'effective_to'],
                'ix_hrm_comp_dates'
            );

            $table->foreign(
                'employee_id',
                'fk_hrm_comp_employee'
            )
                ->references('id')
                ->on('hrm_employees')
                ->cascadeOnDelete();

            $table->foreign(
                'contract_id',
                'fk_hrm_comp_contract'
            )
                ->references('id')
                ->on('hrm_employee_contracts')
                ->nullOnDelete();
        });
    }


    private function createDocuments(): void
    {
        Schema::create('hrm_employee_documents', function (Blueprint $table): void {
            $table->bigIncrements('id');

            $table->uuid('uuid')->unique();

            $table->unsignedBigInteger('tenant_id');
            $table->unsignedBigInteger('employee_id');

            $table->string('document_type', 50);
            $table->string('title', 191);

            $table->string('disk', 50)
                ->default('local');

            /*
             * Files themselves must later remain outside public web root.
             */
            $table->string('storage_path', 191);

            $table->string('original_filename', 191)->nullable();
            $table->string('mime_type', 100)->nullable();

            $table->unsignedBigInteger('size_bytes')->nullable();

            $table->string('checksum_sha256', 64)->nullable();

            $table->string('classification', 30)
                ->default('confidential');

            $table->date('issued_at')->nullable();
            $table->date('expires_at')->nullable();

            $table->string('status', 30)
                ->default('active');

            $table->unsignedBigInteger('uploaded_by')->nullable();

            $table->timestamps();

            $table->index(
                ['tenant_id', 'employee_id', 'document_type'],
                'ix_hrm_document_employee'
            );

            $table->index(
                ['tenant_id', 'expires_at'],
                'ix_hrm_document_expiry'
            );

            $table->foreign(
                'employee_id',
                'fk_hrm_document_employee'
            )
                ->references('id')
                ->on('hrm_employees')
                ->cascadeOnDelete();
        });
    }


    private function createCredentials(): void
    {
        Schema::create('hrm_professional_credentials', function (Blueprint $table): void {
            $table->bigIncrements('id');

            $table->uuid('uuid')->unique();

            $table->unsignedBigInteger('tenant_id');
            $table->unsignedBigInteger('employee_id');

            $table->string('credential_type', 50);
            $table->string('credential_name', 191);

            $table->string('issuing_authority', 191)->nullable();

            $table->text('encrypted_reference')->nullable();

            $table->date('issued_at')->nullable();
            $table->date('expires_at')->nullable();

            $table->string('status', 30)
                ->default('active');

            $table->boolean('verified')
                ->default(false);

            $table->unsignedBigInteger('verified_by')->nullable();
            $table->timestamp('verified_at')->nullable();

            $table->json('metadata')->nullable();

            $table->timestamps();

            $table->index(
                ['tenant_id', 'employee_id'],
                'ix_hrm_credential_employee'
            );

            $table->index(
                ['tenant_id', 'credential_type', 'expires_at'],
                'ix_hrm_credential_expiry'
            );

            $table->foreign(
                'employee_id',
                'fk_hrm_credential_employee'
            )
                ->references('id')
                ->on('hrm_employees')
                ->cascadeOnDelete();
        });
    }


    private function createEmergencyContacts(): void
    {
        Schema::create('hrm_employee_emergency_contacts', function (Blueprint $table): void {
            $table->bigIncrements('id');

            $table->uuid('uuid')->unique();

            $table->unsignedBigInteger('tenant_id');
            $table->unsignedBigInteger('employee_id');

            $table->string('relationship_type', 50)
                ->nullable();

            $table->text('encrypted_payload');

            $table->boolean('is_primary')
                ->default(false);

            $table->string('status', 30)
                ->default('active');

            $table->timestamps();

            $table->index(
                ['tenant_id', 'employee_id'],
                'ix_hrm_emergency_employee'
            );

            $table->foreign(
                'employee_id',
                'fk_hrm_emergency_employee'
            )
                ->references('id')
                ->on('hrm_employees')
                ->cascadeOnDelete();
        });
    }


    private function createDependants(): void
    {
        Schema::create('hrm_employee_dependants', function (Blueprint $table): void {
            $table->bigIncrements('id');

            $table->uuid('uuid')->unique();

            $table->unsignedBigInteger('tenant_id');
            $table->unsignedBigInteger('employee_id');

            $table->string('relationship_type', 50);

            $table->text('encrypted_payload');

            $table->boolean('eligible_for_benefits')
                ->default(false);

            $table->string('status', 30)
                ->default('active');

            $table->timestamps();

            $table->index(
                ['tenant_id', 'employee_id'],
                'ix_hrm_dependant_employee'
            );

            $table->foreign(
                'employee_id',
                'fk_hrm_dependant_employee'
            )
                ->references('id')
                ->on('hrm_employees')
                ->cascadeOnDelete();
        });
    }


    private function registerPermissions(): void
    {
        if (! Schema::hasTable('permissions')) {
            return;
        }

        $now = now();

        foreach ($this->permissions as $code => $definition) {
            $values = [
                'code' => $code,
            ];

            if (Schema::hasColumn('permissions', 'name')) {
                $values['name'] = $definition['name'];
            }

            if (Schema::hasColumn('permissions', 'permission_group')) {
                $values['permission_group'] = 'hrm';
            }

            if (Schema::hasColumn('permissions', 'description')) {
                $values['description'] = $definition['description'];
            }

            if (Schema::hasColumn('permissions', 'status')) {
                $values['status'] = 'active';
            }

            if (Schema::hasColumn('permissions', 'created_at')) {
                $values['created_at'] = $now;
            }

            if (Schema::hasColumn('permissions', 'updated_at')) {
                $values['updated_at'] = $now;
            }

            DB::table('permissions')
                ->updateOrInsert(
                    ['code' => $code],
                    $values
                );
        }
    }


    private function grantAdministrativePermissions(): void
    {
        if (
            ! Schema::hasTable('roles')
            ||
            ! Schema::hasTable('permissions')
            ||
            ! Schema::hasTable('permission_role')
        ) {
            return;
        }

        $permissionIds = DB::table('permissions')
            ->whereIn(
                'code',
                array_keys($this->permissions)
            )
            ->pluck('id');

        $roleIds = DB::table('roles')
            ->whereIn(
                'code',
                [
                    'ubuzima_plus_super_admin',
                    'pharmaco360_solution_admin',
                    'tenant_admin',
                ]
            )
            ->pluck('id');

        $hasCreatedAt = Schema::hasColumn(
            'permission_role',
            'created_at'
        );

        $hasUpdatedAt = Schema::hasColumn(
            'permission_role',
            'updated_at'
        );

        $now = now();

        foreach ($roleIds as $roleId) {
            foreach ($permissionIds as $permissionId) {
                $values = [
                    'role_id' => $roleId,
                    'permission_id' => $permissionId,
                ];

                if ($hasCreatedAt) {
                    $values['created_at'] = $now;
                }

                if ($hasUpdatedAt) {
                    $values['updated_at'] = $now;
                }

                DB::table('permission_role')
                    ->insertOrIgnore(
                        $values
                    );
            }
        }
    }


    public function down(): void
    {
        DB::transaction(function (): void {
            if (Schema::hasTable('permissions')) {
                $permissionIds = DB::table('permissions')
                    ->whereIn(
                        'code',
                        array_keys($this->permissions)
                    )
                    ->pluck('id');

                if (
                    Schema::hasTable('permission_role')
                    &&
                    $permissionIds->isNotEmpty()
                ) {
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
                        array_keys($this->permissions)
                    )
                    ->delete();
            }

            Schema::dropIfExists('hrm_employee_dependants');
            Schema::dropIfExists('hrm_employee_emergency_contacts');
            Schema::dropIfExists('hrm_professional_credentials');
            Schema::dropIfExists('hrm_employee_documents');
            Schema::dropIfExists('hrm_compensation_histories');
            Schema::dropIfExists('hrm_employee_contracts');
            Schema::dropIfExists('hrm_employee_assignments');
            Schema::dropIfExists('hrm_employees');
            Schema::dropIfExists('hrm_positions');
            Schema::dropIfExists('hrm_job_grades');
        });
    }
};
