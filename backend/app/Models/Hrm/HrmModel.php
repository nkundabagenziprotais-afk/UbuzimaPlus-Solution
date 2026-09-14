<?php

namespace App\Models\Hrm;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

abstract class HrmModel extends Model
{
    protected $guarded = [
        'id',
    ];

    protected static function booted(): void
    {
        static::creating(function (Model $model): void {
            if (! $model->getAttribute('uuid')) {
                $model->setAttribute(
                    'uuid',
                    (string) Str::uuid()
                );
            }
        });
    }
}
