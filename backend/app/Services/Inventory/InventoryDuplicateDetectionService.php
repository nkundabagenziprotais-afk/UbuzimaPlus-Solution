<?php

namespace App\Services\Inventory;

use App\Models\InventoryReceiptGuard;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;

final class InventoryDuplicateDetectionService
{
    public const CLASSIFICATION_NONE = 'none';

    public const CLASSIFICATION_EXACT = 'exact';

    public const CLASSIFICATION_SUSPECTED = 'suspected';

    public const STATUS_RESERVED = 'reserved';

    public const STATUS_CONFLICT = 'conflict';

    public const STATUS_CANCELLED = 'cancelled';

    public const STATUS_COMPLETED = 'completed';

    public const DEFAULT_RISK_WINDOW_HOURS = 24;

    public function normalizeBatchNumber(
        ?string $value
    ): ?string {
        return $this->normalizeIdentity($value);
    }

    public function normalizeReference(
        ?string $value
    ): ?string {
        return $this->normalizeIdentity($value);
    }

    public function requestHash(array $payload): string
    {
        return hash(
            'sha256',
            json_encode(
                $this->canonicalize($payload),
                JSON_THROW_ON_ERROR
                | JSON_UNESCAPED_SLASHES
                | JSON_UNESCAPED_UNICODE
            )
        );
    }

    /**
     * @param iterable<int, array<string, mixed>|object> $existingRecords
     * @return array{
     *     classification: string,
     *     confidence_score: float,
     *     match_reasons: list<string>,
     *     existing_record: array<string, mixed>|null
     * }
     */
    public function evaluateReceipt(
        array $candidate,
        iterable $existingRecords,
        int $riskWindowHours =
            self::DEFAULT_RISK_WINDOW_HOURS
    ): array {
        $best = [
            'classification' =>
                self::CLASSIFICATION_NONE,
            'confidence_score' => 0.0,
            'match_reasons' => [],
            'existing_record' => null,
        ];

        foreach ($existingRecords as $record) {
            $existing = $this->recordToArray($record);

            $evaluation = $this->evaluatePair(
                $candidate,
                $existing,
                $riskWindowHours
            );

            if (
                $evaluation['classification']
                === self::CLASSIFICATION_EXACT
            ) {
                return $evaluation;
            }

            if (
                $evaluation['confidence_score']
                > $best['confidence_score']
            ) {
                $best = $evaluation;
            }
        }

        return $best;
    }

    /**
     * @return array{
     *     guard: InventoryReceiptGuard,
     *     replayed: bool,
     *     payload_mismatch: bool
     * }
     */
    public function reserveGuard(array $context): array
    {
        $required = [
            'tenant_id',
            'operation_type',
            'subject_type',
            'subject_id',
            'location_type',
            'location_id',
            'idempotency_key',
            'request_hash',
        ];

        foreach ($required as $field) {
            if (
                ! array_key_exists($field, $context)
                || $context[$field] === null
                || $context[$field] === ''
            ) {
                throw new RuntimeException(
                    "Missing receipt guard field: {$field}"
                );
            }
        }

        return DB::transaction(
            function () use ($context): array {
                $existing =
                    InventoryReceiptGuard::query()
                        ->where(
                            'tenant_id',
                            $context['tenant_id']
                        )
                        ->where(
                            'operation_type',
                            $context['operation_type']
                        )
                        ->where(
                            'idempotency_key',
                            $context['idempotency_key']
                        )
                        ->lockForUpdate()
                        ->first();

                if ($existing) {
                    return [
                        'guard' => $existing,
                        'replayed' => true,
                        'payload_mismatch' =>
                            ! hash_equals(
                                $existing->request_hash,
                                (string)
                                    $context['request_hash']
                            ),
                    ];
                }

                $guard =
                    InventoryReceiptGuard::query()
                        ->create([
                            'uuid' => (string) Str::uuid(),
                            'tenant_id' =>
                                $context['tenant_id'],
                            'branch_id' =>
                                $context['branch_id']
                                ?? null,
                            'operation_type' =>
                                $context['operation_type'],
                            'subject_type' =>
                                $context['subject_type'],
                            'subject_id' =>
                                $context['subject_id'],
                            'location_type' =>
                                $context['location_type'],
                            'location_id' =>
                                $context['location_id'],
                            'source_line_type' =>
                                $context[
                                    'source_line_type'
                                ] ?? null,
                            'source_line_id' =>
                                $context[
                                    'source_line_id'
                                ] ?? null,
                            'idempotency_key' =>
                                $context['idempotency_key'],
                            'request_hash' =>
                                $context['request_hash'],
                            'status' =>
                                self::STATUS_RESERVED,
                            'duplicate_classification' =>
                                self::CLASSIFICATION_NONE,
                            'metadata' =>
                                $context['metadata'] ?? [],
                        ]);

                return [
                    'guard' => $guard,
                    'replayed' => false,
                    'payload_mismatch' => false,
                ];
            }
        );
    }

