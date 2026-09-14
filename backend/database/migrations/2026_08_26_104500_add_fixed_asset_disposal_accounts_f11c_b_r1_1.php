<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const RELEASE =
        'F11C-B-R1.1';

    private const GAIN_CODE =
        '4930';

    private const LOSS_CODE =
        '6230';

    private const GAIN_MAPPING =
        'fixed_asset.disposal_gain';

    private const LOSS_MAPPING =
        'fixed_asset.disposal_loss';

    public function up(): void
    {
        if (
            ! Schema::hasTable(
                'tenants'
            )
            || ! Schema::hasTable(
                'finance_chart_of_accounts'
            )
            || ! Schema::hasTable(
                'finance_account_mappings'
            )
        ) {
            throw new RuntimeException(
                'F11C-B requires the existing Finance accounting foundation.'
            );
        }

        DB::transaction(
            function (): void {
                $tenantIds =
                    DB::table(
                        'tenants'
                    )
                    ->pluck(
                        'id'
                    );

                foreach (
                    $tenantIds
                    as $tenantId
                ) {
                    $tenantId =
                        (int) $tenantId;

                    $this->assertAbsent(
                        $tenantId
                    );

                    $now =
                        now();

                    /*
                     * Gain accounts 4900-4920 are currently top-level
                     * other-gain accounts, so 4930 follows the same structure.
                     */
                    $gainParentId =
                        null;

                    /*
                     * Operating loss / expense band 6010-6220 belongs under
                     * Operating Expenses 6000.
                     */
                    $lossParentId =
                        DB::table(
                            'finance_chart_of_accounts'
                        )
                        ->where(
                            'tenant_id',
                            $tenantId
                        )
                        ->where(
                            'code',
                            '6000'
                        )
                        ->value(
                            'id'
                        );

                    if (! $lossParentId) {
                        throw new RuntimeException(
                            "Operating Expenses account 6000 is unavailable for tenant {$tenantId}."
                        );
                    }

                    DB::table(
                        'finance_chart_of_accounts'
                    )
                    ->insert([
                        'tenant_id' =>
                            $tenantId,

                        'parent_id' =>
                            $gainParentId,

                        'code' =>
                            self::GAIN_CODE,

                        'name' =>
                            'Fixed Asset Disposal Gain',

                        'account_type' =>
                            'income',

                        'normal_balance' =>
                            'credit',

                        'currency_code' =>
                            'RWF',

                        'is_control_account' =>
                            0,

                        'is_cash_or_bank' =>
                            0,

                        'is_active' =>
                            1,

                        'metadata' =>
                            json_encode(
                                [
                                    'package' =>
                                        'F11_FIXED_ASSETS',

                                    'release' =>
                                        self::RELEASE,

                                    'record_kind' =>
                                        'chart_of_account',

                                    'purpose' =>
                                        'fixed_asset_disposal_gain',
                                ],
                                JSON_UNESCAPED_SLASHES
                            ),

                        'created_at' =>
                            $now,

                        'updated_at' =>
                            $now,
                    ]);

                    DB::table(
                        'finance_chart_of_accounts'
                    )
                    ->insert([
                        'tenant_id' =>
                            $tenantId,

                        'parent_id' =>
                            (int)
                                $lossParentId,

                        'code' =>
                            self::LOSS_CODE,

                        'name' =>
                            'Fixed Asset Disposal Loss',

                        'account_type' =>
                            'expense',

                        'normal_balance' =>
                            'debit',

                        'currency_code' =>
                            'RWF',

                        'is_control_account' =>
                            0,

                        'is_cash_or_bank' =>
                            0,

                        'is_active' =>
                            1,

                        'metadata' =>
                            json_encode(
                                [
                                    'package' =>
                                        'F11_FIXED_ASSETS',

                                    'release' =>
                                        self::RELEASE,

                                    'record_kind' =>
                                        'chart_of_account',

                                    'purpose' =>
                                        'fixed_asset_disposal_loss',
                                ],
                                JSON_UNESCAPED_SLASHES
                            ),

                        'created_at' =>
                            $now,

                        'updated_at' =>
                            $now,
                    ]);

                    $gainAccountId =
                        DB::table(
                            'finance_chart_of_accounts'
                        )
                        ->where(
                            'tenant_id',
                            $tenantId
                        )
                        ->where(
                            'code',
                            self::GAIN_CODE
                        )
                        ->value(
                            'id'
                        );

                    $lossAccountId =
                        DB::table(
                            'finance_chart_of_accounts'
                        )
                        ->where(
                            'tenant_id',
                            $tenantId
                        )
                        ->where(
                            'code',
                            self::LOSS_CODE
                        )
                        ->value(
                            'id'
                        );

                    if (
                        ! $gainAccountId
                        || ! $lossAccountId
                    ) {
                        throw new RuntimeException(
                            'F11C-B failed to resolve its dedicated disposal accounts.'
                        );
                    }

                    foreach (
                        [
                            [
                                self::GAIN_MAPPING,
                                $gainAccountId,
                                'gain',
                            ],
                            [
                                self::LOSS_MAPPING,
                                $lossAccountId,
                                'loss',
                            ],
                        ]
                        as [
                            $mappingKey,
                            $accountId,
                            $purpose,
                        ]
                    ) {
                        DB::table(
                            'finance_account_mappings'
                        )
                        ->insert([
                            'tenant_id' =>
                                $tenantId,

                            'branch_id' =>
                                null,

                            'mapping_key' =>
                                $mappingKey,

                            'finance_chart_of_account_id' =>
                                (int) $accountId,

                            'source_module' =>
                                null,

                            'source_type' =>
                                null,

                            'payment_method' =>
                                null,

                            'currency_code' =>
                                'RWF',

                            'is_default' =>
                                1,

                            'is_active' =>
                                1,

                            'metadata' =>
                                json_encode(
                                    [
                                        'package' =>
                                            'F11_FIXED_ASSETS',

                                        'release' =>
                                            self::RELEASE,

                                        'record_kind' =>
                                            'account_mapping',

                                        'purpose' =>
                                            'fixed_asset_disposal_'
                                            . $purpose,
                                    ],
                                    JSON_UNESCAPED_SLASHES
                                ),

                            'created_at' =>
                                $now,

                            'updated_at' =>
                                $now,
                        ]);
                    }
                }
            }
        );
    }

    public function down(): void
    {
        DB::transaction(
            function (): void {
                DB::table(
                    'finance_account_mappings'
                )
                ->whereIn(
                    'mapping_key',
                    [
                        self::GAIN_MAPPING,
                        self::LOSS_MAPPING,
                    ]
                )
                ->where(
                    'metadata',
                    'like',
                    '%'
                    . self::RELEASE
                    . '%'
                )
                ->delete();

                DB::table(
                    'finance_chart_of_accounts'
                )
                ->whereIn(
                    'code',
                    [
                        self::GAIN_CODE,
                        self::LOSS_CODE,
                    ]
                )
                ->where(
                    'metadata',
                    'like',
                    '%'
                    . self::RELEASE
                    . '%'
                )
                ->delete();
            }
        );
    }

    private function assertAbsent(
        int $tenantId
    ): void {
        $accountExists =
            DB::table(
                'finance_chart_of_accounts'
            )
            ->where(
                'tenant_id',
                $tenantId
            )
            ->whereIn(
                'code',
                [
                    self::GAIN_CODE,
                    self::LOSS_CODE,
                ]
            )
            ->exists();

        if ($accountExists) {
            throw new RuntimeException(
                "F11C-B dedicated disposal account codes already exist for tenant {$tenantId}."
            );
        }

        $mappingExists =
            DB::table(
                'finance_account_mappings'
            )
            ->where(
                'tenant_id',
                $tenantId
            )
            ->whereIn(
                'mapping_key',
                [
                    self::GAIN_MAPPING,
                    self::LOSS_MAPPING,
                ]
            )
            ->exists();

        if ($mappingExists) {
            throw new RuntimeException(
                "F11C-B dedicated disposal mappings already exist for tenant {$tenantId}."
            );
        }
    }
};
