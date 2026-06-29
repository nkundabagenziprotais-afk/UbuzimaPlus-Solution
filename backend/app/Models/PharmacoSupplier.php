<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PharmacoSupplier extends Model
{
    protected $fillable = [
        'uuid',
        'tenant_id',
        'supplier_code',
        'name',
        'legal_name',
        'supplier_type',
        'contact_person',
        'phone',
        'email',
        'tax_identification_number',
        'license_number',
        'address',
        'payment_terms',
        'status',
        'metadata',
    ];

    protected $casts = [
        'metadata' => 'array',
    ];

    public function purchaseOrders(): HasMany
    {
        return $this->hasMany(PharmacoPurchaseOrder::class);
    }
}
