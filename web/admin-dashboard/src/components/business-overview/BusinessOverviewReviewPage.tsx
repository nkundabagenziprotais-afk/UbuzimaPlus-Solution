import {
  businessGoalSnapshot,
  businessOverviewKpis,
  businessOverviewModules,
  recommendedActions,
} from './businessOverviewMockData';

function toneClass(tone?: string) {
  return tone ? `is-${tone}` : 'is-neutral';
}


const salesTrend = [22, 46, 32, 78, 28, 72, 42, 35, 83, 48, 55, 24, 62, 46, 84, 30, 67];

const paymentMix = [
  { label: 'Cash', value: '61.7%', className: 'cash' },
  { label: 'Mobile Money', value: '18.9%', className: 'momo' },
  { label: 'Card', value: '10.4%', className: 'card' },
  { label: 'Insurance', value: '6.2%', className: 'insurance' },
  { label: 'Credit', value: '2.8%', className: 'credit' },
];

const topProducts = [
  { name: 'Panadol Extra (24s)', value: '1,820,000', percent: 92 },
  { name: 'Amoxicillin 500mg (100s)', value: '1,450,000', percent: 78 },
  { name: 'Vitamin C 1000mg (30s)', value: '1,120,000', percent: 62 },
  { name: 'Brufen 400mg (30s)', value: '980,000', percent: 54 },
  { name: 'ORS Sachets (20s)', value: '760,000', percent: 42 },
];

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
          <select defaultValue="may">
            <option value="may">May 1 – May 23, 2025</option>
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
          <select defaultValue="previous">
            <option value="previous">Apr 1 – Apr 23, 2025</option>
          </select>
        </label>

        <article>
          <small>Revenue Goal</small>
          <strong>50,000,000</strong>
        </article>

        <article>
          <small>Profit Goal</small>
          <strong>8,000,000</strong>
        </article>

        <article>
          <small>Expense Mode</small>
          <strong>Actual</strong>
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
              <p>{module.description}</p>
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
              <span>{kpi.trend ? `${kpi.trend} ` : ''}{kpi.helper}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="bo-v3-analytics-grid">
        <article className="bo-v3-panel bo-v3-panel-table">
          <header>
            <h3>Daily Revenue Operation</h3>
            <select defaultValue="today">
              <option value="today">Today</option>
            </select>
          </header>
          <table>
            <tbody>
              <tr><th>Gross Sales</th><td>1,650,000</td></tr>
              <tr><th>Discounts</th><td>-120,000</td></tr>
              <tr><th>Returns / Reversals</th><td>-45,000</td></tr>
              <tr className="positive"><th>Net Sales</th><td>1,485,000</td></tr>
              <tr><th>Collections</th><td>1,210,000</td></tr>
              <tr><th>Credit Sales</th><td>210,000</td></tr>
              <tr><th>Insurance Sales</th><td>65,000</td></tr>
              <tr className="strong positive"><th>Net Cash Inflow</th><td>1,385,000</td></tr>
            </tbody>
          </table>
        </article>

        <article className="bo-v3-panel bo-v3-panel-chart">
          <header>
            <h3>Sales Trend</h3>
            <div>
              <select defaultValue="net-sales"><option value="net-sales">Net Sales</option></select>
              <select defaultValue="day"><option value="day">By Day</option></select>
            </div>
          </header>
          <div className="bo-v3-line-chart">
            {salesTrend.map((height, index) => (
              <span key={`${height}-${index}`} style={{ height: `${height}%` }} />
            ))}
          </div>
          <div className="bo-v3-chart-legend">
            <span>May 1 – May 23, 2025</span>
            <span>Apr 1 – Apr 23, 2025</span>
          </div>
        </article>

        <article className="bo-v3-panel bo-v3-panel-products">
          <header>
            <h3>Top Contributing Products (MTD)</h3>
            <select defaultValue="revenue"><option value="revenue">By Revenue</option></select>
          </header>
          <div className="bo-v3-products">
            {topProducts.map((product) => (
              <div key={product.name} className="bo-v3-product-row">
                <div>
                  <span className="bo-v3-product-thumb" />
                  <strong>{product.name}</strong>
                </div>
                <div className="bo-v3-product-bar"><span style={{ width: `${product.percent}%` }} /></div>
                <em>{product.value}</em>
              </div>
            ))}
          </div>
          <button type="button" className="bo-v3-panel-button">View All Products</button>
        </article>

        <article className="bo-v3-panel bo-v3-panel-payment">
          <header>
            <h3>Payment Mix (MTD)</h3>
          </header>
          <div className="bo-v3-payment-body">
            <div className="bo-v3-donut">
              <div>
                <small>Total</small>
                <strong>24,650,000</strong>
              </div>
            </div>
            <ul>
              {paymentMix.map((item) => (
                <li key={item.label}>
                  <span className={`bo-v3-dot ${item.className}`} />
                  <strong>{item.label}</strong>
                  <em>{item.value}</em>
                </li>
              ))}
            </ul>
          </div>
        </article>

        <article className="bo-v3-panel bo-v3-panel-table">
          <header><h3>Expenses & Profitability (MTD)</h3></header>
          <table>
            <tbody>
              <tr><th>Operating Expenses</th><td>5,450,000</td></tr>
              <tr><th>Gross Profit</th><td>10,230,000</td></tr>
              <tr><th>Est. Net Profit</th><td>4,830,000</td></tr>
              <tr><th>Gross Margin</th><td>36.0%</td></tr>
              <tr><th>Net Margin</th><td>17.0%</td></tr>
            </tbody>
          </table>
          <button type="button" className="bo-v3-panel-button">View Details</button>
        </article>

        <article className="bo-v3-panel bo-v3-panel-table">
          <header><h3>Inventory Risk Overview</h3></header>
          <table>
            <tbody>
              <tr><th>Total Inventory Value</th><td>42,750,000</td></tr>
              <tr><th>Low Stock Items</th><td className="warning">124</td></tr>
              <tr><th>Expiring Items (30 days)</th><td className="warning">68</td></tr>
              <tr><th>Out of Stock Revenue Risk</th><td className="danger">12,450,000</td></tr>
            </tbody>
          </table>
          <button type="button" className="bo-v3-panel-button">View Inventory Analytics</button>
        </article>

        <article className="bo-v3-panel bo-v3-panel-table">
          <header><h3>Insurance & Receivables (MTD)</h3></header>
          <table>
            <tbody>
              <tr><th>Insurance Sales</th><td>1,615,000</td></tr>
              <tr><th>Insurer Receivable</th><td>3,850,000</td></tr>
              <tr><th>Top Insurer</th><td>Jubilee Assurance</td></tr>
              <tr><th>AR Over 30 Days</th><td>2,150,000</td></tr>
            </tbody>
          </table>
          <button type="button" className="bo-v3-panel-button">View Insurance Analytics</button>
        </article>

        <article className="bo-v3-panel bo-v3-panel-goals">
          <header><h3>Business Goal Tracking (May 2025)</h3></header>
          <div className="bo-v3-goal-row">
            <div><span>Revenue Goal</span><strong>31,250,000 / 50,000,000</strong></div>
            <div className="bo-v3-progress"><span style={{ width: `${businessGoalSnapshot.revenueGoalProgress}%` }} /></div>
            <em>{businessGoalSnapshot.revenueGoalProgress}%</em>
          </div>
          <div className="bo-v3-goal-row">
            <div><span>Profit Goal</span><strong>9,850,000 / 8,000,000</strong></div>
            <div className="bo-v3-progress"><span style={{ width: `${businessGoalSnapshot.profitGoalProgress}%` }} /></div>
            <em>{businessGoalSnapshot.profitGoalProgress}%</em>
          </div>
          <button type="button" className="bo-v3-panel-button">View Goals & Forecast</button>
        </article>

        <aside className="bo-v3-insight-panel">
          <header>
            <span>✣</span>
            <h3>AI / Business Insight</h3>
          </header>

          <section>
            <h4>What changed?</h4>
            <p>Net revenue is up 17.3% compared to the previous period.</p>
          </section>

          <section>
            <h4>Why it matters?</h4>
            <p>Growth is driven by strong product sales and higher collections.</p>
          </section>

          <section>
            <h4>Risks detected</h4>
            <ul>
              <li>Outstanding balance is increasing.</li>
              <li>12 products are out of stock that contributed 12.45M in sales last month.</li>
            </ul>
          </section>

          <section>
            <h4>Recommended actions</h4>
            <ul>
              <li>Focus on collections and follow up credit customers.</li>
              <li>Replenish high-revenue out-of-stock items.</li>
            </ul>
          </section>

          <button type="button">View All Insights</button>
        </aside>

        <section className="bo-v3-actions-panel">
          <h3>Recommended Actions</h3>
          <div>
            {recommendedActions.slice(0, 6).map((item) => (
              <article key={item.title} className={`bo-v3-action-card ${toneClass(item.tone)}`}>
                <strong>{item.title}</strong>
                <p>{item.description}</p>
                <button type="button">{item.action}</button>
              </article>
            ))}
          </div>
        </section>
      </section>

      <footer className="bo-v3-footer">
        All amounts in UGX · Business Date: May 23, 2025 11:45 AM
      </footer>
    </section>
  );
}
