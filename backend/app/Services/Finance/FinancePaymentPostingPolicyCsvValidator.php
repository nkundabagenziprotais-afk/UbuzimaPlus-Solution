<?php

declare(strict_types=1);

namespace App\Services\Finance;

use InvalidArgumentException;
use RuntimeException;

final class FinancePaymentPostingPolicyCsvValidator
{
    /**
     * @return array{
     *     rows:array<int,array{
     *         payment_id:int,
     *         payment_amount:string,
     *         business_date:string,
     *         sale_id:?int
     *     }>,
     *     count:int,
     *     total:string,
     *     ids_sha256:string,
     *     csv_sha256:string
     * }
     */
    public function validate(
        string $path,
        int $expectedCount,
        string $expectedTotal,
        string $expectedIdsSha256,
        string $effectiveDate,
        array $deferredPaymentIds = [10]
    ): array {
        if (! is_file($path)) {
            throw new InvalidArgumentException(
                'Approved payment CSV does not exist.'
            );
        }

        $handle = fopen($path, 'rb');

        if (! is_resource($handle)) {
            throw new RuntimeException(
                'Approved payment CSV cannot be opened.'
            );
        }

        $header = fgetcsv($handle);

        if (! is_array($header)) {
            fclose($handle);

            throw new RuntimeException(
                'Approved payment CSV header is missing.'
            );
        }

        $header[0] = preg_replace(
            '/^\xEF\xBB\xBF/',
            '',
            (string) $header[0]
        );

        foreach (
            [
                'payment_id',
                'payment_amount',
                'business_date',
            ]
            as $requiredColumn
        ) {
            if (
                ! in_array(
                    $requiredColumn,
                    $header,
                    true
                )
            ) {
                fclose($handle);

                throw new RuntimeException(
                    "Approved payment CSV is missing {$requiredColumn}."
                );
            }
        }

        $rows = [];
        $seen = [];
        $totalUnits = 0;

        while (
            (
                $values = fgetcsv($handle)
            ) !== false
        ) {
            if ($values === [null]) {
                continue;
            }

            $values = array_pad(
                $values,
                count($header),
                ''
            );

            $row = array_combine(
                $header,
                array_slice(
                    $values,
                    0,
                    count($header)
                )
            );

            if (! is_array($row)) {
                fclose($handle);

                throw new RuntimeException(
                    'Approved payment CSV row is invalid.'
                );
            }

            $paymentId = filter_var(
                $row['payment_id'],
                FILTER_VALIDATE_INT,
                [
                    'options' => [
                        'min_range' => 1,
                    ],
                ]
            );

            if ($paymentId === false) {
                fclose($handle);

                throw new RuntimeException(
                    'Approved payment CSV contains an invalid payment ID.'
                );
            }

            if (
                in_array(
                    $paymentId,
                    $deferredPaymentIds,
                    true
                )
            ) {
                fclose($handle);

                throw new RuntimeException(
                    "Deferred payment {$paymentId} cannot be included."
                );
            }

            if (isset($seen[$paymentId])) {
                fclose($handle);

                throw new RuntimeException(
                    "Duplicate payment ID {$paymentId}."
                );
            }

            $businessDate = trim(
                (string) $row['business_date']
            );

            if (
                preg_match(
                    '/^\d{4}-\d{2}-\d{2}$/',
                    $businessDate
                ) !== 1
            ) {
                fclose($handle);

                throw new RuntimeException(
                    "Payment {$paymentId} has an invalid Business Date."
                );
            }

            if (
                $businessDate
                >= $effectiveDate
            ) {
                fclose($handle);

                throw new RuntimeException(
                    "Payment {$paymentId} is not before the policy boundary."
                );
            }

            if (
                isset($row['payment_status'])
                && trim(
                    (string) $row['payment_status']
                ) !== ''
                && strtolower(
                    trim(
                        (string) $row['payment_status']
                    )
                ) !== 'completed'
            ) {
                fclose($handle);

                throw new RuntimeException(
                    "Payment {$paymentId} is not completed in the evidence CSV."
                );
            }

            if (
                isset($row['finance_link_count'])
                && trim(
                    (string) $row['finance_link_count']
                ) !== ''
                && (int) $row['finance_link_count']
                    !== 0
            ) {
                fclose($handle);

                throw new RuntimeException(
                    "Payment {$paymentId} already has a Finance link in the evidence CSV."
                );
            }

            if (
                isset($row['validation_status'])
                && trim(
                    (string) $row['validation_status']
                ) !== ''
                && strtoupper(
                    trim(
                        (string) $row['validation_status']
                    )
                ) !== 'VALID'
            ) {
                fclose($handle);

                throw new RuntimeException(
                    "Payment {$paymentId} is not validated in the evidence CSV."
                );
            }

            $amountUnits = $this->toUnits(
                (string) $row['payment_amount']
            );

            $saleId = null;

            if (
                isset($row['sale_id'])
                && trim(
                    (string) $row['sale_id']
                ) !== ''
            ) {
                $candidateSaleId = filter_var(
                    $row['sale_id'],
                    FILTER_VALIDATE_INT,
                    [
                        'options' => [
                            'min_range' => 1,
                        ],
                    ]
                );

                if ($candidateSaleId === false) {
                    fclose($handle);

                    throw new RuntimeException(
                        "Payment {$paymentId} has an invalid sale ID."
                    );
                }

                $saleId = $candidateSaleId;
            }

            $seen[$paymentId] = true;

            $rows[] = [
                'payment_id' =>
                    $paymentId,

                'payment_amount' =>
                    $this->formatUnits(
                        $amountUnits
                    ),

                'business_date' =>
                    $businessDate,

                'sale_id' =>
                    $saleId,
            ];

            $totalUnits += $amountUnits;
        }

        fclose($handle);

        usort(
            $rows,
            static fn (
                array $left,
                array $right
            ): int =>
                $left['payment_id']
                <=> $right['payment_id']
        );

        $ids = array_column(
            $rows,
            'payment_id'
        );

        $count = count($rows);

        $total = $this->formatUnits(
            $totalUnits
        );

        $idsHash = hash(
            'sha256',
            json_encode(
                $ids,
                JSON_THROW_ON_ERROR
            )
        );

        if ($count !== $expectedCount) {
            throw new RuntimeException(
                "Approved payment count is {$count}; expected {$expectedCount}."
            );
        }

        if (
            $total
            !== $this->normalise(
                $expectedTotal
            )
        ) {
            throw new RuntimeException(
                "Approved payment total is {$total}; expected {$expectedTotal}."
            );
        }

        if (
            $idsHash
            !== strtolower(
                $expectedIdsSha256
            )
        ) {
            throw new RuntimeException(
                'Approved payment-ID SHA-256 differs.'
            );
        }

        return [
            'rows' =>
                $rows,

            'count' =>
                $count,

            'total' =>
                $total,

            'ids_sha256' =>
                $idsHash,

            'csv_sha256' =>
                hash_file(
                    'sha256',
                    $path
                ),
        ];
    }

    public function normalise(
        string $value
    ): string {
        return $this->formatUnits(
            $this->toUnits(
                $value
            )
        );
    }

    private function toUnits(
        string $value
    ): int {
        $normalised = str_replace(
            ',',
            '',
            trim($value)
        );

        if (
            preg_match(
                '/^\d+(?:\.\d{1,4})?$/',
                $normalised
            ) !== 1
        ) {
            throw new RuntimeException(
                "Invalid four-decimal amount: {$value}"
            );
        }

        [
            $whole,
            $fraction,
        ] = array_pad(
            explode(
                '.',
                $normalised,
                2
            ),
            2,
            ''
        );

        $fraction = str_pad(
            $fraction,
            4,
            '0'
        );

        return ((int) $whole * 10000)
            + (int) $fraction;
    }

    private function formatUnits(
        int $units
    ): string {
        return intdiv(
            $units,
            10000
        )
            . '.'
            . str_pad(
                (string) (
                    $units % 10000
                ),
                4,
                '0',
                STR_PAD_LEFT
            );
    }
}
