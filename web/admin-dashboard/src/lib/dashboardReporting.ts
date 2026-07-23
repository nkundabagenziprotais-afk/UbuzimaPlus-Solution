export type DashboardMetricMode = 'as_at' | 'period' | 'trend';

export type DashboardDateRange = {
  dateFrom: string;
  dateTo: string;
};

export type DashboardCacheScope =
  | 'business-overview'
  | 'pos-sales'
  | 'inventory-analytics'
  | 'insurance'
  | 'finance'
  | 'shared';

type DashboardCacheRecord = {
  payload: unknown;
  updatedAt: string;
  url: string;
  scope: DashboardCacheScope;
};

type DashboardEndpointSpec = {
  scope: DashboardCacheScope;
  patterns: RegExp[];
};

const CACHE_PREFIX = 'ubuzima:last-good-dashboard:v8';

const DEFAULT_ENDPOINTS: DashboardEndpointSpec[] = [
  {
    scope: 'business-overview',
    patterns: [
      /\/pharmaco\/business-analytics\/live/i,
      /\/business-analytics\/live/i,
    ],
  },
  {
    scope: 'pos-sales',
    patterns: [
      /\/pharmaco\/sales(?:\?|$)/i,
      /\/pharmaco\/sales-register/i,
      /\/pharmaco\/pos\/sessions/i,
    ],
  },
  {
    scope: 'inventory-analytics',
    patterns: [
      /\/pharmaco\/inventory\/analytics/i,
      /\/pharmaco\/inventory\/dashboard/i,
      /\/pharmaco\/inventory\/kpi/i,
      /\/pharmaco\/inventory\/stock/i,
    ],
  },
];

export function currentMonthDateRange(today = new Date()): DashboardDateRange {
  const dateTo = today.toISOString().slice(0, 10);
  const dateFrom = `${dateTo.slice(0, 8)}01`;

  return { dateFrom, dateTo };
}

export function dashboardBusinessDateKey(value: unknown): string {
  const raw = String(value ?? '').trim();

  if (!raw) {
    return '';
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }

  const parsed = new Date(raw);

  if (Number.isFinite(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return raw.slice(0, 10);
}

export function dashboardDateKeys(dateFrom: string, dateTo: string): string[] {
  const start = new Date(`${dateFrom}T00:00:00`);
  const end = new Date(`${dateTo}T00:00:00`);

  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start > end) {
    return [];
  }

  const keys: string[] = [];
  const cursor = new Date(start);

  while (cursor <= end) {
    keys.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }

  return keys;
}

export function dashboardMetricModeLabel(
  mode: DashboardMetricMode,
  range: DashboardDateRange,
): string {
  if (mode === 'as_at') {
    return `As at ${range.dateTo}`;
  }

  if (mode === 'trend') {
    return `Grouped by Business Date`;
  }

  return `${range.dateFrom} – ${range.dateTo}`;
}

export function dashboardNumber(value: unknown): number {
  const parsed =
    typeof value === 'number'
      ? value
      : Number(String(value ?? '').replace(/[^0-9.-]/g, ''));

  return Number.isFinite(parsed) ? parsed : 0;
}

export function filterPeriodRows<T extends Record<string, unknown>>(
  rows: T[],
  range: DashboardDateRange,
  dateFields = ['business_date', 'businessDate', 'date', 'created_at', 'createdAt'],
): T[] {
  return rows.filter((row) => {
    const dateKey = firstBusinessDateKey(row, dateFields);

    return dateKey >= range.dateFrom && dateKey <= range.dateTo;
  });
}

export function filterAsAtRows<T extends Record<string, unknown>>(
  rows: T[],
  dateTo: string,
  dateFields = ['business_date', 'businessDate', 'date', 'created_at', 'createdAt'],
): T[] {
  return rows.filter((row) => {
    const dateKey = firstBusinessDateKey(row, dateFields);

    return !!dateKey && dateKey <= dateTo;
  });
}

export function bucketTrendByBusinessDate<T extends Record<string, unknown>>(
  rows: T[],
  dateKeys: string[],
  valueSelector: (row: T) => number,
  dateFields = ['business_date', 'businessDate', 'date', 'day', 'period', 'created_at', 'createdAt'],
): number[] {
  const bucket = new Map<string, number>();

  rows.forEach((row) => {
    const dateKey = firstBusinessDateKey(row, dateFields);

    if (!dateKey) {
      return;
    }

    bucket.set(dateKey, (bucket.get(dateKey) ?? 0) + valueSelector(row));
  });

  return dateKeys.map((dateKey) => bucket.get(dateKey) ?? 0);
}

function firstBusinessDateKey(
  row: Record<string, unknown>,
  dateFields: string[],
): string {
  for (const field of dateFields) {
    const dateKey = dashboardBusinessDateKey(row[field]);

    if (dateKey) {
      return dateKey;
    }
  }

  return '';
}

export function installDashboardLastGoodFetchCache(
  endpointSpecs: DashboardEndpointSpec[] = DEFAULT_ENDPOINTS,
): void {
  if (typeof window === 'undefined' || typeof window.fetch !== 'function') {
    return;
  }

  const currentWindow = window as Window & {
    __ubuzimaDashboardLastGoodFetchInstalled?: boolean;
  };

  if (currentWindow.__ubuzimaDashboardLastGoodFetchInstalled) {
    return;
  }

  currentWindow.__ubuzimaDashboardLastGoodFetchInstalled = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const request = new Request(input, init);
    const method = (request.method || 'GET').toUpperCase();
    const url = request.url;
    const endpoint = method === 'GET' ? matchDashboardEndpoint(url, endpointSpecs) : null;

    if (!endpoint) {
      return originalFetch(request);
    }

    const cacheKey = dashboardCacheKey(endpoint.scope, url);

    try {
      const response = await originalFetch(request);
      const responseClone = response.clone();

      if (!isJsonResponse(responseClone)) {
        return response;
      }

      try {
        const payload = await responseClone.json();

        if (response.ok && isUsefulDashboardPayload(payload)) {
          writeDashboardCache(cacheKey, {
            payload,
            updatedAt: new Date().toISOString(),
            url,
            scope: endpoint.scope,
          });

          return response;
        }

        const cached = readDashboardCache(cacheKey);

        if (cached) {
          return cachedJsonResponse(cached);
        }

        return response;
      } catch {
        return response;
      }
    } catch (error) {
      const cached = readDashboardCache(cacheKey);

      if (cached) {
        return cachedJsonResponse(cached);
      }

      throw error;
    }
  };

  window.addEventListener('ubuzima:business-overview-force-refresh', () => {
    clearDashboardCacheScope('business-overview');
  });

  window.addEventListener('ubuzima:pos-sales-force-refresh', () => {
    clearDashboardCacheScope('pos-sales');
  });

  window.addEventListener('ubuzima:inventory-analytics-force-refresh', () => {
    clearDashboardCacheScope('inventory-analytics');
  });

  window.addEventListener('ubuzima:dashboard-force-refresh', () => {
    clearDashboardCacheScope('shared');
    clearDashboardCacheScope('business-overview');
    clearDashboardCacheScope('pos-sales');
    clearDashboardCacheScope('inventory-analytics');
  });
}

