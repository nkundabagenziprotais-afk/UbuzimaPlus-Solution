<?php

namespace App\Models;

use App\Models\Concerns\GeneratesUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TaxType extends Model
{
    use GeneratesUuid;

    protected $fillable = [
        'uuid',
        'country_code',
        'code',
        'name',
        'tax_scope',
        'calculation_method',
        'recoverability',
        'status',
        'description',
        'metadata',
    ];

    protected $casts = [
        'metadata' => 'array',
    ];


    public function rates(): HasMany
    {
        return $this->hasMany(TaxRate::class);
    }

    public function profiles(): HasMany
    {
        return $this->hasMany(TaxProfile::class);
    }

}
