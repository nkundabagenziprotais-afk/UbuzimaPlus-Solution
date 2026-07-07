<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('markets', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->string('code', 50)->unique();
            $table->string('name', 191);
            $table->string('country_code', 3)->index();
            $table->string('default_language', 10)->default('en')->index();
            $table->string('currency_code', 3)->default('RWF');
            $table->string('timezone', 80)->default('Africa/Kigali');
            $table->decimal('service_radius_km', 8, 2)->default(10);
            $table->string('status', 30)->default('active')->index();
            $table->json('metadata')->nullable();
            $table->timestamps();
        });

        Schema::create('tenant_market_assignments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignId('market_id')->constrained('markets')->cascadeOnDelete();
            $table->string('status', 30)->default('active')->index();
            $table->decimal('service_radius_km', 8, 2)->nullable();
            $table->timestamp('assigned_at')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->unique(['tenant_id', 'market_id'], 'tenant_market_unique');
        });

        Schema::create('service_provider_locations', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignId('branch_id')->nullable()->constrained('branches')->nullOnDelete();
            $table->foreignId('market_id')->nullable()->constrained('markets')->nullOnDelete();
            $table->string('name', 191);
            $table->string('provider_type', 80)->default('retail_pharmacy')->index();
            $table->json('service_channels')->nullable();
            $table->string('phone', 80)->nullable();
            $table->string('email', 191)->nullable();
            $table->string('address', 255)->nullable();
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();
            $table->decimal('service_radius_km', 8, 2)->nullable();
            $table->string('status', 30)->default('active')->index();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['market_id', 'provider_type', 'status'], 'provider_market_type_status_index');
            $table->index(['tenant_id', 'branch_id'], 'provider_tenant_branch_index');
        });

        Schema::create('user_locale_preferences', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('market_id')->nullable()->constrained('markets')->nullOnDelete();
            $table->string('language', 10)->default('en')->index();
            $table->string('source', 40)->default('manual');
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->unique('user_id');
        });

        Schema::create('system_notifications', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('tenant_id')->nullable()->constrained('tenants')->nullOnDelete();
            $table->foreignId('market_id')->nullable()->constrained('markets')->nullOnDelete();
            $table->string('title', 191);
            $table->text('body');
            $table->string('notification_type', 80)->default('announcement')->index();
            $table->string('channel', 40)->default('in_app')->index();
            $table->string('audience_scope', 80)->default('all_staff')->index();
            $table->string('status', 30)->default('draft')->index();
            $table->timestamp('published_at')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'status']);
            $table->index(['market_id', 'status']);
        });

        Schema::create('system_notification_reads', function (Blueprint $table) {
            $table->id();
            $table->foreignId('system_notification_id')->constrained('system_notifications')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->timestamp('read_at')->nullable();
            $table->timestamps();

            $table->unique(['system_notification_id', 'user_id'], 'notification_user_read_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('system_notification_reads');
        Schema::dropIfExists('system_notifications');
        Schema::dropIfExists('user_locale_preferences');
        Schema::dropIfExists('service_provider_locations');
        Schema::dropIfExists('tenant_market_assignments');
        Schema::dropIfExists('markets');
    }
};
