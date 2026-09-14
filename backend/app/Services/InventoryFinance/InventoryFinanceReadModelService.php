<?php

namespace App\Services\InventoryFinance;

use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use RuntimeException;

class InventoryFinanceReadModelService
{
    const MOVEMENT_TOLERANCE = 0.0001;
    const FINANCE_TOLERANCE = 0.01;

    public function build($tenantId, $limit = 100)
    {
        $tenantId = (int) $tenantId;
        $limit = max(25, min(250, (int) $limit));

        if ($tenantId <= 0) {
            throw new RuntimeException(
                'A valid tenant is required for Inventory Finance.'
            );
        }

        $this->requireTables(array(
            'stock_batches',
            'stock_movements',
            'products',
            'finance_chart_of_accounts',
            'finance_journal_entries',
            'finance_journal_lines',
        ));

        $timezone = config('app.timezone') ?: 'UTC';

        $asOf = Carbon::now($timezone)
            ->startOfDay();

        $rows = DB::table('stock_batches as sb')
            ->leftJoin(
                'products as p',
                function ($join) use ($tenantId) {
                    $join->on(
                        'p.id',
                        '=',
                        'sb.product_id'
                    );

                    $join->where(
                        'p.tenant_id',
                        '=',
                        $tenantId
                    );
                }
            )
            ->where(
                'sb.tenant_id',
                $tenantId
            )
            ->select(array(
                'sb.id as stock_batch_id',
                'sb.branch_id',
                'sb.stock_location_id',
                'sb.product_id',
                'sb.batch_number',
                'sb.expiry_date',
                'sb.received_at',
                'sb.quantity_on_hand',
                'sb.quantity_reserved',
                'sb.unit_cost',
                'sb.selling_price',
                'sb.supplier_name',
                'sb.status as batch_status',
                'sb.original_unit_cost',
                'sb.inferred_unit_cost',
                'sb.cost_source',
                'sb.cost_adjustment_method',
                'sb.cost_resolution_notes',
                'sb.cost_resolved_at',
                'p.name as product_name',
                'p.generic_name',
                'p.brand_name',
                'p.sku',
                'p.dosage_form',
                'p.strength',
                'p.unit',
                'p.pack_size',
                'p.requires_prescription',
                'p.is_controlled'
            ))
            ->orderBy('sb.id')
            ->get();

        $valuation = array(
            'inventory_at_cost' => 0.0,
            'units_on_hand' => 0.0,
            'positive_stock_batches' => 0,
            'retail_value' => 0.0,
            'potential_gross_margin' => 0.0,
            'cost_valued_batches' => 0,
            'cost_unvalued_batches' => 0,
            'retail_valued_batches' => 0,
            'margin_covered_batches' => 0,
        );

        $confidence = array(
            'verified_actual' =>
                $this->confidenceTemplate(
                    'Verified / actual'
                ),

            'inferred' =>
                $this->confidenceTemplate(
                    'Inferred'
                ),

            'legacy_reconstructed' =>
                $this->confidenceTemplate(
                    'Legacy reconstructed'
                ),

            'unresolved' =>
                $this->confidenceTemplate(
                    'Unresolved'
                ),
        );

        $expiry = array(
            'expired' =>
                $this->exposureTemplate(
                    'Already expired'
                ),

            '0_30' =>
                $this->exposureTemplate(
                    '0-30 days'
                ),

            '31_60' =>
                $this->exposureTemplate(
                    '31-60 days'
                ),

            '61_90' =>
                $this->exposureTemplate(
                    '61-90 days'
                ),

            'gt_90' =>
                $this->exposureTemplate(
                    '>90 days'
                ),

            'no_expiry' =>
                $this->exposureTemplate(
                    'No expiry recorded'
                ),

            'invalid_expiry' =>
                $this->exposureTemplate(
                    'Invalid expiry value'
                ),
        );

        $allBatchMap = array();
        $positiveBatchDetails = array();
        $exceptions = array();

        foreach ($rows as $row) {
            $batchId = (int) $row->stock_batch_id;

            $allBatchMap[$batchId] = $row;

            $quantity = $this->number(
                $row->quantity_on_hand,
                0.0
            );

            if ($quantity <= 0) {
                continue;
            }

            $valuation['positive_stock_batches']++;
            $valuation['units_on_hand'] += $quantity;

            $unitCost = $this->nullableNumber(
                $row->unit_cost
            );

            $sellingPrice = $this->nullableNumber(
                $row->selling_price
            );

            $costKnown =
                $unitCost !== null &&
                $unitCost > 0;

            $retailKnown =
                $sellingPrice !== null &&
                $sellingPrice >= 0;

            $stockValue = null;
            $retailValue = null;
            $marginValue = null;

            if ($costKnown) {
                $stockValue =
                    $quantity * $unitCost;

                $valuation['inventory_at_cost'] +=
                    $stockValue;

                $valuation['cost_valued_batches']++;
            } else {
                $valuation['cost_unvalued_batches']++;
            }

            if ($retailKnown) {
                $retailValue =
                    $quantity * $sellingPrice;

                $valuation['retail_value'] +=
                    $retailValue;

                $valuation['retail_valued_batches']++;
            }

            if (
                $costKnown &&
                $retailKnown
            ) {
                $marginValue =
                    $retailValue - $stockValue;

                $valuation['potential_gross_margin'] +=
                    $marginValue;

                $valuation['margin_covered_batches']++;
            }

            $costConfidence =
                $this->classifyCostConfidence(
                    $row
                );

            $confidence[$costConfidence]['batches']++;
            $confidence[$costConfidence]['quantity'] +=
                $quantity;

            if ($stockValue !== null) {
                $confidence[$costConfidence]['known_cost_value'] +=
                    $stockValue;
            }

            if ($retailValue !== null) {
                $confidence[$costConfidence]['retail_value'] +=
                    $retailValue;
            }

            $expiryBucket =
                $this->expiryBucket(
                    $row->expiry_date,
                    $asOf
                );

            $expiry[$expiryBucket]['batches']++;
            $expiry[$expiryBucket]['quantity'] +=
                $quantity;

            if ($stockValue !== null) {
                $expiry[$expiryBucket]['cost_value'] +=
                    $stockValue;
            }

            if ($retailValue !== null) {
                $expiry[$expiryBucket]['retail_value'] +=
                    $retailValue;
            }

            $detail = array(
                'stock_batch_id' => $batchId,
                'branch_id' =>
                    (int) $row->branch_id,

                'stock_location_id' =>
                    (int) $row->stock_location_id,

                'product_id' =>
                    (int) $row->product_id,

                'product' =>
                    $row->product_name,

                'generic_name' =>
                    $row->generic_name,

                'brand_name' =>
                    $row->brand_name,

                'sku' =>
                    $row->sku,

                'strength' =>
                    $row->strength,

                'dosage_form' =>
                    $row->dosage_form,

                'pack_size' =>
                    $row->pack_size,

                'unit' =>
                    $row->unit,

                'batch_number' =>
                    $row->batch_number,

                'expiry_date' =>
                    $row->expiry_date,

                'expiry_bucket' =>
                    $expiryBucket,

                'received_at' =>
                    $row->received_at,

                'quantity_on_hand' =>
                    $this->decimal($quantity),

                'quantity_reserved' =>
                    $this->decimal(
                        $this->number(
                            $row->quantity_reserved,
                            0.0
                        )
                    ),

                'resolved_unit_cost' =>
                    $costKnown
                        ? $this->money($unitCost)
                        : null,

                'selling_price' =>
                    $retailKnown
                        ? $this->money($sellingPrice)
                        : null,

                'stock_value' =>
                    $stockValue !== null
                        ? $this->money($stockValue)
                        : null,

                'retail_value' =>
                    $retailValue !== null
                        ? $this->money($retailValue)
                        : null,

                'expected_margin' =>
                    $marginValue !== null
                        ? $this->money($marginValue)
                        : null,

                'cost_confidence' =>
                    $costConfidence,

                'cost_source' =>
                    $row->cost_source,

                'cost_adjustment_method' =>
                    $row->cost_adjustment_method,

                'cost_resolved_at' =>
                    $row->cost_resolved_at,

                'supplier_name' =>
                    $row->supplier_name,

                'batch_status' =>
                    $row->batch_status,

                'requires_prescription' =>
                    (bool) $row->requires_prescription,

                'is_controlled' =>
                    (bool) $row->is_controlled,
            );

            $positiveBatchDetails[] = $detail;

            if ($expiryBucket === 'expired') {
                $exceptions[] =
                    $this->exceptionRow(
                        'expired_stock',
                        'Expired stock remains on hand.',
                        $detail,
                        $stockValue,
                        $retailValue
                    );
            }

            if ($expiryBucket === '0_30') {
                $exceptions[] =
                    $this->exceptionRow(
                        'expiring_0_30_days',
                        'Stock expires within 30 days.',
                        $detail,
                        $stockValue,
                        $retailValue
                    );
            }

            if ($costConfidence === 'unresolved') {
                if (!$costKnown) {
                    $reason =
                        'Positive stock has no usable resolved unit cost.';
                    $type = 'missing_cost';
                } else {
                    $reason =
                        'A numeric unit cost exists, but its provenance is not sufficiently explicit to label it verified, inferred, or legacy reconstructed.';
                    $type =
                        'unresolved_cost_provenance';
                }

                $exceptions[] =
                    $this->exceptionRow(
                        $type,
                        $reason,
                        $detail,
                        $stockValue,
                        $retailValue
                    );
            }

            if (
                $costKnown &&
                $retailKnown &&
                $sellingPrice < $unitCost
            ) {
                $exceptions[] =
                    $this->exceptionRow(
                        'selling_below_cost',
                        'Current selling price is below the resolved unit cost.',
                        $detail,
                        $stockValue,
                        $retailValue
                    );
            }
        }

        $movement =
            $this->movementReconciliation(
                $tenantId,
                $allBatchMap
            );

        foreach (
            $movement['affected_batches']
            as $mismatch
        ) {
            $exceptions[] = array(
                'type' =>
                    'movement_qoh_mismatch',

                'reason' =>
                    'Latest movement running balance does not equal operational quantity on hand.',

                'stock_batch_id' =>
                    $mismatch['stock_batch_id'],

                'product' =>
                    $mismatch['product'],

                'batch_number' =>
                    $mismatch['batch_number'],

                'quantity_on_hand' =>
                    $mismatch['quantity_on_hand'],

                'movement_running_balance' =>
                    $mismatch['movement_running_balance'],

                'quantity_difference' =>
                    $mismatch['quantity_difference'],

                'financial_exposure' =>
                    $mismatch['estimated_value_difference'],

                'retail_exposure' =>
                    null,
            );
        }

        usort(
            $exceptions,
            function ($a, $b) {
                $aValue =
                    isset($a['financial_exposure']) &&
                    $a['financial_exposure'] !== null
                        ? abs((float) $a['financial_exposure'])
                        : 0.0;

                $bValue =
                    isset($b['financial_exposure']) &&
                    $b['financial_exposure'] !== null
                        ? abs((float) $b['financial_exposure'])
                        : 0.0;

                if ($aValue == $bValue) {
                    return 0;
                }

                return $aValue < $bValue
                    ? 1
                    : -1;
            }
        );

        $finance =
            $this->financeInventoryBalance(
                $tenantId
            );

        $financeDifference = null;

        if (
            $finance['status'] === 'available' &&
            $finance['balance'] !== null
        ) {
            $financeDifference =
                $valuation['inventory_at_cost'] -
                $finance['balance'];
        }

        $movementComplete =
            $movement['coverage']['batches_without_current_running_balance'] === 0;

        $movementDifference =
            $movement['comparison']['comparable_operational_value'] -
            $movement['comparison']['movement_reconstructed_value'];

        if (
            !$movementComplete
        ) {
            $movementStatus =
                $movement['affected_batch_count'] > 0
                    ? 'exceptions_with_partial_coverage'
                    : 'partial_coverage';
        } elseif (
            abs($movementDifference) <=
            self::FINANCE_TOLERANCE &&
            $movement['affected_batch_count'] === 0
        ) {
            $movementStatus =
                'reconciled';
        } else {
            $movementStatus =
                'difference_detected';
        }

        if (
            $finance['status'] !== 'available'
        ) {
            $financeStatus =
                'finance_evidence_incomplete';
        } elseif (
            abs($financeDifference) <=
            self::FINANCE_TOLERANCE
        ) {
            $financeStatus =
                'reconciled';
        } else {
            $financeStatus =
                'difference_detected';
        }

        if (
            $movementStatus === 'reconciled' &&
            $financeStatus === 'reconciled'
        ) {
            $overallStatus = 'reconciled';
        } elseif (
            strpos(
                $movementStatus,
                'partial'
            ) !== false ||
            $financeStatus ===
                'finance_evidence_incomplete'
        ) {
            $overallStatus =
                'partial_evidence';
        } else {
            $overallStatus =
                'exceptions_present';
        }

        foreach ($valuation as $key => $value) {
            if (
                strpos($key, 'batches') === false
            ) {
                $valuation[$key] =
                    $this->money($value);
            }
        }

        foreach ($confidence as $key => $bucket) {
            $confidence[$key]['quantity'] =
                $this->decimal(
                    $bucket['quantity']
                );

            $confidence[$key]['known_cost_value'] =
                $this->money(
                    $bucket['known_cost_value']
                );

            $confidence[$key]['retail_value'] =
                $this->money(
                    $bucket['retail_value']
                );
        }

        foreach ($expiry as $key => $bucket) {
            $expiry[$key]['quantity'] =
                $this->decimal(
                    $bucket['quantity']
                );

            $expiry[$key]['cost_value'] =
                $this->money(
                    $bucket['cost_value']
                );

            $expiry[$key]['retail_value'] =
                $this->money(
                    $bucket['retail_value']
                );
        }

        usort(
            $positiveBatchDetails,
            function ($a, $b) {
                $aExpiry =
                    $a['expiry_date'] ?: '9999-12-31';

                $bExpiry =
                    $b['expiry_date'] ?: '9999-12-31';

                if ($aExpiry === $bExpiry) {
                    return
                        $a['stock_batch_id'] <
                        $b['stock_batch_id']
                            ? -1
                            : 1;
                }

                return strcmp(
                    $aExpiry,
                    $bExpiry
                );
            }
        );

        return array(
            'meta' => array(
                'module' =>
                    'IF-1 Inventory Finance Control Center',

                'revision' =>
                    'IF1-B1',

                'read_only' =>
                    true,

                'tenant_id' =>
                    $tenantId,

                'as_of' =>
                    $asOf->toDateString(),

                'generated_at' =>
                    Carbon::now($timezone)
                        ->toIso8601String(),

                'currency' =>
                    'RWF',

                'source_of_truth' => array(
                    'stock_batches.quantity_on_hand',
                    'stock_batches.unit_cost',
                    'stock_batches.cost_source',
                    'stock_movements.running_balance',
                    'products',
                    'finance_chart_of_accounts.code=1200',
                    'finance_journal_entries',
                    'finance_journal_lines',
                ),

                'cost_policy' =>
                    'Persisted resolved batch cost is used for valuation. Cost confidence is classified conservatively from explicit provenance fields; unresolved provenance is never presented as verified supplier cost.',
            ),

            'current_inventory_valuation' =>
                $valuation,

            'cost_confidence' =>
                $confidence,

            'expiry_financial_exposure' =>
                $expiry,

            'reconciliation' => array(
                'status' =>
                    $overallStatus,

                'operational_stock_value' =>
                    $valuation['inventory_at_cost'],

                'movement_reconstructed_stock_value' =>
                    $this->money(
                        $movement['comparison']['movement_reconstructed_value']
                    ),

                'movement_comparable_operational_value' =>
                    $this->money(
                        $movement['comparison']['comparable_operational_value']
                    ),

                'movement_comparable_difference' =>
                    $this->money(
                        $movementDifference
                    ),

                'movement_status' =>
                    $movementStatus,

                'movement_coverage' =>
                    $movement['coverage'],

                'movement_affected_batch_count' =>
                    $movement['affected_batch_count'],

                'movement_affected_batches' =>
                    $movement['affected_batches'],

                'finance_account_1200' =>
                    $finance,

                'operational_minus_finance_difference' =>
                    $financeDifference !== null
                        ? $this->money(
                            $financeDifference
                        )
                        : null,

                'finance_status' =>
                    $financeStatus,
            ),

            'batch_financial_view' =>
                array_slice(
                    $positiveBatchDetails,
                    0,
                    $limit
                ),

            'pharmaceutical_exception_queue' =>
                array_slice(
                    $exceptions,
                    0,
                    $limit
                ),

            'coverage' => array(
                'cogs' => array(
                    'status' =>
                        'source_linkage_pending',

                    'write_capability' =>
                        false,

                    'reason' =>
                        'IF1-B1 does not infer COGS posting linkage from ambiguous references. Exact sale-to-journal source mapping must be proven before coverage counts are activated.',
                ),

                'receipts_and_supplier_accruals' =>
                    array(
                        'status' =>
                            'source_linkage_pending',

                        'write_capability' =>
                            false,

                        'reason' =>
                            'IF1-B1 does not infer supplier invoice or GRNI linkage. Existing receipt and Finance source relationships must be mapped explicitly before coverage counts are activated.',
                    ),
            ),
        );
    }