    public function recordConflict(
        InventoryReceiptGuard $guard,
        array $evaluation,
        ?string $plainDuplicateToken = null
    ): InventoryReceiptGuard {
        $guard->forceFill([
            'status' => self::STATUS_CONFLICT,
            'duplicate_classification' =>
                $evaluation['classification']
                ?? self::CLASSIFICATION_SUSPECTED,
            'matched_transaction_type' =>
                $evaluation['matched_transaction_type']
                ?? null,
            'matched_transaction_id' =>
                $evaluation['matched_transaction_id']
                ?? (
                    $evaluation['existing_record']['id']
                    ?? null
                ),
            'confidence_score' =>
                $evaluation['confidence_score'] ?? null,
            'match_reasons' =>
                $evaluation['match_reasons'] ?? [],
            'duplicate_token_hash' =>
                $plainDuplicateToken
                    ? hash(
                        'sha256',
                        $plainDuplicateToken
                    )
                    : null,
            'metadata' => array_merge(
                $guard->metadata ?? [],
                [
                    'existing_record' =>
                        $evaluation['existing_record']
                        ?? null,
                ]
            ),
        ])->save();

        return $guard->refresh();
    }

    public function recordOverride(
        InventoryReceiptGuard $guard,
        int $userId,
        string $reason
    ): InventoryReceiptGuard {
        $normalizedReason = trim($reason);

        if ($normalizedReason === '') {
            throw new RuntimeException(
                'A duplicate override reason is required.'
            );
        }

        $guard->forceFill([
            'override_user_id' => $userId,
            'override_reason' => $normalizedReason,
        ])->save();

        return $guard->refresh();
    }

    public function completeGuard(
        InventoryReceiptGuard $guard,
        string $transactionType,
        int $transactionId,
        array $metadata = []
    ): InventoryReceiptGuard {
        $guard->forceFill([
            'status' => self::STATUS_COMPLETED,
            'result_transaction_type' =>
                $transactionType,
            'result_transaction_id' =>
                $transactionId,
            'completed_at' => now(),
            'metadata' => array_merge(
                $guard->metadata ?? [],
                $metadata
            ),
        ])->save();

        return $guard->refresh();
    }

    public function cancelGuard(
        InventoryReceiptGuard $guard
    ): InventoryReceiptGuard {
        $guard->forceFill([
            'status' => self::STATUS_CANCELLED,
            'completed_at' => now(),
        ])->save();

        return $guard->refresh();
    }

    public function issueDuplicateToken(
        int $tenantId,
        string $operationType,
        string $requestHash,
        string $matchedTransactionType,
        int $matchedTransactionId,
        ?CarbonInterface $expiresAt = null
    ): string {
        $expiry = CarbonImmutable::instance(
            $expiresAt ?? now()->addMinutes(15)
        );

        $payload = [
            'tenant_id' => $tenantId,
            'operation_type' => $operationType,
            'request_hash' => $requestHash,
            'matched_transaction_type' =>
                $matchedTransactionType,
            'matched_transaction_id' =>
                $matchedTransactionId,
            'expires_at' => $expiry->getTimestamp(),
        ];

        $encoded = $this->base64UrlEncode(
            json_encode(
                $payload,
                JSON_THROW_ON_ERROR
                | JSON_UNESCAPED_SLASHES
            )
        );

        $signature = hash_hmac(
            'sha256',
            $encoded,
            $this->signingKey()
        );

        return "{$encoded}.{$signature}";
    }

    public function verifyDuplicateToken(
        string $token,
        int $tenantId,
        string $operationType,
        string $requestHash
    ): bool {
        $parts = explode('.', $token, 2);

        if (count($parts) !== 2) {
            return false;
        }

        [$encoded, $providedSignature] = $parts;

        $expectedSignature = hash_hmac(
            'sha256',
            $encoded,
            $this->signingKey()
        );

        if (
            ! hash_equals(
                $expectedSignature,
                $providedSignature
            )
        ) {
            return false;
        }

        try {
            $payload = json_decode(
                $this->base64UrlDecode($encoded),
                true,
                flags: JSON_THROW_ON_ERROR
            );
        } catch (\Throwable) {
            return false;
        }

        return
            (int) ($payload['tenant_id'] ?? 0)
                === $tenantId
            && (string) (
                $payload['operation_type'] ?? ''
            ) === $operationType
            && hash_equals(
                (string) (
                    $payload['request_hash'] ?? ''
                ),
                $requestHash
            )
            && (int) (
                $payload['expires_at'] ?? 0
            ) >= now()->getTimestamp();
    }

