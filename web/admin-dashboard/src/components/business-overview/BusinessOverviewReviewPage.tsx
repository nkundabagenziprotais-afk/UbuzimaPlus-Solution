import {
  businessGoalSnapshot,
  businessOverviewKpis,
  businessOverviewModules,
  recommendedActions,
} from './businessOverviewMockData';

function toneClass(tone?: string) {
  return tone ? `business-overview-${tone}` : 'business-overview-neutral';
}

export function BusinessOverviewReviewPage() {
  return (
    <section className="business-overview-page">
      <header className="business-overview-hero">
        <div>
          <p className="business-overview-eyebrow">Admin / Test Preview</p>
          <h1>
            Business Overview <span>Business Driving Engine</span>
          </h1>
          <p>
            360° view of revenue, cash, expenses, profitability, goals, and operational risks.
          </p>
        </div>

        <div className="business-overview-goal-cards">
          <article>
            <small>Revenue Goal</small>
            <strong>50,000,000</strong>
            <span>{businessGoalSnapshot.revenueGoalProgress}% MTD Progress</span>
          </article>
          <article>
            <small>Profit Goal</small>
            <strong>8,000,000</strong>
            <span>{businessGoalSnapshot.profitGoalProgress}% MTD Progress</span>
          </article>
          <article>
            <small>Expense Mode</small>
            <strong>Actual</strong>
            <span>Preview estimate</span>
          </article>
        </div>
      </header>

      <div className="business-overview-filters">
        <label>
          Date Range
          <select defaultValue="may">
            <option value="may">May 1 – May 23, 2025</option>
          </select>
        </label>

        <label>
          Business Date Mode
          <select defaultValue="business-date">
            <option value="business-date">Business Date</option>
            <option value="transaction-time">Transaction Timestamp</option>
          </select>
        </label>

        <label>
          Branch
          <select defaultValue="all">
            <option value="all">All Branches</option>
          </select>
        </label>

        <label>
          Compare With
          <select defaultValue="previous">
            <option value="previous">Apr 1 – Apr 23, 2025</option>
          </select>
        </label>

        <button type="button">Apply Filters</button>
      </div>

      <section className="business-overview-module-grid" aria-label="Business modules">
        {businessOverviewModules.map((module) => (
          <article key={module.id} className={`business-overview-module-card is-${module.accent}`}>
            <div>
              <span className="business-overview-module-icon">{module.title.slice(0, 2)}</span>
            </div>
            <div>
              <h3>{module.title}</h3>
              <p>{module.description}</p>
              <button type="button">{module.routeLabel} →</button>
            </div>
          </article>
        ))}
      </section>

      <section>
        <h2 className="business-overview-section-title">Key Performance Indicators</h2>
        <div className="business-overview-kpi-grid">
          {businessOverviewKpis.map((kpi) => (
            <article key={kpi.label} className={`business-overview-kpi-card ${toneClass(kpi.tone)}`}>
              <small>{kpi.label}</small>
              <strong>{kpi.value}</strong>
              <span>{kpi.trend ? `${kpi.trend} · ` : ''}{kpi.helper}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="business-overview-panel-grid">
        <article className="business-overview-panel">
          <header><h3>Daily Revenue Operation</h3><span>Today</span></header>
          <dl className="business-overview-ledger">
            <div><dt>Gross Sales</dt><dd>1,650,000</dd></div>
            <div><dt>Discounts</dt><dd>-120,000</dd></div>
            <div><dt>Returns / Reversals</dt><dd>-45,000</dd></div>
            <div className="strong"><dt>Net Sales</dt><dd>1,485,000</dd></div>
            <div><dt>Collections</dt><dd>1,210,000</dd></div>
            <div><dt>Credit Sales</dt><dd>210,000</dd></div>
            <div><dt>Insurance Sales</dt><dd>65,000</dd></div>
            <div className="positive strong"><dt>Net Cash Inflow</dt><dd>1,385,000</dd></div>
          </dl>
        </article>

        <article className="business-overview-panel business-overview-panel-wide">
          <header><h3>Sales Trend</h3><span>Net Sales by Day</span></header>
          <div className="business-overview-chart">
            {[38, 58, 44, 77, 49, 68, 53, 82, 61, 71, 46, 88].map((height) => (
              <span key={height} style={{ height: `${height}%` }} />
            ))}
          </div>
        </article>

        <article className="business-overview-panel">
          <header><h3>Top Contributing Products</h3><span>By Revenue</span></header>
          <ul className="business-overview-list">
            <li><span>Panadol Extra</span><strong>1,820,000</strong></li>
            <li><span>Amoxicillin 500mg</span><strong>1,450,000</strong></li>
            <li><span>Vitamin C 1000mg</span><strong>1,120,000</strong></li>
            <li><span>Brufen 400mg</span><strong>980,000</strong></li>
            <li><span>ORS Sachets</span><strong>760,000</strong></li>
          </ul>
        </article>

        <article className="business-overview-panel">
          <header><h3>Expenses & Profitability</h3><span>MTD</span></header>
          <dl className="business-overview-ledger">
            <div><dt>Operating Expenses</dt><dd>5,400,000</dd></div>
            <div><dt>Gross Profit</dt><dd>10,230,000</dd></div>
            <div className="strong"><dt>Estimated Net Profit</dt><dd>4,830,000</dd></div>
            <div><dt>Gross Margin</dt><dd>36.0%</dd></div>
            <div><dt>Net Margin</dt><dd>17.0%</dd></div>
          </dl>
        </article>

        <article className="business-overview-panel">
          <header><h3>Inventory Risk Overview</h3><span>Preview</span></header>
          <dl className="business-overview-ledger">
            <div><dt>Total Inventory Value</dt><dd>42,750,000</dd></div>
            <div><dt>Low Stock Items</dt><dd className="warning">124</dd></div>
            <div><dt>Expiring Items</dt><dd className="warning">68</dd></div>
            <div><dt>Out of Stock Revenue Risk</dt><dd className="danger">12,450,000</dd></div>
          </dl>
        </article>

        <article className="business-overview-panel">
          <header><h3>Insurance & Receivables</h3><span>MTD</span></header>
          <dl className="business-overview-ledger">
            <div><dt>Insurance Sales</dt><dd>1,615,000</dd></div>
            <div><dt>Insurer Receivable</dt><dd>3,850,000</dd></div>
            <div><dt>Top Insurer</dt><dd>Jubilee Assurance</dd></div>
            <div><dt>AR Over 30 Days</dt><dd>2,150,000</dd></div>
          </dl>
        </article>

        <article className="business-overview-panel business-overview-insight">
          <header><h3>AI / Business Insight</h3><span>Review summary</span></header>
          <h4>What changed?</h4>
          <p>Net revenue is up 17.3% compared to the previous period.</p>
          <h4>Why it matters</h4>
          <p>Growth is driven by stronger product sales and higher collections.</p>
          <h4>Risks detected</h4>
          <p>Outstanding balance is increasing, while 12 high-value products are at stock risk.</p>
          <h4>Recommended actions</h4>
          <p>Focus on collections, replenish fast-moving items, and review operating expenses.</p>
        </article>
      </section>

      <section>
        <h2 className="business-overview-section-title">Recommended Actions</h2>
        <div className="business-overview-actions">
          {recommendedActions.map((item) => (
            <article key={item.title} className={`business-overview-action ${toneClass(item.tone)}`}>
              <strong>{item.title}</strong>
              <p>{item.description}</p>
              <button type="button">{item.action}</button>
            </article>
          ))}
        </div>
      </section>

      <footer className="business-overview-footer">
        All amounts in UGX · Business Date: May 23, 2025 11:45 AM · Admin/Test Review
      </footer>
    </section>
  );
}
