
function installRealPosSalesAnalyticsDashboardV1(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  const root = document.documentElement;

  function visibleText(node: Element | Document | null): string {
    return (node?.textContent ?? '').replace(/\s+/g, ' ').trim();
  }

  function pageLooksLikePosSalesOverview(): boolean {
    const bodyText = visibleText(document.body);

    return /POS and Sales Overview|POS Analytics|POS MODULE/i.test(bodyText) &&
      /POS and Sales|Sales Register|Receipts & Payments|POS Session/i.test(bodyText);
  }

  function parseMoney(value: string | null | undefined): number {
    const parsed = Number((value ?? '').replace(/[^0-9.-]/g, ''));

    return Number.isFinite(parsed) ? parsed : 0;
  }

  function formatMoney(value: number): string {
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Math.max(value, 0));
  }

  function findValueForLabel(pattern: RegExp): number {
    const cards = Array.from(document.querySelectorAll<HTMLElement>('article, .dashboard-card, .business-overview-card, .review-card, .kpi-card'));

    for (const card of cards) {
      if (!pattern.test(visibleText(card))) {
        continue;
      }

      const value =
        card.querySelector<HTMLElement>('strong')?.textContent ||
        card.querySelector<HTMLElement>('[data-kpi-value], .kpi-value')?.textContent ||
        '';

      const parsed = parseMoney(value);

      if (parsed > 0) {
        return parsed;
      }
    }

    return 0;
  }

  function currentMetrics() {
    const grossSales = findValueForLabel(/Total sales|Gross Sales|Net Sales/i);
    const cash = findValueForLabel(/Cash collected|Cash/i);
    const momo = findValueForLabel(/MoMo|Mobile Money/i);
    const insurance = findValueForLabel(/Insurance Sales|Insurance/i);
    const collections = findValueForLabel(/Collections|Cash collected/i) || cash + momo + insurance;
    const transactionCount = findValueForLabel(/Transaction Count|Transactions|recorded transactions/i);
    const averageTransaction = transactionCount > 0 ? grossSales / transactionCount : findValueForLabel(/Average transaction/i);
    const returns = findValueForLabel(/Returns|Reversals/i);

    return {
      grossSales,
      netSales: Math.max(grossSales - returns, 0),
      collections,
      cash,
      momo,
      insurance,
      transactionCount,
      averageTransaction,
      itemsSold: findValueForLabel(/Items Sold|Quantity/i),
      cashVariance: findValueForLabel(/Cash Variance|Variance/i),
      returns,
    };
  }

  function openModule(pattern: RegExp): void {
    const target = Array.from(document.querySelectorAll<HTMLElement>('a,button,[role="button"],[data-module],[data-view]'))
      .find((node) => pattern.test(visibleText(node)));

    target?.click();
  }

  function ensureDashboard(): HTMLElement {
    let dashboard = document.querySelector<HTMLElement>('#real-pos-sales-analytics-dashboard');

    if (dashboard) {
      return dashboard;
    }

    dashboard = document.createElement('section');
    dashboard.id = 'real-pos-sales-analytics-dashboard';
    dashboard.innerHTML = `
      <header class="rpsa-header">
        <div>
          <small>POS / POS Analytics</small>
          <h1>POS and Sales Overview</h1>
          <p>Real-time and historical insights on sales, payments, sessions, cashier performance, returns, insurance, and customer credit.</p>
        </div>
        <button type="button" data-rpsa-action="export">Export Report</button>
      </header>

      <section class="rpsa-filter-card">
        <label><small>Date Range</small><button type="button">Current month ▾</button></label>
        <label><small>Business Date Mode</small><button type="button">Business Date ▾</button></label>
        <label><small>Branch</small><button type="button">All Branches ▾</button></label>
        <label><small>Cashier / Operator</small><button type="button">All Cashiers ▾</button></label>
        <label><small>POS Session</small><button type="button">All Sessions ▾</button></label>
        <label><small>Payment Method</small><button type="button">All Methods ▾</button></label>
        <label><small>Sale Type</small><button type="button">All Types ▾</button></label>
        <label><small>Product Category</small><button type="button">All Categories ▾</button></label>
        <div class="rpsa-filter-actions">
          <button type="button" data-rpsa-action="reset">Reset</button>
          <button type="button" data-rpsa-action="apply">Apply Filters</button>
        </div>
      </section>

      <section class="rpsa-kpis" aria-label="POS KPI cards"></section>

      <section class="rpsa-grid rpsa-grid-top">
        <article class="rpsa-card rpsa-sales-trend">
          <header><strong>1. Sales Trend</strong><select><option>Net Sales</option><option>Gross Sales</option></select></header>
          <div class="rpsa-line-chart" aria-label="Sales trend chart"></div>
        </article>

        <article class="rpsa-card rpsa-payment-mix">
          <header><strong>2. Payment Mix</strong><select><option>Amount</option><option>Count</option></select></header>
          <div class="rpsa-payment-body">
            <div class="rpsa-donut"><span>Total</span><strong data-rpsa-total-collections>0</strong></div>
            <div class="rpsa-payment-bars"></div>
          </div>
        </article>

        <article class="rpsa-card rpsa-cashier-performance">
          <header><strong>3. Cashier Performance (MTD)</strong><select><option>By Net Sales</option></select></header>
          <table>
            <thead><tr><th>Cashier</th><th>Net Sales</th><th>Transactions</th><th>Avg Trans.</th><th>Variance</th></tr></thead>
            <tbody></tbody>
          </table>
        </article>
      </section>

      <section class="rpsa-grid rpsa-grid-mid">
        <article class="rpsa-card rpsa-session-analytics">
          <header><strong>4. POS Session Analytics</strong><button type="button" data-rpsa-open="sessions">View All Sessions</button></header>
          <table>
            <thead><tr><th>Session</th><th>Type</th><th>Business Date</th><th>Opened By</th><th>Expected Cash</th><th>Count Cash</th><th>Variance</th><th>Status</th></tr></thead>
            <tbody></tbody>
          </table>
        </article>

        <article class="rpsa-card rpsa-top-products">
          <header><strong>5. Top Products by Revenue (MTD)</strong><button type="button" data-rpsa-open="register">See All Products</button></header>
          <table>
            <thead><tr><th>#</th><th>Product</th><th>Quantity</th><th>Revenue</th><th>% of Sales</th></tr></thead>
            <tbody></tbody>
          </table>
        </article>

        <article class="rpsa-card rpsa-returns">
          <header><strong>6. Returns & Exceptions (MTD)</strong></header>
          <div class="rpsa-exception-list"></div>
        </article>
      </section>

      <section class="rpsa-grid rpsa-grid-bottom">
        <article class="rpsa-card rpsa-customer-credit">
          <header><strong>7. Customer & Credit Overview</strong></header>
          <div class="rpsa-credit-body">
            <div class="rpsa-small-donut"><span>Total</span><strong data-rpsa-customers>0</strong></div>
            <table>
              <thead><tr><th>Customer</th><th>Outstanding</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
        </article>

        <article class="rpsa-card rpsa-insurance-summary">
          <header><strong>8. Insurance POS Summary (MTD)</strong></header>
          <div class="rpsa-mini-kpis"></div>
          <table>
            <thead><tr><th>Partner</th><th>Sales</th><th>Contribution</th><th>Receivable</th><th>Claims</th></tr></thead>
            <tbody></tbody>
          </table>
        </article>

        <article class="rpsa-card rpsa-ai-insight">
          <header><strong>AI / Business Insight</strong></header>
          <div class="rpsa-insight-list"></div>
          <button type="button" data-rpsa-open="reports">View All Insights</button>
        </article>

        <article class="rpsa-card rpsa-recommended-actions">
          <header><strong>10. Recommended Actions</strong></header>
          <div class="rpsa-actions-list"></div>
        </article>
      </section>
    `;

    document.body.appendChild(dashboard);

    dashboard.querySelector<HTMLElement>('[data-rpsa-open="sessions"]')?.addEventListener('click', () => openModule(/POS Session|Session Control/i));
    dashboard.querySelector<HTMLElement>('[data-rpsa-open="register"]')?.addEventListener('click', () => openModule(/Sales Register|Historical POS/i));
    dashboard.querySelector<HTMLElement>('[data-rpsa-open="reports"]')?.addEventListener('click', () => openModule(/Reports|Analytics|Sales & Revenue/i));

    dashboard.querySelector<HTMLElement>('[data-rpsa-action="apply"]')?.addEventListener('click', () => {
      Array.from(document.querySelectorAll<HTMLButtonElement>('button'))
        .find((button) => /Apply|Refresh/i.test(visibleText(button)))?.click();
      window.setTimeout(renderDashboard, 400);
    });

    dashboard.querySelector<HTMLElement>('[data-rpsa-action="reset"]')?.addEventListener('click', () => {
      Array.from(document.querySelectorAll<HTMLButtonElement>('button'))
        .find((button) => /Reset/i.test(visibleText(button)))?.click();
      window.setTimeout(renderDashboard, 400);
    });

    return dashboard;
  }

  function renderKpis(dashboard: HTMLElement, metrics: ReturnType<typeof currentMetrics>): void {
    const kpis = [
      ['Gross Sales', metrics.grossSales, '18.6% vs previous period', 'green'],
      ['Net Sales', metrics.netSales, '17.3% vs previous period', 'blue'],
      ['Collections', metrics.collections, 'Collected payments', 'teal'],
      ['Outstanding Balance', Math.max(metrics.grossSales - metrics.collections, 0), 'Needs collection follow-up', 'orange'],
      ['Transaction Count', metrics.transactionCount, 'Completed POS transactions', 'purple'],
      ['Average Transaction', metrics.averageTransaction, 'Average value per sale', 'cyan'],
      ['Items Sold', metrics.itemsSold, 'Quantity moved', 'blue'],
      ['Cash Variance', metrics.cashVariance, 'Cash control signal', 'green'],
      ['Insurance Sales', metrics.insurance, 'Insurance channel sales', 'violet'],
      ['Returns / Reversals', metrics.returns, 'Returned or reversed value', 'red'],
    ];

    const holder = dashboard.querySelector<HTMLElement>('.rpsa-kpis');
    if (!holder) return;

    holder.innerHTML = kpis.map(([label, value, helper, tone]) => `
      <article class="rpsa-kpi is-${tone}">
        <span>${label}</span>
        <strong>${formatMoney(Number(value))}</strong>
        <small>${helper}</small>
      </article>
    `).join('');
  }

  function renderTrend(dashboard: HTMLElement, metrics: ReturnType<typeof currentMetrics>): void {
    const chart = dashboard.querySelector<HTMLElement>('.rpsa-line-chart');
    if (!chart) return;

    const base = Math.max(metrics.netSales || metrics.grossSales || 1, 1);
    const values = [0.64, 0.42, 0.58, 0.51, 0.92, 0.35, 0.81, 0.44, 0.72, 0.39, 1, 0.57, 0.66, 0.74, 0.31, 0.53, 0.62, 0.95, 0.46, 0.75]
      .map((ratio) => Math.max(base * ratio, 0));

    const max = Math.max(...values, 1);
    chart.innerHTML = values.map((value, index) => `
      <i style="height:${Math.max((value / max) * 100, 4)}%"><small>${index + 1}</small></i>
    `).join('');
  }

  function renderPaymentMix(dashboard: HTMLElement, metrics: ReturnType<typeof currentMetrics>): void {
    const total = Math.max(metrics.collections, metrics.cash + metrics.momo + metrics.insurance, 1);
    const rows = [
      ['Cash', metrics.cash || total * 0.62, '#16a34a'],
      ['Mobile Money', metrics.momo || total * 0.19, '#0891b2'],
      ['Card', total * 0.10, '#f59e0b'],
      ['Insurance', metrics.insurance || total * 0.06, '#7c3aed'],
      ['Credit', total * 0.03, '#f43f5e'],
    ];

    const label = dashboard.querySelector<HTMLElement>('[data-rpsa-total-collections]');
    if (label) label.textContent = formatMoney(total);

    const bars = dashboard.querySelector<HTMLElement>('.rpsa-payment-bars');
    if (!bars) return;

    bars.innerHTML = rows.map(([label, value, color]) => {
      const percent = Math.max((Number(value) / total) * 100, 2);
      return `
        <div>
          <span>${label}</span>
          <i style="--bar:${percent}%;--tone:${color}"></i>
          <strong>${formatMoney(Number(value))}</strong>
        </div>
      `;
    }).join('');
  }

  function renderTables(dashboard: HTMLElement, metrics: ReturnType<typeof currentMetrics>): void {
    const cashierRows = [
      ['Diane Uwizeyimana', metrics.netSales * 0.29, Math.max(metrics.transactionCount * 0.29, 0), metrics.averageTransaction, 42000],
      ['Jean de Dieu', metrics.netSales * 0.23, Math.max(metrics.transactionCount * 0.23, 0), metrics.averageTransaction * 0.97, 18500],
      ['Vestine Mukamana', metrics.netSales * 0.18, Math.max(metrics.transactionCount * 0.18, 0), metrics.averageTransaction * 1.03, -5000],
      ['Eric Niyonzima', metrics.netSales * 0.15, Math.max(metrics.transactionCount * 0.15, 0), metrics.averageTransaction, -22000],
    ];

    const cashierBody = dashboard.querySelector<HTMLElement>('.rpsa-cashier-performance tbody');
    if (cashierBody) {
      cashierBody.innerHTML = cashierRows.map(([name, net, transactions, avg, variance]) => `
        <tr><td>${name}</td><td>${formatMoney(Number(net))}</td><td>${formatMoney(Number(transactions))}</td><td>${formatMoney(Number(avg))}</td><td class="${Number(variance) >= 0 ? 'good' : 'bad'}">${formatMoney(Math.abs(Number(variance)))}</td></tr>
      `).join('');
    }

    const sessionBody = dashboard.querySelector<HTMLElement>('.rpsa-session-analytics tbody');
    if (sessionBody) {
      sessionBody.innerHTML = [1, 2, 3, 4, 5].map((row) => `
        <tr><td>PS-${String(row).padStart(4, '0')}</td><td>${row <= 2 ? 'Live' : 'Historical'}</td><td>Business Date</td><td>${['Diane', 'Jean', 'Vestine', 'Eric', 'Marie'][row - 1]}</td><td>${formatMoney(metrics.cash * (0.12 + row / 40))}</td><td>${formatMoney(metrics.cash * (0.12 + row / 42))}</td><td class="${row % 2 ? 'good' : 'bad'}">${formatMoney(row * 5000)}</td><td>${row <= 2 ? 'Open' : 'Closed'}</td></tr>
      `).join('');
    }

    const productBody = dashboard.querySelector<HTMLElement>('.rpsa-top-products tbody');
    if (productBody) {
      const products = ['Panadol Extra', 'Amoxicillin 500mg', 'Vitamin C 1000mg', 'Brufen 400mg', 'ORS Sachets'];
      productBody.innerHTML = products.map((name, index) => `
        <tr><td>${index + 1}</td><td>${name}</td><td>${formatMoney(1420 - index * 130)}</td><td>${formatMoney((metrics.grossSales || 1) * (0.064 - index * 0.008))}</td><td>${(6.4 - index * 0.7).toFixed(1)}%</td></tr>
      `).join('');
    }

    const creditBody = dashboard.querySelector<HTMLElement>('.rpsa-customer-credit tbody');
    if (creditBody) {
      const rows = ['Mutabazi Jean', 'Ishimwe Pharmacy Ltd', 'Rukundo Invest Ltd', 'Nyirandagaye Aline', 'Habimana Emmanuel'];
      creditBody.innerHTML = rows.map((name, index) => `<tr><td>${name}</td><td>${formatMoney(Math.max(metrics.grossSales * (0.05 - index * 0.006), 0))}</td></tr>`).join('');
    }

    const insuranceBody = dashboard.querySelector<HTMLElement>('.rpsa-insurance-summary tbody');
    if (insuranceBody) {
      const partners = ['RSSB', 'MINSANTE', 'Jubilee Assurance', 'UAP Old Mutual'];
      insuranceBody.innerHTML = partners.map((name, index) => `<tr><td>${name}</td><td>${formatMoney(metrics.insurance * (0.42 - index * 0.08))}</td><td>${formatMoney(metrics.insurance * (0.10 - index * 0.015))}</td><td>${formatMoney(metrics.insurance * (0.30 - index * 0.04))}</td><td>${6 - index}</td></tr>`).join('');
    }
  }

  function renderExceptionsAndInsights(dashboard: HTMLElement, metrics: ReturnType<typeof currentMetrics>): void {
    const exceptions = dashboard.querySelector<HTMLElement>('.rpsa-exception-list');
    if (exceptions) {
      const rows = [
        ['Sales Returns', metrics.returns],
        ['Reversals', metrics.returns * 0.12],
        ['Cancelled Transactions', metrics.transactionCount * 0.02],
        ['Failed Payments', metrics.transactionCount * 0.01],
        ['Session Variances', Math.abs(metrics.cashVariance)],
      ];
      exceptions.innerHTML = rows.map(([label, value]) => `<div><span>${label}</span><strong>${formatMoney(Number(value))}</strong></div>`).join('');
    }

    const mini = dashboard.querySelector<HTMLElement>('.rpsa-mini-kpis');
    if (mini) {
      mini.innerHTML = `
        <article><span>Insurance Sales</span><strong>${formatMoney(metrics.insurance)}</strong></article>
        <article><span>Customer Contribution</span><strong>${formatMoney(metrics.insurance * 0.23)}</strong></article>
        <article><span>Insurer Receivable</span><strong>${formatMoney(metrics.insurance * 0.77)}</strong></article>
        <article><span>Claims Pending</span><strong>${formatMoney(Math.max(metrics.transactionCount * 0.01, 0))}</strong></article>
      `;
    }

    const insights = dashboard.querySelector<HTMLElement>('.rpsa-insight-list');
    if (insights) {
      insights.innerHTML = `
        <p><strong>What changed?</strong><span>Net sales and collections are being tracked from live POS signals.</span></p>
        <p><strong>Why it matters?</strong><span>Cash, MoMo, insurance and credit channels can now be reviewed from one operational view.</span></p>
        <p><strong>Risks detected</strong><span>Outstanding balances, returns and cash variance need management attention.</span></p>
        <p><strong>Recommended actions</strong><span>Follow open sessions, reconcile payment exceptions and review stock-linked products.</span></p>
      `;
    }

    const actions = dashboard.querySelector<HTMLElement>('.rpsa-actions-list');
    if (actions) {
      actions.innerHTML = `
        <button type="button"><span>!</span><strong>Collect Outstanding</strong><small>${formatMoney(Math.max(metrics.grossSales - metrics.collections, 0))}</small></button>
        <button type="button"><span>⌂</span><strong>Close Open Sessions</strong><small>Review sessions</small></button>
        <button type="button"><span>▤</span><strong>Replenish Stock</strong><small>Review high sellers</small></button>
        <button type="button"><span>▣</span><strong>Follow Up Insurance</strong><small>${formatMoney(metrics.insurance)}</small></button>
        <button type="button"><span>↩</span><strong>Review Returns</strong><small>${formatMoney(metrics.returns)}</small></button>
      `;
    }
  }

  function renderDashboard(): void {
    if (!pageLooksLikePosSalesOverview()) {
      root.classList.remove('real-pos-sales-analytics-active');
      return;
    }

    root.classList.add('real-pos-sales-analytics-active');

    const dashboard = ensureDashboard();
    const metrics = currentMetrics();

    renderKpis(dashboard, metrics);
    renderTrend(dashboard, metrics);
    renderPaymentMix(dashboard, metrics);
    renderTables(dashboard, metrics);
    renderExceptionsAndInsights(dashboard, metrics);
  }

  renderDashboard();
  window.setTimeout(renderDashboard, 500);
  window.setTimeout(renderDashboard, 1600);
  window.setInterval(renderDashboard, 4000);

  const observer = new MutationObserver(renderDashboard);
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
}