    public function conflictPayload(
        array $evaluation,
        bool $overrideAllowed,
        ?string $duplicateToken = null
    ): array {
        $classification =
            $evaluation['classification']
            ?? self::CLASSIFICATION_SUSPECTED;

        $exact =
            $classification
            === self::CLASSIFICATION_EXACT;

        return [
            'message' => $exact
                ? 'This stock transaction has already been recorded.'
                : 'A similar stock transaction already exists. Review it before recording another receipt.',
            'code' => $exact
                ? 'EXACT_DUPLICATE'
                : 'SUSPECTED_DUPLICATE',
            'duplicate' => [
                'classification' => $classification,
                'confidence_score' =>
                    (float) (
                        $evaluation[
                            'confidence_score'
                        ] ?? 0
                    ),
                'match_reasons' =>
                    $evaluation['match_reasons'] ?? [],
                'existing_record' =>
                    $evaluation['existing_record']
                    ?? null,
                'override_allowed' =>
                    ! $exact && $overrideAllowed,
                'duplicate_check_token' =>
                    ! $exact && $overrideAllowed
                        ? $duplicateToken
                        : null,
            ],
        ];
    }

    private function evaluatePair(
        array $candidate,
        array $existing,
        int $riskWindowHours
    ): array {
        $reasons = [];
        $score = 0.0;

        $sameSubject =
            (string) ($candidate['subject_id'] ?? '')
            !== ''
            && (string) ($candidate['subject_id'] ?? '')
                === (string) (
                    $existing['subject_id'] ?? ''
                );

        $sameLocation =
            (string) ($candidate['location_id'] ?? '')
            !== ''
            && (string) ($candidate['location_id'] ?? '')
                === (string) (
                    $existing['location_id'] ?? ''
                );

        if ($sameSubject) {
            $score += 30;
            $reasons[] =
                'Same product or general-item identity';
        }

        if ($sameLocation) {
            $score += 20;
            $reasons[] = 'Same stock location';
        }

        $candidateBatch = $this->normalizeBatchNumber(
            $candidate['batch_number'] ?? null
        );

        $existingBatch = $this->normalizeBatchNumber(
            $existing['batch_number'] ?? null
        );

        $batchRequired = $candidateBatch !== null;

        $sameBatch =
            $batchRequired
            && $existingBatch !== null
            && hash_equals(
                $candidateBatch,
                $existingBatch
            );

        if ($sameBatch) {
            $score += 25;
            $reasons[] = 'Same normalized batch number';
        }

        $sameQuantity =
            $this->sameDecimal(
                $candidate['quantity'] ?? null,
                $existing['quantity'] ?? null
            );

        if ($sameQuantity) {
            $score += 10;
            $reasons[] = 'Same received quantity';
        }

        $candidateReference =
            $this->normalizeReference(
                $candidate['reference_number']
                ?? null
            );

        $existingReference =
            $this->normalizeReference(
                $existing['reference_number']
                ?? null
            );

        $sameReference =
            $candidateReference !== null
            && $existingReference !== null
            && hash_equals(
                $candidateReference,
                $existingReference
            );

        if ($sameReference) {
            $score += 10;
            $reasons[] =
                'Same supplier or delivery reference';
        }

        $sameExpiry =
            $this->sameDate(
                $candidate['expiry_date'] ?? null,
                $existing['expiry_date'] ?? null
            );

        if ($sameExpiry) {
            $score += 5;
            $reasons[] = 'Same expiry date';
        }

        $sameUnitCost =
            $this->sameDecimal(
                $candidate['unit_cost'] ?? null,
                $existing['unit_cost'] ?? null
            );

        if ($sameUnitCost) {
            $score += 5;
            $reasons[] = 'Same unit cost';
        }

        $recent = $this->withinRiskWindow(
            $existing['occurred_at']
                ?? $existing['created_at']
                ?? null,
            $riskWindowHours
        );

        if ($recent) {
            $score += 10;
            $reasons[] =
                "Recorded within {$riskWindowHours} hours";
        }

        $sameSourceLine =
            $this->sameSourceLine(
                $candidate,
                $existing
            );

        if ($sameSourceLine) {
            $reasons[] =
                'Same purchase-order or source-document line';
        }

        $strongIdentity =
            $sameSubject
            && $sameLocation
            && (
                ! $batchRequired
                || $sameBatch
            );

        $exact =
            $strongIdentity
            && (
                (
                    $sameSourceLine
                    && $sameQuantity
                )
                || (
                    $sameReference
                    && $sameQuantity
                    && $recent
                )
            );

        $classification =
            $exact
                ? self::CLASSIFICATION_EXACT
                : (
                    $strongIdentity
                    && $score >= 70
                        ? self::CLASSIFICATION_SUSPECTED
                        : self::CLASSIFICATION_NONE
                );

        return [
            'classification' => $classification,
            'confidence_score' =>
                min(100.0, round($score, 2)),
            'match_reasons' => $reasons,
            'existing_record' =>
                $classification
                    !== self::CLASSIFICATION_NONE
                        ? $existing
                        : null,
        ];
    }

