<?php

use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        /*
         * Intentional no-op.
         *
         * This migration was generated during Phase 2 insurance enhancement
         * but was executed before column definitions were added.
         *
         * The real corrective schema changes are implemented in:
         * 2026_07_17_212601_apply_insurance_core_configuration_columns.php
         */
    }

    public function down(): void
    {
        /*
         * No-op rollback.
         */
    }
};
