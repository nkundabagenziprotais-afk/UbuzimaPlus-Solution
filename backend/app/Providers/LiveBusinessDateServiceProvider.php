<?php

declare(strict_types=1);

namespace App\Providers;

use App\Models\PharmacoPayment;
use App\Models\PharmacoSale;
use App\Models\StockMovement;
use App\Services\Finance\LiveBusinessDateResolver;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\ServiceProvider;

final class LiveBusinessDateServiceProvider extends ServiceProvider
{
    public function boot(
        LiveBusinessDateResolver $resolver,
    ): void {
        $this->registerModelPolicy(
            PharmacoSale::class,
            'sold_at',
            $resolver,
        );

        $this->registerModelPolicy(
            PharmacoPayment::class,
            'received_at',
            $resolver,
        );

        $this->registerModelPolicy(
            StockMovement::class,
            'occurred_at',
            $resolver,
        );
    }

    /**
     * @param class-string<Model> $modelClass
     */
    private function registerModelPolicy(
        string $modelClass,
        string $primaryTimestampField,
        LiveBusinessDateResolver $resolver,
    ): void {
        $modelClass::creating(
            static function (
                Model $model,
            ) use (
                $resolver,
                $primaryTimestampField,
            ): void {
                $resolver->assignPrimaryTimestamp(
                    $model,
                    $primaryTimestampField,
                );
            }
        );

        $modelClass::created(
            static function (
                Model $model,
            ) use (
                $resolver,
                $primaryTimestampField,
            ): void {
                $assigned =
                    $resolver
                        ->assignCreatedAtFallback(
                            $model,
                            $primaryTimestampField,
                        );

                if ($assigned) {
                    $model->saveQuietly();
                }
            }
        );
    }
}
