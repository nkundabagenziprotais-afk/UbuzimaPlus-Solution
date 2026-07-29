<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create(
            'finance_journal_drafts',
            function (Blueprint $table): void {
                $table->id();
                $table->uuid('uuid')->unique();

                $table->foreignId('tenant_id')
                    ->constrained()
                    ->cascadeOnDelete();

                $table->foreignId('branch_id')
                    ->nullable()
                    ->constrained('branches')
                    ->nullOnDelete();

                $table->date('business_date');
                $table->string('reference', 100);
                $table->text('description');
                $table->string('currency_code', 3)
                    ->default('RWF');
                $table->string('status', 30)
                    ->default('draft');
                $table->unsignedInteger('version')
                    ->default(1);

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

                $table->foreignId('posted_by')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table->timestamp('posted_at')
                    ->nullable();

                $table->foreignId(
                    'posted_journal_entry_id'
                )
                    ->nullable()
                    ->constrained(
                        'finance_journal_entries'
                    )
                    ->nullOnDelete();

                $table->foreignId('reversed_by')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table->timestamp('reversed_at')
                    ->nullable();

                $table->foreignId(
                    'reversal_journal_entry_id'
                )
                    ->nullable()
                    ->constrained(
                        'finance_journal_entries'
                    )
                    ->nullOnDelete();

                $table->json('metadata')
                    ->nullable();

                $table->timestamps();

                $table->index(
                    [
                        'tenant_id',
                        'status',
                        'business_date',
                    ],
                    'fjd_tenant_status_date_idx'
                );

                $table->index(
                    [
                        'tenant_id',
                        'branch_id',
                        'status',
                    ],
                    'fjd_tenant_branch_status_idx'
                );

                $table->index(
                    [
                        'tenant_id',
                        'reference',
                    ],
                    'fjd_tenant_reference_idx'
                );
            }
        );

        Schema::create(
            'finance_journal_draft_lines',
            function (Blueprint $table): void {
                $table->id();

                $table->foreignId(
                    'journal_draft_id'
                )
                    ->constrained(
                        'finance_journal_drafts'
                    )
                    ->cascadeOnDelete();

                $table->unsignedSmallInteger(
                    'line_number'
                );

                $table->foreignId(
                    'finance_chart_of_account_id'
                )
                    ->constrained(
                        'finance_chart_of_accounts'
                    )
                    ->restrictOnDelete();

                $table->text('description')
                    ->nullable();

                $table->decimal(
                    'debit_amount',
                    18,
                    4
                )->default(0);

                $table->decimal(
                    'credit_amount',
                    18,
                    4
                )->default(0);

                $table->json('metadata')
                    ->nullable();

                $table->timestamps();

                $table->unique(
                    [
                        'journal_draft_id',
                        'line_number',
                    ],
                    'fjdl_draft_line_uq'
                );

                $table->index(
                    'finance_chart_of_account_id',
                    'fjdl_account_idx'
                );
            }
        );

        Schema::create(
            'finance_approval_requests',
            function (Blueprint $table): void {
                $table->id();
                $table->uuid('uuid')->unique();

                $table->foreignId('tenant_id')
                    ->constrained()
                    ->cascadeOnDelete();

                $table->foreignId('branch_id')
                    ->nullable()
                    ->constrained('branches')
                    ->nullOnDelete();

                $table->string(
                    'workflow_type',
                    50
                );

                $table->string(
                    'subject_type',
                    100
                );

                $table->unsignedBigInteger(
                    'subject_id'
                );

                $table->uuid('subject_uuid')
                    ->nullable();

                $table->string('status', 30)
                    ->default('pending');

                $table->foreignId('requested_by')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table->timestamp('requested_at')
                    ->useCurrent();

                $table->foreignId('decided_by')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table->timestamp('decided_at')
                    ->nullable();

                $table->text('decision_comment')
                    ->nullable();

                $table->unsignedInteger('version')
                    ->default(1);

                $table->json('metadata')
                    ->nullable();

                $table->timestamps();

                $table->index(
                    [
                        'tenant_id',
                        'status',
                        'workflow_type',
                    ],
                    'far_tenant_status_type_idx'
                );

                $table->index(
                    [
                        'subject_type',
                        'subject_id',
                    ],
                    'far_subject_idx'
                );

                $table->index(
                    [
                        'tenant_id',
                        'branch_id',
                        'status',
                    ],
                    'far_tenant_branch_status_idx'
                );
            }
        );

        Schema::create(
            'finance_approval_actions',
            function (Blueprint $table): void {
                $table->id();
                $table->uuid('uuid')->unique();

                $table->foreignId(
                    'approval_request_id'
                )
                    ->constrained(
                        'finance_approval_requests'
                    )
                    ->cascadeOnDelete();

                $table->foreignId('tenant_id')
                    ->constrained()
                    ->cascadeOnDelete();

                $table->foreignId('actor_id')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table->string('action', 30);

                $table->string(
                    'previous_status',
                    30
                )->nullable();

                $table->string(
                    'new_status',
                    30
                );

                $table->text('comment')
                    ->nullable();

                $table->json('metadata')
                    ->nullable();

                $table->timestamp('acted_at')
                    ->useCurrent();

                $table->timestamps();

                $table->index(
                    [
                        'approval_request_id',
                        'acted_at',
                    ],
                    'faa_request_time_idx'
                );

                $table->index(
                    [
                        'tenant_id',
                        'action',
                    ],
                    'faa_tenant_action_idx'
                );
            }
        );
    }

    public function down(): void
    {
        Schema::dropIfExists(
            'finance_approval_actions'
        );

        Schema::dropIfExists(
            'finance_approval_requests'
        );

        Schema::dropIfExists(
            'finance_journal_draft_lines'
        );

        Schema::dropIfExists(
            'finance_journal_drafts'
        );
    }
};