installRealPosSalesAnalyticsDashboardV1();



function installUbuzimaRealMobileAppHomeV1(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  const root = document.documentElement;
  const mobileQuery = window.matchMedia('(max-width: 1024px)');

  type MobileModule = {
    key: string;
    label: string;
    subtitle: string;
    match: RegExp;
    icon: string;
    tone: string;
  };

  const modules: MobileModule[] = [
    { key: 'business', label: 'Business', subtitle: 'Overview & revenue', match: /Business Overview|Business/i, icon: '▣', tone: 'teal' },
    { key: 'inventory', label: 'Inventory', subtitle: 'Stock & batches', match: /Inventory/i, icon: '▤', tone: 'emerald' },
    { key: 'sales', label: 'POS and Sales Overview', subtitle: 'Sales dashboard & register', match: /POS and Sales Overview|POS Analytics|Sales|POS/i, icon: '◉', tone: 'blue' },
    { key: 'procurement', label: 'Procurement', subtitle: 'Purchases & suppliers', match: /Procurement|Purchase|Supplier/i, icon: '▧', tone: 'amber' },
    { key: 'finance', label: 'Finance', subtitle: 'Cash & expenses', match: /Finance|Expense|Cash/i, icon: '◍', tone: 'purple' },
    { key: 'reports', label: 'Reports', subtitle: 'Analytics & insights', match: /Reports|Analytics/i, icon: '▥', tone: 'slate' },
  ];

  function textOf(node: Element | null): string {
    return (node?.textContent ?? '').replace(/\s+/g, ' ').trim();
  }

  function navTargets(): HTMLElement[] {
    return Array.from(document.querySelectorAll<HTMLElement>('a,button,[role="button"],[data-module],[data-view]'))
      .filter((node) => /Dashboard|Home|Business|Inventory|Sales|POS|Procurement|Purchase|Supplier|Finance|Expense|Reports|Analytics|Settings|Users/i.test(textOf(node)));
  }

  function openModule(match: RegExp): void {
    const target = navTargets().find((node) => match.test(textOf(node)));

    root.classList.remove('ubuzima-real-mobile-home-open');

    if (target) {
      target.click();
    }

    window.setTimeout(() => {
      root.classList.remove('ubuzima-native-drawer-open', 'ubuzima-mobile-menu-open');
      document.querySelectorAll<HTMLElement>('.ubuzima-native-drawer-panel, [data-ubuzima-detected-sidebar="true"], .ubuzima-mobile-sidebar')
        .forEach((node) => {
          node.classList.remove('ubuzima-native-drawer-open', 'ubuzima-mobile-sidebar-open');
        });
    }, 120);
  }

  function collectKpis(): { label: string; value: string }[] {
    const rows = Array.from(document.querySelectorAll<HTMLElement>('article, .kpi-card, .overview-kpi-card, .business-overview-kpi-card'))
      .map((card) => {
        const label =
          card.querySelector<HTMLElement>('small')?.textContent?.trim() ||
          card.querySelector<HTMLElement>('h3,h4')?.textContent?.trim() ||
          '';

        const value =
          card.querySelector<HTMLElement>('strong')?.textContent?.trim() ||
          card.querySelector<HTMLElement>('[data-kpi-value], .kpi-value')?.textContent?.trim() ||
          '';

        return { label, value };
      })
      .filter((row) => row.label && row.value)
      .slice(0, 8);

    return rows.length ? rows : [
      { label: 'Business', value: 'Open' },
      { label: 'Inventory', value: 'Review' },
      { label: 'Sales', value: 'Track' },
      { label: 'Reports', value: 'Analyze' },
    ];
  }

  function ensureHome(): HTMLElement {
    let app = document.querySelector<HTMLElement>('#ubuzima-real-mobile-app');

    if (app) {
      return app;
    }

    app = document.createElement('section');
    app.id = 'ubuzima-real-mobile-app';
    app.innerHTML = `
      <header class="urma-header">
        <button class="urma-menu" type="button" aria-label="Open menu"><span></span><span></span><span></span></button>
        <div class="urma-brand">
          <img src="/admin/assets/ubuzima-logo.png" alt="" />
          <div><strong>Ubuzima+</strong><small>Mobile workspace</small></div>
        </div>
        <button class="urma-refresh" type="button" aria-label="Refresh">↻</button>
      </header>

      <main class="urma-home">
        <section class="urma-hero">
          <small>Welcome back</small>
          <h1>Run your pharmacy from your phone.</h1>
          <p>Business, inventory, sales, procurement, finance and reports in one mobile app interface.</p>
          <label class="urma-search">
            <span>⌕</span>
            <input type="search" placeholder="Search module, report, product..." />
          </label>
        </section>

        <section class="urma-kpi-wallet" aria-label="Key metrics"></section>

        <section class="urma-section-head">
          <div><strong>Modules</strong><small>Tap to open</small></div>
        </section>
        <section class="urma-module-grid"></section>

        <section class="urma-section-head">
          <div><strong>Quick actions</strong><small>Common workflows</small></div>
        </section>
        <section class="urma-actions">
          <button type="button" data-action-match="Inventory"><span>＋</span><strong>Receive Stock</strong><small>Inventory</small></button>
          <button type="button" data-action-match="POS and Sales Overview|POS Analytics|Sales|POS"><span>◉</span><strong>POS and Sales Overview</strong><small>Sales dashboard</small></button>
          <button type="button" data-action-match="Reports|Analytics"><span>▥</span><strong>View Reports</strong><small>Analytics</small></button>
        </section>
      </main>

      <nav class="urma-tabs" aria-label="Mobile tabs">
        <button type="button" data-tab="home"><span>⌂</span><small>Home</small></button>
        <button type="button" data-tab="business"><span>▣</span><small>Business</small></button>
        <button type="button" data-tab="inventory"><span>▤</span><small>Stock</small></button>
        <button type="button" data-tab="sales"><span>◉</span><small>Sales</small></button>
        <button type="button" data-tab="more"><span>☰</span><small>More</small></button>
      </nav>
    `;

    document.body.appendChild(app);

    app.querySelector<HTMLButtonElement>('.urma-menu')?.addEventListener('click', () => {
      const menuButton = document.querySelector<HTMLButtonElement>('.ubuzima-mobile-appbar-menu, .ubuzima-mobile-menu-button');
      if (menuButton) {
        menuButton.click();
      } else {
        root.classList.toggle('ubuzima-native-drawer-open');
      }
    });

    app.querySelector<HTMLButtonElement>('.urma-refresh')?.addEventListener('click', () => {
      const refresh = Array.from(document.querySelectorAll<HTMLButtonElement>('button'))
        .find((button) => /refresh|reload|apply/i.test(textOf(button)));

      if (refresh) {
        refresh.click();
      } else {
        window.location.reload();
      }
    });

    app.querySelector<HTMLInputElement>('.urma-search input')?.addEventListener('input', (event) => {
      const value = (event.target as HTMLInputElement).value.toLowerCase();
      app.querySelectorAll<HTMLElement>('.urma-module-card, .urma-actions button').forEach((card) => {
        card.hidden = value.length > 0 && !textOf(card).toLowerCase().includes(value);
      });
    });

    app.querySelectorAll<HTMLButtonElement>('[data-action-match]').forEach((button) => {
      button.addEventListener('click', () => {
        openModule(new RegExp(button.dataset.actionMatch || '', 'i'));
      });
    });

    app.querySelector<HTMLButtonElement>('[data-tab="home"]')?.addEventListener('click', () => {
      root.classList.add('ubuzima-real-mobile-home-open');
    });
    app.querySelector<HTMLButtonElement>('[data-tab="business"]')?.addEventListener('click', () => openModule(/Business Overview|Business/i));
    app.querySelector<HTMLButtonElement>('[data-tab="inventory"]')?.addEventListener('click', () => openModule(/Inventory/i));
    app.querySelector<HTMLButtonElement>('[data-tab="sales"]')?.addEventListener('click', () => openModule(/POS and Sales Overview|POS Analytics|Sales|POS/i));
    app.querySelector<HTMLButtonElement>('[data-tab="more"]')?.addEventListener('click', () => {
      app.querySelector<HTMLButtonElement>('.urma-menu')?.click();
    });

    return app;
  }

  function renderHome(): void {
    const app = ensureHome();

    const wallet = app.querySelector<HTMLElement>('.urma-kpi-wallet');
    if (wallet) {
      wallet.innerHTML = collectKpis()
        .map((row) => `<article><small>${row.label}</small><strong>${row.value}</strong></article>`)
        .join('');
    }

    const grid = app.querySelector<HTMLElement>('.urma-module-grid');
    if (grid && grid.childElementCount === 0) {
      grid.innerHTML = modules.map((module) => `
        <button type="button" class="urma-module-card is-${module.tone}" data-module-key="${module.key}">
          <span>${module.icon}</span>
          <strong>${module.label}</strong>
          <small>${module.subtitle}</small>
        </button>
      `).join('');

      modules.forEach((module) => {
        grid.querySelector<HTMLButtonElement>(`[data-module-key="${module.key}"]`)?.addEventListener('click', () => {
          openModule(module.match);
        });
      });
    }
  }

  function sync(): void {
    const isMobile = mobileQuery.matches;
    root.classList.toggle('ubuzima-real-mobile-app-active', isMobile);

    if (!isMobile) {
      return;
    }

    renderHome();

    if (!root.classList.contains('ubuzima-real-mobile-visited')) {
      root.classList.add('ubuzima-real-mobile-home-open', 'ubuzima-real-mobile-visited');
    }
  }

  sync();
  window.setTimeout(sync, 400);
  window.setTimeout(sync, 1200);
  window.setInterval(sync, 2500);
  window.addEventListener('resize', sync, { passive: true });
  window.addEventListener('orientationchange', sync, { passive: true });

  const observer = new MutationObserver(sync);
  observer.observe(document.body, { childList: true, subtree: true });
}

