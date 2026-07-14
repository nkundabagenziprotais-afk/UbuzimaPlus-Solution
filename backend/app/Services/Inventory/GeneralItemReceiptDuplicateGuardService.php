<?php

namespace App\Services\Inventory;

use App\Models\InventoryReceiptGuard;
use App\Models\PharmacoGeneralItem;
use App\Models\PharmacoGeneralItemLocation;
use App\Models\PharmacoGeneralItemMovement;
use App\Models\Tenant;
use App\Models\User;
use App\Services\Auth\UserAccessProfileService;
use App\Support\OperationalPermissionContract;
use Illuminate\Http\Exceptions\HttpResponseException;

final class GeneralItemReceiptDuplicateGuardService
{
    private const OPERATION_TYPE =
        'general_item_receipt';

    private const OVERRIDE_PERMISSION =
        'pharmaco.inventory.duplicate_override';

    public function __construct(
        private readonly
            InventoryDuplicateDetectionService $detector,
        private readonly
            UserAccessProfileService $profiles
    ) {
    }

    public function begin(
        Tenant $tenant,
        PharmacoGeneralItem $item,
        PharmacoGeneralItemLocation $location,
        array $validated,
        ?User $user
    ): ?InventoryReceiptGuard {
        $idempotencyKey = trim(
            (string) (
                $validated['idempotency_key']
                ?? ''
            )
        );

        /*
         * Existing clients remain compatible while the frontend
         * confirmation flow is being introduced. Protection becomes
         * active whenever an idempotency key is supplied.
         */
        if ($idempotencyKey === '') {
            return null;
        }

        $candidate = $this->candidate(
            $item,
            $location,
            $validated
        );

        $requestHash =
            $this->detector->requestHash(
                $this->hashablePayload(
                    $tenant,
                    $candidate
                )
            );

        $reservation =
            $this->detector->reserveGuard([
                'tenant_id' => $tenant->id,
                'branch_id' => $location->branch_id,
                'operation_type' =>
                    self::OPERATION_TYPE,
                'subject_type' =>
                    'pharmaco_general_item',
                'subject_id' => $item->id,
                'location_type' =>
                    'pharmaco_general_item_location',
                'location_id' => $location->id,
                'source_line_type' =>
                    $candidate['source_line_type'],
                'source_line_id' =>
                    $candidate['source_line_id'],
                'idempotency_key' =>
                    $idempotencyKey,
                'request_hash' => $requestHash,
                'metadata' => [
                    'candidate' => $candidate,
                    'created_by' => $user?->id,
                ],
            ]);

        /** @var InventoryReceiptGuard $guard */
        $guard = $reservation['guard'];

        if ($reservation['payload_mismatch']) {
            $this->throwJson([
                'message' =>
                    'This idempotency key was already used '
                    . 'for different General Item receipt information.',
                'code' =>
                    'IDEMPOTENCY_KEY_REUSED',
                'existing_guard_id' => $guard->id,
            ], 409);
        }

        if (
            $reservation['replayed']
            && $guard->status
                === InventoryDuplicateDetectionService::
                    STATUS_COMPLETED
            && $guard->result_transaction_id
        ) {
            $movement =
                PharmacoGeneralItemMovement::query()
                    ->with([
                        'item:id,name,code,unit_of_measure',
                        'location:id,name,code',
                        'performedBy:id,name,email',
                    ])
                    ->where(
                        'tenant_id',
                        $tenant->id
                    )
                    ->find(
                        $guard->result_transaction_id
                    );

            if ($movement) {
                $this->throwJson([
                    'message' =>
                        'This General Item receipt was already recorded.',
                    'code' => 'IDEMPOTENT_REPLAY',
                    'replayed' => true,
                    'movement' =>
                        $this->serializeMovement(
                            $movement
                        ),
                ], 200);
            }
        }

        if (
            $reservation['replayed']
            && $guard->status
                === InventoryDuplicateDetectionService::
                    STATUS_RESERVED
            && $guard->created_at
            && $guard->created_at
                ->greaterThan(now()->subSeconds(5))
        ) {
            $this->throwJson([
                'message' =>
                    'This General Item receipt is already being processed.',
                'code' => 'RECEIPT_IN_PROGRESS',
                'existing_guard_id' => $guard->id,
            ], 409);
        }

        $this->evaluateOrFail(
            $guard,
            $tenant,
            $candidate,
            $validated,
            $user,
            false
        );

        return $guard->refresh();
    }

    public function revalidateOrFail(
        InventoryReceiptGuard $guard,
        Tenant $tenant,
        PharmacoGeneralItem $item,
        PharmacoGeneralItemLocation $location,
        array $validated,
        ?User $user
    ): void {
        $this->evaluateOrFail(
            $guard,
            $tenant,
            $this->candidate(
                $item,
                $location,
                $validated
            ),
            $validated,
            $user,
            true
        );
    }

