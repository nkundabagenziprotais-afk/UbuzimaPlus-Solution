from pathlib import Path
import re
import sys

tsx_path = Path("web/admin-dashboard/src/components/ProductInventoryPreview.tsx")
css_path = Path("web/admin-dashboard/src/styles.css")

if not tsx_path.exists():
    sys.exit("Missing file: web/admin-dashboard/src/components/ProductInventoryPreview.tsx")

if not css_path.exists():
    sys.exit("Missing file: web/admin-dashboard/src/styles.css")

tsx = tsx_path.read_text()
css = css_path.read_text()

def replace_once(source: str, old: str, new: str, label: str) -> str:
    if old not in source:
        sys.exit(f"Patch stopped: marker not found for {label}")
    return source.replace(old, new, 1)

# 1) Add CSSProperties type for row style mapping.
tsx = tsx.replace(
    "import { type FormEvent, useEffect, useMemo, useState } from 'react';",
    "import { type CSSProperties, type FormEvent, useEffect, useMemo, useState } from 'react';",
    1,
)

# 2) Clean Overview wording and remove duplicated Overview Summary wording.
tsx = tsx.replace(
    "{ key: 'overview', label: 'Overview Summary', description: 'Stock health and inventory analytics' },",
    "{ key: 'overview', label: 'Inventory Dashboard', description: 'Stock position, expiry risk and inventory workspaces' },",
)

tsx = tsx.replace(
    "overview: 'Summary of stock health only. Detailed lists stay in their own pages.',",
    "overview: 'Review stock position, expiry pressure and the inventory workspaces that need action.',",
)

tsx = tsx.replace(
    "'product-master': 'Supreme product source for margins, compliance, product setup, approval and audit history.',",
    "'product-master': 'Main product reference for drug codes, generic descriptions, margins, status and setup rules.',",
)

tsx = tsx.replace(
    "operational signals prepared for demand, reorder, expiry, margin and stock-out models.",
    "review low stock, expiry pressure, batch coverage and purchasing priorities.",
)

tsx = tsx.replace(
    "Operational signals prepared for demand, reorder, expiry, margin and stock-out models.",
    "Review low stock, expiry pressure, batch coverage and purchasing priorities.",
)

tsx = tsx.replace("AI inventory analytics", "Inventory review signals")
tsx = tsx.replace("AI weekly trend", "Weekly trend")
tsx = tsx.replace("aria-label=\"AI weekly trend bar chart\"", "aria-label=\"Weekly trend bar chart\"")
tsx = tsx.replace("aria-label=\"AI weekly trend line chart\"", "aria-label=\"Weekly trend line chart\"")

# 3) Replace basic expiry status/action helpers with customizable mapping logic.
old_expiry_helpers = """function expiryStatus(days: number | null): string {
  if (days === null) return 'No expiry';
  if (days < 0) return 'Expired';
  if (days <= 30) return 'Critical expiry';
  if (days <= 90) return 'Near expiry';
  if (days <= 180) return 'Watch';
  return 'Safe';
}

function expiryAction(days: number | null): string {
  if (days === null) return 'No action';
  if (days < 0) return 'Quarantine/disposal approval';
  if (days <= 30) return 'Prioritize sale or return';
  if (days <= 90) return 'Discount/transfer review';
  if (days <= 180) return 'Monitor FEFO movement';
  return 'Normal FEFO';
}
"""

