<?php

namespace Tests\Unit\PharmaCo360;

use App\Services\PharmaCo360\PosSellableBatchCombiner;
use PHPUnit\Framework\TestCase;

final class PosSellableBatchCombinerTest extends TestCase
{
    public function test_it_combines_same_product_and_branch_in_fefo_order(): void
    {
        $result = (new PosSellableBatchCombiner())->combine([
            [
                'id' => 502,
                'product' => ['id' => 90],
                'branch' => ['id' => 4],
                'batch_number' => 'B',
                'expiry_date' => '2027-02-01',
                'received_at' => '2026-07-02',
                'quantity_on_hand' => 6,
                'quantity_reserved' => 0,
                'available_quantity' => 6,
                'amount' => 600,
                'metadata' => [],
            ],
            [
                'id' => 501,
                'product' => ['id' => 90],
                'branch' => ['id' => 4],
                'batch_number' => 'A',
                'expiry_date' => '2027-01-01',
                'received_at' => '2026-07-01',
                'quantity_on_hand' => 10,
                'quantity_reserved' => 0,
                'available_quantity' => 10,
                'amount' => 1000,
                'metadata' => [],
            ],
            [
                'id' => 601,
                'product' => ['id' => 90],
                'branch' => ['id' => 5],
                'batch_number' => 'OTHER-BRANCH',
                'expiry_date' => '2026-12-01',
                'received_at' => '2026-06-01',
                'quantity_on_hand' => 4,
                'quantity_reserved' => 0,
                'available_quantity' => 4,
                'amount' => 400,
                'metadata' => [],
            ],
        ]);

        self::assertCount(2, $result);

        $branchFour = collect($result)->first(
            fn (array $batch): bool =>
                (int) $batch['branch']['id'] === 4
        );

        self::assertNotNull($branchFour);
        self::assertSame(501, $branchFour['id']);
        self::assertSame('A', $branchFour['batch_number']);
        self::assertSame(
            16.0,
            $branchFour['available_quantity']
        );
        self::assertSame(
            [501, 502],
            $branchFour['metadata']['pos_combined_batch_ids']
        );

        $branchFive = collect($result)->first(
            fn (array $batch): bool =>
                (int) $batch['branch']['id'] === 5
        );

        self::assertNotNull($branchFive);
        self::assertSame(
            4.0,
            $branchFive['available_quantity']
        );
    }

    public function test_it_combines_batches_even_when_the_second_batch_appears_after_one_thousand_records(): void
    {
        $batches = [
            [
                'id' => 501,
                'product' => ['id' => 90],
                'branch' => ['id' => 4],
                'batch_number' => 'A',
                'expiry_date' => '2027-01-01',
                'received_at' => '2026-07-01',
                'quantity_on_hand' => 10,
                'quantity_reserved' => 0,
                'available_quantity' => 10,
                'amount' => 1000,
                'metadata' => [],
            ],
        ];

        for ($index = 0; $index < 1000; $index++) {
            $batches[] = [
                'id' => 10000 + $index,
                'product' => ['id' => 1000 + $index],
                'branch' => ['id' => 4],
                'batch_number' => 'OTHER-' . $index,
                'expiry_date' => '2027-06-01',
                'received_at' => '2026-07-01',
                'quantity_on_hand' => 1,
                'quantity_reserved' => 0,
                'available_quantity' => 1,
                'amount' => 100,
                'metadata' => [],
            ];
        }

        $batches[] = [
            'id' => 502,
            'product' => ['id' => 90],
            'branch' => ['id' => 4],
            'batch_number' => 'B',
            'expiry_date' => '2028-01-01',
            'received_at' => '2026-07-02',
            'quantity_on_hand' => 6,
            'quantity_reserved' => 0,
            'available_quantity' => 6,
            'amount' => 600,
            'metadata' => [],
        ];

        $result =
            (new PosSellableBatchCombiner())
                ->combine($batches);

        $combined = collect($result)->first(
            fn (array $batch): bool =>
                (int) $batch['product']['id'] === 90
                && (int) $batch['branch']['id'] === 4
        );

        self::assertNotNull($combined);
        self::assertSame(501, $combined['id']);
        self::assertSame(
            16.0,
            $combined['available_quantity']
        );
        self::assertSame(
            [501, 502],
            $combined['metadata']['pos_combined_batch_ids']
        );
    }

}
