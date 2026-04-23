/**
 * Mobile API client.
 *
 * Key decisions baked in up-front — each has a history in this repo:
 *
 * - Bearer auth only (no cookies). Matches API contract; avoids RN cookie
 *   quirks on Android.
 * - Refresh request includes `{refresh_token}` in the BODY, not as a header
 *   or cookie (spec + current API).
 * - Logout is DELETE with `{refresh_token}` in body. POST returns 404. This
 *   bit the provider + admin portals earlier — do not repeat.
 * - Silent refresh serialised via a module-level promise mutex. RN isn't
 *   StrictMode (no double-invoke) but two parallel 401s can still race —
 *   the second would replay the revoked refresh token and the API would burn
 *   the whole token family.
 * - `/auth/*` paths are excluded from the auto-refresh loop. A 401 on the
 *   refresh endpoint itself means the session is unrecoverable; don't loop.
 */

import Constants from 'expo-constants';
import { clearTokens, getAccessToken, getRefreshToken, saveTokens } from './tokens';

const BASE_URL: string =
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ??
  'http://localhost:3000/api/v1';

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;
  constructor(status: number, message: string, code?: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  /** Skip the auth interceptor — used by /auth/* endpoints themselves. */
  skipAuth?: boolean;
  /**
   * Override the bearer token for this request. Used for transient tokens
   * like MFA setup_token that aren't stored in SecureStore. Implies skipAuth
   * for the purposes of the 401 refresh loop — if this token expires the
   * user restarts the flow.
   */
  authToken?: string;
};

let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

// Serialise concurrent refresh attempts. If a refresh is already in flight,
// subsequent 401s await the same promise instead of firing another.
let refreshInflight: Promise<string | null> | null = null;

async function performRefresh(): Promise<string | null> {
  const refresh_token = await getRefreshToken();
  if (!refresh_token) return null;

  try {
    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token }),
    });
    if (!res.ok) return null;
    const tokens = (await res.json()) as { access_token: string; refresh_token: string };
    await saveTokens(tokens.access_token, tokens.refresh_token);
    return tokens.access_token;
  } catch {
    return null;
  }
}

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshInflight) {
    refreshInflight = performRefresh().finally(() => {
      refreshInflight = null;
    });
  }
  return refreshInflight;
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = new URL(BASE_URL + path);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

async function request<T>(path: string, opts: RequestOptions, retry = true): Promise<T> {
  const { body, query, headers, skipAuth, authToken, ...rest } = opts;

  const h: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(headers as Record<string, string> | undefined),
  };
  if (authToken) {
    h.Authorization = `Bearer ${authToken}`;
  } else if (!skipAuth) {
    const access = await getAccessToken();
    if (access) h.Authorization = `Bearer ${access}`;
  }

  const res = await fetch(buildUrl(path, query), {
    ...rest,
    headers: h,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (res.status === 401 && !skipAuth && !authToken && retry && !path.startsWith('/auth/')) {
    const newAccess = await refreshAccessToken();
    if (newAccess) {
      return request<T>(path, opts, false);
    }
    // Refresh failed — session dead. Caller will be redirected by handler.
    await clearTokens();
    onUnauthorized?.();
    throw new ApiError(401, 'Session expired');
  }

  const contentType = res.headers.get('content-type');
  const isJson = contentType ? contentType.includes('application/json') : false;
  const payload: unknown = isJson ? await res.json() : null;

  if (!res.ok) {
    const p = (payload ?? {}) as { error?: { code?: string; message?: string; details?: unknown }; message?: string };
    const message = p.error?.message ?? p.message ?? res.statusText;
    throw new ApiError(res.status, message, p.error?.code, p.error?.details);
  }

  return payload as T;
}

export const api = {
  get: <T>(path: string, opts?: Omit<RequestOptions, 'body' | 'method'>) =>
    request<T>(path, { ...opts, method: 'GET' }),
  post: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'body' | 'method'>) =>
    request<T>(path, { ...opts, method: 'POST', body }),
  patch: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'body' | 'method'>) =>
    request<T>(path, { ...opts, method: 'PATCH', body }),
  delete: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'body' | 'method'>) =>
    request<T>(path, { ...opts, method: 'DELETE', body }),
};

export { BASE_URL };