    protected function movementReconciliation(
        $tenantId,
        array $batchMap
    ) {
        $latest = array();

        $movements = DB::table(
            'stock_movements'
        )
            ->where(
                'tenant_id',
                $tenantId
            )
            ->whereNotNull(
                'stock_batch_id'
            )
            ->select(array(
                'id',
                'stock_batch_id',
                'running_balance',
                'occurred_at',
                'business_date',
                'movement_type'
            ))
            ->orderBy(
                'stock_batch_id'
            )
            ->orderBy(
                'occurred_at'
            )
            ->orderBy(
                'id'
            )
            ->get();

        foreach ($movements as $movement) {
            $latest[
                (int) $movement->stock_batch_id
            ] = $movement;
        }

        $covered = 0;
        $missingBalance = 0;
        $comparableCostBatches = 0;
        $movementValue = 0.0;
        $operationalComparable = 0.0;
        $affected = array();

        foreach ($batchMap as $batchId => $batch) {
            if (
                !isset($latest[$batchId]) ||
                $latest[$batchId]->running_balance === null ||
                $latest[$batchId]->running_balance === ''
            ) {
                $missingBalance++;
                continue;
            }

            $covered++;

            $qoh = $this->number(
                $batch->quantity_on_hand,
                0.0
            );

            $running = $this->number(
                $latest[$batchId]->running_balance,
                0.0
            );

            $difference = $qoh - $running;

            $unitCost = $this->nullableNumber(
                $batch->unit_cost
            );

            $estimatedValueDifference = null;

            if (
                $unitCost !== null &&
                $unitCost > 0
            ) {
                $comparableCostBatches++;

                $movementValue +=
                    $running * $unitCost;

                $operationalComparable +=
                    $qoh * $unitCost;

                $estimatedValueDifference =
                    $difference * $unitCost;
            }

            if (
                abs($difference) >
                self::MOVEMENT_TOLERANCE
            ) {
                $affected[] = array(
                    'stock_batch_id' =>
                        (int) $batchId,

                    'product' =>
                        $batch->product_name,

                    'batch_number' =>
                        $batch->batch_number,

                    'quantity_on_hand' =>
                        $this->decimal($qoh),

                    'movement_running_balance' =>
                        $this->decimal($running),

                    'quantity_difference' =>
                        $this->decimal($difference),

                    'resolved_unit_cost' =>
                        $unitCost !== null &&
                        $unitCost > 0
                            ? $this->money(
                                $unitCost
                            )
                            : null,

                    'estimated_value_difference' =>
                        $estimatedValueDifference !== null
                            ? $this->money(
                                $estimatedValueDifference
                            )
                            : null,

                    'latest_movement_id' =>
                        (int) $latest[$batchId]->id,

                    'latest_movement_type' =>
                        $latest[$batchId]->movement_type,

                    'latest_occurred_at' =>
                        $latest[$batchId]->occurred_at,

                    'latest_business_date' =>
                        $latest[$batchId]->business_date,
                );
            }
        }

        usort(
            $affected,
            function ($a, $b) {
                $av =
                    $a['estimated_value_difference'] !== null
                        ? abs(
                            (float)
                            $a['estimated_value_difference']
                        )
                        : 0.0;

                $bv =
                    $b['estimated_value_difference'] !== null
                        ? abs(
                            (float)
                            $b['estimated_value_difference']
                        )
                        : 0.0;

                if ($av == $bv) {
                    return 0;
                }

                return $av < $bv
                    ? 1
                    : -1;
            }
        );

        $orphanBatchReferences = 0;

        foreach ($latest as $batchId => $movement) {
            if (!isset($batchMap[$batchId])) {
                $orphanBatchReferences++;
            }
        }

        $unbatchedMovementCount =
            DB::table('stock_movements')
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->whereNull(
                    'stock_batch_id'
                )
                ->count();

        return array(
            'coverage' => array(
                'total_operational_batches' =>
                    count($batchMap),

                'batches_with_current_running_balance' =>
                    $covered,

                'batches_without_current_running_balance' =>
                    $missingBalance,

                'batches_with_comparable_cost' =>
                    $comparableCostBatches,

                'unbatched_movement_count' =>
                    (int) $unbatchedMovementCount,

                'movement_batch_references_without_current_batch' =>
                    $orphanBatchReferences,
            ),

            'comparison' => array(
                'movement_reconstructed_value' =>
                    $movementValue,

                'comparable_operational_value' =>
                    $operationalComparable,
            ),

            'affected_batch_count' =>
                count($affected),

            'affected_batches' =>
                array_slice(
                    $affected,
                    0,
                    50
                ),
        );
    }

