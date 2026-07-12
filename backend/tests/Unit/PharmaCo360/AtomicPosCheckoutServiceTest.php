<?php

namespace Tests\Unit\PharmaCo360;

use App\Services\PharmaCo360\AtomicPosCheckoutService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use RuntimeException;
use Tests\TestCase;

class AtomicPosCheckoutServiceTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Schema::create(
            'atomic_pos_checkout_test_rows',
            function ($table): void {
                $table->id();
                $table->string('stage', 30);
            }
        );
    }

    protected function tearDown(): void
    {
        Schema::dropIfExists('atomic_pos_checkout_test_rows');

        parent::tearDown();
    }

    public function test_later_payment_failure_rolls_back_every_checkout_stage(): void
    {
        $service = app(AtomicPosCheckoutService::class);

        try {
            $service->execute(
                'checkout-rollback-test',
                fn (): ?array => null,
                function (): array {
                    DB::table('atomic_pos_checkout_test_rows')->insert([
                        'stage' => 'created',
                    ]);

                    return ['id' => 1];
                },
                function (array $sale): array {
                    DB::table('atomic_pos_checkout_test_rows')->insert([
                        'stage' => 'confirmed',
                    ]);

                    return $sale;
                },
                function (): never {
                    throw new RuntimeException(
                        'Simulated payment gateway failure.'
                    );
                }
            );

            $this->fail('The simulated payment failure was not raised.');
        } catch (RuntimeException $exception) {
            $this->assertSame(
                'Simulated payment gateway failure.',
                $exception->getMessage()
            );
        }

        $this->assertSame(
            0,
            DB::table('atomic_pos_checkout_test_rows')->count()
        );
    }

    public function test_existing_checkout_key_returns_completed_result_without_repeating_stages(): void
    {
        $service = app(AtomicPosCheckoutService::class);
        $stageCalls = 0;

        $result = $service->execute(
            'checkout-idempotency-test',
            fn (): array => [
                'sale' => ['id' => 41],
                'payment' => ['id' => 77],
            ],
            function () use (&$stageCalls): array {
                $stageCalls++;

                return ['id' => 1];
            },
            function (array $sale) use (&$stageCalls): array {
                $stageCalls++;

                return $sale;
            },
            function () use (&$stageCalls): array {
                $stageCalls++;

                return [];
            }
        );

        $this->assertTrue($result['idempotent']);
        $this->assertSame(41, $result['sale']['id']);
        $this->assertSame(77, $result['payment']['id']);
        $this->assertSame(0, $stageCalls);
    }
}