    public function complete(
        InventoryReceiptGuard $guard,
        PharmacoGeneralItemMovement $movement
    ): InventoryReceiptGuard {
        return $this->detector->completeGuard(
            $guard,
            'pharmaco_general_item_movement',
            $movement->id,
            [
                'movement_uuid' =>
                    $movement->uuid,
                'general_item_id' =>
                    $movement
                        ->pharmaco_general_item_id,
                'general_item_location_id' =>
                    $movement
                        ->pharmaco_general_item_location_id,
            ]
        );
    }

    private function evaluateOrFail(
        InventoryReceiptGuard $guard,
        Tenant $tenant,
        array $candidate,
        array $validated,
        ?User $user,
        bool $lockRows
    ): void {
        $evaluation =
            $this->detector->evaluateReceipt(
                $candidate,
                $this->recentCandidates(
                    $tenant,
                    $candidate,
                    $lockRows
                )
            );

        if (
            $evaluation['classification']
            === InventoryDuplicateDetectionService::
                CLASSIFICATION_NONE
        ) {
            return;
        }

        $evaluation[
            'matched_transaction_type'
        ] = 'pharmaco_general_item_movement';

        $overrideAllowed =
            $this->canOverride($user);

        if (
            $evaluation['classification']
            === InventoryDuplicateDetectionService::
                CLASSIFICATION_EXACT
        ) {
            $this->detector->recordConflict(
                $guard,
                $evaluation
            );

            $this->throwJson(
                $this->detector->conflictPayload(
                    $evaluation,
                    false
                ),
                409
            );
        }

        if (
            $guard->override_user_id
            && trim(
                (string) $guard->override_reason
            ) !== ''
        ) {
            return;
        }

        $overrideRequested =
            (bool) (
                $validated['duplicate_override']
                ?? false
            );

        if (! $overrideRequested) {
            $existingId = (int) (
                $evaluation[
                    'existing_record'
                ]['id']
                ?? 0
            );

            $token =
                $this->detector->issueDuplicateToken(
                    $tenant->id,
                    self::OPERATION_TYPE,
                    $guard->request_hash,
                    'pharmaco_general_item_movement',
                    $existingId
                );

            $this->detector->recordConflict(
                $guard,
                $evaluation,
                $token
            );

            $this->throwJson(
                $this->detector->conflictPayload(
                    $evaluation,
                    $overrideAllowed,
                    $token
                ),
                409
            );
        }

        if (! $overrideAllowed) {
            $this->throwJson([
                'message' =>
                    'You do not have permission to override '
                    . 'a suspected duplicate General Item receipt.',
                'code' =>
                    'DUPLICATE_OVERRIDE_FORBIDDEN',
            ], 403);
        }

        $reason = trim(
            (string) (
                $validated[
                    'duplicate_override_reason'
                ] ?? ''
            )
        );

        if ($reason === '') {
            $this->throwJson([
                'message' =>
                    'An override reason is required.',
                'code' =>
                    'DUPLICATE_OVERRIDE_REASON_REQUIRED',
                'errors' => [
                    'duplicate_override_reason' => [
                        'Explain why this receipt is legitimate.',
                    ],
                ],
            ], 422);
        }

        $token = trim(
            (string) (
                $validated[
                    'duplicate_check_token'
                ] ?? ''
            )
        );

        if (
            $token === ''
            || ! $this->detector
                ->verifyDuplicateToken(
                    $token,
                    $tenant->id,
                    self::OPERATION_TYPE,
                    $guard->request_hash
                )
        ) {
            $this->throwJson([
                'message' =>
                    'The duplicate confirmation token is '
                    . 'invalid or has expired.',
                'code' =>
                    'INVALID_DUPLICATE_CHECK_TOKEN',
                'errors' => [
                    'duplicate_check_token' => [
                        'Refresh the duplicate check and try again.',
                    ],
                ],
            ], 422);
        }

        $this->detector->recordOverride(
            $guard,
            (int) $user->id,
            $reason
        );
    }

    private function recentCandidates(
        Tenant $tenant,
        array $candidate,
        bool $lockRows
    ): array {
        $query =
            PharmacoGeneralItemMovement::query()
                ->with([
                    'item:id,name,code,unit_of_measure',
                    'location:id,name,code',
                    'performedBy:id,name,email',
                ])
                ->where(
                    'tenant_id',
                    $tenant->id
                )
                ->where(
                    'pharmaco_general_item_id',
                    $candidate['subject_id']
                )
                ->where(
                    'pharmaco_general_item_location_id',
                    $candidate['location_id']
                )
                /*
                 * TENANT_GENERAL_ITEM_RECEIPT_COMPATIBILITY_20260714
                 *
                 * The production endpoint writes "received" while
                 * the tenant operational endpoint writes "receipt".
                 * Both represent positive General Item receipts and
                 * must participate in the same duplicate check.
                 */
                ->whereIn(
                    'movement_type',
                    [
                        'received',
                        'receipt',
                    ]
                )
                ->where('quantity', '>', 0)
                ->where(
                    'occurred_at',
                    '>=',
                    now()->subHours(
                        InventoryDuplicateDetectionService::
                            DEFAULT_RISK_WINDOW_HOURS
                    )
                )
                ->latest('occurred_at')
                ->limit(25);

        if ($lockRows) {
            $query->lockForUpdate();
        }

        return $query
            ->get()
            ->map(
                fn (
                    PharmacoGeneralItemMovement $movement
                ): array =>
                    $this->existingRecord(
                        $movement
                    )
            )
            ->all();
    }

