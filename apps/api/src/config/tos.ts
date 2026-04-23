/**
 * Terms of Service version config.
 *
 * CURRENT_TOS_VERSION is the canonical version the app requires the user to
 * have accepted. When legal publishes a new version, bump this constant and
 * optionally ship the new text through ../content/tos.ts (not built yet —
 * v1 just surfaces the version + requires re-acceptance through the app).
 *
 * Users with `users.tos_version < CURRENT_TOS_VERSION` are treated as
 * "TOS stale" by the /auth/tos/current endpoint; the mobile app gates
 * sensitive actions behind re-acceptance.
 */

export const CURRENT_TOS_VERSION = '1.0';
export const CURRENT_TOS_PUBLISHED_AT = '2026-04-16T00:00:00Z';
