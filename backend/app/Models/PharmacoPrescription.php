<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PharmacoPrescription extends Model
{
    use HasFactory;

    protected $fillable = [
        'uuid',
        'tenant_id',
        'pharmaco_customer_id',
        'prescription_number',
        'prescriber_name',
        'prescriber_facility',
        'prescriber_phone',
        'issued_at',
        'expires_at',
        'status',
        'notes',
        'metadata',
    ];

    protected $casts = [
        'issued_at' => 'date',
        'expires_at' => 'date',
        'metadata' => 'array',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(PharmacoCustomer::class, 'pharmaco_customer_id');
    }
}
