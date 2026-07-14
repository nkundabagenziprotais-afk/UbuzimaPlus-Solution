<?php

namespace App\Services\Inventory;

use App\Models\ProductDuplicateProposal;
use App\Models\ProductPayerPrice;
use App\Models\ProductReconciliationBatch;
use App\Models\ProductReconciliationRow;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use RuntimeException;

class ProductReconciliationService
{
    public const REVIEW_STATUSES = [
        'pending',
        'approved',
        'rejected',
        'hold',
    ];

    public static function normalizeText(?string $value): string
    {
        $value = Str::ascii(Str::lower(trim((string) $value)));
        $value = preg_replace('/[^a-z0-9]+/u', ' ', $value) ?? '';
        $value = preg_replace('/\s+/u', ' ', $value) ?? '';

        return trim($value);
    }

    public static function normalizedKey(
        ?string $name,
        ?string $strength = null,
        ?string $dosageForm = null,
        ?string $pack = null
    ): string {
        return implode('|', array_map(
            static fn (?string $value): string => self::normalizeText($value),
            [$name, $strength, $dosageForm, $pack]
        ));
    }

    public function summary(int $tenantId): array
    {
        $rowQuery = ProductReconciliationRow::query()
            ->where('tenant_id', $tenantId);

        return [
            'batches' => ProductReconciliationBatch::query()
                ->where('tenant_id', $tenantId)
                ->count(),
            'rows' => (clone $rowQuery)->count(),
            'pending' => (clone $rowQuery)
                ->where('review_status', 'pending')
                ->count(),
            'approved' => (clone $rowQuery)
                ->where('review_status', 'approved')
                ->count(),
            'rejected' => (clone $rowQuery)
                ->where('review_status', 'rejected')
                ->count(),
            'on_hold' => (clone $rowQuery)
                ->where('review_status', 'hold')
                ->count(),
            'missing_candidates' => (clone $rowQuery)
                ->where('proposed_action', 'create_missing')
                ->count(),
            'correction_candidates' => (clone $rowQuery)
                ->where('proposed_action', 'update_existing')
                ->count(),
            'duplicate_candidates' => ProductDuplicateProposal::query()
                ->where('tenant_id', $tenantId)
                ->where('status', 'pending')
                ->count(),
            'payer_prices' => ProductPayerPrice::query()
                ->where('tenant_id', $tenantId)
                ->count(),
        ];
    }

    public function rows(int $tenantId, array $filters): LengthAwarePaginator
    {
        $query = ProductReconciliationRow::query()
            ->with([
                'batch:id,source_key,source_name,source_version,status',
                'matchedProduct:id,sku,name,generic_name,unit,status',
            ])
            ->where('tenant_id', $tenantId);

        if (! empty($filters['status'])) {
            $query->where('review_status', $filters['status']);
        }

        if (! empty($filters['action'])) {
            $query->where('proposed_action', $filters['action']);
        }

        if (! empty($filters['source'])) {
            $query->whereHas(
                'batch',
                static fn ($batch) => $batch->where('source_key', $filters['source'])
            );
        }

        if (! empty($filters['search'])) {
            $search = '%'.$filters['search'].'%';

            $query->where(static function ($builder) use ($search): void {
                $builder
                    ->where('product_name', 'like', $search)
                    ->orWhere('generic_name', 'like', $search)
                    ->orWhere('source_code', 'like', $search);
            });
        }

        return $query
            ->orderByRaw(
                "case review_status
                    when 'pending' then 0
                    when 'hold' then 1
                    when 'approved' then 2
                    else 3
                end"
            )
            ->orderByDesc('match_score')
            ->orderBy('id')
            ->paginate(
                max(1, min((int) ($filters['per_page'] ?? 50), 100))
            );
    }

