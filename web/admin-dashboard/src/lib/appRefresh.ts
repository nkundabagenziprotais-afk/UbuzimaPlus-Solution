export const APP_DATA_REFRESH_EVENT = 'ubuzima:data-refresh';

export type AppRefreshArea =
  | 'all'
  | 'dashboard'
  | 'inventory'
  | 'pos'
  | 'procurement'
  | 'finance'
  | 'reports'
  | 'security';

export function requestAppDataRefresh(area: AppRefreshArea = 'all') {
  window.dispatchEvent(
    new CustomEvent(APP_DATA_REFRESH_EVENT, {
      detail: { area, timestamp: Date.now() },
    }),
  );
}
