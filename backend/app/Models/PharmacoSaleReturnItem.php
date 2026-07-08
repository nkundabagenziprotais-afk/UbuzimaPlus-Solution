<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PharmacoSaleReturnItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'uuid',
        'tenant_id',
        'pharmaco_sale_return_id',
        'pharmaco_sale_item_id',
        'product_id',
        'stock_batch_id',
        'quantity',
        'unit_price',
        'line_refund_amount',
        'disposition',
        'reason',
        'stock_restored',
        'metadata',
    ];

    protected $casts = [
        'quantity' => 'decimal:3',
        'unit_price' => 'decimal:2',
        'line_refund_amount' => 'decimal:2',
        'stock_restored' => 'boolean',
        'metadata' => 'array',
    ];

    public function saleReturn(): BelongsTo
    {
        return $this->belongsTo(
            PharmacoSaleReturn::class,
            'pharmaco_sale_return_id'
        );
    }

    public function saleItem(): BelongsTo
    {
        return $this->belongsTo(
            PharmacoSaleItem::class,
            'pharmaco_sale_item_id'
        );
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function stockBatch(): BelongsTo
    {
        return $this->belongsTo(StockBatch::class);
    }
}