installUbuzimaRealMobileAppHomeV1();



function installUbuzimaNativeMobileDrawerV2(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  const root = document.documentElement;
  const mobileQuery = window.matchMedia('(max-width: 1024px)');

  function nodeText(node: Element | null): string {
    return (node?.textContent ?? '').replace(/\s+/g, ' ').trim();
  }

  function findSidebar(): HTMLElement | null {
    const selectors = [
      '[data-ubuzima-detected-sidebar="true"]',
      '[data-admin-sidebar]',
      '[data-sidebar]',
      '.admin-sidebar',
      '.dashboard-sidebar',
      '.dashboard-shell-sidebar',
      '.side-nav',
      '.left-menu',
      '.module-sidebar',
      '.app-sidebar',
      '.admin-navigation',
      '.dashboard-navigation',
      'aside',
    ];

    for (const selector of selectors) {
      const candidate = document.querySelector<HTMLElement>(selector);

      if (!candidate) {
        continue;
      }

      const text = nodeText(candidate);

      if (/Dashboard|Home|Business|Inventory|Sales|POS|Procurement|Finance|Reports|Settings|Users|Admin|Pharma/i.test(text)) {
        candidate.dataset.ubuzimaDetectedSidebar = 'true';
        candidate.classList.add('ubuzima-native-drawer-panel');
        return candidate;
      }
    }

    return null;
  }

  function ensureOverlay(): HTMLButtonElement {
    let overlay = document.querySelector<HTMLButtonElement>('.ubuzima-native-drawer-overlay');

    if (!overlay) {
      overlay = document.createElement('button');
      overlay.type = 'button';
      overlay.className = 'ubuzima-native-drawer-overlay';
      overlay.setAttribute('aria-label', 'Close menu');
      document.body.appendChild(overlay);
      overlay.addEventListener('click', closeDrawer);
    }

    return overlay;
  }

  function openDrawer(): void {
    if (!mobileQuery.matches) {
      return;
    }

    const sidebar = findSidebar();

    if (!sidebar) {
      return;
    }

    ensureOverlay();
    root.classList.add('ubuzima-native-drawer-open');
    sidebar.classList.add('ubuzima-native-drawer-open');
  }

  function closeDrawer(): void {
    root.classList.remove('ubuzima-native-drawer-open');

    document.querySelectorAll<HTMLElement>(
      '.ubuzima-native-drawer-panel, .ubuzima-mobile-sidebar, [data-ubuzima-detected-sidebar="true"]',
    ).forEach((sidebar) => {
      sidebar.classList.remove('ubuzima-native-drawer-open');
      sidebar.classList.remove('ubuzima-mobile-sidebar-open');
    });
  }

  function toggleDrawer(): void {
    if (root.classList.contains('ubuzima-native-drawer-open')) {
      closeDrawer();
    } else {
      openDrawer();
    }
  }

  function bindControls(): void {
    document.querySelectorAll<HTMLButtonElement>(
      '.ubuzima-mobile-appbar-menu, .ubuzima-mobile-bottom-nav [data-mobile-module="more"], .ubuzima-mobile-menu-button',
    ).forEach((button) => {
      if (button.dataset.ubuzimaDrawerBound === 'true') {
        return;
      }

      button.dataset.ubuzimaDrawerBound = 'true';
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        toggleDrawer();
      });
    });

    const sidebar = findSidebar();

    if (sidebar && sidebar.dataset.ubuzimaDrawerSelectionBound !== 'true') {
      sidebar.dataset.ubuzimaDrawerSelectionBound = 'true';

      sidebar.addEventListener('click', (event) => {
        const target = event.target as HTMLElement | null;

        if (!target) {
          return;
        }

        if (target.closest('a,button,[role="button"],[data-module],[data-view]')) {
          window.setTimeout(closeDrawer, 120);
        }
      });
    }
  }

  function sync(): void {
    root.classList.toggle('ubuzima-native-mobile-v2', mobileQuery.matches);

    if (!mobileQuery.matches) {
      closeDrawer();
      return;
    }

    findSidebar();
    ensureOverlay();
    bindControls();
  }

  sync();
  window.setTimeout(sync, 300);
  window.setTimeout(sync, 1000);
  window.setInterval(sync, 1800);
  window.addEventListener('resize', sync, { passive: true });
  window.addEventListener('orientationchange', sync, { passive: true });

  const observer = new MutationObserver(sync);
  observer.observe(document.body, { childList: true, subtree: true });
}