new_expiry_helpers = """type ExpiryRiskKey = 'no-expiry' | 'expired' | 'critical' | 'near' | 'watch' | 'safe';

type ExpiryLabelMapping = {
  key: ExpiryRiskKey;
  label: string;
  minDays: number | null;
  maxDays: number | null;
  backgroundColor: string;
  fontColor: string;
  action: string;
};

const expiryLabelMappingStorageKey = 'ubuzima_inventory_expiry_label_mapping';

const defaultExpiryLabelMappings: ExpiryLabelMapping[] = [
  {
    key: 'expired',
    label: 'Expired',
    minDays: null,
    maxDays: -1,
    backgroundColor: '#7f1d1d',
    fontColor: '#ffffff',
    action: 'Stop sale, quarantine, and start disposal or supplier return approval.',
  },
  {
    key: 'critical',
    label: 'Critical expiry',
    minDays: 0,
    maxDays: 30,
    backgroundColor: '#fee2e2',
    fontColor: '#991b1b',
    action: 'Prioritize FEFO sale, transfer, supplier return, or controlled promotion where allowed.',
  },
  {
    key: 'near',
    label: 'Near expiry',
    minDays: 31,
    maxDays: 90,
    backgroundColor: '#ffedd5',
    fontColor: '#9a3412',
    action: 'Review movement rate, transfer to a faster branch, and adjust purchase planning.',
  },
  {
    key: 'watch',
    label: 'Watch',
    minDays: 91,
    maxDays: 180,
    backgroundColor: '#fef9c3',
    fontColor: '#854d0e',
    action: 'Monitor FEFO movement and avoid over-ordering.',
  },
  {
    key: 'safe',
    label: 'Safe',
    minDays: 181,
    maxDays: null,
    backgroundColor: '#dcfce7',
    fontColor: '#166534',
    action: 'Continue normal FEFO rotation.',
  },
  {
    key: 'no-expiry',
    label: 'No expiry date',
    minDays: null,
    maxDays: null,
    backgroundColor: '#f1f5f9',
    fontColor: '#334155',
    action: 'Verify product type and confirm whether expiry tracking is required.',
  },
];

function loadStoredExpiryLabelMappings(): ExpiryLabelMapping[] {
  try {
    const stored = localStorage.getItem(expiryLabelMappingStorageKey);
    if (!stored) return defaultExpiryLabelMappings;

    const parsed = JSON.parse(stored) as Partial<ExpiryLabelMapping>[];

    return defaultExpiryLabelMappings.map((mapping) => ({
      ...mapping,
      ...(parsed.find((item) => item.key === mapping.key) ?? {}),
    }));
  } catch {
    return defaultExpiryLabelMappings;
  }
}

function expiryMappingForDays(days: number | null, mappings: ExpiryLabelMapping[] = defaultExpiryLabelMappings): ExpiryLabelMapping {
  if (days === null) {
    return mappings.find((mapping) => mapping.key === 'no-expiry') ?? defaultExpiryLabelMappings[5];
  }

  return (
    mappings.find((mapping) => {
      if (mapping.key === 'no-expiry') return false;
      const minOk = mapping.minDays === null || days >= mapping.minDays;
      const maxOk = mapping.maxDays === null || days <= mapping.maxDays;
      return minOk && maxOk;
    }) ?? mappings.find((mapping) => mapping.key === 'safe') ?? defaultExpiryLabelMappings[4]
  );
}

function expiryStatus(days: number | null): string {
  return expiryMappingForDays(days).label;
}

function expiryAction(days: number | null): string {
  return expiryMappingForDays(days).action;
}

function expiryRiskKey(days: number | null, mappings: ExpiryLabelMapping[] = defaultExpiryLabelMappings): ExpiryRiskKey {
  return expiryMappingForDays(days, mappings).key;
}

function expiryRowStyle(days: number | null, mappings: ExpiryLabelMapping[] = defaultExpiryLabelMappings): CSSProperties {
  const mapping = expiryMappingForDays(days, mappings);

  return {
    backgroundColor: mapping.backgroundColor,
    color: mapping.fontColor,
  };
}
"""

tsx = replace_once(tsx, old_expiry_helpers, new_expiry_helpers, "expiry mapping helpers")

# 4) Add expiry filters and mapping state.
state_marker = """  const [inventorySmartCardFieldVisibility, setInventorySmartCardFieldVisibility] = useState<Record<InventorySmartCardKey, Record<InventorySmartCardField, boolean>>>(loadStoredInventorySmartCardFieldVisibility);
"""

state_insert = state_marker + """
  const [expiryLocationFilter, setExpiryLocationFilter] = useState('all');
  const [expirySupplierFilter, setExpirySupplierFilter] = useState('all');
  const [expiryRiskFilter, setExpiryRiskFilter] = useState('all');
  const [expiryDaysFilter, setExpiryDaysFilter] = useState('all');
  const [expiryBatchStatusFilter, setExpiryBatchStatusFilter] = useState('all');
  const [expiryLabelMappings, setExpiryLabelMappings] = useState<ExpiryLabelMapping[]>(loadStoredExpiryLabelMappings);
"""

tsx = replace_once(tsx, state_marker, state_insert, "expiry state")

# 5) Persist mapping to localStorage.
effect_marker = """  useEffect(() => {
    localStorage.setItem(inventoryTableFontSizeStorageKey, JSON.stringify(tableFontSizes));
  }, [tableFontSizes]);
"""

effect_insert = effect_marker + """

  useEffect(() => {
    localStorage.setItem(expiryLabelMappingStorageKey, JSON.stringify(expiryLabelMappings));
  }, [expiryLabelMappings]);
"""

tsx = replace_once(tsx, effect_marker, effect_insert, "expiry mapping persistence")

# 6) Add expiry filter helpers after nearExpiryRows.
near_expiry_marker = "  const nearExpiryRows = nearExpiryBatches?.batches ?? [];\n"

