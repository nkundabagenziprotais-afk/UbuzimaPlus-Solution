<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create(
            'finance_reporting_exclusions',
            function (Blueprint $table): void {
                $table->id();

                $table->unsignedBigInteger('tenant_id');

                $table->unsignedBigInteger(
                    'finance_journal_entry_id'
                );

                $table->string(
                    'scope',
                    50
                );

                $table->string(
                    'classification',
                    100
                );

                $table->string(
                    'cohort_key',
                    100
                );

                $table->date(
                    'effective_from'
                );

                $table->string(
                    'status',
                    30
                )->default('active');

                $table->unsignedBigInteger(
                    'approved_by_user_id'
                )->nullable();

                $table->string(
                    'approved_by_name',
                    191
                );

                $table->timestamp(
                    'approved_at'
                );

                $table->string(
                    'evidence_reference',
                    191
                );

                $table->string(
                    'evidence_sha256',
                    64
                );

                $table->string(
                    'cohort_sha256',
                    64
                );

                $table->text(
                    'reason'
                );

                $table->json(
                    'metadata'
                )->nullable();

                $table->timestamps();

                $table->unique(
                    [
                        'tenant_id',
                        'finance_journal_entry_id',
                        'scope',
                    ],
                    'finance_reporting_exclusion_unique'
                );

                $table->index(
                    [
                        'tenant_id',
                        'scope',
                        'status',
                    ],
                    'finance_reporting_exclusion_scope_idx'
                );

                $table->index(
                    [
                        'tenant_id',
                        'classification',
                    ],
                    'finance_reporting_exclusion_class_idx'
                );

                $table->index(
                    [
                        'tenant_id',
                        'cohort_key',
                    ],
                    'finance_reporting_exclusion_cohort_idx'
                );

                $table->foreign(
                    'finance_journal_entry_id'
                )
                    ->references('id')
                    ->on('finance_journal_entries')
                    ->restrictOnDelete();
            }
        );
    }

    public function down(): void
    {
        Schema::dropIfExists(
            'finance_reporting_exclusions'
        );
    }
};
