<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PharmacoSupplierPayment extends Model
{
    protected $fillable = [
        'uuid',
        'tenant_id',
        'pharmaco_supplier_invoice_id',
        'pharmaco_supplier_id',
        'payment_number',
        'amount',
        'payment_method',
        'reference_number',
        'status',
        'paid_at',
        'recorded_by',
        'notes',
        'metadata',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'paid_at' => 'datetime',
        'metadata' => 'array',
    ];

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(PharmacoSupplierInvoice::class, 'pharmaco_supplier_invoice_id');
    }

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(PharmacoSupplier::class, 'pharmaco_supplier_id');
    }
}
