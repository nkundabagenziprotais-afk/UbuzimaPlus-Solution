<?php

namespace Tests\Feature\PharmaCo360;

use App\Models\PharmacoCustomer;
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
                    'risk_mix' => [
                        'analysis_basis',
                        'currency',
                        'total_inventory_value',
                        'low_stock_value',
                        'near_expiry_value',
                        'expired_quarantined_value',
                        'slow_overstock_value',
                        'healthy_stock_value',
                        'total_value_at_risk',
                        'value_at_risk_percent',
                        'executive_recommendation',
                    ],
                    'general_stock' => [
                        'analysis_basis',
                        'currency',
                        'item_count',
                        'total_value',
                        'items_below_minimum',
                        'zero_stock_items',
                        'estimated_shortage_exposure_value',
                        'slow_moving_value',
                        'average_stock_cover_days',
                        'predicted_stockout_items',
                        'recommended_reorder_value',
                        'ai_health_score',
                        'ai_recommendation',
                    ],
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
                    'risk_mix',
                    'general_stock',
                    'locations',
                ],
            ]);
    }

    public function test_inventory_risk_values_reconcile_to_total_inventory_value(): void
    {
        $this->seed();

        $token = $this->loginAs(
            'admin@vitapharmaafrica.com'
        );

        $response = $this
            ->withHeader(
                'X-Tenant-Slug',
                'vitapharma'
            )
            ->withToken($token)
            ->getJson(
                '/api/v1/pharmaco/reports/inventory-valuation'
            )
            ->assertOk();

        $risk = $response->json(
            'inventory.risk_mix'
        );

        $bucketTotal =
            (float) $risk['low_stock_value']
            + (float) $risk['near_expiry_value']
            + (float) $risk[
                'expired_quarantined_value'
            ]
            + (float) $risk[
                'slow_overstock_value'
            ]
            + (float) $risk[
                'healthy_stock_value'
            ];

        $calculatedRisk =
            (float) $risk['low_stock_value']
            + (float) $risk['near_expiry_value']
            + (float) $risk[
                'expired_quarantined_value'
            ]
            + (float) $risk[
                'slow_overstock_value'
            ];

        $this->assertEqualsWithDelta(
            (float) $risk[
                'total_inventory_value'
            ],
            $bucketTotal,
            0.05
        );

        $this->assertEqualsWithDelta(
            (float) $risk[
                'total_value_at_risk'
            ],
            $calculatedRisk,
            0.05
        );

        $healthScore = (float) $response->json(
            'inventory.general_stock.ai_health_score'
        );

        $this->assertGreaterThanOrEqual(
            0,
            $healthScore
        );

        $this->assertLessThanOrEqual(
            100,
            $healthScore
        );
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


    public function test_tenant_admin_can_view_customer_credit_exposure_report(): void
    {
        $this->seed();

        $token = $this->loginAs('admin@vitapharmaafrica.com');
        $customer = PharmacoCustomer::firstOrFail();

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->patchJson("/api/v1/pharmaco/customers/{$customer->id}/credit", [
                'credit_limit' => 100000,
                'credit_terms_days' => 30,
                'credit_status' => 'enabled',
            ])
            ->assertOk();

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->postJson('/api/v1/pharmaco/receivables', [
                'pharmaco_customer_id' => $customer->id,
                'amount' => 25000,
                'due_date' => now()->subDays(10)->toDateString(),
                'notes' => 'Customer credit exposure report test.',
            ])
            ->assertCreated();

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->getJson('/api/v1/pharmaco/reports/customer-credit-exposure')
            ->assertOk()
            ->assertJsonPath('tenant.slug', 'vitapharma')
            ->assertJsonPath('customer_credit_exposure.open_balance', 25000)
            ->assertJsonPath('customer_credit_exposure.overdue_balance', 25000)
            ->assertJsonPath('customer_credit_exposure.current_balance', 0)
            ->assertJsonPath('customer_credit_exposure.credit_limit_total', 100000)
            ->assertJsonPath('customer_credit_exposure.customers_on_credit', 1)
            ->assertJsonPath('customer_credit_exposure.open_receivables_count', 1)
            ->assertJsonPath('customer_credit_exposure.overdue_receivables_count', 1)
            ->assertJsonPath('customer_credit_exposure.aging_buckets.1.code', 'days_1_30')
            ->assertJsonPath('customer_credit_exposure.aging_buckets.1.balance', 25000)
            ->assertJsonPath('customer_credit_exposure.aging_buckets.1.receivables_count', 1);
    }


    public function test_tenant_admin_can_view_customer_credit_exposure_export_rows(): void
    {
        $this->seed();

        $token = $this->loginAs('admin@vitapharmaafrica.com');

        $tenant = \App\Models\Tenant::query()
            ->where('slug', 'vitapharma')
            ->firstOrFail();

        $customer = PharmacoCustomer::query()
            ->where('tenant_id', $tenant->id)
            ->firstOrFail();

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->patchJson("/api/v1/pharmaco/customers/{$customer->id}/credit", [
                'credit_limit' => 100000,
                'credit_terms_days' => 30,
                'credit_status' => 'enabled',
            ])
            ->assertOk();

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->postJson('/api/v1/pharmaco/receivables', [
                'pharmaco_customer_id' => $customer->id,
                'amount' => 25000,
                'due_date' => now()->subDays(10)->toDateString(),
                'notes' => 'Customer credit exposure export test.',
            ])
            ->assertCreated();

        $this->withHeader('X-Tenant-Slug', 'vitapharma')
            ->withToken($token)
            ->getJson('/api/v1/pharmaco/reports/customer-credit-exposure/export')
            ->assertOk()
            ->assertJsonPath('tenant.slug', 'vitapharma')
            ->assertJsonPath('export.report', 'customer_credit_exposure')
            ->assertJsonPath('export.format', 'json')
            ->assertJsonPath('export.rows_count', 1)
            ->assertJsonPath('rows.0.customer_id', $customer->id)
            ->assertJsonPath('rows.0.balance_amount', 25000)
            ->assertJsonPath('rows.0.days_overdue', 10)
            ->assertJsonPath('rows.0.aging_bucket_code', 'days_1_30')
            ->assertJsonPath('rows.0.aging_bucket_label', '1–30 days');
    }

    public function test_customer_credit_exposure_report_requires_tenant_header(): void
    {
        $this->seed();

        $token = $this->loginAs('admin@vitapharmaafrica.com');

        $this->withToken($token)
            ->getJson('/api/v1/pharmaco/reports/customer-credit-exposure')
            ->assertStatus(422);
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