    protected function financeInventoryBalance(
        $tenantId
    ) {
        $accountQuery =
            DB::table(
                'finance_chart_of_accounts'
            )
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->where(
                    'code',
                    '1200'
                );

        $accountColumns =
            Schema::getColumnListing(
                'finance_chart_of_accounts'
            );

        if (
            in_array(
                'is_active',
                $accountColumns,
                true
            )
        ) {
            $accountQuery->where(
                'is_active',
                1
            );
        }

        $account = $accountQuery->first();

        if (!$account) {
            return array(
                'status' =>
                    'account_not_found',

                'code' =>
                    '1200',

                'name' =>
                    'Inventory Asset',

                'balance' =>
                    null,

                'reason' =>
                    'No active tenant Inventory Asset account 1200 was found.',
            );
        }

        $lineColumns =
            Schema::getColumnListing(
                'finance_journal_lines'
            );

        $entryColumns =
            Schema::getColumnListing(
                'finance_journal_entries'
            );

        $accountColumn =
            $this->firstExisting(
                array(
                    'account_id',
                    'finance_account_id',
                    'chart_of_account_id',
                ),
                $lineColumns
            );

        $debitColumn =
            $this->firstExisting(
                array(
                    'debit_amount',
                    'debit',
                ),
                $lineColumns
            );

        $creditColumn =
            $this->firstExisting(
                array(
                    'credit_amount',
                    'credit',
                ),
                $lineColumns
            );

        $entryForeignKey =
            $this->firstExisting(
                array(
                    'journal_entry_id',
                    'finance_journal_entry_id',
                    'entry_id',
                ),
                $lineColumns
            );

        if (
            !$accountColumn ||
            !$debitColumn ||
            !$creditColumn ||
            !$entryForeignKey
        ) {
            return array(
                'status' =>
                    'schema_mapping_incomplete',

                'code' =>
                    '1200',

                'name' =>
                    isset($account->name)
                        ? $account->name
                        : 'Inventory Asset',

                'balance' =>
                    null,

                'reason' =>
                    'Finance journal line ownership could not be mapped conservatively from the current schema.',
            );
        }

        $statusColumn =
            $this->firstExisting(
                array(
                    'posting_status',
                    'status',
                ),
                $entryColumns
            );

        $query =
            DB::table(
                'finance_journal_lines as l'
            )
                ->join(
                    'finance_journal_entries as e',
                    'e.id',
                    '=',
                    'l.' . $entryForeignKey
                )
                ->where(
                    'l.' . $accountColumn,
                    (int) $account->id
                );

        if (
            in_array(
                'tenant_id',
                $entryColumns,
                true
            )
        ) {
            $query->where(
                'e.tenant_id',
                $tenantId
            );
        } elseif (
            in_array(
                'tenant_id',
                $lineColumns,
                true
            )
        ) {
            $query->where(
                'l.tenant_id',
                $tenantId
            );
        } else {
            return array(
                'status' =>
                    'tenant_scope_unprovable',

                'code' =>
                    '1200',

                'name' =>
                    isset($account->name)
                        ? $account->name
                        : 'Inventory Asset',

                'balance' =>
                    null,

                'reason' =>
                    'Finance ledger tenant ownership cannot be proven from current journal columns.',
            );
        }

        $postedFilter = null;

        if ($statusColumn) {
            $statuses =
                DB::table(
                    'finance_journal_entries'
                )
                    ->when(
                        in_array(
                            'tenant_id',
                            $entryColumns,
                            true
                        ),
                        function ($q) use ($tenantId) {
                            $q->where(
                                'tenant_id',
                                $tenantId
                            );
                        }
                    )
                    ->select(
                        $statusColumn
                    )
                    ->distinct()
                    ->pluck(
                        $statusColumn
                    );

            $postedValues = array();

            foreach ($statuses as $value) {
                if (
                    strtolower(
                        trim(
                            (string) $value
                        )
                    ) === 'posted'
                ) {
                    $postedValues[] = $value;
                }
            }

            if (count($postedValues) > 0) {
                $query->whereIn(
                    'e.' . $statusColumn,
                    $postedValues
                );

                $postedFilter =
                    $statusColumn . '=posted';
            }
        }

        if (
            $postedFilter === null &&
            in_array(
                'posted_at',
                $entryColumns,
                true
            )
        ) {
            $query->whereNotNull(
                'e.posted_at'
            );

            $postedFilter =
                'posted_at IS NOT NULL';
        }

        if ($postedFilter === null) {
            return array(
                'status' =>
                    'posted_state_unprovable',

                'code' =>
                    '1200',

                'name' =>
                    isset($account->name)
                        ? $account->name
                        : 'Inventory Asset',

                'balance' =>
                    null,

                'reason' =>
                    'The current journal schema does not provide a proven posted-state filter.',
            );
        }

        $debits =
            (float) (
                clone $query
            )->sum(
                'l.' . $debitColumn
            );

        $credits =
            (float) (
                clone $query
            )->sum(
                'l.' . $creditColumn
            );

        $lineCount =
            (int) (
                clone $query
            )->count();

        $journalCount =
            (int) (
                clone $query
            )
                ->distinct()
                ->count(
                    'l.' . $entryForeignKey
                );

        return array(
            'status' =>
                'available',

            'account_id' =>
                (int) $account->id,

            'code' =>
                '1200',

            'name' =>
                isset($account->name)
                    ? $account->name
                    : 'Inventory Asset',

            'normal_balance' =>
                isset($account->normal_balance)
                    ? $account->normal_balance
                    : 'debit',

            'currency' =>
                isset($account->currency_code)
                    ? $account->currency_code
                    : 'RWF',

            'posted_filter' =>
                $postedFilter,

            'journal_count' =>
                $journalCount,

            'line_count' =>
                $lineCount,

            'debits' =>
                $this->money($debits),

            'credits' =>
                $this->money($credits),

            'balance' =>
                $this->money(
                    $debits - $credits
                ),
        );
    }

