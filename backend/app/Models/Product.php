<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Product extends Model
{
    protected $fillable = [
        'uuid',
        'tenant_id',
        'product_category_id',
        'business_category_id',
        'name',
        'generic_name',
        'brand_name',
        'sku',
        'barcode',
        'registration_number',
        'hs_code',
        'dosage_form',
        'strength',
        'unit',
        'selling_unit',
        'base_unit',
        'quantity_per_selling_unit',
        'allow_other_quantity',
        'default_pos_quantity_mode',
        'selling_unit_notes',
        'ai_suggested_quantity_per_unit',
        'ai_suggestion_status',
        'ai_suggestion_confidence',
        'ai_suggestion_explanation',
        'ai_suggestion_source',
        'ai_suggestion_reference',
        'ai_suggestion_reviewed_by',
        'ai_suggestion_reviewed_at',
        'pack_size',
        'route_of_administration',
        'product_type',
        'regulatory_status',
        'tax_classification_status',
        'tax_classification_version',
        'requires_prescription',
        'is_controlled',
        'reorder_level',
        'minimum_stock_level',
        'maximum_stock_level',
        'status',
        'metadata',
    ];

    protected $casts = [
        'requires_prescription' => 'boolean',
        'is_controlled' => 'boolean',
        'quantity_per_selling_unit' => 'decimal:4',
        'allow_other_quantity' => 'boolean',
        'ai_suggested_quantity_per_unit' => 'decimal:4',
        'ai_suggestion_confidence' => 'decimal:2',
        'ai_suggestion_reviewed_at' => 'datetime',
        'reorder_level' => 'decimal:2',
        'minimum_stock_level' => 'decimal:2',
        'maximum_stock_level' => 'decimal:2',
        'tax_classification_version' => 'integer',
        'metadata' => 'array',
    ];

    public function aiSuggestionReviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'ai_suggestion_reviewed_by');
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(ProductCategory::class, 'product_category_id');
    }

    public function businessCategory(): BelongsTo
    {
        return $this->belongsTo(ProductCategory::class, 'business_category_id');
    }

    public function taxAssignments(): HasMany
    {
        return $this->hasMany(ProductTaxAssignment::class);
    }

    public function activeTaxAssignment(): HasMany
    {
        return $this->hasMany(ProductTaxAssignment::class)
            ->where('status', 'active');
    }

    public function stockBatches(): HasMany
    {
        return $this->hasMany(StockBatch::class);
    }

    public function stockMovements(): HasMany
    {
        return $this->hasMany(StockMovement::class);
    }
}
