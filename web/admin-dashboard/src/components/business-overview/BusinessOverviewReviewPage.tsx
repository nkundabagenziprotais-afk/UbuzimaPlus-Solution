import {
  businessOverviewKpis,
  businessOverviewModules,
  recommendedActions,
} from './businessOverviewMockData';

function toneClass(tone?: string) {
  return tone ? `is-${tone}` : 'is-neutral';
}

const emptyRows = {
  revenue: [
    'Gross Sales',
    'Discounts',
    'Returns / Reversals',
    'Net Sales',
    'Collections',
    'Credit Sales',
    'Insurance Sales',
    'Net Cash Inflow',
  ],
  expenses: ['Operating Expenses', 'Gross Profit', 'Estimated Net Profit', 'Gross Margin', 'Net Margin'],
  inventory: ['Total Inventory Value', 'Low Stock Items', 'Expiring Items', 'Out of Stock Revenue Risk'],
  insurance: ['Insurance Sales', 'Insurer Receivable', 'Top Insurer', 'AR Over 30 Days'],
};

function EmptyTable({ rows }: { rows: string[] }) {
  return (
    <table>
      <tbody>
        {rows.map((row) => (
          <tr key={row}>
            <th>{row}</th>
            <td>—</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function BusinessOverviewReviewPage() {
  return (
    <section className="bo-v3-page">
      <header className="bo-v3-header">
        <div>
          <div className="bo-v3-title-row">
            <span className="bo-v3-title-icon">⌘</span>
            <h1>Business Overview</h1>
            <strong>Business Driving Engine</strong>
          </div>
          <p>360° view of revenue, cash, expenses, profitability, goals, and operational risks.</p>
        </div>
      </header>

      <section className="bo-v3-filter-strip">
        <label>
          <span>Date Range</span>
          <select defaultValue="current">
            <option value="current">Current Period</option>
          </select>
        </label>

        <label>
          <span>Business Date</span>
          <select defaultValue="business-date">
            <option value="business-date">Business Date</option>
            <option value="transaction-time">Transaction Timestamp</option>
          </select>
        </label>

        <label>
          <span>Branch</span>
          <select defaultValue="all">
            <option value="all">All Branches</option>
          </select>
        </label>

        <label>
          <span>Compare</span>
          <select defaultValue="none">
            <option value="none">No Comparison</option>
          </select>
        </label>

        <article>
          <small>Revenue Goal</small>
          <strong>—</strong>
        </article>

        <article>
          <small>Profit Goal</small>
          <strong>—</strong>
        </article>

        <article>
          <small>Expense Mode</small>
          <strong>—</strong>
        </article>
      </section>

      <section className="bo-v3-module-grid">
        {businessOverviewModules.map((module) => (
          <article key={module.id} className={`bo-v3-module-card is-${module.accent}`}>
            <span className="bo-v3-module-icon">{module.title.slice(0, 2)}</span>
            <div>
              <div className="bo-v3-module-heading">
                <h3>{module.title}</h3>
                <span>›</span>
              </div>
              <button type="button">Open Analytics →</button>
            </div>
          </article>
        ))}
      </section>

      <section>
        <h2 className="bo-v3-section-title">Key Performance Indicators</h2>
        <div className="bo-v3-kpi-grid">
          {businessOverviewKpis.map((kpi) => (
            <article key={kpi.label} className={`bo-v3-kpi-card ${toneClass(kpi.tone)}`}>
              <div className="bo-v3-kpi-heading">
                <small>{kpi.label}</small>
              </div>
              <strong>{kpi.value}</strong>
              <span>{kpi.helper}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="bo-v3-analytics-grid">
        <article className="bo-v3-panel bo-v3-panel-table bo-v3-panel-daily">
          <header>
            <h3>Daily Revenue Operation</h3>
            <select defaultValue="current">
              <option value="current">Current</option>
            </select>
          </header>
          <EmptyTable rows={emptyRows.revenue} />
        </article>

        <article className="bo-v3-panel bo-v3-panel-chart">
          <header>
            <h3>Sales Trend</h3>
            <div>
              <select defaultValue="transaction-value">
                <option value="transaction-value">Transaction Value</option>
              </select>
              <select defaultValue="day">
                <option value="day">By Day</option>
              </select>
            </div>
          </header>

          <div className="bo-v3-chart-shell">
            <div className="bo-v3-y-axis">
              <span>—</span>
              <span>—</span>
              <span>—</span>
              <span>—</span>
              <span>0</span>
            </div>
            <div className="bo-v3-line-chart bo-v3-line-chart--linear bo-v3-empty-chart">
              <svg viewBox="0 0 420 180" role="img" aria-label="No sales trend data available">
                <path className="bo-v3-trend-line-empty" d="M0 120 L420 120" />
              </svg>
              <div className="bo-v3-empty-state">No live sales trend data connected</div>
            </div>
          </div>

          <div className="bo-v3-x-axis">
            <span>Start</span>
            <span></span>
            <span></span>
            <span>End</span>
          </div>
          <div className="bo-v3-chart-legend">
            <span>Transaction value</span>
          </div>
        </article>

        <article className="bo-v3-panel bo-v3-panel-products bo-v3-panel-top-products">
          <header>
            <h3>Top Contributing Products (MTD)</h3>
            <select defaultValue="revenue">
              <option value="revenue">By Revenue</option>
            </select>
          </header>
          <div className="bo-v3-empty-state-card">No live product contribution data connected</div>
          <button type="button" className="bo-v3-panel-button">View All Products</button>
        </article>

        <article className="bo-v3-panel bo-v3-panel-payment bo-v3-panel-payment-mix">
          <header>
            <h3>Payment Mix (MTD)</h3>
          </header>
          <div className="bo-v3-payment-body">
            <div className="bo-v3-donut bo-v3-donut-empty">
              <div>
                <small>Total</small>
                <strong>—</strong>
              </div>
            </div>
            <ul>
              {['Cash', 'Mobile Money', 'Card', 'Insurance', 'Credit'].map((item) => (
                <li key={item}>
                  <span className="bo-v3-dot cash" />
                  <strong>{item}</strong>
                  <em>—</em>
                </li>
              ))}
            </ul>
          </div>
        </article>

        <article className="bo-v3-panel bo-v3-panel-table bo-v3-panel-expenses">
          <header><h3>Expenses & Profitability (MTD)</h3></header>
          <EmptyTable rows={emptyRows.expenses} />
          <button type="button" className="bo-v3-panel-button">View Details</button>
        </article>

        <article className="bo-v3-panel bo-v3-panel-table bo-v3-panel-inventory-risk">
          <header><h3>Inventory Risk Overview</h3></header>
          <EmptyTable rows={emptyRows.inventory} />
          <button type="button" className="bo-v3-panel-button">View Inventory Analytics</button>
        </article>

        <article className="bo-v3-panel bo-v3-panel-table bo-v3-panel-insurance">
          <header><h3>Insurance & Receivables (MTD)</h3></header>
          <EmptyTable rows={emptyRows.insurance} />
          <button type="button" className="bo-v3-panel-button">View Insurance Analytics</button>
        </article>

        <article className="bo-v3-panel bo-v3-panel-goals bo-v3-panel-business-goals">
          <header><h3>Business Goal Tracking</h3></header>
          <div className="bo-v3-goal-row">
            <div><span>Revenue Goal</span><strong>—</strong></div>
            <div className="bo-v3-progress"><span style={{ width: '0%' }} /></div>
            <em>—</em>
          </div>
          <div className="bo-v3-goal-row">
            <div><span>Profit Goal</span><strong>—</strong></div>
            <div className="bo-v3-progress"><span style={{ width: '0%' }} /></div>
            <em>—</em>
          </div>
          <button type="button" className="bo-v3-panel-button">View Goals & Forecast</button>
        </article>

        <aside className="bo-v3-insight-panel">
          <header>
            <span>✣</span>
            <h3>AI / Business Insight</h3>
          </header>

          <section>
            <h4>Business insights</h4>
            <p>Connect live operational data to activate automated insights, risks, and recommended actions.</p>
          </section>

          <section>
            <h4>Required data sources</h4>
            <ul>
              <li>POS sales and collections</li>
              <li>Inventory value, stock, and expiry</li>
              <li>Expenses, receivables, and goals</li>
            </ul>
          </section>

          <button type="button">View All Insights</button>
        </aside>

        <section className="bo-v3-actions-panel">
          <h3>Recommended Actions</h3>
          <div>
            {recommendedActions.map((item) => (
              <article key={item.title} className={`bo-v3-action-card ${toneClass(item.tone)}`}>
                <strong>{item.title}</strong>
                <p>{item.description}</p>
                <button type="button">{item.action}</button>
              </article>
            ))}
          </div>
        </section>
      </section>
    </section>
  );
}
