<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AiProvider extends Model
{
    protected $fillable = [
        'name',
        'code',
        'provider_type',
        'status',
        'mode',
        'secret_reference',
        'configuration',
        'data_policy',
        'enabled_by',
    ];

    protected $casts = [
        'configuration' => 'array',
        'data_policy' => 'array',
    ];
}
