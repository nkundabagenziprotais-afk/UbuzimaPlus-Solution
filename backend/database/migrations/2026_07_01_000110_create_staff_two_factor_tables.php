<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('two_factor_required')->default(true)->index();
            $table->boolean('two_factor_enabled')->default(false)->index();
            $table->text('two_factor_secret')->nullable();
            $table->json('two_factor_recovery_codes')->nullable();
            $table->timestamp('two_factor_confirmed_at')->nullable();
            $table->timestamp('two_factor_last_verified_at')->nullable();
        });

        Schema::create('two_factor_challenges', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('challenge_token_hash', 128)->unique();
            $table->string('purpose', 30)->index(); // setup, login
            $table->text('setup_secret')->nullable();
            $table->string('device_name', 120)->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->string('user_agent', 191)->nullable();
            $table->timestamp('expires_at')->index();
            $table->timestamp('used_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'purpose', 'used_at']);
        });

        Schema::create('trusted_devices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('device_token_hash', 128)->unique();
            $table->string('device_name', 120)->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->string('user_agent', 191)->nullable();
            $table->timestamp('trusted_until')->index();
            $table->timestamp('last_used_at')->nullable();
            $table->timestamp('revoked_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'trusted_until', 'revoked_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('trusted_devices');
        Schema::dropIfExists('two_factor_challenges');

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'two_factor_required',
                'two_factor_enabled',
                'two_factor_secret',
                'two_factor_recovery_codes',
                'two_factor_confirmed_at',
                'two_factor_last_verified_at',
            ]);
        });
    }
};