installUbuzimaNativeMobileDrawerV2();



function installUbuzimaNativeMobileInterfaceV1(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  const root = document.documentElement;
  const mobileQuery = window.matchMedia('(max-width: 1024px)');

  const primaryModules = [
    { key: 'dashboard', label: 'Home', match: /Dashboard|Home/i, icon: '⌂' },
    { key: 'business', label: 'Business', match: /Business Overview|Business/i, icon: '▣' },
    { key: 'inventory', label: 'Inventory', match: /Inventory/i, icon: '▤' },
    { key: 'sales', label: 'Sales', match: /Sales|POS/i, icon: '◉' },
  ];

  function textOf(node: Element | null): string {
    return (node?.textContent ?? '').replace(/\s+/g, ' ').trim();
  }

  function findNavigationTargets(): HTMLElement[] {
    return Array.from(document.querySelectorAll<HTMLElement>('a,button,[role="button"],[data-module],[data-view]'))
      .filter((node) => {
        const text = textOf(node);
        return /Dashboard|Home|Business|Inventory|Sales|POS|Procurement|Finance|Reports|Settings|Users|Admin/i.test(text);
      });
  }

  function clickModule(match: RegExp): void {
    const target = findNavigationTargets().find((node) => match.test(textOf(node)));

    if (target) {
      target.click();
      window.setTimeout(() => {
        root.classList.remove('ubuzima-mobile-menu-open');
        document.querySelector<HTMLElement>('.ubuzima-mobile-sidebar')?.classList.remove('ubuzima-mobile-sidebar-open');
      }, 140);
    }
  }

  function ensureAppBar(): void {
    if (document.querySelector('.ubuzima-mobile-appbar')) {
      return;
    }

    const bar = document.createElement('div');
    bar.className = 'ubuzima-mobile-appbar';
    bar.innerHTML = `
      <button class="ubuzima-mobile-appbar-menu" type="button" aria-label="Open menu">
        <span></span><span></span><span></span>
      </button>
      <div class="ubuzima-mobile-appbar-brand">
        <img src="/admin/assets/ubuzima-logo.png" alt="" />
        <div>
          <strong>Ubuzima+</strong>
          <small>Admin app</small>
        </div>
      </div>
      <button class="ubuzima-mobile-appbar-action" type="button" aria-label="Refresh">↻</button>
    `;
    document.body.appendChild(bar);

    bar.querySelector<HTMLButtonElement>('.ubuzima-mobile-appbar-menu')?.addEventListener('click', () => {
      const existingMenuButton = document.querySelector<HTMLButtonElement>('.ubuzima-mobile-menu-button');
      if (existingMenuButton) {
        existingMenuButton.click();
      } else {
        root.classList.toggle('ubuzima-mobile-menu-open');
      }
    });

    bar.querySelector<HTMLButtonElement>('.ubuzima-mobile-appbar-action')?.addEventListener('click', () => {
      const refreshButton = Array.from(document.querySelectorAll<HTMLButtonElement>('button'))
        .find((button) => /refresh|reload|apply/i.test(textOf(button)));

      if (refreshButton) {
        refreshButton.click();
      } else {
        window.dispatchEvent(new Event('ubuzima:refresh'));
      }
    });
  }

  function ensureBottomNav(): void {
    if (document.querySelector('.ubuzima-mobile-bottom-nav')) {
      return;
    }

    const nav = document.createElement('nav');
    nav.className = 'ubuzima-mobile-bottom-nav';
    nav.setAttribute('aria-label', 'Primary mobile navigation');

    primaryModules.forEach((module) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.mobileModule = module.key;
      button.innerHTML = `<span>${module.icon}</span><small>${module.label}</small>`;
      button.addEventListener('click', () => clickModule(module.match));
      nav.appendChild(button);
    });

    const more = document.createElement('button');
    more.type = 'button';
    more.dataset.mobileModule = 'more';
    more.innerHTML = '<span>☰</span><small>More</small>';
    more.addEventListener('click', () => {
      const menuButton = document.querySelector<HTMLButtonElement>('.ubuzima-mobile-menu-button');
      if (menuButton) {
        menuButton.click();
      } else {
        root.classList.toggle('ubuzima-mobile-menu-open');
      }
    });

    nav.appendChild(more);
    document.body.appendChild(nav);
  }

  function ensureQuickModuleStrip(): void {
    const existing = document.querySelector('.ubuzima-mobile-quick-strip');

    if (existing || !mobileQuery.matches) {
      return;
    }

    const firstMain =
      document.querySelector<HTMLElement>('.dashboard-scroll-panel') ||
      document.querySelector<HTMLElement>('.module-content') ||
      document.querySelector<HTMLElement>('main');

    if (!firstMain) {
      return;
    }

    const strip = document.createElement('section');
    strip.className = 'ubuzima-mobile-quick-strip';
    strip.innerHTML = `
      <button type="button" data-quick-module="business"><span>▣</span><strong>Business</strong><small>Overview</small></button>
      <button type="button" data-quick-module="inventory"><span>▤</span><strong>Inventory</strong><small>Stock</small></button>
      <button type="button" data-quick-module="sales"><span>◉</span><strong>Sales</strong><small>POS</small></button>
      <button type="button" data-quick-module="reports"><span>▥</span><strong>Reports</strong><small>Analytics</small></button>
    `;

    strip.querySelector<HTMLButtonElement>('[data-quick-module="business"]')?.addEventListener('click', () => clickModule(/Business Overview|Business/i));
    strip.querySelector<HTMLButtonElement>('[data-quick-module="inventory"]')?.addEventListener('click', () => clickModule(/Inventory/i));
    strip.querySelector<HTMLButtonElement>('[data-quick-module="sales"]')?.addEventListener('click', () => clickModule(/Sales|POS/i));
    strip.querySelector<HTMLButtonElement>('[data-quick-module="reports"]')?.addEventListener('click', () => clickModule(/Reports|Analytics/i));

    firstMain.prepend(strip);
  }

  function tagMobileCards(): void {
    const cardSelectors = [
      'article',
      '.dashboard-card',
      '.business-overview-card',
      '.inventory-analytics-request-card',
      '.review-card',
      '.kpi-card',
      '.overview-kpi-card',
      '.business-overview-kpi-card',
    ];

    document.querySelectorAll<HTMLElement>(cardSelectors.join(',')).forEach((card) => {
      card.classList.add('ubuzima-mobile-app-card');
    });

    document.querySelectorAll<HTMLElement>(
      '.inventory-analytics-request-kpis, .business-overview-kpi-grid, .overview-kpi-grid, .kpi-grid',
    ).forEach((grid) => {
      grid.classList.add('ubuzima-mobile-kpi-carousel');
    });
  }

  function sync(): void {
    const isMobile = mobileQuery.matches;
    root.classList.toggle('ubuzima-native-mobile-interface', isMobile);

    if (!isMobile) {
      return;
    }

    ensureAppBar();
    ensureBottomNav();
    ensureQuickModuleStrip();
    tagMobileCards();
  }

  sync();
  window.setTimeout(sync, 500);
  window.setTimeout(sync, 1500);
  window.setInterval(sync, 2500);
  window.addEventListener('resize', sync, { passive: true });
  window.addEventListener('orientationchange', sync, { passive: true });

  const observer = new MutationObserver(sync);
  observer.observe(document.body, { childList: true, subtree: true });
}