near_expiry_insert = near_expiry_marker + """
  const expiryFilterBatchSource = useMemo(() => [...allBatches, ...nearExpiryRows], [allBatches, nearExpiryRows]);

  const expiryLocationOptions = useMemo(
    () =>
      Array.from(
        new Map(
          expiryFilterBatchSource.map((batch) => [
            batch.stock_location.code,
            `${batch.stock_location.name} (${batch.stock_location.code})`,
          ]),
        ).entries(),
      ).sort((left, right) => left[1].localeCompare(right[1])),
    [expiryFilterBatchSource],
  );

  const expirySupplierOptions = useMemo(
    () =>
      Array.from(
        new Set(
          expiryFilterBatchSource
            .map((batch) => batch.supplier_name)
            .filter((supplier): supplier is string => Boolean(supplier)),
        ),
      ).sort((left, right) => left.localeCompare(right)),
    [expiryFilterBatchSource],
  );

  const expiryBatchStatusOptions = useMemo(
    () =>
      Array.from(new Set(expiryFilterBatchSource.map((batch) => batch.status))).sort((left, right) =>
        left.localeCompare(right),
      ),
    [expiryFilterBatchSource],
  );

  function matchesExpiryDayRange(days: number | null): boolean {
    if (expiryDaysFilter === 'all') return true;
    if (expiryDaysFilter === 'no-expiry') return days === null;
    if (days === null) return false;
    if (expiryDaysFilter === 'expired') return days < 0;
    if (expiryDaysFilter === '0-30') return days >= 0 && days <= 30;
    if (expiryDaysFilter === '31-90') return days >= 31 && days <= 90;
    if (expiryDaysFilter === '91-180') return days >= 91 && days <= 180;
    if (expiryDaysFilter === '181+') return days >= 181;
    return true;
  }

  function filterBatchesForExpiryControls(rows: PharmaStockBatch[]): PharmaStockBatch[] {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return rows.filter((batch) => {
      const days = remainingDays(batch.expiry_date);
      const riskKey = expiryRiskKey(days, expiryLabelMappings);

      const matchesSearch =
        !normalizedSearch ||
        [
          batch.product.name,
          batch.product.generic_name,
          batch.product.sku,
          batch.batch_number,
          batch.stock_location.name,
          batch.stock_location.code,
          batch.supplier_name,
          batch.status,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedSearch));

      const matchesLocation =
        expiryLocationFilter === 'all' ||
        batch.stock_location.code === expiryLocationFilter ||
        batch.stock_location.name === expiryLocationFilter;

      const matchesSupplier = expirySupplierFilter === 'all' || batch.supplier_name === expirySupplierFilter;
      const matchesRisk = expiryRiskFilter === 'all' || riskKey === expiryRiskFilter;
      const matchesStatus = expiryBatchStatusFilter === 'all' || batch.status === expiryBatchStatusFilter;

      return matchesSearch && matchesLocation && matchesSupplier && matchesRisk && matchesExpiryDayRange(days) && matchesStatus;
    });
  }
"""

tsx = replace_once(tsx, near_expiry_marker, near_expiry_insert, "expiry filter helpers")

# 7) Replace visibleBatches useMemo to include expiry filters.
old_visible_batches = """  const visibleBatches = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return allBatches
      .filter((batch) => {
        if (!normalizedSearch) return true;

        return [
          batch.product.name,
          batch.product.sku,
          batch.batch_number,
          batch.stock_location.name,
          batch.stock_location.code,
          batch.supplier_name,
          batch.status,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedSearch));
      })
      .sort((left, right) => {
        const leftDays = remainingDays(left.expiry_date);
        const rightDays = remainingDays(right.expiry_date);

        return (leftDays ?? Number.MAX_SAFE_INTEGER) - (rightDays ?? Number.MAX_SAFE_INTEGER);
      });
  }, [allBatches, searchTerm]);
"""

new_visible_batches = """  const visibleBatches = useMemo(() => {
    return filterBatchesForExpiryControls(allBatches).sort((left, right) => {
      const leftDays = remainingDays(left.expiry_date);
      const rightDays = remainingDays(right.expiry_date);

      return (leftDays ?? Number.MAX_SAFE_INTEGER) - (rightDays ?? Number.MAX_SAFE_INTEGER);
    });
  }, [
    allBatches,
    searchTerm,
    expiryLocationFilter,
    expirySupplierFilter,
    expiryRiskFilter,
    expiryDaysFilter,
    expiryBatchStatusFilter,
    expiryLabelMappings,
  ]);

  const visibleNearExpiryRows = useMemo(() => {
    return filterBatchesForExpiryControls(nearExpiryRows).sort((left, right) => {
      const leftDays = remainingDays(left.expiry_date);
      const rightDays = remainingDays(right.expiry_date);

      return (leftDays ?? Number.MAX_SAFE_INTEGER) - (rightDays ?? Number.MAX_SAFE_INTEGER);
    });
  }, [
    nearExpiryRows,
    searchTerm,
    expiryLocationFilter,
    expirySupplierFilter,
    expiryRiskFilter,
    expiryDaysFilter,
    expiryBatchStatusFilter,
    expiryLabelMappings,
  ]);
"""

tsx = replace_once(tsx, old_visible_batches, new_visible_batches, "visible batches with filters")

tsx = tsx.replace(
    "  const pagedNearExpiry = nearExpiryRows.slice(0, rowLimitValue(rowLimit, nearExpiryRows.length));",
    "  const pagedNearExpiry = visibleNearExpiryRows.slice(0, rowLimitValue(rowLimit, visibleNearExpiryRows.length));",
    1,
)

tsx = tsx.replace("nearExpiryRows.map((batch) => {", "visibleNearExpiryRows.map((batch) => {", 1)

# 8) Humanize generic action notice.
tsx = tsx.replace(
    "setInventoryNotice(`${action} captured. Backend execution remains permission-controlled and will write an audit log when connected to the mutation endpoint.`);",
    "setInventoryNotice(`${action}. Review the record, confirm permission, and complete the action through the connected approval workflow.`);",
)

# 9) Add expiry controls renderer after markAction().
mark_action_block = """  function markAction(action: string) {
    setInventoryNotice(`${action}. Review the record, confirm permission, and complete the action through the connected approval workflow.`);
  }
"""

