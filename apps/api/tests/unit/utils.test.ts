import { setupTestEnv } from '../helpers/testEnv';
setupTestEnv();

import { stripHtml } from '@tmjconnect/shared';
import { parsePagination, buildOffsetMeta, parseCursorPagination } from '../../src/utils/pagination';
import { hashToken, generateToken, generateVerifyCode, encryptMfaSecret, decryptMfaSecret, encryptVerifyCode, decryptVerifyCode } from '../../src/utils/hash';
import { signAccessToken, verifyToken, verifyPurposeToken, signMfaToken } from '../../src/utils/jwt';
import { computeNextFireAt } from '../../src/utils/reminderTime';

// ─── stripHtml (shared) ───────────────────────────────────────────────────────────

describe('stripHtml', () => {
  it('strips script tag PAIRS including their contents', () => {
    expect(stripHtml('<script>alert("xss")</script>hello')).toBe('hello');
  });
  it('strips style and iframe tag pairs', () => {
    expect(stripHtml('<style>body{}</style>x<iframe src="evil"></iframe>')).toBe('x');
  });
  it('strips generic tags (without consuming inner text)', () => {
    expect(stripHtml('<p onclick="evil()">text</p>')).toBe('text');
    expect(stripHtml('<b>bold</b> normal')).toBe('bold normal');
  });
  it('passes plain text unchanged', () => {
    expect(stripHtml('Normal notes here')).toBe('Normal notes here');
  });
  it('handles malformed nested tags via iteration', () => {
    // The script-pair matcher consumes `<script>script>alert(1)</script>` and
    // leaves the orphan `<` behind as inert text — never an executable tag.
    expect(stripHtml('<<script>script>alert(1)</script>')).toBe('<');
  });
  it('strips comments and CDATA', () => {
    expect(stripHtml('hello<!-- evil -->world')).toBe('helloworld');
    expect(stripHtml('a<![CDATA[<script>x</script>]]>b')).toBe('ab');
  });
});

// ─── pagination ───────────────────────────────────────────────────────────────────

describe('parsePagination', () => {
  it('returns defaults when no params', () => {
    const result = parsePagination({});
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
    expect(result.offset).toBe(0);
  });
  it('clamps limit to MAX_PAGE_LIMIT', () => {
    const result = parsePagination({ page: '1', limit: '999' });
    expect(result.limit).toBe(100);
  });
  it('calculates correct offset', () => {
    const result = parsePagination({ page: '3', limit: '10' });
    expect(result.offset).toBe(20);
  });
});

describe('buildOffsetMeta', () => {
  it('correctly indicates hasMore', () => {
    expect(buildOffsetMeta(50, 1, 20).hasMore).toBe(true);
    expect(buildOffsetMeta(20, 1, 20).hasMore).toBe(false);
    expect(buildOffsetMeta(21, 1, 20).hasMore).toBe(true);
  });
});

describe('parseCursorPagination', () => {
  it('parses cursor ISO string to Date', () => {
    const iso = '2026-04-09T12:00:00.000Z';
    const result = parseCursorPagination({ cursor: iso, limit: '20' });
    expect(result.cursor).toBeInstanceOf(Date);
    expect(result.cursor?.toISOString()).toBe(iso);
  });
  it('returns null cursor when absent', () => {
    const result = parseCursorPagination({});
    expect(result.cursor).toBeNull();
  });
});

// ─── hash ─────────────────────────────────────────────────────────────────────────

describe('hashToken', () => {
  it('produces consistent SHA-256 hex for the same input', () => {
    const hash1 = hashToken('same-input');
    const hash2 = hashToken('same-input');
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
  });
  it('produces different hashes for different inputs', () => {
    expect(hashToken('aaa')).not.toBe(hashToken('bbb'));
  });
});

describe('generateToken', () => {
  it('generates hex string of correct length', () => {
    const token = generateToken(32); // 32 bytes → 64 hex chars
    expect(token).toHaveLength(64);
    expect(/^[0-9a-f]+$/.test(token)).toBe(true);
  });
  it('generates unique tokens', () => {
    expect(generateToken(32)).not.toBe(generateToken(32));
  });
});

describe('generateVerifyCode', () => {
  it('generates a 6-digit string', () => {
    const code = generateVerifyCode();
    expect(code).toHaveLength(6);
    expect(/^\d{6}$/.test(code)).toBe(true);
  });
  it('is within valid range', () => {
    for (let i = 0; i < 20; i++) {
      const code = parseInt(generateVerifyCode(), 10);
      expect(code).toBeGreaterThanOrEqual(100000);
      expect(code).toBeLessThanOrEqual(999999);
    }
  });
});

describe('encryptMfaSecret / decryptMfaSecret', () => {
  it('round-trips correctly', () => {
    const secret = 'JBSWY3DPEHPK3PXP';
    const encrypted = encryptMfaSecret(secret);
    expect(encrypted).not.toBe(secret);
    expect(decryptMfaSecret(encrypted)).toBe(secret);
  });
  it('produces different ciphertext each time (random IV)', () => {
    const secret = 'JBSWY3DPEHPK3PXP';
    expect(encryptMfaSecret(secret)).not.toBe(encryptMfaSecret(secret));
  });
});

