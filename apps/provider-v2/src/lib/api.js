const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';
let accessToken = null;
let onUnauthorized = null;
export function setAccessToken(token) {
    accessToken = token;
}
export function setUnauthorizedHandler(fn) {
    onUnauthorized = fn;
}
export class ApiError extends Error {
    status;
    code;
    details;
    constructor(status, message, code, details) {
        super(message);
        this.status = status;
        this.code = code;
        this.details = details;
    }
}
export async function apiFetch(path, opts = {}) {
    const { body, query, headers, ...rest } = opts;
    const url = new URL(`${BASE_URL}${path}`, window.location.origin);
    if (query) {
        for (const [k, v] of Object.entries(query)) {
            if (v !== undefined)
                url.searchParams.set(k, String(v));
        }
    }
    const res = await fetch(url.toString().replace(window.location.origin, ''), {
        ...rest,
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
            ...headers,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
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
    return payload;
}