expiry_renderer = mark_action_block + """

  function updateExpiryMapping(index: number, field: keyof ExpiryLabelMapping, value: string | number | null) {
    setExpiryLabelMappings((current) =>
      current.map((mapping, itemIndex) => (itemIndex === index ? { ...mapping, [field]: value } : mapping)),
    );
  }

  function renderExpiryChip(days: number | null) {
    const mapping = expiryMappingForDays(days, expiryLabelMappings);

    return (
      <span
        className={`expiry-risk-chip expiry-risk-chip--${mapping.key}`}
        style={{ backgroundColor: mapping.backgroundColor, color: mapping.fontColor }}
      >
        {mapping.label}
      </span>
    );
  }

  function renderExpiryControls(helperText: string) {
    return (
      <section className="expiry-control-stack">
        <div className="expiry-control-heading">
          <div>
            <strong>Expiry filters and labelling</strong>
            <span>{helperText}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setExpiryLocationFilter('all');
              setExpirySupplierFilter('all');
              setExpiryRiskFilter('all');
              setExpiryDaysFilter('all');
              setExpiryBatchStatusFilter('all');
            }}
          >
            Reset filters
          </button>
        </div>

        <div className="inventory-expiry-filter-grid">
          <label>
            Location
            <select value={expiryLocationFilter} onChange={(event) => setExpiryLocationFilter(event.target.value)}>
              <option value="all">All locations</option>
              {expiryLocationOptions.map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Supplier
            <select value={expirySupplierFilter} onChange={(event) => setExpirySupplierFilter(event.target.value)}>
              <option value="all">All suppliers</option>
              {expirySupplierOptions.map((supplier) => (
                <option key={supplier} value={supplier}>
                  {supplier}
                </option>
              ))}
            </select>
          </label>

          <label>
            Expiry label
            <select value={expiryRiskFilter} onChange={(event) => setExpiryRiskFilter(event.target.value)}>
              <option value="all">All labels</option>
              {expiryLabelMappings.map((mapping) => (
                <option key={mapping.key} value={mapping.key}>
                  {mapping.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Days to expiry
            <select value={expiryDaysFilter} onChange={(event) => setExpiryDaysFilter(event.target.value)}>
              <option value="all">All days</option>
              <option value="expired">Expired</option>
              <option value="0-30">0–30 days</option>
              <option value="31-90">31–90 days</option>
              <option value="91-180">91–180 days</option>
              <option value="181+">181+ days</option>
              <option value="no-expiry">No expiry date</option>
            </select>
          </label>

          <label>
            Batch status
            <select value={expiryBatchStatusFilter} onChange={(event) => setExpiryBatchStatusFilter(event.target.value)}>
              <option value="all">All statuses</option>
              {expiryBatchStatusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="expiry-legend-grid">
          {expiryLabelMappings.map((mapping) => (
            <article
              key={mapping.key}
              className={`expiry-legend-card expiry-legend-card--${mapping.key}`}
              style={{ backgroundColor: mapping.backgroundColor, color: mapping.fontColor }}
            >
              <strong>{mapping.label}</strong>
              <span>
                {mapping.key === 'no-expiry'
                  ? 'No expiry date'
                  : `${mapping.minDays ?? 'Below'} to ${mapping.maxDays ?? 'above'} days`}
              </span>
              <small>{mapping.action}</small>
            </article>
          ))}
        </div>

        <details className="expiry-mapping-management-card">
          <summary>Expiry Label & Mapping Management</summary>
          <div className="expiry-mapping-grid">
            {expiryLabelMappings.map((mapping, index) => (
              <section key={mapping.key}>
                <label>
                  Label
                  <input
                    value={mapping.label}
                    onChange={(event) => updateExpiryMapping(index, 'label', event.target.value)}
                  />
                </label>

                <label>
                  Min days
                  <input
                    type="number"
                    value={mapping.minDays ?? ''}
                    disabled={mapping.key === 'no-expiry'}
                    onChange={(event) =>
                      updateExpiryMapping(index, 'minDays', event.target.value === '' ? null : Number(event.target.value))
                    }
                  />
                </label>

                <label>
                  Max days
                  <input
                    type="number"
                    value={mapping.maxDays ?? ''}
                    disabled={mapping.key === 'no-expiry'}
                    onChange={(event) =>
                      updateExpiryMapping(index, 'maxDays', event.target.value === '' ? null : Number(event.target.value))
                    }
                  />
                </label>

                <label>
                  Background
                  <input
                    type="color"
                    value={mapping.backgroundColor}
                    onChange={(event) => updateExpiryMapping(index, 'backgroundColor', event.target.value)}
                  />
                </label>

                <label>
                  Font
                  <input
                    type="color"
                    value={mapping.fontColor}
                    onChange={(event) => updateExpiryMapping(index, 'fontColor', event.target.value)}
                  />
                </label>

                <label className="expiry-mapping-action-input">
                  AI action
                  <textarea
                    value={mapping.action}
                    rows={2}
                    onChange={(event) => updateExpiryMapping(index, 'action', event.target.value)}
                  />
                </label>
              </section>
            ))}
          </div>

          <div className="expiry-mapping-footer">
            <span>Saved in this browser for now. It can later move to a tenant/admin settings API.</span>
            <button type="button" onClick={() => setExpiryLabelMappings(defaultExpiryLabelMappings)}>
              Restore default mapping
            </button>
          </div>
        </details>
      </section>
    );
  }
"""

