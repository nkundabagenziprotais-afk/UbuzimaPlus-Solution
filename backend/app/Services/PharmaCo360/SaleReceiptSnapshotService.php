<?php

namespace App\Services\PharmaCo360;

use App\Models\PharmacoSale;
use App\Models\PharmacoSaleReceiptSnapshot;
use Illuminate\Database\QueryException;
use Illuminate\Support\Str;
use RuntimeException;

final class SaleReceiptSnapshotService
{
    public const AUTHORITY =
        'pharmaco_sale_receipt_snapshots';

    public const VERSION =
        'R101R1_V1';

    public function __construct(
        private readonly
        SaleInvoicePayloadService $invoiceService
    ) {
    }

    /**
     * Read one immutable snapshot for one persisted sale.
     *
     * No catalogue reconstruction.
     * No confirmed-cart state.
     * No browser state.
     *
     * @return array<string, mixed>|null
     */
    public function find(
        PharmacoSale $sale
    ): ?array {
        $snapshot =
            PharmacoSaleReceiptSnapshot::query()
                ->where(
                    'tenant_id',
                    (int) $sale->tenant_id
                )
                ->where(
                    'pharmaco_sale_id',
                    (int) $sale->getKey()
                )
                ->first();

        if (! $snapshot) {
            return null;
        }

        return $this->payloadFromSnapshot(
            $snapshot
        );
    }

