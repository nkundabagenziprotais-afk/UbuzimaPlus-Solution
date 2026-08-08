<?php

declare(strict_types=1);

namespace App\Services\PharmaCo360;

use App\Models\PharmacoSale;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;

final class SaleInvoicePayloadService
{
    /**
     * Product lines for Recent Sales, Sales Register and invoices.
     *
     * Product snapshots remain authoritative if the product master changes.
     *
     * @return array<int, array<string, mixed>>
     */
    public function productLines(PharmacoSale $sale): array
    {
        return $this->relatedCollection($sale, 'items')
            ->map(function (Model $item): array {
                $product = $item->relationLoaded('product')
                    ? $item->getRelation('product')
                    : null;

                return [
                    'sale_item_id' => $this->integer(
                        $item->getKey()
                    ),

                    'product_id' => $this->integer(
                        $item->getAttribute('product_id')
                    ),

                    'sku' => $this->firstString(
                        $item,
                        ['sku_snapshot'],
                        $product instanceof Model
                            ? $this->firstString(
                                $product,
                                ['sku', 'code']
                            )
                            : null
                    ),

                    'product_name' => $this->firstString(
                        $item,
                        ['product_name_snapshot'],
                        $product instanceof Model
                            ? $this->firstString(
                                $product,
                                [
                                    'name',
                                    'trade_name',
                                    'generic_name',
                                ],
                                'Unspecified product'
                            )
                            : 'Unspecified product'
                    ),

                    'quantity' => $this->number(
                        $item->getAttribute('quantity')
                    ),

                    'unit_price' => $this->number(
                        $item->getAttribute('unit_price')
                    ),

                    'discount_amount' => $this->number(
                        $item->getAttribute('discount_amount')
                    ),

                    'tax_amount' => $this->number(
                        $item->getAttribute('tax_amount')
                    ),

                    'line_total' => $this->number(
                        $item->getAttribute('line_total')
                    ),

                    'status' => $this->firstString(
                        $item,
                        ['status'],
                        'active'
                    ),
                ];
            })
            ->values()
            ->all();
    }

