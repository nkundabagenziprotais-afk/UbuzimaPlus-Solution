<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('platform_content_pages', function (Blueprint $table) {
            $table->id();
            $table->string('slug', 120)->unique();
            $table->string('title', 191);
            $table->text('description')->nullable();
            $table->string('template', 80)->default('public');
            $table->string('status', 30)->default('draft')->index();
            $table->json('seo')->nullable();
            $table->json('style')->nullable();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('published_at')->nullable();
            $table->timestamps();
        });

        Schema::create('platform_content_sections', function (Blueprint $table) {
            $table->id();
            $table->foreignId('page_id')->constrained('platform_content_pages')->cascadeOnDelete();
            $table->string('section_key', 120);
            $table->string('eyebrow', 160)->nullable();
            $table->string('title', 191)->nullable();
            $table->text('body')->nullable();
            $table->json('content')->nullable();
            $table->json('style')->nullable();
            $table->integer('sort_order')->default(0)->index();
            $table->string('status', 30)->default('active')->index();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['page_id', 'section_key']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('platform_content_sections');
        Schema::dropIfExists('platform_content_pages');
    }
};
