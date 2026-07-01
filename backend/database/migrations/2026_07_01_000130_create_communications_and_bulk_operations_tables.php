<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('corporate_mail_accounts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('display_name', 191);
            $table->string('email_address', 191);
            $table->string('provider', 50)->default('local_mailbox');
            $table->string('status', 30)->default('active')->index();
            $table->string('sync_status', 30)->default('local_only')->index();
            $table->timestamp('last_synced_at')->nullable();
            $table->json('configuration')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'email_address']);
        });

        Schema::create('corporate_mail_folders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('corporate_mail_account_id')->constrained('corporate_mail_accounts')->cascadeOnDelete();
            $table->string('folder_key', 80);
            $table->string('name', 120);
            $table->unsignedInteger('sort_order')->default(0);
            $table->unsignedInteger('unread_count')->default(0);
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->unique(['corporate_mail_account_id', 'folder_key'], 'mail_folders_account_key_unique');
        });

        Schema::create('corporate_mail_messages', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('corporate_mail_account_id')->constrained('corporate_mail_accounts')->cascadeOnDelete();
            $table->foreignId('corporate_mail_folder_id')->constrained('corporate_mail_folders')->cascadeOnDelete();
            $table->string('message_uid', 191)->nullable();
            $table->string('direction', 30)->default('inbound')->index();
            $table->string('subject', 255);
            $table->string('from_name', 191)->nullable();
            $table->string('from_email', 191);
            $table->json('to_recipients')->nullable();
            $table->json('cc_recipients')->nullable();
            $table->text('body_preview')->nullable();
            $table->longText('body')->nullable();
            $table->string('importance', 30)->default('normal')->index();
            $table->string('status', 30)->default('received')->index();
            $table->timestamp('read_at')->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->timestamp('received_at')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['corporate_mail_account_id', 'corporate_mail_folder_id'], 'mail_messages_account_folder_index');
            $table->index(['corporate_mail_account_id', 'created_at'], 'mail_messages_account_created_index');
        });

        Schema::create('pharmacist_chat_conversations', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('tenant_id')->nullable()->constrained('tenants')->nullOnDelete();
            $table->foreignId('branch_id')->nullable()->constrained('branches')->nullOnDelete();
            $table->string('customer_name', 191)->nullable();
            $table->string('customer_phone', 80)->nullable();
            $table->string('customer_email', 191)->nullable();
            $table->string('source_channel', 50)->default('mobile_app')->index();
            $table->string('status', 30)->default('open')->index();
            $table->string('priority', 30)->default('normal')->index();
            $table->foreignId('assigned_pharmacist_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('last_message_at')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'status']);
        });

        Schema::create('pharmacist_chat_messages', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('pharmacist_chat_conversation_id')->constrained('pharmacist_chat_conversations')->cascadeOnDelete();
            $table->string('sender_type', 30)->index();
            $table->foreignId('sender_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('sender_display_name', 191)->nullable();
            $table->text('body');
            $table->json('attachments')->nullable();
            $table->timestamp('read_at')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['pharmacist_chat_conversation_id', 'created_at'], 'chat_messages_conversation_created_index');
        });

        Schema::create('bulk_operation_runs', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('tenant_id')->nullable()->constrained('tenants')->nullOnDelete();
            $table->string('operation_type', 80)->index();
            $table->string('target_table', 120)->index();
            $table->string('status', 30)->default('completed')->index();
            $table->unsignedInteger('total_rows')->default(0);
            $table->unsignedInteger('processed_rows')->default(0);
            $table->unsignedInteger('failed_rows')->default(0);
            $table->json('summary')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bulk_operation_runs');
        Schema::dropIfExists('pharmacist_chat_messages');
        Schema::dropIfExists('pharmacist_chat_conversations');
        Schema::dropIfExists('corporate_mail_messages');
        Schema::dropIfExists('corporate_mail_folders');
        Schema::dropIfExists('corporate_mail_accounts');
    }
};
