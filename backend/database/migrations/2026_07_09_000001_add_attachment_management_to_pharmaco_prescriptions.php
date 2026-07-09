<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pharmaco_prescriptions', function (Blueprint $table) {
            $table->string('attachment_disk', 30)
                ->nullable()
                ->after('notes');

            $table->string('attachment_path', 191)
                ->nullable()
                ->after('attachment_disk');

            $table->string('attachment_original_name', 191)
                ->nullable()
                ->after('attachment_path');

            $table->string('attachment_mime_type', 100)
                ->nullable()
                ->after('attachment_original_name');

            $table->unsignedBigInteger('attachment_size')
                ->nullable()
                ->after('attachment_mime_type');

            $table->foreignId('attachment_uploaded_by')
                ->nullable()
                ->after('attachment_size')
                ->constrained('users')
                ->nullOnDelete();

            $table->timestamp('attachment_uploaded_at')
                ->nullable()
                ->after('attachment_uploaded_by');
        });
    }

    public function down(): void
    {
        Schema::table('pharmaco_prescriptions', function (Blueprint $table) {
            $table->dropConstrainedForeignId(
                'attachment_uploaded_by'
            );

            $table->dropColumn([
                'attachment_disk',
                'attachment_path',
                'attachment_original_name',
                'attachment_mime_type',
                'attachment_size',
                'attachment_uploaded_at',
            ]);
        });
    }
};
