<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ai_providers', function (Blueprint $table) {
            $table->id();
            $table->string('name', 191);
            $table->string('code', 100)->unique();
            $table->string('provider_type', 50)->default('external')->index();
            $table->string('status', 30)->default('disabled')->index();
            $table->string('mode', 30)->default('sandbox')->index();
            $table->string('secret_reference', 191)->nullable();
            $table->json('configuration')->nullable();
            $table->json('data_policy')->nullable();
            $table->foreignId('enabled_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('ai_models', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ai_provider_id')->nullable()->constrained('ai_providers')->nullOnDelete();
            $table->foreignId('solution_id')->nullable()->constrained('solutions')->nullOnDelete();
            $table->foreignId('tenant_id')->nullable()->constrained('tenants')->nullOnDelete();
            $table->string('name', 191);
            $table->string('code', 100)->unique();
            $table->string('model_type', 50)->default('assistant')->index();
            $table->string('status', 30)->default('draft')->index();
            $table->string('risk_level', 30)->default('medium')->index();
            $table->boolean('requires_human_approval')->default(true);
            $table->json('allowed_data_types')->nullable();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('approved_at')->nullable();
            $table->timestamps();
        });

        Schema::create('ai_agents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('solution_id')->nullable()->constrained('solutions')->nullOnDelete();
            $table->foreignId('tenant_id')->nullable()->constrained('tenants')->nullOnDelete();
            $table->string('name', 191);
            $table->string('code', 100)->unique();
            $table->text('description')->nullable();
            $table->string('status', 30)->default('draft')->index();
            $table->string('risk_level', 30)->default('medium')->index();
            $table->text('instructions_summary')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('ai_recommendations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ai_agent_id')->nullable()->constrained('ai_agents')->nullOnDelete();
            $table->foreignId('solution_id')->nullable()->constrained('solutions')->nullOnDelete();
            $table->foreignId('tenant_id')->nullable()->constrained('tenants')->nullOnDelete();
            $table->foreignId('branch_id')->nullable()->constrained('branches')->nullOnDelete();
            $table->string('recommendation_type', 100)->index();
            $table->string('title', 191);
            $table->string('risk_level', 30)->default('medium')->index();
            $table->decimal('confidence_score', 5, 2)->nullable();
            $table->text('explanation')->nullable();
            $table->text('data_source_summary')->nullable();
            $table->text('recommended_action')->nullable();
            $table->boolean('requires_approval')->default(true);
            $table->string('status', 30)->default('pending_review')->index();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('rejected_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('implemented_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['tenant_id', 'status']);
        });

        Schema::create('ai_audit_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ai_agent_id')->nullable()->constrained('ai_agents')->nullOnDelete();
            $table->foreignId('ai_model_id')->nullable()->constrained('ai_models')->nullOnDelete();
            $table->foreignId('solution_id')->nullable()->constrained('solutions')->nullOnDelete();
            $table->foreignId('tenant_id')->nullable()->constrained('tenants')->nullOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('action', 100)->index();
            $table->string('risk_level', 30)->default('medium')->index();
            $table->json('metadata')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['tenant_id', 'action']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ai_audit_logs');
        Schema::dropIfExists('ai_recommendations');
        Schema::dropIfExists('ai_agents');
        Schema::dropIfExists('ai_models');
        Schema::dropIfExists('ai_providers');
    }
};
