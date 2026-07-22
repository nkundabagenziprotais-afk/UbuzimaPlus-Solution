
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
