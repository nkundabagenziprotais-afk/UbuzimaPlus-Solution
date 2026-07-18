<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('insurance_partner_documents')) {
            return;
        }

        Schema::create('insurance_partner_documents', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->unsignedBigInteger('tenant_id');
            $table->unsignedBigInteger('insurance_partner_id');
            $table->string('document_type', 60);
            $table->string('title', 191);
            $table->string('file_path', 255);
            $table->string('original_filename', 191)->nullable();
            $table->string('mime_type', 120)->nullable();
            $table->unsignedBigInteger('file_size')->nullable();
            $table->string('version', 40)->nullable();
            $table->date('effective_from')->nullable();
            $table->date('effective_to')->nullable();
            $table->string('status', 40)->default('active');
            $table->boolean('is_primary')->default(false);
            $table->text('notes')->nullable();
            $table->json('metadata')->nullable();
            $table->unsignedBigInteger('uploaded_by')->nullable();
            $table->dateTime('uploaded_at')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'insurance_partner_id']);
            $table->index(['tenant_id', 'document_type']);
            $table->index(['tenant_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('insurance_partner_documents');
    }
};
