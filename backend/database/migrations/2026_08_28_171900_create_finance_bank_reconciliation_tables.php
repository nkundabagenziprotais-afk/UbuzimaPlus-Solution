<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create(
            'finance_bank_statement_imports',
            function (Blueprint $table): void {
                $table->id();
                $table->string('uuid', 36);

                $table->unsignedBigInteger(
                    'tenant_id'
                );

                $table->unsignedBigInteger(
                    'branch_id'
                )->nullable();

                $table->unsignedBigInteger(
                    'chart_of_account_id'
                );

                $table->date(
                    'statement_from'
                );

                $table->date(
                    'statement_to'
                );

                $table->decimal(
                    'opening_balance',
                    18,
                    2
                );

                $table->decimal(
                    'closing_balance',
                    18,
                    2
                );

                $table->decimal(
                    'statement_movement',
                    18,
                    2
                )->default(0);

                $table->decimal(
                    'calculated_closing_balance',
                    18,
                    2
                )->default(0);

                $table->decimal(
                    'statement_variance',
                    18,
                    2
                )->default(0);

                $table->string(
                    'currency_code',
                    10
                )->default('RWF');

                $table->string(
                    'source_file_name',
                    191
                );

                $table->string(
                    'source_file_sha256',
                    64
                );

                $table->string(
                    'status',
                    30
                )->default('imported');

                $table->unsignedBigInteger(
                    'imported_by'
                )->nullable();

                $table->timestamp(
                    'imported_at'
                )->nullable();

                $table->timestamps();

                $table->unique(
                    [
                        'tenant_id',
                        'uuid',
                    ],
                    'fbs_import_uuid_uq'
                );

                $table->unique(
                    [
                        'tenant_id',
                        'chart_of_account_id',
                        'source_file_sha256',
                    ],
                    'fbs_import_file_uq'
                );

                $table->index(
                    [
                        'tenant_id',
                        'branch_id',
                        'chart_of_account_id',
                        'statement_to',
                    ],
                    'fbs_import_scope_ix'
                );
            }
        );

        Schema::create(
            'finance_bank_statement_lines',
            function (Blueprint $table): void {
                $table->id();
                $table->string('uuid', 36);

                $table->unsignedBigInteger(
                    'tenant_id'
                );

                $table->unsignedBigInteger(
                    'branch_id'
                )->nullable();

                $table->unsignedBigInteger(
                    'statement_import_id'
                );

                $table->unsignedBigInteger(
                    'chart_of_account_id'
                );

                $table->unsignedInteger(
                    'line_number'
                );

                $table->date(
                    'transaction_date'
                );

                $table->string(
                    'reference',
                    100
                )->nullable();

                $table->text(
                    'description'
                )->nullable();

                /*
                 * Positive increases the bank asset.
                 * Negative decreases the bank asset.
                 */
                $table->decimal(
                    'amount',
                    18,
                    2
                );

                $table->timestamps();

                $table->unique(
                    [
                        'tenant_id',
                        'uuid',
                    ],
                    'fbs_line_uuid_uq'
                );

                $table->unique(
                    [
                        'statement_import_id',
                        'line_number',
                    ],
                    'fbs_line_number_uq'
                );

                $table->index(
                    [
                        'tenant_id',
                        'branch_id',
                        'chart_of_account_id',
                        'transaction_date',
                    ],
                    'fbs_line_scope_ix'
                );
            }
        );

        Schema::create(
            'finance_bank_statement_matches',
            function (Blueprint $table): void {
                $table->id();
                $table->string('uuid', 36);

                $table->unsignedBigInteger(
                    'tenant_id'
                );

                $table->unsignedBigInteger(
                    'branch_id'
                )->nullable();

                $table->unsignedBigInteger(
                    'statement_line_id'
                );

                $table->string(
                    'match_type',
                    30
                );

                $table->unsignedBigInteger(
                    'match_id'
                );

                $table->decimal(
                    'matched_amount',
                    18,
                    2
                );

                $table->string(
                    'match_method',
                    30
                )->default('manual');

                $table->text(
                    'notes'
                )->nullable();

                $table->unsignedBigInteger(
                    'matched_by'
                )->nullable();

                $table->timestamp(
                    'matched_at'
                )->nullable();

                $table->timestamps();

                $table->unique(
                    [
                        'tenant_id',
                        'uuid',
                    ],
                    'fbs_match_uuid_uq'
                );

                $table->unique(
                    [
                        'statement_line_id',
                    ],
                    'fbs_match_line_uq'
                );

                $table->unique(
                    [
                        'tenant_id',
                        'match_type',
                        'match_id',
                    ],
                    'fbs_match_target_uq'
                );
            }
        );

        Schema::create(
            'finance_bank_reconciliation_sessions',
            function (Blueprint $table): void {
                $table->id();
                $table->string('uuid', 36);

                $table->unsignedBigInteger(
                    'tenant_id'
                );

                $table->unsignedBigInteger(
                    'branch_id'
                )->nullable();

                $table->unsignedBigInteger(
                    'statement_import_id'
                );

                $table->unsignedBigInteger(
                    'chart_of_account_id'
                );

                $table->date(
                    'period_from'
                );

                $table->date(
                    'period_to'
                );

                $table->decimal(
                    'statement_opening_balance',
                    18,
                    2
                );

                $table->decimal(
                    'statement_closing_balance',
                    18,
                    2
                );

                $table->decimal(
                    'book_closing_balance',
                    18,
                    2
                )->default(0);

                $table->decimal(
                    'difference',
                    18,
                    2
                )->default(0);

                $table->string(
                    'status',
                    30
                )->default('open');

                $table->unsignedBigInteger(
                    'created_by'
                )->nullable();

                $table->unsignedBigInteger(
                    'locked_by'
                )->nullable();

                $table->timestamp(
                    'locked_at'
                )->nullable();

                $table->timestamps();

                $table->unique(
                    [
                        'tenant_id',
                        'uuid',
                    ],
                    'fbs_session_uuid_uq'
                );

                $table->unique(
                    [
                        'statement_import_id',
                    ],
                    'fbs_session_import_uq'
                );

                $table->index(
                    [
                        'tenant_id',
                        'branch_id',
                        'chart_of_account_id',
                        'status',
                    ],
                    'fbs_session_scope_ix'
                );
            }
        );
    }

    public function down(): void
    {
        Schema::dropIfExists(
            'finance_bank_reconciliation_sessions'
        );

        Schema::dropIfExists(
            'finance_bank_statement_matches'
        );

        Schema::dropIfExists(
            'finance_bank_statement_lines'
        );

        Schema::dropIfExists(
            'finance_bank_statement_imports'
        );
    }
};
