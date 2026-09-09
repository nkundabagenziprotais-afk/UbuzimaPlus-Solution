<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (! Schema::hasTable('finance_expense_items')) {
            Schema::create('finance_expense_items', function (Blueprint $table): void {
                $table->id();
                $table->uuid('uuid')->unique();
                $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
                $table->foreignId('finance_chart_of_account_id')->constrained('finance_chart_of_accounts')->restrictOnDelete();
                $table->string('code', 100);
                $table->string('name', 191);
                $table->string('group_name', 100)->nullable();
                $table->text('description')->nullable();
                $table->string('status', 30)->default('active');
                $table->boolean('is_system_seed')->default(false);
                $table->json('metadata')->nullable();
                $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
                $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamps();

                $table->unique(['tenant_id', 'code'], 'finance_expense_items_tenant_code_uq');
                $table->unique(['tenant_id', 'name'], 'finance_expense_items_tenant_name_uq');
                $table->index(['tenant_id', 'status'], 'finance_expense_items_status_idx');
                $table->index(['tenant_id', 'finance_chart_of_account_id'], 'finance_expense_items_account_idx');
            });
        }

        if (
            Schema::hasTable('finance_expense_lines')
            && ! Schema::hasColumn('finance_expense_lines', 'finance_expense_item_id')
        ) {
            DB::statement('ALTER TABLE finance_expense_lines ADD COLUMN finance_expense_item_id INTEGER NULL');
            DB::statement('CREATE INDEX IF NOT EXISTS finance_expense_line_item_idx ON finance_expense_lines(finance_expense_item_id)');
        }

        DB::unprepared("
            CREATE TRIGGER IF NOT EXISTS finance_expense_line_item_auto_link_ai
            AFTER INSERT ON finance_expense_lines
            WHEN NEW.finance_expense_item_id IS NULL
            BEGIN
                UPDATE finance_expense_lines
                SET finance_expense_item_id = (
                    SELECT i.id
                    FROM finance_expense_items i
                    INNER JOIN finance_expenses e ON e.id = NEW.finance_expense_id
                    WHERE i.tenant_id = e.tenant_id
                      AND i.finance_chart_of_account_id = NEW.finance_chart_of_account_id
                      AND lower(i.name) = lower(coalesce(NEW.description, ''))
                      AND i.status = 'active'
                    LIMIT 1
                )
                WHERE id = NEW.id
                  AND finance_expense_item_id IS NULL;
            END
        ");

        DB::unprepared("
            CREATE TRIGGER IF NOT EXISTS finance_expense_line_item_auto_link_au
            AFTER UPDATE OF description, finance_chart_of_account_id ON finance_expense_lines
            WHEN NEW.finance_expense_item_id IS NULL
            BEGIN
                UPDATE finance_expense_lines
                SET finance_expense_item_id = (
                    SELECT i.id
                    FROM finance_expense_items i
                    INNER JOIN finance_expenses e ON e.id = NEW.finance_expense_id
                    WHERE i.tenant_id = e.tenant_id
                      AND i.finance_chart_of_account_id = NEW.finance_chart_of_account_id
                      AND lower(i.name) = lower(coalesce(NEW.description, ''))
                      AND i.status = 'active'
                    LIMIT 1
                )
                WHERE id = NEW.id
                  AND finance_expense_item_id IS NULL;
            END
        ");
    }

    public function down(): void
    {
        DB::unprepared('DROP TRIGGER IF EXISTS finance_expense_line_item_auto_link_ai');
        DB::unprepared('DROP TRIGGER IF EXISTS finance_expense_line_item_auto_link_au');
        Schema::dropIfExists('finance_expense_items');
    }
};