    public function reviewRow(
        ProductReconciliationRow $row,
        int $tenantId,
        int $reviewerId,
        string $status,
        ?string $notes
    ): ProductReconciliationRow {
        if ($row->tenant_id !== $tenantId) {
            throw new RuntimeException('The reconciliation row is outside the active tenant.');
        }

        if (! in_array($status, self::REVIEW_STATUSES, true)) {
            throw new RuntimeException('Unsupported reconciliation review status.');
        }

        return DB::transaction(function () use (
            $row,
            $reviewerId,
            $status,
            $notes
        ): ProductReconciliationRow {
            $row->forceFill([
                'review_status' => $status,
                'reviewed_by' => $reviewerId,
                'reviewed_at' => now(),
                'review_notes' => $notes,
            ])->save();

            $this->refreshBatchCounters($row->batch_id);

            return $row->fresh([
                'batch:id,source_key,source_name,source_version,status',
                'matchedProduct:id,sku,name,generic_name,unit,status',
            ]);
        });
    }

    public function reviewDuplicate(
        ProductDuplicateProposal $proposal,
        int $tenantId,
        int $reviewerId,
        string $status,
        ?string $notes
    ): ProductDuplicateProposal {
        if ($proposal->tenant_id !== $tenantId) {
            throw new RuntimeException('The duplicate proposal is outside the active tenant.');
        }

        if (! in_array($status, self::REVIEW_STATUSES, true)) {
            throw new RuntimeException('Unsupported duplicate-review status.');
        }

        $proposal->forceFill([
            'status' => $status,
            'reviewed_by' => $reviewerId,
            'reviewed_at' => now(),
            'review_notes' => $notes,
        ])->save();

        return $proposal->fresh([
            'recordA:id,sku,name,generic_name,unit,status',
            'recordB:id,sku,name,generic_name,unit,status',
        ]);
    }

    public function dependencySnapshot(int $productId): array
    {
        $tables = [
            'stock_batches',
            'stock_movements',
            'pharmaco_sale_items',
            'pharmaco_purchase_order_items',
            'pharmaco_supplier_invoice_items',
            'insurance_claim_items',
            'pharmaco_prescription_items',
        ];

        $snapshot = [
            'product_id' => $productId,
            'total_dependency_rows' => 0,
            'tables' => [],
        ];

        foreach ($tables as $table) {
            if (
                ! Schema::hasTable($table)
                || ! Schema::hasColumn($table, 'product_id')
            ) {
                continue;
            }

            $count = DB::table($table)
                ->where('product_id', $productId)
                ->count();

            if ($count === 0) {
                continue;
            }

            $snapshot['tables'][$table] = $count;
            $snapshot['total_dependency_rows'] += $count;
        }

        if (
            Schema::hasTable('stock_batches')
            && Schema::hasColumn('stock_batches', 'product_id')
        ) {
            $snapshot['quantity_on_hand'] = (float) DB::table('stock_batches')
                ->where('product_id', $productId)
                ->sum('quantity_on_hand');

            $snapshot['reserved_quantity'] = Schema::hasColumn(
                'stock_batches',
                'reserved_quantity'
            )
                ? (float) DB::table('stock_batches')
                    ->where('product_id', $productId)
                    ->sum('reserved_quantity')
                : 0.0;
        }

        return $snapshot;
    }

    private function refreshBatchCounters(int $batchId): void
    {
        $batch = ProductReconciliationBatch::query()->find($batchId);

        if (! $batch) {
            return;
        }

        $base = ProductReconciliationRow::query()
            ->where('batch_id', $batchId);

        $batch->forceFill([
            'imported_rows' => (clone $base)->count(),
            'matched_rows' => (clone $base)
                ->whereNotNull('matched_product_id')
                ->count(),
            'review_rows' => (clone $base)
                ->whereIn('review_status', ['pending', 'hold'])
                ->count(),
            'approved_rows' => (clone $base)
                ->where('review_status', 'approved')
                ->count(),
            'rejected_rows' => (clone $base)
                ->where('review_status', 'rejected')
                ->count(),
        ])->save();
    }
}
