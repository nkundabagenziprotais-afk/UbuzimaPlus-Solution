<?php

namespace App\Services\Inventory;

use App\Models\InventoryReceiptGuard;
use App\Models\Product;
use App\Models\StockBatch;
use App\Models\StockLocation;
use App\Models\StockMovement;
use App\Models\Tenant;
use App\Models\User;
use App\Services\Auth\UserAccessProfileService;
use App\Support\OperationalPermissionContract;
use Illuminate\Http\Exceptions\HttpResponseException;

final class MedicineReceiptDuplicateGuardService
{
    private const OPERATION_TYPE = 'medicine_receipt';

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
        Product $product,
        StockLocation $location,
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
         * Compatibility mode remains available until all receiving
         * screens send a client-generated key. Duplicate enforcement
         * becomes active whenever the payload or Idempotency-Key
         * request header supplies this value.
         */
        if ($idempotencyKey === '') {
            return null;
        }

        $candidate = $this->candidate(
            $product,
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
                'subject_type' => 'product',
                'subject_id' => $product->id,
                'location_type' =>
                    'stock_location',
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
                    . 'for different receipt information.',
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
            $movement = StockMovement::query()
                ->with([
                    'product:id,name,sku',
                    'stockBatch',
                    'stockLocation:id,name,code',
                    'performedBy:id,name,email',
                ])
                ->where('tenant_id', $tenant->id)
                ->find(
                    $guard->result_transaction_id
                );

            if ($movement) {
                $this->throwJson([
                    'message' =>
                        'This stock receipt was already recorded.',
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
                    'This stock receipt is already being processed.',
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
        Product $product,
        StockLocation $location,
        array $validated,
        ?User $user
    ): void {
        $candidate = $this->candidate(
            $product,
            $location,
            $validated
        );

        $this->evaluateOrFail(
            $guard,
            $tenant,
            $candidate,
            $validated,
            $user,
            true
        );
    }

    public function complete(
        InventoryReceiptGuard $guard,
        StockMovement $movement,
        StockBatch $batch
    ): InventoryReceiptGuard {
        return $this->detector->completeGuard(
            $guard,
            'stock_movement',
            $movement->id,
            [
                'stock_batch_id' => $batch->id,
                'stock_batch_uuid' => $batch->uuid,
                'batch_number' =>
                    $batch->batch_number,
                'movement_uuid' =>
                    $movement->uuid,
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
        $records = $this->recentCandidates(
            $tenant,
            $candidate,
            $lockRows
        );

        $evaluation =
            $this->detector->evaluateReceipt(
                $candidate,
                $records
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
        ] = 'stock_movement';

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
            $token =
                $this->detector->issueDuplicateToken(
                    $tenant->id,
                    self::OPERATION_TYPE,
                    $guard->request_hash,
                    'stock_movement',
                    (int) (
                        $evaluation[
                            'existing_record'
                        ]['id']
                        ?? 0
                    )
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
                    . 'a suspected duplicate stock receipt.',
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
        $query = StockMovement::query()
            ->with([
                'product:id,name,sku',
                'stockBatch',
                'stockLocation:id,name,code',
                'performedBy:id,name,email',
            ])
            ->where('tenant_id', $tenant->id)
            ->where(
                'product_id',
                $candidate['subject_id']
            )
            ->where(
                'stock_location_id',
                $candidate['location_id']
            )
            ->whereIn(
                'reference_type',
                [
                    'stock_receipt',
                    'pharmaco_purchase_order',
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
                    StockMovement $movement
                ): array =>
                    $this->existingRecord(
                        $movement
                    )
            )
            ->all();
    }

    private function candidate(
        Product $product,
        StockLocation $location,
        array $validated
    ): array {
        $purchaseOrderItemId =
            $validated[
                'pharmaco_purchase_order_item_id'
            ] ?? null;

        return [
            'subject_id' => $product->id,
            'location_id' => $location->id,
            'batch_number' =>
                $validated['batch_number'] ?? null,
            'quantity' =>
                $validated['quantity'] ?? null,
            'expiry_date' =>
                $validated['expiry_date'] ?? null,
            'unit_cost' =>
                $validated['unit_cost'] ?? null,
            'reference_number' =>
                $validated['reference_number']
                ?? null,
            'source_line_type' =>
                $purchaseOrderItemId
                    ? 'pharmaco_purchase_order_item'
                    : null,
            'source_line_id' =>
                $purchaseOrderItemId
                    ? (int) $purchaseOrderItemId
                    : null,
        ];
    }

    private function existingRecord(
        StockMovement $movement
    ): array {
        $metadata =
            is_array($movement->metadata)
                ? $movement->metadata
                : [];

        $batch = $movement->stockBatch;
        $user = $movement->performedBy;
        $product = $movement->product;
        $location = $movement->stockLocation;

        $purchaseOrderItemId =
            $metadata['purchase_order_item_id']
            ?? null;

        return [
            'id' => $movement->id,
            'uuid' => $movement->uuid,
            'subject_id' =>
                $movement->product_id,
            'location_id' =>
                $movement->stock_location_id,
            'product' => [
                'id' => $product?->id,
                'name' => $product?->name,
                'sku' => $product?->sku,
            ],
            'batch' => [
                'id' => $batch?->id,
                'uuid' => $batch?->uuid,
                'batch_number' =>
                    $batch?->batch_number,
                'expiry_date' =>
                    $batch?->expiry_date
                        ?->toDateString(),
                'supplier_name' =>
                    $batch?->supplier_name,
            ],
            'batch_number' =>
                $batch?->batch_number,
            'expiry_date' =>
                $batch?->expiry_date
                    ?->toDateString(),
            'quantity' =>
                (float) $movement->quantity,
            'unit_cost' =>
                $batch?->unit_cost !== null
                    ? (float) $batch->unit_cost
                    : null,
            'location' => [
                'id' => $location?->id,
                'name' => $location?->name,
                'code' => $location?->code,
            ],
            'reference_type' =>
                $movement->reference_type,
            'reference_number' =>
                $movement->reference_number,
            'source_line_type' =>
                $purchaseOrderItemId
                    ? 'pharmaco_purchase_order_item'
                    : null,
            'source_line_id' =>
                $purchaseOrderItemId
                    ? (int) $purchaseOrderItemId
                    : null,
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
        StockMovement $movement
    ): array {
        return [
            'id' => $movement->id,
            'uuid' => $movement->uuid,
            'movement_type' =>
                $movement->movement_type,
            'quantity' =>
                (float) $movement->quantity,
            'running_balance' =>
                $movement->running_balance !== null
                    ? (float)
                        $movement->running_balance
                    : null,
            'reference_type' =>
                $movement->reference_type,
            'reference_number' =>
                $movement->reference_number,
            'occurred_at' =>
                $movement->occurred_at
                    ?->toIso8601String(),
            'product' => $movement->product
                ? [
                    'id' =>
                        $movement->product->id,
                    'name' =>
                        $movement->product->name,
                    'sku' =>
                        $movement->product->sku,
                ]
                : null,
            'batch' => $movement->stockBatch
                ? [
                    'id' =>
                        $movement->stockBatch->id,
                    'uuid' =>
                        $movement->stockBatch->uuid,
                    'batch_number' =>
                        $movement->stockBatch
                            ->batch_number,
                ]
                : null,
            'location' => $movement->stockLocation
                ? [
                    'id' =>
                        $movement->stockLocation->id,
                    'name' =>
                        $movement->stockLocation->name,
                    'code' =>
                        $movement->stockLocation->code,
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
            'batch_number' =>
                $this->detector
                    ->normalizeBatchNumber(
                        $candidate['batch_number']
                    ),
            'quantity' =>
                $candidate['quantity'],
            'expiry_date' =>
                $candidate['expiry_date'],
            'unit_cost' =>
                $candidate['unit_cost'],
            'reference_number' =>
                $this->detector
                    ->normalizeReference(
                        $candidate[
                            'reference_number'
                        ]
                    ),
            'source_line_type' =>
                $candidate['source_line_type'],
            'source_line_id' =>
                $candidate['source_line_id'],
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
