import {
  businessGoalSnapshot,
  businessOverviewKpis,
  businessOverviewModules,
  recommendedActions,
} from './businessOverviewMockData';

function toneClass(tone?: string) {
  return tone ? `business-overview-${tone}` : 'business-overview-neutral';
}

function sourceClass(source: string) {
  return `business-overview-source business-overview-source-${source.toLowerCase()}`;
}

export function BusinessOverviewReviewPage() {
  return (
    <section className="business-overview-page business-overview-page--platform business-overview-page--executive-v2">
      <header className="business-overview-executive-hero">
        <div className="business-overview-title-stack">
          <div className="business-overview-command-strip">
            <span>Business Overview</span>
            <em>Admin/Test UAT</em>
            <em>Live + Preview</em>
          </div>

          <h1>Business Driving Engine</h1>

          <p>
            A 360° executive operating view of sales, collections, inventory risk, expenses,
            profitability, goals, and recommended actions across the pharmacy business.
          </p>

          <div className="business-overview-hero-tags">
            <span>Business Date Mode</span>
            <span>Branch Consolidated</span>
            <span>Revenue Goal Tracking</span>
            <span>Operational Risk View</span>
          </div>
        </div>

        <div className="business-overview-executive-summary-grid">
          <article>
            <small>Monthly Revenue Goal</small>
            <strong>50,000,000</strong>
            <span>{businessGoalSnapshot.revenueGoalProgress}% progress</span>
          </article>
          <article>
            <small>Monthly Profit Goal</small>
            <strong>8,000,000</strong>
            <span>{businessGoalSnapshot.profitGoalProgress}% progress</span>
          </article>
          <article>
            <small>Required Daily Cash</small>
            <strong>2,083,333</strong>
            <span>To reach revenue goal</span>
          </article>
          <article>
            <small>Current Risk Focus</small>
            <strong>Credit + Stock</strong>
            <span>Management attention</span>
          </article>
        </div>
      </header>

      <div className="business-overview-filters business-overview-filters--executive">
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
            <option value="previous">Previous comparable period</option>
          </select>
        </label>

        <button type="button">Apply Filters</button>
      </div>

      <section className="business-overview-section-heading business-overview-section-heading--executive">
        <div>
          <p className="business-overview-eyebrow">Module intelligence</p>
          <h2>Analytics & Reporting Workspaces</h2>
        </div>
        <span>Each module will open a dedicated analytics and reporting page as implementation continues.</span>
      </section>

      <section className="business-overview-module-grid business-overview-module-grid--executive">
        {businessOverviewModules.map((module) => (
          <article key={module.id} className={`business-overview-module-card business-overview-module-card--executive is-${module.accent}`}>
            <span className="business-overview-module-icon">{module.title.slice(0, 2)}</span>
            <div>
              <div className="business-overview-module-title-row">
                <h3>{module.title}</h3>
                <em className={sourceClass(module.status)}>{module.status}</em>
              </div>
              <p>{module.description}</p>
              <button type="button">Open Analytics →</button>
            </div>
          </article>
        ))}
      </section>

      <section className="business-overview-section-heading business-overview-section-heading--executive">
        <div>
          <p className="business-overview-eyebrow">Executive scorecard</p>
          <h2>Key Performance Indicators</h2>
        </div>
        <span>Live indicators are connected first. Preview and Config values will become live when Expenses and Goals modules are connected.</span>
      </section>

      <div className="business-overview-kpi-grid business-overview-kpi-grid--executive-v2">
        {businessOverviewKpis.map((kpi) => (
          <article key={kpi.label} className={`business-overview-kpi-card business-overview-kpi-card--executive ${toneClass(kpi.tone)}`}>
            <div className="business-overview-kpi-topline">
              <small>{kpi.label}</small>
              <em className={sourceClass(kpi.source)}>{kpi.source}</em>
            </div>
            <strong>{kpi.value}</strong>
            <span>{kpi.trend ? `${kpi.trend} · ` : ''}{kpi.helper}</span>
          </article>
        ))}
      </div>

      <section className="business-overview-panel-grid business-overview-panel-grid--executive">
        <article className="business-overview-panel business-overview-panel--table">
          <header>
            <h3>Daily Revenue Operation</h3>
            <span>Live operating view</span>
          </header>

          <table className="business-overview-table">
            <tbody>
              <tr><th>Gross Sales</th><td>1,650,000</td></tr>
              <tr><th>Discounts</th><td>-120,000</td></tr>
              <tr><th>Returns / Reversals</th><td>-45,000</td></tr>
              <tr className="strong"><th>Net Sales</th><td>1,485,000</td></tr>
              <tr><th>Collections</th><td>1,210,000</td></tr>
              <tr><th>Credit Sales</th><td>210,000</td></tr>
              <tr><th>Insurance Sales</th><td>65,000</td></tr>
            </tbody>
          </table>
        </article>

        <article className="business-overview-panel business-overview-panel-wide business-overview-panel--chart">
          <header>
            <h3>Sales Trend</h3>
            <span>Net sales by day</span>
          </header>
          <div className="business-overview-chart business-overview-chart--executive">
            {[38, 58, 44, 77, 49, 68, 53, 82, 61, 71, 46, 88].map((height, index) => (
              <span key={`${height}-${index}`} style={{ height: `${height}%` }} />
            ))}
          </div>
        </article>

        <article className="business-overview-panel business-overview-panel--table">
          <header>
            <h3>Top Contributing Products</h3>
            <span>Revenue contribution</span>
          </header>

          <table className="business-overview-table">
            <tbody>
              <tr><th>Panadol Extra</th><td>1,820,000</td></tr>
              <tr><th>Amoxicillin 500mg</th><td>1,450,000</td></tr>
              <tr><th>Vitamin C 1000mg</th><td>1,120,000</td></tr>
              <tr><th>Brufen 400mg</th><td>980,000</td></tr>
              <tr><th>ORS Sachets</th><td>760,000</td></tr>
            </tbody>
          </table>
        </article>

        <article className="business-overview-panel business-overview-panel--table">
          <header>
            <h3>Goal & Break-even Control</h3>
            <span>Preview model</span>
          </header>

          <table className="business-overview-table">
            <tbody>
              <tr><th>Break-even Daily Cash</th><td>234,783</td></tr>
              <tr><th>Daily Cash for Revenue Goal</th><td>2,083,333</td></tr>
              <tr><th>Daily Cash for Profit Goal</th><td>352,222</td></tr>
              <tr><th>Remaining Operating Days</th><td>9</td></tr>
              <tr className="strong"><th>Target Status</th><td>Monitor Daily</td></tr>
            </tbody>
          </table>
        </article>

        <article className="business-overview-panel business-overview-panel--table">
          <header>
            <h3>Expenses & Profitability</h3>
            <span>Preview model</span>
          </header>

          <table className="business-overview-table">
            <tbody>
              <tr><th>Operating Expenses</th><td>5,400,000</td></tr>
              <tr><th>Gross Profit</th><td>10,230,000</td></tr>
              <tr className="strong"><th>Estimated Net Profit</th><td>4,830,000</td></tr>
              <tr><th>Gross Margin</th><td>36.0%</td></tr>
              <tr><th>Net Margin</th><td>17.0%</td></tr>
            </tbody>
          </table>
        </article>

        <article className="business-overview-panel business-overview-panel--table">
          <header>
            <h3>Inventory Risk Overview</h3>
            <span>Live + risk estimate</span>
          </header>

          <table className="business-overview-table">
            <tbody>
              <tr><th>Total Inventory Value</th><td>42,750,000</td></tr>
              <tr><th>Low Stock Items</th><td className="warning">124</td></tr>
              <tr><th>Expiring Items</th><td className="warning">68</td></tr>
              <tr className="strong"><th>Out-of-stock Revenue Risk</th><td className="danger">12,450,000</td></tr>
            </tbody>
          </table>
        </article>

        <article className="business-overview-panel business-overview-insight business-overview-insight--executive">
          <header>
            <h3>AI / Business Insight</h3>
            <span>Executive summary</span>
          </header>
          <h4>What changed?</h4>
          <p>Revenue and collections are growing, but outstanding balance is also increasing.</p>
          <h4>Why it matters</h4>
          <p>The business can reach the monthly target only if collections and fast-moving stock availability remain strong.</p>
          <h4>Risks detected</h4>
          <p>Credit exposure, expense trend, and revenue-driving product stock risk need close management attention.</p>
          <h4>Recommended action</h4>
          <p>Prioritize collections, replenish high-contribution products, and approve the live expense and goal model.</p>
        </article>
      </section>

      <section className="business-overview-section-heading business-overview-section-heading--executive">
        <div>
          <p className="business-overview-eyebrow">Management action queue</p>
          <h2>Recommended Actions</h2>
        </div>
      </section>

      <div className="business-overview-actions business-overview-actions--executive">
        {recommendedActions.map((item) => (
          <article key={item.title} className={`business-overview-action business-overview-action--executive ${toneClass(item.tone)}`}>
            <strong>{item.title}</strong>
            <p>{item.description}</p>
            <button type="button">{item.action}</button>
          </article>
        ))}
      </div>

      <footer className="business-overview-footer">
        Business Overview UAT · Amounts in UGX · Live data integration in progress
      </footer>
    </section>
  );
}
