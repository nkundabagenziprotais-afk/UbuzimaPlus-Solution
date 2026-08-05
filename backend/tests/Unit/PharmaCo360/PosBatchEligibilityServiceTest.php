<?php

namespace Tests\Unit\PharmaCo360;

use App\Services\PharmaCo360\PosBatchEligibilityService;
use DateTimeImmutable;
use InvalidArgumentException;
use PHPUnit\Framework\TestCase;

final class PosBatchEligibilityServiceTest extends TestCase
{
    private PosBatchEligibilityService $service;

    protected function setUp(): void
    {
        parent::setUp();

        $this->service =
            new PosBatchEligibilityService();
    }

    public function test_batch_expiring_on_business_date_is_eligible(): void
    {
        self::assertTrue(
            $this->service->isExpiryEligible(
                '2026-08-04',
                '2026-08-04'
            )
        );
    }

    public function test_batch_expiring_after_business_date_is_eligible(): void
    {
        self::assertTrue(
            $this->service->isExpiryEligible(
                '2026-08-05',
                '2026-08-04'
            )
        );
    }

    public function test_batch_expiring_before_business_date_is_ineligible(): void
    {
        self::assertFalse(
            $this->service->isExpiryEligible(
                '2026-08-03',
                '2026-08-04'
            )
        );
    }

    public function test_undated_batch_is_eligible_when_policy_allows_it(): void
    {
        self::assertTrue(
            $this->service->isExpiryEligible(
                null,
                '2026-08-04',
                true
            )
        );
    }

    public function test_undated_batch_is_ineligible_when_policy_disallows_it(): void
    {
        self::assertFalse(
            $this->service->isExpiryEligible(
                null,
                '2026-08-04',
                false
            )
        );
    }

    public function test_date_objects_are_compared_without_timezone_conversion(): void
    {
        self::assertTrue(
            $this->service->isExpiryEligible(
                new DateTimeImmutable(
                    '2026-08-04 23:30:00+02:00'
                ),
                new DateTimeImmutable(
                    '2026-08-04 00:05:00+02:00'
                )
            )
        );
    }

    public function test_invalid_date_is_rejected(): void
    {
        $this->expectException(
            InvalidArgumentException::class
        );

        $this->service->isExpiryEligible(
            '04-08-2026',
            '2026-08-04'
        );
    }

    public function test_query_constraint_uses_inclusive_operator(): void
    {
        $query = new ExpiryEligibilityQueryRecorder();

        $result =
            $this->service->applyExpiryEligibility(
                $query,
                '2026-08-04'
            );

        self::assertSame($query, $result);

        self::assertSame(
            [
                [
                    'where_group',
                    [
                        [
                            'where_null',
                            'expiry_date',
                        ],
                        [
                            'or_where_date',
                            'expiry_date',
                            '>=',
                            '2026-08-04',
                        ],
                    ],
                ],
            ],
            $query->clauses
        );
    }

    public function test_query_constraint_can_disallow_undated_batches(): void
    {
        $query = new ExpiryEligibilityQueryRecorder();

        $this->service->applyExpiryEligibility(
            $query,
            '2026-08-04',
            'expiry_date',
            false
        );

        self::assertSame(
            [
                [
                    'where_group',
                    [
                        [
                            'where_date',
                            'expiry_date',
                            '>=',
                            '2026-08-04',
                        ],
                    ],
                ],
            ],
            $query->clauses
        );
    }
}

final class ExpiryEligibilityQueryRecorder
{
    /**
     * @var array<int, array<int, mixed>>
     */
    public array $clauses = [];

    public function where(callable $callback): self
    {
        $nested = new self();

        $callback($nested);

        $this->clauses[] = [
            'where_group',
            $nested->clauses,
        ];

        return $this;
    }

    public function whereNull(string $column): self
    {
        $this->clauses[] = [
            'where_null',
            $column,
        ];

        return $this;
    }

    public function orWhereDate(
        string $column,
        string $operator,
        string $date
    ): self {
        $this->clauses[] = [
            'or_where_date',
            $column,
            $operator,
            $date,
        ];

        return $this;
    }

    public function whereDate(
        string $column,
        string $operator,
        string $date
    ): self {
        $this->clauses[] = [
            'where_date',
            $column,
            $operator,
            $date,
        ];

        return $this;
    }
}
