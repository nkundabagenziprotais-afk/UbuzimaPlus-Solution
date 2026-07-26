<?php

return [
    /*
    |--------------------------------------------------------------------------
    | POS Finance posting mode
    |--------------------------------------------------------------------------
    |
    | shadow:
    |   Preserve the current validated payment-shadow ledger.
    |
    | dual:
    |   Preserve shadow accounting while also creating authoritative journals
    |   for controlled reconciliation.
    |
    | authoritative:
    |   Use authoritative sale, payment, COGS and inventory journals.
    |
    | Production remains in shadow mode until reconciliation gates pass.
    |
    */

    'pos_posting_mode' => env(
        'FINANCE_POS_POSTING_MODE',
        'shadow'
    ),

    'strict_period_modes' => [
        'dual',
        'authoritative',
    ],

    'authoritative_sale_statuses' => [
        'dispensed',
        'completed',
    ],

    /*
    |--------------------------------------------------------------------------
    | Authoritative payment mappings
    |--------------------------------------------------------------------------
    |
    | There is deliberately no fallback. Unknown methods must be quarantined
    | instead of being silently classified as cash.
    |
    */

    'authoritative_payment_mappings' => [
        'cash' => 'pos.cash',
        'momo' => 'pos.momo',
        'card' => 'pos.card',
        'insurance' => 'pos.insurance',
        'bank_transfer' => 'pos.bank',
    ],

    'authoritative_required_mappings' => [
        'pos.credit',
        'pos.cash',
        'pos.momo',
        'pos.card',
        'pos.bank',
        'pos.insurance',
        'sales.revenue',
        'sales.tax',
        'sales.returns',
        'inventory.asset',
        'inventory.cogs',
    ],
];