    /**
     * Build an invoice entirely from persisted transaction records.
     *
     * @return array<string, mixed>
     */
    public function build(
        PharmacoSale $sale,
        bool $reprint = false
    ): array {
        $tenant = $this->relatedModel($sale, 'tenant');
        $branch = $this->relatedModel($sale, 'branch');
        $customer = $this->relatedModel($sale, 'customer');
        $posSession = $this->relatedModel($sale, 'posSession');

        /*
         * AQUILA_RECEIPT_TRANSACTION_CUSTOMER_V1_START
         *
         * Prefer the immutable Transaction Set-UP customer
         * captured on the sale. Registered customer data
         * remains the fallback.
         */
        $saleMetadata =
            $sale->getAttribute('metadata');

        if (is_string($saleMetadata)) {
            $decodedSaleMetadata =
                json_decode(
                    $saleMetadata,
                    true
                );

            $saleMetadata =
                is_array($decodedSaleMetadata)
                    ? $decodedSaleMetadata
                    : [];
        }

        if (! is_array($saleMetadata)) {
            $saleMetadata = [];
        }

        $transactionCustomerName =
            trim((string) data_get(
                $saleMetadata,
                'walk_in_customer.name',
                ''
            ));

        $transactionCustomerPhoneTin =
            trim((string) data_get(
                $saleMetadata,
                'walk_in_customer.phone_tin',
                ''
            ));

        $registeredCustomerName =
            $customer
                ? $this->firstString(
                    $customer,
                    [
                        'name',
                        'full_name',
                    ]
                )
                : null;

        $registeredCustomerPhone =
            $customer
                ? $this->firstString(
                    $customer,
                    [
                        'phone',
                        'phone_number',
                    ]
                )
                : null;

        $registeredCustomerTin =
            $customer
                ? $this->firstString(
                    $customer,
                    [
                        'tin',
                        'tin_number',
                        'tax_identification_number',
                    ]
                )
                : null;

        $registeredCustomerNumber =
            $customer
                ? $this->firstString(
                    $customer,
                    [
                        'customer_number',
                        'code',
                    ]
                )
                : null;

        $resolvedCustomerName =
            $transactionCustomerName !== ''
                ? $transactionCustomerName
                : $registeredCustomerName;

        $resolvedCustomerTin =
            $transactionCustomerPhoneTin !== ''
                ? $transactionCustomerPhoneTin
                : $registeredCustomerTin;

        /*
         * AQUILA_RECEIPT_TRANSACTION_CUSTOMER_V1_END
         */

        /*
         * Receipt/business identity belongs to the
         * pharmacy profile of the sale tenant.
         * Future Super Admin configuration can edit
         * this same tenant-owned record.
         */
        $pharmacyProfile =
            \App\Models\PharmacyProfile::query()
                ->where(
                    'tenant_id',
                    $sale->getAttribute('tenant_id')
                )
                ->first();

        $payments = $this->payments($sale);

        $persistedPaid = $this->firstValue(
            $sale,
            [
                'paid_amount',
                'amount_paid',
            ]
        );

        $paidAmount = $persistedPaid !== null
            ? $this->number($persistedPaid)
            : array_reduce(
                $payments,
                static fn (
                    float $sum,
                    array $payment
                ): float =>
                    $sum + (float) $payment['amount'],
                0.0
            );

        return [
            'document_type' => 'sales_invoice',

            'is_reprint' => $reprint,

            'document_label' => $reprint
                ? 'INVOICE REPRINT'
                : 'SALES INVOICE',

            'sale_id' => $this->integer(
                $sale->getKey()
            ),

            'invoice_number' => $this->firstString(
                $sale,
                ['sale_number'],
                'UNNUMBERED'
            ),

            'sale_reference' => $this->firstString(
                $sale,
                [
                    'reference_number',
                    'sale_number',
                ],
                'UNNUMBERED'
            ),

            'sale_type' => $this->firstString(
                $sale,
                ['sale_type'],
                'cash_sale'
            ),

            'status' => $this->firstString(
                $sale,
                ['status'],
                'unknown'
            ),

            'issued_at' => $this->firstDate(
                $sale,
                [
                    'completed_at',
                    'confirmed_at',
                    'sale_date',
                    'created_at',
                ]
            ),

            'tenant' => $tenant
                ? [
                    'id' => $this->integer(
                        $tenant->getKey()
                    ),

                    'name' => $this->firstString(
                        $tenant,
                        ['name', 'legal_name']
                    ),

                    'code' => $this->firstString(
                        $tenant,
                        ['slug', 'code']
                    ),
                ]
                : null,

            'pharmacy_profile' =>
                $pharmacyProfile
                    ? [
                        'id' => $this->integer(
                            $pharmacyProfile->getKey()
                        ),

                        'tenant_id' => $this->integer(
                            $pharmacyProfile->getAttribute(
                                'tenant_id'
                            )
                        ),

                        'legal_name' =>
                            $this->firstString(
                                $pharmacyProfile,
                                ['legal_name']
                            ),

                        'trading_name' =>
                            $this->firstString(
                                $pharmacyProfile,
                                ['trading_name']
                            ),

                        'tin' =>
                            $this->firstString(
                                $pharmacyProfile,
                                ['tin']
                            ),

                        'primary_phone' =>
                            $this->firstString(
                                $pharmacyProfile,
                                ['primary_phone']
                            ),

                        'primary_email' =>
                            $this->firstString(
                                $pharmacyProfile,
                                ['primary_email']
                            ),

                        'physical_address' =>
                            $this->firstString(
                                $pharmacyProfile,
                                ['physical_address']
                            ),
                    ]
                    : null,

            'branch' => $branch
                ? [
                    'id' => $this->integer(
                        $branch->getKey()
                    ),

                    'name' => $this->firstString(
                        $branch,
                        ['name']
                    ),

                    'code' => $this->firstString(
                        $branch,
                        ['code']
                    ),

                    'address' => $this->firstString(
                        $branch,
                        [
                            'address',
                            'physical_address',
                        ]
                    ),

                    'phone' => $this->firstString(
                        $branch,
                        [
                            'phone',
                            'phone_number',
                        ]
                    ),
                ]
                : null,

            /*
             * Transaction Set-UP values are transaction-specific
             * and therefore take precedence on this receipt.
             */
            'customer' => (
                $customer
                || $resolvedCustomerName !== null
                || $resolvedCustomerTin !== null
            )
                ? [
                    'id' => $customer
                        ? $this->integer(
                            $customer->getKey()
                        )
                        : null,

                    'name' =>
                        $resolvedCustomerName,

                    'phone' =>
                        $registeredCustomerPhone,

                    /*
                     * Receipt Layer 2A / R4 Rev5 reads
                     * customer.tin for Customer TIN.
                     */
                    'tin' =>
                        $resolvedCustomerTin,

                    'phone_tin' =>
                        $resolvedCustomerTin,

                    'customer_number' =>
                        $registeredCustomerNumber,
                ]
                : null,

            'cashier' => [
                'user_id' => $this->integer(
                    $this->firstValue(
                        $sale,
                        [
                            'completed_by_user_id',
                            'confirmed_by_user_id',
                            'created_by_user_id',
                            'created_by',
                        ]
                    )
                ),

                'name' => $this->firstString(
                    $sale,
                    [
                        'cashier_name',
                        'created_by_name',
                    ]
                ),
            ],

            'pos_session' => $posSession
                ? [
                    'id' => $this->integer(
                        $posSession->getKey()
                    ),

                    'terminal_identifier' =>
                        $this->firstString(
                            $posSession,
                            ['terminal_identifier']
                        ),

                    'terminal_label' =>
                        $this->firstString(
                            $posSession,
                            ['terminal_label']
                        ),
                ]
                : null,

            'items' => $this->productLines($sale),

            'totals' => [
                'subtotal_amount' => $this->number(
                    $sale->getAttribute(
                        'subtotal_amount'
                    )
                ),

                'discount_amount' => $this->number(
                    $sale->getAttribute(
                        'discount_amount'
                    )
                ),

                'tax_amount' => $this->number(
                    $sale->getAttribute(
                        'tax_amount'
                    )
                ),

                'total_amount' => $this->number(
                    $sale->getAttribute(
                        'total_amount'
                    )
                ),

                'paid_amount' => $paidAmount,

                'balance_amount' => $this->number(
                    $sale->getAttribute(
                        'balance_amount'
                    )
                ),
            ],

            'payments' => $payments,

            'document_integrity' => [
                'amount_source' =>
                    'persisted_sale_and_payment_records',

                'product_name_source' =>
                    'sale_item_snapshot_with_product_fallback',

                'current_catalogue_prices_used' => false,
            ],
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function payments(
        PharmacoSale $sale
    ): array {
        return $this->relatedCollection(
            $sale,
            'payments'
        )
            ->map(function (Model $payment): array {
                return [
                    'payment_id' => $this->integer(
                        $payment->getKey()
                    ),

                    'method' => $this->firstString(
                        $payment,
                        [
                            'payment_method',
                            'method',
                        ]
                    ),

                    'amount' => $this->number(
                        $payment->getAttribute('amount')
                    ),

                    'status' => $this->firstString(
                        $payment,
                        ['status']
                    ),

                    'receipt_number' =>
                        $this->firstString(
                            $payment,
                            ['receipt_number']
                        ),

                    'reference_number' =>
                        $this->firstString(
                            $payment,
                            [
                                'reference_number',
                                'transaction_reference',
                            ]
                        ),

                    'paid_at' => $this->firstDate(
                        $payment,
                        [
                            'paid_at',
                            'completed_at',
                            'created_at',
                        ]
                    ),
                ];
            })
            ->values()
            ->all();
    }

    private function relatedModel(
        Model $model,
        string $relation
    ): ?Model {
        if (! $model->relationLoaded($relation)) {
            return null;
        }

        $related = $model->getRelation($relation);

        return $related instanceof Model
            ? $related
            : null;
    }

    private function relatedCollection(
        Model $model,
        string $relation
    ): Collection {
        if (! $model->relationLoaded($relation)) {
            return collect();
        }

        return collect(
            $model->getRelation($relation)
        )->filter(
            fn (mixed $item): bool =>
                $item instanceof Model
        );
    }

    private function firstValue(
        Model $model,
        array $attributes,
        mixed $default = null
    ): mixed {
        foreach ($attributes as $attribute) {
            $value = $model->getAttribute(
                $attribute
            );

            if ($value !== null && $value !== '') {
                return $value;
            }
        }

        return $default;
    }

    private function firstString(
        Model $model,
        array $attributes,
        ?string $default = null
    ): ?string {
        $value = $this->firstValue(
            $model,
            $attributes,
            $default
        );

        if ($value === null) {
            return null;
        }

        $string = trim((string) $value);

        return $string !== ''
            ? $string
            : $default;
    }

    private function firstDate(
        Model $model,
        array $attributes
    ): ?string {
        $value = $this->firstValue(
            $model,
            $attributes
        );

        if ($value === null) {
            return null;
        }

        if (
            is_object($value) &&
            method_exists(
                $value,
                'toIso8601String'
            )
        ) {
            return $value->toIso8601String();
        }

        return (string) $value;
    }

    private function integer(
        mixed $value
    ): ?int {
        if ($value === null || $value === '') {
            return null;
        }

        $integer = (int) $value;

        return $integer > 0
            ? $integer
            : null;
    }

    private function number(
        mixed $value
    ): float {
        return is_numeric($value)
            ? (float) $value
            : 0.0;
    }
}
