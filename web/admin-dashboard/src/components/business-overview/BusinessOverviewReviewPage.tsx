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
    <section className="business-overview-page business-overview-page--platform">
      <header className="business-overview-hero business-overview-hero--executive">
        <div className="business-overview-brand-block">
          <img
            src="/admin/assets/ubuzima-logo.png"
            alt="UbuzimaPlus"
            className="business-overview-logo"
          />
          <div>
            <p className="business-overview-eyebrow">Business Overview · Admin/Test</p>
            <h1>
              Business Driving Engine
              <span>360° operational intelligence</span>
            </h1>
            <p>
              Executive view of revenue, cash, inventory, expenses, profitability, goals,
              risks and recommended actions across pharmacy operations.
            </p>
          </div>
        </div>

        <div className="business-overview-goal-cards business-overview-goal-cards--executive">
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
            <small>Operating Mode</small>
            <strong>UAT Review</strong>
            <span>Live + preview model</span>
          </article>
        </div>
      </header>

      <div className="business-overview-filters business-overview-filters--compact">
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

      <section className="business-overview-module-grid business-overview-module-grid--professional">
        {businessOverviewModules.map((module) => (
          <article key={module.id} className={`business-overview-module-card is-${module.accent}`}>
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

      <section>
        <div className="business-overview-section-heading">
          <div>
            <p className="business-overview-eyebrow">Executive scorecard</p>
            <h2>Key Performance Indicators</h2>
          </div>
          <span>Values marked Preview/Config will become live once Expenses and Goals modules are connected.</span>
        </div>

        <div className="business-overview-kpi-grid business-overview-kpi-grid--executive">
          {businessOverviewKpis.map((kpi) => (
            <article key={kpi.label} className={`business-overview-kpi-card ${toneClass(kpi.tone)}`}>
              <div className="business-overview-kpi-topline">
                <small>{kpi.label}</small>
                <em className={sourceClass(kpi.source)}>{kpi.source}</em>
              </div>
              <strong>{kpi.value}</strong>
              <span>{kpi.trend ? `${kpi.trend} · ` : ''}{kpi.helper}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="business-overview-panel-grid business-overview-panel-grid--professional">
        <article className="business-overview-panel">
          <header>
            <h3>Daily Revenue Operation</h3>
            <span>Live operating view</span>
          </header>
          <dl className="business-overview-ledger">
            <div><dt>Gross Sales</dt><dd>1,650,000</dd></div>
            <div><dt>Discounts</dt><dd>-120,000</dd></div>
            <div><dt>Returns / Reversals</dt><dd>-45,000</dd></div>
            <div className="strong"><dt>Net Sales</dt><dd>1,485,000</dd></div>
            <div><dt>Collections</dt><dd>1,210,000</dd></div>
            <div><dt>Credit Sales</dt><dd>210,000</dd></div>
            <div><dt>Insurance Sales</dt><dd>65,000</dd></div>
          </dl>
        </article>

        <article className="business-overview-panel business-overview-panel-wide">
          <header>
            <h3>Sales Trend</h3>
            <span>Net sales by day</span>
          </header>
          <div className="business-overview-chart business-overview-chart--professional">
            {[38, 58, 44, 77, 49, 68, 53, 82, 61, 71, 46, 88].map((height, index) => (
              <span key={`${height}-${index}`} style={{ height: `${height}%` }} />
            ))}
          </div>
        </article>

        <article className="business-overview-panel">
          <header>
            <h3>Top Contributing Products</h3>
            <span>Revenue contribution</span>
          </header>
          <ul className="business-overview-list">
            <li><span>Panadol Extra</span><strong>1,820,000</strong></li>
            <li><span>Amoxicillin 500mg</span><strong>1,450,000</strong></li>
            <li><span>Vitamin C 1000mg</span><strong>1,120,000</strong></li>
            <li><span>Brufen 400mg</span><strong>980,000</strong></li>
            <li><span>ORS Sachets</span><strong>760,000</strong></li>
          </ul>
        </article>

        <article className="business-overview-panel">
          <header>
            <h3>Expenses & Profitability</h3>
            <span>Preview model</span>
          </header>
          <dl className="business-overview-ledger">
            <div><dt>Operating Expenses</dt><dd>5,400,000</dd></div>
            <div><dt>Gross Profit</dt><dd>10,230,000</dd></div>
            <div className="strong"><dt>Estimated Net Profit</dt><dd>4,830,000</dd></div>
            <div><dt>Gross Margin</dt><dd>36.0%</dd></div>
            <div><dt>Net Margin</dt><dd>17.0%</dd></div>
          </dl>
        </article>

        <article className="business-overview-panel">
          <header>
            <h3>Inventory Risk Overview</h3>
            <span>Live + risk estimate</span>
          </header>
          <dl className="business-overview-ledger">
            <div><dt>Total Inventory Value</dt><dd>42,750,000</dd></div>
            <div><dt>Low Stock Items</dt><dd className="warning">124</dd></div>
            <div><dt>Expiring Items</dt><dd className="warning">68</dd></div>
            <div><dt>Out-of-stock Revenue Risk</dt><dd className="danger">12,450,000</dd></div>
          </dl>
        </article>

        <article className="business-overview-panel business-overview-insight">
          <header>
            <h3>AI / Business Insight</h3>
            <span>Executive summary</span>
          </header>
          <h4>What changed?</h4>
          <p>Revenue and collections are growing, but credit exposure is also increasing.</p>
          <h4>Why it matters</h4>
          <p>The business can meet the monthly goal only if collections and fast-moving stock availability remain strong.</p>
          <h4>Risks detected</h4>
          <p>Outstanding balance, operating expense trend, and high-revenue stock risk need management attention.</p>
          <h4>Recommended action</h4>
          <p>Prioritize collections, replenish revenue-driving items, and approve the expense/goals model.</p>
        </article>
      </section>

      <section>
        <div className="business-overview-section-heading">
          <div>
            <p className="business-overview-eyebrow">Management action queue</p>
            <h2>Recommended Actions</h2>
          </div>
        </div>

        <div className="business-overview-actions business-overview-actions--professional">
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
        Business Overview UAT · Amounts in UGX · Admin/Test preview · Live data integration in progress
      </footer>
    </section>
  );
}