    private function candidate(
        PharmacoGeneralItem $item,
        PharmacoGeneralItemLocation $location,
        array $validated
    ): array {
        return [
            'subject_id' => $item->id,
            'location_id' => $location->id,
            'quantity' =>
                $validated['quantity'] ?? null,
            'unit_cost' =>
                $validated['unit_cost'] ?? null,
            'reference_type' =>
                $validated['reference_type']
                ?? (
                    array_key_exists(
                        'reference',
                        $validated
                    )
                        ? 'tenant_operational'
                        : 'manual'
                ),
            'reference_number' =>
                $validated['reference_number']
                ?? $validated['reference']
                ?? null,
            'source_line_type' => null,
            'source_line_id' => null,
        ];
    }

    private function existingRecord(
        PharmacoGeneralItemMovement $movement
    ): array {
        $item = $movement->item;
        $location = $movement->location;
        $user = $movement->performedBy;

        return [
            'id' => $movement->id,
            'uuid' => $movement->uuid,
            'subject_id' =>
                $movement
                    ->pharmaco_general_item_id,
            'location_id' =>
                $movement
                    ->pharmaco_general_item_location_id,
            'item' => [
                'id' => $item?->id,
                'name' => $item?->name,
                'code' => $item?->code,
                'unit_of_measure' =>
                    $item?->unit_of_measure,
            ],
            'quantity' =>
                (float) $movement->quantity,
            'unit_cost' =>
                (float) $movement->unit_cost,
            'location' => [
                'id' => $location?->id,
                'name' => $location?->name,
                'code' => $location?->code,
            ],
            'reference_type' =>
                $movement->reference_type,
            'reference_number' =>
                $movement->reference_number,
            'recorded_at' =>
                $movement->occurred_at
                    ?->toIso8601String(),
            'occurred_at' =>
                $movement->occurred_at,
            'recorded_user' => $user
                ? [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                ]
                : null,
        ];
    }

    private function serializeMovement(
        PharmacoGeneralItemMovement $movement
    ): array {
        return [
            'id' => $movement->id,
            'uuid' => $movement->uuid,
            'movement_type' =>
                $movement->movement_type,
            'quantity' =>
                (float) $movement->quantity,
            'unit_cost' =>
                (float) $movement->unit_cost,
            'total_value' =>
                (float) $movement->total_value,
            'running_balance' =>
                (float) $movement->running_balance,
            'reference_type' =>
                $movement->reference_type,
            'reference_number' =>
                $movement->reference_number,
            'occurred_at' =>
                $movement->occurred_at
                    ?->toIso8601String(),
            'item' => $movement->item
                ? [
                    'id' => $movement->item->id,
                    'name' =>
                        $movement->item->name,
                    'code' =>
                        $movement->item->code,
                    'unit_of_measure' =>
                        $movement->item
                            ->unit_of_measure,
                ]
                : null,
            'location' => $movement->location
                ? [
                    'id' =>
                        $movement->location->id,
                    'name' =>
                        $movement->location->name,
                    'code' =>
                        $movement->location->code,
                ]
                : null,
            'recorded_user' =>
                $movement->performedBy
                    ? [
                        'id' =>
                            $movement->performedBy->id,
                        'name' =>
                            $movement->performedBy
                                ->name,
                        'email' =>
                            $movement->performedBy
                                ->email,
                    ]
                    : null,
        ];
    }

    private function hashablePayload(
        Tenant $tenant,
        array $candidate
    ): array {
        return [
            'tenant_id' => $tenant->id,
            'operation_type' =>
                self::OPERATION_TYPE,
            'subject_id' =>
                $candidate['subject_id'],
            'location_id' =>
                $candidate['location_id'],
            'quantity' =>
                $candidate['quantity'],
            'unit_cost' =>
                $candidate['unit_cost'],
            'reference_type' =>
                $candidate['reference_type'],
            'reference_number' =>
                $this->detector
                    ->normalizeReference(
                        $candidate[
                            'reference_number'
                        ]
                    ),
        ];
    }

    private function canOverride(
        ?User $user
    ): bool {
        if (! $user) {
            return false;
        }

        $permissions =
            OperationalPermissionContract::expand(
                $this->profiles
                    ->permissionCodes($user)
            );

        return in_array(
            self::OVERRIDE_PERMISSION,
            $permissions,
            true
        );
    }

    private function throwJson(
        array $payload,
        int $status
    ): never {
        throw new HttpResponseException(
            response()->json(
                $payload,
                $status
            )
        );
    }
}
