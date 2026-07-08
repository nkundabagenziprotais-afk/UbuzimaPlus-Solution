<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pharmaco_pos_sessions', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('branch_id')->constrained()->restrictOnDelete();
            $table->foreignId('user_id')->constrained()->restrictOnDelete();
            $table->date('business_date');
            $table->string('status', 30)->default('open');
            $table->string('opening_mode', 30)->default('fresh_start');
            $table->string('close_mode', 30)->nullable();
            $table->decimal('starting_cash', 18, 2)->default(0);
            $table->decimal('expected_cash', 18, 2)->nullable();
            $table->decimal('counted_cash', 18, 2)->nullable();
            $table->decimal('closing_cash_balance', 18, 2)->nullable();
            $table->decimal('cash_variance', 18, 2)->nullable();
            $table->boolean('till_zeroized')->default(false);
            $table->timestamp('opened_at');
            $table->timestamp('closed_at')->nullable();
            $table->string('deposit_reference')->nullable();
            $table->text('opening_note')->nullable();
            $table->text('closing_note')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->unique(['tenant_id', 'user_id', 'business_date'], 'pos_session_user_day_unique');
            $table->index(['tenant_id', 'branch_id', 'business_date', 'status'], 'pos_session_lookup_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pharmaco_pos_sessions');
    }
};
