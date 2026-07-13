const DEFAULT_API_BASE_URL = '/api/v1';
const API_VERSION_MARKER = '/api/v1';

/**
 * Normalize the configured API root before any endpoint is appended.
 *
 * This protects the application from malformed build-time values such as:
 *
 *   /api/v1vitapharma
 *
 * Tenant identity belongs in X-Tenant-Slug and must never be concatenated
 * to the API root.
 */
export function normalizeApiBaseUrl(
  configuredValue?: string | null,
): string {
  let normalized = (configuredValue ?? '').trim();

  if (!normalized) {
    return DEFAULT_API_BASE_URL;
  }

  normalized = normalized.replace(/\/+$/, '');

  if (
    !normalized.startsWith('/')
    && !/^https?:\/\//i.test(normalized)
  ) {
    normalized = `/${normalized}`;
  }

  const lowerValue = normalized.toLowerCase();
  const markerIndex = lowerValue.indexOf(API_VERSION_MARKER);

  if (markerIndex >= 0) {
    normalized = normalized.slice(
      0,
      markerIndex + API_VERSION_MARKER.length,
    );
  }

  return normalized || DEFAULT_API_BASE_URL;
}

export function buildApiUrl(
  baseUrl: string,
  endpointPath: string,
): string {
  const normalizedBase = normalizeApiBaseUrl(baseUrl);
  const normalizedPath = endpointPath.replace(/^\/+/, '');

  return normalizedPath
    ? `${normalizedBase}/${normalizedPath}`
    : normalizedBase;
}
