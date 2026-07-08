<?php

namespace Tests\Unit\PharmaCo360;

use App\Services\PharmaCo360\SaleReturnPolicyService;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class SaleReturnPolicyServiceTest extends TestCase
{
    public function test_line_refund_is_prorated(): void
    {
        $service = new SaleReturnPolicyService();

        $this->assertSame(
            60.0,
            $service->calculateLineRefund(
                120.0,
                3.0,
                1.5
            )
        );
    }

    public function test_quantity_cannot_exceed_remaining_quantity(): void
    {
        $service = new SaleReturnPolicyService();

        $this->expectException(
            ValidationException::class
        );

        $service->ensureQuantityAvailable(
            5.0,
            3.0,
            2.5
        );
    }

    public function test_only_dispensed_sales_are_returnable(): void
    {
        $service = new SaleReturnPolicyService();

        $this->expectException(
            ValidationException::class
        );

        $service->ensureSaleStatusReturnable(
            'draft'
        );
    }

    public function test_full_refund_has_refunded_payment_status(): void
    {
        $service = new SaleReturnPolicyService();

        $this->assertSame(
            'refunded',
            $service->paymentStatusAfterRefund(
                100.0,
                0.0,
                0.0,
                100.0
            )
        );
    }

    public function test_partial_refund_can_remain_paid(): void
    {
        $service = new SaleReturnPolicyService();

        $this->assertSame(
            'paid',
            $service->paymentStatusAfterRefund(
                100.0,
                80.0,
                0.0,
                20.0
            )
        );
    }
}
