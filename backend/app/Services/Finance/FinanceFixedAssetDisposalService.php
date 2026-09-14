<?php

namespace App\Services\Finance;

use App\Data\Finance\FinanceJournalLinePayload;
use App\Data\Finance\FinancePostingPayload;
use App\Models\FinanceJournalEntry;
use App\Models\FinancePostingLog;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class FinanceFixedAssetDisposalService
{
    private const RELEASE =
        'F11C-B-R1.1';

    private const GAIN_MAPPING =
        'fixed_asset.disposal_gain';

    private const LOSS_MAPPING =
        'fixed_asset.disposal_loss';

    private const ACCUMULATED_MAPPING =
        'fixed_asset.accumulated_depreciation';

    private const PROCEEDS_MAPPINGS = [
        'pos.cash',
        'pos.bank',
        'pos.card',
        'pos.momo',
    ];

    public function __construct(
        private readonly FinancePostingService $postingService,
        private readonly FinanceAccountResolver $accountResolver,
    ) {
    }

    public function list(
        int $tenantId,
        ?int $branchId,
        string $assetUuid,
    ): array {
        $asset =
            $this->asset(
                $tenantId,
                $branchId,
                $assetUuid,
            );

        $rows =
            DB::table(
                'finance_fixed_asset_disposals'
            )
            ->where(
                'tenant_id',
                $tenantId
            )
            ->where(
                'fixed_asset_id',
                $asset->id
            )
            ->orderByDesc(
                'id'
            )
            ->get();

        return [
            'asset_uuid' =>
                (string) $asset->uuid,

            'asset_number' =>
                (string) $asset->asset_number,

            'asset_name' =>
                (string) $asset->name,

            'asset_status' =>
                (string) $asset->status,

            'rows' =>
                $rows
                ->map(
                    fn (object $row): array =>
                        $this->disposalPayload(
                            $row
                        )
                )
                ->values()
                ->all(),
        ];
    }

    public function createDraft(
        int $tenantId,
        ?int $branchId,
        ?int $actorId,
        string $assetUuid,
        array $input,
    ): array {
        return DB::transaction(
            function () use (
                $tenantId,
                $branchId,
                $actorId,
                $assetUuid,
                $input,
            ): array {
                $actorId =
                    $this->actor(
                        $actorId
                    );

                $asset =
                    $this->asset(
                        $tenantId,
                        $branchId,
                        $assetUuid,
                        true,
                    );

                if (
                    strtolower(
                        (string) $asset->status
                    )
                    !== 'active'
                ) {
                    throw ValidationException::withMessages([
                        'asset' => [
                            'Only an active Fixed Asset may enter disposal.',
                        ],
                    ]);
                }

                $existing =
                    DB::table(
                        'finance_fixed_asset_disposals'
                    )
                    ->where(
                        'tenant_id',
                        $tenantId
                    )
                    ->where(
                        'fixed_asset_id',
                        $asset->id
                    )
                    ->whereIn(
                        'status',
                        [
                            'draft',
                            'posted',
                        ]
                    )
                    ->first();

                if ($existing) {
                    throw ValidationException::withMessages([
                        'disposal' => [
                            'This Fixed Asset already has an active or posted disposal record.',
                        ],
                    ]);
                }

                $disposalDate =
                    $this->date(
                        (string)
                            (
                                $input[
                                    'disposal_date'
                                ]
                                ?? ''
                            )
                    );

                if (
                    $disposalDate
                    <
                    (string)
                        $asset->in_service_date
                ) {
                    throw ValidationException::withMessages([
                        'disposal_date' => [
                            'Disposal Date cannot precede the In-Service Date.',
                        ],
                    ]);
                }

                $type =
                    strtolower(
                        trim(
                            (string)
                                (
                                    $input[
                                        'disposal_type'
                                    ]
                                    ?? ''
                                )
                        )
                    );

                if (
                    ! in_array(
                        $type,
                        [
                            'sale',
                            'scrap',
                        ],
                        true
                    )
                ) {
                    throw ValidationException::withMessages([
                        'disposal_type' => [
                            'Disposal Type must be sale or scrap.',
                        ],
                    ]);
                }

                $proceeds =
                    round(
                        (float)
                            (
                                $input[
                                    'proceeds_amount'
                                ]
                                ?? 0
                            ),
                        4
                    );

                if ($proceeds < 0) {
                    throw ValidationException::withMessages([
                        'proceeds_amount' => [
                            'Disposal proceeds cannot be negative.',
                        ],
                    ]);
                }

                $proceedsMapping =
                    trim(
                        (string)
                            (
                                $input[
                                    'proceeds_mapping_key'
                                ]
                                ?? ''
                            )
                    );

                if ($type === 'sale') {
                    if ($proceeds <= 0) {
                        throw ValidationException::withMessages([
                            'proceeds_amount' => [
                                'A sale disposal requires positive proceeds.',
                            ],
                        ]);
                    }

                    if (
                        ! in_array(
                            $proceedsMapping,
                            self::PROCEEDS_MAPPINGS,
                            true
                        )
                    ) {
                        throw ValidationException::withMessages([
                            'proceeds_mapping_key' => [
                                'Sale proceeds must use an approved Cash, Bank, Card, or Mobile Money Finance mapping.',
                            ],
                        ]);
                    }

                    $this->accountResolver
                        ->resolve(
                            $tenantId,
                            $branchId,
                            $proceedsMapping,
                            (string)
                                $asset->currency_code,
                        );
                } else {
                    if ($proceeds !== 0.0) {
                        throw ValidationException::withMessages([
                            'proceeds_amount' => [
                                'A scrap disposal must have zero proceeds.',
                            ],
                        ]);
                    }

                    $proceedsMapping =
                        '';
                }

                $this->validateAccountingMappings(
                    $tenantId,
                    $branchId,
                    $asset,
                );

                $basis =
                    $this->basis(
                        $tenantId,
                        $asset,
                        $disposalDate,
                    );

                $gainLoss =
                    round(
                        $proceeds
                        -
                        $basis[
                            'book_value'
                        ],
                        4
                    );

                $uuid =
                    (string)
                        Str::uuid();

                $now =
                    now();

                $metadata = [
                    'package' =>
                        'F11_FIXED_ASSETS',

                    'release' =>
                        self::RELEASE,

                    'workflow' =>
                        'fixed_asset_disposal',

                    'maker_user_id' =>
                        $actorId,

                    'proceeds_mapping_key' =>
                        $proceedsMapping
                            !== ''
                        ? $proceedsMapping
                        : null,

                    'acquisition_cost' =>
                        $basis[
                            'acquisition_cost'
                        ],

                    'accumulated_depreciation' =>
                        $basis[
                            'accumulated_depreciation'
                        ],

                    'latest_posted_period_end' =>
                        $basis[
                            'latest_posted_period_end'
                        ],

                    'notes' =>
                        isset(
                            $input[
                                'notes'
                            ]
                        )
                        ? trim(
                            (string)
                                $input[
                                    'notes'
                                ]
                        )
                        : null,
                ];

                DB::table(
                    'finance_fixed_asset_disposals'
                )
                ->insert([
                    'uuid' =>
                        $uuid,

                    'tenant_id' =>
                        $tenantId,

                    'fixed_asset_id' =>
                        (int)
                            $asset->id,

                    'disposal_date' =>
                        $disposalDate,

                    'disposal_type' =>
                        $type,

                    'proceeds_amount' =>
                        $proceeds,

                    'book_value_at_disposal' =>
                        $basis[
                            'book_value'
                        ],

                    'gain_loss' =>
                        $gainLoss,

                    'status' =>
                        'draft',

                    'journal_entry_id' =>
                        null,

                    'created_by' =>
                        $actorId,

                    'approved_by' =>
                        null,

                    'metadata' =>
                        json_encode(
                            $metadata,
                            JSON_UNESCAPED_SLASHES
                        ),

                    'created_at' =>
                        $now,

                    'updated_at' =>
                        $now,
                ]);

                $disposal =
                    $this->disposal(
                        $tenantId,
                        (int)
                            $asset->id,
                        $uuid,
                        true,
                    );

                $this->audit(
                    $tenantId,
                    (int)
                        $asset->id,
                    $actorId,
                    'disposal_draft_created',
                    null,
                    $disposal,
                    [
                        'disposal_uuid' =>
                            $uuid,

                        'disposal_type' =>
                            $type,

                        'disposal_date' =>
                            $disposalDate,

                        'book_value' =>
                            $basis[
                                'book_value'
                            ],

                        'gain_loss' =>
                            $gainLoss,
                    ],
                );

                return $this->disposalPayload(
                    $disposal
                );
            }
        );
    }

    public function post(
        int $tenantId,
        ?int $branchId,
        ?int $actorId,
        string $assetUuid,
        string $disposalUuid,
    ): array {
        return DB::transaction(
            function () use (
                $tenantId,
                $branchId,
                $actorId,
                $assetUuid,
                $disposalUuid,
            ): array {
                $actorId =
                    $this->actor(
                        $actorId
                    );

                $asset =
                    $this->asset(
                        $tenantId,
                        $branchId,
                        $assetUuid,
                        true,
                    );

                $disposal =
                    $this->disposal(
                        $tenantId,
                        (int)
                            $asset->id,
                        $disposalUuid,
                        true,
                    );

                if (
                    strtolower(
                        (string)
                            $disposal->status
                    )
                    === 'posted'
                    &&
                    $disposal->journal_entry_id
                ) {
                    $journal =
                        FinanceJournalEntry::query()
                        ->findOrFail(
                            (int)
                                $disposal
                                    ->journal_entry_id
                        );

                    return [
                        'already_posted' =>
                            true,

                        'disposal' =>
                            $this->disposalPayload(
                                $disposal
                            ),

                        'journal_entry_id' =>
                            (int)
                                $journal->id,

                        'journal_number' =>
                            (string)
                                $journal
                                    ->journal_number,
                    ];
                }

                if (
                    strtolower(
                        (string)
                            $disposal->status
                    )
                    !== 'draft'
                ) {
                    throw ValidationException::withMessages([
                        'disposal' => [
                            'Only a draft Fixed Asset disposal may be posted.',
                        ],
                    ]);
                }

                if (
                    (
                        (int) $disposal->created_by === $actorId
                        && ! \App\Support\MakerCheckerExemptionPolicy::allows(
                            $actorId,
                            isset($disposal->tenant_id)
                                ? (int) $disposal->tenant_id
                                : null,
                            isset($disposal->branch_id)
                                ? (int) $disposal->branch_id
                                : null
                        )
                    )
                ) {
                    throw ValidationException::withMessages([
                        'approval' => [
                            'Maker-checker control requires a different Finance approver to post this Fixed Asset disposal.',
                        ],
                    ]);
                }

                if (
                    strtolower(
                        (string)
                            $asset->status
                    )
                    !== 'active'
                ) {
                    throw ValidationException::withMessages([
                        'asset' => [
                            'The Fixed Asset is no longer active.',
                        ],
                    ]);
                }

                $disposalDate =
                    $this->date(
                        (string)
                            $disposal
                                ->disposal_date
                    );

                $basis =
                    $this->basis(
                        $tenantId,
                        $asset,
                        $disposalDate,
                    );

                if (
                    abs(
                        $basis[
                            'book_value'
                        ]
                        -
                        (float)
                            $disposal
                                ->book_value_at_disposal
                    )
                    > 0.0001
                ) {
                    throw ValidationException::withMessages([
                        'book_value' => [
                            'Fixed Asset book value changed after disposal draft creation. Review and recreate the disposal draft.',
                        ],
                    ]);
                }

                $proceeds =
                    round(
                        (float)
                            $disposal
                                ->proceeds_amount,
                        4
                    );

                $gainLoss =
                    round(
                        $proceeds
                        -
                        $basis[
                            'book_value'
                        ],
                        4
                    );

                if (
                    abs(
                        $gainLoss
                        -
                        (float)
                            $disposal
                                ->gain_loss
                    )
                    > 0.0001
                ) {
                    throw ValidationException::withMessages([
                        'gain_loss' => [
                            'Fixed Asset disposal gain/loss changed after draft creation. Review and recreate the disposal draft.',
                        ],
                    ]);
                }

                $metadata =
                    $this->metadata(
                        $disposal->metadata
                    );

                $proceedsMapping =
                    trim(
                        (string)
                            (
                                $metadata[
                                    'proceeds_mapping_key'
                                ]
                                ?? ''
                            )
                    );

                if ($proceeds > 0) {
                    if (
                        ! in_array(
                            $proceedsMapping,
                            self::PROCEEDS_MAPPINGS,
                            true
                        )
                    ) {
                        throw ValidationException::withMessages([
                            'proceeds_mapping_key' => [
                                'The disposal proceeds Finance mapping is invalid.',
                            ],
                        ]);
                    }
                }

                $this->validateAccountingMappings(
                    $tenantId,
                    $branchId,
                    $asset,
                );

                if ($proceeds > 0) {
                    $this->accountResolver
                        ->resolve(
                            $tenantId,
                            $branchId,
                            $proceedsMapping,
                            (string)
                                $asset->currency_code,
                        );
                }

                $lines = [];

                if ($proceeds > 0) {
                    $lines[] =
                        new FinanceJournalLinePayload(
                            mappingKey:
                                $proceedsMapping,

                            debit:
                                $proceeds,

                            description:
                                'Fixed asset disposal proceeds - '
                                . $asset->asset_number
                                . ' - '
                                . $asset->name,

                            lineType:
                                'fixed_asset_disposal_proceeds',

                            branchId:
                                $branchId,

                            metadata: [
                                'disposal_uuid' =>
                                    $disposalUuid,
                            ],
                        );
                }

                if (
                    $basis[
                        'accumulated_depreciation'
                    ]
                    > 0
                ) {
                    $lines[] =
                        new FinanceJournalLinePayload(
                            mappingKey:
                                self::ACCUMULATED_MAPPING,

                            debit:
                                $basis[
                                    'accumulated_depreciation'
                                ],

                            description:
                                'Derecognize accumulated depreciation - '
                                . $asset->asset_number
                                . ' - '
                                . $asset->name,

                            lineType:
                                'fixed_asset_disposal_accumulated_depreciation',

                            branchId:
                                $branchId,

                            metadata: [
                                'disposal_uuid' =>
                                    $disposalUuid,
                            ],
                        );
                }

                if ($gainLoss < 0) {
                    $lines[] =
                        new FinanceJournalLinePayload(
                            mappingKey:
                                self::LOSS_MAPPING,

                            debit:
                                abs(
                                    $gainLoss
                                ),

                            description:
                                'Fixed asset disposal loss - '
                                . $asset->asset_number
                                . ' - '
                                . $asset->name,

                            lineType:
                                'fixed_asset_disposal_loss',

                            branchId:
                                $branchId,

                            metadata: [
                                'disposal_uuid' =>
                                    $disposalUuid,
                            ],
                        );
                }

                $lines[] =
                    new FinanceJournalLinePayload(
                        mappingKey:
                            (string)
                                $asset
                                    ->asset_mapping_key,

                        credit:
                            $basis[
                                'acquisition_cost'
                            ],

                        description:
                            'Derecognize fixed asset cost - '
                            . $asset->asset_number
                            . ' - '
                            . $asset->name,

                        lineType:
                            'fixed_asset_disposal_cost',

                        branchId:
                            $branchId,

                        metadata: [
                            'disposal_uuid' =>
                                $disposalUuid,
                        ],
                    );

                if ($gainLoss > 0) {
                    $lines[] =
                        new FinanceJournalLinePayload(
                            mappingKey:
                                self::GAIN_MAPPING,

                            credit:
                                $gainLoss,

                            description:
                                'Fixed asset disposal gain - '
                                . $asset->asset_number
                                . ' - '
                                . $asset->name,

                            lineType:
                                'fixed_asset_disposal_gain',

                            branchId:
                                $branchId,

                            metadata: [
                                'disposal_uuid' =>
                                    $disposalUuid,
                            ],
                        );
                }

                $idempotencyKey =
                    'finance:fixed-asset:disposal:'
                    . $disposalUuid;

                $posting =
                    $this->postingService
                    ->post(
                        new FinancePostingPayload(
                            tenantId:
                                $tenantId,

                            branchId:
                                $branchId,

                            businessDate:
                                $disposalDate,

                            sourceModule:
                                'finance',

                            sourceType:
                                'fixed_asset_disposal',

                            sourceId:
                                $disposalUuid,

                            idempotencyKey:
                                $idempotencyKey,

                            lines:
                                $lines,

                            currencyCode:
                                (string)
                                    $asset
                                        ->currency_code,

                            memo:
                                'Fixed asset disposal - '
                                . $asset->asset_number
                                . ' - '
                                . $asset->name,

                            createdBy:
                                $actorId,

                            sourceSnapshot: [
                                'fixed_asset' => [
                                    'id' =>
                                        (int)
                                            $asset->id,

                                    'uuid' =>
                                        (string)
                                            $asset->uuid,

                                    'asset_number' =>
                                        (string)
                                            $asset
                                                ->asset_number,

                                    'name' =>
                                        (string)
                                            $asset->name,

                                    'asset_mapping_key' =>
                                        (string)
                                            $asset
                                                ->asset_mapping_key,

                                    'acquisition_cost' =>
                                        $basis[
                                            'acquisition_cost'
                                        ],
                                ],

                                'disposal' => [
                                    'uuid' =>
                                        $disposalUuid,

                                    'date' =>
                                        $disposalDate,

                                    'type' =>
                                        (string)
                                            $disposal
                                                ->disposal_type,

                                    'proceeds' =>
                                        $proceeds,

                                    'accumulated_depreciation' =>
                                        $basis[
                                            'accumulated_depreciation'
                                        ],

                                    'book_value' =>
                                        $basis[
                                            'book_value'
                                        ],

                                    'gain_loss' =>
                                        $gainLoss,
                                ],
                            ],

                            metadata: [
                                'workflow' =>
                                    'fixed_asset_disposal',

                                'fixed_asset_id' =>
                                    (int)
                                        $asset->id,

                                'fixed_asset_uuid' =>
                                    (string)
                                        $asset->uuid,

                                'disposal_uuid' =>
                                    $disposalUuid,

                                'maker_user_id' =>
                                    (int)
                                        $disposal
                                            ->created_by,

                                'checker_user_id' =>
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
                            $posting
                                ->failure_message
                            ?: 'Fixed Asset disposal posting was quarantined.',
                        ],
                    ]);
                }

                if (
                    ! $posting
                    instanceof FinanceJournalEntry
                ) {
                    throw ValidationException::withMessages([
                        'posting' => [
                            'Fixed Asset disposal did not return a posted Finance journal.',
                        ],
                    ]);
                }

                $metadata[
                    'f11c_b_posting'
                ] = [
                    'release' =>
                        self::RELEASE,

                    'idempotency_key' =>
                        $idempotencyKey,

                    'journal_entry_id' =>
                        (int)
                            $posting->id,

                    'journal_number' =>
                        (string)
                            $posting
                                ->journal_number,

                    'approved_by' =>
                        $actorId,

                    'posted_at' =>
                        now()
                            ->toIso8601String(),
                ];

                DB::table(
                    'finance_fixed_asset_disposals'
                )
                ->where(
                    'id',
                    $disposal->id
                )
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->update([
                    'status' =>
                        'posted',

                    'journal_entry_id' =>
                        (int)
                            $posting->id,

                    'approved_by' =>
                        $actorId,

                    'metadata' =>
                        json_encode(
                            $metadata,
                            JSON_UNESCAPED_SLASHES
                        ),

                    'updated_at' =>
                        now(),
                ]);

                $cancelled =
                    $this->cancelFutureSchedules(
                        $tenantId,
                        (int)
                            $asset->id,
                        $disposalDate,
                        $disposalUuid,
                        (int)
                            $posting->id,
                    );

                $assetMetadata =
                    $this->metadata(
                        $asset->metadata
                    );

                $assetMetadata[
                    'f11c_b_disposal'
                ] = [
                    'release' =>
                        self::RELEASE,

                    'disposal_uuid' =>
                        $disposalUuid,

                    'disposal_date' =>
                        $disposalDate,

                    'journal_entry_id' =>
                        (int)
                            $posting->id,

                    'journal_number' =>
                        (string)
                            $posting
                                ->journal_number,

                    'future_schedules_cancelled' =>
                        $cancelled,

                    'approved_by' =>
                        $actorId,
                ];

                DB::table(
                    'finance_fixed_assets'
                )
                ->where(
                    'id',
                    $asset->id
                )
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->update([
                    'status' =>
                        'disposed',

                    'updated_by' =>
                        $actorId,

                    'metadata' =>
                        json_encode(
                            $assetMetadata,
                            JSON_UNESCAPED_SLASHES
                        ),

                    'updated_at' =>
                        now(),
                ]);

                $postedDisposal =
                    $this->disposal(
                        $tenantId,
                        (int)
                            $asset->id,
                        $disposalUuid,
                    );

                $this->audit(
                    $tenantId,
                    (int)
                        $asset->id,
                    $actorId,
                    'disposal_posted',
                    $disposal,
                    $postedDisposal,
                    [
                        'disposal_uuid' =>
                            $disposalUuid,

                        'journal_entry_id' =>
                            (int)
                                $posting->id,

                        'journal_number' =>
                            (string)
                                $posting
                                    ->journal_number,

                        'book_value' =>
                            $basis[
                                'book_value'
                            ],

                        'proceeds' =>
                            $proceeds,

                        'gain_loss' =>
                            $gainLoss,

                        'future_schedules_cancelled' =>
                            $cancelled,
                    ],
                );

                return [
                    'already_posted' =>
                        false,

                    'disposal' =>
                        $this->disposalPayload(
                            $postedDisposal
                        ),

                    'journal_entry_id' =>
                        (int)
                            $posting->id,

                    'journal_number' =>
                        (string)
                            $posting
                                ->journal_number,

                    'future_schedules_cancelled' =>
                        $cancelled,
                ];
            }
        );
    }

    private function basis(
        int $tenantId,
        object $asset,
        string $disposalDate,
    ): array {
        $futurePosted =
            DB::table(
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
                'status',
                'posted'
            )
            ->where(
                'period_end',
                '>',
                $disposalDate
            )
            ->exists();

        if ($futurePosted) {
            throw ValidationException::withMessages([
                'disposal_date' => [
                    'Disposal Date cannot precede a depreciation period already posted to the General Ledger.',
                ],
            ]);
        }

        $unpostedDue =
            DB::table(
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
                'status',
                'planned'
            )
            ->where(
                'period_end',
                '<=',
                $disposalDate
            )
            ->exists();

        if ($unpostedDue) {
            throw ValidationException::withMessages([
                'depreciation' => [
                    'Post all depreciation periods through the Disposal Date before disposing this Fixed Asset.',
                ],
            ]);
        }

        $latestPostedEnd =
            DB::table(
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
                'status',
                'posted'
            )
            ->whereNotNull(
                'journal_entry_id'
            )
            ->where(
                'period_end',
                '<=',
                $disposalDate
            )
            ->max(
                'period_end'
            );

        if (
            $latestPostedEnd
            !== null
            &&
            (string)
                $latestPostedEnd
            !== $disposalDate
        ) {
            throw ValidationException::withMessages([
                'disposal_date' => [
                    'For the current monthly depreciation policy, Disposal Date must equal the latest posted depreciation period end. This prevents an unrecognized partial-period depreciation amount.',
                ],
            ]);
        }

        $accumulated =
            round(
                (float)
                    DB::table(
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
                        'status',
                        'posted'
                    )
                    ->whereNotNull(
                        'journal_entry_id'
                    )
                    ->where(
                        'period_end',
                        '<=',
                        $disposalDate
                    )
                    ->sum(
                        'depreciation_amount'
                    ),
                4
            );

        $cost =
            round(
                (float)
                    $asset
                        ->acquisition_cost,
                4
            );

        if (
            $cost <= 0
            || $accumulated < 0
            || $accumulated > $cost + 0.0001
        ) {
            throw ValidationException::withMessages([
                'asset' => [
                    'Fixed Asset cost/depreciation basis is invalid for disposal.',
                ],
            ]);
        }

        $bookValue =
            round(
                $cost
                -
                $accumulated,
                4
            );

        if (
            $bookValue < -0.0001
        ) {
            throw ValidationException::withMessages([
                'book_value' => [
                    'Fixed Asset book value cannot be negative.',
                ],
            ]);
        }

        if ($bookValue < 0) {
            $bookValue =
                0.0;
        }

        return [
            'acquisition_cost' =>
                $cost,

            'accumulated_depreciation' =>
                $accumulated,

            'book_value' =>
                $bookValue,

            'latest_posted_period_end' =>
                $latestPostedEnd
                    !== null
                ? (string)
                    $latestPostedEnd
                : null,
        ];
    }

    private function validateAccountingMappings(
        int $tenantId,
        ?int $branchId,
        object $asset,
    ): void {
        $currency =
            (string)
                $asset
                    ->currency_code;

        foreach (
            [
                (string)
                    $asset
                        ->asset_mapping_key,

                self::ACCUMULATED_MAPPING,

                self::GAIN_MAPPING,

                self::LOSS_MAPPING,
            ]
            as $mapping
        ) {
            $this->accountResolver
                ->resolve(
                    $tenantId,
                    $branchId,
                    $mapping,
                    $currency,
                );
        }
    }

    private function cancelFutureSchedules(
        int $tenantId,
        int $assetId,
        string $disposalDate,
        string $disposalUuid,
        int $journalEntryId,
    ): int {
        $rows =
            DB::table(
                'finance_fixed_asset_depreciation_schedules'
            )
            ->where(
                'tenant_id',
                $tenantId
            )
            ->where(
                'fixed_asset_id',
                $assetId
            )
            ->where(
                'status',
                'planned'
            )
            ->where(
                'period_end',
                '>',
                $disposalDate
            )
            ->get();

        foreach ($rows as $row) {
            $metadata =
                $this->metadata(
                    $row->metadata
                );

            $metadata[
                'f11c_b_cancellation'
            ] = [
                'release' =>
                    self::RELEASE,

                'reason' =>
                    'fixed_asset_disposed',

                'disposal_uuid' =>
                    $disposalUuid,

                'disposal_journal_entry_id' =>
                    $journalEntryId,
            ];

            DB::table(
                'finance_fixed_asset_depreciation_schedules'
            )
            ->where(
                'id',
                $row->id
            )
            ->where(
                'tenant_id',
                $tenantId
            )
            ->update([
                'status' =>
                    'cancelled',

                'metadata' =>
                    json_encode(
                        $metadata,
                        JSON_UNESCAPED_SLASHES
                    ),

                'updated_at' =>
                    now(),
            ]);
        }

        return $rows->count();
    }

    private function asset(
        int $tenantId,
        ?int $branchId,
        string $uuid,
        bool $lock = false,
    ): object {
        $query =
            DB::table(
                'finance_fixed_assets'
            )
            ->where(
                'tenant_id',
                $tenantId
            )
            ->where(
                'uuid',
                $uuid
            );

        if ($branchId !== null) {
            $query->where(
                'branch_id',
                $branchId
            );
        }

        if ($lock) {
            $query->lockForUpdate();
        }

        $asset =
            $query->first();

        if (! $asset) {
            abort(
                404,
                'Fixed Asset not found.'
            );
        }

        return $asset;
    }

    private function disposal(
        int $tenantId,
        int $assetId,
        string $uuid,
        bool $lock = false,
    ): object {
        $query =
            DB::table(
                'finance_fixed_asset_disposals'
            )
            ->where(
                'tenant_id',
                $tenantId
            )
            ->where(
                'fixed_asset_id',
                $assetId
            )
            ->where(
                'uuid',
                $uuid
            );

        if ($lock) {
            $query->lockForUpdate();
        }

        $disposal =
            $query->first();

        if (! $disposal) {
            abort(
                404,
                'Fixed Asset disposal not found.'
            );
        }

        return $disposal;
    }

    private function actor(
        ?int $actorId
    ): int {
        if (
            $actorId === null
            || $actorId <= 0
        ) {
            throw ValidationException::withMessages([
                'actor' => [
                    'A verified Finance user is required.',
                ],
            ]);
        }

        return $actorId;
    }

    private function date(
        string $date
    ): string {
        $date =
            trim(
                $date
            );

        try {
            $parsed =
                CarbonImmutable::createFromFormat(
                    '!Y-m-d',
                    $date
                );
        } catch (\Throwable) {
            $parsed =
                false;
        }

        if (
            ! $parsed
            || $parsed->format(
                'Y-m-d'
            )
            !== $date
        ) {
            throw ValidationException::withMessages([
                'disposal_date' => [
                    'Disposal Date must use YYYY-MM-DD.',
                ],
            ]);
        }

        return $date;
    }

    private function audit(
        int $tenantId,
        int $assetId,
        int $actorId,
        string $action,
        ?object $before,
        ?object $after,
        array $metadata,
    ): void {
        DB::table(
            'finance_fixed_asset_actions'
        )
        ->insert([
            'uuid' =>
                (string)
                    Str::uuid(),

            'tenant_id' =>
                $tenantId,

            'fixed_asset_id' =>
                $assetId,

            'actor_id' =>
                $actorId,

            'action' =>
                $action,

            'before_snapshot' =>
                $before
                ? json_encode(
                    (array)
                        $before,
                    JSON_UNESCAPED_SLASHES
                )
                : null,

            'after_snapshot' =>
                $after
                ? json_encode(
                    (array)
                        $after,
                    JSON_UNESCAPED_SLASHES
                )
                : null,

            'metadata' =>
                json_encode(
                    array_merge(
                        [
                            'package' =>
                                'F11_FIXED_ASSETS',

                            'release' =>
                                self::RELEASE,
                        ],
                        $metadata
                    ),
                    JSON_UNESCAPED_SLASHES
                ),

            'created_at' =>
                now(),

            'updated_at' =>
                now(),
        ]);
    }

    private function disposalPayload(
        object $row
    ): array {
        $metadata =
            $this->metadata(
                $row->metadata
            );

        return [
            'uuid' =>
                (string)
                    $row->uuid,

            'disposal_date' =>
                (string)
                    $row
                        ->disposal_date,

            'disposal_type' =>
                (string)
                    $row
                        ->disposal_type,

            'proceeds_amount' =>
                (float)
                    $row
                        ->proceeds_amount,

            'proceeds_mapping_key' =>
                $metadata[
                    'proceeds_mapping_key'
                ]
                ?? null,

            'book_value_at_disposal' =>
                (float)
                    $row
                        ->book_value_at_disposal,

            'gain_loss' =>
                (float)
                    $row
                        ->gain_loss,

            'status' =>
                (string)
                    $row->status,

            'journal_entry_id' =>
                $row->journal_entry_id
                    !== null
                ? (int)
                    $row
                        ->journal_entry_id
                : null,

            'created_by' =>
                $row->created_by
                    !== null
                ? (int)
                    $row
                        ->created_by
                : null,

            'approved_by' =>
                $row->approved_by
                    !== null
                ? (int)
                    $row
                        ->approved_by
                : null,

            'metadata' =>
                $metadata,

            'created_at' =>
                $row->created_at,

            'updated_at' =>
                $row->updated_at,
        ];
    }

    private function metadata(
        mixed $value
    ): array {
        if (is_array($value)) {
            return $value;
        }

        if (
            ! is_string(
                $value
            )
            || trim(
                $value
            ) === ''
        ) {
            return [];
        }

        $decoded =
            json_decode(
                $value,
                true
            );

        return is_array(
            $decoded
        )
            ? $decoded
            : [];
    }
}