    protected function classifyCostConfidence(
        $row
    ) {
        $unitCost =
            $this->nullableNumber(
                $row->unit_cost
            );

        if (
            $unitCost === null ||
            $unitCost <= 0
        ) {
            return 'unresolved';
        }

        $source = strtolower(
            trim(
                (string) $row->cost_source
            )
        );

        $method = strtolower(
            trim(
                (string) $row->cost_adjustment_method
            )
        );

        $notes = strtolower(
            trim(
                (string) $row->cost_resolution_notes
            )
        );

        if (
            strpos(
                $source,
                'inferred'
            ) !== false
        ) {
            return 'inferred';
        }

        if (
            preg_match(
                '/legacy|reconstruct|historical|backfill|migration/',
                $source
            )
        ) {
            return 'legacy_reconstructed';
        }

        if (
            preg_match(
                '/verified|actual|supplier|purchase|receipt|invoice|acquisition/',
                $source
            )
        ) {
            return 'verified_actual';
        }

        if (
            preg_match(
                '/legacy|reconstruct|historical|backfill|migration/',
                $method . ' ' . $notes
            )
        ) {
            return 'legacy_reconstructed';
        }

        if (
            preg_match(
                '/inferred|estimate|derived/',
                $method . ' ' . $notes
            )
        ) {
            return 'inferred';
        }

        if (
            preg_match(
                '/verified|actual|supplier|purchase|receipt|invoice|acquisition/',
                $method . ' ' . $notes
            )
        ) {
            return 'verified_actual';
        }

        $inferred =
            $this->nullableNumber(
                $row->inferred_unit_cost
            );

        if (
            $inferred !== null &&
            $inferred > 0 &&
            abs(
                $inferred - $unitCost
            ) <= self::MOVEMENT_TOLERANCE
        ) {
            return 'inferred';
        }

        return 'unresolved';
    }

