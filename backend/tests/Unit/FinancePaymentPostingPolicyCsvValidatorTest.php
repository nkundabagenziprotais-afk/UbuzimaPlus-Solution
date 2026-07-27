<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Services\Finance\FinancePaymentPostingPolicyCsvValidator;
use PHPUnit\Framework\TestCase;
use RuntimeException;

final class FinancePaymentPostingPolicyCsvValidatorTest extends TestCase
{
    private array $temporaryFiles = [];

    protected function tearDown(): void
    {
        foreach (
            $this->temporaryFiles
            as $temporaryFile
        ) {
            @unlink($temporaryFile);
        }

        parent::tearDown();
    }

    public function test_validates_exact_cohort(): void
    {
        $path = $this->writeCsv([
            [
                'payment_id' => 11,
                'payment_amount' => '100.2500',
                'business_date' => '2026-07-01',
                'sale_id' => 101,
            ],
            [
                'payment_id' => 12,
                'payment_amount' => '200.7500',
                'business_date' => '2026-07-02',
                'sale_id' => 102,
            ],
        ]);

        $expectedHash = hash(
            'sha256',
            json_encode(
                [11, 12],
                JSON_THROW_ON_ERROR
            )
        );

        $result = (
            new FinancePaymentPostingPolicyCsvValidator()
        )->validate(
            $path,
            2,
            '301.0000',
            $expectedHash,
            '2026-08-01'
        );

        self::assertSame(
            2,
            $result['count']
        );

        self::assertSame(
            '301.0000',
            $result['total']
        );

        self::assertSame(
            $expectedHash,
            $result['ids_sha256']
        );
    }

    public function test_rejects_payment_10(): void
    {
        $path = $this->writeCsv([
            [
                'payment_id' => 10,
                'payment_amount' => '2500.0000',
                'business_date' => '2026-06-24',
                'sale_id' => 10,
            ],
        ]);

        $this->expectException(
            RuntimeException::class
        );

        $this->expectExceptionMessage(
            'Deferred payment 10 cannot be included.'
        );

        (
            new FinancePaymentPostingPolicyCsvValidator()
        )->validate(
            $path,
            1,
            '2500.0000',
            hash(
                'sha256',
                json_encode(
                    [10],
                    JSON_THROW_ON_ERROR
                )
            ),
            '2026-08-01'
        );
    }

    public function test_rejects_payment_on_boundary(): void
    {
        $path = $this->writeCsv([
            [
                'payment_id' => 15,
                'payment_amount' => '100.0000',
                'business_date' => '2026-08-01',
                'sale_id' => 105,
            ],
        ]);

        $this->expectException(
            RuntimeException::class
        );

        $this->expectExceptionMessage(
            'Payment 15 is not before the policy boundary.'
        );

        (
            new FinancePaymentPostingPolicyCsvValidator()
        )->validate(
            $path,
            1,
            '100.0000',
            hash(
                'sha256',
                json_encode(
                    [15],
                    JSON_THROW_ON_ERROR
                )
            ),
            '2026-08-01'
        );
    }

    public function test_rejects_duplicate_payment(): void
    {
        $path = $this->writeCsv([
            [
                'payment_id' => 20,
                'payment_amount' => '50.0000',
                'business_date' => '2026-07-01',
                'sale_id' => 120,
            ],
            [
                'payment_id' => 20,
                'payment_amount' => '50.0000',
                'business_date' => '2026-07-01',
                'sale_id' => 120,
            ],
        ]);

        $this->expectException(
            RuntimeException::class
        );

        $this->expectExceptionMessage(
            'Duplicate payment ID 20.'
        );

        (
            new FinancePaymentPostingPolicyCsvValidator()
        )->validate(
            $path,
            2,
            '100.0000',
            hash(
                'sha256',
                json_encode(
                    [20],
                    JSON_THROW_ON_ERROR
                )
            ),
            '2026-08-01'
        );
    }

    private function writeCsv(
        array $rows
    ): string {
        $path = tempnam(
            sys_get_temp_dir(),
            'finance-policy-'
        );

        if ($path === false) {
            self::fail(
                'Unable to create temporary CSV.'
            );
        }

        $this->temporaryFiles[] = $path;

        $handle = fopen($path, 'wb');

        if (! is_resource($handle)) {
            self::fail(
                'Unable to open temporary CSV.'
            );
        }

        fputcsv(
            $handle,
            [
                'payment_id',
                'payment_amount',
                'business_date',
                'sale_id',
                'payment_status',
                'finance_link_count',
                'validation_status',
            ]
        );

        foreach ($rows as $row) {
            fputcsv(
                $handle,
                [
                    $row['payment_id'],
                    $row['payment_amount'],
                    $row['business_date'],
                    $row['sale_id'],
                    'completed',
                    0,
                    'VALID',
                ]
            );
        }

        fclose($handle);

        return $path;
    }
}
