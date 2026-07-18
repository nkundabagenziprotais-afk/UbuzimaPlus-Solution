<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('insurance_claims', function (Blueprint $table): void {
            if (! Schema::hasColumn('insurance_claims', 'invoice_due_date')) {
                $table->date('invoice_due_date')->nullable();
            }

            if (! Schema::hasColumn('insurance_claims', 'invoice_submission_status')) {
                $table->string('invoice_submission_status', 40)
                    ->default('pending');
            }

            if (! Schema::hasColumn('insurance_claims', 'invoice_submitted_at')) {
                $table->dateTime('invoice_submitted_at')->nullable();
            }

            if (! Schema::hasColumn('insurance_claims', 'invoice_submitted_by')) {
                $table->unsignedBigInteger('invoice_submitted_by')->nullable();
            }

            if (! Schema::hasColumn('insurance_claims', 'invoice_submission_reference')) {
                $table->string('invoice_submission_reference', 191)->nullable();
            }

            if (! Schema::hasColumn('insurance_claims', 'invoice_submission_channel')) {
                $table->string('invoice_submission_channel', 40)->nullable();
            }

            if (! Schema::hasColumn('insurance_claims', 'reminder_lead_days')) {
                $table->unsignedInteger('reminder_lead_days')->default(3);
            }

            if (! Schema::hasColumn('insurance_claims', 'reminder_frequency')) {
                $table->string('reminder_frequency', 40)->default('daily');
            }

            if (! Schema::hasColumn('insurance_claims', 'next_reminder_at')) {
                $table->dateTime('next_reminder_at')->nullable();
            }

            if (! Schema::hasColumn('insurance_claims', 'last_reminder_at')) {
                $table->dateTime('last_reminder_at')->nullable();
            }

            if (! Schema::hasColumn('insurance_claims', 'reminder_count')) {
                $table->unsignedInteger('reminder_count')->default(0);
            }

            if (! Schema::hasColumn('insurance_claims', 'invoice_document_path')) {
                $table->string('invoice_document_path', 255)->nullable();
            }

            if (! Schema::hasColumn('insurance_claims', 'annex_document_path')) {
                $table->string('annex_document_path', 255)->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::table('insurance_claims', function (Blueprint $table): void {
            foreach ([
                'invoice_due_date',
                'invoice_submission_status',
                'invoice_submitted_at',
                'invoice_submitted_by',
                'invoice_submission_reference',
                'invoice_submission_channel',
                'reminder_lead_days',
                'reminder_frequency',
                'next_reminder_at',
                'last_reminder_at',
                'reminder_count',
                'invoice_document_path',
                'annex_document_path',
            ] as $column) {
                if (Schema::hasColumn('insurance_claims', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