    protected function expiryBucket(
        $value,
        Carbon $asOf
    ) {
        if (
            $value === null ||
            trim((string) $value) === ''
        ) {
            return 'no_expiry';
        }

        try {
            $expiry =
                Carbon::parse(
                    $value,
                    $asOf->getTimezone()
                )
                    ->startOfDay();

            $days =
                $asOf->diffInDays(
                    $expiry,
                    false
                );

            if ($days < 0) {
                return 'expired';
            }

            if ($days <= 30) {
                return '0_30';
            }

            if ($days <= 60) {
                return '31_60';
            }

            if ($days <= 90) {
                return '61_90';
            }

            return 'gt_90';

        } catch (\Throwable $e) {
            return 'invalid_expiry';
        }
    }

    protected function exceptionRow(
        $type,
        $reason,
        array $detail,
        $stockValue,
        $retailValue
    ) {
        $exposure = null;

        if ($stockValue !== null) {
            $exposure =
                $this->money(
                    $stockValue
                );
        } elseif ($retailValue !== null) {
            $exposure =
                $this->money(
                    $retailValue
                );
        }

        return array(
            'type' =>
                $type,

            'reason' =>
                $reason,

            'stock_batch_id' =>
                $detail['stock_batch_id'],

            'product' =>
                $detail['product'],

            'batch_number' =>
                $detail['batch_number'],

            'expiry_date' =>
                $detail['expiry_date'],

            'quantity_on_hand' =>
                $detail['quantity_on_hand'],

            'resolved_unit_cost' =>
                $detail['resolved_unit_cost'],

            'selling_price' =>
                $detail['selling_price'],

            'cost_confidence' =>
                $detail['cost_confidence'],

            'financial_exposure' =>
                $exposure,

            'retail_exposure' =>
                $retailValue !== null
                    ? $this->money(
                        $retailValue
                    )
                    : null,
        );
    }

