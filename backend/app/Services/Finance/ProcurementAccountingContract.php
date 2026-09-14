<?php

namespace App\Services\Finance;

use InvalidArgumentException;

final class ProcurementAccountingContract
{
    public const RELEASE =
        'AQUILA_FINANCE_F4_R3_AP_PROCUREMENT_GRNI_FOUNDATION';

    public const INVENTORY_ASSET =
        'inventory.asset';

    public const GRNI =
        'inventory.receipt_clearing';

    public const PURCHASE_PRICE_VARIANCE =
        'inventory.purchase_price_variance';

    public const INVENTORY_IN_TRANSIT =
        'inventory.in_transit';

    public const ACCOUNTS_PAYABLE =
        'supplier.ap';

    public const SUPPLIER_EXPENSE =
        'supplier.expense';

    public const SUPPLIER_ADVANCE =
        'supplier.advance';

    public const VAT_INPUT =
        'tax.vat_input';

    public const WITHHOLDING_PAYABLE =
        'tax.withholding_payable';

    public const BANK =
        'pos.bank';

    public const CASH =
        'pos.cash';

    public const MOBILE_MONEY =
        'pos.momo';

    public const CARD =
        'pos.card';

    /**
     * Exact procurement accounting mappings confirmed in F4-R2.
     */
    public static function requiredMappings(): array
    {
        return [
            self::INVENTORY_ASSET,
            self::GRNI,
            self::PURCHASE_PRICE_VARIANCE,
            self::INVENTORY_IN_TRANSIT,
            self::ACCOUNTS_PAYABLE,
            self::SUPPLIER_EXPENSE,
            self::SUPPLIER_ADVANCE,
            self::VAT_INPUT,
            self::WITHHOLDING_PAYABLE,
        ];
    }

    /**
     * Canonical accounting architecture.
     *
     * This describes accounting intent only.
     * F4-R4 will perform actual guarded journal posting.
     */
    public static function postingBlueprints(): array
    {
        return [
            'purchase_order' => [
                'gl_posting' => false,
            ],

            'goods_receipt' => [
                'debit' => [
                    self::INVENTORY_ASSET,
                ],
                'credit' => [
                    self::GRNI,
                ],
            ],

            'supplier_bill' => [
                'debit' => [
                    self::GRNI,
                    self::VAT_INPUT,
                ],
                'variance' => [
                    self::PURCHASE_PRICE_VARIANCE,
                ],
                'credit' => [
                    self::ACCOUNTS_PAYABLE,
                ],
            ],

            'supplier_payment' => [
                'debit' => [
                    self::ACCOUNTS_PAYABLE,
                ],
                'credit' => [
                    'settlement_account',
                ],
            ],

            'supplier_advance' => [
                'debit' => [
                    self::SUPPLIER_ADVANCE,
                ],
                'credit' => [
                    'settlement_account',
                ],
            ],

            'advance_application' => [
                'debit' => [
                    self::ACCOUNTS_PAYABLE,
                ],
                'credit' => [
                    self::SUPPLIER_ADVANCE,
                ],
            ],

            'supplier_credit' => [
                'debit' => [
                    self::ACCOUNTS_PAYABLE,
                ],
                'credit_or_reverse' => [
                    self::GRNI,
                    self::VAT_INPUT,
                    self::PURCHASE_PRICE_VARIANCE,
                ],
            ],
        ];
    }

    /**
     * Supplier settlement mapping by payment method.
     *
     * This reuses existing F3 settlement accounts rather than creating
     * parallel supplier-specific cash/bank accounts.
     */
    public static function settlementMapping(
        string $paymentMethod
    ): string {
        $method = strtolower(
            trim(
                $paymentMethod
            )
        );

        return match ($method) {
            'bank',
            'bank_transfer',
            'transfer',
            'eft' =>
                self::BANK,

            'cash' =>
                self::CASH,

            'momo',
            'mobile_money',
            'mobile money' =>
                self::MOBILE_MONEY,

            'card' =>
                self::CARD,

            default =>
                throw new InvalidArgumentException(
                    'Unsupported supplier settlement method: '
                    . $paymentMethod
                ),
        };
    }

    public static function accountingStatuses(): array
    {
        return [
            'unposted',
            'ready',
            'posted',
            'reversed',
            'exception',
        ];
    }

    public static function matchStatuses(): array
    {
        return [
            'pending',
            'matched',
            'exception',
            'approved',
            'rejected',
        ];
    }

    public static function receiptStatuses(): array
    {
        return [
            'draft',
            'received',
            'approved',
            'posted',
            'reversed',
        ];
    }
}
