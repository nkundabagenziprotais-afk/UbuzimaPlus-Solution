<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Solution extends Model
{
    protected $fillable = [
        'name',
        'code',
        'description',
        'status',
    ];

    public function modules(): BelongsToMany
    {
        return $this->belongsToMany(Module::class, 'solution_modules')
            ->withPivot(['status', 'default_config'])
            ->withTimestamps();
    }
}
