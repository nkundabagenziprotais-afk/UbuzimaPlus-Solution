<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('insurance_claim_submission_events')) {
            return;
        }

        Schema::create('insurance_claim_submission_events', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->unsignedBigInteger('tenant_id');
            $table->unsignedBigInteger('insurance_claim_id');
            $table->unsignedBigInteger('insurance_partner_id')->nullable();
            $table->string('event_type', 60)->default('submission');
            $table->string('submission_channel', 40);
            $table->string('submission_status', 40)->default('recorded');
            $table->string('recipient_name', 191)->nullable();
            $table->string('recipient_email', 191)->nullable();
            $table->string('recipient_phone', 80)->nullable();
            $table->string('submission_reference', 191)->nullable();
            $table->string('document_path', 255)->nullable();
            $table->string('annex_document_path', 255)->nullable();
            $table->text('message_body')->nullable();
            $table->text('notes')->nullable();
            $table->json('metadata')->nullable();
            $table->unsignedBigInteger('submitted_by')->nullable();
            $table->dateTime('submitted_at')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'insurance_claim_id']);
            $table->index(['tenant_id', 'insurance_partner_id']);
            $table->index(['tenant_id', 'submission_channel']);
            $table->index(['tenant_id', 'submission_status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('insurance_claim_submission_events');
    }
};
