<?php

namespace Tests\Unit\PharmaCo360;

use App\Services\PharmaCo360\PosMultiBatchCheckoutAllocator;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class PosMultiBatchCheckoutAllocatorTest extends TestCase
{
    public function test_one_line_is_allocated_across_fefo_batches(): void
    {
        $allocator =
            new PosMultiBatchCheckoutAllocator();

        $result = $allocator->allocateLine(
            [
                'product_id' => 100,
                'quantity' => 15,
                'unit_price' => 1000,
                'discount_amount' => 150,
                'tax_amount' => 270,
                'prescription_verified' => false,
            ],
            [
                [
                    'id' => 501,
                    'batch_number' => 'EARLIER',
                    'available_quantity' => 10,
                ],
                [
                    'id' => 502,
                    'batch_number' => 'LATER',
                    'available_quantity' => 6,
                ],
            ]
        );

        $this->assertCount(2, $result);

        $this->assertSame(
            501,
            $result[0]['stock_batch_id']
        );

        $this->assertSame(
            10.0,
            $result[0]['quantity']
        );

        $this->assertSame(
            502,
            $result[1]['stock_batch_id']
        );

        $this->assertSame(
            5.0,
            $result[1]['quantity']
        );

        $this->assertSame(
            15.0,
            array_sum(
                array_column(
                    $result,
                    'quantity'
                )
            )
        );

        $this->assertSame(
            150.0,
            array_sum(
                array_column(
                    $result,
                    'discount_amount'
                )
            )
        );

        $this->assertSame(
            270.0,
            array_sum(
                array_column(
                    $result,
                    'tax_amount'
                )
            )
        );
    }

    public function test_combined_shortage_is_rejected(): void
    {
        $allocator =
            new PosMultiBatchCheckoutAllocator();

        $this->expectException(
            ValidationException::class
        );

        $allocator->allocateLine(
            [
                'product_id' => 100,
                'quantity' => 17,
                'unit_price' => 1000,
            ],
            [
                [
                    'id' => 501,
                    'available_quantity' => 10,
                ],
                [
                    'id' => 502,
                    'available_quantity' => 6,
                ],
            ]
        );
    }
}
