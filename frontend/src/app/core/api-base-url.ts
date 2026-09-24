declare global {
  interface Window {
    __JUNIPER_LANE_CONFIG__?: {
      apiBaseUrl?: string;
    };
  }
}

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

function isLocalBrowser(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return ['localhost', '127.0.0.1'].includes(window.location.hostname);
}

/**
 * Resolve the FastAPI origin at runtime.
 * Production injects runtime-config.js during the static-site build.
 * Local Angular development falls back to FastAPI on port 8000.
 */
export function apiUrl(path = ''): string {
  const configured =
    typeof window !== 'undefined'
      ? normalizeBaseUrl(window.__JUNIPER_LANE_CONFIG__?.apiBaseUrl ?? '')
      : '';

  let baseUrl = configured;

  if (!baseUrl && isLocalBrowser()) {
    baseUrl = 'http://localhost:8000';
  }

  if (!baseUrl) {
    throw new Error(
      'API base URL is not configured. Set PUBLIC_API_BASE_URL during the production frontend build.',
    );
  }

  const suffix = path ? `/${path.replace(/^\/+/, '')}` : '';
  return `${baseUrl}${suffix}`;
}

export {};
