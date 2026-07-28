<?php

namespace App\Services\Tax;

use App\Models\ProductCategory;
use App\Models\Tenant;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

final class BusinessTaxCategoryService
{
    public const CATEGORY_TYPE = 'business_tax';

    private const DEFAULT_CATEGORIES = [
        'ESSENTIAL_MEDICINE' => 'Essential Medicine',
        'OTHER_HUMAN_MEDICINE' => 'Other Human Medicine',
        'OTC_CONSUMER_HEALTH' => 'OTC and Consumer Health',
        'ORAL_DENTAL_CARE' => 'Oral and Dental Care',
        'MEDICAL_DEVICE_DIAGNOSTIC' => 'Medical Device and Diagnostic',
        'MEDICAL_CONSUMABLE' => 'Medical Consumable',
        'COSMETICS_BEAUTY' => 'Cosmetics and Beauty',
        'NUTRITION_SUPPLEMENTS' => 'Nutrition and Supplements',
        'PERSONAL_CARE_HYGIENE' => 'Personal Care and Hygiene',
        'MOTHER_BABY_CARE' => 'Mother and Baby Care',
        'SANITARY_FEMININE_CARE' => 'Sanitary and Feminine Care',
        'GENERAL_MERCHANDISE' => 'General Merchandise',
        'UNCLASSIFIED_REVIEW_REQUIRED' => 'Unclassified — Review Required',
    ];

    public function bootstrapForTenant(Tenant $tenant): Collection
    {
        return collect(self::DEFAULT_CATEGORIES)
            ->map(function (
                string $name,
                string $code
            ) use ($tenant): ProductCategory {
                $category = ProductCategory::query()->firstOrNew([
                    'tenant_id' => $tenant->id,
                    'code' => $code,
                ]);

                if (
                    $category->exists
                    && $category->category_type !== self::CATEGORY_TYPE
                ) {
                    throw ValidationException::withMessages([
                        'business_categories' => [
                            "Category code {$code} already exists for this "
                            .'tenant under a different category type.',
                        ],
                    ]);
                }

                if (! $category->exists) {
                    $category->fill([
                        'uuid' => (string) Str::uuid(),
                        'tenant_id' => $tenant->id,
                        'parent_id' => null,
                        'name' => $name,
                        'code' => $code,
                        'category_type' => self::CATEGORY_TYPE,
                        'status' => 'active',
                        'description' => $this->descriptionFor($code),
                        'metadata' => [
                            'tax_classification_note' =>
                                $this->classificationNote($code),
                            'vat_exemption_proof_required' =>
                                $code === 'ESSENTIAL_MEDICINE',
                            'system_bootstrap' => true,
                        ],
                    ]);

                    $category->save();

                    return $category;
                }

                $metadata = is_array($category->metadata)
                    ? $category->metadata
                    : [];

                $requiredMetadata = [
                    'tax_classification_note' =>
                        $this->classificationNote($code),
                    'vat_exemption_proof_required' =>
                        $code === 'ESSENTIAL_MEDICINE',
                    'system_bootstrap' => true,
                ];

                $mergedMetadata = array_merge(
                    $metadata,
                    $requiredMetadata
                );

                if ($mergedMetadata !== $metadata) {
                    $category->metadata = $mergedMetadata;
                    $category->save();
                }

                return $category;
            })
            ->values();
    }

    public function activeForTenant(Tenant $tenant): Collection
    {
        return ProductCategory::query()
            ->where('tenant_id', $tenant->id)
            ->where('category_type', self::CATEGORY_TYPE)
            ->where('status', 'active')
            ->orderBy('name')
            ->get();
    }

    public function resolveForTenant(
        Tenant $tenant,
        ?int $categoryId
    ): ?ProductCategory {
        if ($categoryId === null) {
            return null;
        }

        $category = ProductCategory::query()
            ->where('tenant_id', $tenant->id)
            ->where('category_type', self::CATEGORY_TYPE)
            ->where('status', 'active')
            ->whereKey($categoryId)
            ->first();

        if (! $category) {
            throw ValidationException::withMessages([
                'business_category_id' => [
                    'The selected business/tax category is not valid '
                    .'for this tenant.',
                ],
            ]);
        }

        return $category;
    }

    public function defaultReviewCategory(
        Tenant $tenant
    ): ?ProductCategory {
        return ProductCategory::query()
            ->where('tenant_id', $tenant->id)
            ->where('category_type', self::CATEGORY_TYPE)
            ->where('code', 'UNCLASSIFIED_REVIEW_REQUIRED')
            ->where('status', 'active')
            ->first();
    }

    private function descriptionFor(string $code): string
    {
        return match ($code) {
            'ESSENTIAL_MEDICINE' =>
                'Medicines that may require validation against the '
                .'official exemption list.',

            'COSMETICS_BEAUTY' =>
                'Cosmetics and beauty products normally requiring '
                .'standard VAT treatment.',

            'NUTRITION_SUPPLEMENTS' =>
                'Nutrition and supplement products requiring '
                .'classification review.',

            'UNCLASSIFIED_REVIEW_REQUIRED' =>
                'Temporary category used when manual business or tax '
                .'classification is required.',

            default =>
                'Business and tax classification category.',
        };
    }

    private function classificationNote(string $code): string
    {
        if ($code === 'ESSENTIAL_MEDICINE') {
            return 'Category selection alone does not grant VAT exemption. '
                .'The product must be validated against the approved '
                .'exemption list or other documented authority.';
        }

        return 'Category supports reporting and tax-rule selection. '
            .'Tax treatment is determined by approved tax configuration.';
    }
}