tsx = replace_once(tsx, mark_action_block, expiry_renderer, "expiry controls renderer")

# 10) Remove duplicated active page marker.
active_marker = """      <section className="inventory-active-page-marker" data-active-inventory-view={activeInventoryView}>
        <span>Inventory page</span>
        <strong>{activeInventoryMeta.label}</strong>
        <small>{activeInventoryMeta.description}</small>
      </section>

"""

tsx = replace_once(tsx, active_marker, "", "duplicate active page marker")

# 11) Add expiry controls before Batch and Expiry Review table.
batch_table_marker = """                <div className="inventory-master-table inventory-master-table--rhia-format inventory-master-table--batch-expiry-register">
"""

tsx = replace_once(
    tsx,
    batch_table_marker,
    """                {renderExpiryControls('Review batches that need action before sale, dispensing, transfer, return or quarantine.')}

""" + batch_table_marker,
    "batch expiry controls",
)

# 12) Extend Batch and Expiry Review table columns.
tsx = tsx.replace(
    """                    <strong>Batch Status</strong>
                    <strong>Supplier</strong>
                    <strong>Actions</strong>""",
    """                    <strong>Batch Status</strong>
                    <strong>Supplier</strong>
                    <strong>Expiry Label</strong>
                    <strong>AI Action</strong>
                    <strong>Actions</strong>""",
    1,
)

tsx = tsx.replace(
    """                         <div key={batch?.id ?? `${batch?.batch_number}-${index}`} className="batch-expiry-register-row">""",
    """                         <div
                           key={batch?.id ?? `${batch?.batch_number}-${index}`}
                           className={`batch-expiry-register-row expiry-risk-row expiry-risk-row--${expiryRiskKey(days, expiryLabelMappings)}`}
                           style={expiryRowStyle(days, expiryLabelMappings)}
                         >""",
    1,
)

old_batch_actions = """                          <span>{batchStatusText(batch)}</span>
                          <span>{batch?.supplier_name ?? 'Not set'}</span>
                          <span className="table-action-row">
                            <button type="button" onClick={() => markAction(`View batch ${batch?.batch_number ?? batch?.id ?? ''}`)}>View</button>
                            <button type="button" onClick={() => markAction(`Review batch ${batch?.batch_number ?? batch?.id ?? ''}`)}>Review</button>
                          </span>"""

new_batch_actions = """                          <span>{batchStatusText(batch)}</span>
                          <span>{batch?.supplier_name ?? 'Not set'}</span>
                          <span>{renderExpiryChip(days)}</span>
                          <span>{expiryAction(days)}</span>
                          <span className="table-action-row table-action-row--compact">
                            <button type="button" onClick={() => markAction(`View batch ${batch?.batch_number ?? batch?.id ?? ''}`)}>View</button>
                            <button type="button" onClick={() => markAction(`Review batch ${batch?.batch_number ?? batch?.id ?? ''}`)}>Review</button>
                            <button type="button" onClick={() => markAction(`Transfer review for batch ${batch?.batch_number ?? batch?.id ?? ''}`)}>Transfer</button>
                            <button type="button" className="danger" onClick={() => markAction(`Quarantine review for batch ${batch?.batch_number ?? batch?.id ?? ''}`)}>Quarantine</button>
                          </span>"""

tsx = replace_once(tsx, old_batch_actions, new_batch_actions, "batch expiry actions")

# 13) Add expiry controls to Near Expiry.
near_toolbar_marker = """              <BatchTable
                rows={pagedNearExpiry}"""

tsx = replace_once(
    tsx,
    near_toolbar_marker,
    """              {renderExpiryControls('Use this view to decide whether to sell first, transfer, return, or quarantine before expiry.')}

              <BatchTable
                rows={pagedNearExpiry}""",
    "near expiry controls",
)

tsx = tsx.replace(
    """                onAction={renderBatchActions}
                showRecommendedAction""",
    """                onAction={renderBatchActions}
                expiryMappings={expiryLabelMappings}
                showRecommendedAction""",
    1,
)

# 14) Replace Stock Locations simple list with aligned table and admin actions.
old_locations_section = """          {activeInventoryView === 'locations' && locations && (
            <section className="inventory-section">
              {renderTableToolbar({
                title: 'Stock locations',
                subtitle: 'Branch-scoped stock storage points, shelves and stores.',
                selectedCount: 0,
                onExport: () =>
                  exportCsv(
                    'stock-locations.csv',
                    ['Location', 'Code', 'Type', 'Branch', 'Batches', 'Status'],
                    locations.locations.map((location) => [
                      location.name,
                      location.code,
                      location.location_type,
                      location.branch?.name ?? '',
                      location.stock_batches_count,
                      location.status,
                    ]),
                  ),
                onBulkEdit: () => markAction('Stock location bulk edit'),
                onBulkDelete: () => markAction('Stock location bulk delete'),
              })}

              <div className="inventory-table location-preview-table">
                {locations.locations.map((location) => (
                  <div key={location.id}>
                    <strong>{location.name}</strong>
                    <span>{location.code}</span>
                    <span>{location.location_type.replaceAll('_', ' ')}</span>
                    <small>{location.stock_batches_count} batches</small>
                  </div>
                ))}
              </div>
            </section>
          )}"""