    /**
     * Create exactly one canonical immutable transaction document.
     *
     * AtomicPosCheckoutService calls this BEFORE the outer
     * checkout transaction commits.
     *
     * @return array<string, mixed>
     */
    public function createOrGet(
        PharmacoSale $sale
    ): array {
        $existing =
            PharmacoSaleReceiptSnapshot::query()
                ->where(
                    'tenant_id',
                    (int) $sale->tenant_id
                )
                ->where(
                    'pharmaco_sale_id',
                    (int) $sale->getKey()
                )
                ->first();

        if ($existing) {
            return $this->payloadFromSnapshot(
                $existing
            );
        }

        /*
         * Already-loaded checkout relations are reused.
         * Missing persisted relations are fetched only once here.
         */
        $sale->loadMissing([
            'tenant',
            'branch',
            'customer',
            'prescription',
            'posSession',
            'items.product.category',
            'items.stockBatch',
            'items.stockLocation',
            'payments',
        ]);

        /*
         * Existing SaleInvoicePayloadService already defines the
         * canonical persisted-sale business projection.
         */
        $invoice =
            $this->invoiceService->build(
                sale: $sale,
                reprint: false
            );

        $transactionSetup =
            $this->transactionSetup(
                $sale,
                $invoice
            );

        /*
         * R101R1 adds authority metadata and the complete
         * Transaction Set-Up to the same immutable document.
         */
        $payload = [
            ...$invoice,

            'receipt_snapshot_authority' =>
                self::AUTHORITY,

            'receipt_snapshot_version' =>
                self::VERSION,

            'transaction_setup' =>
                $transactionSetup,
        ];

        $payloadHash =
            $this->payloadHash(
                $payload
            );

        $attributes = [
            'uuid' =>
                (string) Str::uuid(),

            'tenant_id' =>
                (int) $sale->tenant_id,

            'branch_id' =>
                $this->integerOrNull(
                    $sale->getAttribute(
                        'branch_id'
                    )
                ),

            'pharmaco_sale_id' =>
                (int) $sale->getKey(),

            'sale_number' =>
                $this->textOrNull(
                    $invoice[
                        'invoice_number'
                    ] ?? null
                ),

            'receipt_number' =>
                $this->textOrNull(
                    data_get(
                        $invoice,
                        'receipt_number'
                    )
                    ??
                    data_get(
                        $invoice,
                        'payments.0.receipt_number'
                    )
                ),

            'sale_reference' =>
                $this->textOrNull(
                    $invoice[
                        'sale_reference'
                    ] ?? null
                ),

            'customer_name' =>
                $this->textOrNull(
                    data_get(
                        $invoice,
                        'sales_register.customer_name'
                    )
                ),

            'customer_phone' =>
                $this->textOrNull(
                    data_get(
                        $invoice,
                        'sales_register.customer_phone'
                    )
                ),

            'customer_tin' =>
                $this->textOrNull(
                    data_get(
                        $invoice,
                        'sales_register.customer_tin'
                    )
                ),

            'insurance_name' =>
                $this->textOrNull(
                    data_get(
                        $invoice,
                        'sales_register.insurance_name'
                    )
                    ??
                    data_get(
                        $invoice,
                        'insurance.name'
                    )
                    ??
                    data_get(
                        $invoice,
                        'insurance.partner_name'
                    )
                ),

            'cashier_user_id' =>
                $this->integerOrNull(
                    data_get(
                        $invoice,
                        'cashier.user_id'
                    )
                ),

            'pos_session_id' =>
                $this->integerOrNull(
                    data_get(
                        $invoice,
                        'pos_session.id'
                    )
                    ??
                    $sale->getAttribute(
                        'pos_session_id'
                    )
                ),

            'business_date' =>
                $sale->getAttribute(
                    'business_date'
                ),

            'sold_at' =>
                $sale->getAttribute(
                    'sold_at'
                ),

            'subtotal_amount' =>
                $this->numberOrNull(
                    data_get(
                        $invoice,
                        'totals.subtotal_amount'
                    )
                    ??
                    data_get(
                        $invoice,
                        'subtotal_amount'
                    )
                ),

            'discount_amount' =>
                $this->numberOrNull(
                    data_get(
                        $invoice,
                        'totals.discount_amount'
                    )
                    ??
                    data_get(
                        $invoice,
                        'discount_amount'
                    )
                ),

            'tax_amount' =>
                $this->numberOrNull(
                    data_get(
                        $invoice,
                        'totals.tax_amount'
                    )
                    ??
                    data_get(
                        $invoice,
                        'tax_amount'
                    )
                ),

            'total_amount' =>
                $this->numberOrNull(
                    data_get(
                        $invoice,
                        'totals.total_amount'
                    )
                    ??
                    data_get(
                        $invoice,
                        'total_amount'
                    )
                ),

            'paid_amount' =>
                $this->numberOrNull(
                    data_get(
                        $invoice,
                        'totals.paid_amount'
                    )
                    ??
                    data_get(
                        $invoice,
                        'paid_amount'
                    )
                ),

            'balance_amount' =>
                $this->numberOrNull(
                    data_get(
                        $invoice,
                        'totals.balance_amount'
                    )
                    ??
                    data_get(
                        $invoice,
                        'balance_amount'
                    )
                ),

            'transaction_setup' =>
                $transactionSetup,

            'receipt_payload' =>
                $payload,

            'snapshot_version' =>
                self::VERSION,

            'snapshot_sha256' =>
                $payloadHash,
        ];

        try {
            $snapshot =
                PharmacoSaleReceiptSnapshot::query()
                    ->create(
                        $attributes
                    );
        } catch (QueryException $exception) {
            /*
             * Safe idempotency/race behavior:
             * if another request created the immutable snapshot,
             * read it; never overwrite it.
             */
            $snapshot =
                PharmacoSaleReceiptSnapshot::query()
                    ->where(
                        'tenant_id',
                        (int) $sale->tenant_id
                    )
                    ->where(
                        'pharmaco_sale_id',
                        (int) $sale->getKey()
                    )
                    ->first();

            if (! $snapshot) {
                throw $exception;
            }
        }

        return $this->payloadFromSnapshot(
            $snapshot
        );
    }

    /**
     * Original/reprint distinction is presentation only.
     * Persisted snapshot content is never rewritten.
     *
     * @param array<string, mixed> $payload
     * @return array<string, mixed>
     */
    public function forMode(
        array $payload,
        bool $reprint
    ): array {
        return [
            ...$payload,

            'is_reprint' =>
                $reprint,

            'document_label' =>
                $reprint
                    ? 'INVOICE REPRINT'
                    : 'SALES INVOICE',
        ];
    }