    private function sameSourceLine(
        array $candidate,
        array $existing
    ): bool {
        $candidateType = $this->normalizeReference(
            $candidate['source_line_type'] ?? null
        );

        $existingType = $this->normalizeReference(
            $existing['source_line_type'] ?? null
        );

        $candidateId =
            $candidate['source_line_id'] ?? null;

        $existingId =
            $existing['source_line_id'] ?? null;

        return
            $candidateType !== null
            && $existingType !== null
            && hash_equals(
                $candidateType,
                $existingType
            )
            && $candidateId !== null
            && $existingId !== null
            && (string) $candidateId
                === (string) $existingId;
    }

    private function sameDecimal(
        mixed $left,
        mixed $right
    ): bool {
        if (
            $left === null
            || $left === ''
            || $right === null
            || $right === ''
            || ! is_numeric($left)
            || ! is_numeric($right)
        ) {
            return false;
        }

        return abs(
            (float) $left - (float) $right
        ) < 0.0001;
    }

    private function sameDate(
        mixed $left,
        mixed $right
    ): bool {
        if (! $left || ! $right) {
            return false;
        }

        try {
            return CarbonImmutable::parse($left)
                ->toDateString()
                === CarbonImmutable::parse($right)
                    ->toDateString();
        } catch (\Throwable) {
            return false;
        }
    }

    private function withinRiskWindow(
        mixed $date,
        int $hours
    ): bool {
        if (! $date) {
            return false;
        }

        try {
            return CarbonImmutable::parse($date)
                ->greaterThanOrEqualTo(
                    now()->subHours($hours)
                );
        } catch (\Throwable) {
            return false;
        }
    }

    private function normalizeIdentity(
        ?string $value
    ): ?string {
        if ($value === null) {
            return null;
        }

        $normalized = Str::of($value)
            ->trim()
            ->upper()
            ->replaceMatches(
                '/[\s\-_\/\\\\]+/',
                ''
            )
            ->toString();

        return $normalized !== ''
            ? $normalized
            : null;
    }

    private function canonicalize(
        mixed $value
    ): mixed {
        if (! is_array($value)) {
            return is_string($value)
                ? trim($value)
                : $value;
        }

        if (array_is_list($value)) {
            return array_map(
                fn (mixed $item): mixed =>
                    $this->canonicalize($item),
                $value
            );
        }

        ksort($value);

        foreach ($value as $key => $item) {
            $value[$key] =
                $this->canonicalize($item);
        }

        return $value;
    }

    private function recordToArray(
        array|object $record
    ): array {
        if (is_array($record)) {
            return $record;
        }

        if (method_exists($record, 'toArray')) {
            return $record->toArray();
        }

        return get_object_vars($record);
    }

    private function signingKey(): string
    {
        $key = (string) config('app.key');

        if ($key === '') {
            throw new RuntimeException(
                'APP_KEY is required for duplicate-check tokens.'
            );
        }

        if (str_starts_with($key, 'base64:')) {
            $decoded = base64_decode(
                substr($key, 7),
                true
            );

            if ($decoded !== false) {
                return $decoded;
            }
        }

        return $key;
    }

    private function base64UrlEncode(
        string $value
    ): string {
        return rtrim(
            strtr(
                base64_encode($value),
                '+/',
                '-_'
            ),
            '='
        );
    }

    private function base64UrlDecode(
        string $value
    ): string {
        $remainder = strlen($value) % 4;

        if ($remainder !== 0) {
            $value .= str_repeat(
                '=',
                4 - $remainder
            );
        }

        $decoded = base64_decode(
            strtr($value, '-_', '+/'),
            true
        );

        if ($decoded === false) {
            throw new RuntimeException(
                'Invalid duplicate-check token encoding.'
            );
        }

        return $decoded;
    }
}
