<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table(
            'pharmaco_pos_sessions',
            function (Blueprint $table): void {
                $table->string(
                    'terminal_identifier',
                    100
                )->nullable();

                $table->string(
                    'terminal_label',
                    100
                )->nullable();

                $table->index(
                    [
                        'tenant_id',
                        'branch_id',
                        'session_mode',
                        'terminal_identifier',
                        'status',
                    ],
                    'pos_terminal_session_status_idx'
                );
            }
        );
    }

    public function down(): void
    {
        Schema::table(
            'pharmaco_pos_sessions',
            function (Blueprint $table): void {
                $table->dropIndex(
                    'pos_terminal_session_status_idx'
                );

                $table->dropColumn([
                    'terminal_identifier',
                    'terminal_label',
                ]);
            }
        );
    }
};
