<?php

namespace Tests\Feature\PharmaCo360;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PharmacoReportingAnalyticsApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_tenant_admin_can_view_reporting_overview(): void
    {
        $this->seed();

        $token = $this->loginAs('admin@vitapharmaafrica.com');

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->getJson('/api/v1/pharmaco/reports/overview')
            ->assertOk()
            ->assertJsonPath('tenant.slug', 'vitapharma')
            ->assertJsonStructure([
                'tenant' => ['id', 'name', 'slug'],
                'period' => ['start_date', 'end_date'],
                'inventory' => [
                    'batch_count',
                    'product_count',
                    'total_quantity_on_hand',
                    'total_cost_value',
                    'total_retail_value',
                    'estimated_margin_value',
                    'low_stock_batches',
                    'expired_batches',
                    'expiring_soon_batches',
                ],
                'sales' => [
                    'sale_count',
                    'draft_sale_count',
                    'dispensed_sale_count',
                    'total_sales_amount',
                    'paid_amount',
                    'balance_amount',
                    'payments_collected',
                ],
                'procurement' => [
                    'purchase_order_count',
                    'draft_purchase_order_count',
                    'approved_purchase_order_count',
                    'received_purchase_order_count',
                    'cancelled_purchase_order_count',
                    'total_purchase_order_amount',
                ],
                'payables' => [
                    'supplier_invoice_count',
                    'draft_invoice_count',
                    'approved_invoice_count',
                    'partially_paid_invoice_count',
                    'paid_invoice_count',
                    'overdue_invoice_count',
                    'total_invoice_amount',
                    'paid_amount',
                    'balance_amount',
                    'payments_recorded',
                ],
            ]);
    }

    public function test_tenant_admin_can_view_inventory_valuation_report(): void
    {
        $this->seed();

        $token = $this->loginAs('admin@vitapharmaafrica.com');

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->getJson('/api/v1/pharmaco/reports/inventory-valuation')
            ->assertOk()
            ->assertJsonPath('tenant.slug', 'vitapharma')
            ->assertJsonStructure([
                'inventory' => [
                    'batch_count',
                    'product_count',
                    'total_quantity_on_hand',
                    'total_cost_value',
                    'total_retail_value',
                    'estimated_margin_value',
                    'locations',
                ],
            ]);
    }

    public function test_tenant_admin_can_view_sales_summary_report_with_date_filters(): void
    {
        $this->seed();

        $token = $this->loginAs('admin@vitapharmaafrica.com');

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->getJson('/api/v1/pharmaco/reports/sales-summary?start_date=2026-01-01&end_date=2026-12-31')
            ->assertOk()
            ->assertJsonPath('period.start_date', '2026-01-01')
            ->assertJsonPath('period.end_date', '2026-12-31')
            ->assertJsonStructure([
                'sales' => [
                    'sale_count',
                    'draft_sale_count',
                    'dispensed_sale_count',
                    'total_sales_amount',
                    'paid_amount',
                    'balance_amount',
                    'payments_collected',
                    'payment_methods',
                ],
            ]);
    }

    public function test_tenant_admin_can_view_procurement_summary_report(): void
    {
        $this->seed();

        $token = $this->loginAs('admin@vitapharmaafrica.com');

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->getJson('/api/v1/pharmaco/reports/procurement-summary')
            ->assertOk()
            ->assertJsonStructure([
                'procurement' => [
                    'purchase_order_count',
                    'draft_purchase_order_count',
                    'approved_purchase_order_count',
                    'received_purchase_order_count',
                    'cancelled_purchase_order_count',
                    'total_purchase_order_amount',
                    'status_summary',
                ],
            ]);
    }

    public function test_tenant_admin_can_view_payables_summary_report(): void
    {
        $this->seed();

        $token = $this->loginAs('admin@vitapharmaafrica.com');

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->getJson('/api/v1/pharmaco/reports/payables-summary')
            ->assertOk()
            ->assertJsonStructure([
                'payables' => [
                    'supplier_invoice_count',
                    'draft_invoice_count',
                    'approved_invoice_count',
                    'partially_paid_invoice_count',
                    'paid_invoice_count',
                    'overdue_invoice_count',
                    'total_invoice_amount',
                    'paid_amount',
                    'balance_amount',
                    'payments_recorded',
                    'status_summary',
                ],
            ]);
    }

    public function test_reporting_endpoints_require_tenant_header(): void
    {
        $this->seed();

        $token = $this->loginAs('admin@vitapharmaafrica.com');

        $this->withToken($token)
            ->getJson('/api/v1/pharmaco/reports/overview')
            ->assertStatus(422);
    }

    public function test_reporting_endpoints_require_authentication(): void
    {
        $this->seed();

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->getJson('/api/v1/pharmaco/reports/overview')
            ->assertUnauthorized();
    }

    private function loginAs(string $email): string
    {
        $response = $this->postJson('/api/v1/auth/login', [
            'email' => $email,
            'password' => 'ChangeThisPassword123!',
            'device_name' => 'PharmaCo360 Reporting Test Client',
        ]);

        $response->assertOk();

        return $response->json('access_token');
    }
}
