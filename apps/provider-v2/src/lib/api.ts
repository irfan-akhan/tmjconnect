const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

let accessToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

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
};

export async function apiFetch<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { body, query, headers, ...rest } = opts;
  const url = new URL(`${BASE_URL}${path}`, window.location.origin);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }

  // FormData / Blob bodies must NOT be JSON-stringified, and the browser sets
  // the multipart Content-Type (with boundary) automatically — we must omit
  // our default 'application/json' or the boundary is missing and the API 400s.
  const isMultipart = typeof FormData !== 'undefined' && body instanceof FormData;
  const isBlob = typeof Blob !== 'undefined' && body instanceof Blob;
  const passthroughBody = isMultipart || isBlob;

  const res = await fetch(url.toString().replace(window.location.origin, ''), {
    ...rest,
    credentials: 'include',
    headers: {
      ...(passthroughBody ? {} : { 'Content-Type': 'application/json' }),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...headers,
    },
    body:
      body === undefined
        ? undefined
        : passthroughBody
          ? (body as BodyInit)
          : JSON.stringify(body),
  });

  if (res.status === 401) {
    onUnauthorized?.();
    throw new ApiError(401, 'Unauthorized');
  }

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const payload = isJson ? await res.json() : null;

  if (!res.ok) {
    const message = payload?.error?.message ?? payload?.message ?? res.statusText;
    throw new ApiError(res.status, message, payload?.error?.code, payload?.error?.details);
  }

  return payload as T;
}
