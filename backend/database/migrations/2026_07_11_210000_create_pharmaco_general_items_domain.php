<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        foreach ([
            'pharmaco_general_items',
            'pharmaco_general_item_locations',
            'pharmaco_general_item_movements',
        ] as $requiredTable) {
            if (! Schema::hasTable($requiredTable)) {
                throw new \RuntimeException(
                    "Required production table {$requiredTable} is missing."
                );
            }
        }

        $addedCategoryId = false;
        $addedReorderQuantity = false;
        $addedNotes = false;
        $addedReference = false;

        if (! Schema::hasColumn(
            'pharmaco_general_items',
            'category_id'
        )) {
            Schema::table(
                'pharmaco_general_items',
                function (Blueprint $table): void {
                    $table
                        ->unsignedBigInteger('category_id')
                        ->nullable();
                }
            );

            $addedCategoryId = true;
        }

        if (! Schema::hasColumn(
            'pharmaco_general_items',
            'reorder_quantity'
        )) {
            Schema::table(
                'pharmaco_general_items',
                function (Blueprint $table): void {
                    $table
                        ->decimal('reorder_quantity', 15, 3)
                        ->default(0);
                }
            );

            $addedReorderQuantity = true;
        }

        if (! Schema::hasColumn(
            'pharmaco_general_items',
            'standard_unit_cost'
        )) {
            Schema::table(
                'pharmaco_general_items',
                function (Blueprint $table): void {
                    $table
                        ->decimal('standard_unit_cost', 18, 2)
                        ->default(0);
                }
            );
        }

        if (! Schema::hasColumn(
            'pharmaco_general_item_locations',
            'stock_location_id'
        )) {
            Schema::table(
                'pharmaco_general_item_locations',
                function (Blueprint $table): void {
                    $table
                        ->unsignedBigInteger('stock_location_id')
                        ->nullable();
                }
            );
        }

        if (! Schema::hasColumn(
            'pharmaco_general_item_movements',
            'department'
        )) {
            Schema::table(
                'pharmaco_general_item_movements',
                function (Blueprint $table): void {
                    $table
                        ->string('department', 191)
                        ->nullable();
                }
            );
        }

        if (! Schema::hasColumn(
            'pharmaco_general_item_movements',
            'notes'
        )) {
            Schema::table(
                'pharmaco_general_item_movements',
                function (Blueprint $table): void {
                    $table
                        ->text('notes')
                        ->nullable();
                }
            );

            $addedNotes = true;
        }

        if (! Schema::hasColumn(
            'pharmaco_general_item_movements',
            'purchase_order_item_id'
        )) {
            Schema::table(
                'pharmaco_general_item_movements',
                function (Blueprint $table): void {
                    $table
                        ->unsignedBigInteger(
                            'purchase_order_item_id'
                        )
                        ->nullable();
                }
            );
        }

        if (! Schema::hasColumn(
            'pharmaco_general_item_movements',
            'reference'
        )) {
            Schema::table(
                'pharmaco_general_item_movements',
                function (Blueprint $table): void {
                    $table
                        ->string('reference', 100)
                        ->nullable();
                }
            );

            $addedReference = true;
        }

        if (
            $addedCategoryId
            && Schema::hasColumn(
                'pharmaco_general_items',
                'pharmaco_general_item_category_id'
            )
        ) {
            DB::table('pharmaco_general_items')
                ->whereNotNull(
                    'pharmaco_general_item_category_id'
                )
                ->update([
                    'category_id' => DB::raw(
                        'pharmaco_general_item_category_id'
                    ),
                ]);
        }

        if (
            $addedReorderQuantity
            && Schema::hasColumn(
                'pharmaco_general_items',
                'reorder_level'
            )
        ) {
            DB::table('pharmaco_general_items')
                ->whereNotNull('reorder_level')
                ->update([
                    'reorder_quantity' =>
                        DB::raw('reorder_level'),
                ]);
        }

        if (
            $addedNotes
            && Schema::hasColumn(
                'pharmaco_general_item_movements',
                'reason'
            )
        ) {
            DB::table('pharmaco_general_item_movements')
                ->whereNotNull('reason')
                ->update([
                    'notes' => DB::raw('reason'),
                ]);
        }

        if (
            $addedReference
            && Schema::hasColumn(
                'pharmaco_general_item_movements',
                'reference_number'
            )
        ) {
            DB::table('pharmaco_general_item_movements')
                ->whereNotNull('reference_number')
                ->update([
                    'reference' =>
                        DB::raw('reference_number'),
                ]);
        }
    }

    public function down(): void
    {
        // Intentionally non-destructive because the deployed
        // production migrations own these General Items tables.
    }
};