new_locations_section = """          {activeInventoryView === 'locations' && locations && (
            <section className="inventory-section">
              {renderTableToolbar({
                title: 'Stock locations',
                subtitle: 'Update stock location details used by receiving, dispensing and stock counts.',
                selectedCount: 0,
                onExport: () =>
                  exportCsv(
                    'stock-locations.csv',
                    ['Location', 'Code', 'Type', 'Branch', 'Batches', 'Status'],
                    locations.locations.map((location) => [
                      location.name,
                      location.code,
                      location.location_type,
                      location.branch?.name ?? '',
                      location.stock_batches_count,
                      location.status,
                    ]),
                  ),
                onBulkEdit: () => markAction('Stock location bulk edit'),
                onBulkDelete: () => markAction('Stock location bulk delete'),
              })}

              <div className="inventory-action-card-grid inventory-action-card-grid--title-only stock-location-management-actions">
                {[
                  ['create', 'Create New'],
                  ['edit', 'Edit'],
                  ['delete', 'Delete'],
                  ['replace', 'Replace'],
                ].map(([action, label]) => (
                  <button
                    key={action}
                    type="button"
                    onClick={() =>
                      setInventoryNotice(
                        action === 'create'
                          ? 'Create New stock location selected. Capture name, code, branch, type and status before saving.'
                          : `${label} stock location selected. Choose the row below and confirm permissions before making changes.`,
                      )
                    }
                  >
                    <strong>{label}</strong>
                  </button>
                ))}
              </div>

              <div className="inventory-master-table inventory-master-table--wide inventory-master-table--stock-locations">
                <div className="inventory-master-table__header stock-location-register-row">
                  <strong>Location</strong>
                  <strong>Code</strong>
                  <strong>Type</strong>
                  <strong>Branch</strong>
                  <strong className="rhia-number-cell">Batches</strong>
                  <strong>Status</strong>
                  <strong>Actions</strong>
                </div>

                {locations.locations.length === 0 ? (
                  <div className="stock-location-register-row stock-location-register-row--empty">
                    <span>No stock locations found.</span>
                  </div>
                ) : (
                  locations.locations.map((location) => (
                    <div key={location.id} className="stock-location-register-row">
                      <span><strong>{location.name}</strong></span>
                      <span>{location.code}</span>
                      <span>{location.location_type.replaceAll('_', ' ')}</span>
                      <span>{location.branch?.name ?? 'Branch not set'}</span>
                      <span className="rhia-number-cell">{formatNumber(location.stock_batches_count)}</span>
                      <span>{location.status}</span>
                      <span className="table-action-row table-action-row--compact">
                        <button type="button" onClick={() => setInventoryNotice(`Viewing ${location.name}.`)}>
                          View
                        </button>
                        <button type="button" onClick={() => setInventoryNotice(`Edit selected for ${location.name}.`)}>
                          Edit
                        </button>
                        <button
                          type="button"
                          className="danger"
                          onClick={() =>
                            setInventoryNotice(
                              `Delete requested for ${location.name}. Confirm the backend delete endpoint before removing an active location.`,
                            )
                          }
                        >
                          Delete
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setInventoryNotice(
                              `Replace requested for ${location.name}. Confirm replacement rules before moving stock records.`,
                            )
                          }
                        >
                          Replace
                        </button>
                      </span>
                    </div>
                  ))
                )}
              </div>
            </section>
          )}"""

tsx = replace_once(tsx, old_locations_section, new_locations_section, "stock locations table")

# 15) Upgrade BatchTable props and row rendering.
tsx = tsx.replace(
    """  onAction,
  showRecommendedAction = false,
}: {
  rows: PharmaStockBatch[];
  selectedBatchIds: number[];
  onToggleBatch: (id: number) => void;
  onSelectAll: () => void;
  onAction: (batch: PharmaStockBatch) => React.ReactNode;
  showRecommendedAction?: boolean;
}) {
  return (
    <div className="inventory-master-table inventory-master-table--wide">
      <div className="inventory-master-table__header">""",
    """  onAction,
  expiryMappings = defaultExpiryLabelMappings,
  showRecommendedAction = false,
}: {
  rows: PharmaStockBatch[];
  selectedBatchIds: number[];
  onToggleBatch: (id: number) => void;
  onSelectAll: () => void;
  onAction: (batch: PharmaStockBatch) => React.ReactNode;
  expiryMappings?: ExpiryLabelMapping[];
  showRecommendedAction?: boolean;
}) {
  return (
    <div className="inventory-master-table inventory-master-table--wide inventory-master-table--batch-watch">
      <div className="inventory-master-table__header batch-watch-row">""",
    1,
)

tsx = tsx.replace("{showRecommendedAction && <strong>Recommended action</strong>}", "{showRecommendedAction && <strong>AI action</strong>}", 1)

