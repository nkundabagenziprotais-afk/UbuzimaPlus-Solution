<?php

namespace App\Models;

use App\Models\Concerns\GeneratesUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class RraExemptionItem extends Model
{
    use GeneratesUuid;

    protected $fillable = [
        'uuid',
        'rra_exemption_list_id',
        'sequence_number',
        'official_name',
        'normalised_name',
        'generic_name',
        'normalised_generic_name',
        'trade_name',
        'dosage_form',
        'strength',
        'pack_size',
        'registration_number',
        'hs_code',
        'manufacturer',
        'eligibility_scope',
        'status',
        'raw_payload',
        'metadata',
    ];

    protected $casts = [
        'raw_payload' => 'array',
        'metadata' => 'array',
    ];


    public function exemptionList(): BelongsTo
    {
        return $this->belongsTo(
            RraExemptionList::class,
            'rra_exemption_list_id'
        );
    }

    public function aliases(): HasMany
    {
        return $this->hasMany(RraExemptionAlias::class);
    }

    public function productAssignments(): HasMany
    {
        return $this->hasMany(ProductTaxAssignment::class);
    }

}