function matchDashboardEndpoint(
  url: string,
  endpointSpecs: DashboardEndpointSpec[],
): DashboardEndpointSpec | null {
  return endpointSpecs.find((endpoint) =>
    endpoint.patterns.some((pattern) => pattern.test(url)),
  ) ?? null;
}

function dashboardCacheKey(scope: DashboardCacheScope, url: string): string {
  const parsed = new URL(url, window.location.origin);
  parsed.searchParams.delete('_');
  parsed.searchParams.delete('cacheBust');
  parsed.searchParams.delete('cache_bust');

  const params = Array.from(parsed.searchParams.entries())
    .sort(([left], [right]) => left.localeCompare(right));

  const normalizedSearch = new URLSearchParams(params).toString();
  const identity = `${parsed.pathname}${normalizedSearch ? `?${normalizedSearch}` : ''}`;

  return `${CACHE_PREFIX}:${scope}:${identity}`;
}

function isJsonResponse(response: Response): boolean {
  const contentType = response.headers.get('content-type') || '';

  return contentType.includes('application/json');
}

function readDashboardCache(cacheKey: string): DashboardCacheRecord | null {
  try {
    const raw = window.localStorage.getItem(cacheKey);

    if (!raw) {
      return null;
    }

    return JSON.parse(raw) as DashboardCacheRecord;
  } catch {
    return null;
  }
}

function writeDashboardCache(cacheKey: string, record: DashboardCacheRecord): void {
  try {
    window.localStorage.setItem(cacheKey, JSON.stringify(record));
    window.localStorage.setItem(`${cacheKey}:updatedAt`, record.updatedAt);
  } catch {
    pruneDashboardCache();

    try {
      window.localStorage.setItem(cacheKey, JSON.stringify(record));
    } catch {
      // Ignore storage quota failures.
    }
  }
}

function cachedJsonResponse(record: DashboardCacheRecord): Response {
  return new Response(JSON.stringify(record.payload), {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'x-ubuzima-last-good-cache': 'true',
      'x-ubuzima-last-good-cache-updated-at': record.updatedAt,
      'x-ubuzima-last-good-cache-scope': record.scope,
    },
  });
}

function clearDashboardCacheScope(scope: DashboardCacheScope): void {
  try {
    Object.keys(window.localStorage)
      .filter((key) => key.startsWith(`${CACHE_PREFIX}:${scope}:`))
      .forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // Ignore storage cleanup failures.
  }
}

function pruneDashboardCache(): void {
  try {
    const keys = Object.keys(window.localStorage)
      .filter((key) => key.startsWith(CACHE_PREFIX))
      .slice(0, 30);

    keys.forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // Ignore storage cleanup failures.
  }
}

function isUsefulDashboardPayload(payload: unknown): boolean {
  if (!payload) {
    return false;
  }

  if (Array.isArray(payload)) {
    return payload.length > 0;
  }

  if (typeof payload !== 'object') {
    return false;
  }

  return containsUsefulSignal(payload, 0);
}

function containsUsefulSignal(value: unknown, depth: number): boolean {
  if (depth > 5 || value === null || value === undefined) {
    return false;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) && Math.abs(value) > 0;
  }

  if (typeof value === 'string') {
    return value.trim().length > 0 && !['0', '0.0', '0.00'].includes(value.trim());
  }

  if (Array.isArray(value)) {
    return value.length > 0 && value.some((item) => containsUsefulSignal(item, depth + 1));
  }

  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).some((item) =>
      containsUsefulSignal(item, depth + 1),
    );
  }

  return false;
}
