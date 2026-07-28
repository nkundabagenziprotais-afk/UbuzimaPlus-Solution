<?php

namespace App\Models\Concerns;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

trait GeneratesUuid
{
    protected static function bootGeneratesUuid(): void
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