    /**
     * Complete persisted Transaction Set-Up projection.
     *
     * @param array<string, mixed> $invoice
     * @return array<string, mixed>
     */
    private function transactionSetup(
        PharmacoSale $sale,
        array $invoice
    ): array {
        $metadata =
            $sale->getAttribute(
                'metadata'
            );

        if (is_string($metadata)) {
            $decoded =
                json_decode(
                    $metadata,
                    true
                );

            $metadata =
                is_array($decoded)
                    ? $decoded
                    : [];
        }

        if (! is_array($metadata)) {
            $metadata = [];
        }

        return [
            'sale_id' =>
                (int) $sale->getKey(),

            'branch_id' =>
                $this->integerOrNull(
                    $sale->getAttribute(
                        'branch_id'
                    )
                ),

            'pharmaco_customer_id' =>
                $this->integerOrNull(
                    $sale->getAttribute(
                        'pharmaco_customer_id'
                    )
                ),

            'pharmaco_prescription_id' =>
                $this->integerOrNull(
                    $sale->getAttribute(
                        'pharmaco_prescription_id'
                    )
                ),

            'pos_session_id' =>
                $this->integerOrNull(
                    $sale->getAttribute(
                        'pos_session_id'
                    )
                    ??
                    data_get(
                        $invoice,
                        'pos_session.id'
                    )
                ),

            'terminal_identifier' =>
                $this->textOrNull(
                    $sale->getAttribute(
                        'terminal_identifier'
                    )
                    ??
                    data_get(
                        $metadata,
                        'terminal_identifier'
                    )
                ),

            'business_date' =>
                $this->dateOrText(
                    $sale->getAttribute(
                        'business_date'
                    )
                ),

            'sold_at' =>
                $this->dateTimeOrText(
                    $sale->getAttribute(
                        'sold_at'
                    )
                ),

            'cashier_user_id' =>
                $this->integerOrNull(
                    data_get(
                        $invoice,
                        'cashier.user_id'
                    )
                ),

            'sale_type' =>
                $this->textOrNull(
                    $sale->getAttribute(
                        'sale_type'
                    )
                    ??
                    data_get(
                        $invoice,
                        'sale_type'
                    )
                ),

            'customer_name' =>
                $this->textOrNull(
                    data_get(
                        $invoice,
                        'sales_register.customer_name'
                    )
                ),

            'customer_phone' =>
                $this->textOrNull(
                    data_get(
                        $invoice,
                        'sales_register.customer_phone'
                    )
                ),

            'customer_tin' =>
                $this->textOrNull(
                    data_get(
                        $invoice,
                        'sales_register.customer_tin'
                    )
                ),

            /*
             * Compatibility only.
             * Phone and TIN remain separate canonical fields.
             */
            'legacy_customer_phone_tin' =>
                $this->textOrNull(
                    data_get(
                        $invoice,
                        'sales_register.phone_tin'
                    )
                ),

            'insurance_partner_name' =>
                $this->textOrNull(
                    data_get(
                        $invoice,
                        'sales_register.insurance_name'
                    )
                    ??
                    data_get(
                        $invoice,
                        'insurance.name'
                    )
                    ??
                    data_get(
                        $invoice,
                        'insurance.partner_name'
                    )
                ),

            'subtotal_amount' =>
                data_get(
                    $invoice,
                    'totals.subtotal_amount'
                ),

            'discount_amount' =>
                data_get(
                    $invoice,
                    'totals.discount_amount'
                ),

            'tax_amount' =>
                data_get(
                    $invoice,
                    'totals.tax_amount'
                ),

            'total_amount' =>
                data_get(
                    $invoice,
                    'totals.total_amount'
                ),

            'paid_amount' =>
                data_get(
                    $invoice,
                    'totals.paid_amount'
                ),

            'balance_amount' =>
                data_get(
                    $invoice,
                    'totals.balance_amount'
                ),

            'items' =>
                array_values(
                    is_array(
                        $invoice[
                            'items'
                        ] ?? null
                    )
                        ? $invoice[
                            'items'
                        ]
                        : []
                ),

            'payments' =>
                array_values(
                    is_array(
                        $invoice[
                            'payments'
                        ] ?? null
                    )
                        ? $invoice[
                            'payments'
                        ]
                        : []
                ),

            /*
             * Preserve persisted sale metadata as part
             * of the immutable transaction document.
             */
            'sale_metadata' =>
                $metadata,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function payloadFromSnapshot(
        PharmacoSaleReceiptSnapshot $snapshot
    ): array {
        $payload =
            $snapshot->receipt_payload;

        if (! is_array($payload)) {
            throw new RuntimeException(
                'Receipt snapshot payload is invalid.'
            );
        }

        $actualHash =
            $this->payloadHash(
                $payload
            );

        if (
            ! hash_equals(
                (string) $snapshot->snapshot_sha256,
                $actualHash
            )
        ) {
            throw new RuntimeException(
                'Receipt snapshot integrity verification failed.'
            );
        }

        return $payload;
    }

    /**
     * Stable semantic hashing.
     *
     * Integer 300 and JSON-round-tripped float 300.0
     * intentionally hash identically.
     */
    private function payloadHash(
        array $payload
    ): string {
        $canonical =
            $this->canonicalValue(
                $payload
            );

        $json =
            json_encode(
                $canonical,
                JSON_UNESCAPED_SLASHES
                | JSON_UNESCAPED_UNICODE
                | JSON_THROW_ON_ERROR
            );

        return hash(
            'sha256',
            $json
        );
    }

    private function canonicalValue(
        mixed $value
    ): mixed {
        if (is_array($value)) {
            if (array_is_list($value)) {
                return array_map(
                    fn (mixed $entry): mixed =>
                        $this->canonicalValue(
                            $entry
                        ),
                    $value
                );
            }

            $result = [];

            $keys =
                array_keys(
                    $value
                );

            sort(
                $keys,
                SORT_STRING
            );

            foreach ($keys as $key) {
                $result[
                    (string) $key
                ] =
                    $this->canonicalValue(
                        $value[$key]
                    );
            }

            return $result;
        }

        if (is_int($value)) {
            return '__aquila_number__:'
                . (string) $value;
        }

        if (is_float($value)) {
            if (! is_finite($value)) {
                throw new RuntimeException(
                    'Non-finite number in receipt snapshot.'
                );
            }

            $number =
                sprintf(
                    '%.14g',
                    $value
                );

            return '__aquila_number__:'
                . $number;
        }

        if (is_object($value)) {
            if (
                method_exists(
                    $value,
                    'toArray'
                )
            ) {
                return $this->canonicalValue(
                    $value->toArray()
                );
            }

            if (
                method_exists(
                    $value,
                    '__toString'
                )
            ) {
                return (string) $value;
            }

            return $this->canonicalValue(
                get_object_vars(
                    $value
                )
            );
        }

        return $value;
    }

    private function textOrNull(
        mixed $value
    ): ?string {
        if ($value === null) {
            return null;
        }

        $text =
            trim(
                (string) $value
            );

        return $text !== ''
            ? $text
            : null;
    }

    private function integerOrNull(
        mixed $value
    ): ?int {
        if (
            $value === null
            ||
            $value === ''
            ||
            ! is_numeric($value)
        ) {
            return null;
        }

        return (int) $value;
    }

    private function numberOrNull(
        mixed $value
    ): ?float {
        if (
            $value === null
            ||
            $value === ''
            ||
            ! is_numeric($value)
        ) {
            return null;
        }

        return round(
            (float) $value,
            2
        );
    }

    private function dateOrText(
        mixed $value
    ): ?string {
        if ($value === null) {
            return null;
        }

        if (
            is_object($value)
            &&
            method_exists(
                $value,
                'toDateString'
            )
        ) {
            return $value->toDateString();
        }

        return $this->textOrNull(
            $value
        );
    }

    private function dateTimeOrText(
        mixed $value
    ): ?string {
        if ($value === null) {
            return null;
        }

        if (
            is_object($value)
            &&
            method_exists(
                $value,
                'toISOString'
            )
        ) {
            return $value->toISOString();
        }

        if (
            is_object($value)
            &&
            method_exists(
                $value,
                'toDateTimeString'
            )
        ) {
            return $value->toDateTimeString();
        }

        return $this->textOrNull(
            $value
        );
    }
}
