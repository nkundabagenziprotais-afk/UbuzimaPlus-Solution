<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PharmacoCustomer extends Model
{
    use HasFactory;

    protected $fillable = [
        'uuid',
        'tenant_id',
        'first_name',
        'last_name',
        'phone',
        'email',
        'date_of_birth',
        'gender',
        'customer_type',
        'insurance_provider',
        'insurance_membership_number',
        'status',
        'credit_status',
        'credit_terms_days',
        'credit_balance',
        'credit_limit',
        'metadata',
    ];

    protected $casts = [
        'credit_limit' => 'decimal:2',
        'credit_balance' => 'decimal:2',
        'credit_terms_days' => 'integer',
        'date_of_birth' => 'date',
        'metadata' => 'array',
        'credit_terms_days' => 'integer',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function prescriptions(): HasMany
    {
        return $this->hasMany(PharmacoPrescription::class);
    }

    public function sales(): HasMany
    {
        return $this->hasMany(PharmacoSale::class);
    }

    public function insuranceMemberships(): HasMany
    {
        return $this->hasMany(
            CustomerInsuranceMembership::class,
            'customer_id'
        );
    }
}