describe('encryptVerifyCode / decryptVerifyCode', () => {
  it('round-trips a 6-digit code correctly', () => {
    const code = '482917';
    const encrypted = encryptVerifyCode(code);
    expect(encrypted).not.toBe(code);
    expect(decryptVerifyCode(encrypted)).toBe(code);
  });
  it('produces different ciphertext each time (random IV)', () => {
    const code = '123456';
    expect(encryptVerifyCode(code)).not.toBe(encryptVerifyCode(code));
  });
  it('throws on tampered ciphertext', () => {
    const encrypted = encryptVerifyCode('654321');
    const tampered = encrypted.slice(0, -2) + 'XX';
    expect(() => decryptVerifyCode(tampered)).toThrow();
  });
});

// ─── jwt ──────────────────────────────────────────────────────────────────────────

describe('signAccessToken / verifyToken', () => {
  it('signs and verifies a valid access token', () => {
    const payload = { id: 'user-123', email: 'test@test.com', role: 'patient' as const };
    const token = signAccessToken(payload);
    const decoded = verifyToken(token);
    expect(decoded).not.toBeNull();
    expect(decoded?.id).toBe(payload.id);
    expect(decoded?.role).toBe('patient');
  });

  it('returns null for an invalid token', () => {
    expect(verifyToken('not.a.valid.token')).toBeNull();
  });
});

describe('signMfaToken / verifyPurposeToken', () => {
  it('verifies an MFA token', () => {
    const token = signMfaToken('user-456');
    const userId = verifyPurposeToken(token, 'mfa');
    expect(userId).toBe('user-456');
  });

  it('rejects wrong purpose', () => {
    const token = signMfaToken('user-456');
    const userId = verifyPurposeToken(token, 'mfa_setup');
    expect(userId).toBeNull();
  });
});

// ─── computeNextFireAt ────────────────────────────────────────────────────────────
//
// Pinned "now": 2026-04-10T10:00:00.000Z — a Friday.
// Chicago in April = CDT = UTC-5, so "now" local = 05:00 Fri.

describe('computeNextFireAt', () => {
  const PINNED_NOW = new Date('2026-04-10T10:00:00.000Z'); // Friday 10:00 UTC

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(PINNED_NOW);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns same day when local fire time is still in the future', () => {
    // 08:00 Chicago = 13:00 UTC (UTC-5). Now is 10:00 UTC — still 3 h away.
    const result = computeNextFireAt('08:00', ['fri'], 'America/Chicago');
    expect(result.getUTCFullYear()).toBe(2026);
    expect(result.getUTCMonth()).toBe(3); // April = month 3 (0-indexed)
    expect(result.getUTCDate()).toBe(10);
    expect(result.getUTCHours()).toBe(13);
    expect(result.getUTCMinutes()).toBe(0);
  });

  it('skips to the same weekday next week when local fire time has already passed today', () => {
    // 04:00 Chicago = 09:00 UTC. Now is 10:00 UTC — already passed.
    // Next Friday = 2026-04-17.
    const result = computeNextFireAt('04:00', ['fri'], 'America/Chicago');
    expect(result.getUTCDate()).toBe(17);
    expect(result.getUTCHours()).toBe(9);
  });

  it('picks the nearest matching weekday from the list', () => {
    // Now is Friday. Requesting Saturday (tomorrow) and Monday.
    // Saturday (Apr 11) is closer than Monday (Apr 13).
    const result = computeNextFireAt('09:00', ['sat', 'mon'], 'America/Chicago');
    expect(result.getUTCDate()).toBe(11); // Saturday April 11
  });

  it('finds the next weekday when today is not in the list', () => {
    // Now = Friday. Only Monday requested → next Monday = Apr 13.
    const result = computeNextFireAt('09:00', ['mon'], 'America/Chicago');
    expect(result.getUTCDate()).toBe(13);
  });

  it('always returns a date in the future', () => {
    const result = computeNextFireAt('09:00', ['tue'], 'America/Chicago');
    expect(result.getTime()).toBeGreaterThan(PINNED_NOW.getTime());
  });

  it('result is within the next 8 days', () => {
    // Worst case: requested day is one day before today (Thu), so 6 days away.
    const result = computeNextFireAt('09:00', ['thu'], 'America/Chicago');
    const diffMs = result.getTime() - PINNED_NOW.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeGreaterThan(0);
    expect(diffDays).toBeLessThanOrEqual(8);
  });

  it('handles UTC timezone', () => {
    // 11:00 UTC is 1h in the future from "now" (10:00 UTC). Today is Friday.
    const result = computeNextFireAt('11:00', ['fri'], 'UTC');
    expect(result.getUTCDate()).toBe(10);
    expect(result.getUTCHours()).toBe(11);
  });

  it('handles times exactly on the minute boundary', () => {
    // 08:30 Chicago = 13:30 UTC.
    const result = computeNextFireAt('08:30', ['fri'], 'America/Chicago');
    expect(result.getUTCHours()).toBe(13);
    expect(result.getUTCMinutes()).toBe(30);
  });
});
