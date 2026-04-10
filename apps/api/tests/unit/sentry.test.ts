import { setupTestEnv } from '../helpers/testEnv';
setupTestEnv();

import { scrubObject } from '../../src/config/sentry';

describe('Sentry scrubObject — PII scrubbing', () => {
  it('redacts top-level PII keys', () => {
    const input = {
      email: 'patient@test.com',
      phone: '+15551234567',
      first_name: 'Jane',
      last_name: 'Doe',
      pain_level: 7,
      requestId: 'abc-123',
    };
    const result = scrubObject(input) as Record<string, unknown>;
    expect(result.email).toBe('[REDACTED]');
    expect(result.phone).toBe('[REDACTED]');
    expect(result.first_name).toBe('[REDACTED]');
    expect(result.last_name).toBe('[REDACTED]');
    expect(result.pain_level).toBe('[REDACTED]'); // clinical PHI
    expect(result.requestId).toBe('abc-123'); // safe to keep
  });

  it('redacts auth secrets', () => {
    const input = {
      password: 'Secret@123',
      access_token: 'eyJhbGc...',
      refresh_token: 'abc.def.ghi',
      mfa_token: 'mfa-token',
      code: '123456',
      mfa_secret: 'JBSWY3DPEHPK3PXP',
      authorization: 'Bearer xxx',
    };
    const result = scrubObject(input) as Record<string, unknown>;
    expect(result.password).toBe('[REDACTED]');
    expect(result.access_token).toBe('[REDACTED]');
    expect(result.refresh_token).toBe('[REDACTED]');
    expect(result.mfa_token).toBe('[REDACTED]');
    expect(result.code).toBe('[REDACTED]');
    expect(result.mfa_secret).toBe('[REDACTED]');
    expect(result.authorization).toBe('[REDACTED]');
  });

  it('recursively scrubs nested objects', () => {
    const input = {
      user: {
        id: 'user-123',
        profile: {
          email: 'nested@test.com',
          city: 'Austin',
          age: 30,
        },
      },
      meta: {
        requestId: 'req-456',
      },
    };
    const result = scrubObject(input) as Record<string, Record<string, unknown>>;
    expect(result.user.id).toBe('user-123');
    expect((result.user.profile as Record<string, unknown>).email).toBe('[REDACTED]');
    expect((result.user.profile as Record<string, unknown>).city).toBe('[REDACTED]');
    expect((result.user.profile as Record<string, unknown>).age).toBe(30);
    expect(result.meta.requestId).toBe('req-456');
  });

  it('scrubs keys inside arrays of objects', () => {
    const input = {
      items: [
        { email: 'a@test.com', id: 1 },
        { email: 'b@test.com', id: 2 },
      ],
    };
    const result = scrubObject(input) as { items: Array<Record<string, unknown>> };
    expect(result.items[0].email).toBe('[REDACTED]');
    expect(result.items[0].id).toBe(1);
    expect(result.items[1].email).toBe('[REDACTED]');
    expect(result.items[1].id).toBe(2);
  });

  it('redacts keys containing "phi" (case-insensitive)', () => {
    const input = {
      phi_data: 'sensitive',
      patient_PHI: 'sensitive',
      phiRecord: 'sensitive',
      safe_field: 'ok',
    };
    const result = scrubObject(input) as Record<string, unknown>;
    expect(result.phi_data).toBe('[REDACTED]');
    expect(result.patient_PHI).toBe('[REDACTED]');
    expect(result.phiRecord).toBe('[REDACTED]');
    expect(result.safe_field).toBe('ok');
  });

  it('passes primitives through unchanged', () => {
    expect(scrubObject('hello')).toBe('hello');
    expect(scrubObject(42)).toBe(42);
    expect(scrubObject(true)).toBe(true);
    expect(scrubObject(null)).toBe(null);
    expect(scrubObject(undefined)).toBe(undefined);
  });

  it('redacts clinical fields (pain_level, body_areas, triggers, notes)', () => {
    const input = {
      pain_level: 8,
      body_areas: [{ area: 'jaw', side: 'left' }],
      triggers: ['stress', 'cold'],
      notes: 'Patient reports increased pain at night',
      duration_minutes: 30,
    };
    const result = scrubObject(input) as Record<string, unknown>;
    expect(result.pain_level).toBe('[REDACTED]');
    expect(result.body_areas).toBe('[REDACTED]');
    expect(result.triggers).toBe('[REDACTED]');
    expect(result.notes).toBe('[REDACTED]');
    expect(result.duration_minutes).toBe(30); // not in PII list
  });

  it('handles deeply nested structures without infinite recursion', () => {
    const deep: Record<string, unknown> = { level: 0 };
    let current = deep;
    for (let i = 1; i < 15; i++) {
      const next: Record<string, unknown> = { level: i };
      current.next = next;
      current = next;
    }
    const result = scrubObject(deep);
    expect(result).toBeDefined();
    // Should not throw or infinite loop.
  });

  it('redacts MfaSetupRequired-like response payload', () => {
    const input = {
      mfa_setup_required: true,
      setup_token: 'eyJhbGc.token.here',
    };
    const result = scrubObject(input) as Record<string, unknown>;
    expect(result.mfa_setup_required).toBe(true);
    expect(result.setup_token).toBe('[REDACTED]');
  });
});
