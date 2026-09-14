<?php

namespace App\Services\Finance;

use App\Data\Finance\FinanceJournalLinePayload;
use App\Data\Finance\FinancePostingPayload;
use App\Models\FinanceJournalEntry;
use App\Models\FinancePostingLog;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class FinanceFixedAssetPostingService
{
    public function __construct(
        private readonly FinancePostingService $postingService,
        private readonly FinancePeriodGuard $periodGuard,
        private readonly FinanceAccountResolver $accountResolver,
    ) {
    }

    /**
     * Post one eligible Fixed Asset depreciation period.
     *
     * Dr Depreciation Expense
     * Cr Accumulated Depreciation
     *
     * @return array<string,mixed>
     */
    public function postDepreciation(
        int $tenantId,
        ?int $scopeBranchId,
        int $actorId,
        string $assetUuid,
        string $scheduleUuid,
    ): array {
        return DB::transaction(function () use (
            $tenantId,
            $scopeBranchId,
            $actorId,
            $assetUuid,
            $scheduleUuid,
        ): array {
            $assetQuery = DB::table(
                'finance_fixed_assets'
            )
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->where(
                    'uuid',
                    $assetUuid
                );

            if ($scopeBranchId !== null) {
                $assetQuery->where(
                    'branch_id',
                    $scopeBranchId
                );
            }

            $asset = $assetQuery
                ->lockForUpdate()
                ->first();

            if (! $asset) {
                abort(
                    404,
                    'Fixed asset not found.'
                );
            }

            if (
                strtolower(
                    (string) $asset->status
                ) === 'disposed'
            ) {
                throw ValidationException::withMessages([
                    'asset' => [
                        'Depreciation cannot be posted for a disposed fixed asset.',
                    ],
                ]);
            }

            $schedule = DB::table(
                'finance_fixed_asset_depreciation_schedules'
            )
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->where(
                    'fixed_asset_id',
                    $asset->id
                )
                ->where(
                    'uuid',
                    $scheduleUuid
                )
                ->lockForUpdate()
                ->first();

            if (! $schedule) {
                abort(
                    404,
                    'Fixed asset depreciation schedule row not found.'
                );
            }

            /*
             * Domain idempotency.
             */
            if (
                $schedule->journal_entry_id !== null
                ||
                strtolower(
                    (string) $schedule->status
                ) === 'posted'
            ) {
                $journal =
                    $schedule->journal_entry_id
                    ? FinanceJournalEntry::query()
                        ->where(
                            'tenant_id',
                            $tenantId
                        )
                        ->find(
                            (int) $schedule->journal_entry_id
                        )
                    : null;

                if (! $journal) {
                    throw ValidationException::withMessages([
                        'posting' => [
                            'This depreciation period is marked as posted but its Finance journal is unavailable.',
                        ],
                    ]);
                }

                return [
                    'already_posted' =>
                        true,

                    'schedule_uuid' =>
                        (string) $schedule->uuid,

                    'schedule_status' =>
                        'posted',

                    'journal_entry_id' =>
                        (int) $journal->id,

                    'journal_number' =>
                        (string) $journal->journal_number,

                    'business_date' =>
                        (string) $journal->business_date,

                    'depreciation_amount' =>
                        (float) $schedule->depreciation_amount,
                ];
            }

            /*
             * Planned schedule only.
             */
            if (
                strtolower(
                    trim(
                        (string) $schedule->status
                    )
                ) !== 'planned'
            ) {
                throw ValidationException::withMessages([
                    'status' => [
                        'Only a planned depreciation period may be posted.',
                    ],
                ]);
            }

            /*
             * Sequence enforcement.
             */
            $earlierUnposted = DB::table(
                'finance_fixed_asset_depreciation_schedules'
            )
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->where(
                    'fixed_asset_id',
                    $asset->id
                )
                ->where(
                    'period_number',
                    '<',
                    (int) $schedule->period_number
                )
                ->where(function ($query): void {
                    $query
                        ->where(
                            'status',
                            '!=',
                            'posted'
                        )
                        ->orWhereNull(
                            'journal_entry_id'
                        );
                })
                ->orderBy(
                    'period_number'
                )
                ->first();

            if ($earlierUnposted) {
                throw ValidationException::withMessages([
                    'sequence' => [
                        'Post all earlier depreciation periods before posting this period.',
                    ],
                ]);
            }

            $businessDate = substr(
                (string) $schedule->period_end,
                0,
                10
            );

            /*
             * Future depreciation is prohibited.
             */
            if (
                $businessDate >
                now()->toDateString()
            ) {
                throw ValidationException::withMessages([
                    'business_date' => [
                        'Future depreciation periods cannot be posted.',
                    ],
                ]);
            }

            $amount = round(
                (float) $schedule->depreciation_amount,
                4
            );

            if ($amount <= 0) {
                throw ValidationException::withMessages([
                    'depreciation_amount' => [
                        'Depreciation amount must be greater than zero before posting.',
                    ],
                ]);
            }

            $branchId =
                $asset->branch_id === null
                ? null
                : (int) $asset->branch_id;

            $currencyCode = strtoupper(
                trim(
                    (string) (
                        $asset->currency_code
                        ?: 'RWF'
                    )
                )
            );

            /*
             * Resolve mappings before journal creation.
             */
            $this->accountResolver->resolve(
                $tenantId,
                $branchId,
                'fixed_asset.depreciation_expense',
                $currencyCode,
            );

            $this->accountResolver->resolve(
                $tenantId,
                $branchId,
                'fixed_asset.accumulated_depreciation',
                $currencyCode,
            );

            /*
             * Existing Accounting period close / lock guard.
             */
            $this->periodGuard->openPeriodFor(
                $tenantId,
                $branchId,
                $businessDate,
            );

            $idempotencyKey =
                'finance:fixed-asset:depreciation:'
                . (string) $schedule->uuid;

            $memo =
                'Fixed asset depreciation - '
                . (string) $asset->asset_number
                . ' - '
                . (string) $asset->name
                . ' - period '
                . (int) $schedule->period_number;

            $lines = [
                new FinanceJournalLinePayload(
                    mappingKey:
                        'fixed_asset.depreciation_expense',

                    debit:
                        $amount,

                    credit:
                        0,

                    description:
                        $memo,

                    lineType:
                        'fixed_asset_depreciation_expense',

                    branchId:
                        $branchId,

                    metadata: [
                        'fixed_asset_id' =>
                            (int) $asset->id,

                        'fixed_asset_uuid' =>
                            (string) $asset->uuid,

                        'asset_number' =>
                            (string) $asset->asset_number,

                        'schedule_id' =>
                            (int) $schedule->id,

                        'schedule_uuid' =>
                            (string) $schedule->uuid,

                        'period_number' =>
                            (int) $schedule->period_number,
                    ],
                ),

                new FinanceJournalLinePayload(
                    mappingKey:
                        'fixed_asset.accumulated_depreciation',

                    debit:
                        0,

                    credit:
                        $amount,

                    description:
                        $memo,

                    lineType:
                        'fixed_asset_accumulated_depreciation',

                    branchId:
                        $branchId,

                    metadata: [
                        'fixed_asset_id' =>
                            (int) $asset->id,

                        'fixed_asset_uuid' =>
                            (string) $asset->uuid,

                        'asset_number' =>
                            (string) $asset->asset_number,

                        'schedule_id' =>
                            (int) $schedule->id,

                        'schedule_uuid' =>
                            (string) $schedule->uuid,

                        'period_number' =>
                            (int) $schedule->period_number,
                    ],
                ),
            ];

            $posting =
                $this->postingService->post(
                    new FinancePostingPayload(
                        tenantId:
                            $tenantId,

                        branchId:
                            $branchId,

                        businessDate:
                            $businessDate,

                        sourceModule:
                            'finance',

                        sourceType:
                            'fixed_asset_depreciation',

                        sourceId:
                            (string) $schedule->uuid,

                        idempotencyKey:
                            $idempotencyKey,

                        lines:
                            $lines,

                        currencyCode:
                            $currencyCode,

                        exchangeRate:
                            1,

                        memo:
                            $memo,

                        createdBy:
                            $actorId,

                        sourceSnapshot: [
                            'fixed_asset' => [
                                'id' =>
                                    (int) $asset->id,

                                'uuid' =>
                                    (string) $asset->uuid,

                                'asset_number' =>
                                    (string) $asset->asset_number,

                                'name' =>
                                    (string) $asset->name,

                                'asset_class' =>
                                    (string) $asset->asset_class,

                                'asset_mapping_key' =>
                                    (string) $asset->asset_mapping_key,

                                'acquisition_cost' =>
                                    (float) $asset->acquisition_cost,

                                'currency_code' =>
                                    $currencyCode,
                            ],

                            'depreciation_schedule' => [
                                'id' =>
                                    (int) $schedule->id,

                                'uuid' =>
                                    (string) $schedule->uuid,

                                'period_number' =>
                                    (int) $schedule->period_number,

                                'period_start' =>
                                    (string) $schedule->period_start,

                                'period_end' =>
                                    (string) $schedule->period_end,

                                'opening_book_value' =>
                                    (float) $schedule->opening_book_value,

                                'depreciation_amount' =>
                                    $amount,

                                'accumulated_depreciation' =>
                                    (float) $schedule->accumulated_depreciation,

                                'closing_book_value' =>
                                    (float) $schedule->closing_book_value,
                            ],
                        ],

                        metadata: [
                            'workflow' =>
                                'fixed_asset_depreciation',

                            'fixed_asset_id' =>
                                (int) $asset->id,

                            'fixed_asset_uuid' =>
                                (string) $asset->uuid,

                            'schedule_id' =>
                                (int) $schedule->id,

                            'schedule_uuid' =>
                                (string) $schedule->uuid,

                            'posted_by_user_id' =>
                                $actorId,
                        ],

                        mode:
                            'live',
                    )
                );

            if (
                $posting
                instanceof FinancePostingLog
            ) {
                throw ValidationException::withMessages([
                    'posting' => [
                        $posting->failure_message
                            ?: 'Fixed asset depreciation posting was quarantined.',
                    ],
                ]);
            }

            if (
                ! $posting
                instanceof FinanceJournalEntry
            ) {
                throw ValidationException::withMessages([
                    'posting' => [
                        'Fixed asset depreciation did not return a posted Finance journal.',
                    ],
                ]);
            }

            $scheduleMetadata =
                $this->metadata(
                    $schedule->metadata
                );

            $scheduleMetadata[
                'f11c_posting'
            ] = [
                'release' =>
                    'F11C-A-R1.3',

                'idempotency_key' =>
                    $idempotencyKey,

                'journal_entry_id' =>
                    (int) $posting->id,

                'journal_number' =>
                    (string) $posting->journal_number,

                'posted_by' =>
                    $actorId,

                'posted_at' =>
                    now()->toIso8601String(),
            ];

            DB::table(
                'finance_fixed_asset_depreciation_schedules'
            )
                ->where(
                    'id',
                    $schedule->id
                )
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->update([
                    'status' =>
                        'posted',

                    'journal_entry_id' =>
                        (int) $posting->id,

                    'posted_by' =>
                        $actorId,

                    'posted_at' =>
                        now(),

                    'metadata' =>
                        json_encode(
                            $scheduleMetadata,
                            JSON_UNESCAPED_SLASHES
                        ),

                    'updated_at' =>
                        now(),
                ]);

            DB::table(
                'finance_fixed_asset_actions'
            )->insert([
                'uuid' =>
                    (string) Str::uuid(),

                'tenant_id' =>
                    $tenantId,

                'fixed_asset_id' =>
                    (int) $asset->id,

                'actor_id' =>
                    $actorId,

                'action' =>
                    'depreciation_posted',

                'before_snapshot' =>
                    json_encode([
                        'schedule_uuid' =>
                            (string) $schedule->uuid,

                        'status' =>
                            (string) $schedule->status,

                        'journal_entry_id' =>
                            $schedule->journal_entry_id,
                    ]),

                'after_snapshot' =>
                    json_encode([
                        'schedule_uuid' =>
                            (string) $schedule->uuid,

                        'status' =>
                            'posted',

                        'journal_entry_id' =>
                            (int) $posting->id,

                        'journal_number' =>
                            (string) $posting->journal_number,
                    ]),

                'metadata' =>
                    json_encode([
                        'release' =>
                            'F11C-A-R1.3',

                        'workflow' =>
                            'fixed_asset_depreciation',

                        'business_date' =>
                            $businessDate,

                        'depreciation_amount' =>
                            $amount,

                        'idempotency_key' =>
                            $idempotencyKey,
                    ]),

                'created_at' =>
                    now(),

                'updated_at' =>
                    now(),
            ]);

            return [
                'already_posted' =>
                    false,

                'schedule_uuid' =>
                    (string) $schedule->uuid,

                'schedule_status' =>
                    'posted',

                'depreciation_amount' =>
                    $amount,

                'journal_entry_id' =>
                    (int) $posting->id,

                'journal_number' =>
                    (string) $posting->journal_number,

                'business_date' =>
                    $businessDate,

                'debit_mapping' =>
                    'fixed_asset.depreciation_expense',

                'credit_mapping' =>
                    'fixed_asset.accumulated_depreciation',
            ];
        });
    }

    /**
     * @return array<string,mixed>
     */
    private function metadata(
        mixed $value
    ): array {
        if (is_array($value)) {
            return $value;
        }

        if (
            ! is_string($value)
            ||
            trim($value) === ''
        ) {
            return [];
        }

        $decoded = json_decode(
            $value,
            true
        );

        return is_array($decoded)
            ? $decoded
            : [];
    }
}
