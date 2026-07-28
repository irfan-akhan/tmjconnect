/**
 * logSafeBody — Render a request body for structured logs without leaking PHI.
 *
 * A 400 is almost never diagnosable from the status line alone; you need to see
 * what was actually sent. But request bodies on this API routinely carry PHI, and
 * the logger contract (see config/logger.ts) is that PHI values never reach it.
 *
 * The compromise: redact by key name. Free-text and identity fields — the real
 * HIPAA hazard, and the fields whose *values* are rarely why a request failed
 * validation — are replaced with a type marker that preserves the one detail that
 * does matter for debugging ("it was a 4000-char string"). Everything else is
 * kept, because a `pain_level` of 11 or a `side` of "upper" IS the bug.
 *
 * Structural limits (depth, array length, string length) keep a hostile or
 * accidental megabyte payload from flooding the journal.
 */

/**
 * Keys whose values are redacted, matched case-insensitively against the exact
 * key name. Free text (a patient may type anything into it), direct identifiers,
 * and credentials.
 */
const SENSITIVE_KEYS = new Set([
  // Credentials and tokens — already redacted by pino for req.body, repeated
  // here because this helper is also called on bodies pino never serialises.
  'password', 'new_password', 'current_password', 'old_password',
  'token', 'refresh_token', 'mfa_token', 'access_token', 'code', 'secret',
  // Free text — unbounded patient/provider prose.
  'notes', 'note', 'description', 'message', 'body', 'content', 'reason',
  'comment', 'comments', 'summary', 'feedback', 'answer', 'answers',
  // Direct identifiers.
  'email', 'phone', 'phone_number', 'first_name', 'last_name', 'full_name',
  'name', 'date_of_birth', 'dob', 'address', 'address_line1', 'address_line2',
  'postal_code', 'zip', 'avatar_url', 'ssn',
]);

const MAX_DEPTH = 5;
const MAX_ARRAY_ITEMS = 20;
const MAX_STRING_LENGTH = 200;
const MAX_KEYS = 50;

function marker(value: unknown): string {
  if (typeof value === 'string') return `[redacted string(${value.length})]`;
  if (Array.isArray(value)) return `[redacted array(${value.length})]`;
  if (value === null) return '[redacted null]';
  return `[redacted ${typeof value}]`;
}

function sanitise(value: unknown, depth: number): unknown {
  if (value === null || value === undefined) return value;

  if (typeof value === 'string') {
    return value.length > MAX_STRING_LENGTH
      ? `${value.slice(0, MAX_STRING_LENGTH)}…[+${value.length - MAX_STRING_LENGTH} chars]`
      : value;
  }

  if (typeof value !== 'object') return value;

  if (depth >= MAX_DEPTH) return '[max depth]';

  if (Array.isArray(value)) {
    const items = value.slice(0, MAX_ARRAY_ITEMS).map((v) => sanitise(v, depth + 1));
    if (value.length > MAX_ARRAY_ITEMS) items.push(`[+${value.length - MAX_ARRAY_ITEMS} more]`);
    return items;
  }

  // Buffers/streams (file uploads) — never expand.
  if (Buffer.isBuffer(value)) return `[buffer(${value.length})]`;

  const out: Record<string, unknown> = {};
  let entries: [string, unknown][];
  try {
    entries = Object.entries(value as Record<string, unknown>);
  } catch {
    // Exotic object (proxy with a throwing ownKeys trap, revoked proxy, …).
    return '[unreadable object]';
  }

  for (const [key, v] of entries.slice(0, MAX_KEYS)) {
    try {
      // Reading `v` already happened above, but a getter can throw on access
      // during recursion into a nested object.
      out[key] = SENSITIVE_KEYS.has(key.toLowerCase()) ? marker(v) : sanitise(v, depth + 1);
    } catch {
      out[key] = '[unreadable]';
    }
  }
  if (entries.length > MAX_KEYS) out['…'] = `[+${entries.length - MAX_KEYS} more keys]`;
  return out;
}

/**
 * Never throws. This is called from the error handler, where an exception would
 * replace a well-formed error response with a hung request or an Express default
 * 500 — turning a diagnostic aid into an outage. Any failure degrades to a
 * marker string.
 */
export function logSafeBody(body: unknown): unknown {
  try {
    if (body === null || body === undefined) return undefined;
    if (typeof body === 'object' && !Array.isArray(body) && Object.keys(body).length === 0) {
      return undefined;
    }
    return sanitise(body, 0);
  } catch {
    return '[unserialisable body]';
  }
}