old_batch_table_map = """        rows.map((batch) => {
          const days = remainingDays(batch.expiry_date);

          return (
            <div key={batch.id}>
              <span><input type="checkbox" checked={selectedBatchIds.includes(batch.id)} onChange={() => onToggleBatch(batch.id)} /></span>
              <span><strong>{batch.product.name}</strong><small>{batch.product.sku}</small></span>
              <span>{batch.batch_number}</span>
              <span>{batch.stock_location.name} ({batch.stock_location.code})</span>
              <span>{formatNumber(batch.available_quantity)}</span>
              <span>{formatDate(batch.expiry_date)}</span>
              <span>{days === null ? 'N/A' : days}</span>
              <span>{batch.supplier_name ?? 'Not set'} · {expiryStatus(days)}</span>
              {showRecommendedAction && <span>{expiryAction(days)}</span>}
              <span>{onAction(batch)}</span>
            </div>
          );
        })"""

new_batch_table_map = """        rows.map((batch) => {
          const days = remainingDays(batch.expiry_date);
          const mapping = expiryMappingForDays(days, expiryMappings);

          return (
            <div
              key={batch.id}
              className={`batch-watch-row expiry-risk-row expiry-risk-row--${mapping.key}`}
              style={expiryRowStyle(days, expiryMappings)}
            >
              <span><input type="checkbox" checked={selectedBatchIds.includes(batch.id)} onChange={() => onToggleBatch(batch.id)} /></span>
              <span><strong>{batch.product.name}</strong><small>{batch.product.sku}</small></span>
              <span>{batch.batch_number}</span>
              <span>{batch.stock_location.name} ({batch.stock_location.code})</span>
              <span className="rhia-number-cell">{formatNumber(batch.available_quantity)}</span>
              <span>{formatDate(batch.expiry_date)}</span>
              <span className="rhia-number-cell">{days === null ? 'N/A' : days}</span>
              <span>
                <small>{batch.supplier_name ?? 'Not set'}</small>
                <span
                  className={`expiry-risk-chip expiry-risk-chip--${mapping.key}`}
                  style={{ backgroundColor: mapping.backgroundColor, color: mapping.fontColor }}
                >
                  {mapping.label}
                </span>
              </span>
              {showRecommendedAction && <span>{mapping.action}</span>}
              <span>{onAction(batch)}</span>
            </div>
          );
        })"""

tsx = replace_once(tsx, old_batch_table_map, new_batch_table_map, "BatchTable row rendering")