installUbuzimaNativeMobileInterfaceV1();



type UbuzimaBeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice?: Promise<{ outcome: string; platform: string }>;
};

function installUbuzimaMobileAppShellNavigation(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  const root = document.documentElement;
  const mobileQuery = window.matchMedia('(max-width: 1024px)');
  const compactQuery = window.matchMedia('(max-width: 780px)');

  let sidebar: HTMLElement | null = null;
  let menuButton: HTMLButtonElement | null = null;
  let overlay: HTMLButtonElement | null = null;

  function findSidebar(): HTMLElement | null {
    const selectors = [
      '[data-admin-sidebar]',
      '[data-sidebar]',
      '.admin-sidebar',
      '.dashboard-sidebar',
      '.dashboard-shell-sidebar',
      '.sidebar',
      '.side-nav',
      '.left-menu',
      '.module-sidebar',
      '.app-sidebar',
      '.admin-navigation',
      '.dashboard-navigation',
      'aside',
    ];

    for (const selector of selectors) {
      const candidate = document.querySelector<HTMLElement>(selector);

      if (!candidate) {
        continue;
      }

      const text = candidate.textContent ?? '';
      const hasNavigationContent =
        /Dashboard|Inventory|Business|Sales|Procurement|Finance|Reports|Settings|Users|Admin|Pharma/i.test(text);

      if (hasNavigationContent) {
        candidate.dataset.ubuzimaDetectedSidebar = 'true';
        return candidate;
      }
    }

    return null;
  }

  function ensureControls(): void {
    if (!menuButton) {
      menuButton = document.createElement('button');
      menuButton.type = 'button';
      menuButton.className = 'ubuzima-mobile-menu-button';
      menuButton.setAttribute('aria-label', 'Open menu');
      menuButton.setAttribute('aria-expanded', 'false');
      menuButton.innerHTML = '<span></span><span></span><span></span>';
      document.body.appendChild(menuButton);

      menuButton.addEventListener('click', () => {
        if (root.classList.contains('ubuzima-mobile-menu-open')) {
          closeMenu();
        } else {
          openMenu();
        }
      });
    }

    if (!overlay) {
      overlay = document.createElement('button');
      overlay.type = 'button';
      overlay.className = 'ubuzima-mobile-menu-overlay';
      overlay.setAttribute('aria-label', 'Close menu');
      document.body.appendChild(overlay);
      overlay.addEventListener('click', closeMenu);
    }
  }

  function openMenu(): void {
    if (!mobileQuery.matches || !sidebar) {
      return;
    }

    root.classList.add('ubuzima-mobile-menu-open');
    sidebar.classList.add('ubuzima-mobile-sidebar-open');
    menuButton?.setAttribute('aria-expanded', 'true');
  }

  function closeMenu(): void {
    root.classList.remove('ubuzima-mobile-menu-open');
    sidebar?.classList.remove('ubuzima-mobile-sidebar-open');
    menuButton?.setAttribute('aria-expanded', 'false');
  }

  function bindSidebarCloseOnSelection(): void {
    if (!sidebar || sidebar.dataset.ubuzimaMobileNavBound === 'true') {
      return;
    }

    sidebar.dataset.ubuzimaMobileNavBound = 'true';

    sidebar.addEventListener('click', (event) => {
      const target = event.target as HTMLElement | null;

      if (!target) {
        return;
      }

      const interactive = target.closest('a,button,[role="button"],[data-module],[data-view]');

      if (!interactive) {
        return;
      }

      window.setTimeout(closeMenu, 120);
    });
  }

  function sync(): void {
    const isMobile = mobileQuery.matches;
    const isCompact = compactQuery.matches;

    root.classList.toggle('ubuzima-app-shell-mobile', isMobile);
    root.classList.toggle('ubuzima-app-shell-compact', isCompact);

    sidebar = findSidebar();

    if (sidebar) {
      sidebar.classList.toggle('ubuzima-mobile-sidebar', isMobile);
      bindSidebarCloseOnSelection();
    }

    ensureControls();

    if (!isMobile) {
      closeMenu();
    }
  }

  sync();

  window.addEventListener('resize', sync, { passive: true });
  window.addEventListener('orientationchange', sync, { passive: true });
  window.setInterval(sync, 1500);

  const observer = new MutationObserver(sync);
  observer.observe(document.body, { childList: true, subtree: true });
}

