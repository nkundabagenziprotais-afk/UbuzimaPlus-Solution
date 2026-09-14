<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

final class PharmacoSaleReceiptSnapshot extends Model
{
    protected $guarded = [];

    protected $casts = [
        'business_date' =>
            'date',

        'sold_at' =>
            'datetime',

        'subtotal_amount' =>
            'decimal:2',

        'discount_amount' =>
            'decimal:2',

        'tax_amount' =>
            'decimal:2',

        'total_amount' =>
            'decimal:2',

        'paid_amount' =>
            'decimal:2',

        'balance_amount' =>
            'decimal:2',

        'transaction_setup' =>
            'array',

        'receipt_payload' =>
            'array',
    ];
}
