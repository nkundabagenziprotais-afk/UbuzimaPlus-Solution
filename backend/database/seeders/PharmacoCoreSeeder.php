<?php

namespace Database\Seeders;

use App\Models\Branch;
use App\Models\BranchDepartment;
use App\Models\PharmacyProfile;
use App\Models\Tenant;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class PharmacoCoreSeeder extends Seeder
{
    public function run(): void
    {
        $tenant = Tenant::where('slug', 'vitapharma')->firstOrFail();

        $branch = Branch::where('tenant_id', $tenant->id)
            ->where('code', 'HQ')
            ->firstOrFail();

        PharmacyProfile::updateOrCreate(
            ['tenant_id' => $tenant->id],
            [
                'uuid' => (string) Str::uuid(),
                'legal_name' => 'VitaPharma Africa Ltd',
                'trading_name' => 'VitaPharma',
                'pharmacy_category' => 'retail_pharmacy',
                'ownership_type' => 'private_limited_company',
                'license_number' => 'VITA-RFDA-DEV-001',
                'tin' => 'VITA-TIN-DEV-001',
                'rssb_provider_code' => null,
                'insurance_partner_code' => null,
                'regulator_name' => 'Rwanda FDA',
                'primary_contact_name' => 'VitaPharma Operations Lead',
                'primary_phone' => '+250700000000',
                'primary_email' => 'operations@vitapharmaafrica.com',
                'website' => 'https://vitapharmaafrica.com',
                'country' => 'Rwanda',
                'city' => 'Kigali',
                'district' => 'Gasabo',
                'sector' => null,
                'physical_address' => 'VitaPharma Main Branch, Kigali',
                'capabilities' => [
                    'retail_sales',
                    'insurance_dispensing',
                    'stock_management',
                    'supplier_ordering',
                    'customer_follow_up',
                ],
                'insurance_partners' => [
                    'RSSB',
                    'Private insurers',
                    'Corporate schemes',
                ],
                'operating_hours' => [
                    'monday_friday' => '08:00-20:00',
                    'saturday' => '09:00-18:00',
                    'sunday' => '10:00-16:00',
                ],
                'metadata' => [
                    'seeded_for' => 'phase_2_1',
                    'profile_status' => 'development_reference',
                ],
                'status' => 'active',
                'is_primary' => true,
                'verified_at' => now(),
            ]
        );

        $departments = [
            [
                'name' => 'Dispensary',
                'code' => 'DISPENSARY',
                'department_type' => 'clinical_operations',
                'is_revenue_center' => true,
                'notes' => 'Prescription validation and medicine dispensing.',
            ],
            [
                'name' => 'Cashier',
                'code' => 'CASHIER',
                'department_type' => 'finance_operations',
                'is_revenue_center' => true,
                'notes' => 'Customer payment, receipt and billing counter.',
            ],
            [
                'name' => 'Store',
                'code' => 'STORE',
                'department_type' => 'inventory_operations',
                'is_revenue_center' => false,
                'notes' => 'Stock receiving, storage and internal issuance.',
            ],
            [
                'name' => 'Procurement',
                'code' => 'PROCUREMENT',
                'department_type' => 'supply_chain',
                'is_revenue_center' => false,
                'notes' => 'Supplier ordering, purchase requests and reorder follow-up.',
            ],
            [
                'name' => 'Customer Care',
                'code' => 'CUSTOMER_CARE',
                'department_type' => 'customer_success',
                'is_revenue_center' => false,
                'notes' => 'Customer engagement, reminders and follow-up.',
            ],
        ];

        foreach ($departments as $department) {
            BranchDepartment::updateOrCreate(
                [
                    'branch_id' => $branch->id,
                    'code' => $department['code'],
                ],
                [
                    'uuid' => (string) Str::uuid(),
                    'tenant_id' => $tenant->id,
                    'name' => $department['name'],
                    'department_type' => $department['department_type'],
                    'phone' => null,
                    'email' => null,
                    'opening_time' => '08:00',
                    'closing_time' => '20:00',
                    'is_revenue_center' => $department['is_revenue_center'],
                    'operating_status' => 'active',
                    'notes' => $department['notes'],
                    'metadata' => [
                        'seeded_for' => 'phase_2_1',
                    ],
                ]
            );
        }
    }
}