    protected function confidenceTemplate(
        $label
    ) {
        return array(
            'label' =>
                $label,

            'batches' =>
                0,

            'quantity' =>
                0.0,

            'known_cost_value' =>
                0.0,

            'retail_value' =>
                0.0,
        );
    }

    protected function exposureTemplate(
        $label
    ) {
        return array(
            'label' =>
                $label,

            'batches' =>
                0,

            'quantity' =>
                0.0,

            'cost_value' =>
                0.0,

            'retail_value' =>
                0.0,
        );
    }

    protected function requireTables(
        array $tables
    ) {
        foreach ($tables as $table) {
            if (!Schema::hasTable($table)) {
                throw new RuntimeException(
                    'Required authoritative table missing: '
                    . $table
                );
            }
        }
    }

    protected function firstExisting(
        array $candidates,
        array $columns
    ) {
        foreach ($candidates as $candidate) {
            if (
                in_array(
                    $candidate,
                    $columns,
                    true
                )
            ) {
                return $candidate;
            }
        }

        return null;
    }

    protected function nullableNumber(
        $value
    ) {
        if (
            $value === null ||
            $value === ''
        ) {
            return null;
        }

        if (!is_numeric($value)) {
            return null;
        }

        return (float) $value;
    }

    protected function number(
        $value,
        $default = 0.0
    ) {
        $number =
            $this->nullableNumber(
                $value
            );

        return $number === null
            ? (float) $default
            : $number;
    }

    protected function money(
        $value
    ) {
        return round(
            (float) $value,
            4
        );
    }

    protected function decimal(
        $value
    ) {
        return round(
            (float) $value,
            4
        );
    }
}
