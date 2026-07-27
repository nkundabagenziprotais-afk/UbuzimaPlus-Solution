<?php

declare(strict_types=1);

namespace Tests\Unit\Finance;

use App\Services\Finance\LiveBusinessDateResolver;
use Illuminate\Database\Eloquent\Model;
use PHPUnit\Framework\TestCase;

final class LiveBusinessDateResolverTest extends TestCase
{
    private LiveBusinessDateResolver $resolver;

    protected function setUp(): void
    {
        parent::setUp();

        $this->resolver =
            new LiveBusinessDateResolver();
    }

    public function test_live_primary_timestamp_assigns_business_date(): void
    {
        $model = $this->model([
            'entry_mode' => 'live',
            'sold_at' =>
                '2026-07-25 21:27:44',
        ]);

        $this->assertTrue(
            $this->resolver
                ->assignPrimaryTimestamp(
                    $model,
                    'sold_at',
                )
        );

        $this->assertSame(
            '2026-07-25',
            $model->getAttribute(
                'business_date'
            )
        );
    }

    public function test_timestamp_offset_is_not_timezone_converted(): void
    {
        $this->assertSame(
            '2026-07-25',
            $this->resolver
                ->calendarDateFromStoredTimestamp(
                    '2026-07-25T23:59:59+14:00'
                )
        );
    }

    public function test_created_at_is_used_only_as_fallback(): void
    {
        $model = $this->model([
            'entry_mode' => 'live',
            'occurred_at' => null,
            'created_at' =>
                '2026-07-26 00:00:01',
        ]);

        $this->assertTrue(
            $this->resolver
                ->assignCreatedAtFallback(
                    $model,
                    'occurred_at',
                )
        );

        $this->assertSame(
            '2026-07-26',
            $model->getAttribute(
                'business_date'
            )
        );
    }

    public function test_historical_record_is_preserved(): void
    {
        $model = $this->model([
            'entry_mode' => 'historical',
            'sold_at' =>
                '2026-07-25 21:27:44',
        ]);

        $this->assertFalse(
            $this->resolver
                ->assignPrimaryTimestamp(
                    $model,
                    'sold_at',
                )
        );

        $this->assertNull(
            $model->getAttribute(
                'business_date'
            )
        );
    }

    public function test_existing_business_date_is_not_overwritten(): void
    {
        $model = $this->model([
            'entry_mode' => 'live',
            'business_date' =>
                '2026-07-24',
            'received_at' =>
                '2026-07-25 21:27:44',
        ]);

        $this->assertFalse(
            $this->resolver
                ->assignPrimaryTimestamp(
                    $model,
                    'received_at',
                )
        );

        $this->assertSame(
            '2026-07-24',
            $model->getAttribute(
                'business_date'
            )
        );
    }

    public function test_invalid_timestamp_is_not_used(): void
    {
        $model = $this->model([
            'entry_mode' => 'live',
            'occurred_at' =>
                'not-a-timestamp',
        ]);

        $this->assertFalse(
            $this->resolver
                ->assignPrimaryTimestamp(
                    $model,
                    'occurred_at',
                )
        );

        $this->assertNull(
            $model->getAttribute(
                'business_date'
            )
        );
    }

    private function model(
        array $attributes,
    ): Model {
        $model =
            new class extends Model {
                public $timestamps = false;

                protected $guarded = [];
            };

        $model->forceFill(
            $attributes
        );

        return $model;
    }
}