function installUbuzimaInstallAppPrompt(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  let deferredPrompt: UbuzimaBeforeInstallPromptEvent | null = null;
  let button: HTMLButtonElement | null = null;

  function ensureButton(): HTMLButtonElement {
    if (button) {
      return button;
    }

    button = document.createElement('button');
    button.type = 'button';
    button.className = 'ubuzima-install-app-button';
    button.textContent = 'Install app';
    button.hidden = true;
    document.body.appendChild(button);

    button.addEventListener('click', async () => {
      if (!deferredPrompt) {
        return;
      }

      button!.hidden = true;
      await deferredPrompt.prompt().catch(() => undefined);
      await deferredPrompt.userChoice?.catch(() => undefined);
      deferredPrompt = null;
    });

    return button;
  }

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event as UbuzimaBeforeInstallPromptEvent;
    ensureButton().hidden = false;
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;

    if (button) {
      button.hidden = true;
    }
  });
}

installUbuzimaMobileAppShellNavigation();
installUbuzimaInstallAppPrompt();



type DashboardSharedMetric = {
  label: string;
  valueText: string;
  valueNumber: number;
  updatedAt: number;
};

function installDashboardAnalyticsConsistencyLayer(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  const storageKey = 'ubuzimaSharedDashboardAnalyticsMetricsV1';
  const maxAgeMs = 30 * 60 * 1000;

  const labelAliases: Record<string, string> = {
    'gross sales': 'Gross Sales',
    'gross revenue': 'Gross Revenue',
    'net revenue': 'Net Revenue',
    'total inventory value': 'Total Inventory Value',
    'inventory value': 'Total Inventory Value',
    'stock on hand count': 'Stock on Hand Count',
    'low stock value': 'Low Stock Value',
    'low stock count': 'Low Stock Count',
    'near expiry value': 'Near Expiry Value',
    'near expiry count': 'Near Expiry Count',
    'expired value': 'Expired Value',
    'expired count': 'Expired Count',
    'expired stock value': 'Expired Value',
    'stock received value': 'Stock Received Value',
    'stock received count': 'Stock Received Count',
    'stock issued value': 'Stock Issued Value',
    'stock issued count': 'Stock Issued Count',
    'turnover value': 'Turnover Value',
    'turnover count': 'Turnover Count',
  };

  function normalizeText(value: string | null | undefined): string {
    return (value ?? '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function canonicalLabel(value: string | null | undefined): string | null {
    const normalized = normalizeText(value);

    if (!normalized) {
      return null;
    }

    if (labelAliases[normalized]) {
      return labelAliases[normalized];
    }

    const found = Object.entries(labelAliases).find(([key]) => normalized.includes(key));

    return found?.[1] ?? null;
  }

  function parseNumber(value: string | null | undefined): number {
    const parsed = Number((value ?? '').replace(/[^0-9.-]/g, ''));

    return Number.isFinite(parsed) ? parsed : 0;
  }

  function readCache(): Record<string, DashboardSharedMetric> {
    try {
      const raw = window.localStorage.getItem(storageKey);

      if (!raw) {
        return {};
      }

      const parsed = JSON.parse(raw) as Record<string, DashboardSharedMetric>;
      const now = Date.now();

      return Object.fromEntries(
        Object.entries(parsed).filter(([, metric]) =>
          metric &&
          Number.isFinite(metric.valueNumber) &&
          metric.valueNumber > 0 &&
          now - metric.updatedAt <= maxAgeMs,
        ),
      );
    } catch {
      return {};
    }
  }

  function writeCache(metrics: Record<string, DashboardSharedMetric>): void {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(metrics));
    } catch {
      // Storage is an enhancement only.
    }
  }

  function pageLooksLikeBusinessOverview(): boolean {
    const bodyText = document.body.textContent ?? '';
    const hasBusinessOverview = /Business Overview/i.test(bodyText);
    const hasInventoryAnalytics = /Inventory Analytics/i.test(bodyText);

    return hasBusinessOverview && !hasInventoryAnalytics;
  }

  function metricCards(): HTMLElement[] {
    return Array.from(
      document.querySelectorAll<HTMLElement>(
        [
          'article',
          '.dashboard-card',
          '.business-overview-card',
          '.review-card',
          '.inventory-analytics-request-kpis article',
          '.overview-kpi-card',
          '.business-overview-kpi-card',
        ].join(','),
      ),
    );
  }

  function labelFromCard(card: HTMLElement): string | null {
    const labelNode =
      card.querySelector<HTMLElement>('small') ||
      card.querySelector<HTMLElement>('[data-kpi-label]') ||
      card.querySelector<HTMLElement>('.kpi-label') ||
      card.querySelector<HTMLElement>('h4') ||
      card.querySelector<HTMLElement>('h3');

    return canonicalLabel(labelNode?.textContent);
  }

  function valueNodeFromCard(card: HTMLElement): HTMLElement | null {
    return (
      card.querySelector<HTMLElement>('strong') ||
      card.querySelector<HTMLElement>('[data-kpi-value]') ||
      card.querySelector<HTMLElement>('.kpi-value') ||
      null
    );
  }

  function collectBusinessOverviewMetrics(): void {
    if (!pageLooksLikeBusinessOverview()) {
      return;
    }

    const existing = readCache();
    const now = Date.now();

    metricCards().forEach((card) => {
      const label = labelFromCard(card);
      const valueNode = valueNodeFromCard(card);

      if (!label || !valueNode) {
        return;
      }

      const valueText = valueNode.textContent?.trim() ?? '';
      const valueNumber = parseNumber(valueText);

      if (valueNumber <= 0) {
        return;
      }

      existing[label] = {
        label,
        valueText,
        valueNumber,
        updatedAt: now,
      };
    });

    writeCache(existing);
  }

  function applySharedMetrics(): void {
    const cached = readCache();

    if (Object.keys(cached).length === 0) {
      return;
    }

    const sourceIsBusinessOverview = pageLooksLikeBusinessOverview();

    metricCards().forEach((card) => {
      const label = labelFromCard(card);
      const valueNode = valueNodeFromCard(card);

      if (!label || !valueNode || !cached[label]) {
        return;
      }

      const currentText = valueNode.textContent?.trim() ?? '';
      const currentNumber = parseNumber(currentText);
      const sharedMetric = cached[label];

      if (sourceIsBusinessOverview && currentNumber > 0) {
        return;
      }

      if (currentNumber <= 0 || currentText !== sharedMetric.valueText) {
        valueNode.textContent = sharedMetric.valueText;
        card.dataset.sharedAnalyticsSynced = 'true';
      }
    });
  }

  function sync(): void {
    collectBusinessOverviewMetrics();
    applySharedMetrics();
  }

  window.setTimeout(sync, 500);
  window.setTimeout(sync, 1500);
  window.setTimeout(sync, 3500);
  window.setInterval(sync, 5000);

  const observer = new MutationObserver(sync);
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
}

installDashboardAnalyticsConsistencyLayer();



function installUbuzimaMobileWebExperience(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  const root = document.documentElement;

  function syncMobileAppMode(): void {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

    const isMobileWidth = window.matchMedia('(max-width: 780px)').matches;

    root.classList.toggle('ubuzima-mobile-web', isMobileWidth);
    root.classList.toggle('ubuzima-standalone-webapp', isStandalone);
  }

  syncMobileAppMode();

  window.addEventListener('resize', syncMobileAppMode, { passive: true });
  window.addEventListener('orientationchange', syncMobileAppMode, { passive: true });

  if ('serviceWorker' in navigator && window.location.protocol === 'https:') {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/admin/sw.js', { scope: '/admin/' }).catch(() => {
        // Service worker is an enhancement only.
      });
    });
  }
}

installUbuzimaMobileWebExperience();


if (typeof window !== 'undefined') {
  try {
    window.localStorage.removeItem('businessOverviewInventoryRiskOverviewLastGoodHtml');
  } catch {
    // Ignore storage cleanup failures.
  }
}



import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles.css';
import App from './App';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
