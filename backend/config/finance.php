<?php

return [
    /*
    |--------------------------------------------------------------------------
    | POS Finance posting mode
    |--------------------------------------------------------------------------
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

    'prospective_cutover_date' => env(
        'FINANCE_PROSPECTIVE_CUTOVER_DATE',
        '2026-08-01'
    ),

    /*
    |--------------------------------------------------------------------------
    | Authoritative payment mappings
    |--------------------------------------------------------------------------
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

    /*
    |--------------------------------------------------------------------------
    | Controlled inventory-cost approval methods
    |--------------------------------------------------------------------------
    |
    | These methods require human approval. Selling price is never an
    | acceptable cost source.
    |
    */

    'inventory_cost_approval_methods' => [
        'documentary_exact' =>
            'Exact unit cost from a verified purchase or receipt document',

        'product_history_approved' =>
            'Historical product cost approved after documentary review',

        'opening_valuation' =>
            'Accountant-approved opening inventory valuation',
    ],
];