# 16) Append CSS overrides for alignment, labels and 2x2 actions.
css_add = r"""

/* Issue #119 inventory cleanup: aligned tables, expiry labels, 2x2 actions and stock locations */
.inventory-preview-panel .table-action-row,
.inventory-preview-panel .product-master-action-button-row,
.inventory-preview-panel .product-inventory-action-button-row,
.inventory-preview-panel .table-action-row--compact {
  display: grid !important;
  grid-template-columns: repeat(2, minmax(4.8rem, 1fr));
  gap: 0.35rem;
  align-items: stretch;
  min-width: 10rem;
  max-width: 13rem;
}

.inventory-preview-panel .table-action-row button,
.inventory-preview-panel .product-master-action-button-row button,
.inventory-preview-panel .product-inventory-action-button-row button,
.inventory-preview-panel .inventory-action-button {
  width: 100%;
  min-height: 2rem;
  border-radius: 0.65rem;
  padding: 0.38rem 0.5rem;
  font-size: 0.72rem;
  line-height: 1.15;
  white-space: normal;
}

.inventory-preview-panel .table-action-row button.danger,
.inventory-preview-panel .inventory-action-button.danger {
  color: #ffffff;
  background: #991b1b;
  border-color: #7f1d1d;
}

.inventory-table-scroll,
.inventory-master-table {
  overflow-x: auto;
}

.inventory-master-table > div {
  align-items: stretch;
}

.inventory-master-table > div > span,
.inventory-master-table > div > strong {
  min-width: 0;
  overflow-wrap: anywhere;
  align-content: center;
}

.rhia-number-cell {
  text-align: right;
  justify-self: stretch;
}

.batch-expiry-register-row {
  display: grid;
  grid-template-columns:
    3rem
    minmax(6.5rem, 0.7fr)
    minmax(13rem, 1.4fr)
    minmax(13rem, 1.4fr)
    minmax(6rem, 0.6fr)
    minmax(7rem, 0.75fr)
    minmax(7rem, 0.7fr)
    minmax(8rem, 0.8fr)
    minmax(9rem, 0.9fr)
    minmax(7rem, 0.65fr)
    minmax(8rem, 0.8fr)
    minmax(7rem, 0.65fr)
    minmax(7rem, 0.75fr)
    minmax(8rem, 0.8fr)
    minmax(8rem, 0.85fr)
    minmax(14rem, 1.2fr)
    minmax(11rem, 0.9fr);
  gap: 0.65rem;
  padding: 0.72rem 0.8rem;
  border-bottom: 1px solid rgba(148, 163, 184, 0.16);
}

.batch-watch-row {
  display: grid;
  grid-template-columns:
    2.8rem
    minmax(13rem, 1.3fr)
    minmax(8rem, 0.8fr)
    minmax(11rem, 1fr)
    minmax(7rem, 0.65fr)
    minmax(8rem, 0.75fr)
    minmax(7rem, 0.65fr)
    minmax(12rem, 1fr)
    minmax(16rem, 1.15fr)
    minmax(11rem, 0.85fr);
  gap: 0.65rem;
  padding: 0.72rem 0.8rem;
  border-bottom: 1px solid rgba(148, 163, 184, 0.16);
}

.stock-location-register-row {
  display: grid;
  grid-template-columns:
    minmax(14rem, 1.3fr)
    minmax(7rem, 0.7fr)
    minmax(9rem, 0.8fr)
    minmax(12rem, 1fr)
    minmax(7rem, 0.65fr)
    minmax(7rem, 0.65fr)
    minmax(11rem, 0.9fr);
  gap: 0.75rem;
  padding: 0.75rem 0.85rem;
  border-bottom: 1px solid rgba(148, 163, 184, 0.16);
}

.inventory-master-table__header.batch-expiry-register-row,
.inventory-master-table__header.batch-watch-row,
.inventory-master-table__header.stock-location-register-row {
  background: #ecfdf5;
  color: #0f766e;
  font-size: 0.74rem;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.035em;
}

.expiry-control-stack {
  display: grid;
  gap: 0.85rem;
  margin: 0.9rem 0 1rem;
}

.expiry-control-heading {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: start;
  border: 1px solid rgba(15, 118, 110, 0.14);
  border-radius: 1rem;
  padding: 0.85rem;
  background: #ffffff;
}

.expiry-control-heading div {
  display: grid;
  gap: 0.25rem;
}

.expiry-control-heading strong {
  color: #0f766e;
}

.expiry-control-heading span {
  color: #64748b;
  font-size: 0.86rem;
}

.inventory-expiry-filter-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(9rem, 1fr));
  gap: 0.75rem;
}

.inventory-expiry-filter-grid label,
.expiry-mapping-grid label {
  display: grid;
  gap: 0.35rem;
  color: #475569;
  font-size: 0.78rem;
  font-weight: 850;
}

.inventory-expiry-filter-grid select,
.expiry-mapping-grid input,
.expiry-mapping-grid textarea {
  width: 100%;
  border: 1px solid rgba(148, 163, 184, 0.35);
  border-radius: 0.75rem;
  padding: 0.55rem 0.65rem;
  background: #ffffff;
  color: #0f172a;
}

.expiry-legend-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(9rem, 1fr));
  gap: 0.6rem;
}

.expiry-legend-card {
  display: grid;
  gap: 0.3rem;
  min-height: 6.5rem;
  border-radius: 0.9rem;
  padding: 0.7rem;
  border: 1px solid rgba(15, 23, 42, 0.08);
}

.expiry-legend-card strong,
.expiry-legend-card span,
.expiry-legend-card small {
  color: inherit;
}

.expiry-legend-card span,
.expiry-legend-card small {
  font-size: 0.72rem;
  line-height: 1.3;
}

.expiry-risk-chip {
  display: inline-flex;
  width: fit-content;
  border-radius: 999px;
  padding: 0.28rem 0.52rem;
  font-size: 0.72rem;
  font-weight: 900;
  line-height: 1.1;
  border: 1px solid rgba(15, 23, 42, 0.08);
}

.expiry-risk-row--expired,
.expiry-risk-row--expired span,
.expiry-risk-row--expired strong,
.expiry-risk-row--expired small {
  color: #ffffff;
}

.expiry-risk-row--expired .expiry-risk-chip {
  border-color: rgba(255, 255, 255, 0.35);
}

.expiry-mapping-management-card {
  border: 1px solid rgba(15, 118, 110, 0.16);
  border-radius: 1rem;
  background: #ffffff;
  padding: 0.8rem;
}

.expiry-mapping-management-card summary {
  cursor: pointer;
  color: #0f766e;
  font-weight: 900;
}

.expiry-mapping-grid {
  display: grid;
  gap: 0.85rem;
  margin-top: 0.85rem;
}

.expiry-mapping-grid section {
  display: grid;
  grid-template-columns: minmax(10rem, 1fr) repeat(4, minmax(6.5rem, 0.55fr)) minmax(16rem, 1.4fr);
  gap: 0.65rem;
  padding: 0.75rem;
  border: 1px solid rgba(148, 163, 184, 0.16);
  border-radius: 0.9rem;
  background: #f8fafc;
}

.expiry-mapping-action-input textarea {
  min-height: 4rem;
}

.expiry-mapping-footer {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  align-items: center;
  margin-top: 0.85rem;
  color: #64748b;
  font-size: 0.82rem;
}

.stock-location-management-actions {
  margin: 0.85rem 0;
}

@media (max-width: 1280px) {
  .inventory-expiry-filter-grid {
    grid-template-columns: repeat(2, minmax(9rem, 1fr));
  }

  .expiry-legend-grid {
    grid-template-columns: repeat(2, minmax(9rem, 1fr));
  }

  .expiry-mapping-grid section {
    grid-template-columns: repeat(2, minmax(10rem, 1fr));
  }
}

@media (max-width: 760px) {
  .inventory-expiry-filter-grid,
  .expiry-legend-grid,
  .expiry-mapping-grid section {
    grid-template-columns: 1fr;
  }

  .expiry-control-heading,
  .expiry-mapping-footer {
    flex-direction: column;
    align-items: stretch;
  }
}
"""

if "Issue #119 inventory cleanup" not in css:
    css += css_add

tsx_path.write_text(tsx)
css_path.write_text(css)

print("Inventory issue #119 patch applied.")
