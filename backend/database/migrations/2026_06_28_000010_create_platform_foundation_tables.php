<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('solutions', function (Blueprint $table) {
            $table->id();
            $table->string('name', 191);
            $table->string('code', 100)->unique();
            $table->text('description')->nullable();
            $table->string('status', 30)->default('active')->index();
            $table->timestamps();
        });

        Schema::create('tenants', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->string('name', 191);
            $table->string('slug', 191)->unique();
            $table->string('legal_name', 191)->nullable();
            $table->string('website_url', 191)->nullable();
            $table->foreignId('primary_solution_id')->nullable()->constrained('solutions')->nullOnDelete();
            $table->string('tenant_type', 50)->default('business')->index();
            $table->string('status', 30)->default('active')->index();
            $table->json('branding')->nullable();
            $table->json('settings')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('branches', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->string('name', 191);
            $table->string('code', 100);
            $table->string('branch_type', 50)->default('pharmacy')->index();
            $table->string('status', 30)->default('active')->index();
            $table->string('phone', 50)->nullable();
            $table->string('email', 191)->nullable();
            $table->string('address', 191)->nullable();
            $table->json('settings')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['tenant_id', 'code']);
        });

        Schema::create('admin_scopes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('scope_type', 30)->index(); // platform, solution, tenant, branch
            $table->foreignId('solution_id')->nullable()->constrained('solutions')->nullOnDelete();
            $table->foreignId('tenant_id')->nullable()->constrained('tenants')->nullOnDelete();
            $table->foreignId('branch_id')->nullable()->constrained('branches')->nullOnDelete();
            $table->string('status', 30)->default('active')->index();
            $table->foreignId('assigned_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('assigned_at')->nullable();
            $table->timestamps();

            $table->index(['scope_type', 'status']);
        });

        Schema::create('modules', function (Blueprint $table) {
            $table->id();
            $table->string('name', 191);
            $table->string('code', 100)->unique();
            $table->string('module_group', 100)->nullable()->index();
            $table->string('solution_scope', 50)->default('shared')->index();
            $table->text('description')->nullable();
            $table->string('status', 30)->default('available')->index();
            $table->json('dependencies')->nullable();
            $table->timestamps();
        });

        Schema::create('solution_modules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('solution_id')->constrained('solutions')->cascadeOnDelete();
            $table->foreignId('module_id')->constrained('modules')->cascadeOnDelete();
            $table->string('status', 30)->default('available')->index();
            $table->json('default_config')->nullable();
            $table->timestamps();

            $table->unique(['solution_id', 'module_id']);
        });

        Schema::create('tenant_module_activations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignId('solution_id')->nullable()->constrained('solutions')->nullOnDelete();
            $table->foreignId('module_id')->constrained('modules')->cascadeOnDelete();
            $table->string('status', 30)->default('active')->index();
            $table->json('configuration')->nullable();
            $table->foreignId('activated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('activated_at')->nullable();
            $table->timestamp('suspended_at')->nullable();
            $table->timestamps();

            $table->unique(['tenant_id', 'module_id']);
        });

        Schema::create('entity_configurations', function (Blueprint $table) {
            $table->id();
            $table->string('scope_type', 30)->index(); // platform, solution, tenant, branch
            $table->unsignedBigInteger('scope_id')->nullable()->index();
            $table->string('config_key', 100)->index();
            $table->json('config_value')->nullable();
            $table->string('status', 30)->default('active')->index();
            $table->foreignId('configured_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['scope_type', 'scope_id', 'config_key'], 'entity_config_unique');
        });

        Schema::create('visibility_policies', function (Blueprint $table) {
            $table->id();
            $table->string('scope_type', 30)->index();
            $table->unsignedBigInteger('scope_id')->nullable()->index();
            $table->string('policy_code', 100)->index();
            $table->json('rules')->nullable();
            $table->string('status', 30)->default('active')->index();
            $table->timestamps();

            $table->unique(['scope_type', 'scope_id', 'policy_code'], 'visibility_policy_unique');
        });

        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('solution_id')->nullable()->constrained('solutions')->nullOnDelete();
            $table->foreignId('tenant_id')->nullable()->constrained('tenants')->nullOnDelete();
            $table->foreignId('branch_id')->nullable()->constrained('branches')->nullOnDelete();
            $table->string('action', 100)->index();
            $table->string('auditable_type', 191)->nullable();
            $table->unsignedBigInteger('auditable_id')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->string('user_agent', 191)->nullable();
            $table->string('data_classification', 50)->default('internal')->index();
            $table->json('metadata')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['auditable_type', 'auditable_id']);
            $table->index(['tenant_id', 'action']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('audit_logs');
        Schema::dropIfExists('visibility_policies');
        Schema::dropIfExists('entity_configurations');
        Schema::dropIfExists('tenant_module_activations');
        Schema::dropIfExists('solution_modules');
        Schema::dropIfExists('modules');
        Schema::dropIfExists('admin_scopes');
        Schema::dropIfExists('branches');
        Schema::dropIfExists('tenants');
        Schema::dropIfExists('solutions');
    }
};
