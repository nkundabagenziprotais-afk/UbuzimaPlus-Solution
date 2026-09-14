<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (
            Schema::hasTable(
                'finance_recognition_reviews'
            )
        ) {
            return;
        }

        Schema::create(
            'finance_recognition_reviews',
            function (
                Blueprint $table
            ): void {
                $table->id();

                $table
                    ->unsignedBigInteger(
                        'tenant_id'
                    )
                    ->index();

                $table
                    ->unsignedBigInteger(
                        'branch_id'
                    )
                    ->nullable()
                    ->index();

                $table
                    ->unsignedBigInteger(
                        'journal_entry_id'
                    )
                    ->unique();

                $table
                    ->string(
                        'source_id',
                        100
                    )
                    ->nullable()
                    ->index();

                $table
                    ->string(
                        'classification',
                        50
                    )
                    ->index();

                $table
                    ->string(
                        'recommended_action',
                        50
                    );

                $table
                    ->string(
                        'resolution_status',
                        30
                    )
                    ->index();

                $table
                    ->unsignedBigInteger(
                        'formal_counterpart_id'
                    )
                    ->nullable()
                    ->index();

                $table
                    ->unsignedBigInteger(
                        'exclusion_id'
                    )
                    ->nullable()
                    ->index();

                $table
                    ->unsignedBigInteger(
                        'payment_id'
                    )
                    ->nullable()
                    ->index();

                $table
                    ->char(
                        'evidence_sha256',
                        64
                    );

                $table->longText(
                    'evidence'
                );

                $table->string(
                    'scan_version',
                    30
                );

                $table
                    ->boolean(
                        'is_current'
                    )
                    ->default(true)
                    ->index();

                $table
                    ->timestamp(
                        'last_scanned_at'
                    )
                    ->nullable();

                $table->timestamps();

                $table->index(
                    [
                        'tenant_id',
                        'classification',
                        'is_current',
                    ],
                    'fin_recognition_tenant_class_current_idx'
                );
            }
        );
    }

    public function down(): void
    {
        Schema::dropIfExists(
            'finance_recognition_reviews'
        );
    }
};
